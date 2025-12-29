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
import { useSmartRecording } from "@/hooks/useSmartRecording";
import { useEmergencyAlert } from "@/hooks/useEmergencyAlert";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { useVolumeButtonTrigger } from "@/hooks/useVolumeButtonTrigger";
import { useWakeWordTrigger } from "@/hooks/useWakeWordTrigger";
import { reverseGeocode } from "@/hooks/useReverseGeocode";

import { AlertHistory } from "@/components/AlertHistory";

const Contacts = lazy(() => import("@/pages/Contacts"));
const Settings = lazy(() => import("@/pages/Settings"));

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [showCancelWindow, setShowCancelWindow] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [alertStartTime, setAlertStartTime] = useState<Date | null>(null);
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [triggerType, setTriggerType] = useState<"button" | "voice">("button");
  
  // Settings state
  const [wakeWord, setWakeWord] = useState("resqme");
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isVolumeButtonEnabled, setIsVolumeButtonEnabled] = useState(true);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline, pendingAlerts, cacheAlert, markAsSynced } = useOfflineCache();

  // Smart recording with silence detection
  const handleRecordingComplete = useCallback(async (audioBlob: Blob, duration: number) => {
    if (!currentAlertId || !user) return;
    
    console.log(`Recording complete: ${duration}s`);
    
    // Convert to base64 for edge function
    const buffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const audioBase64 = btoa(binary);

    // Process the emergency
    await processEmergency(audioBase64, currentAlertId, user.id, location);
  }, [currentAlertId, user, location]);

  const { 
    isRecording, 
    duration: recordingDuration,
    isSilent,
    silenceDuration,
    startRecording, 
    stopRecording,
  } = useSmartRecording({
    maxDuration: 180, // 3 minutes max
    silenceTimeout: 10, // Stop after 10 seconds of silence
    onRecordingComplete: handleRecordingComplete,
    onSilenceDetected: () => {
      toast({
        title: "Recording Stopped",
        description: "Extended silence detected. Processing alert...",
      });
    },
  });

  // Emergency alert processing
  const { 
    isProcessing, 
    isSendingNotifications, 
    summary,
    processEmergency,
    reset: resetEmergencyAlert,
  } = useEmergencyAlert({
    onComplete: () => {
      toast({
        title: "Alert Sent",
        description: "Emergency contacts have been notified",
      });
    },
  });

  // Hardware trigger handler (volume buttons and wake word)
  const handleHardwareTrigger = useCallback(() => {
    if (!isAlertActive && !showCancelWindow) {
      setTriggerType("voice");
      setShowCancelWindow(true);
    }
  }, [isAlertActive, showCancelWindow]);

  // Volume button trigger (Android only via Capacitor)
  const { isSupported: volumeButtonSupported } = useVolumeButtonTrigger({
    onTrigger: handleHardwareTrigger,
    enabled: isVolumeButtonEnabled && !isAlertActive && !showCancelWindow,
  });

  // Wake word trigger (background voice detection)
  const {
    isSupported: wakeWordSupported,
    isListening: isWakeWordListening,
    currentWakeWord,
    updateWakeWord,
    startListening: startWakeWord,
    stopListening: stopWakeWord,
  } = useWakeWordTrigger({
    onTrigger: handleHardwareTrigger,
    enabled: isVoiceEnabled && !isAlertActive && !showCancelWindow,
    wakeWord,
  });

  // Handle wake word changes from settings
  const handleWakeWordChange = useCallback(async (newWord: string) => {
    setWakeWord(newWord);
    await updateWakeWord(newWord);
  }, [updateWakeWord]);

  // Handle voice enable/disable
  const handleVoiceEnabledChange = useCallback(async (enabled: boolean) => {
    setIsVoiceEnabled(enabled);
    if (enabled) {
      await startWakeWord();
    } else {
      await stopWakeWord();
    }
  }, [startWakeWord, stopWakeWord]);

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

  // Audio processing is now handled by handleRecordingComplete callback

  const handleSOSTrigger = () => {
    if (isAlertActive) {
      cancelAlert();
      return;
    }

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
      // Get address from coordinates
      let address: string | null = null;
      if (location?.lat && location?.lng) {
        address = await reverseGeocode(location.lat, location.lng);
      }

      const { data } = await supabase.from("alerts").insert({
        user_id: user.id,
        status: "active",
        latitude: location?.lat,
        longitude: location?.lng,
        address: address,
        trigger_type: triggerType,
      }).select().single();

      if (data) {
        setCurrentAlertId(data.id);
        
        await supabase.from("alert_locations").insert({
          alert_id: data.id,
          latitude: location?.lat || 0,
          longitude: location?.lng || 0,
          accuracy: location?.accuracy,
        });

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
    resetEmergencyAlert();

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
    if (isWakeWordListening) {
      stopWakeWord();
    } else {
      startWakeWord();
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-24">
      {showCancelWindow && (
        <CancelCountdown
          duration={5}
          onComplete={activateAlert}
          onCancel={handleCancelCountdown}
        />
      )}

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

              <VoiceCommandIndicator
                isListening={isWakeWordListening}
                isSupported={wakeWordSupported}
                onToggle={toggleVoiceListening}
                transcript={`Listening for "${currentWakeWord}"`}
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

            {(wakeWordSupported || volumeButtonSupported) && (
              <div className="mt-6 p-4 rounded-2xl bg-card border border-border text-center">
                <p className="text-sm text-muted-foreground">
                  💡 Tips: 
                  {wakeWordSupported && isVoiceEnabled && (
                    <span> Say <span className="text-secondary font-medium">"{currentWakeWord} help"</span> to trigger hands-free.</span>
                  )}
                  {volumeButtonSupported && isVolumeButtonEnabled && (
                    <span> Press <span className="text-secondary font-medium">Vol+ & Vol-</span> together for quick trigger.</span>
                  )}
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
          <AlertHistory />
        )}

        {activeTab === "settings" && (
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground">Loading...</div>}>
            <Settings
              wakeWord={wakeWord}
              onWakeWordChange={handleWakeWordChange}
              isVoiceEnabled={isVoiceEnabled}
              onVoiceEnabledChange={handleVoiceEnabledChange}
              isVolumeButtonEnabled={isVolumeButtonEnabled}
              onVolumeButtonEnabledChange={setIsVolumeButtonEnabled}
            />
          </Suspense>
        )}
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
