package com.coldstar.plugins;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {

    private static final String TAG = "BiometricAuth";

    @PluginMethod()
    public void isAvailable(PluginCall call) {
        Context context = getContext();
        BiometricManager biometricManager = BiometricManager.from(context);

        int canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        );

        JSObject result = new JSObject();
        result.put("available", canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(result);
    }

    @PluginMethod()
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Authenticate");
        String subtitle = call.getString("subtitle", "Use your fingerprint");

        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        Executor executor = ContextCompat.getMainExecutor(activity);

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("Cancel")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build();

        activity.runOnUiThread(() -> {
            BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(
                            @NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        Log.d(TAG, "Authentication succeeded");
                        call.resolve();
                    }

                    @Override
                    public void onAuthenticationError(int errorCode,
                            @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        Log.w(TAG, "Authentication error: " + errString);
                        call.reject(errString.toString(), String.valueOf(errorCode));
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        Log.w(TAG, "Authentication failed (bad fingerprint)");
                        // Don't reject here — BiometricPrompt lets the user retry
                    }
                });

            biometricPrompt.authenticate(promptInfo);
        });
    }
}
