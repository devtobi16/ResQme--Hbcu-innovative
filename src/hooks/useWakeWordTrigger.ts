import { useState, useEffect, useCallback, useRef } from "react";
import WakeWord from "@/plugins/WakeWordPlugin";

interface UseWakeWordOptions {
  onTrigger: () => void;
  enabled?: boolean;
  wakeWord?: string;
}

type WakeWordMode = "native" | "web_speech" | "none";

export const useWakeWordTrigger = ({
  onTrigger,
  enabled = true,
  wakeWord = "resqme",
}: UseWakeWordOptions) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentWakeWord, setCurrentWakeWord] = useState(wakeWord);
  const [mode, setMode] = useState<WakeWordMode>("none");

  const listenerRef = useRef<{ remove: () => void } | null>(null);

  // Web Speech fallback (foreground only)
  const recognitionRef = useRef<any>(null);
  const manuallyStoppedRef = useRef(false);
  const listeningRef = useRef(false);

  useEffect(() => {
    listeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const checkSupport = async () => {
      try {
        const SpeechRecognitionClass =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        const { Capacitor } = await import("@capacitor/core");

        if (Capacitor.isNativePlatform()) {
          // Native platform can report "native" even if the plugin wasn't synced/registered.
          // Prefer native plugin; fall back to Web Speech when possible.
          try {
            await WakeWord.isServiceRunning();
            setIsSupported(true);
            setMode("native");
          } catch (e) {
            console.warn("WakeWord plugin unavailable on this build; using web fallback if possible:", e);
            const supported = !!SpeechRecognitionClass;
            setIsSupported(supported);
            setMode(supported ? "web_speech" : "none");
          }
          return;
        }

        const supported = !!SpeechRecognitionClass;
        setIsSupported(supported);
        setMode(supported ? "web_speech" : "none");
      } catch {
        setIsSupported(false);
        setMode("none");
      }
    };

    checkSupport();
  }, []);

  const startWebSpeech = useCallback(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    manuallyStoppedRef.current = false;

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = String(event.results[i][0].transcript || "").toLowerCase();
          const ww = currentWakeWord.toLowerCase();
          if (transcript.includes(ww) && (transcript.includes("help") || transcript.includes("emergency"))) {
            onTrigger();
          }
        }
      };

      recognition.onerror = (event: any) => {
        const err = String(event?.error || "speech_error");
        console.error("Wake word (web) recognition error:", err);
      };

      recognition.onend = () => {
        // Auto-restart if still enabled and not manually stopped.
        if (enabled && !manuallyStoppedRef.current && listeningRef.current) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn("Wake word (web) start failed:", e);
      setIsListening(false);
    }
  }, [currentWakeWord, enabled, onTrigger]);

  const stopWebSpeech = useCallback(() => {
    manuallyStoppedRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (!isSupported || !enabled) return;

    const setupListener = async () => {
      try {
        if (mode === "native") {
          // Start the wake word service
          await WakeWord.startService({ wakeWord: currentWakeWord });
          setIsListening(true);

          // Listen for wake word detection events
          listenerRef.current = await WakeWord.addListener("wakeWordDetected", (event) => {
            console.log("Wake word detected:", event);
            if (event.action === "trigger") {
              onTrigger();
            }
          });
          return;
        }

        if (mode === "web_speech") {
          startWebSpeech();
        }
      } catch (error) {
        console.error("Failed to start wake word:", error);
        setIsListening(false);
      }
    };

    setupListener();

    return () => {
      listenerRef.current?.remove();
      // IMPORTANT: do NOT stop the native service on unmount.
      // It must keep running in the background when the user has enabled voice activation.
      if (mode === "web_speech") {
        stopWebSpeech();
      }
      setIsListening(false);
    };
  }, [isSupported, enabled, currentWakeWord, onTrigger, mode, startWebSpeech, stopWebSpeech]);

  const updateWakeWord = useCallback(async (newWakeWord: string) => {
    try {
      if (mode === "native") {
        await WakeWord.updateWakeWord({ wakeWord: newWakeWord });
      }
      setCurrentWakeWord(newWakeWord);
    } catch (error) {
      console.error("Failed to update wake word:", error);
    }
  }, [mode]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      console.warn("Wake word not supported");
      return;
    }

    try {
      // Web Speech requires microphone permission via the browser.
      if (mode === "web_speech") {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (permErr) {
          console.error("Microphone permission denied (web speech):", permErr);
          setIsListening(false);
          return;
        }

        startWebSpeech();
        return;
      }

      // Native mode: permission is handled by the Android app permission flow.
      if (mode === "native") {
        await WakeWord.startService({ wakeWord: currentWakeWord });
        setIsListening(true);
      }
    } catch (error) {
      console.error("Failed to start listening:", error);
      setIsListening(false);
    }
  }, [isSupported, mode, currentWakeWord, startWebSpeech]);

  const stopListening = useCallback(async () => {
    try {
      if (mode === "native") {
        await WakeWord.stopService();
        setIsListening(false);
        return;
      }
      if (mode === "web_speech") {
        stopWebSpeech();
      }
    } catch (error) {
      console.error("Failed to stop listening:", error);
    }
  }, [mode, stopWebSpeech]);

  return {
    isSupported,
    isListening,
    currentWakeWord,
    updateWakeWord,
    startListening,
    stopListening,
  };
};
