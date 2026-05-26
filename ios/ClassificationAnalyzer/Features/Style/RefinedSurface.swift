import SwiftUI

// Single point of change for "card-style surface" — Liquid Glass on iOS 26+,
// thin Material on iOS 18. Every card-shaped view in the app calls this
// instead of hardcoding .background(.thinMaterial, in: ...) so we don't have
// to grep-and-edit every component when the design language changes.
struct RefinedSurface<S: Shape>: ViewModifier {
    let shape: S

    @ViewBuilder
    func body(content: Content) -> some View {
        // `.glassEffect` is an iOS 26 SDK symbol (Xcode 17+, Swift 6.2+).
        // `if #available` is only a runtime check — the compiler still has
        // to resolve the symbol, and on Xcode 16.x SDKs (which CI uses) it
        // doesn't exist. Gate the entire branch with #if compiler so the
        // call is invisible to older compilers and we fall back to Material.
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            content.glassEffect(in: shape)
        } else {
            content.background(.thinMaterial, in: shape)
        }
        #else
        content.background(.thinMaterial, in: shape)
        #endif
    }
}

extension View {
    func refinedSurface(corner: CGFloat = 12) -> some View {
        modifier(RefinedSurface(shape: RoundedRectangle(cornerRadius: corner)))
    }

    func refinedSurface<S: Shape>(in shape: S) -> some View {
        modifier(RefinedSurface(shape: shape))
    }
}
