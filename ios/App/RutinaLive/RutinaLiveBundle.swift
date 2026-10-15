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
            LiveSetView(state: context.state)
                .padding(.vertical, 6)
                .activityBackgroundTint(LivePalette.background)
                .activitySystemActionForegroundColor(.white)
                .widgetURL(LiveWorkoutLink.url)
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
                }
                DynamicIslandExpandedRegion(.trailing) {
                    LiveCornerButton(state: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    LiveActivityLoad(state: context.state)
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill")
            } compactTrailing: {
                if let range = restRange(until: context.state.restEndsAt) {
                    Text(timerInterval: range, countsDown: true)
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                        .frame(width: 46)
                } else {
                    Text(LiveWorkoutFormatting.weight(context.state.weightKg))
                        .font(.caption.weight(.semibold))
                }
            } minimal: {
                Image(systemName: "dumbbell.fill")
            }
            .widgetURL(LiveWorkoutLink.url)
        }
    }
}

private enum LiveWorkoutLink {
    static let url = URL(string: "rutina://dashboard/workout/live")
}

private func restRange(until end: Date?) -> ClosedRange<Date>? {
    guard let end else { return nil }
    let now = Date()
    guard end > now else { return nil }
    return now...end
}

private enum LivePalette {
    static let background = Color(red: 22 / 255, green: 22 / 255, blue: 24 / 255)
    static let control = Color(red: 58 / 255, green: 58 / 255, blue: 62 / 255)
    static let red = Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)
    static let secondary = Color.white.opacity(0.55)
}

private struct LiveSetView: View {
    var state: WorkoutActivityAttributes.ContentState

    var body: some View {
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
                Spacer(minLength: 8)
                LiveCornerButton(state: state)
            }
            LiveActivityLoad(state: state)
        }
        .padding(.horizontal, 16)
        .padding(.top, 18)
        .padding(.bottom, 18)
    }
}

private struct LiveCornerButton: View {
    var state: WorkoutActivityAttributes.ContentState

    var body: some View {
        if state.isResting {
            Button(intent: SkipLiveRestIntent()) {
                Text("Skip")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(LivePalette.control))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Skip rest")
        } else if !state.setId.isEmpty {
            Button(intent: LogLiveSetIntent()) {
                Text("Log set")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(LivePalette.red))
            }
            .buttonStyle(.plain)
        }
    }
}

private struct LiveActivityLoad: View {
    var state: WorkoutActivityAttributes.ContentState

    var body: some View {
        if let end = state.restEndsAt {
            TimelineView(.explicit([end])) { _ in
                if end.timeIntervalSinceNow > 0, let range = restRange(until: end) {
                    RestCountdown(range: range)
                } else {
                    LiveSetMetrics(state: state)
                }
            }
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
            metric(title: "KG", value: LiveWorkoutFormatting.weight(state.weightKg)) {
                Button(intent: AdjustWeightIntent(tenths: -25)) {
                    StepIcon(systemName: "minus")
                }
                .liveCircle()
                .accessibilityLabel("Decrease weight")
            } up: {
                Button(intent: AdjustWeightIntent(tenths: 25)) {
                    StepIcon(systemName: "plus")
                }
                .liveCircle()
                .accessibilityLabel("Increase weight")
            }
            metric(title: "REPS", value: "\(state.reps)") {
                Button(intent: AdjustRepsIntent(delta: -1)) {
                    StepIcon(systemName: "minus")
                }
                .liveCircle()
                .accessibilityLabel("Decrease reps")
            } up: {
                Button(intent: AdjustRepsIntent(delta: 1)) {
                    StepIcon(systemName: "plus")
                }
                .liveCircle()
                .accessibilityLabel("Increase reps")
            }
        }
    }

    private func metric<Down: View, Up: View>(
        title: String,
        value: String,
        @ViewBuilder down: () -> Down,
        @ViewBuilder up: () -> Up
    ) -> some View {
        HStack(spacing: 0) {
            down()
            VStack(spacing: 1) {
                Text(title)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(LivePalette.secondary)
                    .tracking(0.6)
                Text(value)
                    .font(.system(size: 20, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            up()
        }
        .padding(4)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

private struct StepIcon: View {
    var systemName: String

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 22, height: 22)
    }
}

private extension View {
    func liveCircle() -> some View {
        buttonStyle(.plain)
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
