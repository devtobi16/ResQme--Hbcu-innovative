import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceCommandIndicatorProps {
  isListening: boolean;
  isSupported: boolean;
  onToggle: () => void;
  transcript?: string;
}

export const VoiceCommandIndicator = ({
  isListening,
  isSupported,
  onToggle,
  transcript,
}: VoiceCommandIndicatorProps) => {
  if (!isSupported) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onToggle}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center",
          "transition-all duration-300",
          isListening
            ? "bg-secondary/20 border-2 border-secondary animate-pulse"
            : "bg-card border border-border hover:bg-card/80"
        )}
      >
        {isListening ? (
          <Mic className="w-6 h-6 text-secondary" />
        ) : (
          <MicOff className="w-6 h-6 text-muted-foreground" />
        )}
      </button>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          {isListening ? 'Say "ResQMe help"' : "Voice command off"}
        </p>
        {transcript && isListening && (
          <p className="text-xs text-secondary mt-1 max-w-[200px] truncate">
            Heard: {transcript}
          </p>
        )}
      </div>
    </div>
  );
};
