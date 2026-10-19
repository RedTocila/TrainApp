import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct RutinaLiveBundle: WidgetBundle {
    var body: some Widget {
        WorkoutLiveActivity()
    }
}

struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            LiveSetView(state: context.state, isStale: context.isStale)
                .padding(.vertical, 6)
                .activityBackgroundTint(LivePalette.background)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ExerciseThumb(index: context.state.exerciseIndex, token: context.state.imageToken)
                        .frame(width: 44, height: 44)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.exerciseName)
                            .font(.headline)
                            .lineLimit(1)
                        Text(context.state.setLabel)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .widgetURL(LiveWorkoutLink.url)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RestAware(endsAt: context.state.restEndsAt, isStale: context.isStale) { resting in
                        LiveCornerButton(state: context.state, resting: resting)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    RestAware(endsAt: context.state.restEndsAt, isStale: context.isStale) { resting in
                        LiveActivityLoad(state: context.state, resting: resting)
                    }
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill")
                    .widgetURL(LiveWorkoutLink.url)
            } compactTrailing: {
                RestAware(endsAt: context.state.restEndsAt, isStale: context.isStale) { resting in
                    if resting, let end = context.state.restEndsAt {
                        Text(timerInterval: countdownRange(until: end), countsDown: true)
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .frame(width: 46)
                    } else {
                        Text(LiveWorkoutFormatting.weight(context.state.weightKg))
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .contentTransition(.identity)
                    }
                }
                .widgetURL(LiveWorkoutLink.url)
            } minimal: {
                Image(systemName: "dumbbell.fill")
                    .widgetURL(LiveWorkoutLink.url)
            }
        }
    }
}

private enum LiveWorkoutLink {
    static let url = URL(string: "rutina://dashboard/workout/live")
}

/// Widget `Date()` stays frozen at the last activity update, so rest must
/// switch off the timeline date (and the stale flag), not `timeIntervalSinceNow`.
private struct RestAware<Content: View>: View {
    var endsAt: Date?
    var isStale: Bool
    @ViewBuilder var content: (Bool) -> Content

    var body: some View {
        if let endsAt, !isStale {
            TimelineView(.explicit(Self.entries(until: endsAt))) { timeline in
                content(timeline.date < endsAt)
            }
        } else {
            content(false)
        }
    }

    private static func entries(until end: Date) -> [Date] {
        let now = Date()
        if now >= end { return [now] }
        return [now, end, end.addingTimeInterval(1)]
    }
}

private func countdownRange(until end: Date) -> ClosedRange<Date> {
    let start = min(Date(), end.addingTimeInterval(-1))
    return start...end
}

private enum LivePalette {
    static let background = Color(red: 22 / 255, green: 22 / 255, blue: 24 / 255)
    static let control = Color(red: 58 / 255, green: 58 / 255, blue: 62 / 255)
    static let red = Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)
    static let secondary = Color.white.opacity(0.55)
}

private struct LiveSetView: View {
    var state: WorkoutActivityAttributes.ContentState
    var isStale: Bool

    var body: some View {
        RestAware(endsAt: state.restEndsAt, isStale: isStale) { resting in
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .center, spacing: 10) {
                    ExerciseThumb(index: state.exerciseIndex, token: state.imageToken)
                        .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(state.exerciseName)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                        Text(state.setLabel)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(LivePalette.secondary)
                    }
                    .widgetURL(LiveWorkoutLink.url)
                    Spacer(minLength: 8)
                    LiveCornerButton(state: state, resting: resting)
                }
                LiveActivityLoad(state: state, resting: resting)
            }
            .padding(.horizontal, 14)
            .padding(.top, 18)
            .padding(.bottom, 18)
            .padding(.trailing, 2)
        }
    }
}

private struct LiveCornerButton: View {
    var state: WorkoutActivityAttributes.ContentState
    var resting: Bool

    var body: some View {
        if resting {
            Button(intent: SkipLiveRestIntent()) {
                Text("Skip")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(LivePalette.control))
            }
            .buttonStyle(LiveScaleStyle())
            .accessibilityLabel("Skip rest")
        } else if !state.setId.isEmpty {
            Button(intent: LogLiveSetIntent()) {
                Image(systemName: "checkmark")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(LivePalette.red))
            }
            .buttonStyle(LiveScaleStyle())
            .accessibilityLabel("Log set")
        }
    }
}

private struct LiveActivityLoad: View {
    var state: WorkoutActivityAttributes.ContentState
    var resting: Bool

    var body: some View {
        if resting, let end = state.restEndsAt {
            RestCountdown(range: countdownRange(until: end))
        } else {
            LiveSetMetrics(state: state)
        }
    }
}

private struct RestCountdown: View {
    var range: ClosedRange<Date>

    var body: some View {
        VStack(spacing: 2) {
            Text("REST")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(LivePalette.secondary)
                .tracking(0.8)
            Text(timerInterval: range, countsDown: true)
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }
}

private struct LiveSetMetrics: View {
    var state: WorkoutActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 8) {
            metric(
                title: "KG",
                value: LiveWorkoutFormatting.weight(state.weightKg),
                downPreview: steppedWeight(-2.5),
                upPreview: steppedWeight(2.5),
                down: AdjustWeightIntent(tenths: -25),
                up: AdjustWeightIntent(tenths: 25),
                downLabel: "Decrease weight",
                upLabel: "Increase weight",
                space: "liveMetricKG"
            )
            metric(
                title: "REPS",
                value: "\(state.reps)",
                downPreview: "\(steppedReps(-1))",
                upPreview: "\(steppedReps(1))",
                down: AdjustRepsIntent(delta: -1),
                up: AdjustRepsIntent(delta: 1),
                downLabel: "Decrease reps",
                upLabel: "Increase reps",
                space: "liveMetricReps"
            )
        }
        .animation(nil, value: state.reps)
        .animation(nil, value: state.weightKg)
    }

    private func steppedWeight(_ delta: Double) -> String {
        let next = min(200, max(0, state.weightKg + delta))
        return LiveWorkoutFormatting.weight((next * 10).rounded() / 10)
    }

    private func steppedReps(_ delta: Int) -> Int {
        min(40, max(1, state.reps + delta))
    }

    private func metric(
        title: String,
        value: String,
        downPreview: String,
        upPreview: String,
        down: some AppIntent,
        up: some AppIntent,
        downLabel: String,
        upLabel: String,
        space: String
    ) -> some View {
        GeometryReader { geo in
            let center = geo.size.width / 2
            HStack(spacing: 0) {
                Button(intent: down) {
                    StepIcon(systemName: "minus")
                }
                .buttonStyle(LivePressStyle(preview: downPreview, numberCenterX: center, space: space))
                .zIndex(1)
                .accessibilityLabel(downLabel)
                VStack(spacing: 1) {
                    Text(title)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(LivePalette.secondary)
                        .tracking(0.6)
                    Text(value)
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                        .contentTransition(.identity)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .transaction { transaction in
                            transaction.animation = nil
                            transaction.disablesAnimations = true
                        }
                }
                .frame(maxWidth: .infinity)
                .allowsHitTesting(false)
                Button(intent: up) {
                    StepIcon(systemName: "plus")
                }
                .buttonStyle(LivePressStyle(preview: upPreview, numberCenterX: center, space: space))
                .zIndex(1)
                .accessibilityLabel(upLabel)
            }
            .padding(4)
            .frame(width: geo.size.width, height: geo.size.height)
            .coordinateSpace(name: space)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .frame(height: 50)
    }
}

/// Shrinks on touch, and draws the next number over the middle while the card catches up.
private struct LivePressStyle: ButtonStyle {
    var preview: String
    var numberCenterX: CGFloat
    var space: String

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.84 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.62), value: configuration.isPressed)
            .overlay {
                GeometryReader { geo in
                    let frame = geo.frame(in: .named(space))
                    LivePreviewNumber(text: preview)
                        .position(
                            x: numberCenterX - frame.minX,
                            y: geo.size.height / 2 + 7
                        )
                        .opacity(configuration.isPressed ? 1 : 0)
                        .transaction { transaction in
                            transaction.animation = nil
                            transaction.disablesAnimations = true
                        }
                }
                .allowsHitTesting(false)
            }
    }
}

private struct LiveScaleStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.86 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.62), value: configuration.isPressed)
    }
}

private struct LivePreviewNumber: View {
    var text: String

    var body: some View {
        Text(text)
            .font(.system(size: 20, weight: .semibold, design: .rounded))
            .foregroundStyle(.white)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, 8)
            .frame(minWidth: 52)
            .background {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(LivePalette.background)
                    .overlay {
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(Color.white.opacity(0.06))
                    }
            }
    }
}

private struct StepIcon: View {
    var systemName: String

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 42, height: 42)
            .background(Circle().fill(LivePalette.control))
            .contentShape(Circle())
    }
}

private struct ExerciseThumb: View {
    var index: Int
    var token: Int

    var body: some View {
        Group {
            if let image = LiveWorkoutStore.thumbnail(at: index) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding(3)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.white)
            } else {
                Image(systemName: "dumbbell.fill")
                    .font(.title3)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.white.opacity(0.08))
            }
        }
        .id("\(index)-\(token)")
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}
