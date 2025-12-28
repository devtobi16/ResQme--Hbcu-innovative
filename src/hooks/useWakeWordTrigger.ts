import { useState, useEffect, useCallback, useRef } from "react";
import WakeWord from "@/plugins/WakeWordPlugin";

interface UseWakeWordOptions {
  onTrigger: () => void;
  enabled?: boolean;
  wakeWord?: string;
}

export const useWakeWordTrigger = ({
  onTrigger,
  enabled = true,
  wakeWord = "resqme",
}: UseWakeWordOptions) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentWakeWord, setCurrentWakeWord] = useState(wakeWord);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      try {
        // Check if we're on a platform that supports wake word detection
        const SpeechRecognitionClass =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        setIsSupported(!!SpeechRecognitionClass);
      } catch {
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  useEffect(() => {
    if (!isSupported || !enabled) return;

    const setupListener = async () => {
      try {
        // Start the wake word service
        await WakeWord.startService({ wakeWord: currentWakeWord });
        setIsListening(true);

        // Listen for wake word detection events
        listenerRef.current = await WakeWord.addListener(
          "wakeWordDetected",
          (event) => {
            console.log("Wake word detected:", event);
            if (event.action === "trigger") {
              onTrigger();
            }
          }
        );
      } catch (error) {
        console.error("Failed to start wake word service:", error);
        setIsListening(false);
      }
    };

    setupListener();

    return () => {
      listenerRef.current?.remove();
      WakeWord.stopService().catch(console.error);
      setIsListening(false);
    };
  }, [isSupported, enabled, currentWakeWord, onTrigger]);

  const updateWakeWord = useCallback(async (newWakeWord: string) => {
    try {
      await WakeWord.updateWakeWord({ wakeWord: newWakeWord });
      setCurrentWakeWord(newWakeWord);
    } catch (error) {
      console.error("Failed to update wake word:", error);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) return;
    try {
      await WakeWord.startService({ wakeWord: currentWakeWord });
      setIsListening(true);
    } catch (error) {
      console.error("Failed to start listening:", error);
    }
  }, [isSupported, currentWakeWord]);

  const stopListening = useCallback(async () => {
    try {
      await WakeWord.stopService();
      setIsListening(false);
    } catch (error) {
      console.error("Failed to stop listening:", error);
    }
  }, []);

  return {
    isSupported,
    isListening,
    currentWakeWord,
    updateWakeWord,
    startListening,
    stopListening,
  };
};
