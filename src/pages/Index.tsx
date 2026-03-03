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
import { SummaryReviewDialog } from "@/components/SummaryReviewDialog";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSmartRecording } from "@/hooks/useSmartRecording";
import { useEmergencyAlert } from "@/hooks/useEmergencyAlert";
import { useHybridAlert } from "@/hooks/useHybridAlert";
import { useVolumeButtonTrigger } from "@/hooks/useVolumeButtonTrigger";
import { useWakeWordTrigger } from "@/hooks/useWakeWordTrigger";
import { useSpeechTranscription } from "@/hooks/useSpeechTranscription";

import { AlertHistory } from "@/components/AlertHistory";

const MAX_RECORDING_DURATION = 300; // 5 minutes

const Contacts = lazy(() => import("@/pages/Contacts"));
const Settings = lazy(() => import("@/pages/Settings"));

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [showCancelWindow, setShowCancelWindow] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [alertStartTime, setAlertStartTime] = useState<Date | null>(null);
  const [recordingFailed, setRecordingFailed] = useState(false);
  
  const alertIdRef = useRef<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null }>({ full_name: null });

  // Settings state
  const [wakeWord, setWakeWord] = useState("resqme");
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isVolumeButtonEnabled, setIsVolumeButtonEnabled] = useState(true);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    isListening: isTranscribing,
    transcript: transcription,
    startListening: startTranscribing,
    stopListening: stopTranscribing,
    reset: resetTranscription,
  } = useSpeechTranscription();

  const { 
    isProcessing, 
    isSendingNotifications, 
    isAwaitingApproval,
    summary,
    processEmergency,
    approveAndSend,
    cancelSending,
    reset: resetEmergencyAlert,
  } = useEmergencyAlert({
    onComplete: () => {
      setIsAlertActive(false);
      setAlertStartTime(null);
      setRecordingFailed(false);
      alertIdRef.current = null;
    },
  });

  const {
    isOnline,
    triggerAlert,
  } = useHybridAlert({
    userId: user?.id || null,
    userName: userProfile.full_name || user?.email || "User",
    onAlertCreated: (id) => {
      alertIdRef.current = id;
    },
  });

  // This is called when recording completes (silence detection or max duration)
  const handleRecordingComplete = useCallback(async (audioBlob: Blob, duration: number) => {
    console.log("Recording complete! Duration:", duration, "Blob size:", audioBlob.size);
    
    if (!user || !alertIdRef.current) {
      console.error("Missing user or alertId for processing");
      return;
    }

    const transcriptText = transcription?.trim() || undefined;
    
    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      const audioBase64 = base64data.split(",")[1];
      
      console.log("Sending audio for analysis...");
      await processEmergency(
        audioBase64, 
        alertIdRef.current!, 
        user.id, 
        location, 
        audioBlob.type, 
        transcriptText
      );
    };
  }, [user, location, transcription, processEmergency]);

  const { 
    isRecording, 
    duration: recordingDuration, 
    silenceDuration, 
    startRecording, 
    stopRecording 
  } = useSmartRecording({
    maxDuration: MAX_RECORDING_DURATION,
    silenceTimeout: 10, // Auto-stop after 10 seconds of silence
    onRecordingComplete: handleRecordingComplete,
  });

  // Location tracking
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setLocation({ 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude, 
          accuracy: pos.coords.accuracy 
        }),
        (err) => console.error("Location error:", err),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const handleHardwareTrigger = useCallback(() => {
    if (!isAlertActive && !showCancelWindow) {
      setShowCancelWindow(true);
    }
  }, [isAlertActive, showCancelWindow]);

  // Volume button trigger
  const { 
    isBackgroundActive,
    startBackgroundProtection,
    stopBackgroundProtection,
  } = useVolumeButtonTrigger({
    onTrigger: handleHardwareTrigger,
    enabled: isVolumeButtonEnabled && !isAlertActive && !showCancelWindow,
  });

  // Wake word trigger
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

  // Native SOS trigger listener
  useEffect(() => {
    const onNativeTrigger = () => handleHardwareTrigger();
    window.addEventListener("resqme:sos-trigger", onNativeTrigger);
    return () => window.removeEventListener("resqme:sos-trigger", onNativeTrigger);
  }, [handleHardwareTrigger]);

  const activateAlert = async () => {
    setShowCancelWindow(false);
    setIsAlertActive(true);
    setAlertStartTime(new Date());
    setRecordingFailed(false);
    resetTranscription();

    // Create the alert in database first
    const alertId = await triggerAlert(location);
    if (alertId) {
      alertIdRef.current = alertId;
      console.log("Alert created:", alertId);
    }

    // Start recording with proper error handling
    try {
      console.log("Starting audio recording...");
      await startRecording();
      startTranscribing();
      toast({ 
        title: "🚨 SOS ACTIVATED", 
        description: "Recording audio... Speak now or stay silent for 10s to auto-stop.",
        variant: "destructive" 
      });
    } catch (e: any) {
      console.error("Recording failed:", e);
      setRecordingFailed(true);
      toast({ 
        title: "⚠️ Microphone Error", 
        description: "Could not access microphone. Alert will be sent without audio.",
        variant: "destructive" 
      });
    }
  };

  // Stop recording and trigger processing
  const handleStopAndSend = useCallback(() => {
    console.log("User pressed Stop & Send");
    if (isRecording) {
      stopRecording(); // This will trigger onRecordingComplete
    } else {
      // Recording already stopped or failed, process without audio
      if (alertIdRef.current && user) {
        processEmergency(
          "", // Empty audio
          alertIdRef.current,
          user.id,
          location,
          "audio/webm",
          transcription?.trim() || undefined
        );
      }
    }
    stopTranscribing();
  }, [isRecording, stopRecording, stopTranscribing, processEmergency, user, location, transcription]);

  // Cancel without sending
  const cancelAlert = async () => {
    stopRecording();
    stopTranscribing();
    setIsAlertActive(false);
    setAlertStartTime(null);
    setRecordingFailed(false);
    
    if (alertIdRef.current) {
      await supabase.from("alerts").update({ 
        status: "cancelled", 
        resolved_at: new Date().toISOString()
      }).eq("id", alertIdRef.current);
    }
    
    alertIdRef.current = null;
    resetEmergencyAlert();
    toast({ title: "Alert Cancelled", description: "No notifications were sent." });
  };

  const handleApproveSummary = (editedSummary: string) => {
    approveAndSend(editedSummary);
  };

  const handleCancelSummary = () => {
    cancelSending();
    setIsAlertActive(false);
    setRecordingFailed(false);
    alertIdRef.current = null;
  };

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setUser(session.user);
    });
  }, [navigate]);

  // Load user profile
  useEffect(() => {
    if (user?.id) {
      supabase.from("profiles").select("full_name").eq("user_id", user.id).single()
        .then(({ data }) => { if (data) setUserProfile(data); });
    }
  }, [user?.id]);

  if (!user) return null;

  return (
    <div className="min-h-screen pb-24">
      {showCancelWindow && (
        <CancelCountdown 
          duration={5} 
          onComplete={activateAlert} 
          onCancel={() => setShowCancelWindow(false)} 
        />
      )}
      
      {isAlertActive && alertStartTime && alertIdRef.current && !isAwaitingApproval && (
        <ActiveAlertBanner
          alertId={alertIdRef.current}
          startedAt={alertStartTime}
          isRecording={isRecording}
          recordingFailed={recordingFailed}
          recordingDuration={recordingDuration}
          maxRecordingDuration={MAX_RECORDING_DURATION}
          silenceDuration={silenceDuration}
          onStopAndSend={handleStopAndSend}
          onCancel={cancelAlert}
        />
      )}

      <SummaryReviewDialog
        isOpen={isAwaitingApproval}
        summary={summary || ""}
        isProcessing={isProcessing}
        onApprove={handleApproveSummary}
        onCancel={handleCancelSummary}
      />

      <div className={`px-4 py-6 max-w-lg mx-auto ${isAlertActive ? "pt-40" : ""}`}>
        {activeTab === "home" && (
          <>
            <header className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold">ResQ Me</h1>
                  <p className="text-xs text-muted-foreground">Safety companion</p>
                </div>
              </div>

              <VoiceCommandIndicator
                isListening={isWakeWordListening}
                isSupported={wakeWordSupported}
                onToggle={async () => isWakeWordListening ? await stopWakeWord() : await startWakeWord()}
                transcript={`Say "${currentWakeWord} help"`}
              />
            </header>

            <StatusBar 
              isLocationEnabled={!!location} 
              isRecording={isRecording} 
              isConnected={isOnline} 
            />

            <div className="flex items-center justify-center my-12">
              <SOSButton 
                onTrigger={() => isAlertActive ? handleStopAndSend() : setShowCancelWindow(true)} 
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

        {activeTab === "history" && <AlertHistory />}
        {activeTab === "contacts" && <Suspense fallback={<div>Loading...</div>}><Contacts /></Suspense>}
        {activeTab === "settings" && <Suspense fallback={<div>Loading...</div>}>
          <Settings 
            wakeWord={wakeWord} 
            onWakeWordChange={async (w) => { setWakeWord(w); await updateWakeWord(w); }} 
            isVoiceEnabled={isVoiceEnabled} 
            onVoiceEnabledChange={async (e) => { setIsVoiceEnabled(e); e ? await startWakeWord() : await stopWakeWord(); }} 
            isVolumeButtonEnabled={isVolumeButtonEnabled} 
            onVolumeButtonEnabledChange={async (e) => { setIsVolumeButtonEnabled(e); e ? await startBackgroundProtection() : await stopBackgroundProtection(); }} 
            isBackgroundServiceActive={isBackgroundActive} 
          />
        </Suspense>}
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
