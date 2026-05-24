import SwiftUI

// Single point of change for "card-style surface" — Liquid Glass on iOS 26+,
// thin Material on iOS 18. Every card-shaped view in the app calls this
// instead of hardcoding .background(.thinMaterial, in: ...) so we don't have
// to grep-and-edit every component when the design language changes.
struct RefinedSurface<S: Shape>: ViewModifier {
    let shape: S

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(in: shape)
        } else {
            content.background(.thinMaterial, in: shape)
        }
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
