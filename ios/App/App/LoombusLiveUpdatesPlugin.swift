import ActivityKit
import Capacitor
import Foundation
import UIKit

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
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

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
