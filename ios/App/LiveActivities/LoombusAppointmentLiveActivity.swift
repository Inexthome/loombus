import ActivityKit
import SwiftUI
import WidgetKit

private let loombusGold = Color(red: 203 / 255, green: 171 / 255, blue: 91 / 255)

struct LoombusAppointmentLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LoombusAppointmentAttributes.self) { context in
            HStack(spacing: 14) {
                Image(systemName: "calendar.badge.clock")
                    .font(.title2)
                    .foregroundStyle(loombusGold)
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.state.status)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(loombusGold)
                    Text(context.state.title)
                        .font(.headline)
                        .lineLimit(1)
                    Text(context.state.context)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                appointmentTimer(context.state)
                    .font(.subheadline.monospacedDigit().weight(.semibold))
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.94))
            .activitySystemActionForegroundColor(loombusGold)
            .widgetURL(URL(string: context.attributes.href))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "calendar.badge.clock")
                        .foregroundStyle(loombusGold)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    appointmentTimer(context.state)
                        .font(.caption.monospacedDigit().weight(.semibold))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.title).font(.subheadline.weight(.semibold))
                        Text(context.state.context)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: "calendar")
                    .foregroundStyle(loombusGold)
            } compactTrailing: {
                appointmentTimer(context.state)
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Image(systemName: "calendar")
                    .foregroundStyle(loombusGold)
            }
            .widgetURL(URL(string: context.attributes.href))
            .keylineTint(loombusGold)
        }
    }

    @ViewBuilder
    private func appointmentTimer(
        _ state: LoombusAppointmentAttributes.ContentState
    ) -> some View {
        if Date() < state.startsAt {
            Text(state.startsAt, style: .timer)
        } else {
            Text(state.endsAt, style: .timer)
        }
    }
}
