// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "USPSAClient",
    platforms: [.iOS(.v18), .macOS(.v14)],
    products: [
        .library(name: "USPSAClient", targets: ["USPSAClient"]),
    ],
    dependencies: [
        .package(path: "../USPSADomain"),
    ],
    targets: [
        .target(
            name: "USPSAClient",
            dependencies: ["USPSADomain"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "USPSAClientTests",
            dependencies: ["USPSAClient", "USPSADomain"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
    ]
)
