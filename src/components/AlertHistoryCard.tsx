import { AlertTriangle, Clock, MapPin, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Alert {
  id: string;
  status: "active" | "resolved" | "cancelled";
  latitude?: number;
  longitude?: number;
  triggered_at: string;
  resolved_at?: string;
}

interface AlertHistoryCardProps {
  alert: Alert;
  onClick?: () => void;
}

export const AlertHistoryCard = ({ alert, onClick }: AlertHistoryCardProps) => {
  const statusConfig = {
    active: {
      icon: AlertTriangle,
      color: "text-primary",
      bg: "bg-primary/10",
      label: "Active",
    },
    resolved: {
      icon: CheckCircle,
      color: "text-safe",
      bg: "bg-safe/10",
      label: "Resolved",
    },
    cancelled: {
      icon: XCircle,
      color: "text-muted-foreground",
      bg: "bg-muted",
      label: "Cancelled",
    },
  };

  const config = statusConfig[alert.status];
  const StatusIcon = config.icon;

  return (
    <Card
      className={cn(
        "glass-card border-border/50 overflow-hidden cursor-pointer transition-all duration-200",
        "hover:border-border active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              config.bg
            )}>
              <StatusIcon className={cn("w-5 h-5", config.color)} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">
                Emergency Alert
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(alert.triggered_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            </div>
          </div>

          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            config.bg,
            config.color
          )}>
            {config.label}
          </span>
        </div>

        {alert.latitude && alert.longitude && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="font-mono text-xs">
              {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
