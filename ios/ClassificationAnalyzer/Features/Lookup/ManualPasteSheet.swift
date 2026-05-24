import SwiftUI
import USPSADomain
import USPSAPasteParser

struct ManualPasteSheet: View {
    @Environment(AppModel.self) private var appModel
    @Environment(\.dismiss) private var dismiss

    @State private var division: Division = .carryOptics
    @State private var pastedText: String = ""
    @State private var statusMessage: String?
    @State private var statusIsError: Bool = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Division") {
                    Picker("Division", selection: $division) {
                        ForEach(Division.allCases, id: \.self) { div in
                            Text(div.displayName).tag(div)
                        }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                }

                Section {
                    TextEditor(text: $pastedText)
                        .font(.callout.monospaced())
                        .frame(minHeight: 180)
                        .scrollContentBackground(.hidden)
                } header: {
                    Text("Classifier table")
                } footer: {
                    Text("Open your USPSA classification page, select the classifier table for one division, copy, and paste here.")
                        .font(.caption)
                }

                if let message = statusMessage {
                    Section {
                        Text(message)
                            .font(.callout)
                            .foregroundStyle(statusIsError ? .red : .green)
                    }
                }

                if let pasted = appModel.pastedRecord {
                    Section("Pasted record") {
                        Text("Divisions: \(pasted.classifiers.keys.map { $0.displayName }.sorted().joined(separator: ", "))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Button("Clear pasted record", role: .destructive) {
                            appModel.clearPastedRecord()
                            statusMessage = nil
                        }
                    }
                }
            }
            .navigationTitle("Manual paste")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Parse") { handleParse() }
                        .disabled(pastedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func handleParse() {
        statusMessage = nil
        do {
            let result = try parsePastedTable(pastedText)
            appModel.applyPaste(classifiers: result.classifiers, division: division, warnings: result.warnings)
            statusIsError = false
            let plural = result.parsedRows == 1 ? "" : "s"
            var msg = "Parsed \(result.parsedRows) row\(plural)"
            if result.skippedRows > 0 {
                msg += ", skipped \(result.skippedRows)"
            }
            msg += ". \(division.displayName) added to record."
            statusMessage = msg
            pastedText = ""
        } catch {
            statusIsError = true
            statusMessage = "Could not parse any rows. Make sure you pasted the classifier table from USPSA."
        }
    }
}
