import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmergencyAlertState {
  isProcessing: boolean;
  isSendingNotifications: boolean;
  summary: string | null;
  audioUrl: string | null;
}

interface UseEmergencyAlertOptions {
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export const useEmergencyAlert = ({ onComplete, onError }: UseEmergencyAlertOptions = {}) => {
  const [state, setState] = useState<EmergencyAlertState>({
    isProcessing: false,
    isSendingNotifications: false,
    summary: null,
    audioUrl: null,
  });

  const { toast } = useToast();
  const alertIdRef = useRef<string | null>(null);

  const processEmergency = useCallback(async (
    audioBase64: string,
    alertId: string,
    userId: string,
    location: { lat: number; lng: number } | null
  ) => {
    alertIdRef.current = alertId;
    
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      console.log("Processing emergency audio...");
      
      // Step 1: Analyze the emergency audio
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-emergency",
        {
          body: {
            audioBase64,
            alertId,
            userId,
            latitude: location?.lat,
            longitude: location?.lng,
          },
        }
      );

      if (analysisError) {
        throw new Error(`Analysis failed: ${analysisError.message}`);
      }

      const summary = analysisData?.summary || "Emergency alert triggered. Please contact immediately.";
      const audioUrl = analysisData?.audioUrl;

      setState(prev => ({ ...prev, summary, audioUrl, isProcessing: false, isSendingNotifications: true }));

      console.log("Emergency summary:", summary);
      toast({
        title: "Audio Analyzed",
        description: "Sending notifications to emergency contacts...",
      });

      // Step 2: Send SMS notifications
      const { data: smsData, error: smsError } = await supabase.functions.invoke(
        "send-emergency-sms",
        {
          body: {
            alertId,
            userId,
            summary,
            latitude: location?.lat,
            longitude: location?.lng,
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
          notes: summary,
          audio_url: audioUrl,
        })
        .eq("id", alertId);

      if (onComplete) {
        onComplete();
      }

      return { summary, audioUrl };

    } catch (error: any) {
      console.error("Emergency processing error:", error);
      
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        isSendingNotifications: false 
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
  }, [toast, onComplete, onError]);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      isSendingNotifications: false,
      summary: null,
      audioUrl: null,
    });
    alertIdRef.current = null;
  }, []);

  return {
    ...state,
    processEmergency,
    reset,
    currentAlertId: alertIdRef.current,
  };
};
