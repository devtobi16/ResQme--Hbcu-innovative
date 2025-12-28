package app.lovable;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WakeWord")
public class WakeWordPlugin extends Plugin {
    private static final String TAG = "WakeWordPlugin";
    private BroadcastReceiver wakeWordReceiver;

    @Override
    public void load() {
        super.load();
        setupBroadcastReceiver();
    }

    private void setupBroadcastReceiver() {
        wakeWordReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (WakeWordService.ACTION_WAKE_WORD_DETECTED.equals(intent.getAction())) {
                    String wakeWord = intent.getStringExtra("wake_word");
                    String action = intent.getStringExtra("action");
                    
                    JSObject data = new JSObject();
                    data.put("wakeWord", wakeWord != null ? wakeWord : "resqme");
                    data.put("action", action != null ? action : "start_recognition");
                    
                    notifyListeners("wakeWordDetected", data);
                    Log.d(TAG, "Wake word event broadcast to JS: " + wakeWord);
                }
            }
        };

        IntentFilter filter = new IntentFilter(WakeWordService.ACTION_WAKE_WORD_DETECTED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(wakeWordReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(wakeWordReceiver, filter);
        }
    }

    @PluginMethod
    public void startService(PluginCall call) {
        String wakeWord = call.getString("wakeWord", WakeWordService.DEFAULT_WAKE_WORD);
        
        try {
            Intent serviceIntent = new Intent(getContext(), WakeWordService.class);
            serviceIntent.putExtra("wake_word", wakeWord);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            
            // Save setting
            SharedPreferences prefs = getContext().getSharedPreferences(
                WakeWordService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString(WakeWordService.PREF_WAKE_WORD, wakeWord)
                .putBoolean(WakeWordService.PREF_WAKE_WORD_ENABLED, true)
                .apply();
            
            Log.d(TAG, "WakeWord service started with word: " + wakeWord);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start WakeWord service", e);
            call.reject("Failed to start service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), WakeWordService.class);
            getContext().stopService(serviceIntent);
            
            // Save setting
            SharedPreferences prefs = getContext().getSharedPreferences(
                WakeWordService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(WakeWordService.PREF_WAKE_WORD_ENABLED, false).apply();
            
            Log.d(TAG, "WakeWord service stopped");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop WakeWord service", e);
            call.reject("Failed to stop service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updateWakeWord(PluginCall call) {
        String wakeWord = call.getString("wakeWord");
        if (wakeWord == null || wakeWord.isEmpty()) {
            call.reject("Wake word is required");
            return;
        }

        try {
            Intent updateIntent = new Intent(getContext(), WakeWordService.class);
            updateIntent.setAction("UPDATE_WAKE_WORD");
            updateIntent.putExtra("wake_word", wakeWord);
            getContext().startService(updateIntent);
            
            // Save setting
            SharedPreferences prefs = getContext().getSharedPreferences(
                WakeWordService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(WakeWordService.PREF_WAKE_WORD, wakeWord).apply();
            
            Log.d(TAG, "Wake word updated to: " + wakeWord);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to update wake word", e);
            call.reject("Failed to update wake word: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getSettings(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            WakeWordService.PREFS_NAME, Context.MODE_PRIVATE);
        
        String wakeWord = prefs.getString(WakeWordService.PREF_WAKE_WORD, 
            WakeWordService.DEFAULT_WAKE_WORD);
        boolean enabled = prefs.getBoolean(WakeWordService.PREF_WAKE_WORD_ENABLED, false);
        
        JSObject result = new JSObject();
        result.put("wakeWord", wakeWord);
        result.put("enabled", enabled);
        
        call.resolve(result);
    }

    @PluginMethod
    public void isServiceRunning(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            WakeWordService.PREFS_NAME, Context.MODE_PRIVATE);
        boolean running = prefs.getBoolean(WakeWordService.PREF_WAKE_WORD_ENABLED, false);
        
        JSObject result = new JSObject();
        result.put("running", running);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        if (wakeWordReceiver != null) {
            try {
                getContext().unregisterReceiver(wakeWordReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver", e);
            }
        }
        super.handleOnDestroy();
    }
}
