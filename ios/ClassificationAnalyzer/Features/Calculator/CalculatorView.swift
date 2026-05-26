import SwiftUI
import USPSADomain
import USPSARules

struct CalculatorView: View {
    @Environment(AppModel.self) private var appModel
    @Binding var selectedTab: Int

    @State private var division: Division
    @State private var code: String
    @State private var hfText: String = ""
    @State private var result: ClassificationResult?
    @State private var resultDivision: Division?
    @State private var resultCode: String?

    private let activeClassifiers: [ActiveClassifier]

    init(selectedTab: Binding<Int>, defaultDivision: Division? = nil) {
        _selectedTab = selectedTab
        let initialDivision = defaultDivision ?? .carryOptics
        _division = State(initialValue: initialDivision)
        let list = HHFTable.activeClassifiers()
        self.activeClassifiers = list
        _code = State(initialValue: list.first?.code ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    inputs
                    actions
                    if let result, let resultDivision {
                        resultChip(result: result, division: resultDivision)
                    }
                    if willSwitchDivision, let resultDivision {
                        warningBanner(switchingTo: resultDivision)
                    }
                }
                .padding()
            }
            .navigationTitle("Calculator")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Classifier calculator")
                .font(.title3.weight(.semibold))
            Text("Enter a classifier hit factor to see the percentage and class letter, then optionally send it to What-If as a hypothetical score.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inputs: some View {
        VStack(alignment: .leading, spacing: 10) {
            labelled("Division") {
                Picker("Division", selection: $division) {
                    ForEach(Division.allCases, id: \.self) { d in
                        Text(d.displayName).tag(d)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: division) { _, _ in clearResult() }
            }

            labelled("Classifier") {
                Picker("Classifier", selection: $code) {
                    ForEach(activeClassifiers) { c in
                        Text("\(c.code) — \(c.name)").tag(c.code)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: code) { _, _ in clearResult() }
            }

            labelled("Hit factor") {
                TextField("e.g. 9.0749", text: $hfText)
                    .keyboardType(.decimalPad)
                    .submitLabel(.go)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(calculate)
                    .onChange(of: hfText) { _, _ in clearResult() }
            }
        }
    }

    private func labelled<Content: View>(
        _ title: String, @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
            content()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var actions: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Button("Calculate", action: calculate)
                    .buttonStyle(.borderedProminent)

                Button("Send to What-If", action: sendToWhatIf)
                    .buttonStyle(.bordered)
                    .tint(.indigo)
                    .disabled(sendDisabledReason != nil)
            }
            if let reason = sendDisabledReason {
                Text(reason)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func resultChip(result: ClassificationResult, division: Division) -> some View {
        HStack(spacing: 12) {
            letterPill(letter: result.letter)
            VStack(alignment: .leading, spacing: 2) {
                Text(String(format: "%.4f%%", result.pct))
                    .font(.title2.bold().monospacedDigit())
                    .contentTransition(.numericText())
                Text("HHF \(String(format: "%.4f", result.hhf)) · \(division.displayName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .refinedSurface()
    }

    private func letterPill(letter: ClassLetter) -> some View {
        Text(letter.rawValue)
            .font(.headline.bold())
            .frame(width: 44, height: 32)
            .background(letter.fillColor, in: Capsule())
            .foregroundStyle(letter.foregroundColor)
    }

    private func warningBanner(switchingTo target: Division) -> some View {
        Text("Sending will switch the selected division to \(target.displayName), which clears the existing What-If scenario.")
            .font(.footnote)
            .foregroundStyle(.orange)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Behaviour

    private var hasRecord: Bool {
        appModel.effectiveRecord != nil
    }

    private var scenarioFull: Bool {
        appModel.hypotheticalScores.count >= 8
    }

    private var willSwitchDivision: Bool {
        guard let resultDivision, hasRecord else { return false }
        guard !appModel.hypotheticalScores.isEmpty else { return false }
        return resultDivision != appModel.selectedDivision
    }

    private var sendDisabledReason: String? {
        if result == nil || resultDivision == nil { return "Calculate a percentage first." }
        if !hasRecord { return "Look up a shooter first to send hypotheticals to What-If." }
        if scenarioFull { return "What-If already has the maximum of 8 hypothetical scores." }
        return nil
    }

    private func clearResult() {
        if result != nil { result = nil }
        if resultDivision != nil { resultDivision = nil }
        if resultCode != nil { resultCode = nil }
    }

    private func calculate() {
        let trimmed = hfText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let hf = Double(trimmed),
              let r = Calculator.classify(hitFactor: hf, code: code, division: division)
        else {
            clearResult()
            return
        }
        result = r
        resultDivision = division
        resultCode = code
    }

    private func sendToWhatIf() {
        guard let result, let resultDivision, let resultCode,
              hasRecord, !scenarioFull
        else { return }
        appModel.selectedDivision = resultDivision
        appModel.addHypothetical(
            percent: result.pct,
            date: todayLocalISO(),
            classifierCode: resultCode
        )
        selectedTab = 2
    }

    private func todayLocalISO() -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}
