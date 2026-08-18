import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct LoombusAppointmentAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let title: String
        let context: String
        let status: String
        let startsAt: Date
        let endsAt: Date
    }

    let appointmentId: String
    let href: String
}
