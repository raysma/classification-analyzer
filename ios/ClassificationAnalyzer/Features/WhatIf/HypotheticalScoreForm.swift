import SwiftUI

struct HypotheticalScoreForm: View {
    @Environment(AppModel.self) private var appModel
    @State private var input: String = ""
    @State private var errorMessage: String?

    private var isFull: Bool {
        appModel.hypotheticalScores.count >= 8
    }

    private var canAdd: Bool {
        !isFull && !input.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Add hypothetical score (max 8)")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)

            HStack {
                TextField("e.g. 69.69", text: $input)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 120)
                    .disabled(isFull)
                    .onChange(of: input) { _, _ in errorMessage = nil }

                Button("Add") { handleAdd() }
                    .buttonStyle(.borderedProminent)
                    .tint(.indigo)
                    .disabled(!canAdd)

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
        let trimmed = input.trimmingCharacters(in: .whitespaces)
        guard let value = Double(trimmed), value >= 0, value <= 110 else {
            errorMessage = "Enter a percent between 0 and 110"
            return
        }
        errorMessage = nil
        appModel.addHypothetical(percent: value)
        input = ""
    }
}
