import { useState, useEffect, useCallback, useRef } from "react";

interface VoiceCommandOptions {
  wakeWord?: string;
  onWakeWordDetected?: () => void;
  onCommand?: (command: string) => void;
  continuous?: boolean;
}

export const useVoiceCommand = ({
  wakeWord = "resqme",
  onWakeWordDetected,
  onCommand,
  continuous = true,
}: VoiceCommandOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null);

  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognitionClass();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const fullTranscript = (finalTranscript || interimTranscript).trim();
        setTranscript(fullTranscript);

        // Check for wake word + help command
        const wakeWordLower = wakeWord.toLowerCase();
        if (
          fullTranscript.includes(wakeWordLower) &&
          (fullTranscript.includes("help") || fullTranscript.includes("emergency"))
        ) {
          onWakeWordDetected?.();
          onCommand?.(fullTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "no-speech" && event.error !== "aborted") {
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening && continuous) {
          // Restart if continuous mode
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.log("Recognition restart failed:", e);
          }
        } else {
          setIsListening(false);
        }
      };
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [wakeWord, onWakeWordDetected, onCommand, continuous, isListening]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
  };
};

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInterface;
    webkitSpeechRecognition: new () => SpeechRecognitionInterface;
  }
}
