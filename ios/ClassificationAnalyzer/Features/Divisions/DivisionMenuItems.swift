import SwiftUI
import USPSADomain

// Shared menu content used by toolbarTitleMenu on every tab that
// depends on a selected division. Empty when no record is loaded
// so the title menu disclosure chevron disappears.
struct DivisionMenuItems: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        if let selected = appModel.selectedDivision {
            ForEach(appModel.availableDivisions, id: \.self) { div in
                Button {
                    appModel.selectedDivision = div
                } label: {
                    if div == selected {
                        Label(div.displayName, systemImage: "checkmark")
                    } else {
                        Text(div.displayName)
                    }
                }
            }
        }
    }
}
