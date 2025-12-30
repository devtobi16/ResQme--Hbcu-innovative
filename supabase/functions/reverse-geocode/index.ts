import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: "Missing latitude or longitude" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      throw new Error("Geocoding service unavailable");
    }

    const data = await response.json();
    const addr = data.address;
    const addressParts = [];

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

    return new Response(
      JSON.stringify({ address: formattedAddress }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Geocoding error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to geocode location" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
