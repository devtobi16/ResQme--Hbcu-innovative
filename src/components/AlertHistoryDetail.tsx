import { useState, useEffect, useRef } from "react";
import { ArrowLeft, MapPin, Clock, Play, Pause, Trash2, Volume2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useReverseGeocode } from "@/hooks/useReverseGeocode";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

interface AlertHistoryDetailProps {
  alert: Alert;
  onBack: () => void;
  onDelete: () => void;
}

export const AlertHistoryDetail = ({ alert, onBack, onDelete }: AlertHistoryDetailProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Use geocoding hook if no stored address
  const { address: geocodedAddress, isLoading: isGeocodingLoading } = useReverseGeocode(
    alert.address ? null : (alert.latitude ?? null),
    alert.address ? null : (alert.longitude ?? null)
  );

  const displayAddress = alert.address || geocodedAddress;

  const statusConfig = {
    active: { color: "text-primary", label: "Active" },
    resolved: { color: "text-safe", label: "Resolved" },
    cancelled: { color: "text-muted-foreground", label: "Cancelled" },
  };

  const config = statusConfig[alert.status];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const openInMaps = () => {
    if (alert.latitude && alert.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${alert.latitude},${alert.longitude}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-foreground">Alert Details</h1>
          <p className="text-xs text-muted-foreground">
            {format(new Date(alert.triggered_at), "MMMM d, yyyy")}
          </p>
        </div>
        <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
      </header>

      {/* Time Info */}
      <Card className="glass-card border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Triggered at</p>
              <p className="font-medium text-foreground">
                {format(new Date(alert.triggered_at), "h:mm a")}
              </p>
            </div>
          </div>

          {alert.resolved_at && (
            <div className="flex items-center gap-3 pt-3 border-t border-border/50">
              <div className="w-10 h-10 rounded-xl bg-safe/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-safe" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved at</p>
                <p className="font-medium text-foreground">
                  {format(new Date(alert.resolved_at), "h:mm a")}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location */}
      {(alert.latitude && alert.longitude) && (
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Location</p>
                  {isGeocodingLoading ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Loading address...</p>
                  ) : displayAddress ? (
                    <p className="font-medium text-foreground text-sm">{displayAddress}</p>
                  ) : (
                    <p className="font-mono text-sm text-foreground">
                      {alert.latitude?.toFixed(6)}, {alert.longitude?.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full mt-3"
              onClick={openInMaps}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View in Google Maps
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Audio Recording */}
      {alert.audio_url && (
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-medium text-foreground">Audio Recording</p>
                <p className="text-sm text-muted-foreground">
                  {duration > 0 ? formatTime(duration) : "Loading..."}
                </p>
              </div>
            </div>

            <audio ref={audioRef} src={alert.audio_url} preload="metadata" />

            <div className="space-y-3">
              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-100"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={togglePlayback}
                  className="px-6"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {duration > 0 ? formatTime(duration) : "--:--"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Alert
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this alert?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the alert from your history. The recording will be retained for 30
              days for safety purposes before being permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
