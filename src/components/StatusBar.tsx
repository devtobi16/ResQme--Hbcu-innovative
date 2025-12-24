import { MapPin, Mic, Wifi, Battery } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  isLocationEnabled: boolean;
  isRecording: boolean;
  isConnected: boolean;
}

export const StatusBar = ({ isLocationEnabled, isRecording, isConnected }: StatusBarProps) => {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Location status */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "status-indicator",
              isLocationEnabled ? "bg-safe" : "bg-muted-foreground"
            )} />
            <MapPin className={cn(
              "w-5 h-5",
              isLocationEnabled ? "text-safe" : "text-muted-foreground"
            )} />
            <span className="text-sm text-muted-foreground">
              {isLocationEnabled ? "GPS Active" : "GPS Off"}
            </span>
          </div>

          {/* Recording status */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "status-indicator",
              isRecording ? "bg-primary" : "bg-muted-foreground"
            )} />
            <Mic className={cn(
              "w-5 h-5",
              isRecording ? "text-primary" : "text-muted-foreground"
            )} />
            <span className="text-sm text-muted-foreground">
              {isRecording ? "Recording" : "Standby"}
            </span>
          </div>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2">
          <Wifi className={cn(
            "w-5 h-5",
            isConnected ? "text-safe" : "text-warning"
          )} />
        </div>
      </div>
    </div>
  );
};
