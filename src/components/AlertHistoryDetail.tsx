import { useState } from "react";
import { ArrowLeft, Trash2, MapPin, Clock, FileText, Mic, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

interface Props {
  alert: Alert;
  onBack: () => void;
  onDelete: () => void;
}

export const AlertHistoryDetail = ({ alert, onBack, onDelete }: Props) => {
  const [showTranscript, setShowTranscript] = useState(false);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const openInMaps = () => {
    if (alert.latitude && alert.longitude) {
      window.open(`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-xl font-bold">Alert Details</h1>
        </div>
        <Badge 
          variant={alert.status === "active" ? "destructive" : "secondary"}
        >
          {alert.status.toUpperCase()}
        </Badge>
      </div>

      {/* Audio Recording Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Emergency Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alert.audio_url ? (
            <>
              <audio controls className="w-full h-10" src={alert.audio_url}>
                Your browser does not support the audio element.
              </audio>
              {alert.duration_seconds && (
                <p className="text-xs text-muted-foreground text-center">
                  Duration: {formatDuration(alert.duration_seconds)}
                </p>
              )}
            </>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-sm">
              No audio recording available
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Summary Card */}
      {alert.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              AI Emergency Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{alert.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Transcript Card */}
      {alert.transcript && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-secondary" />
                Full Transcript
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
              >
                {showTranscript ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showTranscript && (
            <CardContent>
              <div className="p-3 rounded-lg bg-muted/50 text-sm leading-relaxed whitespace-pre-wrap">
                {alert.transcript}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Location & Time Info */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{format(new Date(alert.triggered_at), "PPPP")}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(alert.triggered_at), "p")}</p>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{alert.address || "Location Recorded"}</p>
                {alert.latitude && alert.longitude && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {alert.latitude.toFixed(6)}, {alert.longitude.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
            {alert.latitude && alert.longitude && (
              <Button variant="outline" size="sm" onClick={openInMaps}>
                <ExternalLink className="w-3 h-3 mr-1" />
                Maps
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete This Record
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this alert record including the audio recording. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
