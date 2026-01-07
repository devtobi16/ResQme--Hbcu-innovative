import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
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
import { pendingSosKey } from "@/components/NativeSOSTriggerListener";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSmartRecording } from "@/hooks/useSmartRecording";
import { useEmergencyAlert } from "@/hooks/useEmergencyAlert";
import { useHybridAlert } from "@/hooks/useHybridAlert";
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

  const pendingRecordingRef = useRef<
    | {
        audioBase64: string;
        audioMimeType?: string;
        location: { lat: number; lng: number } | null;
      }
    | null
  >(null);
  
  // Settings state
  const [wakeWord, setWakeWord] = useState("resqme");
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isVolumeButtonEnabled, setIsVolumeButtonEnabled] = useState(true);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Get user profile for name
  const [userProfile, setUserProfile] = useState<{ full_name: string | null }>({ full_name: null });

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

  // Hybrid alert system (handles offline + native SMS)
  const {
    isOnline,
    nativeSmsAvailable,
    pendingAlerts,
    triggerAlert,
    syncPendingAlerts,
  } = useHybridAlert({
    userId: user?.id || null,
    userName: userProfile.full_name || user?.email || "Unknown User",
    onAlertCreated: (alertId) => {
      setCurrentAlertId(alertId);
    },
    onSyncComplete: () => {
      toast({
        title: "Sync Complete",
        description: "Queued alerts have been processed",
      });
    },
  });

  useEffect(() => {
    if (!currentAlertId || !user || !pendingRecordingRef.current) return;

    const pending = pendingRecordingRef.current;
    pendingRecordingRef.current = null;

    processEmergency(
      pending.audioBase64,
      currentAlertId,
      user.id,
      pending.location,
      pending.audioMimeType
    );
  }, [currentAlertId, user, processEmergency]);

  // Smart recording with silence detection
  const handleRecordingComplete = useCallback(async (audioBlob: Blob, duration: number) => {
    if (!user) return;
    
    console.log(`Recording complete: ${duration}s`);
    
    // Convert to base64 for backend function
    const buffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const audioBase64 = btoa(binary);
    const audioMimeType = audioBlob.type || undefined;

    // If the alert row hasn't been created yet, store the recording and process once we have an alert id.
    if (!currentAlertId) {
      pendingRecordingRef.current = {
        audioBase64,
        audioMimeType,
        location,
      };

      toast({
        title: "Audio Captured",
        description: "Finalizing alert setup, then uploading your recording...",
      });
      return;
    }

    // Process the emergency
    await processEmergency(audioBase64, currentAlertId, user.id, location, audioMimeType);
  }, [currentAlertId, user, location, processEmergency, toast]);

  const { 
    isRecording, 
    duration: recordingDuration,
    isSilent,
    silenceDuration,
    startRecording, 
    stopRecording,
  } = useSmartRecording({
    maxDuration: 180, // 3 minutes max
    silenceTimeout: 30, // Stop after 30 seconds of silence
    onRecordingComplete: handleRecordingComplete,
    onSilenceDetected: () => {
      toast({
        title: "Recording Stopped",
        description: "Extended silence detected. Processing alert...",
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

  // If a native trigger arrived while we were on another route (e.g. /auth),
  // consume the persisted "pending" flag and open the cancel window.
  useEffect(() => {
    if (!user) return;

    const pending = (() => {
      try {
        return localStorage.getItem(pendingSosKey);
      } catch {
        return null;
      }
    })();

    if (!pending) return;

    try {
      localStorage.removeItem(pendingSosKey);
    } catch {
      // ignore
    }

    handleHardwareTrigger();
  }, [user, handleHardwareTrigger]);

  // Also respond immediately when the trigger happens while this screen is mounted.
  useEffect(() => {
    const onNativeTrigger = () => handleHardwareTrigger();
    window.addEventListener("resqme:sos-trigger", onNativeTrigger);
    return () => window.removeEventListener("resqme:sos-trigger", onNativeTrigger);
  }, [handleHardwareTrigger]);

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

  // Sync is now handled by useHybridAlert hook automatically

  // Fetch user profile for name
  useEffect(() => {
    if (user?.id) {
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setUserProfile(data);
        });
    }
  }, [user?.id]);

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

    // Use hybrid alert system - handles both online and offline cases
    const alertId = await triggerAlert(location);
    
    if (alertId) {
      setCurrentAlertId(alertId);
    }

    toast({ 
      title: "🚨 Emergency Alert Activated", 
      description: isOnline 
        ? "Sharing location and recording audio" 
        : nativeSmsAvailable 
          ? "SMS sent to contacts. Full analysis when online."
          : "Alert cached. Will send when connection restored.",
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
          recordingDuration={recordingDuration}
          silenceDuration={silenceDuration}
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
