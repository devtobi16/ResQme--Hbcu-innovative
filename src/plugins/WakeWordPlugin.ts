import { registerPlugin } from "@capacitor/core";

export interface WakeWordSettings {
  wakeWord: string;
  enabled: boolean;
}

export interface WakeWordPlugin {
  startService(options?: { wakeWord?: string }): Promise<void>;
  stopService(): Promise<void>;
  updateWakeWord(options: { wakeWord: string }): Promise<void>;
  getSettings(): Promise<WakeWordSettings>;
  isServiceRunning(): Promise<{ running: boolean }>;
  addListener(
    eventName: "wakeWordDetected",
    listenerFunc: (event: { wakeWord: string; action: string }) => void
  ): Promise<{ remove: () => void }>;
}

const WakeWord = registerPlugin<WakeWordPlugin>("WakeWord", {
  web: () => import("./WakeWordWeb").then((m) => new m.WakeWordWeb()),
});

export default WakeWord;
