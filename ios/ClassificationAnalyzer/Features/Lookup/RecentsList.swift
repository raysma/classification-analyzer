import SwiftUI

struct RecentsList: View {
    @Environment(AppModel.self) private var appModel
    @Binding var selectedTab: Int

    // List can't auto-size to its content inside a ScrollView, so we feed it
    // an explicit height. 64pt is the measured row height for the
    // body+subheadline VStack with the listRowInsets below.
    private static let rowHeight: CGFloat = 64

    var body: some View {
        if !appModel.recentLookups.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("Recent lookups")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)

                List {
                    ForEach(appModel.recentLookups) { entry in
                        rowView(entry)
                            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(.secondary.opacity(0.25))
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    appModel.removeRecent(memberNumber: entry.memberNumber)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
                .listStyle(.plain)
                .scrollDisabled(true)
                .scrollContentBackground(.hidden)
                .frame(height: Self.rowHeight * CGFloat(appModel.recentLookups.count))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .refinedSurface()
        }
    }

    private func rowView(_ entry: RecentLookup) -> some View {
        Button {
            handleTap(entry)
        } label: {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.memberNumber)
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(.primary)
                    Text(entry.name)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Text(entry.lastLookedUpAt, format: .relative(presentation: .named))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
