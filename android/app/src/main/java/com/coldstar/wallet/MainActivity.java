package com.coldstar.wallet;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.coldstar.plugins.ColdstarUSBPlugin;
import com.coldstar.plugins.BiometricAuthPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ColdstarUSBPlugin.class);
        registerPlugin(BiometricAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
