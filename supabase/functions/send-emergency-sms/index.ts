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
      throw new Error("Twilio credentials are not set in Supabase Secrets");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get user's ENABLED emergency contacts only
    const { data: contacts, error: contactsError } = await supabase
      .from("emergency_contacts")
      .select("id, name, phone_number, is_enabled")
      .eq("user_id", userId)
      .neq("is_enabled", false); // Only get enabled contacts (is_enabled = true or null)

    if (contactsError || !contacts || contacts.length === 0) {
      console.log("No enabled contacts to notify.");
      return new Response(JSON.stringify({ success: false, message: "No enabled contacts found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Found ${contacts.length} enabled contacts to notify`);

    // 2. Get user's name
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", userId).single();
    const userName = profile?.full_name || "A user";

    // 3. Prepare message
    const mapLink = latitude && longitude ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;
    const timestamp = new Date().toLocaleString("en-US", { 
      hour: "numeric", 
      minute: "2-digit",
      hour12: true 
    });
    
    const message = `🚨 ResQ Me ALERT
From: ${userName}
Time: ${timestamp}

${summary}${mapLink ? `

📍 Location: ${mapLink}` : ""}

Please check on them immediately.`;

    const results = [];

    // 4. Send to each enabled contact
    for (const contact of contacts) {
      try {
        let phoneNumber = contact.phone_number.trim().replace(/\s/g, "");
        
        // Smarter phone number handling: If it doesn't have a +, and it's 10 digits, assume +1. 
        if (!phoneNumber.startsWith("+")) {
          if (phoneNumber.length === 10) {
            phoneNumber = `+1${phoneNumber}`;
          } else {
            console.warn(`Phone number ${phoneNumber} might be missing a country code (+)`);
          }
        }

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

        if (twilioResponse.ok) {
          console.log(`Successfully sent to ${contact.name}`);
          results.push({ name: contact.name, success: true });
          
          // Log success
          try {
            await supabase.from("notification_logs").insert({
              alert_id: alertId,
              contact_id: contact.id,
              notification_type: "sms",
              status: "sent",
              sent_at: new Date().toISOString()
            });
          } catch (logErr) {
            console.warn("Could not write to notification_logs table");
          }

        } else {
          console.error(`Twilio rejected ${contact.name}:`, twilioData.message);
          results.push({ name: contact.name, success: false, error: twilioData.message });
          
          // Log failure
          try {
            await supabase.from("notification_logs").insert({
              alert_id: alertId,
              contact_id: contact.id,
              notification_type: "sms",
              status: "failed",
              error_message: twilioData.message
            });
          } catch (logErr) {
            console.warn("Could not write to notification_logs table");
          }
        }
      } catch (err) {
        console.error(`Error sending to ${contact.name}:`, err);
        results.push({ name: contact.name, success: false, error: "Network error" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return new Response(JSON.stringify({ 
      success: successCount > 0, 
      successCount, 
      totalContacts: contacts.length,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Critical Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
