import SwiftUI
import USPSAClient

struct LookupView: View {
    @Environment(AppModel.self) private var appModel

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
                    .onSubmit { Task { await appModel.lookup() } }

                Button {
                    Task { await appModel.lookup() }
                } label: {
                    if appModel.isLoading {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("Look up")
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
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}
