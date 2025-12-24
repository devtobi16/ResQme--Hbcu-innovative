import { useState } from "react";
import { AlertTriangle, Phone, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface SOSButtonProps {
  onTrigger: () => void;
  isActive: boolean;
  isRecording: boolean;
}

export const SOSButton = ({ onTrigger, isActive, isRecording }: SOSButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const handleTouchStart = () => {
    setIsPressed(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        onTrigger();
        setIsPressed(false);
        setHoldProgress(0);
      }
    }, 30);

    const handleRelease = () => {
      clearInterval(interval);
      setIsPressed(false);
      setHoldProgress(0);
      window.removeEventListener("mouseup", handleRelease);
      window.removeEventListener("touchend", handleRelease);
    };

    window.addEventListener("mouseup", handleRelease);
    window.addEventListener("touchend", handleRelease);
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse rings */}
      {isActive && (
        <>
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
          <div className="absolute inset-0 rounded-full bg-primary/15 animate-pulse-ring animation-delay-200" style={{ animationDelay: "0.5s" }} />
        </>
      )}

      {/* Main button container */}
      <div className="relative">
        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="4"
          />
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={565.48}
            strokeDashoffset={565.48 * (1 - holdProgress / 100)}
            className="transition-all duration-75"
          />
        </svg>

        {/* Main SOS button */}
        <button
          onMouseDown={handleTouchStart}
          onTouchStart={handleTouchStart}
          className={cn(
            "sos-button relative w-48 h-48 rounded-full flex flex-col items-center justify-center",
            "bg-gradient-to-br from-primary to-destructive",
            "transition-all duration-300 ease-out select-none touch-none",
            isActive && "emergency-pulse",
            isPressed && "scale-95"
          )}
        >
          {/* Inner glow */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-primary/50 to-transparent" />

          {/* Icon and text */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            {isActive ? (
              <>
                {isRecording && <Mic className="w-10 h-10 text-primary-foreground animate-pulse" />}
                <span className="text-2xl font-display font-bold text-primary-foreground">ACTIVE</span>
                <span className="text-sm text-primary-foreground/80">Tap to cancel</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-12 h-12 text-primary-foreground" />
                <span className="text-3xl font-display font-bold text-primary-foreground">SOS</span>
                <span className="text-xs text-primary-foreground/70">Hold to activate</span>
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
