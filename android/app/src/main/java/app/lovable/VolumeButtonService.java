package app.lovable;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class VolumeButtonService extends Service {
    private static final String TAG = "VolumeButtonService";
    private static final String CHANNEL_ID = "resqme_protection_channel";
    private static final int NOTIFICATION_ID = 1001;
    
    public static final String ACTION_VOLUME_BUTTONS_PRESSED = "app.lovable.VOLUME_BUTTONS_PRESSED";
    
    private AudioManager audioManager;
    private int lastVolumeUp = -1;
    private int lastVolumeDown = -1;
    private long lastVolumeUpTime = 0;
    private long lastVolumeDownTime = 0;
    private static final long SIMULTANEOUS_THRESHOLD = 500; // 500ms window
    
    private BroadcastReceiver volumeReceiver;
    private int originalVolume = -1;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        originalVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        
        createNotificationChannel();
        setupVolumeListener();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service started");
        
        Notification notification = createNotification();
        startForeground(NOTIFICATION_ID, notification);
        
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
        Log.d(TAG, "Service destroyed");
        
        if (volumeReceiver != null) {
            try {
                unregisterReceiver(volumeReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver", e);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "ResQMe Protection",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows when ResQMe is actively protecting you");
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
            .setContentTitle("ResQMe Active")
            .setContentText("Press Vol+ & Vol- together for emergency")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void setupVolumeListener() {
        volumeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if ("android.media.VOLUME_CHANGED_ACTION".equals(intent.getAction())) {
                    int streamType = intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_TYPE", -1);
                    
                    if (streamType == AudioManager.STREAM_MUSIC || streamType == AudioManager.STREAM_RING) {
                        int currentVolume = audioManager.getStreamVolume(streamType);
                        long currentTime = System.currentTimeMillis();
                        
                        // Detect volume up press
                        if (currentVolume > originalVolume) {
                            lastVolumeUpTime = currentTime;
                            Log.d(TAG, "Volume UP detected");
                        }
                        // Detect volume down press
                        else if (currentVolume < originalVolume) {
                            lastVolumeDownTime = currentTime;
                            Log.d(TAG, "Volume DOWN detected");
                        }
                        
                        originalVolume = currentVolume;
                        
                        // Check if both were pressed within threshold
                        checkSimultaneousPress();
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter("android.media.VOLUME_CHANGED_ACTION");
        registerReceiver(volumeReceiver, filter);
        Log.d(TAG, "Volume listener registered");
    }

    private void checkSimultaneousPress() {
        long timeDiff = Math.abs(lastVolumeUpTime - lastVolumeDownTime);
        
        if (lastVolumeUpTime > 0 && lastVolumeDownTime > 0 && timeDiff < SIMULTANEOUS_THRESHOLD) {
            Log.d(TAG, "SIMULTANEOUS PRESS DETECTED! Triggering alert...");
            
            // Reset times
            lastVolumeUpTime = 0;
            lastVolumeDownTime = 0;
            
            // Send broadcast that can be picked up by the app
            Intent intent = new Intent(ACTION_VOLUME_BUTTONS_PRESSED);
            intent.setPackage(getPackageName());
            sendBroadcast(intent);
            
            // Also launch the app if it's not in foreground
            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra("trigger_sos", true);
            startActivity(launchIntent);
        }
    }
}
