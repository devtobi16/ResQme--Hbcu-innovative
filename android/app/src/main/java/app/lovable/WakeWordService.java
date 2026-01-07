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
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Background service for wake word detection.
 * Runs as a foreground microphone service with an ongoing notification.
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

    private static final long TRIGGER_COOLDOWN_MS = 10_000;

    private Handler mainHandler;
    private volatile boolean isListening = false;
    private String currentWakeWord = DEFAULT_WAKE_WORD;
    private long lastTriggerAt = 0;

    private SpeechRecognizer speechRecognizer;
    private Intent recognizerIntent;

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
        currentWakeWord = prefs.getString(PREF_WAKE_WORD, DEFAULT_WAKE_WORD)
                .toLowerCase(Locale.ROOT)
                .trim();
        Log.d(TAG, "Loaded wake word: " + currentWakeWord);
    }

    private void updateWakeWord(String newWakeWord) {
        currentWakeWord = newWakeWord.toLowerCase(Locale.ROOT).trim();
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

        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.e(TAG, "Speech recognition not available on this device");
            return;
        }

        isListening = true;

        recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            recognizerIntent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        }

        mainHandler.post(() -> {
            try {
                if (speechRecognizer != null) {
                    try { speechRecognizer.destroy(); } catch (Exception ignored) {}
                }
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getApplicationContext());
                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) { Log.d(TAG, "Ready for speech"); }
                    @Override public void onBeginningOfSpeech() { }
                    @Override public void onRmsChanged(float rmsdB) { }
                    @Override public void onBufferReceived(byte[] buffer) { }
                    @Override public void onEndOfSpeech() {
                        // Natural end; restart quickly if still enabled.
                        restartSoon(200);
                    }
                    @Override public void onError(int error) {
                        Log.e(TAG, "SpeechRecognizer error: " + error);
                        restartSoon(800);
                    }
                    @Override public void onResults(Bundle results) {
                        handleResults(results, false);
                        restartSoon(200);
                    }
                    @Override public void onPartialResults(Bundle partialResults) {
                        handleResults(partialResults, true);
                    }
                    @Override public void onEvent(int eventType, Bundle params) { }
                });

                speechRecognizer.startListening(recognizerIntent);
                Log.d(TAG, "Started SpeechRecognizer listening");
            } catch (Exception e) {
                Log.e(TAG, "Failed to start SpeechRecognizer", e);
                isListening = false;
            }
        });
    }

    private void restartSoon(long delayMs) {
        if (!isListening) return;
        mainHandler.postDelayed(() -> {
            if (!isListening) return;
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.cancel();
                    speechRecognizer.startListening(recognizerIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to restart SpeechRecognizer", e);
            }
        }, delayMs);
    }

    private void handleResults(Bundle bundle, boolean partial) {
        if (!isListening || bundle == null) return;

        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;

        long now = System.currentTimeMillis();
        if (now - lastTriggerAt < TRIGGER_COOLDOWN_MS) return;

        for (String m : matches) {
            if (m == null) continue;
            String t = m.toLowerCase(Locale.ROOT);

            // Accept: "<wakeword> help" or "<wakeword> emergency" (also allow just "help" / "emergency")
            boolean hasHelp = t.contains("help") || t.contains("emergency");
            boolean hasWake = t.contains(currentWakeWord);

            if (hasHelp && (hasWake || t.trim().equals("help") || t.trim().equals("emergency"))) {
                lastTriggerAt = now;
                Log.d(TAG, "Wake phrase matched (" + (partial ? "partial" : "final") + "): " + t);

                // Notify JS listeners (when web is running) + trigger native SOS.
                sendWakeWordBroadcast("trigger");
                onWakeWordConfirmed(this);
                break;
            }
        }
    }

    private void sendWakeWordBroadcast(String action) {
        Intent intent = new Intent(ACTION_WAKE_WORD_DETECTED);
        intent.setPackage(getPackageName());
        intent.putExtra("wake_word", currentWakeWord);
        intent.putExtra("action", action);
        sendBroadcast(intent);
    }

    private void stopListening() {
        isListening = false;
        mainHandler.post(() -> {
            if (speechRecognizer != null) {
                try {
                    speechRecognizer.cancel();
                    speechRecognizer.destroy();
                } catch (Exception ignored) {
                }
                speechRecognizer = null;
            }
        });
        Log.d(TAG, "Stopped listening");
    }

    /**
     * Called when wake word + command is confirmed.
     */
    public static void onWakeWordConfirmed(Context context) {
        Log.d(TAG, "Wake phrase confirmed! Triggering emergency...");

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra("trigger_sos", true);
        launchIntent.putExtra("trigger_type", "voice");
        context.startActivity(launchIntent);
    }
}
