import SwiftUI

struct HypotheticalScoreForm: View {
    @Environment(AppModel.self) private var appModel
    @State private var input: String = ""
    @State private var errorMessage: String?
    @FocusState private var inputFocused: Bool

    private var isFull: Bool {
        appModel.hypotheticalScores.count >= 8
    }

    private var hasChanges: Bool {
        !appModel.hypotheticalScores.isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Add hypothetical score (max 8)")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                Spacer()
                if hasChanges {
                    Button("Reset") { appModel.resetScenario() }
                        .font(.caption)
                        .buttonStyle(.plain)
                        .underline()
                        .foregroundStyle(.secondary)
                }
            }

            HStack {
                TextField("e.g. 69.6969", text: $input)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 120)
                    .disabled(isFull)
                    .focused($inputFocused)
                    .onChange(of: input) { _, _ in errorMessage = nil }

                Button("Add") { handleAdd() }
                    .buttonStyle(.borderedProminent)

                Spacer()
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            if isFull {
                Text("Maximum 8 hypothetical scores reached.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private func handleAdd() {
        // Same pattern as the Look-up button: never .disabled(), guard in
        // the handler. Dark mode + iOS 26 .borderedProminent disabled state
        // is unreadable, so the Add button stays visually enabled and
        // refuse-to-act here when there's nothing to add.
        guard !isFull else { return }
        let trimmed = input.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            inputFocused = true
            return
        }
        guard let value = Double(trimmed), value >= 0, value <= 110 else {
            errorMessage = "Enter a percent between 0 and 110"
            return
        }
        errorMessage = nil
        appModel.addHypothetical(percent: value)
        input = ""
        inputFocused = false
    }
}
