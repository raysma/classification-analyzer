import SwiftUI
import UIKit
import USPSADomain

struct RootView: View {
    @State private var selectedTab: Int = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            LookupTab(selectedTab: $selectedTab)
                .tabItem { Label("Lookup", systemImage: "magnifyingglass") }
                .tag(0)

            OverviewTab(selectedTab: $selectedTab)
                .tabItem { Label("Overview", systemImage: "person.text.rectangle") }
                .tag(1)

            WhatIfTab(selectedTab: $selectedTab)
                .tabItem { Label("What-If", systemImage: "wand.and.stars") }
                .tag(2)

            ScoresTab(selectedTab: $selectedTab)
                .tabItem { Label("Scores", systemImage: "list.bullet") }
                .tag(3)
        }
        .onChange(of: selectedTab) { _, _ in
            // SwiftUI's TabView keeps focus on the previously-focused TextField
            // when its parent tab leaves the screen, stranding the keyboard
            // with no visible field to dismiss against. Force it down.
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil, from: nil, for: nil
            )
        }
    }
}

struct EmptyStateView: View {
    let systemImage: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
            }
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
