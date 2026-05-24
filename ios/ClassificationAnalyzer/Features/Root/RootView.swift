import SwiftUI
import UIKit
import USPSADomain

struct RootView: View {
    @State private var selectedTab: Int = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            OverviewTab()
                .tabItem { Label("Overview", systemImage: "house") }
                .tag(0)

            WhatIfTab()
                .tabItem { Label("What-If", systemImage: "wand.and.stars") }
                .tag(1)

            ScoresTab()
                .tabItem { Label("Scores", systemImage: "list.bullet") }
                .tag(2)
        }
        .onChange(of: selectedTab) { _, _ in
            // Keyboard persists across tab switches in SwiftUI's TabView; the
            // previously-focused TextField stays focused but invisible, which
            // strands the keyboard. Force-dismiss on every switch.
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil, from: nil, for: nil
            )
        }
    }
}

// Helper used by the tabs that need a top-of-screen division switcher.
struct DivisionHeader: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        if appModel.effectiveRecord != nil {
            DivisionPicker()
                .padding(.vertical, 8)
        }
    }
}

struct EmptyStateView: View {
    let systemImage: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(40)
    }
}

struct WarningBanner: View {
    let warnings: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Heads up", systemImage: "exclamationmark.triangle.fill")
                .font(.callout.bold())
                .foregroundStyle(.orange)
            ForEach(warnings, id: \.self) { w in
                Text(w)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
    }
}
