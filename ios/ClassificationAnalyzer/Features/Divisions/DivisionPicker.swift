import SwiftUI
import USPSADomain

struct DivisionPicker: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        let divisions = appModel.availableDivisions
        if divisions.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(divisions, id: \.self) { div in
                        chip(for: div)
                    }
                }
                .padding(.horizontal, 4)
            }
        }
    }

    @ViewBuilder
    private func chip(for div: Division) -> some View {
        let isSelected = div == appModel.selectedDivision
        Button {
            appModel.selectedDivision = div
        } label: {
            Text(div.displayName)
                .font(.callout.weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(background(isSelected: isSelected), in: Capsule())
                .foregroundStyle(isSelected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
    }

    private func background(isSelected: Bool) -> AnyShapeStyle {
        isSelected ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.thinMaterial)
    }
}
