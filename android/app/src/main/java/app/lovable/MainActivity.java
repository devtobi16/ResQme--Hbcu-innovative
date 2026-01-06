package app.lovable;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private VolumeButtonPlugin volumeButtonPlugin;
    private BroadcastReceiver sosReceiver;
    private BroadcastReceiver wakeWordReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register the volume button plugin
        registerPlugin(VolumeButtonPlugin.class);
        
        // Setup receiver for SOS triggers from service
        setupSOSReceiver();
        
        // Setup receiver for wake word triggers
        setupWakeWordReceiver();
        
        // Check if launched with SOS trigger
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("trigger_sos", false)) {
            Log.d(TAG, "App launched with SOS trigger");
            // Notify the web app
            triggerSOSFromNative();
        }
    }

    private void setupSOSReceiver() {
        sosReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (VolumeButtonService.ACTION_VOLUME_BUTTONS_PRESSED.equals(intent.getAction())) {
                    Log.d(TAG, "Received volume buttons pressed broadcast");
                    triggerSOSFromNative();
                }
            }
        };

        IntentFilter filter = new IntentFilter(VolumeButtonService.ACTION_VOLUME_BUTTONS_PRESSED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(sosReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(sosReceiver, filter);
        }
    }

    private void setupWakeWordReceiver() {
        wakeWordReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (WakeWordService.ACTION_WAKE_WORD_DETECTED.equals(intent.getAction())) {
                    Log.d(TAG, "Received wake word detected broadcast");
                    triggerSOSFromNative();
                }
            }
        };

        IntentFilter filter = new IntentFilter(WakeWordService.ACTION_WAKE_WORD_DETECTED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(wakeWordReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(wakeWordReceiver, filter);
        }
    }

    private void triggerSOSFromNative() {
        // Get the plugin instance and trigger the event
        VolumeButtonPlugin plugin = (VolumeButtonPlugin) getBridge().getPlugin("VolumeButton").getInstance();
        if (plugin != null) {
            JSObject data = new JSObject();
            data.put("triggered", true);
            data.put("timestamp", System.currentTimeMillis());
            data.put("source", "background_service");
            plugin.notifyVolumeButtonsPressed(data);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        VolumeButtonPlugin plugin = (VolumeButtonPlugin) getBridge().getPlugin("VolumeButton").getInstance();
        if (plugin != null && plugin.handleKeyEvent(event)) {
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        VolumeButtonPlugin plugin = (VolumeButtonPlugin) getBridge().getPlugin("VolumeButton").getInstance();
        if (plugin != null && plugin.handleKeyEvent(event)) {
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sosReceiver != null) {
            try {
                unregisterReceiver(sosReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering SOS receiver", e);
            }
        }
        if (wakeWordReceiver != null) {
            try {
                unregisterReceiver(wakeWordReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering wake word receiver", e);
            }
        }
    }
}
