import { useState, useEffect, useCallback } from 'react';
import VolumeButton from '@/plugins/VolumeButtonPlugin';

interface UseVolumeButtonTriggerOptions {
  onTrigger: () => void;
  enabled?: boolean;
}

export const useVolumeButtonTrigger = ({ onTrigger, enabled = true }: UseVolumeButtonTriggerOptions) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isBackgroundActive, setIsBackgroundActive] = useState(false);

  // Start background service for screen-off detection
  const startBackgroundProtection = useCallback(async () => {
    try {
      const { started } = await VolumeButton.startBackgroundService();
      setIsBackgroundActive(started);
      return started;
    } catch (error) {
      console.log('Failed to start background service:', error);
      return false;
    }
  }, []);

  // Stop background service
  const stopBackgroundProtection = useCallback(async () => {
    try {
      const { stopped } = await VolumeButton.stopBackgroundService();
      if (stopped) setIsBackgroundActive(false);
      return stopped;
    } catch (error) {
      console.log('Failed to stop background service:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { supported } = await VolumeButton.isSupported();
        setIsSupported(supported);

        if (supported && enabled) {
          const listener = await VolumeButton.addListener('volumeButtonsPressed', (data) => {
            if (data.triggered) {
              console.log('Volume buttons triggered from:', data.source);
              onTrigger();
            }
          });
          cleanup = listener.remove;
          setIsListening(true);

          // Auto-start background service
          await startBackgroundProtection();
        }
      } catch (error) {
        console.log('Volume button detection not available:', error);
        setIsSupported(false);
      }
    };

    setup();

    return () => {
      if (cleanup) {
        cleanup();
      }
      setIsListening(false);
    };
  }, [onTrigger, enabled, startBackgroundProtection]);

  return {
    isSupported,
    isListening,
    isBackgroundActive,
    startBackgroundProtection,
    stopBackgroundProtection,
  };
};
