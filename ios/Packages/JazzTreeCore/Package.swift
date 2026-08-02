// swift-tools-version:5.9
import PackageDescription

// JazzTreeCore is deliberately free of SwiftUI and UIKit. Everything that can be
// wrong about this app — JSON decoding, the lineage graph, the DAG layout, the
// localisation tables, the streaming URLs — lives here, so it can be built and
// tested from the command line with `swift test`, without Xcode.
let package = Package(
    name: "JazzTreeCore",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [
        .library(name: "JazzTreeCore", targets: ["JazzTreeCore"]),
        // Runs every dataset and layout invariant from the command line, so the
        // checks work on a machine with only the Swift toolchain installed.
        .executable(name: "jazztree-verify", targets: ["jazztree-verify"]),
    ],
    targets: [
        .target(
            name: "JazzTreeCore",
            resources: [.process("Resources")]
        ),
        .executableTarget(
            name: "jazztree-verify",
            dependencies: ["JazzTreeCore"]
        ),
        .testTarget(
            name: "JazzTreeCoreTests",
            dependencies: ["JazzTreeCore"]
        )
    ]
)
