import { createHash } from "node:crypto"

const UCLOUD_ENDPOINT = "https://api.ucloud.cn/"

type UCloudParamValue = string | number | boolean

export type UCloudCredentials = {
  accessKey: string
  secretKey: string
  projectId: string
}

type CreateSignedUrlInput = {
  accessKey: string
  secretKey: string
  params: Record<string, UCloudParamValue>
}

type CallUCloudActionInput = {
  credentials: UCloudCredentials
  params: Record<string, UCloudParamValue>
}

type UCloudErrorPayload = {
  RetCode?: number
  Message?: string
}

export class UCloudApiError extends Error {
  retCode?: number
  status: number

  constructor(message: string, options?: { retCode?: number; status?: number }) {
    super(message)
    this.name = "UCloudApiError"
    this.retCode = options?.retCode
    this.status = options?.status ?? 502
  }
}

function stringifyParamValue(value: UCloudParamValue) {
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toString()
  }

  return value
}

export function createUCloudSignature(
  params: Record<string, UCloudParamValue>,
  secretKey: string
) {
  const canonicalString = Object.keys(params)
    .sort()
    .map((key) => `${key}${stringifyParamValue(params[key])}`)
    .join("")

  return createHash("sha1")
    .update(`${canonicalString}${secretKey}`, "utf8")
    .digest("hex")
}

export function createUCloudSignedUrl({
  accessKey,
  secretKey,
  params,
}: CreateSignedUrlInput) {
  const signedParams: Record<string, UCloudParamValue> = {
    ...params,
    PublicKey: accessKey,
  }
  const signature = createUCloudSignature(signedParams, secretKey)
  const searchParams = new URLSearchParams()

  for (const key of Object.keys(signedParams).sort()) {
    searchParams.set(key, stringifyParamValue(signedParams[key]))
  }

  searchParams.set("Signature", signature)

  return `${UCLOUD_ENDPOINT}?${searchParams.toString()}`
}

export async function callUCloudAction<T>({
  credentials,
  params,
}: CallUCloudActionInput) {
  const url = createUCloudSignedUrl({
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
    params,
  })

  let response: Response

  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new UCloudApiError("Unable to reach UCloud.")
  }

  let data: T & UCloudErrorPayload

  try {
    data = (await response.json()) as T & UCloudErrorPayload
  } catch {
    throw new UCloudApiError("UCloud returned an invalid response.", {
      status: response.ok ? 502 : response.status,
    })
  }

  if (!response.ok || data.RetCode !== 0) {
    throw new UCloudApiError(data.Message || "UCloud request failed.", {
      retCode: data.RetCode,
      status: response.ok ? 400 : response.status,
    })
  }

  return data
}
