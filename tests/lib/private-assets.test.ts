import { describe, expect, test } from "bun:test"
import {
  assertSafeAssetPath,
  contentTypeForPath,
  sha256,
} from "../../scripts/lib/private-assets"
import { parseMediaManifest } from "../../scripts/manage-private-media"

const validAsset = {
  contentType: "image/webp",
  group: "build" as const,
  key: "src/content/blog/example/assets/banner.webp",
  localPath: "src/content/blog/example/assets/banner.webp",
  sha256: "a".repeat(64),
  size: 42,
}

describe("private asset paths", () => {
  test("accepts repository-relative object keys", () => {
    expect(() => assertSafeAssetPath(validAsset.localPath)).not.toThrow()
  })

  test.each([
    "",
    "/tmp/file",
    "../file",
    "assets/../file",
    "a\\b",
  ])("rejects unsafe path %s", (path) => {
    expect(() => assertSafeAssetPath(path)).toThrow()
  })
})

describe("private media manifest", () => {
  test("accepts a valid manifest", () => {
    expect(parseMediaManifest({ version: 1, assets: [validAsset] })).toEqual({
      version: 1,
      assets: [validAsset],
    })
  })

  test("rejects duplicate paths", () => {
    expect(() =>
      parseMediaManifest({
        version: 1,
        assets: [validAsset, { ...validAsset }],
      }),
    ).toThrow("Duplicate private media path")
  })

  test("requires object keys to match local paths", () => {
    expect(() =>
      parseMediaManifest({
        version: 1,
        assets: [{ ...validAsset, key: "different.webp" }],
      }),
    ).toThrow("must match its local path")
  })
})

describe("private asset metadata", () => {
  test("calculates stable SHA-256 hashes", () => {
    expect(sha256(Buffer.from("enscribe"))).toBe(
      "870a07f7e02cda17e3c0ca7d15ccb5abf8e83b21cbf3f400cbfeca4dd684613f",
    )
  })

  test("maps web asset content types", () => {
    expect(contentTypeForPath("image.svg")).toBe("image/svg+xml")
    expect(contentTypeForPath("clip.mp4")).toBe("video/mp4")
    expect(contentTypeForPath("font.woff2")).toBe("font/woff2")
  })
})
