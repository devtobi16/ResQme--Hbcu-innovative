package app.lovable;

import android.Manifest;
import android.content.pm.PackageManager;
import android.telephony.SmsManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "NativeSms",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.SEND_SMS }
        )
    }
)
public class NativeSmsPlugin extends Plugin {
    private static final int SMS_PERMISSION_REQUEST = 1001;
    private PluginCall pendingCall;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message");

        if (phoneNumber == null || message == null) {
            call.reject("Phone number and message are required");
            return;
        }

        if (!hasPermission()) {
            pendingCall = call;
            requestPermission();
            return;
        }

        try {
            sendSmsMessage(phoneNumber, message);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void sendMultipleSms(PluginCall call) {
        JSArray messagesArray = call.getArray("messages");
        
        if (messagesArray == null) {
            call.reject("Messages array is required");
            return;
        }

        if (!hasPermission()) {
            pendingCall = call;
            requestPermission();
            return;
        }

        ArrayList<JSObject> results = new ArrayList<>();
        int successCount = 0;
        int failedCount = 0;

        try {
            for (int i = 0; i < messagesArray.length(); i++) {
                JSONObject msgObj = messagesArray.getJSONObject(i);
                String phoneNumber = msgObj.getString("phoneNumber");
                String message = msgObj.getString("message");

                JSObject result = new JSObject();
                result.put("phoneNumber", phoneNumber);

                try {
                    sendSmsMessage(phoneNumber, message);
                    result.put("success", true);
                    successCount++;
                } catch (Exception e) {
                    result.put("success", false);
                    result.put("error", e.getMessage());
                    failedCount++;
                }
                results.add(result);
            }
        } catch (JSONException e) {
            call.reject("Invalid messages format");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("successCount", successCount);
        ret.put("failedCount", failedCount);
        
        JSArray resultsArray = new JSArray();
        for (JSObject r : results) {
            resultsArray.put(r);
        }
        ret.put("results", resultsArray);
        
        call.resolve(ret);
    }

    private boolean hasPermission() {
        return ContextCompat.checkSelfPermission(
            getContext(), 
            Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestPermission() {
        ActivityCompat.requestPermissions(
            getActivity(),
            new String[] { Manifest.permission.SEND_SMS },
            SMS_PERMISSION_REQUEST
        );
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (hasPermission()) {
            // Re-run the original method
            if (call.getMethodName().equals("sendSms")) {
                sendSms(call);
            } else if (call.getMethodName().equals("sendMultipleSms")) {
                sendMultipleSms(call);
            }
        } else {
            call.reject("SMS permission denied");
        }
    }

    private void sendSmsMessage(String phoneNumber, String message) throws Exception {
        SmsManager smsManager = SmsManager.getDefault();
        
        // Split message if too long
        ArrayList<String> parts = smsManager.divideMessage(message);
        
        if (parts.size() > 1) {
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
        } else {
            smsManager.sendTextMessage(phoneNumber, null, message, null, null);
        }
    }
}
