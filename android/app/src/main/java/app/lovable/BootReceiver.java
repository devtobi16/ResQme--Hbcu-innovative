package app.lovable;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";
    private static final String PREFS_NAME = "ResQMePrefs";
    private static final String KEY_SERVICE_ENABLED = "background_service_enabled";

    private static final String WAKE_PREFS_NAME = "resqme_settings";
    private static final String KEY_WAKE_ENABLED = "wake_word_enabled";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            
            Log.d(TAG, "Boot completed, checking if service should restart");
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean serviceEnabled = prefs.getBoolean(KEY_SERVICE_ENABLED, false);

            if (serviceEnabled) {
                Log.d(TAG, "Restarting VolumeButtonService");
                Intent serviceIntent = new Intent(context, VolumeButtonService.class);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }

            SharedPreferences wakePrefs = context.getSharedPreferences(WAKE_PREFS_NAME, Context.MODE_PRIVATE);
            boolean wakeEnabled = wakePrefs.getBoolean(KEY_WAKE_ENABLED, false);

            if (wakeEnabled) {
                Log.d(TAG, "Restarting WakeWordService");
                Intent wakeIntent = new Intent(context, WakeWordService.class);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(wakeIntent);
                } else {
                    context.startService(wakeIntent);
                }
            }
        }
    }
}
