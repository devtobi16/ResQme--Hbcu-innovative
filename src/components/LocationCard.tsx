import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useReverseGeocode } from "@/hooks/useReverseGeocode";

interface LocationCardProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  address?: string;
  isTracking: boolean;
}

export const LocationCard = ({ latitude, longitude, accuracy, address, isTracking }: LocationCardProps) => {
  const { address: geocodedAddress, isLoading } = useReverseGeocode(latitude, longitude);
  const displayAddress = address || geocodedAddress;

  const openInMaps = () => {
    if (latitude && longitude) {
      // Use the more reliable Google Maps search URL format
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Card className="glass-card border-border/50 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">Your Location</h3>
              <p className="text-sm text-muted-foreground">
                {isTracking ? "Live tracking enabled" : "Location updated"}
              </p>
            </div>
          </div>
          {isTracking && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-safe animate-pulse" />
              <span className="text-xs text-safe">Live</span>
            </div>
          )}
        </div>

        {latitude && longitude ? (
          <div className="space-y-3">
            {/* Address - show prominently */}
            <div className="bg-muted/50 rounded-xl p-3">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-muted-foreground animate-pulse" />
                  <span className="text-sm text-muted-foreground animate-pulse">
                    Looking up address...
                  </span>
                </div>
              ) : displayAddress ? (
                <div className="flex items-start gap-2">
                  <Navigation className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground font-medium">{displayAddress}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Latitude</span>
                    <span className="font-mono text-sm text-foreground">{latitude.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Longitude</span>
                    <span className="font-mono text-sm text-foreground">{longitude.toFixed(6)}</span>
                  </div>
                </div>
              )}
              {accuracy && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    Accuracy: ±{accuracy.toFixed(0)}m
                  </span>
                </div>
              )}
            </div>

            {/* Open in Maps button */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={openInMaps}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Google Maps
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Enable location to share your position
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
