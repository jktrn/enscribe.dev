import { createHash } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, extname, resolve, sep } from "node:path"
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

export type PrivateAsset = {
  contentType: string
  key: string
  localPath: string
  sha256: string
  size: number
}

type R2Connection = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
}

const requestTimeoutMs = 120_000
const defaultConcurrency = 8

export function sha256(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex")
}

export function assertSafeAssetPath(path: string): void {
  const segments = path.split("/")
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    segments.includes("") ||
    segments.includes(".") ||
    segments.includes("..")
  ) {
    throw new Error(`Unsafe private asset path: ${path}`)
  }
}

export function contentTypeForPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".gif":
      return "image/gif"
    case ".jpeg":
    case ".jpg":
      return "image/jpeg"
    case ".mp4":
      return "video/mp4"
    case ".otf":
      return "font/otf"
    case ".png":
      return "image/png"
    case ".svg":
      return "image/svg+xml"
    case ".webm":
      return "video/webm"
    case ".webp":
      return "image/webp"
    case ".woff2":
      return "font/woff2"
    default:
      return "application/octet-stream"
  }
}

function loadR2Connection(): R2Connection {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing private R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    )
  }
  return { accountId, accessKeyId, secretAccessKey }
}

export function createR2Client(): S3Client {
  const connection = loadR2Connection()
  return new S3Client({
    credentials: {
      accessKeyId: connection.accessKeyId,
      secretAccessKey: connection.secretAccessKey,
    },
    endpoint: `https://${connection.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  })
}

function localAssetPath(repoRoot: string, asset: PrivateAsset): string {
  assertSafeAssetPath(asset.localPath)
  const path = resolve(repoRoot, asset.localPath)
  if (!path.startsWith(`${resolve(repoRoot)}${sep}`)) {
    throw new Error(`Private asset escapes the repository: ${asset.localPath}`)
  }
  return path
}

async function readVerified(
  repoRoot: string,
  asset: PrivateAsset,
): Promise<Buffer | null> {
  try {
    const contents = await readFile(localAssetPath(repoRoot, asset))
    if (
      contents.byteLength !== asset.size ||
      sha256(contents) !== asset.sha256
    ) {
      return null
    }
    return contents
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null
    }
    throw error
  }
}

async function downloadAsset(
  client: S3Client,
  bucket: string,
  repoRoot: string,
  asset: PrivateAsset,
): Promise<void> {
  assertSafeAssetPath(asset.key)
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: asset.key }),
    { abortSignal: AbortSignal.timeout(requestTimeoutMs) },
  )
  if (!response.Body) {
    throw new Error(`R2 returned no body for ${bucket}/${asset.key}`)
  }

  const contents = Buffer.from(await response.Body.transformToByteArray())
  const actualHash = sha256(contents)
  if (contents.byteLength !== asset.size || actualHash !== asset.sha256) {
    throw new Error(
      `${bucket}/${asset.key} failed integrity verification: expected ${asset.size} bytes and ${asset.sha256}, received ${contents.byteLength} bytes and ${actualHash}`,
    )
  }

  const destination = localAssetPath(repoRoot, asset)
  await mkdir(dirname(destination), { recursive: true })
  const temporaryPath = `${destination}.${process.pid}.tmp`
  try {
    await writeFile(temporaryPath, contents)
    await rename(temporaryPath, destination)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

async function uploadAsset(
  client: S3Client,
  bucket: string,
  repoRoot: string,
  asset: PrivateAsset,
): Promise<void> {
  assertSafeAssetPath(asset.key)
  const contents = await readVerified(repoRoot, asset)
  if (!contents) {
    throw new Error(
      `${asset.localPath} is missing or does not match the private asset manifest`,
    )
  }

  await client.send(
    new PutObjectCommand({
      Body: contents,
      Bucket: bucket,
      ContentType: asset.contentType,
      Key: asset.key,
      Metadata: { sha256: asset.sha256 },
    }),
    { abortSignal: AbortSignal.timeout(requestTimeoutMs) },
  )
}

async function verifyRemoteAsset(
  client: S3Client,
  bucket: string,
  asset: PrivateAsset,
): Promise<void> {
  assertSafeAssetPath(asset.key)
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: asset.key }),
    { abortSignal: AbortSignal.timeout(requestTimeoutMs) },
  )
  if (!response.Body) {
    throw new Error(`R2 returned no body for ${bucket}/${asset.key}`)
  }

  const contents = Buffer.from(await response.Body.transformToByteArray())
  const actualHash = sha256(contents)
  if (contents.byteLength !== asset.size || actualHash !== asset.sha256) {
    throw new Error(
      `${bucket}/${asset.key} failed remote verification: expected ${asset.size} bytes and ${asset.sha256}, received ${contents.byteLength} bytes and ${actualHash}`,
    )
  }
}

async function runWithConcurrency<T>(
  items: readonly T[],
  label: string,
  callback: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0
  let completed = 0

  const worker = async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) {
        return
      }
      await callback(items[index])
      completed += 1
      if (completed === items.length || completed % 25 === 0) {
        console.log(`${label}: ${completed}/${items.length}`)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(defaultConcurrency, items.length) }, worker),
  )
}

export async function prepareAssets(
  bucket: string,
  repoRoot: string,
  assets: readonly PrivateAsset[],
): Promise<void> {
  const missing: PrivateAsset[] = []
  for (const asset of assets) {
    if (!(await readVerified(repoRoot, asset))) {
      missing.push(asset)
    }
  }

  if (missing.length === 0) {
    console.log(`Verified ${assets.length} private assets locally`)
    return
  }

  const client = createR2Client()
  try {
    await runWithConcurrency(missing, `Downloaded from ${bucket}`, (asset) =>
      downloadAsset(client, bucket, repoRoot, asset),
    )
  } finally {
    client.destroy()
  }
}

export async function uploadAssets(
  bucket: string,
  repoRoot: string,
  assets: readonly PrivateAsset[],
): Promise<void> {
  const client = createR2Client()
  try {
    await runWithConcurrency(assets, `Uploaded to ${bucket}`, (asset) =>
      uploadAsset(client, bucket, repoRoot, asset),
    )
  } finally {
    client.destroy()
  }
}

export async function verifyRemoteAssets(
  bucket: string,
  assets: readonly PrivateAsset[],
): Promise<void> {
  const client = createR2Client()
  try {
    await runWithConcurrency(assets, `Verified in ${bucket}`, (asset) =>
      verifyRemoteAsset(client, bucket, asset),
    )
  } finally {
    client.destroy()
  }
}
