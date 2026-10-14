import AVFoundation
import ImageIO
import SwiftUI
import UIKit
import WatchKit

enum WatchTone {
    private static let engine = AVAudioEngine()
    private static let player = AVAudioPlayerNode()
    private static var started = false

    static func prepare() {
        guard !started else { return }
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: 16_000, channels: 1) else { return }
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        engine.prepare()
        try? engine.start()
        started = engine.isRunning
    }

    static func tone(_ frequency: Double, milliseconds: Double) {
        prepare()
        WKInterfaceDevice.current().play(.click)
        guard
            let format = AVAudioFormat(standardFormatWithSampleRate: 16_000, channels: 1),
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(16_000 * milliseconds / 1000))
        else { return }
        buffer.frameLength = buffer.frameCapacity
        let data = buffer.floatChannelData?[0]
        let frames = Int(buffer.frameLength)
        let step = 2 * Double.pi * frequency / 16_000
        for index in 0..<frames {
            let attack = min(1, Double(index) / 40)
            let release = min(1, Double(frames - index) / 40)
            data?[index] = Float(sin(step * Double(index)) * 0.4 * attack * release)
        }
        if !player.isPlaying { player.play() }
        player.scheduleBuffer(buffer, completionHandler: nil)
    }

    static func tick(_ secondsLeft: Int) {
        tone(secondsLeft <= 1 ? 980 : secondsLeft <= 2 ? 820 : 660, milliseconds: secondsLeft <= 1 ? 90 : 55)
    }

    static func playStart() {
        tone(440, milliseconds: 70)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            tone(660, milliseconds: 100)
        }
    }

    static func playPhase(_ type: String) {
        if type == "work" {
            tone(780, milliseconds: 110)
        } else {
            tone(360, milliseconds: 130)
        }
    }

    static func playDone() {
        tone(523, milliseconds: 90)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            tone(784, milliseconds: 160)
        }
        WKInterfaceDevice.current().play(.success)
    }
}

struct WorkoutWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @State private var index = 0

    private var interval: Bool {
        !(model.today?.workout.phases.isEmpty ?? true)
    }

    private var pages: [WatchExercise] {
        let workout = model.today?.workout
        if workout?.status == "in_progress", let exercises = workout?.exercises, !exercises.isEmpty {
            return exercises
        }
        if workout?.status == "in_progress", let name = workout?.exerciseName {
            return [
                WatchExercise(
                    id: workout?.setId ?? name,
                    name: name,
                    gifUrl: workout?.exercises.first?.gifUrl,
                    targetReps: workout?.targetReps,
                    setCount: max(workout?.setNumber ?? 1, 1),
                    completedSets: max((workout?.setNumber ?? 1) - 1, 0),
                    openSetId: workout?.setId,
                    openSetNumber: workout?.setNumber,
                    lastWeightKg: nil,
                    lastReps: nil
                )
            ]
        }
        return []
    }

    var body: some View {
        Group {
            if interval && (model.hiitRunning || model.hiitLeft > 0 || model.today?.workout.status == "in_progress") {
                HiitWatchScreen()
            } else if !pages.isEmpty {
                ExerciseLogPage(exercise: pages[min(index, pages.count - 1)], index: index, total: pages.count) {
                    index = min(index + 1, pages.count - 1)
                }
            } else {
                cover
            }
        }
        .navigationTitle(interval ? "HIIT" : "Workout")
        .containerBackground(WatchTheme.ink, for: .navigation)
        .onChange(of: pages.count) { _, count in
            if index >= count { index = max(0, count - 1) }
        }
    }

    private var cover: some View {
        let workout = model.today?.workout
        let count = interval ? (workout?.phases.count ?? 0) : (workout?.exercises.count ?? 0)
        return VStack(spacing: 8) {
            Spacer(minLength: 0)
            Image(systemName: interval ? "timer" : "dumbbell.fill")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(WatchTheme.red)
                .frame(width: 52, height: 52)
                .background(Circle().fill(WatchTheme.red.opacity(0.16)))
            Text(workout?.title ?? "Rest day")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            Text(coverDetail(workout, count: count))
                .font(.system(size: 12))
                .foregroundStyle(WatchTheme.mute)
                .multilineTextAlignment(.center)
            Spacer(minLength: 0)
            if workout?.status == "scheduled" {
                WatchAction(title: "Start") {
                    if interval {
                        model.startHiit()
                    } else {
                        Task { await model.startWorkout() }
                    }
                }
            }
            if let error = model.error {
                Text(error)
                    .font(.system(size: 10))
                    .foregroundStyle(WatchTheme.red)
                    .lineLimit(2)
            }
        }
    }

    private func coverDetail(_ workout: WatchWorkout?, count: Int) -> String {
        if workout?.status == "completed" { return "Done for today" }
        if interval { return count > 0 ? "Runs on its own" : "Ready" }
        if workout?.canLogSets == false && workout?.status == "in_progress" {
            return "Open this one on your iPhone."
        }
        if count > 0 { return count == 1 ? "1 exercise" : "\(count) exercises" }
        if workout?.title == nil { return "Nothing scheduled." }
        return "Ready"
    }
}

private struct HiitWatchScreen: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let phases = model.hiitPhases
        let phase = phases.indices.contains(model.hiitIndex) ? phases[model.hiitIndex] : nil
        VStack(spacing: 4) {
            Text(phase?.name ?? phase?.label ?? "HIIT")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(phase?.label ?? "")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(phase?.type == "work" ? WatchTheme.red : WatchTheme.mute)
            ExerciseMedia(gifUrl: phase?.gifUrl)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            Text(WatchTheme.clock(model.hiitLeft))
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
            HStack(spacing: 10) {
                roundIcon(model.hiitRunning ? "pause.fill" : "play.fill", fill: WatchTheme.red) {
                    if model.hiitRunning {
                        model.pauseHiit()
                    } else if model.hiitLeft > 0 {
                        model.resumeHiit()
                    } else {
                        model.startHiit()
                    }
                }
                roundIcon("forward.fill", fill: Color.white.opacity(0.16)) {
                    model.skipHiit()
                }
            }
        }
    }
}

private struct ExerciseLogPage: View {
    @EnvironmentObject private var model: WatchDashboardModel
    var exercise: WatchExercise
    var index: Int
    var total: Int
    var onNext: () -> Void
    @State private var reps = 8
    @State private var weight = 20.0

    private var weights: [Double] {
        Array(stride(from: 0.0, through: 200.0, by: 2.5))
    }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 6) {
                    Text(exercise.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(setLabel)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(WatchTheme.mute)
                    ExerciseMedia(gifUrl: exercise.gifUrl)
                        .frame(height: max(120, geo.size.height * 0.86))
                    HStack(spacing: 4) {
                        wheel("Reps", selection: repsBinding, values: (1...40).map(Double.init)) { value in
                            "\(Int(value))"
                        }
                        wheel("Kg", selection: $weight, values: weights) { value in
                            value.truncatingRemainder(dividingBy: 1) == 0
                                ? String(format: "%.0f", value)
                                : String(format: "%.1f", value)
                        }
                    }
                    .frame(height: 108)
                    HStack(spacing: 6) {
                        setControl(
                            "Close set",
                            symbol: "checkmark",
                            fill: exercise.openSetId == nil ? Color.white.opacity(0.16) : WatchTheme.red,
                            enabled: exercise.openSetId != nil
                        ) {
                            log()
                        }
                        setControl(
                            "Next",
                            symbol: "arrow.right",
                            fill: Color.white.opacity(0.16),
                            enabled: index + 1 < total
                        ) {
                            if index + 1 < total { onNext() }
                        }
                    }
                }
                .padding(.bottom, 6)
            }
            .scrollIndicators(.hidden)
        }
        .onAppear(perform: seed)
        .onChange(of: exercise.id) { _, _ in seed() }
    }

    private var repsBinding: Binding<Double> {
        Binding(
            get: { Double(reps) },
            set: { reps = Int($0.rounded()) }
        )
    }

    private var setLabel: String {
        if let number = exercise.openSetNumber {
            return "Set \(number) of \(max(exercise.setCount, number))"
        }
        return "\(exercise.completedSets)/\(exercise.setCount)"
    }

    private func seed() {
        reps = exercise.lastReps ?? suggestedReps(exercise.targetReps)
        let remembered = UserDefaults.standard.object(forKey: weightKey(exercise.name)) == nil
            ? nil
            : UserDefaults.standard.double(forKey: weightKey(exercise.name))
        weight = snap(exercise.lastWeightKg ?? remembered ?? 20)
    }

    private func snap(_ value: Double) -> Double {
        weights.min(by: { abs($0 - value) < abs($1 - value) }) ?? 20
    }

    private func log() {
        guard let setId = exercise.openSetId else { return }
        UserDefaults.standard.set(weight, forKey: weightKey(exercise.name))
        Task { await model.logSet(setId: setId, reps: reps, weight: weight) }
    }

    private func weightKey(_ name: String) -> String {
        "rutina.watch.kg.\(name.lowercased())"
    }

    private func setControl(
        _ title: String,
        symbol: String,
        fill: Color,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 3) {
                Image(systemName: symbol)
                    .font(.system(size: 11, weight: .bold))
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Capsule().fill(fill))
            .opacity(enabled ? 1 : 0.4)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    private func wheel(
        _ title: String,
        selection: Binding<Double>,
        values: [Double],
        label: @escaping (Double) -> String
    ) -> some View {
        VStack(spacing: 0) {
            Text(title.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(WatchTheme.mute)
            Picker(title, selection: selection) {
                ForEach(values, id: \.self) { value in
                    Text(label(value)).tag(value)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
        }
    }
}

private struct ExerciseMedia: View {
    var gifUrl: String?

    var body: some View {
        ExercisePreview(urlString: gifUrl, playing: true)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct ExercisePreview: View {
    var urlString: String?
    var playing: Bool
    @State private var frames: [UIImage] = []
    @State private var frame = 0

    var body: some View {
        ZStack {
            if frames.isEmpty {
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(WatchTheme.red)
            } else {
                Image(uiImage: frames[min(frame, frames.count - 1)])
                    .resizable()
                    .scaledToFit()
                    .padding(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white.opacity(0.06))
        .task(id: urlString) { await load() }
        .task(id: playing) { await animate() }
    }

    private func load() async {
        frames = []
        frame = 0
        guard let urlString, let url = URL(string: urlString) else { return }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 400 else { return }
            let decoded = decodeGif(data)
            if !Task.isCancelled { frames = decoded }
        } catch {
            frames = []
        }
    }

    private func animate() async {
        while playing, !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(80))
            guard playing, frames.count > 1 else { continue }
            frame = (frame + 1) % frames.count
        }
    }
}

private func roundIcon(_ name: String, fill: Color, size: CGFloat = 36, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: name)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Circle().fill(fill))
    }
    .buttonStyle(.plain)
}

private func suggestedReps(_ raw: String?) -> Int {
    guard let raw else { return 8 }
    let numbers = raw.split { !$0.isNumber }
    return min(40, max(1, Int(numbers.first ?? "") ?? 8))
}

private func decodeGif(_ data: Data) -> [UIImage] {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
        return UIImage(data: data).map { [$0] } ?? []
    }
    let count = CGImageSourceGetCount(source)
    if count <= 1 {
        return UIImage(data: data).map { [$0] } ?? []
    }
    let step = max(1, count / 16)
    var images: [UIImage] = []
    let options: [CFString: Any] = [
        kCGImageSourceThumbnailMaxPixelSize: 240,
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true
    ]
    for index in stride(from: 0, to: count, by: step) {
        if let image = CGImageSourceCreateThumbnailAtIndex(source, index, options as CFDictionary) {
            images.append(UIImage(cgImage: image))
        }
    }
    return images
}

struct CardioWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let cardio = model.today?.cardio
            let running = cardio?.status == "running"
            let paused = cardio?.status == "paused"
            GeometryReader { geo in
                let clockSize = min(54, max(36, geo.size.height * 0.36))
                VStack(spacing: 4) {
                    Text(cardio?.title ?? "Cardio")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(clockText(cardio))
                        .font(.system(size: clockSize, weight: .bold, design: .rounded))
                        .foregroundStyle(running ? WatchTheme.red : .white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                    Text(statusText(cardio))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(WatchTheme.mute)
                    Spacer(minLength: 2)
                    HStack(spacing: 10) {
                        roundIcon("play.fill", fill: running ? Color.white.opacity(0.16) : WatchTheme.red, size: 42) {
                            guard !running else { return }
                            Task { await model.startCardio() }
                        }
                        roundIcon("pause.fill", fill: running ? WatchTheme.red : Color.white.opacity(0.16), size: 42) {
                            guard running else { return }
                            Task { await model.pauseCardio() }
                        }
                        roundIcon("arrow.counterclockwise", fill: (running || paused || cardio?.completed == true) ? Color.white.opacity(0.16) : Color.white.opacity(0.08), size: 42) {
                            Task { await model.resetCardio() }
                        }
                    }
                    if let error = model.error {
                        Text(error)
                            .font(.system(size: 10))
                            .foregroundStyle(WatchTheme.red)
                            .lineLimit(2)
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
        }
        .navigationTitle("Cardio")
        .containerBackground(WatchTheme.ink, for: .navigation)
    }

    private func clockText(_ cardio: WatchCardio?) -> String {
        if cardio?.status == "running" || cardio?.status == "paused" {
            return WatchTheme.clock(model.cardioElapsed)
        }
        if let minutes = cardio?.plannedMinutes { return "\(minutes):00" }
        return "0:00"
    }

    private func statusText(_ cardio: WatchCardio?) -> String {
        switch cardio?.status {
        case "running": return "Running"
        case "paused": return "Paused"
        case "completed": return "Done"
        case "none", nil: return "Rest day"
        default: return "Ready"
        }
    }
}

struct AlexWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @StateObject private var recorder = AlexRecorder()
    @State private var reply = ""

    var body: some View {
        VStack(spacing: 8) {
            Group {
                if !reply.isEmpty {
                    ScrollView {
                        Text(reply)
                            .font(.system(size: 16))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .multilineTextAlignment(.leading)
                    }
                } else {
                    Text(hint)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(model.error == nil && recorder.errorMessage == nil ? WatchTheme.mute : WatchTheme.red)
                        .multilineTextAlignment(.center)
                        .lineLimit(4)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            Button(action: toggleMic) {
                ZStack {
                    Circle()
                        .fill(recorder.recording ? WatchTheme.red : Color.white)
                        .frame(width: 48, height: 48)
                    if model.busy && !recorder.recording {
                        ProgressView()
                            .scaleEffect(0.7)
                    } else {
                        Image(systemName: recorder.recording ? "waveform" : "mic.fill")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(recorder.recording ? Color.white : Color.black)
                    }
                }
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Alex")
        .containerBackground(WatchTheme.ink, for: .navigation)
        .onChange(of: recorder.pendingAudio) { _, data in
            guard data != nil, let audio = recorder.takePending() else { return }
            Task { await sendAudio(audio) }
        }
    }

    private var hint: String {
        if let error = model.error ?? recorder.errorMessage, !error.isEmpty { return error }
        if model.busy { return "..." }
        if recorder.recording { return "Listening" }
        return "Tap the mic"
    }

    private func toggleMic() {
        if model.busy { return }
        if recorder.recording {
            guard let audio = recorder.stop() else { return }
            Task { await sendAudio(audio) }
        } else {
            reply = ""
            recorder.start()
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
    @Published var pendingAudio: Data?

    private var recorder: AVAudioRecorder?
    private var fileURL: URL?
    private var meter: Timer?
    private var startedAt = Date()
    private var heardSpeech = false
    private var quietSince: Date?

    func start() {
        guard !recording else { return }
        errorMessage = nil
        pendingAudio = nil
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
        meter?.invalidate()
        meter = nil
        recorder?.stop()
        recording = false
        defer {
            recorder = nil
            fileURL = nil
        }
        guard let fileURL else { return nil }
        return try? Data(contentsOf: fileURL)
    }

    func takePending() -> Data? {
        let data = pendingAudio
        pendingAudio = nil
        return data
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
            recorder.isMeteringEnabled = true
            recorder.record()
            self.recorder = recorder
            self.fileURL = url
            recording = true
            startedAt = Date()
            heardSpeech = false
            quietSince = nil
            meter?.invalidate()
            meter = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { _ in
                Task { @MainActor in
                    self.sampleLevel()
                }
            }
        } catch {
            errorMessage = "Couldn't start the microphone."
        }
    }

    private func sampleLevel() {
        guard recording, let recorder else { return }
        recorder.updateMeters()
        let power = recorder.averagePower(forChannel: 0)
        let elapsed = Date().timeIntervalSince(startedAt)
        if power > -36 {
            heardSpeech = true
            quietSince = nil
        } else if heardSpeech {
            if quietSince == nil { quietSince = Date() }
            if let quietSince, Date().timeIntervalSince(quietSince) >= 1.1 {
                pendingAudio = stop()
                return
            }
        } else if elapsed >= 5 {
            _ = stop()
            errorMessage = "Didn't catch that. Tap again."
            return
        }
        if elapsed >= 18, recording {
            pendingAudio = stop()
        }
    }
}
