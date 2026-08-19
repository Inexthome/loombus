package com.loombus.app;

import android.app.Activity;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CreatePasswordRequest;
import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CredentialManager;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.CredentialManagerCallback;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LoombusPasswordManager")
public class LoombusPasswordManagerPlugin extends Plugin {

    @PluginMethod
    public void savePassword(PluginCall call) {
        String email = call.getString("email");
        String password = call.getString("password");
        Activity activity = getActivity();

        if (email == null || email.trim().isEmpty()) {
            call.reject("Email is required.");
            return;
        }
        if (password == null || password.isEmpty()) {
            call.reject("Password is required.");
            return;
        }
        if (activity == null) {
            call.reject("Android could not open Google Password Manager.");
            return;
        }

        CredentialManager credentialManager = CredentialManager.create(getContext());
        CreatePasswordRequest request = new CreatePasswordRequest(email.trim(), password);

        credentialManager.createCredentialAsync(
            activity,
            request,
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                @Override
                public void onResult(CreateCredentialResponse result) {
                    JSObject response = new JSObject();
                    response.put("saved", true);
                    call.resolve(response);
                }

                @Override
                public void onError(CreateCredentialException error) {
                    String message = error.getMessage();
                    call.reject(
                        message == null || message.isEmpty()
                            ? "Google Password Manager did not save this login."
                            : message
                    );
                }
            }
        );
    }

    @PluginMethod
    public void clearCredentialState(PluginCall call) {
        CredentialManager credentialManager = CredentialManager.create(getContext());
        credentialManager.clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    JSObject response = new JSObject();
                    response.put("cleared", true);
                    call.resolve(response);
                }

                @Override
                public void onError(ClearCredentialException error) {
                    String message = error.getMessage();
                    call.reject(
                        message == null || message.isEmpty()
                            ? "Android credential-provider state could not be cleared."
                            : message
                    );
                }
            }
        );
    }
}
