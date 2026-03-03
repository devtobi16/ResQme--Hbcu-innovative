import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      audioBase64,
      audioMimeType,
      alertId,
      userId,
      latitude,
      longitude,
      transcript,
      durationSeconds,
    } = await req.json();

    if (!audioBase64 || !alertId || !userId) {
      throw new Error("Missing required fields: audioBase64, alertId, userId");
    }

    console.log(`Processing emergency audio for alert ${alertId}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const safeMimeType =
      typeof audioMimeType === "string" && audioMimeType.startsWith("audio/")
        ? audioMimeType
        : "audio/webm";

    const extension = safeMimeType.includes("mp4") ? "m4a" : 
                      safeMimeType.includes("mpeg") ? "mp3" : 
                      safeMimeType.includes("ogg") ? "ogg" : "webm";

    const binString = atob(audioBase64);
    const audioData = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
      audioData[i] = binString.charCodeAt(i);
    }
    
    // Save path: userId/alertId-timestamp.extension
    const fileName = `${userId}/${alertId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("emergency-recordings")
      .upload(fileName, audioData, {
        contentType: safeMimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    const hasTranscript = typeof transcript === "string" && transcript.trim().length > 0;
    const cleanTranscript = hasTranscript ? transcript.trim() : null;

    // AI Analysis prompt - focused on emergency response
    const systemPrompt = `You are an emergency response AI assistant. Your job is to analyze emergency audio transcripts and create a clear, urgent SMS message for emergency contacts.

Requirements:
- Be direct and factual
- Never speculate beyond what's in the transcript
- Keep the summary to 2-4 sentences maximum (under 300 characters)
- Focus on: what's happening, any danger indicators, urgency level
- Use simple, clear language that anyone can understand`;

    const userPrompt = hasTranscript
      ? `EMERGENCY SOS ACTIVATED

Location: Lat ${latitude}, Lng ${longitude}

Audio Transcript: "${cleanTranscript}"

Generate a 2-4 sentence emergency summary for contacts. Focus on what's happening and urgency level. Be factual, not speculative.`
      : `EMERGENCY SOS ACTIVATED

Location: Lat ${latitude}, Lng ${longitude}

No audio transcript available (user may be unable to speak or in a quiet emergency).

Generate a brief emergency summary indicating an SOS was triggered but no audio was captured. Suggest contacts check on the person immediately.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-1.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 250,
          temperature: 0.3, // Lower temperature for more factual responses
        }),
      }
    );

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content?.trim() || 
      "Emergency SOS alert triggered. Unable to analyze audio. Please contact this person immediately.";

    // Update the alert with all the data: audio path, summary, transcript, and duration
    const { error: updateError } = await supabase
      .from("alerts")
      .update({ 
        audio_url: fileName,
        notes: summary,
        transcript: cleanTranscript,
        duration_seconds: durationSeconds || null,
      })
      .eq("id", alertId);

    if (updateError) {
      console.error("Failed to update alert:", updateError);
    }

    console.log("Emergency analysis complete:", { summary: summary.substring(0, 100) + "..." });

    return new Response(
      JSON.stringify({
        summary,
        audioUrl: fileName,
        transcript: cleanTranscript,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Analysis error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
