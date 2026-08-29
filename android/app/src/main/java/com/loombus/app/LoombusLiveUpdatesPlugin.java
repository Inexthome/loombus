package com.loombus.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.Set;

@CapacitorPlugin(name = "LoombusLiveUpdates")
public class LoombusLiveUpdatesPlugin extends Plugin {

    private static final String CHANNEL_ID = "loombus_appointment_live_updates";
    private static final String ACTIVE_IDS_KEY = "active_appointment_ids";
    private static final String PREFERENCES = "loombus_live_updates";

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
    }

    @PluginMethod
    public void setNotificationBadgeCount(PluginCall call) {
        Integer requestedCount = call.getInt("count");
        int count = Math.max(0, requestedCount == null ? 0 : requestedCount);
        JSObject result = new JSObject();
        result.put("count", count);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            result.put("applied", false);
            call.resolve(result);
            return;
        }

        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager == null) {
            result.put("applied", false);
            call.resolve(result);
            return;
        }

        StatusBarNotification[] activeNotifications = manager.getActiveNotifications();
        Set<String> activeAppointmentIds = activeAppointmentIds();
        StatusBarNotification newestPushNotification = null;

        for (StatusBarNotification activeNotification : activeNotifications) {
            if (isAppointmentLiveUpdateNotification(activeNotification.getId(), activeAppointmentIds)) {
                continue;
            }

            if (count == 0) {
                cancelNotification(manager, activeNotification);
                continue;
            }

            if (
                newestPushNotification == null ||
                activeNotification.getPostTime() > newestPushNotification.getPostTime()
            ) {
                newestPushNotification = activeNotification;
            }
        }

        if (count > 0 && newestPushNotification != null) {
            Notification notification = newestPushNotification.getNotification();
            notification.number = count;
            notifyExisting(manager, newestPushNotification, notification);
            result.put("applied", true);
        } else {
            result.put("applied", count == 0);
        }

        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", notificationsAllowed());
        result.put("reason", notificationsAllowed() ? "" : "Notifications are disabled in Android Settings.");
        result.put("promotionEnabled", promotedNotificationsAllowed());
        result.put("activeAppointmentIds", new JSArray(activeAppointmentIds()));
        call.resolve(result);
    }

    @PluginMethod
    public void startAppointment(PluginCall call) {
        postAppointment(call);
    }

    @PluginMethod
    public void updateAppointment(PluginCall call) {
        postAppointment(call);
    }

    @PluginMethod
    public void endAppointment(PluginCall call) {
        String appointmentId = call.getString("appointmentId");
        if (appointmentId == null || appointmentId.isEmpty()) {
            call.reject("appointmentId is required.");
            return;
        }

        NotificationManagerCompat.from(getContext()).cancel(notificationId(appointmentId));
        Set<String> activeIds = activeAppointmentIds();
        activeIds.remove(appointmentId);
        saveActiveAppointmentIds(activeIds);
        JSObject result = new JSObject();
        result.put("ended", 1);
        call.resolve(result);
    }

    @PluginMethod
    public void endAllAppointments(PluginCall call) {
        Set<String> activeIds = activeAppointmentIds();
        NotificationManagerCompat manager = NotificationManagerCompat.from(getContext());
        for (String appointmentId : activeIds) {
            manager.cancel(notificationId(appointmentId));
        }
        saveActiveAppointmentIds(Collections.emptySet());
        JSObject result = new JSObject();
        result.put("ended", activeIds.size());
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= 36) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS);
        } else {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        }
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            Intent fallback = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            fallback.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception fallbackError) {
                call.reject("Unable to open Android notification settings.", fallbackError);
            }
        }
    }

    private void postAppointment(PluginCall call) {
        if (!notificationsAllowed()) {
            call.reject("Notifications are disabled in Android Settings.");
            return;
        }

        String appointmentId = call.getString("appointmentId");
        String title = call.getString("title");
        String context = call.getString("context", "Loombus appointment");
        String status = call.getString("status", "Live appointment");
        Long startsAt = call.getLong("startsAt");
        Long endsAt = call.getLong("endsAt");

        if (appointmentId == null || appointmentId.isEmpty() || title == null || title.isEmpty() || startsAt == null || endsAt == null) {
            call.reject("appointmentId, title, startsAt, and endsAt are required.");
            return;
        }
        if (endsAt <= startsAt) {
            call.reject("The appointment end time must be after its start time.");
            return;
        }

        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.putExtra(MainActivity.LOOMBUS_DESTINATION_EXTRA, "/appointments");
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            getContext(),
            notificationId(appointmentId),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        long now = System.currentTimeMillis();
        long timerTarget = now < startsAt ? startsAt : endsAt;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_loombus_live_update)
            .setContentTitle(title)
            .setContentText(status + " · " + context)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setAutoCancel(false)
            .setShowWhen(true)
            .setWhen(timerTarget)
            .setUsesChronometer(true)
            .setChronometerCountDown(now < startsAt)
            .setPriority(NotificationCompat.PRIORITY_HIGH);

        if (Build.VERSION.SDK_INT >= 36) {
            builder.setRequestPromotedOngoing(true);
        }

        NotificationManagerCompat.from(getContext()).notify(notificationId(appointmentId), builder.build());
        Set<String> activeIds = activeAppointmentIds();
        activeIds.add(appointmentId);
        saveActiveAppointmentIds(activeIds);

        JSObject result = new JSObject();
        result.put("activityId", appointmentId);
        result.put("promotionEnabled", promotedNotificationsAllowed());
        call.resolve(result);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Appointment live updates",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Time-sensitive updates for appointments you choose to follow live.");
        channel.setShowBadge(false);
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private boolean notificationsAllowed() {
        boolean runtimePermission = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        return runtimePermission && NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    private boolean promotedNotificationsAllowed() {
        if (Build.VERSION.SDK_INT < 36) return notificationsAllowed();
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        return manager != null && manager.canPostPromotedNotifications();
    }

    private boolean isAppointmentLiveUpdateNotification(int id, Set<String> activeAppointmentIds) {
        for (String appointmentId : activeAppointmentIds) {
            if (notificationId(appointmentId) == id) return true;
        }
        return false;
    }

    private void cancelNotification(NotificationManager manager, StatusBarNotification notification) {
        String tag = notification.getTag();
        if (tag == null) {
            manager.cancel(notification.getId());
        } else {
            manager.cancel(tag, notification.getId());
        }
    }

    private void notifyExisting(
        NotificationManager manager,
        StatusBarNotification statusBarNotification,
        Notification notification
    ) {
        String tag = statusBarNotification.getTag();
        if (tag == null) {
            manager.notify(statusBarNotification.getId(), notification);
        } else {
            manager.notify(tag, statusBarNotification.getId(), notification);
        }
    }

    private int notificationId(String appointmentId) {
        return 0x4C000000 | (appointmentId.hashCode() & 0x00FFFFFF);
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private Set<String> activeAppointmentIds() {
        return new java.util.HashSet<>(preferences().getStringSet(ACTIVE_IDS_KEY, Collections.emptySet()));
    }

    private void saveActiveAppointmentIds(Set<String> appointmentIds) {
        preferences().edit().putStringSet(ACTIVE_IDS_KEY, new java.util.HashSet<>(appointmentIds)).apply();
    }
}
