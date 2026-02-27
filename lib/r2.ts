import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  type _Object,
} from "@aws-sdk/client-s3"
import {
  getR2AccountId,
  getR2AccessKeyId,
  getR2SecretAccessKey,
  getR2BucketName,
  getR2Endpoint,
} from "./env"

let _client: S3Client | null = null

function getR2Client(): S3Client {
  if (_client) return _client
  const endpoint = getR2Endpoint()
  const accountId = getR2AccountId()
  if (!endpoint?.trim() && !accountId?.trim()) {
    throw new Error(
      "R2 not configured. Set CLOUDFLARE_R2_ENDPOINT or CLOUDFLARE_R2_ACCOUNT_ID (and credentials) in .env."
    )
  }
  const url =
    endpoint?.trim() ||
    `https://${accountId}.r2.cloudflarestorage.com`
  _client = new S3Client({
    region: "auto",
    endpoint: url,
    credentials: {
      accessKeyId: getR2AccessKeyId(),
      secretAccessKey: getR2SecretAccessKey(),
    },
  })
  return _client
}

const BUCKET = getR2BucketName()

/**
 * List object keys under a prefix (e.g. date "2026-01-14" or "2026-01-14/").
 * Returns full keys; filter .md / .md.temp in caller if needed.
 */
export async function listR2Keys(prefix: string): Promise<string[]> {
  const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`
  const client = getR2Client()
  const out = await client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: normalized,
      MaxKeys: 500,
    })
  )
  const keys = (out.Contents ?? []).map((o: _Object) => o.Key).filter(Boolean) as string[]
  return keys
}

/**
 * Get object body as UTF-8 string.
 */
export async function getR2ObjectBody(key: string): Promise<string> {
  const client = getR2Client()
  const res = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  )
  const body = res.Body
  if (!body) return ""
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf-8")
}

/**
 * Filter keys to markdown only (.md or .md.temp).
 */
export function filterMarkdownKeys(keys: string[]): string[] {
  return keys.filter(
    (k) => k.endsWith(".md") || k.endsWith(".md.temp")
  )
}

/**
 * List "folder" prefixes (e.g. dates) using delimiter. Returns names without trailing slash.
 */
export async function listR2DatePrefixes(): Promise<string[]> {
  const client = getR2Client()
  const out = await client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: "",
      Delimiter: "/",
      MaxKeys: 500,
    })
  )
  const prefixes = (out.CommonPrefixes ?? [])
    .map((p) => p.Prefix?.replace(/\/$/, ""))
    .filter(Boolean) as string[]
  return prefixes.sort((a, b) => (b < a ? -1 : 1))
}
