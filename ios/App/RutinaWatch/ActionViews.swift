import AVFoundation
import ImageIO
import SwiftUI
import UIKit
import WatchKit

enum WatchTone {
    private static let engine = AVAudioEngine()
    private static let player = AVAudioPlayerNode()
    private static let queue = DispatchQueue(label: "al.rutina.watch.tone")
    private static let sampleRate = 44_100.0
    private static var format: AVAudioFormat?
    private static var attached = false

    static func prepare() {
        queue.async { ensureEngine() }
    }

    /// Keeps the engine running and plays each beep after it is queued.
    /// Starting playback on an empty queue made every beep after the first silent.
    private static func ensureEngine() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)
        let fmt = format ?? AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)
        format = fmt
        guard let fmt else { return }
        if !attached {
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: fmt)
            attached = true
        }
        if !engine.isRunning {
            engine.prepare()
            try? engine.start()
        }
    }

    static func tone(_ frequency: Double, milliseconds: Double) {
        DispatchQueue.main.async {
            WKInterfaceDevice.current().play(.click)
        }
        queue.async {
            ensureEngine()
            guard
                let fmt = format,
                let buffer = AVAudioPCMBuffer(
                    pcmFormat: fmt,
                    frameCapacity: AVAudioFrameCount(sampleRate * milliseconds / 1000)
                ),
                let data = buffer.floatChannelData?[0]
            else { return }
            buffer.frameLength = buffer.frameCapacity
            let frames = Int(buffer.frameLength)
            let step = 2 * Double.pi * frequency / sampleRate
            for index in 0..<frames {
                let attack = min(1, Double(index) / 80)
                let release = min(1, Double(frames - index) / 100)
                data[index] = Float(sin(step * Double(index)) * 0.62 * attack * release)
            }
            if !engine.isRunning {
                try? engine.start()
            }
            player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
            player.play()
        }
    }

    static func countdown(_ secondsLeft: Int) {
        tone(secondsLeft <= 1 ? 980 : 760, milliseconds: 150)
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
    @State private var applyingRemote = false

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
        .onAppear {
            model.liveIndex = index
        }
        .onChange(of: model.remoteStamp) { _, _ in
            let next = min(max(0, model.liveIndex), max(pages.count - 1, 0))
            guard next != index else { return }
            applyingRemote = true
            index = next
            DispatchQueue.main.async { applyingRemote = false }
        }
        .onChange(of: index) { _, newIndex in
            guard !applyingRemote else { return }
            let exercise = pages.indices.contains(newIndex) ? pages[newIndex] : nil
            model.noteSet(
                index: newIndex,
                setId: exercise?.openSetId ?? model.liveSetId,
                reps: exercise?.lastReps ?? model.liveReps,
                weight: exercise?.lastWeightKg ?? model.liveWeight
            )
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

    private var phase: WatchHiitPhase? {
        let phases = model.hiitPhases
        guard phases.indices.contains(model.hiitIndex) else { return nil }
        return phases[model.hiitIndex]
    }

    private var working: Bool { phase?.type == "work" }

    private var tint: Color { working ? WatchTheme.red : WatchTheme.water }

    var body: some View {
        let phases = model.hiitPhases
        GeometryReader { geo in
            let chrome: CGFloat = 176
            let gifHeight = geo.size.height - chrome
            VStack(spacing: 5) {
                Text(WatchTheme.clock(model.hiitLeft))
                    .font(.system(size: min(48, geo.size.width * 0.3), weight: .black, design: .rounded))
                    .foregroundStyle(tint)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .frame(maxWidth: .infinity)
                Text((phase?.label ?? (working ? "Work" : "Rest")).uppercased())
                    .font(.system(size: 16, weight: .black))
                    .tracking(1.4)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(tint))
                if let name = phase?.name, !name.isEmpty {
                    Text(name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                if phases.count > 0 {
                    Text("\(model.hiitIndex + 1) of \(phases.count)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(WatchTheme.mute)
                }
                if gifHeight >= 48 {
                    ExerciseMedia(gifUrl: phase?.gifUrl)
                        .frame(maxWidth: .infinity)
                        .frame(height: min(gifHeight, geo.size.height * 0.32))
                        .clipped()
                }
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    watchPill(
                        model.hiitRunning ? "Pause" : "Play",
                        symbol: model.hiitRunning ? "pause.fill" : "play.fill",
                        fill: tint
                    ) {
                        if model.hiitRunning {
                            model.pauseHiit()
                        } else if model.hiitLeft > 0 {
                            model.resumeHiit()
                        } else {
                            model.startHiit()
                        }
                    }
                    watchPill("Next", symbol: "arrow.right", fill: Color.white.opacity(0.16)) {
                        model.skipHiit()
                    }
                }
                HStack(spacing: 6) {
                    watchPill("Restart", symbol: "arrow.counterclockwise", fill: tint.opacity(0.85)) {
                        model.startHiit()
                    }
                    watchPill("Cancel", symbol: "xmark", fill: Color.white.opacity(0.16)) {
                        model.endHiit()
                        Task { await model.cancelWorkout() }
                    }
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .containerBackground(
            working
                ? Color(red: 0.18, green: 0.02, blue: 0.04)
                : Color(red: 0.02, green: 0.08, blue: 0.16),
            for: .navigation
        )
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
    @State private var applyingRemote = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                ExerciseMedia(gifUrl: exercise.gifUrl)
                    .frame(maxWidth: .infinity)
                    .frame(height: 88)
                Text(exercise.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                Text(setLabel)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
                HStack(spacing: 6) {
                    stepper("Kg", value: weightLabel, down: { weight = snap(weight - 2.5) }, up: { weight = snap(weight + 2.5) })
                    stepper("Reps", value: "\(reps)", down: { reps = min(40, max(1, reps - 1)) }, up: { reps = min(40, max(1, reps + 1)) })
                }
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
                HStack(spacing: 6) {
                    setControl("Restart", symbol: "arrow.counterclockwise", fill: WatchTheme.red.opacity(0.85), enabled: true) {
                        Task { await model.restartWorkout() }
                    }
                    setControl("Cancel", symbol: "xmark", fill: Color.white.opacity(0.16), enabled: true) {
                        Task { await model.cancelWorkout() }
                    }
                }
            }
            .padding(.bottom, 8)
        }
        .scrollIndicators(.hidden)
        .onAppear(perform: seed)
        .onChange(of: exercise.id) { _, _ in seed() }
        .onChange(of: model.remoteStamp) { _, _ in
            applyingRemote = true
            reps = min(40, max(1, model.liveReps))
            weight = snap(model.liveWeight)
            DispatchQueue.main.async { applyingRemote = false }
        }
        .onChange(of: reps) { _, newReps in
            guard !applyingRemote else { return }
            model.noteSet(index: index, setId: exercise.openSetId ?? "", reps: newReps, weight: weight)
        }
        .onChange(of: weight) { _, newWeight in
            guard !applyingRemote else { return }
            model.noteSet(index: index, setId: exercise.openSetId ?? "", reps: reps, weight: newWeight)
        }
    }

    private var weightLabel: String {
        weight.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", weight)
            : String(format: "%.1f", weight)
    }

    private var setLabel: String {
        if let number = exercise.openSetNumber {
            return "Set \(number) of \(max(exercise.setCount, number))"
        }
        return "\(exercise.completedSets)/\(exercise.setCount)"
    }

    private func seed() {
        applyingRemote = true
        reps = exercise.lastReps ?? suggestedReps(exercise.targetReps)
        let remembered = UserDefaults.standard.object(forKey: weightKey(exercise.name)) == nil
            ? nil
            : UserDefaults.standard.double(forKey: weightKey(exercise.name))
        weight = snap(exercise.lastWeightKg ?? remembered ?? 20)
        DispatchQueue.main.async { applyingRemote = false }
    }

    private func snap(_ value: Double) -> Double {
        let stepped = (min(200, max(0, value)) / 2.5).rounded() * 2.5
        return (stepped * 10).rounded() / 10
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
        watchPill(title, symbol: symbol, fill: fill, enabled: enabled, action: action)
    }

    private func stepper(
        _ title: String,
        value: String,
        down: @escaping () -> Void,
        up: @escaping () -> Void
    ) -> some View {
        VStack(spacing: 3) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(WatchTheme.mute)
            HStack(spacing: 0) {
                Button(action: down) {
                    Image(systemName: "minus")
                        .font(.system(size: 12, weight: .bold))
                        .frame(width: 28, height: 36)
                }
                Text(value)
                    .font(.system(size: 20, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity)
                Button(action: up) {
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .bold))
                        .frame(width: 28, height: 36)
                }
            }
            .foregroundStyle(.white)
            .buttonStyle(.plain)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
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
    @State private var still: UIImage?

    var body: some View {
        ZStack {
            if let still {
                Image(uiImage: still)
                    .resizable()
                    .scaledToFit()
                    .padding(4)
            } else {
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(WatchTheme.red)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white.opacity(still == nil ? 0 : 0.94))
        .task(id: urlString) { await load() }
    }

    private func load() async {
        still = nil
        guard playing, let urlString, let url = URL(string: urlString) else { return }
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 12
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 400 else { return }
            guard data.count < 1_500_000, let image = stillFrame(data), !Task.isCancelled else { return }
            still = image
        } catch {
            still = nil
        }
    }
}

private func watchPill(
    _ title: String,
    symbol: String,
    fill: Color,
    enabled: Bool = true,
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
        .padding(.vertical, 12)
        .background(Capsule().fill(fill))
        .opacity(enabled ? 1 : 0.4)
    }
    .buttonStyle(.plain)
    .disabled(!enabled)
}

private func roundIcon(_ name: String, fill: Color, size: CGFloat = 44, action: @escaping () -> Void) -> some View {
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

/// One small frame. Decoding a full exercise GIF is enough to jetsam the watch.
private func stillFrame(_ data: Data) -> UIImage? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
    let options: [CFString: Any] = [
        kCGImageSourceThumbnailMaxPixelSize: 160,
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
    return UIImage(cgImage: image)
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
                        roundIcon("play.fill", fill: running ? Color.white.opacity(0.16) : WatchTheme.red, size: 48) {
                            guard !running else { return }
                            Task { await model.startCardio() }
                        }
                        roundIcon("pause.fill", fill: running ? WatchTheme.red : Color.white.opacity(0.16), size: 48) {
                            guard running else { return }
                            Task { await model.pauseCardio() }
                        }
                        roundIcon("arrow.counterclockwise", fill: (running || paused || cardio?.completed == true) ? Color.white.opacity(0.16) : Color.white.opacity(0.08), size: 48) {
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

