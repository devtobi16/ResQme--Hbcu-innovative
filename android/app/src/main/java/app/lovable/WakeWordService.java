package app.lovable;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Background service for wake word detection.
 * Listens for a customizable wake word and triggers audio recording when detected.
 * Uses on-device speech pattern matching for low power consumption.
 */
public class WakeWordService extends Service {
    private static final String TAG = "WakeWordService";
    private static final String CHANNEL_ID = "resqme_wakeword_channel";
    private static final int NOTIFICATION_ID = 1002;
    
    public static final String ACTION_WAKE_WORD_DETECTED = "app.lovable.WAKE_WORD_DETECTED";
    public static final String PREFS_NAME = "resqme_settings";
    public static final String PREF_WAKE_WORD = "wake_word";
    public static final String PREF_WAKE_WORD_ENABLED = "wake_word_enabled";
    public static final String DEFAULT_WAKE_WORD = "resqme";
    
    private static final int SAMPLE_RATE = 16000;
    private static final int BUFFER_SIZE_SECONDS = 3;
    
    private AudioRecord audioRecord;
    private Thread detectionThread;
    private volatile boolean isListening = false;
    private String currentWakeWord = DEFAULT_WAKE_WORD;
    
    // Simple pattern matching buffers
    private List<float[]> audioBuffer = new ArrayList<>();
    private Handler mainHandler;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "WakeWordService created");
        mainHandler = new Handler(Looper.getMainLooper());
        
        loadSettings();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "WakeWordService started");
        
        if (intent != null && "UPDATE_WAKE_WORD".equals(intent.getAction())) {
            String newWakeWord = intent.getStringExtra("wake_word");
            if (newWakeWord != null && !newWakeWord.isEmpty()) {
                updateWakeWord(newWakeWord);
            }
            return START_STICKY;
        }
        
        Notification notification = createNotification();
        startForeground(NOTIFICATION_ID, notification);
        
        startListening();
        
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "WakeWordService destroyed");
        stopListening();
    }

    private void loadSettings() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        currentWakeWord = prefs.getString(PREF_WAKE_WORD, DEFAULT_WAKE_WORD).toLowerCase(Locale.ROOT);
        Log.d(TAG, "Loaded wake word: " + currentWakeWord);
    }

    private void updateWakeWord(String newWakeWord) {
        currentWakeWord = newWakeWord.toLowerCase(Locale.ROOT);
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_WAKE_WORD, currentWakeWord).apply();
        
        // Update notification
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, createNotification());
        }
        
        Log.d(TAG, "Updated wake word to: " + currentWakeWord);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Voice Activation",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Listening for wake word to trigger emergency");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Voice Activation Ready")
            .setContentText("Say \"" + currentWakeWord + " help\" for emergency")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void startListening() {
        if (isListening) {
            Log.d(TAG, "Already listening");
            return;
        }

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Microphone permission not granted");
            return;
        }

        int bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );

        if (bufferSize == AudioRecord.ERROR || bufferSize == AudioRecord.ERROR_BAD_VALUE) {
            Log.e(TAG, "Invalid buffer size");
            return;
        }

        try {
            audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize * 2
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord not initialized");
                return;
            }

            isListening = true;
            audioRecord.startRecording();

            detectionThread = new Thread(this::processAudio, "WakeWordDetection");
            detectionThread.start();

            Log.d(TAG, "Started listening for wake word: " + currentWakeWord);
        } catch (Exception e) {
            Log.e(TAG, "Error starting audio recording", e);
        }
    }

    private void stopListening() {
        isListening = false;

        if (detectionThread != null) {
            try {
                detectionThread.join(1000);
            } catch (InterruptedException e) {
                Log.e(TAG, "Error stopping detection thread", e);
            }
            detectionThread = null;
        }

        if (audioRecord != null) {
            try {
                audioRecord.stop();
                audioRecord.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing audio record", e);
            }
            audioRecord = null;
        }

        Log.d(TAG, "Stopped listening");
    }

    private void processAudio() {
        short[] buffer = new short[1024];
        StringBuilder speechBuffer = new StringBuilder();
        long lastDetectionTime = 0;
        long silenceStart = 0;
        boolean inSpeech = false;
        
        // Use Android's built-in speech recognition via intent
        // For now, we'll use energy-based detection as a trigger
        
        while (isListening) {
            int readSize = audioRecord.read(buffer, 0, buffer.length);
            
            if (readSize > 0) {
                // Calculate audio energy
                double energy = 0;
                for (int i = 0; i < readSize; i++) {
                    energy += buffer[i] * buffer[i];
                }
                energy = Math.sqrt(energy / readSize);
                
                long currentTime = System.currentTimeMillis();
                
                // Simple voice activity detection
                if (energy > 1500) { // Voice threshold
                    if (!inSpeech) {
                        inSpeech = true;
                        speechBuffer.setLength(0);
                    }
                    silenceStart = currentTime;
                } else if (inSpeech) {
                    // Check for end of speech (500ms silence)
                    if (currentTime - silenceStart > 500) {
                        inSpeech = false;
                        
                        // Trigger speech recognition
                        if (currentTime - lastDetectionTime > 3000) { // 3 second cooldown
                            triggerSpeechRecognition();
                            lastDetectionTime = currentTime;
                        }
                    }
                }
            }
            
            try {
                Thread.sleep(50); // Reduce CPU usage
            } catch (InterruptedException e) {
                break;
            }
        }
    }

    private void triggerSpeechRecognition() {
        Log.d(TAG, "Voice activity detected, triggering recognition...");
        
        // Send broadcast to trigger in-app speech recognition
        // The app will use Android's SpeechRecognizer to get the actual words
        mainHandler.post(() -> {
            Intent intent = new Intent(ACTION_WAKE_WORD_DETECTED);
            intent.setPackage(getPackageName());
            intent.putExtra("wake_word", currentWakeWord);
            intent.putExtra("action", "start_recognition");
            sendBroadcast(intent);
        });
    }

    /**
     * Called when wake word + command is confirmed by in-app speech recognition
     */
    public static void onWakeWordConfirmed(Context context) {
        Log.d(TAG, "Wake word confirmed! Triggering emergency...");
        
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra("trigger_sos", true);
        launchIntent.putExtra("trigger_type", "voice");
        context.startActivity(launchIntent);
    }
}
