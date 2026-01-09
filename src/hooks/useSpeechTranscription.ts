import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechTranscriptionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface SpeechTranscriptionState {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  lastError: string | null;
}

// Lightweight Web Speech API transcription helper (foreground only).
export const useSpeechTranscription = ({
  lang = "en-US",
  continuous = true,
  interimResults = true,
}: UseSpeechTranscriptionOptions = {}) => {
  const [state, setState] = useState<SpeechTranscriptionState>({
    isSupported: false,
    isListening: false,
    transcript: "",
    lastError: null,
  });

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>("");
  const manuallyStoppedRef = useRef(false);

  useEffect(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setState((p) => ({ ...p, isSupported: false }));
      return;
    }

    setState((p) => ({ ...p, isSupported: true }));

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = (event.results[i][0].transcript as string) || "";
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += t.trim() + " ";
        } else {
          interim += t;
        }
      }

      const full = (finalTranscriptRef.current + interim).trim();
      setState((p) => ({ ...p, transcript: full }));
    };

    recognition.onerror = (event: any) => {
      const msg = String(event?.error || "speech_error");
      setState((p) => ({ ...p, lastError: msg, isListening: false }));
    };

    recognition.onend = () => {
      // Restart only if we didn't explicitly stop it.
      if (!manuallyStoppedRef.current && state.isListening && continuous) {
        try {
          recognition.start();
        } catch {
          // ignore (already started)
        }
      } else {
        setState((p) => ({ ...p, isListening: false }));
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, continuous, interimResults]);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    setState((p) => ({ ...p, transcript: "", lastError: null }));
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (state.isListening) return;

    manuallyStoppedRef.current = false;
    setState((p) => ({ ...p, lastError: null }));

    try {
      recognitionRef.current.start();
      setState((p) => ({ ...p, isListening: true }));
    } catch (e) {
      setState((p) => ({ ...p, lastError: "failed_to_start", isListening: false }));
    }
  }, [state.isListening]);

  const stopListening = useCallback(() => {
    manuallyStoppedRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setState((p) => ({ ...p, isListening: false }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    reset,
  };
};
