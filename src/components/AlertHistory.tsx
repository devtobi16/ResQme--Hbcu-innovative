import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertHistoryCard } from "./AlertHistoryCard";
import { AlertHistoryDetail } from "./AlertHistoryDetail";
import { History, Loader2 } from "lucide-react";

interface Alert {
  id: string;
  status: "active" | "resolved" | "cancelled";
  latitude?: number;
  longitude?: number;
  triggered_at: string;
  resolved_at?: string;
  audio_url?: string;
  address?: string;
}

export const AlertHistory = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, status, latitude, longitude, triggered_at, resolved_at, audio_url, address")
        .order("triggered_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setAlerts(
        (data || []).map((alert) => ({
          ...alert,
          status: alert.status as "active" | "resolved" | "cancelled",
          latitude: alert.latitude ?? undefined,
          longitude: alert.longitude ?? undefined,
          resolved_at: alert.resolved_at ?? undefined,
          audio_url: alert.audio_url ?? undefined,
          address: alert.address ?? undefined,
        }))
      );
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      // Soft delete - just set deleted_at
      const { error } = await supabase
        .from("alerts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;

      // Remove from local state
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setSelectedAlert(null);
    } catch (error) {
      console.error("Error deleting alert:", error);
    }
  };

  if (selectedAlert) {
    return (
      <AlertHistoryDetail
        alert={selectedAlert}
        onBack={() => setSelectedAlert(null)}
        onDelete={() => handleDeleteAlert(selectedAlert.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
          <History className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Alert History</h1>
          <p className="text-xs text-muted-foreground">View past emergency alerts</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No alerts yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your emergency alert history will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertHistoryCard
              key={alert.id}
              alert={alert}
              onClick={() => setSelectedAlert(alert)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
