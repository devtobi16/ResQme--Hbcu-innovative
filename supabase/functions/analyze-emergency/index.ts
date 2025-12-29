import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, alertId, userId, latitude, longitude } = await req.json();
    
    if (!audioBase64 || !alertId || !userId) {
      throw new Error("Missing required fields: audioBase64, alertId, userId");
    }

    console.log(`Processing emergency audio for alert ${alertId}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Decode base64 audio and upload to storage
    const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    const fileName = `${userId}/${alertId}-${Date.now()}.webm`;
    
    const { error: uploadError } = await supabase.storage
      .from("emergency-recordings")
      .upload(fileName, audioData, {
        contentType: "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    console.log(`Audio uploaded: ${fileName}`);

    // Get the audio URL for reference
    const { data: { publicUrl } } = supabase.storage
      .from("emergency-recordings")
      .getPublicUrl(fileName);

    // Use AI to analyze the emergency situation
    // We'll send a prompt describing the audio context
    const analysisPrompt = `You are an emergency response AI assistant. Based on the context that an emergency alert was triggered with audio recording, analyze and provide a brief emergency summary.

The user triggered an emergency SOS alert at the following location:
- Latitude: ${latitude || "Unknown"}
- Longitude: ${longitude || "Unknown"}

Generate a concise emergency summary (2-3 sentences max) that could be sent to emergency contacts. Include:
1. Type of potential emergency (crime, medical, accident, etc.)
2. Urgency level
3. Recommended immediate action for contacts

Since we cannot transcribe the audio directly, assume this is a genuine emergency and provide a general alert message that emphasizes the need for immediate attention.

Format your response as a brief, clear emergency message suitable for SMS.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an emergency response assistant. Provide clear, concise emergency alerts." },
          { role: "user", content: analysisPrompt }
        ],
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      // Provide fallback summary if AI fails
      const fallbackSummary = `🚨 EMERGENCY ALERT: Your contact has triggered an SOS alert and may need immediate assistance. Location: ${latitude && longitude ? `${latitude}, ${longitude}` : "Unknown"}. Please try to contact them immediately or alert local authorities.`;
      
      return new Response(
        JSON.stringify({ 
          summary: fallbackSummary,
          audioUrl: publicUrl,
          transcription: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || 
      `🚨 EMERGENCY: SOS alert triggered. Location: ${latitude}, ${longitude}. Contact immediately.`;

    console.log(`Analysis complete for alert ${alertId}`);

    // Update alert with audio URL
    await supabase
      .from("alerts")
      .update({ audio_url: publicUrl })
      .eq("id", alertId);

    return new Response(
      JSON.stringify({ 
        summary,
        audioUrl: publicUrl,
        transcription: null, // Audio transcription not available without Whisper
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in analyze-emergency:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
