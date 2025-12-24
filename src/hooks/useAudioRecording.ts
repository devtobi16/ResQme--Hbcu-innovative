import { useState, useRef, useCallback } from "react";

interface AudioRecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  duration: number;
}

export const useAudioRecording = () => {
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    audioBlob: null,
    duration: 0,
  });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

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
        setState((prev) => ({ ...prev, audioBlob: blob, isRecording: false }));
        stream.getTracks().forEach((track) => track.stop());
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
      };

      mediaRecorder.start(1000); // Capture in 1-second chunks
      mediaRecorderRef.current = mediaRecorder;

      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, duration: elapsed }));
      }, 1000);

      setState({ isRecording: true, audioBlob: null, duration: 0 });
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const getRecordingChunks = useCallback(() => {
    return chunksRef.current;
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    getRecordingChunks,
  };
};
