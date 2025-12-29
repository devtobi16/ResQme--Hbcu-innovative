import { useState, useEffect, useCallback } from "react";

// IndexedDB for storing audio blobs (localStorage can't handle blobs)
const DB_NAME = "resqme_offline_db";
const DB_VERSION = 1;
const ALERT_STORE = "pending_alerts";

export interface OfflineAlert {
  id: string;
  oderId: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  synced: boolean;
  nativeSmsSent: boolean;
  audioBlob?: Blob;
  audioMimeType?: string;
  userName?: string;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(ALERT_STORE)) {
        const store = db.createObjectStore(ALERT_STORE, { keyPath: "id" });
        store.createIndex("synced", "synced", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
};

export const useOfflineAlertQueue = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingAlerts, setPendingAlerts] = useState<OfflineAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load pending alerts on mount
  useEffect(() => {
    loadPendingAlerts();
  }, []);

  const loadPendingAlerts = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(ALERT_STORE, "readonly");
      const store = transaction.objectStore(ALERT_STORE);
      const index = store.index("synced");
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => {
        setPendingAlerts(request.result || []);
        setIsLoading(false);
      };

      request.onerror = () => {
        console.error("Failed to load pending alerts:", request.error);
        setIsLoading(false);
      };
    } catch (error) {
      console.error("Error opening IndexedDB:", error);
      setIsLoading(false);
    }
  }, []);

  const queueAlert = useCallback(async (alert: Omit<OfflineAlert, "synced">): Promise<void> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(ALERT_STORE, "readwrite");
      const store = transaction.objectStore(ALERT_STORE);
      
      const fullAlert: OfflineAlert = {
        ...alert,
        synced: false,
      };

      return new Promise((resolve, reject) => {
        const request = store.put(fullAlert);
        request.onsuccess = () => {
          setPendingAlerts((prev) => {
            const existing = prev.find((a) => a.id === alert.id);
            if (existing) {
              return prev.map((a) => (a.id === alert.id ? fullAlert : a));
            }
            return [...prev, fullAlert];
          });
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error queuing alert:", error);
      throw error;
    }
  }, []);

  const updateAlert = useCallback(async (
    id: string, 
    updates: Partial<OfflineAlert>
  ): Promise<void> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(ALERT_STORE, "readwrite");
      const store = transaction.objectStore(ALERT_STORE);

      return new Promise((resolve, reject) => {
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
          const existingAlert = getRequest.result;
          if (!existingAlert) {
            reject(new Error("Alert not found"));
            return;
          }

          const updatedAlert = { ...existingAlert, ...updates };
          const putRequest = store.put(updatedAlert);
          
          putRequest.onsuccess = () => {
            setPendingAlerts((prev) => 
              prev.map((a) => (a.id === id ? updatedAlert : a))
            );
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        };
        
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      console.error("Error updating alert:", error);
      throw error;
    }
  }, []);

  const markAsSynced = useCallback(async (id: string): Promise<void> => {
    await updateAlert(id, { synced: true });
    setPendingAlerts((prev) => prev.filter((a) => a.id !== id));
  }, [updateAlert]);

  const getAlert = useCallback(async (id: string): Promise<OfflineAlert | null> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(ALERT_STORE, "readonly");
      const store = transaction.objectStore(ALERT_STORE);

      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting alert:", error);
      return null;
    }
  }, []);

  const clearSyncedAlerts = useCallback(async (): Promise<void> => {
    try {
      const db = await openDB();
      const transaction = db.transaction(ALERT_STORE, "readwrite");
      const store = transaction.objectStore(ALERT_STORE);
      const index = store.index("synced");
      const request = index.openCursor(IDBKeyRange.only(true));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } catch (error) {
      console.error("Error clearing synced alerts:", error);
    }
  }, []);

  return {
    isOnline,
    isLoading,
    pendingAlerts,
    queueAlert,
    updateAlert,
    markAsSynced,
    getAlert,
    clearSyncedAlerts,
    refreshAlerts: loadPendingAlerts,
  };
};
