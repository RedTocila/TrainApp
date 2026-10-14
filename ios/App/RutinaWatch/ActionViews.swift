import SwiftUI
import AVFoundation

struct WorkoutWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @State private var reps = 8
    @State private var weight = 20.0

    var body: some View {
        let workout = model.today?.workout
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(workout?.title ?? "No workout today")
                    .font(.headline)
                if workout?.status == "completed" {
                    Text("Done for today")
                        .foregroundStyle(.secondary)
                } else if workout?.status == "in_progress" {
                    if let name = workout?.exerciseName, let set = workout?.setNumber {
                        Text(name)
                        Text("Set \(set)" + (workout?.targetReps.map { " · \($0)" } ?? ""))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if workout?.setId != nil {
                            Stepper("Reps \(reps)", value: $reps, in: 1...100)
                            Stepper(String(format: "%.1f kg", weight), value: $weight, in: 0...300, step: 2.5)
                            Button("Log set") {
                                Task { await model.logSet(reps: reps, weight: weight) }
                            }
                            .buttonStyle(.borderedProminent)
                        } else {
                            Text("Sets logged")
                                .foregroundStyle(.secondary)
                        }
                    } else if workout?.canLogSets == false {
                        Text("Open this one on your iPhone.")
                            .font(.caption)
                    }
                    Button("Cancel", role: .destructive) {
                        Task { await model.cancelWorkout() }
                    }
                } else if workout?.title != nil {
                    Button("Start") {
                        Task { await model.startWorkout() }
                    }
                    .buttonStyle(.borderedProminent)
                } else {
                    Text("Nothing scheduled.")
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("Workout")
        .disabled(model.busy)
    }
}

struct CardioWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let cardio = model.today?.cardio
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            VStack(spacing: 8) {
                Text(cardio?.title ?? "No cardio today")
                    .font(.headline)
                    .multilineTextAlignment(.center)
                if cardio?.status == "running" || cardio?.status == "paused" {
                    Text(clock(model.cardioElapsed))
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                    Text(cardio?.status == "paused" ? "Paused" : "Running")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("Stop") {
                        Task { await model.stopCardio() }
                    }
                    .buttonStyle(.borderedProminent)
                } else if cardio?.completed == true || cardio?.status == "completed" {
                    Text("Done")
                        .foregroundStyle(.secondary)
                } else if cardio?.status == "none" || cardio == nil {
                    Text("Nothing scheduled.")
                        .foregroundStyle(.secondary)
                } else {
                    if let minutes = cardio?.plannedMinutes {
                        Text("\(minutes) min")
                            .foregroundStyle(.secondary)
                    }
                    Button("Start") {
                        Task { await model.startCardio() }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .navigationTitle("Cardio")
        .disabled(model.busy)
    }

    private func clock(_ seconds: Int) -> String {
        String(format: "%d:%02d", max(0, seconds) / 60, max(0, seconds) % 60)
    }
}

struct AlexWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @StateObject private var recorder = AlexRecorder()
    @State private var draft = ""
    @State private var reply = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(recorder.recording ? "Listening…" : "Hold the mic and ask Alex.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button(recorder.recording ? "Listening…" : "Hold to talk") {}
                    .buttonStyle(.borderedProminent)
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
                TextField("Or type", text: $draft)
                Button("Send") {
                    Task { await send(draft) }
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.busy)
                if !reply.isEmpty {
                    Text(reply)
                        .font(.footnote)
                }
                if let speechError = recorder.errorMessage {
                    Text(speechError)
                        .font(.caption2)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Alex")
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
