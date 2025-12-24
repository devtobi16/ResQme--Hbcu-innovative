import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CancelCountdownProps {
  duration?: number;
  onComplete: () => void;
  onCancel: () => void;
}

export const CancelCountdown = ({ duration = 5, onComplete, onCancel }: CancelCountdownProps) => {
  const [countdown, setCountdown] = useState(duration);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onComplete]);

  const handleCancel = () => {
    setIsCancelling(true);
    setTimeout(onCancel, 200);
  };

  const progress = ((duration - countdown) / duration) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-8 px-8">
        {/* Countdown circle */}
        <div className="relative w-48 h-48 mx-auto">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="6"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="hsl(var(--emergency))"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={565.48}
              strokeDashoffset={565.48 * (1 - progress / 100)}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl font-display font-bold text-emergency">{countdown}</span>
            <span className="text-sm text-muted-foreground mt-2">seconds</span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-display font-bold text-foreground">
            Sending Emergency Alert
          </h2>
          <p className="text-muted-foreground">
            Tap cancel if this was a mistake
          </p>
        </div>

        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className={cn(
            "flex items-center justify-center gap-3 mx-auto",
            "px-8 py-4 rounded-2xl",
            "bg-card border border-border",
            "text-foreground font-semibold",
            "transition-all duration-200",
            "hover:bg-card/80 active:scale-95",
            isCancelling && "opacity-50"
          )}
        >
          <X className="w-5 h-5" />
          Cancel Alert
        </button>
      </div>
    </div>
  );
};
