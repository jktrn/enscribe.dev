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
    sha256: "674251f4e92f683701efdf191f6e38d31045f339eaa8b4d223f2ba74893697c3",
    size: 82_392,
  },
  {
    localPath: "src/assets/fonts/MDLorien-Italic.woff2",
    sha256: "0b7b1f3efaa5305afbb2ceb97ae5e9a94bf0e6f0dfc3732cbeb5184229a31579",
    size: 118_180,
  },
  {
    localPath: "src/assets/fonts/MDLorienSC-Regular.woff2",
    sha256: "f7705505e55c90510fe7f719c4a4797836c0769df73f2f7e57fd747ce436b60e",
    size: 82_288,
  },
  {
    localPath: "src/assets/fonts/MDLorienSC-Italic.woff2",
    sha256: "e243cff1f354b48a7ff604dca89f7c4c1cbd0ad39678fe71ad7b1ee2e91dfa57",
    size: 117_988,
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
