import { useState, useRef, useCallback, useEffect } from "react";

interface SmartRecordingState {
  isRecording: boolean;
  duration: number;
  isSilent: boolean;
  silenceDuration: number;
}

interface UseSmartRecordingOptions {
  maxDuration?: number; // Maximum recording duration in seconds (default: 180 = 3 min)
  silenceThreshold?: number; // Audio level below which is considered silence (default: 0.03 - adjusted for mobile mics)
  silenceTimeout?: number; // Seconds of silence before auto-stop (default: 30)
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void;
  onSilenceDetected?: () => void;
}

export const useSmartRecording = ({
  maxDuration = 180,
  silenceThreshold = 0.03, // Increased for mobile microphones that pick up more ambient noise
  silenceTimeout = 30,
  onRecordingComplete,
  onSilenceDetected,
}: UseSmartRecordingOptions = {}) => {
  const [state, setState] = useState<SmartRecordingState>({
    isRecording: false,
    duration: 0,
    isSilent: false,
    silenceDuration: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const silenceStartRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    silenceStartRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanup();
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analysis for silence detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });

      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        
        setState(prev => ({ ...prev, isRecording: false }));
        
        if (onRecordingComplete) {
          onRecordingComplete(blob, finalDuration);
        }
        
        cleanup();
      };

      mediaRecorder.start(1000); // Capture in 1-second chunks
      mediaRecorderRef.current = mediaRecorder;

      // Duration tracking
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, duration: elapsed }));

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          console.log("Max duration reached, stopping recording");
          stopRecording();
        }
      }, 1000);

      // Silence detection
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let hasHadSound = false; // Track if we've detected sound at least once
      
      silenceCheckIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = average / 255;
        
        const isSilent = normalizedLevel < silenceThreshold;
        
        // Log audio level periodically for debugging
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (elapsed % 2 === 0) {
          console.log(`Audio level: ${normalizedLevel.toFixed(4)}, threshold: ${silenceThreshold}, silent: ${isSilent}`);
        }
        
        // Mark that we've detected sound at some point
        if (!isSilent) {
          hasHadSound = true;
        }
        
        if (isSilent) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          }
          
          const silenceDuration = Math.floor((Date.now() - silenceStartRef.current) / 1000);
          
          setState(prev => ({ 
            ...prev, 
            isSilent: true, 
            silenceDuration 
          }));

          // Auto-stop after extended silence (only if we've had some sound first, or after initial grace period)
          const shouldStop = silenceDuration >= silenceTimeout && (hasHadSound || elapsed >= 15);
          
          if (shouldStop) {
            console.log(`Extended silence detected (${silenceDuration}s), stopping recording. Had sound: ${hasHadSound}`);
            if (onSilenceDetected) {
              onSilenceDetected();
            }
            stopRecording();
          }
        } else {
          silenceStartRef.current = null;
          setState(prev => ({ 
            ...prev, 
            isSilent: false, 
            silenceDuration: 0 
          }));
        }
      }, 200);

      setState({
        isRecording: true,
        duration: 0,
        isSilent: false,
        silenceDuration: 0,
      });

    } catch (error) {
      console.error("Error starting smart recording:", error);
      cleanup();
      throw error;
    }
  }, [maxDuration, silenceThreshold, silenceTimeout, onRecordingComplete, onSilenceDetected, cleanup, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const getAudioBase64 = useCallback(async (): Promise<string | null> => {
    if (chunksRef.current.length === 0) return null;
    
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    getAudioBase64,
  };
};
