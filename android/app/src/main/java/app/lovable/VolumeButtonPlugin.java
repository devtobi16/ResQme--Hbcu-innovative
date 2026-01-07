package app.lovable;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.KeyEvent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VolumeButton")
public class VolumeButtonPlugin extends Plugin {
    private boolean volumeUpPressed = false;
    private boolean volumeDownPressed = false;
    private long lastVolumeUpTime = 0;
    private long lastVolumeDownTime = 0;
    private static final long SIMULTANEOUS_THRESHOLD = 500; // 500ms window (match background service)

    public boolean handleKeyEvent(KeyEvent event) {
        int action = event.getAction();
        int keyCode = event.getKeyCode();
        long currentTime = System.currentTimeMillis();

        if (action == KeyEvent.ACTION_DOWN) {
            if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                volumeUpPressed = true;
                lastVolumeUpTime = currentTime;
                checkSimultaneousPress();
                return true;
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                volumeDownPressed = true;
                lastVolumeDownTime = currentTime;
                checkSimultaneousPress();
                return true;
            }
        } else if (action == KeyEvent.ACTION_UP) {
            if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                volumeUpPressed = false;
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                volumeDownPressed = false;
            }
        }

        return false;
    }

    private void checkSimultaneousPress() {
        long timeDiff = Math.abs(lastVolumeUpTime - lastVolumeDownTime);
        
        if (volumeUpPressed && volumeDownPressed && timeDiff < SIMULTANEOUS_THRESHOLD) {
            // Both buttons pressed within threshold
            JSObject ret = new JSObject();
            ret.put("triggered", true);
            ret.put("timestamp", System.currentTimeMillis());
            ret.put("source", "foreground");
            notifyListeners("volumeButtonsPressed", ret);
            
            // Reset states
            volumeUpPressed = false;
            volumeDownPressed = false;
        }
    }

    public void notifyVolumeButtonsPressed(JSObject data) {
        notifyListeners("volumeButtonsPressed", data);
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void startBackgroundService(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, VolumeButtonService.class);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
        
        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopBackgroundService(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, VolumeButtonService.class);
        context.stopService(serviceIntent);
        
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isBackgroundServiceRunning(PluginCall call) {
        // Simple check - in production you'd want a more robust check
        JSObject ret = new JSObject();
        ret.put("running", false); // Would need proper service status check
        call.resolve(ret);
    }
}
