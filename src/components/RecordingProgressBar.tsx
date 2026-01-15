import { Clock } from "lucide-react";

interface RecordingProgressBarProps {
  currentDuration: number; // in seconds
  maxDuration: number; // in seconds (300 = 5 minutes)
}

export const RecordingProgressBar = ({
  currentDuration,
  maxDuration,
}: RecordingProgressBarProps) => {
  const progressPercent = Math.min((currentDuration / maxDuration) * 100, 100);
  const remainingSeconds = Math.max(maxDuration - currentDuration, 0);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-primary-foreground/80">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Recording: {formatTime(currentDuration)}</span>
        </div>
        <span>{formatTime(remainingSeconds)} remaining</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary-foreground/20">
        <div 
          className="h-full bg-primary-foreground transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
