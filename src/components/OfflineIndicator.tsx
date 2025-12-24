import { WifiOff, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
}

export const OfflineIndicator = ({ isOnline, pendingCount }: OfflineIndicatorProps) => {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed top-4 left-4 right-4 z-40",
        "flex items-center gap-3 p-3 rounded-xl",
        isOnline
          ? "bg-warning/20 border border-warning/30"
          : "bg-destructive/20 border border-destructive/30"
      )}
    >
      {isOnline ? (
        <CloudOff className="w-5 h-5 text-warning flex-shrink-0" />
      ) : (
        <WifiOff className="w-5 h-5 text-destructive flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {isOnline ? "Syncing pending alerts" : "You're offline"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isOnline
            ? `${pendingCount} alert${pendingCount > 1 ? "s" : ""} will sync shortly`
            : "Alerts will be cached and sent when back online"}
        </p>
      </div>
    </div>
  );
};
