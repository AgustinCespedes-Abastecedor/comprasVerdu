package com.elabastecedor.comprasverdu;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Refuerzo defensivo: mantener contenido dentro de barras del sistema.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
