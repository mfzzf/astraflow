import { Buffer } from "node:buffer"

import { NextResponse } from "next/server"
import { z } from "zod"

import { findModelverseApiKey } from "@/lib/modelverse-api-keys"
import type { JsonValue } from "@/lib/modelverse-generation-types"
import { getCredentialSession } from "@/lib/session"

export const runtime = "nodejs"

const RunRequestSchema = z.object({
  projectId: z.string().optional(),
  apiKeyId: z.string().min(1),
  request: z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    serverUrl: z.string().url(),
    path: z.string().startsWith("/"),
    contentType: z.string().min(1),
    body: z.unknown(),
  }),
})

type RunRequest = z.infer<typeof RunRequestSchema>

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function sanitizeJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, sanitizeJsonValue(item)])
    )
  }

  return null
}

function createModelverseUrl(serverUrl: string, requestPath: string) {
  const server = new URL(serverUrl)

  if (server.protocol !== "https:" || server.hostname !== "api.modelverse.cn") {
    throw new Error("Only the Modelverse API endpoint is supported.")
  }

  return new URL(requestPath, server.origin)
}

function appendQueryBody(url: URL, body: JsonValue) {
  if (!isRecord(body)) {
    return
  }

  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item ?? ""))
      }

      continue
    }

    if (typeof value === "object") {
      url.searchParams.set(key, JSON.stringify(value))
      continue
    }

    url.searchParams.set(key, String(value))
  }
}

function hasFilePlaceholder(key: string, value: JsonValue) {
  if (typeof value !== "string") {
    return false
  }

  return (
    /file|image|audio|video|mask|voice|avatar/i.test(key) &&
    (/^\.\//.test(value) || value.startsWith("/") || value.startsWith("@"))
  )
}

function createMultipartBody(body: JsonValue) {
  if (!isRecord(body)) {
    throw new Error("Multipart requests require object parameters.")
  }

  const formData = new FormData()

  for (const [key, value] of Object.entries(body)) {
    if (hasFilePlaceholder(key, value)) {
      throw new Error(
        "File upload examples require a real file picker before they can run."
      )
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        formData.append(
          key,
          typeof item === "object" && item !== null
            ? JSON.stringify(item)
            : String(item ?? "")
        )
      }

      continue
    }

    formData.set(
      key,
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value ?? "")
    )
  }

  return formData
}

function createFetchInit({
  request,
  apiKey,
}: {
  request: RunRequest["request"]
  apiKey: string
}): RequestInit {
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
  })
  const body = sanitizeJsonValue(request.body)

  if (request.method === "GET") {
    return {
      method: request.method,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    }
  }

  if (request.contentType.includes("multipart/form-data")) {
    return {
      method: request.method,
      headers,
      body: createMultipartBody(body),
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    }
  }

  headers.set("Content-Type", request.contentType)

  return {
    method: request.method,
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(180_000),
  }
}

async function readModelverseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    return {
      contentType,
      data: (await response.json()) as JsonValue,
    }
  }

  if (
    contentType.startsWith("image/") ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/") ||
    contentType.includes("octet-stream")
  ) {
    const buffer = Buffer.from(await response.arrayBuffer())

    return {
      contentType: contentType || "application/octet-stream",
      data: null,
      binary: buffer.toString("base64"),
    }
  }

  return {
    contentType,
    data: (await response.text()) as JsonValue,
  }
}

export async function POST(request: Request) {
  const session = await getCredentialSession()

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        message: "Login is required.",
      },
      { status: 401 }
    )
  }

  try {
    const parsed = RunRequestSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid generation request.",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const body = parsed.data
    const projectId = readString(body.projectId) || session.projectId
    const apiKey = await findModelverseApiKey({
      credentials: session,
      projectId,
      apiKeyId: body.apiKeyId,
    })

    if (!apiKey?.key) {
      return NextResponse.json(
        {
          ok: false,
          message: "Selected API key is unavailable.",
        },
        { status: 400 }
      )
    }

    const url = createModelverseUrl(
      body.request.serverUrl,
      body.request.path
    )
    const requestBody = sanitizeJsonValue(body.request.body)

    if (body.request.method === "GET") {
      appendQueryBody(url, requestBody)
    }

    const response = await fetch(
      url,
      createFetchInit({
        request: body.request,
        apiKey: apiKey.key,
      })
    )
    const modelverseResponse = await readModelverseResponse(response)

    return NextResponse.json(
      {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        ...modelverseResponse,
      },
      { status: response.ok ? 200 : response.status }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unexpected generation request failure.",
      },
      { status: 400 }
    )
  }
}
