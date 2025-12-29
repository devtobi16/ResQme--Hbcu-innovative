import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineAlertQueue, OfflineAlert } from "@/hooks/useOfflineAlertQueue";
import { useNativeSms } from "@/hooks/useNativeSms";
import { useEmergencyAlert } from "@/hooks/useEmergencyAlert";
import { useToast } from "@/hooks/use-toast";
import { reverseGeocode } from "@/hooks/useReverseGeocode";

interface UseHybridAlertOptions {
  userId: string | null;
  userName: string;
  onAlertCreated?: (alertId: string) => void;
  onSyncComplete?: () => void;
}

export const useHybridAlert = ({
  userId,
  userName,
  onAlertCreated,
  onSyncComplete,
}: UseHybridAlertOptions) => {
  const { toast } = useToast();
  const syncingRef = useRef(false);

  const {
    isOnline,
    pendingAlerts,
    queueAlert,
    updateAlert,
    markAsSynced,
    getAlert,
  } = useOfflineAlertQueue();

  const {
    isAvailable: nativeSmsAvailable,
    sendEmergencySms,
  } = useNativeSms({
    onSuccess: (count) => {
      toast({
        title: "SMS Sent",
        description: `Emergency message sent to ${count} contact(s)`,
      });
    },
    onError: (error) => {
      console.error("Native SMS error:", error);
    },
  });

  const { processEmergency } = useEmergencyAlert();

  // Sync pending alerts when coming back online
  useEffect(() => {
    if (isOnline && pendingAlerts.length > 0 && userId && !syncingRef.current) {
      syncPendingAlerts();
    }
  }, [isOnline, pendingAlerts.length, userId]);

  const syncPendingAlerts = useCallback(async () => {
    if (syncingRef.current || !userId) return;
    
    syncingRef.current = true;
    
    for (const alert of pendingAlerts) {
      try {
        // Skip if already synced
        if (alert.synced) continue;

        // Get address from coordinates
        let address: string | null = null;
        if (alert.latitude && alert.longitude) {
          address = await reverseGeocode(alert.latitude, alert.longitude);
        }

        // Create alert in database
        const { data: alertData } = await supabase.from("alerts").insert({
          user_id: userId,
          status: "active",
          latitude: alert.latitude,
          longitude: alert.longitude,
          address,
          trigger_type: "button",
        }).select().single();

        if (alertData && alert.audioBlob) {
          // Process the audio with AI
          const buffer = await alert.audioBlob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const audioBase64 = btoa(binary);

          await processEmergency(
            audioBase64,
            alertData.id,
            userId,
            alert.latitude && alert.longitude 
              ? { lat: alert.latitude, lng: alert.longitude } 
              : null,
            alert.audioMimeType
          );

          toast({
            title: "Alert Synced",
            description: "Queued emergency processed and contacts notified with AI analysis",
          });
        }

        await markAsSynced(alert.id);
      } catch (error) {
        console.error("Failed to sync alert:", error);
      }
    }

    syncingRef.current = false;
    onSyncComplete?.();
  }, [pendingAlerts, userId, processEmergency, markAsSynced, toast, onSyncComplete]);

  const triggerOfflineAlert = useCallback(async (
    location: { lat: number; lng: number } | null,
    audioBlob?: Blob,
    audioMimeType?: string
  ): Promise<string> => {
    const alertId = crypto.randomUUID();

    // Queue the alert with audio for later processing
    await queueAlert({
      id: alertId,
      oderId: userId || "",
      latitude: location?.lat || null,
      longitude: location?.lng || null,
      timestamp: new Date().toISOString(),
      nativeSmsSent: false,
      audioBlob,
      audioMimeType,
      userName,
    });

    // Send native SMS immediately if available
    if (nativeSmsAvailable) {
      try {
        const { data: contacts } = await supabase
          .from("emergency_contacts")
          .select("name, phone_number")
          .eq("user_id", userId || "");

        if (contacts && contacts.length > 0) {
          const result = await sendEmergencySms(
            contacts,
            userName,
            location?.lat || null,
            location?.lng || null,
            "This is an automated alert. Audio recording will be analyzed when connection is restored."
          );

          if (result.success) {
            await updateAlert(alertId, { nativeSmsSent: true });
            
            toast({
              title: "Emergency SMS Sent",
              description: `Alert sent to ${result.sentCount} contact(s). Full analysis pending.`,
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch contacts for native SMS:", error);
        
        // Fallback: try to use cached contacts from localStorage
        toast({
          title: "Alert Queued",
          description: "Will send when connection is restored",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Alert Cached",
        description: "Native SMS unavailable. Will send when online.",
        variant: "destructive",
      });
    }

    onAlertCreated?.(alertId);
    return alertId;
  }, [
    userId,
    userName,
    nativeSmsAvailable,
    queueAlert,
    updateAlert,
    sendEmergencySms,
    toast,
    onAlertCreated,
  ]);

  const triggerOnlineAlert = useCallback(async (
    location: { lat: number; lng: number } | null,
    audioBlob?: Blob,
    audioMimeType?: string
  ): Promise<string | null> => {
    if (!userId) return null;

    // Get address from coordinates
    let address: string | null = null;
    if (location?.lat && location?.lng) {
      address = await reverseGeocode(location.lat, location.lng);
    }

    const { data } = await supabase.from("alerts").insert({
      user_id: userId,
      status: "active",
      latitude: location?.lat,
      longitude: location?.lng,
      address,
      trigger_type: "button",
    }).select().single();

    if (!data) return null;

    // Create location entry
    if (location) {
      await supabase.from("alert_locations").insert({
        alert_id: data.id,
        latitude: location.lat,
        longitude: location.lng,
        accuracy: null,
      });
    }

    // Create notification log entries
    const { data: contacts } = await supabase
      .from("emergency_contacts")
      .select("id")
      .eq("user_id", userId);

    if (contacts) {
      const logs = contacts.map((c) => ({
        alert_id: data.id,
        contact_id: c.id,
        notification_type: "push",
        status: "pending",
      }));
      await supabase.from("notification_logs").insert(logs);
    }

    onAlertCreated?.(data.id);
    return data.id;
  }, [userId, onAlertCreated]);

  const triggerAlert = useCallback(async (
    location: { lat: number; lng: number } | null,
    audioBlob?: Blob,
    audioMimeType?: string
  ): Promise<string | null> => {
    if (isOnline) {
      return triggerOnlineAlert(location, audioBlob, audioMimeType);
    } else {
      return triggerOfflineAlert(location, audioBlob, audioMimeType);
    }
  }, [isOnline, triggerOnlineAlert, triggerOfflineAlert]);

  return {
    isOnline,
    nativeSmsAvailable,
    pendingAlerts,
    triggerAlert,
    triggerOfflineAlert,
    triggerOnlineAlert,
    syncPendingAlerts,
  };
};
