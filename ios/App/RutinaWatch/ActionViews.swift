import SwiftUI
import AVFoundation

struct WorkoutWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @State private var reps = 8
    @State private var weight = 20.0

    var body: some View {
        let workout = model.today?.workout
        WatchScreen(title: "Workout") {
            Text(workout?.title ?? "Rest day")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
            if workout?.status == "completed" {
                quiet("Done for today")
            } else if workout?.status == "in_progress" {
                if let name = workout?.exerciseName, let set = workout?.setNumber {
                    WatchCard(fill: WatchTheme.red) {
                        WatchEyebrow(text: "Set \(set)", color: Color.white.opacity(0.75))
                        Text(name)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                        if let target = workout?.targetReps {
                            Text("\(target) reps")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.white.opacity(0.8))
                        }
                    }
                    if workout?.setId != nil {
                        WatchCard {
                            dial("Reps", value: "\(reps)") {
                                reps = max(1, reps - 1)
                            } up: {
                                reps = min(100, reps + 1)
                            }
                        }
                        WatchCard {
                            dial("Kg", value: weightText) {
                                weight = max(0, weight - 2.5)
                            } up: {
                                weight = min(300, weight + 2.5)
                            }
                        }
                        WatchAction(title: "Log set") {
                            Task { await model.logSet(reps: reps, weight: weight) }
                        }
                    } else {
                        quiet("Sets logged")
                    }
                } else if workout?.canLogSets == false {
                    quiet("Open this one on your iPhone.")
                }
                WatchAction(title: "Cancel", prominent: false) {
                    Task { await model.cancelWorkout() }
                }
            } else if workout?.title != nil {
                WatchAction(title: "Start") {
                    Task { await model.startWorkout() }
                }
            } else {
                quiet("Nothing scheduled.")
            }
        }
        .disabled(model.busy)
    }

    private var weightText: String {
        weight.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", weight)
            : String(format: "%.1f", weight)
    }

    private func quiet(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(WatchTheme.mute)
    }

    private func dial(_ label: String, value: String, down: @escaping () -> Void, up: @escaping () -> Void) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                WatchEyebrow(text: label)
                Text(value)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            Spacer()
            stepButton("minus", action: down)
            stepButton("plus", action: up)
        }
    }

    private func stepButton(_ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Circle().fill(Color.white.opacity(0.10)))
        }
        .buttonStyle(.plain)
    }
}

struct CardioWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let cardio = model.today?.cardio
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            WatchScreen(title: "Cardio") {
                Text(cardio?.title ?? "Rest day")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                if cardio?.status == "running" || cardio?.status == "paused" {
                    let planned = max((cardio?.plannedMinutes ?? 1) * 60, 1)
                    ZStack {
                        WatchRing(
                            progress: WatchTheme.fraction(Double(model.cardioElapsed), Double(planned)),
                            size: 112
                        )
                        Text(WatchTheme.clock(model.cardioElapsed))
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                    Text(cardio?.status == "paused" ? "Paused" : "Running")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(1)
                        .foregroundStyle(cardio?.status == "paused" ? WatchTheme.mute : WatchTheme.red)
                        .frame(maxWidth: .infinity)
                    WatchAction(title: "Stop") {
                        Task { await model.stopCardio() }
                    }
                } else if cardio?.completed == true || cardio?.status == "completed" {
                    Text("Done")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                } else if cardio?.status == "none" || cardio == nil {
                    Text("Nothing scheduled.")
                        .font(.system(size: 13))
                        .foregroundStyle(WatchTheme.mute)
                        .frame(maxWidth: .infinity)
                } else {
                    if let minutes = cardio?.plannedMinutes {
                        Text("\(minutes)")
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                        Text("minutes")
                            .font(.system(size: 12))
                            .foregroundStyle(WatchTheme.mute)
                            .frame(maxWidth: .infinity)
                    }
                    WatchAction(title: "Start") {
                        Task { await model.startCardio() }
                    }
                }
            }
        }
        .disabled(model.busy)
    }
}

struct AlexWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @StateObject private var recorder = AlexRecorder()
    @State private var draft = ""
    @State private var reply = ""

    var body: some View {
        WatchScreen(title: "Alex") {
            VStack(spacing: 8) {
                Button {} label: {
                    ZStack {
                        Circle()
                            .fill(recorder.recording ? WatchTheme.red : Color.white)
                            .frame(width: 78, height: 78)
                        Image(systemName: recorder.recording ? "waveform" : "mic.fill")
                            .font(.system(size: 26, weight: .semibold))
                            .foregroundStyle(recorder.recording ? Color.white : Color.black)
                    }
                }
                .buttonStyle(.plain)
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in
                            if !recorder.recording {
                                recorder.start()
                            }
                        }
                        .onEnded { _ in
                            guard let audio = recorder.stop() else { return }
                            Task { await sendAudio(audio) }
                        }
                )
                Text(recorder.recording ? "Listening" : "Hold to talk")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)

            if model.busy && reply.isEmpty {
                Text("Alex is thinking")
                    .font(.system(size: 12))
                    .foregroundStyle(WatchTheme.mute)
                    .frame(maxWidth: .infinity)
            }
            if !reply.isEmpty {
                WatchCard {
                    Text(reply)
                        .font(.system(size: 13))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if let speechError = recorder.errorMessage {
                Text(speechError)
                    .font(.system(size: 11))
                    .foregroundStyle(WatchTheme.red)
            }
            TextField("Or type", text: $draft)
                .font(.system(size: 13))
            WatchAction(title: "Send") {
                Task { await send(draft) }
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.busy)
            .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.35 : 1)
        }
    }

    private func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        reply = ""
        if let answer = await model.askAlex(trimmed) {
            reply = answer
            draft = ""
        }
    }

    private func sendAudio(_ data: Data) async {
        reply = ""
        if let answer = await model.askAlexAudio(data.base64EncodedString()) {
            reply = answer
        }
    }
}

@MainActor
final class AlexRecorder: ObservableObject {
    @Published var recording = false
    @Published var errorMessage: String?

    private var recorder: AVAudioRecorder?
    private var fileURL: URL?

    func start() {
        guard !recording else { return }
        errorMessage = nil
        if AVAudioApplication.shared.recordPermission == .granted {
            begin()
            return
        }
        AVAudioApplication.requestRecordPermission { allowed in
            Task { @MainActor in
                guard allowed else {
                    self.errorMessage = "Allow the microphone for RUTINA."
                    return
                }
                self.begin()
            }
        }
    }

    func stop() -> Data? {
        recorder?.stop()
        recording = false
        defer {
            recorder = nil
            fileURL = nil
        }
        guard let fileURL else { return nil }
        return try? Data(contentsOf: fileURL)
    }

    private func begin() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("alex-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue
        ]
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: [])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.record()
            self.recorder = recorder
            self.fileURL = url
            recording = true
        } catch {
            errorMessage = "Couldn't start the microphone."
        }
    }
}
