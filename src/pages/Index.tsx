import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SOSButton } from "@/components/SOSButton";
import { StatusBar } from "@/components/StatusBar";
import { LocationCard } from "@/components/LocationCard";
import { Navigation } from "@/components/Navigation";
import { ActiveAlertBanner } from "@/components/ActiveAlertBanner";
import { CancelCountdown } from "@/components/CancelCountdown";
import { VoiceCommandIndicator } from "@/components/VoiceCommandIndicator";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { useOfflineCache } from "@/hooks/useOfflineCache";

const Contacts = lazy(() => import("@/pages/Contacts"));

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [showCancelWindow, setShowCancelWindow] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [alertStartTime, setAlertStartTime] = useState<Date | null>(null);
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [triggerType, setTriggerType] = useState<"button" | "voice">("button");
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { isRecording, startRecording, stopRecording, audioBlob } = useAudioRecording();
  const { isOnline, pendingAlerts, cacheAlert, markAsSynced } = useOfflineCache();

  // Voice command handler
  const handleVoiceAlert = useCallback(() => {
    if (!isAlertActive && !showCancelWindow) {
      setTriggerType("voice");
      setShowCancelWindow(true);
    }
  }, [isAlertActive, showCancelWindow]);

  const { isListening, isSupported, transcript, startListening, stopListening } = useVoiceCommand({
    wakeWord: "resqme",
    onWakeWordDetected: handleVoiceAlert,
  });

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Location tracking
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setLocation({ 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude, 
          accuracy: pos.coords.accuracy 
        }),
        () => toast({ 
          title: "Location access needed", 
          description: "Please enable location for emergency features", 
          variant: "destructive" 
        }),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [toast]);

  // Sync pending alerts when back online
  useEffect(() => {
    if (isOnline && pendingAlerts.length > 0 && user) {
      pendingAlerts.forEach(async (alert) => {
        try {
          await supabase.from("alerts").insert({
            user_id: user.id,
            status: "active",
            latitude: alert.latitude,
            longitude: alert.longitude,
            trigger_type: "button",
          });
          markAsSynced(alert.id);
        } catch (e) {
          console.error("Failed to sync alert:", e);
        }
      });
    }
  }, [isOnline, pendingAlerts, user, markAsSynced]);

  // Upload audio when recording stops
  useEffect(() => {
    if (audioBlob && currentAlertId && user) {
      const uploadAudio = async () => {
        const fileName = `${user.id}/${currentAlertId}-${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("audio-recordings")
          .upload(fileName, audioBlob);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("audio-recordings")
            .getPublicUrl(fileName);

          await supabase
            .from("alerts")
            .update({ audio_url: publicUrl })
            .eq("id", currentAlertId);
        }
      };
      uploadAudio();
    }
  }, [audioBlob, currentAlertId, user]);

  const handleSOSTrigger = () => {
    if (isAlertActive) {
      // Cancel active alert
      cancelAlert();
      return;
    }

    // Show cancel countdown window
    setTriggerType("button");
    setShowCancelWindow(true);
  };

  const activateAlert = async () => {
    setShowCancelWindow(false);
    setIsAlertActive(true);
    setAlertStartTime(new Date());

    // Start audio recording
    try {
      await startRecording();
    } catch (e) {
      console.error("Failed to start recording:", e);
    }

    if (!isOnline) {
      // Cache alert for later sync
      cacheAlert({
        id: crypto.randomUUID(),
        userId: user?.id || "",
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        timestamp: new Date().toISOString(),
      });
      toast({ 
        title: "🚨 Alert Cached", 
        description: "Will send when connection is restored", 
        variant: "destructive" 
      });
      return;
    }

    if (user) {
      const { data } = await supabase.from("alerts").insert({
        user_id: user.id,
        status: "active",
        latitude: location?.lat,
        longitude: location?.lng,
        trigger_type: triggerType,
      }).select().single();

      if (data) {
        setCurrentAlertId(data.id);
        
        // Create initial location entry
        await supabase.from("alert_locations").insert({
          alert_id: data.id,
          latitude: location?.lat || 0,
          longitude: location?.lng || 0,
          accuracy: location?.accuracy,
        });

        // Notify contacts (would trigger edge function for SMS)
        const { data: contacts } = await supabase
          .from("emergency_contacts")
          .select("id")
          .eq("user_id", user.id);

        if (contacts) {
          const logs = contacts.map((c) => ({
            alert_id: data.id,
            contact_id: c.id,
            notification_type: "push",
            status: "pending",
          }));
          await supabase.from("notification_logs").insert(logs);
        }
      }
    }

    toast({ 
      title: "🚨 Emergency Alert Activated", 
      description: "Sharing location and recording audio", 
      variant: "destructive" 
    });
  };

  const cancelAlert = async () => {
    setIsAlertActive(false);
    setAlertStartTime(null);
    stopRecording();

    if (currentAlertId) {
      await supabase
        .from("alerts")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", currentAlertId);
      setCurrentAlertId(null);
    }

    toast({ title: "Alert Cancelled", description: "Emergency alert has been deactivated" });
  };

  const handleCancelCountdown = () => {
    setShowCancelWindow(false);
    toast({ title: "Alert Cancelled", description: "False alarm prevented" });
  };

  const toggleVoiceListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-24">
      {/* Cancel countdown overlay */}
      {showCancelWindow && (
        <CancelCountdown
          duration={5}
          onComplete={activateAlert}
          onCancel={handleCancelCountdown}
        />
      )}

      {/* Offline indicator */}
      <OfflineIndicator isOnline={isOnline} pendingCount={pendingAlerts.length} />

      {isAlertActive && alertStartTime && currentAlertId && (
        <ActiveAlertBanner
          alertId={currentAlertId}
          startedAt={alertStartTime}
          isRecording={isRecording}
          onCancel={cancelAlert}
        />
      )}

      <div className={`px-4 py-6 max-w-lg mx-auto ${isAlertActive ? "pt-32" : !isOnline ? "pt-20" : ""}`}>
        {activeTab === "home" && (
          <>
            <header className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-foreground">ResQMe</h1>
                  <p className="text-xs text-muted-foreground">Your safety companion</p>
                </div>
              </div>

              {/* Voice command toggle */}
              <VoiceCommandIndicator
                isListening={isListening}
                isSupported={isSupported}
                onToggle={toggleVoiceListening}
                transcript={transcript}
              />
            </header>

            <StatusBar 
              isLocationEnabled={!!location} 
              isRecording={isRecording} 
              isConnected={isOnline} 
            />

            <div className="flex items-center justify-center my-12">
              <SOSButton 
                onTrigger={handleSOSTrigger} 
                isActive={isAlertActive} 
                isRecording={isRecording} 
              />
            </div>

            <LocationCard
              latitude={location?.lat || null}
              longitude={location?.lng || null}
              accuracy={location?.accuracy || null}
              isTracking={isAlertActive}
            />

            {isSupported && (
              <div className="mt-6 p-4 rounded-2xl bg-card border border-border text-center">
                <p className="text-sm text-muted-foreground">
                  💡 Tip: Say <span className="text-secondary font-medium">"ResQMe help"</span> to trigger an alert hands-free
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "contacts" && (
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground">Loading...</div>}>
            <Contacts />
          </Suspense>
        )}

        {activeTab === "history" && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Alert history coming soon</p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Settings coming soon</p>
          </div>
        )}
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
