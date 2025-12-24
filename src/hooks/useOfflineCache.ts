import { useState, useEffect, useCallback } from "react";

interface CachedAlert {
  id: string;
  userId: string;
  latitude: number | null;
  longitude: number | null;
  audioBlob?: Blob;
  timestamp: string;
  synced: boolean;
}

const CACHE_KEY = "resqme_offline_alerts";

export const useOfflineCache = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingAlerts, setPendingAlerts] = useState<CachedAlert[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Load cached alerts from localStorage
    loadCachedAlerts();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadCachedAlerts = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const alerts = JSON.parse(cached) as CachedAlert[];
        setPendingAlerts(alerts.filter((a) => !a.synced));
      }
    } catch (e) {
      console.error("Error loading cached alerts:", e);
    }
  }, []);

  const cacheAlert = useCallback((alert: Omit<CachedAlert, "synced">) => {
    try {
      const existing = localStorage.getItem(CACHE_KEY);
      const alerts: CachedAlert[] = existing ? JSON.parse(existing) : [];
      alerts.push({ ...alert, synced: false });
      localStorage.setItem(CACHE_KEY, JSON.stringify(alerts));
      setPendingAlerts((prev) => [...prev, { ...alert, synced: false }]);
    } catch (e) {
      console.error("Error caching alert:", e);
    }
  }, []);

  const markAsSynced = useCallback((id: string) => {
    try {
      const existing = localStorage.getItem(CACHE_KEY);
      if (existing) {
        const alerts: CachedAlert[] = JSON.parse(existing);
        const updated = alerts.map((a) => (a.id === id ? { ...a, synced: true } : a));
        localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
        setPendingAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (e) {
      console.error("Error marking alert as synced:", e);
    }
  }, []);

  const clearSynced = useCallback(() => {
    try {
      const existing = localStorage.getItem(CACHE_KEY);
      if (existing) {
        const alerts: CachedAlert[] = JSON.parse(existing);
        const pending = alerts.filter((a) => !a.synced);
        localStorage.setItem(CACHE_KEY, JSON.stringify(pending));
      }
    } catch (e) {
      console.error("Error clearing synced alerts:", e);
    }
  }, []);

  return {
    isOnline,
    pendingAlerts,
    cacheAlert,
    markAsSynced,
    clearSynced,
  };
};
