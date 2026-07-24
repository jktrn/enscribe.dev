import { resolve } from "node:path"
import {
  contentTypeForPath,
  prepareAssets,
  type PrivateAsset,
  uploadAssets,
  verifyRemoteAssets,
} from "./lib/private-assets"

const webFonts = [
  {
    localPath: "src/assets/fonts/MDLorien-Regular.woff2",
    sha256: "e16471f7c0944b00895a71c3654f39fadd093736e664856d462612978ffdd66f",
    size: 82_536,
  },
  {
    localPath: "src/assets/fonts/MDLorien-Italic.woff2",
    sha256: "97625f0151e3a3a6846be286431613f3b6666cbae21223e400a2c58d37bef5c1",
    size: 118_200,
  },
] as const

const graphicsFonts = [
  {
    localPath: "graphics/fonts/MDLorien-Regular.otf",
    sha256: "18b6c8872dc6ad430479421bf72ca519f4dd664410ee5d52b1db45c7b8218624",
    size: 257_200,
  },
  {
    localPath: "graphics/fonts/MDLorien-Italic.otf",
    sha256: "03ce13ef63e58151b729fa658cd94452a7568874d2112b54b876f01bcdf70af2",
    size: 363_496,
  },
] as const

function asPrivateAssets(
  fonts: readonly { localPath: string; sha256: string; size: number }[],
): PrivateAsset[] {
  return fonts.map((font) => ({
    ...font,
    contentType: contentTypeForPath(font.localPath),
    key: font.localPath,
  }))
}

const repoRoot = resolve(import.meta.dir, "..")
const fontBucket = process.env.R2_FONTS_BUCKET ?? "enscribe-licensed-fonts"
const webFontAssets = asPrivateAssets(webFonts)
const graphicsFontAssets = asPrivateAssets(graphicsFonts)
const fontAssets = [...webFontAssets, ...graphicsFontAssets]
const mode = process.argv[2]

if (mode === "prepare") {
  await prepareAssets(fontBucket, repoRoot, webFontAssets)
} else if (mode === "prepare-graphics") {
  await prepareAssets(fontBucket, repoRoot, graphicsFontAssets)
} else if (mode === "upload") {
  await uploadAssets(fontBucket, repoRoot, fontAssets)
} else if (mode === "verify") {
  await verifyRemoteAssets(fontBucket, fontAssets)
} else {
  throw new Error(
    "Usage: manage-licensed-fonts.ts <prepare|prepare-graphics|upload|verify>",
  )
}
