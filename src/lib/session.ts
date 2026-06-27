import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { cookies } from "next/headers"

import type { UCloudCredentials } from "@/lib/ucloud"

const SESSION_COOKIE_NAME = "astraflow_session"
const IS_DESKTOP_APP = process.env.ASTRAFLOW_DESKTOP === "1"
const ALLOW_INSECURE_COOKIES = process.env.ASTRAFLOW_INSECURE_COOKIES === "1"
const SESSION_MAX_AGE = IS_DESKTOP_APP ? 60 * 60 * 24 * 365 : 60 * 60 * 8
const DESKTOP_CREDENTIALS_PATH = process.env.ASTRAFLOW_DESKTOP_CREDENTIALS_PATH

function getSessionKey() {
  const secret =
    process.env.ASTRAFLOW_SESSION_SECRET ||
    "astraflow-local-development-session-secret"

  return createHash("sha256").update(secret).digest()
}

function sealSession(credentials: UCloudCredentials) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getSessionKey(), iv)
  const payload = Buffer.from(JSON.stringify(credentials), "utf8")
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString("base64url")
}

function unsealSession(value: string): UCloudCredentials | null {
  try {
    const packed = Buffer.from(value, "base64url")
    const iv = packed.subarray(0, 12)
    const authTag = packed.subarray(12, 28)
    const encrypted = packed.subarray(28)
    const decipher = createDecipheriv("aes-256-gcm", getSessionKey(), iv)

    decipher.setAuthTag(authTag)

    const payload = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8")
    const parsed = JSON.parse(payload) as Partial<UCloudCredentials>

    if (!parsed.accessKey || !parsed.secretKey || !parsed.projectId) {
      return null
    }

    return {
      accessKey: parsed.accessKey,
      secretKey: parsed.secretKey,
      projectId: parsed.projectId,
    }
  } catch {
    return null
  }
}

async function readDesktopCredentials() {
  if (!IS_DESKTOP_APP || !DESKTOP_CREDENTIALS_PATH) {
    return null
  }

  try {
    const stored = await readFile(DESKTOP_CREDENTIALS_PATH, "utf8")

    return unsealSession(stored.trim())
  } catch {
    return null
  }
}

async function writeDesktopCredentials(credentials: UCloudCredentials) {
  if (!IS_DESKTOP_APP || !DESKTOP_CREDENTIALS_PATH) {
    return
  }

  await mkdir(dirname(DESKTOP_CREDENTIALS_PATH), { recursive: true })
  await writeFile(DESKTOP_CREDENTIALS_PATH, sealSession(credentials), {
    mode: 0o600,
  })
}

async function clearDesktopCredentials() {
  if (!IS_DESKTOP_APP || !DESKTOP_CREDENTIALS_PATH) {
    return
  }

  await rm(DESKTOP_CREDENTIALS_PATH, { force: true })
}

export async function getCredentialSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (session) {
    const credentials = unsealSession(session)

    if (credentials) {
      return credentials
    }
  }

  return readDesktopCredentials()
}

export async function setCredentialSession(credentials: UCloudCredentials) {
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, sealSession(credentials), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" &&
      !IS_DESKTOP_APP &&
      !ALLOW_INSECURE_COOKIES,
  })

  await writeDesktopCredentials(credentials)
}

export async function clearCredentialSession() {
  const cookieStore = await cookies()

  cookieStore.delete(SESSION_COOKIE_NAME)
  await clearDesktopCredentials()
}
