import { useState, useEffect, useCallback } from "react";

interface GeocodeResult {
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

// Cache to avoid repeated API calls for the same coordinates
const geocodeCache = new Map<string, string>();

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
        // Using OpenStreetMap Nominatim (free, no API key required)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "ResQMe Emergency App",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch address");
        }

        const data = await response.json();
        
        // Build a readable address from the response
        const addressParts = [];
        const addr = data.address;

        if (addr) {
          // Street level
          if (addr.house_number && addr.road) {
            addressParts.push(`${addr.house_number} ${addr.road}`);
          } else if (addr.road) {
            addressParts.push(addr.road);
          }

          // City/Town
          const locality = addr.city || addr.town || addr.village || addr.suburb || addr.neighbourhood;
          if (locality) {
            addressParts.push(locality);
          }

          // State/Province
          if (addr.state) {
            addressParts.push(addr.state);
          }

          // Country (full name)
          if (addr.country) {
            addressParts.push(addr.country);
          }
        }

        const formattedAddress = addressParts.length > 0 
          ? addressParts.join(", ")
          : data.display_name || null;

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

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "ResQMe Emergency App",
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const addr = data.address;
    const addressParts = [];

    if (addr) {
      if (addr.house_number && addr.road) {
        addressParts.push(`${addr.house_number} ${addr.road}`);
      } else if (addr.road) {
        addressParts.push(addr.road);
      }

      const locality = addr.city || addr.town || addr.village || addr.suburb;
      if (locality) addressParts.push(locality);
      if (addr.state) addressParts.push(addr.state);
      if (addr.country) addressParts.push(addr.country);
    }

    const formattedAddress = addressParts.length > 0 
      ? addressParts.join(", ")
      : data.display_name || null;

    if (formattedAddress) {
      geocodeCache.set(cacheKey, formattedAddress);
    }

    return formattedAddress;
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
};
