import { describe, expect, test } from "bun:test"
import { rejects } from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { S3Client } from "@aws-sdk/client-s3"
import {
  assertSafeAssetPath,
  contentTypeForPath,
  downloadAsset,
  sha256,
  uploadAsset,
} from "../../scripts/assets/lib/r2"
import { parseMediaManifest } from "../../scripts/assets/lib/manifest"
import { assetPaths } from "../../scripts/assets/lib/paths"
import { generateMediaManifest } from "../../scripts/assets/manifest"
import { graphicsFontAssets } from "../../scripts/assets/fonts"

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

  test("allows stable object keys with different local paths", () => {
    const relocated = {
      ...validAsset,
      key: "graphics/blog/example/banner.webp",
      localPath: "scripts/assets/sources/blog/example/banner.webp",
    }
    expect(
      parseMediaManifest({ version: 1, assets: [relocated] }).assets,
    ).toEqual([relocated])
  })

  test("rejects duplicate object keys even when local paths differ", () => {
    expect(() =>
      parseMediaManifest({
        version: 1,
        assets: [validAsset, { ...validAsset, localPath: "different.webp" }],
      }),
    ).toThrow("Duplicate private media key")
  })

  test("validates local paths and object keys independently", () => {
    for (const field of ["key", "localPath"]) {
      expect(() =>
        parseMediaManifest({
          version: 1,
          assets: [{ ...validAsset, [field]: "../outside.webp" }],
        }),
      ).toThrow("Unsafe private asset path")
    }
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

describe("media manifest generation", () => {
  test("preserves recorded keys and gives new graphics stable R2 keys", async () => {
    const directory = await mkdtemp(join(tmpdir(), "asset-manifest-"))
    try {
      const localPath = `${assetPaths.graphicsBlog}/example/banner.svg`
      const existing = {
        ...validAsset,
        group: "graphics",
        localPath,
        key: "original-object-name/banner.svg",
      }
      for (const path of ["src/content", "public/blog", dirname(localPath)]) {
        await mkdir(join(directory, path), { recursive: true })
      }
      const manifestPath = join(directory, assetPaths.manifest)
      await writeFile(
        manifestPath,
        JSON.stringify({ version: 1, assets: [existing] }),
      )
      await writeFile(join(directory, localPath), "edited SVG content")
      const newPath = `${assetPaths.graphicsBlog}/example/new.svg`
      await writeFile(join(directory, newPath), "new SVG content")
      const contentPath = "src/content/blog/example/assets/photo.webp"
      await mkdir(dirname(join(directory, contentPath)), { recursive: true })
      await writeFile(join(directory, contentPath), "photo")
      await writeFile(
        join(directory, "src/content/blog/example/index.md"),
        "post",
      )

      const first = await generateMediaManifest(directory)
      expect(first.assets).toHaveLength(3)
      expect(
        first.assets.find((asset) => asset.localPath === localPath),
      ).toMatchObject({
        key: existing.key,
        sha256: sha256(Buffer.from("edited SVG content")),
      })
      expect(
        first.assets.find((asset) => asset.localPath === newPath)?.key,
      ).toBe("graphics/blog/example/new.svg")
      expect(
        first.assets.find((asset) => asset.localPath === contentPath)?.key,
      ).toBe(contentPath)
      await writeFile(manifestPath, JSON.stringify(first))
      expect(await generateMediaManifest(directory)).toEqual(first)

      await writeFile(
        manifestPath,
        JSON.stringify({
          version: 1,
          assets: [{ ...existing, key: "graphics/blog/example/new.svg" }],
        }),
      )
      await rejects(
        generateMediaManifest(directory),
        /Duplicate private media key/,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("rendering fonts retain their original cloud names", () => {
    expect(graphicsFontAssets.map((asset) => asset.key)).toEqual([
      "graphics/fonts/MDLorien-Regular.otf",
      "graphics/fonts/MDLorien-Italic.otf",
    ])
    for (const asset of graphicsFontAssets) {
      expect(asset.localPath).toStartWith(`${assetPaths.graphicsFonts}/`)
      expect(asset.localPath).not.toBe(asset.key)
    }
  })
})

describe("asset transfers", () => {
  test("downloads to the local path and uploads to the stable key", async () => {
    const directory = await mkdtemp(join(tmpdir(), "asset-transfer-"))
    const contents = Buffer.from("font bytes")
    const asset = {
      ...validAsset,
      key: "graphics/fonts/sample.otf",
      localPath: `${assetPaths.graphicsFonts}/sample.otf`,
      size: contents.length,
      sha256: sha256(contents),
    }
    const requests: { method: string; path: string; body: string }[] = []
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: await request.text(),
        })
        return new Response(request.method === "GET" ? contents : null)
      },
    })
    const client = new S3Client({
      endpoint: server.url.href,
      region: "auto",
      forcePathStyle: true,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      maxAttempts: 1,
    })
    try {
      await downloadAsset(client, "test-bucket", directory, asset)
      expect(await readFile(join(directory, asset.localPath))).toEqual(contents)
      expect(await Bun.file(join(directory, asset.key)).exists()).toBe(false)
      await uploadAsset(client, "test-bucket", directory, asset)
      expect(requests).toEqual([
        { method: "GET", path: `/test-bucket/${asset.key}`, body: "" },
        {
          method: "PUT",
          path: `/test-bucket/${asset.key}`,
          body: contents.toString(),
        },
      ])

      await rejects(
        downloadAsset(client, "test-bucket", directory, {
          ...asset,
          localPath: "bad/font.otf",
          sha256: "0".repeat(64),
        }),
        /failed integrity verification/,
      )
      expect(await Bun.file(join(directory, "bad/font.otf")).exists()).toBe(
        false,
      )
    } finally {
      client.destroy()
      server.stop(true)
      await rm(directory, { recursive: true, force: true })
    }
  })
})
