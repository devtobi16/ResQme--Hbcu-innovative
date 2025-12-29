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
    const { alertId, userId, summary, latitude, longitude } = await req.json();
    
    if (!alertId || !userId || !summary) {
      throw new Error("Missing required fields: alertId, userId, summary");
    }

    console.log(`Sending emergency SMS for alert ${alertId}`);

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's emergency contacts
    const { data: contacts, error: contactsError } = await supabase
      .from("emergency_contacts")
      .select("id, name, phone_number")
      .eq("user_id", userId);

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      console.log("No emergency contacts found for user");
      return new Response(
        JSON.stringify({ success: false, message: "No emergency contacts configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    const userName = profile?.full_name || "Your contact";

    // Build Google Maps link
    const mapLink = latitude && longitude 
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : null;

    // Construct message
    const message = `🚨 EMERGENCY ALERT from ${userName}!\n\n${summary}${mapLink ? `\n\n📍 Location: ${mapLink}` : ""}\n\nPlease respond immediately or contact emergency services.`;

    console.log(`Sending to ${contacts.length} contacts`);

    const results = [];

    for (const contact of contacts) {
      try {
        // Format phone number (ensure it starts with +)
        let phoneNumber = contact.phone_number.replace(/\s/g, "");
        if (!phoneNumber.startsWith("+")) {
          phoneNumber = `+1${phoneNumber}`; // Default to US if no country code
        }

        // Send SMS via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        
        const twilioResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: phoneNumber,
            From: TWILIO_PHONE_NUMBER,
            Body: message,
          }),
        });

        const twilioData = await twilioResponse.json();

        if (!twilioResponse.ok) {
          console.error(`Twilio error for ${contact.name}:`, twilioData);
          
          // Log failed notification
          await supabase.from("notification_logs").upsert({
            alert_id: alertId,
            contact_id: contact.id,
            notification_type: "sms",
            status: "failed",
            error_message: twilioData.message || "Twilio error",
          });

          results.push({ contact: contact.name, success: false, error: twilioData.message });
        } else {
          console.log(`SMS sent to ${contact.name}: ${twilioData.sid}`);
          
          // Log successful notification
          await supabase.from("notification_logs").upsert({
            alert_id: alertId,
            contact_id: contact.id,
            notification_type: "sms",
            status: "sent",
            sent_at: new Date().toISOString(),
          });

          results.push({ contact: contact.name, success: true, sid: twilioData.sid });
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.error(`Error sending to ${contact.name}:`, e);
        results.push({ contact: contact.name, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`SMS sending complete: ${successCount}/${contacts.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: successCount > 0,
        totalContacts: contacts.length,
        successCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-emergency-sms:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
