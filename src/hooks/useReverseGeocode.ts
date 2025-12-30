import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GeocodeResult {
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

// Cache to avoid repeated API calls for the same coordinates
const geocodeCache = new Map<string, string>();

const fetchAddressFromEdgeFunction = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  const { data, error } = await supabase.functions.invoke("reverse-geocode", {
    body: { latitude, longitude },
  });

  if (error) {
    console.error("Edge function error:", error);
    return null;
  }

  return data?.address || null;
};

export const useReverseGeocode = (
  latitude: number | null,
  longitude: number | null
): GeocodeResult => {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!latitude || !longitude) {
      setAddress(null);
      return;
    }

    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    
    // Check cache first
    if (geocodeCache.has(cacheKey)) {
      setAddress(geocodeCache.get(cacheKey)!);
      return;
    }

    const fetchAddress = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const formattedAddress = await fetchAddressFromEdgeFunction(latitude, longitude);

        // Cache the result
        if (formattedAddress) {
          geocodeCache.set(cacheKey, formattedAddress);
        }

        setAddress(formattedAddress);
      } catch (err) {
        console.error("Geocoding error:", err);
        setError("Could not fetch address");
        setAddress(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddress();
  }, [latitude, longitude]);

  return { address, isLoading, error };
};

// Utility function for one-off geocoding (for storing in DB)
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  const formattedAddress = await fetchAddressFromEdgeFunction(latitude, longitude);

  if (formattedAddress) {
    geocodeCache.set(cacheKey, formattedAddress);
  }

  return formattedAddress;
};
