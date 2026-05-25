import SwiftUI

struct RecentsList: View {
    @Environment(AppModel.self) private var appModel
    @Binding var selectedTab: Int

    var body: some View {
        if !appModel.recentLookups.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Recent lookups")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)

                ForEach(Array(appModel.recentLookups.enumerated()), id: \.element.id) { index, entry in
                    row(entry)
                    if index < appModel.recentLookups.count - 1 {
                        Divider()
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .refinedSurface()
        }
    }

    // Row uses .onTapGesture rather than wrapping in a Button because the
    // trash icon is itself a Button — nested Buttons would both fire on tap
    // and SwipeActions doesn't apply outside List, so we mirror the web's
    // "tap row to re-lookup, tap trash to delete" affordance instead.
    private func row(_ entry: RecentLookup) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.memberNumber)
                    .font(.system(.body, design: .monospaced))
                Text(entry.name)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(entry.lastLookedUpAt, format: .relative(presentation: .named))
                .font(.caption2)
                .foregroundStyle(.tertiary)
            Button {
                appModel.removeRecent(memberNumber: entry.memberNumber)
            } label: {
                Image(systemName: "trash")
                    .foregroundStyle(.secondary)
                    .padding(.leading, 4)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(entry.memberNumber) from recent lookups")
        }
        .contentShape(Rectangle())
        .onTapGesture { handleTap(entry) }
    }

    private func handleTap(_ entry: RecentLookup) {
        appModel.memberNumber = entry.memberNumber
        Task {
            await appModel.lookup()
            if appModel.lastError == nil && appModel.effectiveRecord != nil {
                selectedTab = 1
            }
        }
    }
}
