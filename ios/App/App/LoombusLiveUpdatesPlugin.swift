import ActivityKit
import Capacitor
import Foundation
import UIKit
import UserNotifications

@objc(LoombusLiveUpdatesPlugin)
public class LoombusLiveUpdatesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LoombusLiveUpdatesPlugin"
    public let jsName = "LoombusLiveUpdates"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startAppointment", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateAppointment", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAppointment", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAllAppointments", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNotificationBadgeCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise)
    ]

    @objc func share(_ call: CAPPluginCall) {
        let title = call.getString("title")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let text = call.getString("text")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let urlString = call.getString("url")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        var items: [Any] = []
        if !title.isEmpty { items.append(title) }
        if !text.isEmpty { items.append(text) }
        if !urlString.isEmpty, let url = URL(string: urlString) { items.append(url) }

        guard !items.isEmpty else {
            call.reject("Share requires a title, text, or URL.")
            return
        }

        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("Unable to present the iOS share sheet.")
                return
            }

            let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
            if let popover = controller.popoverPresentationController {
                popover.sourceView = viewController.view
                popover.sourceRect = CGRect(
                    x: viewController.view.bounds.midX,
                    y: viewController.view.bounds.midY,
                    width: 1,
                    height: 1
                )
                popover.permittedArrowDirections = []
            }
            controller.completionWithItemsHandler = { _, completed, _, error in
                if let error {
                    call.reject("Unable to share from Loombus: \(error.localizedDescription)")
                    return
                }
                call.resolve(["completed": completed])
            }
            viewController.present(controller, animated: true)
        }
    }

    @objc func haptic(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "light"
        DispatchQueue.main.async {
            switch style {
            case "success":
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "warning":
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
            case "error":
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            case "medium":
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "heavy":
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            default:
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            call.resolve()
        }
    }

    @objc func setNotificationBadgeCount(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)

        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { error in
                if let error {
                    call.reject("Unable to update the iOS notification badge: \(error.localizedDescription)")
                    return
                }
                call.resolve(["count": count, "applied": true])
            }
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = count
            call.resolve(["count": count, "applied": true])
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve([
                "supported": false,
                "reason": "iOS 16.2 or later is required.",
                "activeAppointmentIds": []
            ])
            return
        }

        let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
        call.resolve([
            "supported": enabled,
            "reason": enabled ? "" : "Live Activities are disabled in iOS Settings.",
            "activeAppointmentIds": Activity<LoombusAppointmentAttributes>.activities.map {
                $0.attributes.appointmentId
            }
        ])
    }

    @objc func startAppointment(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2 or later.")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are disabled in iOS Settings.")
            return
        }
        guard let input = appointmentInput(call) else { return }

        Task {
            for activity in Activity<LoombusAppointmentAttributes>.activities
                where activity.attributes.appointmentId == input.id {
                await activity.end(nil, dismissalPolicy: .immediate)
            }

            do {
                let attributes = LoombusAppointmentAttributes(
                    appointmentId: input.id,
                    href: input.href
                )
                let content = ActivityContent(
                    state: input.state,
                    staleDate: input.endsAt
                )
                let activity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                call.resolve(["activityId": activity.id])
            } catch {
                call.reject("Unable to start the appointment Live Activity: \(error.localizedDescription)")
            }
        }
    }

    @objc func updateAppointment(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2 or later.")
            return
        }
        guard let input = appointmentInput(call) else { return }

        Task {
            let matches = Activity<LoombusAppointmentAttributes>.activities.filter {
                $0.attributes.appointmentId == input.id
            }
            for activity in matches {
                await activity.update(
                    ActivityContent(state: input.state, staleDate: input.endsAt)
                )
            }
            call.resolve(["updated": matches.count])
        }
    }

    @objc func endAppointment(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ended": 0])
            return
        }
        guard let appointmentId = call.getString("appointmentId"), !appointmentId.isEmpty else {
            call.reject("appointmentId is required.")
            return
        }

        Task {
            let matches = Activity<LoombusAppointmentAttributes>.activities.filter {
                $0.attributes.appointmentId == appointmentId
            }
            for activity in matches {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve(["ended": matches.count])
        }
    }

    @objc func endAllAppointments(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ended": 0])
            return
        }

        Task {
            let activities = Activity<LoombusAppointmentAttributes>.activities
            for activity in activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve(["ended": activities.count])
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            call.reject("Unable to open iOS Settings.")
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.open(settingsUrl) { opened in
                if opened {
                    call.resolve()
                } else {
                    call.reject("Unable to open iOS Settings.")
                }
            }
        }
    }

    @available(iOS 16.2, *)
    private func appointmentInput(_ call: CAPPluginCall) -> (
        id: String,
        href: String,
        endsAt: Date,
        state: LoombusAppointmentAttributes.ContentState
    )? {
        guard let appointmentId = call.getString("appointmentId"), !appointmentId.isEmpty,
              let title = call.getString("title"), !title.isEmpty,
              let context = call.getString("context"),
              let status = call.getString("status"),
              let startsAtMilliseconds = call.getDouble("startsAt"),
              let endsAtMilliseconds = call.getDouble("endsAt") else {
            call.reject("appointmentId, title, context, status, startsAt, and endsAt are required.")
            return nil
        }

        let startsAt = Date(timeIntervalSince1970: startsAtMilliseconds / 1000)
        let endsAt = Date(timeIntervalSince1970: endsAtMilliseconds / 1000)
        guard endsAt > startsAt else {
            call.reject("The appointment end time must be after its start time.")
            return nil
        }

        let href = call.getString("href") ?? "loombus://appointments"
        return (
            appointmentId,
            href,
            endsAt,
            LoombusAppointmentAttributes.ContentState(
                title: title,
                context: context,
                status: status,
                startsAt: startsAt,
                endsAt: endsAt
            )
        )
    }
}
