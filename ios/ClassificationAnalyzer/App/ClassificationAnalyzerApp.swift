import SwiftUI

@main
struct ClassificationAnalyzerApp: App {
    @State private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appModel)
                .onOpenURL { url in
                    DeepLinkRouter.handle(url, into: appModel)
                }
        }
    }
}
