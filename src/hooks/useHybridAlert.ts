import { useCallback, useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { reverseGeocode } from '@/hooks/useReverseGeocode';

interface UseHybridAlertOptions {
  userId: string | null;
  userName: string;
  onAlertCreated?: (alertId: string) => void;
  onSyncComplete?: () => void;
}

interface PendingAlert {
  id: string;
  location: { lat: number; lng: number } | null;
  triggeredAt: string;
  triggerType: string;
}

export const useHybridAlert = (options: UseHybridAlertOptions) => {
  const { userId, userName, onAlertCreated, onSyncComplete } = options;
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingAlerts, setPendingAlerts] = useState<PendingAlert[]>([]);
  const [nativeSmsAvailable, setNativeSmsAvailable] = useState(false);
  
  const syncInProgressRef = useRef(false);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check for native SMS capability (Android via Capacitor)
  useEffect(() => {
    const checkNativeSms = async () => {
      try {
        const NativeSms = (await import('@/plugins/NativeSmsPlugin')).default;
        const result = await NativeSms.isAvailable();
        setNativeSmsAvailable(result.available);
      } catch {
        setNativeSmsAvailable(false);
      }
    };
    checkNativeSms();
  }, []);

  // Load pending alerts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pending_alerts');
      if (stored) {
        setPendingAlerts(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingAlerts.length > 0) {
      syncPendingAlerts();
    }
  }, [isOnline]);

  const savePendingAlerts = useCallback((alerts: PendingAlert[]) => {
    setPendingAlerts(alerts);
    try {
      localStorage.setItem('pending_alerts', JSON.stringify(alerts));
    } catch {
      // Storage full or unavailable
    }
  }, []);

  const triggerAlert = useCallback(async (
    location: { lat: number; lng: number; accuracy?: number } | null
  ): Promise<string | null> => {
    if (!userId) return null;

    const alertId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Get address from coordinates
    let address: string | null = null;
    if (location) {
      try {
        address = await reverseGeocode(location.lat, location.lng);
      } catch {
        // Continue without address
      }
    }

    if (isOnline) {
      // Create alert in database
      const { error } = await supabase.from('alerts').insert({
        id: alertId,
        user_id: userId,
        status: 'active',
        trigger_type: 'sos',
        triggered_at: now,
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        address,
      });

      if (error) {
        console.error('[useHybridAlert] Failed to create alert:', error);
        // Fall back to offline mode
        const pending: PendingAlert = {
          id: alertId,
          location: location ? { lat: location.lat, lng: location.lng } : null,
          triggeredAt: now,
          triggerType: 'sos',
        };
        savePendingAlerts([...pendingAlerts, pending]);
      }

      onAlertCreated?.(alertId);
      return alertId;
    } else {
      // Offline: store locally and optionally send native SMS
      const pending: PendingAlert = {
        id: alertId,
        location: location ? { lat: location.lat, lng: location.lng } : null,
        triggeredAt: now,
        triggerType: 'sos',
      };
      savePendingAlerts([...pendingAlerts, pending]);

      // Try native SMS if available
      if (nativeSmsAvailable) {
        try {
          const NativeSms = (await import('@/plugins/NativeSmsPlugin')).default;
          
          // Fetch emergency contacts
          const { data: contacts } = await supabase
            .from('emergency_contacts')
            .select('phone_number, name')
            .eq('user_id', userId);

          if (contacts && contacts.length > 0) {
            const locationStr = location 
              ? `https://maps.google.com/?q=${location.lat},${location.lng}`
              : 'Location unavailable';
            
            const message = `🚨 EMERGENCY ALERT from ${userName}!\n\nI need help. My location: ${locationStr}\n\nThis is an automated SOS from ResQMe.`;
            
            for (const contact of contacts) {
              await NativeSms.sendSms({
                phoneNumber: contact.phone_number,
                message,
              });
            }
          }
        } catch (e) {
          console.error('[useHybridAlert] Native SMS failed:', e);
        }
      }

      onAlertCreated?.(alertId);
      return alertId;
    }
  }, [userId, userName, isOnline, nativeSmsAvailable, pendingAlerts, savePendingAlerts, onAlertCreated]);

  const syncPendingAlerts = useCallback(async () => {
    if (!userId || !isOnline || syncInProgressRef.current || pendingAlerts.length === 0) {
      return;
    }

    syncInProgressRef.current = true;

    try {
      for (const pending of pendingAlerts) {
        let address: string | null = null;
        if (pending.location) {
          try {
            address = await reverseGeocode(pending.location.lat, pending.location.lng);
          } catch {
            // Continue without address
          }
        }

        await supabase.from('alerts').insert({
          id: pending.id,
          user_id: userId,
          status: 'synced',
          trigger_type: pending.triggerType,
          triggered_at: pending.triggeredAt,
          latitude: pending.location?.lat || null,
          longitude: pending.location?.lng || null,
          address,
          notes: 'Synced from offline queue',
        });
      }

      savePendingAlerts([]);
      onSyncComplete?.();
    } catch (e) {
      console.error('[useHybridAlert] Sync failed:', e);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [userId, isOnline, pendingAlerts, savePendingAlerts, onSyncComplete]);

  return {
    isOnline,
    nativeSmsAvailable,
    pendingAlerts,
    triggerAlert,
    syncPendingAlerts,
  };
};
