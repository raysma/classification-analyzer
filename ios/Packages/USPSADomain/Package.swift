// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "USPSADomain",
    platforms: [.iOS(.v18), .macOS(.v14)],
    products: [
        .library(name: "USPSADomain", targets: ["USPSADomain"]),
    ],
    targets: [
        .target(
            name: "USPSADomain",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "USPSADomainTests",
            dependencies: ["USPSADomain"],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
    ]
)
