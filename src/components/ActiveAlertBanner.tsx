import { AlertTriangle, X, Mic, MapPin, Send, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { RecordingProgressBar } from "./RecordingProgressBar";

interface ActiveAlertBannerProps {
  alertId: string;
  startedAt: Date;
  isRecording: boolean;
  recordingFailed?: boolean;
  recordingDuration?: number;
  maxRecordingDuration?: number;
  silenceDuration?: number;
  onStopAndSend: () => void;
  onCancel: () => void;
}

export const ActiveAlertBanner = ({
  alertId,
  startedAt,
  isRecording,
  recordingFailed = false,
  recordingDuration = 0,
  maxRecordingDuration = 300,
  silenceDuration = 0,
  onStopAndSend,
  onCancel,
}: ActiveAlertBannerProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className={cn(
        "bg-gradient-to-r from-primary to-destructive",
        "px-4 py-3 shadow-emergency"
      )}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-primary-foreground animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-bold text-primary-foreground">
                  EMERGENCY ACTIVE
                </h3>
                <p className="text-xs text-primary-foreground/80">
                  Started at {format(startedAt, "h:mm a")}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={onCancel}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>

          <div className="mt-3 pt-3 border-t border-primary-foreground/20 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">
                  Location tracking
                </span>
              </div>
              
              {recordingFailed ? (
                <div className="flex items-center gap-2">
                  <MicOff className="w-4 h-4 text-yellow-300" />
                  <span className="text-xs text-yellow-300">
                    Mic unavailable
                  </span>
                </div>
              ) : isRecording ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />
                  <Mic className="w-4 h-4 text-primary-foreground/80" />
                  <span className="text-xs text-primary-foreground/80">
                    Recording {silenceDuration > 0 && `(silence: ${silenceDuration}s/10s)`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary-foreground/60" />
                  <span className="text-xs text-primary-foreground/60">
                    Recording stopped
                  </span>
                </div>
              )}
            </div>
            
            {isRecording && (
              <RecordingProgressBar
                currentDuration={recordingDuration}
                maxDuration={maxRecordingDuration}
              />
            )}

            {/* Stop and Send button - prominently displayed */}
            <Button
              onClick={onStopAndSend}
              className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold"
            >
              <Send className="w-4 h-4 mr-2" />
              {isRecording ? "Stop Recording & Send Alert" : "Send Alert Now"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
