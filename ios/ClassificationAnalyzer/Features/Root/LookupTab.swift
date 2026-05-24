import SwiftUI
import UIKit
import USPSAClient
import USPSADomain

struct LookupTab: View {
    @Environment(AppModel.self) private var appModel
    @Binding var selectedTab: Int

    @State private var showingPasteSheet: Bool = false
    @State private var pasteRecordSnapshot: ShooterRecord?
    @FocusState private var memberFieldFocused: Bool

    var body: some View {
        @Bindable var model = appModel

        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    lookupCard(memberNumber: $model.memberNumber)
                    pasteCard
                    // Recents list lands here in a follow-up — last N member
                    // numbers persisted to UserDefaults, tap to re-fetch.
                }
                .padding()
                .contentShape(Rectangle())
                .onTapGesture { dismissKeyboard() }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Lookup")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingPasteSheet, onDismiss: handlePasteSheetDismiss) {
                ManualPasteSheet()
                    .environment(appModel)
            }
        }
    }

    private func lookupCard(memberNumber: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Member number")
                .font(.headline)

            HStack {
                TextField("e.g. A12345", text: memberNumber)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .submitLabel(.search)
                    .focused($memberFieldFocused)
                    .onSubmit { triggerLookup() }
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button {
                                memberFieldFocused = false
                            } label: {
                                Image(systemName: "keyboard.chevron.compact.down")
                                    .font(.title3)
                            }
                            .accessibilityLabel("Dismiss keyboard")
                        }
                    }

                Button {
                    triggerLookup()
                } label: {
                    ZStack {
                        // Hidden "Look up" reserves consistent button width
                        // across the loading / idle states so the TextField
                        // next to it doesn't grow and shrink.
                        Text("Look up").opacity(0)
                        if appModel.isLoading {
                            ProgressView()
                                .controlSize(.small)
                                .tint(.white)
                        } else {
                            Text("Look up")
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
            }

            if let error = appModel.lastError {
                Text(error.localizedDescription)
                    .font(.callout)
                    .foregroundStyle(.red)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
    }

    private var pasteCard: some View {
        Button {
            pasteRecordSnapshot = appModel.pastedRecord
            showingPasteSheet = true
            memberFieldFocused = false
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "doc.on.clipboard")
                    .font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Paste classifier data manually")
                        .font(.subheadline.weight(.medium))
                    Text("Use when the API is blocked or for a record you've copied.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .refinedSurface()
    }

    private func dismissKeyboard() {
        memberFieldFocused = false
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil, from: nil, for: nil
        )
    }

    private func triggerLookup() {
        // Guards in code instead of .disabled() on the button — the iOS 26
        // borderedProminent disabled state renders near-black in dark mode,
        // making the button unreadable both with no input and during loading.
        // Keep the button visually enabled and refuse-to-act here.
        guard !appModel.isLoading else { return }
        let cleaned = appModel.memberNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else {
            memberFieldFocused = true
            return
        }
        memberFieldFocused = false
        Task {
            await appModel.lookup()
            if appModel.lastError == nil && appModel.effectiveRecord != nil {
                selectedTab = 1
            }
        }
    }

    private func handlePasteSheetDismiss() {
        if appModel.pastedRecord != pasteRecordSnapshot {
            selectedTab = 1
        }
    }
}
