import { WebPlugin, PluginListenerHandle, ListenerCallback } from "@capacitor/core";
import type { WakeWordPlugin, WakeWordSettings } from "./WakeWordPlugin";

// Web Speech API type declarations
interface SpeechRecognitionInterface {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventInterface) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventInterface) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventInterface {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string; confidence: number };
    };
  };
}

interface SpeechRecognitionErrorEventInterface {
  error: string;
}


/**
 * Web implementation of WakeWordPlugin.
 * Uses Web Speech API when available, but note that background listening
 * is not supported on web platforms.
 */
export class WakeWordWeb extends WebPlugin implements WakeWordPlugin {
  private wakeWord = "resqme";
  private enabled = false;
  private recognition: SpeechRecognitionInterface | null = null;
  private eventListeners: Map<string, ((event: { wakeWord: string; action: string }) => void)[]> = new Map();

  async startService(options?: { wakeWord?: string }): Promise<void> {
    if (options?.wakeWord) {
      this.wakeWord = options.wakeWord.toLowerCase();
    }
    this.enabled = true;

    // Web Speech API for foreground listening only
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onresult = (event: SpeechRecognitionEventInterface) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          
          if (
            transcript.includes(this.wakeWord) &&
            (transcript.includes("help") || transcript.includes("emergency"))
          ) {
            this.emitEvent("wakeWordDetected", {
              wakeWord: this.wakeWord,
              action: "trigger",
            });
          }
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEventInterface) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "no-speech" && event.error !== "aborted" && this.enabled) {
          // Restart on error
          setTimeout(() => this.restartRecognition(), 1000);
        }
      };

      this.recognition.onend = () => {
        if (this.enabled) {
          this.restartRecognition();
        }
      };

      try {
        this.recognition.start();
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }

    console.log("WakeWord service started (web fallback - foreground only)");
  }

  private restartRecognition() {
    if (this.recognition && this.enabled) {
      try {
        this.recognition.start();
      } catch (e) {
        // Already started
      }
    }
  }

  async stopService(): Promise<void> {
    this.enabled = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Already stopped
      }
      this.recognition = null;
    }
    console.log("WakeWord service stopped");
  }

  async updateWakeWord(options: { wakeWord: string }): Promise<void> {
    this.wakeWord = options.wakeWord.toLowerCase();
    console.log("Wake word updated to:", this.wakeWord);
  }

  async getSettings(): Promise<WakeWordSettings> {
    return {
      wakeWord: this.wakeWord,
      enabled: this.enabled,
    };
  }

  async isServiceRunning(): Promise<{ running: boolean }> {
    return { running: this.enabled };
  }

  async addListener(
    eventName: "wakeWordDetected",
    listenerFunc: ListenerCallback
  ): Promise<PluginListenerHandle> {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName)!.push(listenerFunc as (event: { wakeWord: string; action: string }) => void);

    return {
      remove: async () => {
        const arr = this.eventListeners.get(eventName);
        if (arr) {
          const idx = arr.indexOf(listenerFunc as (event: { wakeWord: string; action: string }) => void);
          if (idx !== -1) arr.splice(idx, 1);
        }
      },
    };
  }

  private emitEvent(eventName: string, data: { wakeWord: string; action: string }) {
    const arr = this.eventListeners.get(eventName);
    if (arr) {
      arr.forEach((fn) => fn(data));
    }
  }
}
