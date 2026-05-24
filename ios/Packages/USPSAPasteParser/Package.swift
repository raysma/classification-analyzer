// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "USPSAPasteParser",
    platforms: [.iOS(.v18), .macOS(.v14)],
    products: [
        .library(name: "USPSAPasteParser", targets: ["USPSAPasteParser"]),
    ],
    dependencies: [
        .package(path: "../USPSADomain"),
    ],
    targets: [
        .target(
            name: "USPSAPasteParser",
            dependencies: ["USPSADomain"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "USPSAPasteParserTests",
            dependencies: ["USPSAPasteParser", "USPSADomain"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
    ]
)
