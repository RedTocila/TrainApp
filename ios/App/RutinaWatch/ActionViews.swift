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

private final class IndexGate {
    var remote = false
}

struct WorkoutWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @State private var index = 0
    @State private var gate = IndexGate()

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
                ExerciseLogPage(
                    exercise: pages[min(index, pages.count - 1)],
                    index: index,
                    total: pages.count,
                    onPrevious: { index = max(0, index - 1) },
                    onNext: { index = min(index + 1, pages.count - 1) }
                )
            } else {
                cover
            }
        }
        .onChange(of: pages.count) { _, count in
            if index >= count { index = max(0, count - 1) }
        }
        .onAppear {
            model.liveIndex = index
        }
        .onChange(of: model.remoteStamp) { _, _ in
            let next = min(max(0, model.liveIndex), max(pages.count - 1, 0))
            guard next != index else { return }
            gate.remote = true
            index = next
        }
        .onChange(of: index) { _, newIndex in
            if gate.remote {
                gate.remote = false
                return
            }
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
        let rows = coverRows
        return VStack(spacing: 6) {
            WatchHeader(title: "Workout", back: true)
            ScrollView {
                VStack(spacing: 6) {
                    HStack(alignment: .center, spacing: 6) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(workout?.title ?? "Rest day")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(.white)
                                .lineLimit(2)
                                .minimumScaleFactor(0.7)
                            Text(coverDetail(workout, count: count))
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Color.white.opacity(0.62))
                                .lineLimit(2)
                            Text(coverBadge(workout))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(WatchTheme.red)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Capsule().fill(WatchTheme.red.opacity(0.16)))
                        }
                        Spacer(minLength: 0)
                        coverArt
                    }
                    .padding(8)
                    .watchCard(16)

                    ForEach(Array(rows.enumerated()), id: \.offset) { offset, row in
                        HStack(spacing: 8) {
                            Image(systemName: interval ? "timer" : "figure.strengthtraining.traditional")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(WatchTheme.red)
                                .frame(width: 32, height: 32)
                                .background(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .fill(Color.white.opacity(0.06))
                                )
                            VStack(alignment: .leading, spacing: 1) {
                                Text("\(offset + 1). \(row.title)")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                                Text(row.detail)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(WatchTheme.mute)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 7)
                        .watchCard(14)
                    }
                }
                .padding(.bottom, 4)
            }
            .scrollIndicators(.hidden)
            if workout?.status == "scheduled" {
                WatchAction(title: "Start Workout", symbol: "play.fill") {
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
        .watchChrome()
    }

    private var coverArt: some View {
        let gif = model.today?.workout.exercises.first?.gifUrl ?? model.today?.workout.phases.first?.gifUrl
        return ExerciseMedia(gifUrl: gif)
            .frame(width: 62, height: 62)
    }

    private var coverRows: [(title: String, detail: String)] {
        let workout = model.today?.workout
        if interval {
            return (workout?.phases ?? []).map { phase in
                let title = phase.name?.isEmpty == false ? (phase.name ?? phase.label) : phase.label
                return (title, "\(max(phase.seconds, 1)) sec")
            }
        }
        return (workout?.exercises ?? []).map { exercise in
            (exercise.name, repsDetail(exercise))
        }
    }

    private func coverBadge(_ workout: WatchWorkout?) -> String {
        switch workout?.status {
        case "completed": return "Done"
        case "in_progress": return "In progress"
        case "scheduled": return "Ready"
        default: return "Rest day"
        }
    }

    private func repsDetail(_ exercise: WatchExercise) -> String {
        if let reps = exercise.targetReps, !reps.isEmpty {
            return reps.lowercased().contains("rep") ? reps : "\(reps) reps"
        }
        let sets = max(exercise.setCount, 1)
        return sets == 1 ? "1 set" : "\(sets) sets"
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
        let total = max(phase?.seconds ?? 1, 1)
        GeometryReader { geo in
            let ring = min(geo.size.width * 0.62, geo.size.height * 0.42)
            VStack(spacing: 6) {
                WatchHeader(title: working ? "Workout" : "Rest", back: true)
                if phases.count > 0 {
                    Text("\(model.hiitIndex + 1)/\(phases.count)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.7))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                ZStack {
                    WatchRing(
                        progress: WatchTheme.fraction(Double(model.hiitLeft), Double(total)),
                        size: ring,
                        tint: tint,
                        glow: true
                    )
                    Text(WatchTheme.clock(model.hiitLeft))
                        .font(.system(size: ring * 0.28, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                Text(phase?.name?.isEmpty == false ? (phase?.name ?? phase?.label ?? "Work") : (phase?.label ?? "Work"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    watchPill("Skip", symbol: "forward.end.fill", fill: Color.white.opacity(0.12)) {
                        model.skipHiit()
                    }
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
                }
                HStack(spacing: 16) {
                    Button("Restart") { model.startHiit() }
                    Button("End") {
                        model.endHiit()
                        Task { await model.cancelWorkout() }
                    }
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.5))
                .buttonStyle(.plain)
            }
        }
        .watchChrome()
    }
}

/// Holds the load without publishing it. The set page must not redraw on each tap.
private final class LoadDraft {
    var reps = 8
    var weight = 20.0
    var seededID = ""
}

private struct ExerciseLogPage: View {
    @EnvironmentObject private var model: WatchDashboardModel
    var exercise: WatchExercise
    var index: Int
    var total: Int
    var onPrevious: () -> Void
    var onNext: () -> Void
    @State private var draft = LoadDraft()
    @State private var adjusting = false
    @State private var resting = false
    @State private var restLeft = 45
    @State private var restToken = 0
    @State private var advanceAfterRest = false
    @State private var shownReps = 8
    @State private var shownWeight = 20.0

    var body: some View {
        VStack(spacing: 6) {
            WatchHeader(title: resting ? "Rest" : "Workout", back: true)
            if resting {
                restBody
            } else {
                activeBody
            }
        }
        .watchChrome()
        .onAppear(perform: seedShown)
        .onChange(of: exercise.id) { _, _ in seedShown() }
        .onChange(of: adjusting) { _, open in
            guard !open else { return }
            shownReps = draft.reps
            shownWeight = draft.weight
        }
        .onChange(of: model.remoteStamp) { _, _ in
            guard model.liveIndex == index else { return }
            shownReps = model.liveReps
            shownWeight = model.liveWeight
            draft.reps = model.liveReps
            draft.weight = model.liveWeight
            draft.seededID = exercise.id
        }
        .task(id: restToken) { await runRest() }
        .sheet(isPresented: $adjusting) {
            AdjustLoadSheet(draft: draft, exercise: exercise, index: index)
        }
    }

    private var activeBody: some View {
        VStack(spacing: 5) {
            Text("\(index + 1)/\(max(total, 1))")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.7))
                .frame(maxWidth: .infinity, alignment: .leading)
            ExerciseMedia(gifUrl: exercise.gifUrl)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            Text(exercise.name)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
            Button {
                adjusting = true
            } label: {
                HStack(spacing: 3) {
                    Text(loadLine)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .bold))
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.white.opacity(0.62))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            }
            .buttonStyle(.plain)
            HStack(spacing: 10) {
                roundIcon("chevron.left", fill: Color.white.opacity(0.14), size: 36, enabled: index > 0) {
                    if index > 0 { onPrevious() }
                }
                roundIcon(
                    "checkmark",
                    fill: exercise.openSetId == nil ? Color.white.opacity(0.14) : WatchTheme.red,
                    size: 46,
                    enabled: exercise.openSetId != nil,
                    glow: exercise.openSetId != nil
                ) {
                    log()
                }
                roundIcon("chevron.right", fill: Color.white.opacity(0.14), size: 36, enabled: index + 1 < total) {
                    if index + 1 < total { onNext() }
                }
            }
            Button("End") {
                Task { await model.cancelWorkout() }
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.white.opacity(0.45))
            .buttonStyle(.plain)
        }
    }

    private var restBody: some View {
        VStack(spacing: 8) {
            Spacer(minLength: 0)
            ZStack {
                WatchRing(
                    progress: WatchTheme.fraction(Double(restLeft), 45),
                    size: 112,
                    tint: WatchTheme.red,
                    glow: true
                )
                Text(WatchTheme.clock(restLeft))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                watchPill("Skip", symbol: "forward.end.fill", fill: Color.white.opacity(0.12)) {
                    finishRest()
                }
                watchPill("Next", symbol: "play.fill", fill: WatchTheme.red) {
                    finishRest()
                }
            }
        }
    }

    private var loadLine: String {
        let weight = shownWeight.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", shownWeight)
            : String(format: "%.1f", shownWeight)
        let load = "\(shownReps) × \(weight) kg"
        if let number = exercise.openSetNumber {
            return "Set \(number) · \(load)"
        }
        return load
    }

    private func log() {
        guard let setId = exercise.openSetId else { return }
        let finishes: Bool
        if let number = exercise.openSetNumber {
            finishes = number >= max(exercise.setCount, 1)
        } else {
            finishes = exercise.completedSets + 1 >= max(exercise.setCount, 1)
        }
        UserDefaults.standard.set(draft.weight, forKey: weightKey(exercise.name))
        Task { await model.logSet(setId: setId, reps: draft.reps, weight: draft.weight) }
        guard !finishes || index + 1 < total else { return }
        advanceAfterRest = finishes && index + 1 < total
        resting = true
        restToken += 1
    }

    private func runRest() async {
        guard resting else { return }
        restLeft = 45
        while resting && restLeft > 0 && !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1))
            guard resting, !Task.isCancelled else { return }
            restLeft -= 1
        }
        if resting { finishRest() }
    }

    private func finishRest() {
        guard resting else { return }
        let advance = advanceAfterRest
        resting = false
        advanceAfterRest = false
        if advance { onNext() }
    }

    private func seedShown() {
        if draft.seededID != exercise.id {
            let load = rememberedLoad(exercise)
            draft.reps = load.reps
            draft.weight = load.weight
            draft.seededID = exercise.id
        }
        shownReps = draft.reps
        shownWeight = draft.weight
    }

    private func weightKey(_ name: String) -> String {
        "rutina.watch.kg.\(name.lowercased())"
    }
}

private struct AdjustLoadSheet: View {
    @Environment(\.dismiss) private var dismiss
    var draft: LoadDraft
    var exercise: WatchExercise
    var index: Int

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Button("Cancel") { dismiss() }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .buttonStyle(.plain)
                Spacer(minLength: 28)
            }
            LoadSteppers(draft: draft, exercise: exercise, index: index)
            Spacer(minLength: 0)
            WatchAction(title: "Save") { dismiss() }
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(WatchTheme.ink)
    }
}

/// Kg and reps live here so a tap does not rebuild the GIF or the rest of the set page.
private struct LoadSteppers: View {
    @EnvironmentObject private var model: WatchDashboardModel
    var draft: LoadDraft
    var exercise: WatchExercise
    var index: Int
    @State private var reps = 8
    @State private var weight = 20.0

    var body: some View {
        VStack(spacing: 8) {
            SetStepper(title: "Adjust Reps", value: "\(reps)", down: { nudgeReps(-1) }, up: { nudgeReps(1) })
            SetStepper(title: "Adjust Weight", value: "\(weightLabel) kg", down: { nudgeWeight(-2.5) }, up: { nudgeWeight(2.5) })
        }
        .onAppear(perform: seed)
        .onChange(of: exercise.id) { _, _ in seed() }
        .onChange(of: model.remoteStamp) { _, _ in
            guard model.liveIndex == index else { return }
            apply(reps: model.liveReps, weight: model.liveWeight)
        }
    }

    private func nudgeReps(_ delta: Int) {
        let next = min(40, max(1, reps + delta))
        guard next != reps else { return }
        apply(reps: next, weight: weight)
        publish(reps: next, weight: weight)
    }

    private func nudgeWeight(_ delta: Double) {
        let next = snapWeight(weight + delta)
        guard next != weight else { return }
        apply(reps: reps, weight: next)
        publish(reps: reps, weight: next)
    }

    private func publish(reps: Int, weight: Double) {
        model.noteSet(
            index: index,
            setId: exercise.openSetId ?? "",
            reps: reps,
            weight: weight
        )
    }

    private var weightLabel: String {
        weight.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", weight)
            : String(format: "%.1f", weight)
    }

    private func seed() {
        if draft.seededID == exercise.id {
            apply(reps: draft.reps, weight: draft.weight)
            return
        }
        let load = rememberedLoad(exercise)
        apply(reps: load.reps, weight: load.weight)
        draft.seededID = exercise.id
    }

    private func apply(reps: Int, weight: Double) {
        let nextReps = min(40, max(1, reps))
        let nextWeight = snapWeight(weight)
        self.reps = nextReps
        self.weight = nextWeight
        draft.reps = nextReps
        draft.weight = nextWeight
    }
}

private struct SetStepper: View {
    var title: String
    var value: String
    var down: () -> Void
    var up: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            HStack(spacing: 0) {
                stepButton("minus", action: down)
                Text(value)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity)
                stepButton("plus", action: up)
            }
            .padding(4)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(WatchTheme.card)
            )
        }
    }

    private func stepButton(_ symbol: String, action: @escaping () -> Void) -> some View {
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
        let maxFrames = 8
        let step = max(1, Int(ceil(Double(count) / Double(maxFrames))))
        var frames: [UIImage] = []
        var delays: [Double] = []
        var index = 0
        let options: [CFString: Any] = [
            kCGImageSourceThumbnailMaxPixelSize: 280,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
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
    glow: Bool = false,
    action: @escaping () -> Void
) -> some View {
    Button(action: action) {
        Image(systemName: name)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Circle().fill(fill))
            .shadow(color: glow ? WatchTheme.red.opacity(0.55) : .clear, radius: glow ? 5 : 0)
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
    let reps = min(40, max(1, exercise.lastReps ?? suggestedReps(exercise.targetReps)))
    return (reps, snapWeight(exercise.lastWeightKg ?? remembered ?? 20))
}

private func suggestedReps(_ raw: String?) -> Int {
    guard let raw else { return 8 }
    let numbers = raw.split { !$0.isNumber }
    return min(40, max(1, Int(numbers.first ?? "") ?? 8))
}

struct CardioWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @StateObject private var clock = SecondClock()

    var body: some View {
        let cardio = model.today?.cardio
        let running = cardio?.status == "running"
        let paused = cardio?.status == "paused"
        let elapsed = elapsedSeconds(cardio)
        let minutes = elapsed / 60
        let planned = cardio?.plannedMinutes ?? 0
        VStack(spacing: 6) {
            WatchHeader(title: "Cardio", back: true)
            ScrollView {
                VStack(spacing: 8) {
                    HStack(alignment: .center, spacing: 8) {
                        ZStack {
                            WatchRing(
                                progress: planned > 0 ? WatchTheme.fraction(Double(minutes), Double(planned)) : (cardio?.completed == true ? 1 : 0),
                                size: 96,
                                tint: WatchTheme.cardio,
                                glow: true
                            )
                            VStack(spacing: 0) {
                                Image(systemName: "figure.run")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(WatchTheme.cardio)
                                Text("\(minutes)")
                                    .font(.system(size: 26, weight: .bold, design: .rounded))
                                    .foregroundStyle(.white)
                                Text(planned > 0 ? "/ \(planned) min" : "min")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(WatchTheme.mute)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                            }
                        }
                        .frame(width: 96, height: 96)
                        VStack(alignment: .leading, spacing: 5) {
                            Text("Today's Cardio")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                            Text(planned > 0 ? "\(minutes) / \(planned) min" : "\(minutes) min")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Color.white.opacity(0.65))
                            cardioStat("flame.fill", text: kcalText, tint: WatchTheme.kcal)
                            cardioStat("heart.fill", text: heartText, tint: WatchTheme.red)
                            cardioStat("shoeprints.fill", text: kmText, tint: WatchTheme.steps)
                        }
                    }
                    .padding(8)
                    .watchCard(16)

                    sessionRow(cardio, elapsed: elapsed)
                    if running || paused || cardio?.completed == true {
                        WatchAction(title: "Reset", symbol: "arrow.counterclockwise", fill: Color.white.opacity(0.14)) {
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
                .padding(.bottom, 6)
            }
            .scrollIndicators(.hidden)
            if cardio?.status != "none" && cardio != nil {
                WatchAction(
                    title: running ? "Pause" : (paused ? "Resume" : "Start"),
                    symbol: running ? "pause.fill" : "play.fill",
                    fill: WatchTheme.cardio
                ) {
                    Task {
                        if running {
                            await model.pauseCardio()
                        } else {
                            await model.startCardio()
                        }
                    }
                }
            }
        }
        .watchChrome()
        .onAppear { clock.setRunning(running) }
        .onChange(of: running) { _, isRunning in
            clock.setRunning(isRunning)
        }
    }

    private var kcalText: String {
        guard let kcal = model.moveKcal else { return "— kcal" }
        return "\(kcal.formatted()) kcal"
    }

    private var heartText: String {
        guard let bpm = model.moveHeart else { return "— bpm" }
        return "\(bpm) bpm avg"
    }

    private var kmText: String {
        guard let km = model.moveKm else { return "— km" }
        let text = String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), km)
        return "\(text) km"
    }

    private func cardioStat(_ symbol: String, text: String, tint: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 12)
            Text(text)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }

    private func sessionRow(_ cardio: WatchCardio?, elapsed: Int) -> some View {
        let title = cardio?.title?.isEmpty == false ? (cardio?.title ?? "Cardio") : "Cardio"
        let resting = cardio == nil || cardio?.status == "none"
        return HStack(spacing: 8) {
            Image(systemName: "figure.run")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(WatchTheme.cardio)
                .frame(width: 28, height: 28)
                .background(Circle().fill(WatchTheme.cardio.opacity(0.18)))
            VStack(alignment: .leading, spacing: 1) {
                Text(resting ? "Rest day" : title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(resting ? "Nothing scheduled" : statusText(cardio))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Text(resting ? "0 min" : "\(elapsed / 60) min")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .watchCard(14)
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

    private func statusText(_ cardio: WatchCardio?) -> String {
        switch cardio?.status {
        case "running": return "In progress"
        case "paused": return "Paused"
        case "completed": return "Done"
        case "none", nil: return "Rest day"
        default: return "Ready"
        }
    }
}

