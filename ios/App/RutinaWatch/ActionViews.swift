import ImageIO
import SwiftUI
import UIKit

struct WorkoutWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @State private var reps = 6
    @State private var weight = 10.0

    var body: some View {
        let workout = model.today?.workout
        let inProgress = workout?.status == "in_progress"
        ScrollView {
            VStack(spacing: WatchTheme.gap) {
                WatchHeader(title: "Workout", back: true)
                ExerciseMedia(gifUrl: gifURL(workout))
                    .frame(maxWidth: .infinity)
                    .frame(height: 150)
                VStack(alignment: .leading, spacing: 4) {
                    Text(headline(workout))
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    if inProgress {
                        Text("Set \(workout?.setNumber ?? 1)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if inProgress {
                    HStack(alignment: .top, spacing: WatchTheme.gap) {
                        dial("Weight", value: "\(weightText) kg", down: { weight = max(0, snap(weight - 2.5)) }, up: { weight = min(300, snap(weight + 2.5)) })
                        dial("Reps", value: "\(reps)", down: { reps = max(1, reps - 1) }, up: { reps = min(40, reps + 1) })
                    }
                } else if workout?.status == "completed" {
                    Text("Done for today")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(WatchTheme.mute)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if workout?.title == nil {
                    Text("Nothing scheduled.")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(WatchTheme.mute)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if let error = model.error {
                    Text(error)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(WatchTheme.red)
                        .lineLimit(3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if inProgress {
                    WatchAction(title: "Next set", symbol: "checkmark") {
                        let loggedReps = reps
                        let loggedWeight = weight
                        watchAct { Task { await model.logSet(reps: loggedReps, weight: loggedWeight) } }
                    }
                    WatchAction(title: "Cancel", symbol: "xmark", fill: WatchTheme.card) {
                        watchAct { Task { await model.cancelWorkout() } }
                    }
                } else if workout?.status == "scheduled" {
                    WatchAction(title: "Start", symbol: "play.fill") {
                        watchAct { Task { await model.startWorkout() } }
                    }
                }
            }
            .padding(.bottom, 20)
        }
        .watchScroll()
        .watchChrome()
        .onAppear(perform: seed)
        .onChange(of: model.today?.workout.setId) { _, _ in seed() }
    }

    private var weightText: String {
        weight.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", weight)
            : String(format: "%.1f", weight)
    }

    private func gifURL(_ workout: WatchWorkout?) -> String? {
        if let open = workout?.exercises.first(where: { $0.openSetId != nil })?.gifUrl {
            return open
        }
        return workout?.exercises.first?.gifUrl ?? workout?.phases.first?.gifUrl
    }

    private func headline(_ workout: WatchWorkout?) -> String {
        if workout?.status == "in_progress", let name = workout?.exerciseName, !name.isEmpty {
            return name
        }
        if let title = workout?.title, !title.isEmpty { return title }
        return "Rest day"
    }

    private func seed() {
        let workout = model.today?.workout
        let open = workout?.exercises.first { $0.openSetId != nil }
        reps = min(40, max(1, open?.lastReps ?? 6))
        weight = snap(open?.lastWeightKg ?? 10)
    }

    private func snap(_ value: Double) -> Double {
        (value / 2.5).rounded() * 2.5
    }

    private func dial(_ title: String, value: String, down: @escaping () -> Void, up: @escaping () -> Void) -> some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
            VStack(spacing: 8) {
                step("plus", action: up)
                Text(value)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                    .frame(maxWidth: .infinity)
                step("minus", action: down)
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(WatchTheme.card)
            )
        }
        .frame(maxWidth: .infinity)
    }

    private func step(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.white.opacity(0.08))
                )
        }
        .buttonStyle(.plain)
    }
}

private struct ExerciseMedia: View {
    var gifUrl: String?
    var loopAnchor: Date? = nil
    @State private var frames: [UIImage] = []
    @State private var frame = 0

    private var playbackID: String {
        let anchor = loopAnchor.map { Int($0.timeIntervalSince1970) } ?? 0
        return "\(gifUrl ?? "")|\(anchor)"
    }

    var body: some View {
        ZStack {
            if frames.indices.contains(frame) {
                Image(uiImage: frames[frame])
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(WatchTheme.red)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white.opacity(frames.isEmpty ? 0 : 0.96))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .task(id: playbackID) { await play() }
    }

    private func play() async {
        frames = []
        frame = 0
        guard let gifUrl, let url = URL(string: gifUrl) else { return }
        guard let clip = await MotionLibrary.shared.clip(for: url) else { return }
        guard !Task.isCancelled, !clip.frames.isEmpty else { return }
        frames = clip.frames
        let anchor = loopAnchor ?? Date()
        while !Task.isCancelled {
            let index = clip.frameIndex(at: Date(), anchor: anchor)
            if frame != index { frame = index }
            let wait = clip.secondsUntilNextFrame(at: Date(), anchor: anchor)
            try? await Task.sleep(for: .seconds(min(0.4, max(0.05, wait))))
        }
    }
}

/// A few downsampled frames. A full exercise GIF is enough to jetsam the watch.
private struct MotionClip: @unchecked Sendable {
    var frames: [UIImage]
    var delays: [Double]

    var loop: Double { max(0.2, delays.reduce(0, +)) }

    func frameIndex(at date: Date, anchor: Date) -> Int {
        guard !frames.isEmpty else { return 0 }
        var elapsed = date.timeIntervalSince(anchor).truncatingRemainder(dividingBy: loop)
        if elapsed < 0 { elapsed += loop }
        var cursor = 0.0
        for index in delays.indices {
            cursor += delays[index]
            if elapsed < cursor { return index }
        }
        return frames.count - 1
    }

    func secondsUntilNextFrame(at date: Date, anchor: Date) -> Double {
        guard !delays.isEmpty else { return 0.12 }
        var elapsed = date.timeIntervalSince(anchor).truncatingRemainder(dividingBy: loop)
        if elapsed < 0 { elapsed += loop }
        var cursor = 0.0
        for delay in delays {
            cursor += delay
            if elapsed < cursor { return cursor - elapsed }
        }
        return 0.08
    }
}

private actor MotionLibrary {
    static let shared = MotionLibrary()
    private var clips: [String: MotionClip] = [:]
    private var order: [String] = []

    func clip(for url: URL) async -> MotionClip? {
        let key = url.absoluteString
        if let cached = clips[key] { return cached }
        guard let loaded = await Self.download(url) else { return nil }
        clips[key] = loaded
        order.removeAll { $0 == key }
        order.append(key)
        while order.count > 2 {
            clips[order.removeFirst()] = nil
        }
        return loaded
    }

    private static func download(_ url: URL) async -> MotionClip? {
        var request = URLRequest(url: url)
        request.timeoutInterval = 12
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 400 else { return nil }
            guard data.count < 2_000_000 else { return nil }
            return decode(data)
        } catch {
            return nil
        }
    }

    private static func decode(_ data: Data) -> MotionClip? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let count = CGImageSourceGetCount(source)
        guard count > 0 else { return nil }
        let maxFrames = 5
        let step = max(1, Int(ceil(Double(count) / Double(maxFrames))))
        var frames: [UIImage] = []
        var delays: [Double] = []
        var index = 0
        let options: [CFString: Any] = [
            kCGImageSourceThumbnailMaxPixelSize: 280,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCache: false,
            kCGImageSourceShouldCacheImmediately: false,
        ]
        while index < count {
            let end = min(count, index + step)
            var delay = 0.0
            for cursor in index..<end {
                delay += frameDelay(source, cursor)
            }
            if let image = CGImageSourceCreateThumbnailAtIndex(source, index, options as CFDictionary) {
                frames.append(UIImage(cgImage: image))
                delays.append(max(0.05, delay))
            }
            index = end
        }
        guard !frames.isEmpty else { return nil }
        return MotionClip(frames: frames, delays: delays)
    }

    private static func frameDelay(_ source: CGImageSource, _ index: Int) -> Double {
        guard
            let props = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
            let gif = props[kCGImagePropertyGIFDictionary] as? [CFString: Any]
        else { return 0.08 }
        let unclamped = Self.seconds(gif[kCGImagePropertyGIFUnclampedDelayTime])
        let clamped = Self.seconds(gif[kCGImagePropertyGIFDelayTime])
        let delay = [unclamped, clamped].compactMap { $0 }.first { $0 >= 0.02 } ?? 0.08
        return min(0.5, delay)
    }

    private static func seconds(_ value: Any?) -> Double? {
        if let number = value as? Double { return number }
        if let number = value as? NSNumber { return number.doubleValue }
        return nil
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

private func roundIcon(
    _ name: String,
    fill: Color,
    size: CGFloat = 44,
    enabled: Bool = true,
    action: @escaping () -> Void
) -> some View {
    Button(action: action) {
        Image(systemName: name)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Circle().fill(fill))
            .opacity(enabled ? 1 : 0.35)
    }
    .buttonStyle(.plain)
    .disabled(!enabled)
}

private func snapWeight(_ value: Double) -> Double {
    let stepped = (min(200, max(0, value)) / 2.5).rounded() * 2.5
    return (stepped * 10).rounded() / 10
}

    private func rememberedLoad(_ exercise: WatchExercise) -> (reps: Int, weight: Double) {
    let key = "rutina.watch.kg.\(exercise.name.lowercased())"
    let remembered = UserDefaults.standard.object(forKey: key) == nil
        ? nil
        : UserDefaults.standard.double(forKey: key)
    let reps = min(40, max(1, exercise.lastReps ?? 6))
    return (reps, snapWeight(exercise.lastWeightKg ?? remembered ?? 10))
}

struct CardioWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @StateObject private var clock = SecondClock()

    var body: some View {
        let cardio = model.today?.cardio
        let running = cardio?.status == "running"
        let paused = cardio?.status == "paused"
        let done = cardio?.completed == true || cardio?.status == "completed"
        let scheduled = cardio != nil && cardio?.status != "none"
        let elapsed = elapsedSeconds(cardio)
        let planned = cardio?.plannedMinutes ?? 0
        let plannedSeconds = planned > 0 ? planned * 60 : 0
        let title = cardio?.title?.isEmpty == false ? (cardio?.title ?? "Cardio") : "Cardio"
        ScrollView {
            VStack(spacing: WatchTheme.gap) {
                WatchHeader(title: "Cardio", back: true)
                if !scheduled {
                    Text("No cardio today")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                    Text("Nothing scheduled")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(WatchTheme.mute)
                        .frame(maxWidth: .infinity)
                } else {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                    ZStack {
                        WatchRing(
                            progress: plannedSeconds > 0
                                ? WatchTheme.fraction(Double(elapsed), Double(plannedSeconds))
                                : (done ? 1 : 0),
                            size: 96,
                            tint: WatchTheme.cardio
                        )
                        VStack(spacing: 4) {
                            Text(done ? "Done" : WatchTheme.clock(elapsed))
                                .font(.system(size: 26, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .monospacedDigit()
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)
                            Text(running ? "Going" : (paused ? "Paused" : (done ? "Saved" : "Ready")))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(WatchTheme.cardio)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    if plannedSeconds > 0 {
                        HStack(spacing: WatchTheme.gap) {
                            cardioChip("Planned", WatchTheme.clock(plannedSeconds))
                            cardioChip(
                                elapsed >= plannedSeconds ? "Over" : "Left",
                                elapsed >= plannedSeconds
                                    ? "+\(WatchTheme.clock(elapsed - plannedSeconds))"
                                    : WatchTheme.clock(plannedSeconds - elapsed)
                            )
                        }
                    }
                    if running || paused {
                        WatchAction(title: "Stop", symbol: "stop.fill", fill: WatchTheme.cardio) {
                            watchAct { Task { await model.stopCardio() } }
                        }
                    } else if !done {
                        WatchAction(title: "Start", symbol: "play.fill", fill: WatchTheme.cardio) {
                            watchAct { Task { await model.startCardio() } }
                        }
                    }
                    if let note = model.notice ?? model.error {
                        Text(note)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(model.error == nil ? WatchTheme.mute : WatchTheme.red)
                            .multilineTextAlignment(.center)
                            .lineLimit(3)
                            .minimumScaleFactor(0.7)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(.bottom, 20)
        }
        .watchScroll()
        .watchChrome()
        .onAppear { clock.setRunning(running) }
        .onChange(of: running) { _, isRunning in
            clock.setRunning(isRunning)
        }
    }

    private func cardioChip(_ title: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(WatchTheme.mute)
            Text(value)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .watchCard(12)
    }

    private func elapsedSeconds(_ cardio: WatchCardio?) -> Int {
        if cardio?.status == "running" {
            let extra = max(0, Int(clock.now.timeIntervalSince(model.fetchedAt)))
            return (cardio?.elapsedSeconds ?? 0) + extra
        }
        if cardio?.status == "paused" || cardio?.completed == true {
            return cardio?.elapsedSeconds ?? model.cardioElapsed
        }
        return cardio?.elapsedSeconds ?? 0
    }
}

