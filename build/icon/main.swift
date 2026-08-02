import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Draws the JazzTree app icon and writes the PNGs the asset catalog needs.
// Run: swift build/icon/main.swift  (macOS, CoreGraphics — no Xcode required)
//
// The mark is the rail: time running downward on the left, three influence branches
// peeling off to the right. Warm charcoal ground, ochre accent — same palette as the
// app and the web version.

let bg = CGColor(red: 0x13/255, green: 0x11/255, blue: 0x0E/255, alpha: 1)
let ochre = CGColor(red: 0xD2/255, green: 0x92/255, blue: 0x2F/255, alpha: 1)
let ink = CGColor(red: 0xEB/255, green: 0xE4/255, blue: 0xD7/255, alpha: 1)
let slate = CGColor(red: 0x7F/255, green: 0xA3/255, blue: 0xBD/255, alpha: 1)
let olive = CGColor(red: 0x8F/255, green: 0xA8/255, blue: 0x67/255, alpha: 1)
let rust = CGColor(red: 0xC4/255, green: 0x68/255, blue: 0x5A/255, alpha: 1)

func draw(size: Int) -> CGImage? {
    let s = CGFloat(size)
    guard let ctx = CGContext(
        data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }

    ctx.setFillColor(bg)
    ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))

    // Core Graphics origin is bottom-left; the design is described top-down, so
    // flip once and think in screen coordinates from here on.
    ctx.translateBy(x: 0, y: s)
    ctx.scaleBy(x: 1, y: -1)

    let u = s / 100                     // design units, icon is 100×100
    let spineX = 28 * u
    let top = 17 * u
    let bottom = 83 * u

    // The spine: time running downward.
    ctx.setStrokeColor(ochre)
    ctx.setLineWidth(5 * u)
    ctx.setLineCap(.round)
    ctx.move(to: CGPoint(x: spineX, y: top))
    ctx.addLine(to: CGPoint(x: spineX, y: bottom))
    ctx.strokePath()

    // Three branches peeling off to the right, at the three family colours.
    struct Branch { let y: CGFloat; let length: CGFloat; let color: CGColor }
    // Four branches, one per family, so the mark carries the same colour coding
    // the app does and the composition fills the square.
    let branches = [
        Branch(y: 32, length: 34, color: ink),
        Branch(y: 47, length: 48, color: slate),
        Branch(y: 62, length: 40, color: olive),
        Branch(y: 76, length: 26, color: rust),
    ]
    for branch in branches {
        let y = branch.y * u
        ctx.setStrokeColor(branch.color)
        ctx.setLineWidth(4 * u)
        ctx.move(to: CGPoint(x: spineX, y: y))
        ctx.addCurve(
            to: CGPoint(x: spineX + branch.length * u, y: y),
            control1: CGPoint(x: spineX + 14 * u, y: y - 9 * u),
            control2: CGPoint(x: spineX + 16 * u, y: y)
        )
        ctx.strokePath()

        // Node at the end of each branch.
        ctx.setFillColor(branch.color)
        ctx.fillEllipse(in: CGRect(
            x: spineX + branch.length * u - 4 * u, y: y - 4 * u,
            width: 8 * u, height: 8 * u
        ))
    }

    // Origin node on the spine, larger, to read as the root at small sizes.
    ctx.setFillColor(ochre)
    ctx.fillEllipse(in: CGRect(x: spineX - 6.5 * u, y: top - 2 * u, width: 13 * u, height: 13 * u))

    return ctx.makeImage()
}

func write(_ image: CGImage, to url: URL) throws {
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "icon", code: 1)
    }
    CGImageDestinationAddImage(dest, image, nil)
    guard CGImageDestinationFinalize(dest) else { throw NSError(domain: "icon", code: 2) }
}

let outDir = URL(fileURLWithPath: "ios/JazzTree/Assets.xcassets/AppIcon.appiconset")
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

// Xcode 15+ single-size app icon, plus the legacy sizes so the catalog works on
// older toolchains too.
let sizes = [1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20]
for size in sizes {
    guard let image = draw(size: size) else { continue }
    try write(image, to: outDir.appendingPathComponent("icon-\(size).png"))
}
print("wrote \(sizes.count) icon PNGs to \(outDir.path)")
