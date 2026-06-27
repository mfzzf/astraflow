import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

import { cookies } from "next/headers"

import type { UCloudCredentials } from "@/lib/ucloud"

const SESSION_COOKIE_NAME = "astraflow_session"
const SESSION_MAX_AGE = 60 * 60 * 8
const IS_DESKTOP_APP = process.env.ASTRAFLOW_DESKTOP === "1"

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

export async function getCredentialSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value

  return session ? unsealSession(session) : null
}

export async function setCredentialSession(credentials: UCloudCredentials) {
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, sealSession(credentials), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !IS_DESKTOP_APP,
  })
}

export async function clearCredentialSession() {
  const cookieStore = await cookies()

  cookieStore.delete(SESSION_COOKIE_NAME)
}
