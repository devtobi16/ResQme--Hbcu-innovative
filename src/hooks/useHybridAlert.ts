import { useCallback, useRef, useState } from 'react';
import { useNetworkState } from '@react-native-community/hooks';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { sendEmergencySMS } from '@/services/smsService';

interface HybridAlertConfig {
  userId: string;
  phoneNumber: string;
  contactPhoneNumbers: string[];
  location: { latitude: number; longitude: number };
  alertType: 'emergency' | 'sos' | 'panic';
}

interface HybridAlertResponse {
  success: boolean;
  alertId: string;
  smsSent: boolean;
  notificationSent: boolean;
  fallbackUsed: boolean;
}

export const useHybridAlert = () => {
  const { isConnected } = useNetworkState();
  const [isAlertActive, setIsAlertActive] = useState(false);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const smsSentRef = useRef(false);

  const sendAlertMutation = useMutation({
    mutationFn: async (config: HybridAlertConfig): Promise<HybridAlertResponse> => {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let notificationSent = false;
      let smsSent = false;
      let fallbackUsed = false;

      try {
        // If offline, immediately send fallback SMS without waiting
        if (!isConnected) {
          console.log('[useHybridAlert] Offline detected - sending fallback SMS immediately');
          smsSent = await sendEmergencySMS({
            phoneNumbers: config.contactPhoneNumbers,
            userId: config.userId,
            location: config.location,
            alertType: config.alertType,
            timestamp: new Date().toISOString(),
            isOffline: true,
          }).catch(error => {
            console.error('[useHybridAlert] Fallback SMS failed:', error);
            return false;
          });
          fallbackUsed = true;
          smsSentRef.current = smsSent;

          // Store alert locally for sync when online
          await storeAlertLocally({
            alertId,
            ...config,
            timestamp: new Date().toISOString(),
            status: 'pending_sync',
          });

          return {
            success: smsSent,
            alertId,
            smsSent,
            notificationSent: false,
            fallbackUsed: true,
          };
        }

        // Online: Send through normal channels first
        try {
          // Send push notification
          const notificationResponse = await supabase.functions.invoke(
            'send-emergency-notification',
            {
              body: {
                userId: config.userId,
                alertId,
                contactPhoneNumbers: config.contactPhoneNumbers,
                location: config.location,
                alertType: config.alertType,
                timestamp: new Date().toISOString(),
              },
            }
          );

          if (notificationResponse.error) {
            console.warn('[useHybridAlert] Notification failed:', notificationResponse.error);
          } else {
            notificationSent = true;
          }
        } catch (notificationError) {
          console.warn('[useHybridAlert] Notification error:', notificationError);
        }

        // Send SMS as backup even when online
        try {
          smsSent = await sendEmergencySMS({
            phoneNumbers: config.contactPhoneNumbers,
            userId: config.userId,
            location: config.location,
            alertType: config.alertType,
            timestamp: new Date().toISOString(),
            isOffline: false,
          });
        } catch (smsError) {
          console.warn('[useHybridAlert] SMS error:', smsError);
          smsSent = false;
        }

        // Store alert in database
        const { error: dbError } = await supabase.from('alerts').insert({
          id: alertId,
          user_id: config.userId,
          alert_type: config.alertType,
          location: config.location,
          contact_phone_numbers: config.contactPhoneNumbers,
          notification_sent: notificationSent,
          sms_sent: smsSent,
          created_at: new Date().toISOString(),
          status: 'active',
        });

        if (dbError) {
          console.error('[useHybridAlert] Database error:', dbError);
          // Don't fail the entire alert if database fails
        }

        return {
          success: notificationSent || smsSent,
          alertId,
          smsSent,
          notificationSent,
          fallbackUsed: false,
        };
      } catch (error) {
        console.error('[useHybridAlert] Unexpected error:', error);
        // Final fallback: attempt SMS
        try {
          smsSent = await sendEmergencySMS({
            phoneNumbers: config.contactPhoneNumbers,
            userId: config.userId,
            location: config.location,
            alertType: config.alertType,
            timestamp: new Date().toISOString(),
            isOffline: !isConnected,
          });
          fallbackUsed = true;
        } catch (smsError) {
          console.error('[useHybridAlert] Final fallback SMS failed:', smsError);
        }

        return {
          success: smsSent,
          alertId,
          smsSent,
          notificationSent: false,
          fallbackUsed: true,
        };
      }
    },
  });

  const startAlert = useCallback(
    async (config: HybridAlertConfig) => {
      setIsAlertActive(true);
      smsSentRef.current = false;

      // Clear any existing timeout
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }

      try {
        const result = await sendAlertMutation.mutateAsync(config);
        console.log('[useHybridAlert] Alert sent:', result);
        return result;
      } catch (error) {
        console.error('[useHybridAlert] Failed to send alert:', error);
        throw error;
      }
    },
    [sendAlertMutation]
  );

  const cancelAlert = useCallback(
    async (alertId: string) => {
      setIsAlertActive(false);

      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }

      try {
        const { error } = await supabase
          .from('alerts')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', alertId);

        if (error) {
          console.error('[useHybridAlert] Failed to cancel alert:', error);
          throw error;
        }

        return { success: true, alertId };
      } catch (error) {
        console.error('[useHybridAlert] Error cancelling alert:', error);
        throw error;
      }
    },
    []
  );

  const confirmAlert = useCallback(
    async (alertId: string) => {
      try {
        const { error } = await supabase
          .from('alerts')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', alertId);

        if (error) {
          throw error;
        }

        setIsAlertActive(false);
        return { success: true, alertId };
      } catch (error) {
        console.error('[useHybridAlert] Error confirming alert:', error);
        throw error;
      }
    },
    []
  );

  return {
    startAlert,
    cancelAlert,
    confirmAlert,
    isAlertActive,
    isPending: sendAlertMutation.isPending,
    isError: sendAlertMutation.isError,
    error: sendAlertMutation.error,
  };
};

// Helper function to store alerts locally
async function storeAlertLocally(alertData: any) {
  try {
    // Using React Native AsyncStorage for local persistence
    const { AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const existingAlerts = await AsyncStorage.getItem('pending_alerts');
    const alerts = existingAlerts ? JSON.parse(existingAlerts) : [];
    alerts.push(alertData);
    await AsyncStorage.setItem('pending_alerts', JSON.stringify(alerts));
  } catch (error) {
    console.error('[useHybridAlert] Failed to store alert locally:', error);
  }
}
