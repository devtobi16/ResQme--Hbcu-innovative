import { WebPlugin } from '@capacitor/core';
import type { VolumeButtonPlugin } from './VolumeButtonPlugin';

export class VolumeButtonWeb extends WebPlugin implements VolumeButtonPlugin {
  async isSupported(): Promise<{ supported: boolean }> {
    // Volume button detection not supported on web
    return { supported: false };
  }
}
