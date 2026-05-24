import SwiftUI
import USPSADomain

struct DivisionPicker: View {
    @Environment(AppModel.self) private var appModel
    @Namespace private var glassNamespace

    var body: some View {
        let divisions = appModel.availableDivisions
        if divisions.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                if #available(iOS 26.0, *) {
                    GlassEffectContainer {
                        chipRow(divisions: divisions, useGlassIDs: true)
                    }
                } else {
                    chipRow(divisions: divisions, useGlassIDs: false)
                }
            }
        }
    }

    @ViewBuilder
    private func chipRow(divisions: [Division], useGlassIDs: Bool) -> some View {
        HStack(spacing: 8) {
            ForEach(divisions, id: \.self) { div in
                chip(for: div, useGlassIDs: useGlassIDs)
            }
        }
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private func chip(for div: Division, useGlassIDs: Bool) -> some View {
        let isSelected = div == appModel.selectedDivision
        Button {
            appModel.selectedDivision = div
        } label: {
            chipLabel(div: div, isSelected: isSelected, useGlassIDs: useGlassIDs)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func chipLabel(div: Division, isSelected: Bool, useGlassIDs: Bool) -> some View {
        let inner = Text(div.displayName)
            .font(.callout.weight(.medium))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .foregroundStyle(isSelected ? Color.white : Color.primary)

        if isSelected {
            inner.background(Color.accentColor, in: Capsule())
        } else if #available(iOS 26.0, *), useGlassIDs {
            inner
                .glassEffect(in: Capsule())
                .glassEffectID(div, in: glassNamespace)
        } else {
            inner.background(.thinMaterial, in: Capsule())
        }
    }
}
