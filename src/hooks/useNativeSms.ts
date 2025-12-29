import { useState, useCallback, useEffect } from "react";
import NativeSms, { SmsMessage } from "@/plugins/NativeSmsPlugin";

interface UseNativeSmsOptions {
  onSuccess?: (count: number) => void;
  onError?: (error: string) => void;
}

interface Contact {
  name: string;
  phone_number: string;
}

export const useNativeSms = ({ onSuccess, onError }: UseNativeSmsOptions = {}) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const { available } = await NativeSms.isAvailable();
        setIsAvailable(available);
      } catch {
        setIsAvailable(false);
      }
    };

    checkAvailability();
  }, []);

  const buildEmergencyMessage = useCallback((
    userName: string,
    latitude: number | null,
    longitude: number | null,
    customMessage?: string
  ): string => {
    let message = `🚨 EMERGENCY ALERT: ${userName} has triggered an SOS.`;
    
    if (customMessage) {
      message += ` ${customMessage}`;
    }
    
    if (latitude && longitude) {
      message += ` Location: https://maps.google.com/?q=${latitude},${longitude}`;
    }
    
    message += " Please call immediately!";
    
    return message;
  }, []);

  const sendEmergencySms = useCallback(async (
    contacts: Contact[],
    userName: string,
    latitude: number | null,
    longitude: number | null,
    customMessage?: string
  ): Promise<{ success: boolean; sentCount: number }> => {
    if (contacts.length === 0) {
      onError?.("No emergency contacts configured");
      return { success: false, sentCount: 0 };
    }

    setIsSending(true);

    try {
      const message = buildEmergencyMessage(userName, latitude, longitude, customMessage);
      
      const messages: SmsMessage[] = contacts.map((contact) => ({
        phoneNumber: contact.phone_number,
        message,
      }));

      const result = await NativeSms.sendMultipleSms({ messages });
      
      setIsSending(false);

      if (result.successCount > 0) {
        onSuccess?.(result.successCount);
        return { success: true, sentCount: result.successCount };
      } else {
        onError?.("Failed to send SMS to any contacts");
        return { success: false, sentCount: 0 };
      }
    } catch (error: any) {
      setIsSending(false);
      onError?.(error.message || "Failed to send SMS");
      return { success: false, sentCount: 0 };
    }
  }, [buildEmergencyMessage, onSuccess, onError]);

  const sendSingleSms = useCallback(async (
    phoneNumber: string,
    message: string
  ): Promise<boolean> => {
    try {
      const result = await NativeSms.sendSms({ phoneNumber, message });
      return result.success;
    } catch {
      return false;
    }
  }, []);

  return {
    isAvailable,
    isSending,
    sendEmergencySms,
    sendSingleSms,
    buildEmergencyMessage,
  };
};
