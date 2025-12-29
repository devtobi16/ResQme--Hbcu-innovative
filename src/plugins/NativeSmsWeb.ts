import { WebPlugin } from "@capacitor/core";
import type { NativeSmsPlugin, SmsMessage } from "./NativeSmsPlugin";

export class NativeSmsWeb extends WebPlugin implements NativeSmsPlugin {
  async sendSms(options: SmsMessage): Promise<{ success: boolean }> {
    // Web fallback: open SMS app with pre-filled message
    const smsUrl = `sms:${options.phoneNumber}?body=${encodeURIComponent(options.message)}`;
    
    try {
      window.open(smsUrl, "_blank");
      return { success: true };
    } catch (error) {
      console.error("Web SMS fallback failed:", error);
      return { success: false };
    }
  }

  async sendMultipleSms(options: { messages: SmsMessage[] }): Promise<{
    successCount: number;
    failedCount: number;
    results: Array<{ phoneNumber: string; success: boolean; error?: string }>;
  }> {
    // Web cannot send multiple SMS automatically - open first one
    const results: Array<{ phoneNumber: string; success: boolean; error?: string }> = [];
    
    for (const msg of options.messages) {
      const result = await this.sendSms(msg);
      results.push({
        phoneNumber: msg.phoneNumber,
        success: result.success,
        error: result.success ? undefined : "Web fallback - user must send manually",
      });
    }

    return {
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    };
  }

  async isAvailable(): Promise<{ available: boolean }> {
    // Check if we're on a mobile device that might support sms: URLs
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return { available: isMobile };
  }
}
