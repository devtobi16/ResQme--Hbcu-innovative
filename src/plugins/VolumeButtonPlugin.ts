import { registerPlugin } from '@capacitor/core';

export interface VolumeButtonPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  startBackgroundService(): Promise<{ started: boolean }>;
  stopBackgroundService(): Promise<{ stopped: boolean }>;
  isBackgroundServiceRunning(): Promise<{ running: boolean }>;
  addListener(
    eventName: 'volumeButtonsPressed',
    listenerFunc: (data: { triggered: boolean; timestamp: number; source: string }) => void
  ): Promise<{ remove: () => void }>;
}

const VolumeButton = registerPlugin<VolumeButtonPlugin>('VolumeButton', {
  web: () => import('./VolumeButtonWeb').then(m => new m.VolumeButtonWeb()),
});

export default VolumeButton;
