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
                .activityBackgroundTint(Color(red: 0.05, green: 0.05, blue: 0.055))
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

private struct LiveSetView: View {
    var state: WorkoutActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                ExerciseThumb(token: state.imageToken)
                    .frame(width: 58, height: 58)
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.exerciseName)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(2)
                    Text(state.setLabel)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.7))
                }
                Spacer(minLength: 0)
            }
            LiveSetControls(state: state)
        }
        .padding(12)
    }
}

private struct LiveSetControls: View {
    var state: WorkoutActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                stepper(
                    title: "Kg",
                    value: LiveWorkoutFormatting.weight(state.weightKg),
                    down: AdjustWeightIntent(delta: -2.5),
                    up: AdjustWeightIntent(delta: 2.5)
                )
                stepper(
                    title: "Reps",
                    value: "\(state.reps)",
                    down: AdjustRepsIntent(delta: -1),
                    up: AdjustRepsIntent(delta: 1)
                )
            }
            HStack(spacing: 6) {
                Button(intent: LogLiveSetIntent()) {
                    Text(state.setId.isEmpty ? "Logged" : "Log set")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.86, green: 0.15, blue: 0.18))
                .disabled(state.setId.isEmpty)
                Button(intent: NextLiveExerciseIntent()) {
                    Text("Next")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(state.exerciseCount < 2)
            }
            .font(.caption.weight(.semibold))
        }
    }

    private func stepper<Down: AppIntent, Up: AppIntent>(
        title: String,
        value: String,
        down: Down,
        up: Up
    ) -> some View {
        HStack(spacing: 0) {
            Button(intent: down) {
                Image(systemName: "minus")
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.bordered)
            VStack(spacing: 0) {
                Text(title.uppercased())
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                Text(value)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            Button(intent: up) {
                Image(systemName: "plus")
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.bordered)
        }
    }
}

private struct ExerciseThumb: View {
    var token: Int

    var body: some View {
        Group {
            if let image = LiveWorkoutStore.thumbnail() {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
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
