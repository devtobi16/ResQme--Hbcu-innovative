import { registerPlugin } from '@capacitor/core';

export interface VolumeButtonPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  addListener(
    eventName: 'volumeButtonsPressed',
    listenerFunc: (data: { triggered: boolean; timestamp: number }) => void
  ): Promise<{ remove: () => void }>;
}

const VolumeButton = registerPlugin<VolumeButtonPlugin>('VolumeButton', {
  web: () => import('./VolumeButtonWeb').then(m => new m.VolumeButtonWeb()),
});

export default VolumeButton;
