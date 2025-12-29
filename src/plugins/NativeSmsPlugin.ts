import { registerPlugin } from "@capacitor/core";

export interface SmsMessage {
  phoneNumber: string;
  message: string;
}

export interface NativeSmsPlugin {
  sendSms(options: SmsMessage): Promise<{ success: boolean }>;
  sendMultipleSms(options: { messages: SmsMessage[] }): Promise<{ 
    successCount: number; 
    failedCount: number;
    results: Array<{ phoneNumber: string; success: boolean; error?: string }>;
  }>;
  isAvailable(): Promise<{ available: boolean }>;
}

const NativeSms = registerPlugin<NativeSmsPlugin>("NativeSms", {
  web: () => import("./NativeSmsWeb").then((m) => new m.NativeSmsWeb()),
});

export default NativeSms;
