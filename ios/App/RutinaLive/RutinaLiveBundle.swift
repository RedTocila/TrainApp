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
                .activityBackgroundTint(LivePalette.background)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ExerciseThumb(token: context.state.imageToken)
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
                DynamicIslandExpandedRegion(.bottom) {
                    LiveSetControls(state: context.state)
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill")
            } compactTrailing: {
                Text(LiveWorkoutFormatting.weight(context.state.weightKg))
                    .font(.caption.weight(.semibold))
            } minimal: {
                Image(systemName: "dumbbell.fill")
            }
        }
    }
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
                ExerciseThumb(token: state.imageToken)
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
                Spacer(minLength: 0)
            }
            LiveSetControls(state: state)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }
}

private struct LiveSetControls: View {
    var state: WorkoutActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 8) {
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
            HStack(spacing: 8) {
                Button(intent: LogLiveSetIntent()) {
                    Text(state.setId.isEmpty ? "Logged" : "Log set")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(Capsule().fill(state.setId.isEmpty ? LivePalette.control : LivePalette.red))
                }
                .buttonStyle(.plain)
                .disabled(state.setId.isEmpty)
                Button(intent: NextLiveExerciseIntent()) {
                    Text("Next")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(Capsule().fill(LivePalette.control))
                        .opacity(state.exerciseCount < 2 ? 0.45 : 1)
                }
                .buttonStyle(.plain)
                .disabled(state.exerciseCount < 2)
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
            .frame(width: 22, height: 22)
    }
}

private extension View {
    func liveCircle() -> some View {
        buttonStyle(.borderedProminent)
            .buttonBorderShape(.circle)
            .controlSize(.regular)
            .tint(LivePalette.control)
    }
}

private struct ExerciseThumb: View {
    var token: Int

    var body: some View {
        Group {
            if let image = LiveWorkoutStore.thumbnail() {
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
        .id(token)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}
