import Capacitor
import HealthKit

/// Reads the day's step total from Apple Health. Read-only.
@objc(HealthStepsPlugin)
public class HealthStepsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthStepsPlugin"
    public let jsName = "HealthSteps"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getSteps", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()

    @objc func getSteps(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve([
                "available": false,
                "steps": 0
            ])
            return
        }

        guard let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            call.resolve([
                "available": false,
                "steps": 0
            ])
            return
        }

        let dateKey = call.getString("date") ?? ""
        healthStore.requestAuthorization(toShare: [], read: [stepType]) { [weak self] granted, error in
            guard let self else { return }
            if let error {
                call.reject(error.localizedDescription)
                return
            }
            guard granted else {
                call.resolve([
                    "available": true,
                    "permitted": false,
                    "steps": 0
                ])
                return
            }
            self.querySteps(stepType: stepType, dateKey: dateKey, call: call)
        }
    }

    private func querySteps(stepType: HKQuantityType, dateKey: String, call: CAPPluginCall) {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"

        let day = formatter.date(from: dateKey) ?? Date()
        let start = calendar.startOfDay(for: day)
        guard let end = calendar.date(byAdding: .day, value: 1, to: start) else {
            call.reject("Could not read that day.")
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let query = HKStatisticsQuery(
            quantityType: stepType,
            quantitySamplePredicate: predicate,
            options: .cumulativeSum
        ) { _, result, error in
            if let error {
                call.reject(error.localizedDescription)
                return
            }
            let steps = result?.sumQuantity()?.doubleValue(for: .count()) ?? 0
            call.resolve([
                "available": true,
                "permitted": true,
                "steps": Int(steps.rounded())
            ])
        }
        healthStore.execute(query)
    }
}
