import { useState, useRef, useCallback, useEffect } from "react";

interface SmartRecordingState {
  isRecording: boolean;
  duration: number;
  isSilent: boolean;
  silenceDuration: number;
}

interface UseSmartRecordingOptions {
  maxDuration?: number; // Maximum recording duration in seconds
  silenceThreshold?: number; // Audio level below which is considered silence
  silenceTimeout?: number; // Seconds of silence before auto-stop
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void;
  onSilenceDetected?: () => void;
}

export const useSmartRecording = ({
  maxDuration = 300, // Default to 5 minutes as requested
  silenceThreshold = 0.03,
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

  // Use a ref for the callback to avoid stale closures
  const onCompleteRef = useRef(onRecordingComplete);
  const onSilenceRef = useRef(onSilenceDetected);

  useEffect(() => {
    onCompleteRef.current = onRecordingComplete;
    onSilenceRef.current = onSilenceDetected;
  }, [onRecordingComplete, onSilenceDetected]);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    silenceStartRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    console.log("Stopping recording...");
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    } else {
      cleanup();
      setState((prev) => ({ ...prev, isRecording: false }));
    }
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      console.log("Starting recording process...");
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

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/aac";

      console.log(`Using mimeType: ${mimeType}`);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped, processing blob...");
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const finalDuration = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );

        setState((prev) => ({ ...prev, isRecording: false }));

        if (onCompleteRef.current) {
          onCompleteRef.current(blob, finalDuration);
        }

        cleanup();
      };

      mediaRecorder.start(1000); // Capture in 1-second chunks
      mediaRecorderRef.current = mediaRecorder;

      // Duration tracking
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));

        if (elapsed >= maxDuration) {
          console.log("Max duration reached (5 mins), stopping...");
          stopRecording();
        }
      }, 1000);

      // Silence detection
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let hasHadSound = false;

      silenceCheckIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        let count = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > 0) {
            sum += dataArray[i];
            count++;
          }
        }
        const average = count > 0 ? sum / count : 0;
        const normalizedLevel = average / 255;

        const isSilent = normalizedLevel < silenceThreshold;
        const now = Date.now();

        if (!isSilent) {
          hasHadSound = true;
        }

        if (isSilent) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = now;
          }

          const silenceDuration = Math.floor(
            (now - silenceStartRef.current) / 1000
          );
          const elapsed = Math.floor((now - startTimeRef.current) / 1000);

          // Auto-stop if silent for 30s after at least 10s of recording
          const shouldStop =
            hasHadSound && silenceDuration >= silenceTimeout && elapsed >= 10;

          setState((prev) => ({
            ...prev,
            isSilent: true,
            silenceDuration,
          }));

          if (shouldStop) {
            console.log("Silence timeout reached, stopping...");
            if (onSilenceRef.current) {
              onSilenceRef.current();
            }
            stopRecording();
          }
        } else {
          silenceStartRef.current = null;
          setState((prev) => ({
            ...prev,
            isSilent: false,
            silenceDuration: 0,
          }));
        }
      }, 500);

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
  }, [maxDuration, silenceThreshold, silenceTimeout, cleanup, stopRecording]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const getAudioBase64 = useCallback(async (): Promise<string | null> => {
    if (chunksRef.current.length === 0) return null;

    const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType });
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
