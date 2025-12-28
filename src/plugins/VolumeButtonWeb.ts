import { WebPlugin } from '@capacitor/core';
import type { VolumeButtonPlugin } from './VolumeButtonPlugin';

export class VolumeButtonWeb extends WebPlugin implements VolumeButtonPlugin {
  async isSupported(): Promise<{ supported: boolean }> {
    return { supported: false };
  }

  async startBackgroundService(): Promise<{ started: boolean }> {
    console.log('VolumeButton: Background service not available on web');
    return { started: false };
  }

  async stopBackgroundService(): Promise<{ stopped: boolean }> {
    return { stopped: false };
  }

  async isBackgroundServiceRunning(): Promise<{ running: boolean }> {
    return { running: false };
  }
}
