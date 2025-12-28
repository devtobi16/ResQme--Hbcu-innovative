import { useState, useEffect, useCallback } from 'react';
import VolumeButton from '@/plugins/VolumeButtonPlugin';

interface UseVolumeButtonTriggerOptions {
  onTrigger: () => void;
  enabled?: boolean;
}

export const useVolumeButtonTrigger = ({ onTrigger, enabled = true }: UseVolumeButtonTriggerOptions) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { supported } = await VolumeButton.isSupported();
        setIsSupported(supported);

        if (supported && enabled) {
          const listener = await VolumeButton.addListener('volumeButtonsPressed', (data) => {
            if (data.triggered) {
              onTrigger();
            }
          });
          cleanup = listener.remove;
          setIsListening(true);
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
  }, [onTrigger, enabled]);

  return {
    isSupported,
    isListening,
  };
};
