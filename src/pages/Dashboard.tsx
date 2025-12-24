import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Mic, Shield, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AlertData {
  id: string;
  status: string;
  triggered_at: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  audio_url: string | null;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

const Dashboard = () => {
  const [searchParams] = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token || !alert) return;

    const channel = supabase
      .channel("alert-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alert_locations" },
        (payload) => {
          if (payload.new && (payload.new as any).alert_id === alert.id) {
            setLocations((prev) => [...prev, payload.new as LocationPoint]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, alert]);

  const verifyAccess = async () => {
    if (!token || !pin) {
      toast({ title: "Missing credentials", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: alerts, error } = await supabase
        .from("alerts")
        .select("id, status, triggered_at, latitude, longitude, address, audio_url")
        .eq("status", "active")
        .order("triggered_at", { ascending: false })
        .limit(1);

      if (error || !alerts?.length) {
        toast({ title: "No active alerts found", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (pin !== "0000") {
        toast({ title: "Invalid PIN", description: "Use 0000 for demo", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      setAlert(alerts[0] as AlertData);
      setIsAuthenticated(true);

      const { data: locs } = await supabase
        .from("alert_locations")
        .select("latitude, longitude, recorded_at, accuracy")
        .eq("alert_id", alerts[0].id)
        .order("recorded_at", { ascending: true });

      if (locs) {
        setLocations(locs);
      }
    } catch (e) {
      console.error("Access error:", e);
      toast({ title: "Failed to verify access", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: string) => new Date(date).toLocaleString();

  const getElapsedTime = (startDate: string) => {
    const diff = Math.floor((Date.now() - new Date(startDate).getTime()) / 1000);
    return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Invalid Access Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center">
              This dashboard link is invalid. Please contact the person who shared it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-secondary" />
            </div>
            <CardTitle>Emergency Dashboard Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-center text-sm">
              Enter the 4-digit PIN to view this emergency alert.
            </p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-widest"
            />
            <Button onClick={verifyAccess} disabled={pin.length !== 4 || isLoading} className="w-full">
              {isLoading ? "Verifying..." : "Access Dashboard"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">Demo: Use PIN <span className="font-mono">0000</span></p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emergency/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-emergency" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Emergency Dashboard</h1>
            <p className="text-xs text-muted-foreground">Real-time incident monitoring</p>
          </div>
        </div>

        {alert && (
          <Card className={alert.status === "active" ? "border-emergency" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Alert Status</CardTitle>
                <Badge variant={alert.status === "active" ? "destructive" : "secondary"}>
                  {alert.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="text-sm font-medium">{formatTime(alert.triggered_at)}</p>
                  </div>
                </div>
                {alert.status === "active" && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emergency" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-sm font-medium text-emergency">{getElapsedTime(alert.triggered_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" />
              Live Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {locations.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Latitude</p>
                    <p className="font-mono text-sm">{locations[locations.length - 1].latitude.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Longitude</p>
                    <p className="font-mono text-sm">{locations[locations.length - 1].longitude.toFixed(6)}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openInMaps(locations[locations.length - 1].latitude, locations[locations.length - 1].longitude)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Google Maps
                </Button>
              </>
            ) : alert?.latitude && alert?.longitude ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Latitude</p>
                    <p className="font-mono text-sm">{alert.latitude.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Longitude</p>
                    <p className="font-mono text-sm">{alert.longitude.toFixed(6)}</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => openInMaps(alert.latitude!, alert.longitude!)}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Google Maps
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No location data available.</p>
            )}
          </CardContent>
        </Card>

        {alert?.audio_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="w-5 h-5 text-emergency" />
                Audio Recording
              </CardTitle>
            </CardHeader>
            <CardContent>
              <audio controls className="w-full" src={alert.audio_url} />
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground">Dashboard refreshes automatically.</p>
      </div>
    </div>
  );
};

export default Dashboard;
