import SwiftUI
import USPSAClient

struct LookupView: View {
    @Environment(AppModel.self) private var appModel
    @State private var showingPasteSheet: Bool = false
    @FocusState private var memberFieldFocused: Bool

    var body: some View {
        @Bindable var model = appModel

        VStack(alignment: .leading, spacing: 12) {
            Text("Member number")
                .font(.headline)

            HStack {
                TextField("e.g. A12345", text: $model.memberNumber)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .submitLabel(.search)
                    .focused($memberFieldFocused)
                    .onSubmit { triggerLookup() }
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("Done") { memberFieldFocused = false }
                        }
                    }

                Button {
                    triggerLookup()
                } label: {
                    ZStack {
                        Text("Look up")
                            .opacity(appModel.isLoading ? 0 : 1)
                        if appModel.isLoading {
                            ProgressView()
                                .controlSize(.small)
                                .tint(.white)
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(
                    appModel.memberNumber.trimmingCharacters(in: .whitespaces).isEmpty
                        || appModel.isLoading
                )
            }

            if let error = appModel.lastError {
                Text(error.localizedDescription)
                    .font(.callout)
                    .foregroundStyle(.red)
            }

            Button {
                memberFieldFocused = false
                showingPasteSheet = true
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "doc.on.clipboard")
                    Text("Paste classifier data manually")
                }
                .font(.subheadline)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
        .sheet(isPresented: $showingPasteSheet) {
            ManualPasteSheet()
                .environment(appModel)
        }
    }

    private func triggerLookup() {
        memberFieldFocused = false
        Task { await appModel.lookup() }
    }
}
