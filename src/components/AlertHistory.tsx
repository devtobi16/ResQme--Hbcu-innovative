import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertHistoryDetail } from "./AlertHistoryDetail";
import { History, Loader2, Play, MapPin, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Alert {
  id: string;
  status: string;
  latitude?: number;
  longitude?: number;
  triggered_at: string;
  audio_url?: string;
  address?: string;
  notes?: string; // AI summary
  transcript?: string;
  duration_seconds?: number;
}

export const AlertHistory = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("triggered_at", { ascending: false });

    if (!error && data) {
      // Process audio URLs
      const processed = await Promise.all(data.map(async (alert) => {
        if (alert.audio_url) {
          const { data: signed } = await supabase.storage
            .from("emergency-recordings")
            .createSignedUrl(alert.audio_url, 3600);
          return { ...alert, audio_url: signed?.signedUrl || alert.audio_url };
        }
        return alert;
      }));
      setAlerts(processed);
    }
    setLoading(false);
  };

  const handleDelete = async (alertId: string) => {
    const { error } = await supabase
      .from("alerts")
      .delete()
      .eq("id", alertId);
    
    if (!error) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      setSelectedAlert(null);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (selectedAlert) {
    return (
      <AlertHistoryDetail 
        alert={selectedAlert} 
        onBack={() => setSelectedAlert(null)} 
        onDelete={() => handleDelete(selectedAlert.id)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
          <History className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">Alert History</h1>
          <p className="text-xs text-muted-foreground">{alerts.length} recorded events</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <History className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-foreground mb-2">No Alerts Yet</h3>
          <p className="text-sm text-muted-foreground">
            Your SOS alert history will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <Card 
              key={alert.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors" 
              onClick={() => setSelectedAlert(alert)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="w-3 h-3" />
                    {format(new Date(alert.triggered_at), "MMM d, h:mm a")}
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.duration_seconds && (
                      <Badge variant="outline" className="text-xs">
                        {formatDuration(alert.duration_seconds)}
                      </Badge>
                    )}
                    <Badge 
                      variant={alert.status === "active" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {alert.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <MapPin className="w-3 h-3" />
                  {alert.address || "Location captured"}
                </div>

                {/* AI Summary Preview */}
                {alert.notes && (
                  <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-primary/5 border border-primary/10">
                    <FileText className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                    <p className="text-xs text-foreground line-clamp-2">
                      {alert.notes}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 mt-2">
                  {alert.audio_url && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Play className="w-3 h-3" />
                      Audio
                    </div>
                  )}
                  {alert.transcript && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3" />
                      Transcript
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
