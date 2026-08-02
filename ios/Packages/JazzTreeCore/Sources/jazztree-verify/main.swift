import Foundation
import JazzTreeCore

// Runs every dataset and layout invariant and exits non-zero on failure, so it can
// be wired into CI on a machine with no Xcode installed:
//     swift run jazztree-verify

let start = Date()

let library: Library
do {
    library = try DataLoader.load()
} catch {
    FileHandle.standardError.write(Data("FATAL: \(error)\n".utf8))
    exit(2)
}

let report = Verification.run(library: library)

print("JazzTree core verification")
print(String(repeating: "─", count: 62))
var lastGroup = ""
for check in report.checks {
    if check.group != lastGroup {
        print("\n\(check.group.uppercased())")
        lastGroup = check.group
    }
    print("  \(check.passed ? "✓" : "✗") \(check.name)")
    for failure in check.failures {
        print("      → \(failure)")
    }
}
print(String(repeating: "─", count: 62))
print(report.summary + String(format: " in %.2fs", Date().timeIntervalSince(start)))
exit(report.passed ? 0 : 1)
