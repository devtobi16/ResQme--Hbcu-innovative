import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SOSButton } from "@/components/SOSButton";
import { StatusBar } from "@/components/StatusBar";
import { LocationCard } from "@/components/LocationCard";
import { Navigation } from "@/components/Navigation";
import { ActiveAlertBanner } from "@/components/ActiveAlertBanner";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [alertStartTime, setAlertStartTime] = useState<Date | null>(null);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => toast({ title: "Location access needed", description: "Please enable location for emergency features", variant: "destructive" })
      );
    }
  }, []);

  const handleSOSTrigger = async () => {
    if (isAlertActive) {
      setIsAlertActive(false);
      setIsRecording(false);
      setAlertStartTime(null);
      toast({ title: "Alert Cancelled", description: "Emergency alert has been deactivated" });
      return;
    }

    setIsAlertActive(true);
    setIsRecording(true);
    setAlertStartTime(new Date());

    if (user) {
      await supabase.from("alerts").insert({
        user_id: user.id,
        status: "active",
        latitude: location?.lat,
        longitude: location?.lng,
      });
    }

    toast({ title: "🚨 Emergency Alert Activated", description: "Sharing location and recording audio", variant: "destructive" });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-24">
      {isAlertActive && alertStartTime && (
        <ActiveAlertBanner
          alertId="1"
          startedAt={alertStartTime}
          isRecording={isRecording}
          onCancel={handleSOSTrigger}
        />
      )}

      <div className={`px-4 py-6 max-w-lg mx-auto ${isAlertActive ? "pt-32" : ""}`}>
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">ResQMe</h1>
              <p className="text-xs text-muted-foreground">Your safety companion</p>
            </div>
          </div>
        </header>

        <StatusBar isLocationEnabled={!!location} isRecording={isRecording} isConnected={true} />

        <div className="flex items-center justify-center my-12">
          <SOSButton onTrigger={handleSOSTrigger} isActive={isAlertActive} isRecording={isRecording} />
        </div>

        <LocationCard
          latitude={location?.lat || null}
          longitude={location?.lng || null}
          accuracy={location?.accuracy || null}
          isTracking={isAlertActive}
        />
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
