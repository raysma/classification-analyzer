// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "USPSARules",
    platforms: [.iOS(.v18), .macOS(.v14)],
    products: [
        .library(name: "USPSARules", targets: ["USPSARules"]),
    ],
    dependencies: [
        .package(path: "../USPSADomain"),
    ],
    targets: [
        .target(
            name: "USPSARules",
            dependencies: ["USPSADomain"],
            resources: [.process("Resources")],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "USPSARulesTests",
            dependencies: ["USPSARules", "USPSADomain"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
    ]
)
