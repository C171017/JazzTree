// XCTest ships with Xcode, and this package is built on machines that may only
// have the Swift toolchain. The invariants themselves therefore live in
// `Verification.swift` inside the library, and this file is a thin wrapper that
// surfaces them as individual XCTest cases when Xcode *is* present.
//
// Without Xcode, run the same checks with:
//     swift run jazztree-verify

#if canImport(XCTest)
import XCTest
@testable import JazzTreeCore

final class JazzTreeCoreTests: XCTestCase {

    private static let library: Library = {
        do { return try DataLoader.load() }
        catch { fatalError("Bundled data failed to load: \(error)") }
    }()

    /// One assertion per invariant group, so a failure names the thing that broke.
    func testAllInvariants() throws {
        let report = Verification.run(library: Self.library)
        for check in report.checks {
            XCTAssertTrue(
                check.passed,
                "[\(check.group)] \(check.name)\n" + check.failures.map { "  → \($0)" }.joined(separator: "\n")
            )
        }
        XCTAssertTrue(report.passed, report.summary)
    }

    /// Cheap smoke test that the resource bundle is wired up in the app target too.
    func testDataLoads() throws {
        let library = try DataLoader.load()
        XCTAssertEqual(library.genres.count, 39)
        XCTAssertEqual(library.albums.count, 351)
    }

    func testLayoutPerformanceIsAcceptableForLaunch() throws {
        // The Map view builds this on first appearance; it must not stall a frame
        // budget noticeably on a phone. Measured well under 10ms on Apple silicon.
        let library = Self.library
        measure {
            _ = DAGLayout(genres: library.genres, lineage: library.lineage)
        }
    }
}
#endif
