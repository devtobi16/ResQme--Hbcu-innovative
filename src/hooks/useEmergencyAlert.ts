import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmergencyAlertState {
  isProcessing: boolean;
  isSendingNotifications: boolean;
  isAwaitingApproval: boolean;
  summary: string | null;
  audioUrl: string | null;
}

interface PendingNotification {
  alertId: string;
  userId: string;
  summary: string;
  audioUrl: string | null;
  location: { lat: number; lng: number } | null;
}

interface UseEmergencyAlertOptions {
  onComplete?: () => void;
  onError?: (error: string) => void;
  onSummaryReady?: (summary: string) => void;
}

export const useEmergencyAlert = ({ onComplete, onError, onSummaryReady }: UseEmergencyAlertOptions = {}) => {
  const [state, setState] = useState<EmergencyAlertState>({
    isProcessing: false,
    isSendingNotifications: false,
    isAwaitingApproval: false,
    summary: null,
    audioUrl: null,
  });

  const { toast } = useToast();
  const alertIdRef = useRef<string | null>(null);
  const pendingNotificationRef = useRef<PendingNotification | null>(null);

  // Step 1: Analyze audio and prepare summary (does NOT send SMS yet)
  const processEmergency = useCallback(async (
    audioBase64: string,
    alertId: string,
    userId: string,
    location: { lat: number; lng: number } | null,
    audioMimeType?: string,
    transcript?: string
  ) => {
    alertIdRef.current = alertId;

    setState(prev => ({ ...prev, isProcessing: true, isAwaitingApproval: false }));

    try {
      console.log("Processing emergency audio...");

      // Step 1: Analyze the emergency audio + (optional) transcript
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-emergency",
        {
          body: {
            audioBase64,
            audioMimeType,
            alertId,
            userId,
            latitude: location?.lat,
            longitude: location?.lng,
            transcript,
          },
        }
      );

      if (analysisError) {
        throw new Error(`Analysis failed: ${analysisError.message}`);
      }

      const summary = analysisData?.summary || "Emergency alert triggered. Please contact immediately.";
      const audioUrl = analysisData?.audioUrl;

      // Store pending notification for later approval
      pendingNotificationRef.current = {
        alertId,
        userId,
        summary,
        audioUrl,
        location,
      };

      setState(prev => ({ 
        ...prev, 
        summary, 
        audioUrl, 
        isProcessing: false, 
        isAwaitingApproval: true 
      }));

      console.log("Emergency summary ready for review:", summary);
      toast({
        title: "Audio Analyzed",
        description: "Review the summary before sending to contacts.",
      });

      if (onSummaryReady) {
        onSummaryReady(summary);
      }

      return { summary, audioUrl };

    } catch (error: any) {
      console.error("Emergency processing error:", error);
      
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        isSendingNotifications: false,
        isAwaitingApproval: false,
      }));

      toast({
        title: "Error",
        description: error.message || "Failed to process emergency. Please call 911 directly.",
        variant: "destructive",
      });

      if (onError) {
        onError(error.message);
      }

      return null;
    }
  }, [toast, onError, onSummaryReady]);

  // Step 2: User approves - send SMS notifications
  const approveAndSend = useCallback(async (editedSummary?: string) => {
    const pending = pendingNotificationRef.current;
    if (!pending) {
      console.error("No pending notification to send");
      return;
    }

    const summaryToSend = editedSummary || pending.summary;

    setState(prev => ({ ...prev, isAwaitingApproval: false, isSendingNotifications: true }));

    try {
      // Send SMS notifications
      const { data: smsData, error: smsError } = await supabase.functions.invoke(
        "send-emergency-sms",
        {
          body: {
            alertId: pending.alertId,
            userId: pending.userId,
            summary: summaryToSend,
            latitude: pending.location?.lat,
            longitude: pending.location?.lng,
          },
        }
      );

      setState(prev => ({ ...prev, isSendingNotifications: false }));

      if (smsError) {
        console.error("SMS sending error:", smsError);
        toast({
          title: "Warning",
          description: "Could not send all notifications. Audio was recorded.",
          variant: "destructive",
        });
      } else {
        const successCount = smsData?.successCount || 0;
        const totalContacts = smsData?.totalContacts || 0;
        
        toast({
          title: "Notifications Sent",
          description: `Alert sent to ${successCount}/${totalContacts} emergency contacts`,
        });
      }

      // Update alert with notes/summary
      await supabase
        .from("alerts")
        .update({ 
          notes: summaryToSend,
          audio_url: pending.audioUrl,
        })
        .eq("id", pending.alertId);

      pendingNotificationRef.current = null;

      if (onComplete) {
        onComplete();
      }

    } catch (error: any) {
      console.error("Failed to send notifications:", error);
      
      setState(prev => ({ ...prev, isSendingNotifications: false }));

      toast({
        title: "Error",
        description: "Failed to send notifications. Please contact emergency services directly.",
        variant: "destructive",
      });

      if (onError) {
        onError(error.message);
      }
    }
  }, [toast, onComplete, onError]);

  // Cancel/decline sending
  const cancelSending = useCallback(async () => {
    const pending = pendingNotificationRef.current;
    
    if (pending) {
      // Mark alert as cancelled but keep the audio
      await supabase
        .from("alerts")
        .update({ 
          status: "resolved",
          resolved_at: new Date().toISOString(),
          notes: "Alert cancelled by user before sending notifications.",
          audio_url: pending.audioUrl,
        })
        .eq("id", pending.alertId);
    }

    pendingNotificationRef.current = null;
    
    setState(prev => ({ 
      ...prev, 
      isAwaitingApproval: false,
      summary: null,
    }));

    toast({
      title: "Alert Cancelled",
      description: "No notifications were sent. Recording saved.",
    });
  }, [toast]);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      isSendingNotifications: false,
      isAwaitingApproval: false,
      summary: null,
      audioUrl: null,
    });
    alertIdRef.current = null;
    pendingNotificationRef.current = null;
  }, []);

  return {
    ...state,
    processEmergency,
    approveAndSend,
    cancelSending,
    reset,
    currentAlertId: alertIdRef.current,
  };
};
