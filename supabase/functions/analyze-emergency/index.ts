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
    const { audioBase64, audioMimeType, alertId, userId, latitude, longitude, transcript } = await req.json();

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

    const safeMimeType =
      typeof audioMimeType === "string" && audioMimeType.startsWith("audio/")
        ? audioMimeType
        : "audio/webm";

    const extension = safeMimeType.includes("mp4")
      ? "m4a"
      : safeMimeType.includes("mpeg")
        ? "mp3"
        : safeMimeType.includes("ogg")
          ? "ogg"
          : "webm";

    // Decode base64 audio and upload to storage
    const audioData = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const fileName = `${userId}/${alertId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("emergency-recordings")
      .upload(fileName, audioData, {
        contentType: safeMimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    console.log(`Audio uploaded: ${fileName}`);

    // Get a signed URL for the audio (private bucket - 30 days expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("emergency-recordings")
      .createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30 days

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError);
    }

    const audioUrl = signedUrlData?.signedUrl || null;

    const hasTranscript = typeof transcript === "string" && transcript.trim().length > 0;

    const systemPrompt = `You are an emergency response AI assistant. Your job is to analyze emergency audio transcripts and generate clear, actionable SMS alerts.

When analyzing, pay attention to:
- Emotional cues (panic, fear, calmness, distress, crying, screaming)
- Context clues (accident, attack, medical emergency, natural disaster)
- Urgency level based on tone and content
- Any names, locations, or specific threats mentioned

Write SMS-friendly messages (under 300 characters) that convey urgency appropriately.`;

    const userPrompt = hasTranscript
      ? `🚨 SOS ALERT TRIGGERED

LOCATION: ${latitude && longitude ? `${latitude}, ${longitude}` : "Unknown"}
${latitude && longitude ? `MAP: https://maps.google.com/?q=${latitude},${longitude}` : ""}

AUDIO TRANSCRIPT (may contain speech recognition errors):
"""
${transcript}
"""

Analyze the transcript for:
1. Type of emergency (medical, assault, accident, unknown)
2. Emotional state of the person (panicked, calm, distressed, injured)
3. Any specific threats or dangers mentioned
4. Urgency level (critical/high/moderate)

Then write a 2-3 sentence emergency SMS that:
- States the likely emergency type
- Conveys appropriate urgency based on emotional tone
- Instructs contacts to call emergency services AND try reaching the person
- Includes the location if available`
      : `🚨 SOS ALERT TRIGGERED

LOCATION: ${latitude && longitude ? `${latitude}, ${longitude}` : "Unknown"}
${latitude && longitude ? `MAP: https://maps.google.com/?q=${latitude},${longitude}` : ""}

No audio transcript available (silent alert or recording issue).

Write a high-urgency emergency SMS (2-3 sentences) that:
- Treats this as a potentially serious situation (silent alerts can indicate danger)
- Instructs contacts to call emergency services immediately
- Advises trying to reach the person by phone
- Includes the location if available`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 220,
      }),
    });

    if (!aiResponse.ok) {
      // Surface common gateway errors cleanly
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required. Please add credits and retry." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

      const fallbackSummary = `🚨 EMERGENCY ALERT: Your contact triggered an SOS and may need immediate help. Location: ${latitude && longitude ? `${latitude}, ${longitude}` : "Unknown"}. Please call local emergency services and try to reach them now.`;

      return new Response(
        JSON.stringify({
          summary: fallbackSummary,
          audioUrl,
          transcription: hasTranscript ? transcript : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResponse.json();
    const summary =
      (aiData.choices?.[0]?.message?.content as string | undefined)?.trim() ||
      `🚨 EMERGENCY: SOS alert triggered. Location: ${latitude}, ${longitude}. Contact immediately.`;

    console.log(`Analysis complete for alert ${alertId}`);

    // Update alert with audio URL
    await supabase.from("alerts").update({ audio_url: audioUrl }).eq("id", alertId);

    return new Response(
      JSON.stringify({
        summary,
        audioUrl,
        transcription: hasTranscript ? transcript : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
