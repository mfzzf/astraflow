import { createHash } from "node:crypto"

const UCLOUD_ENDPOINT = "https://api.ucloud.cn/"

export type UCloudScalarParamValue = string | number | boolean
export type UCloudParamValue =
  | UCloudScalarParamValue
  | readonly UCloudScalarParamValue[]

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
  method?: "GET" | "POST"
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

function stringifyParamValue(value: UCloudScalarParamValue) {
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toString()
  }

  return value
}

function expandParamValues(params: Record<string, UCloudParamValue>) {
  const expandedParams: Record<string, UCloudScalarParamValue> = {}

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        expandedParams[`${key}.${index}`] = item
      })
      continue
    }

    expandedParams[key] = value
  }

  return expandedParams
}

export function createUCloudSignature(
  params: Record<string, UCloudScalarParamValue>,
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
  const signedParams = createUCloudSignedParams({
    accessKey,
    secretKey,
    params,
  })
  const searchParams = new URLSearchParams()

  for (const key of Object.keys(signedParams).sort()) {
    searchParams.set(key, stringifyParamValue(signedParams[key]))
  }

  return `${UCLOUD_ENDPOINT}?${searchParams.toString()}`
}

export function createUCloudSignedParams({
  accessKey,
  secretKey,
  params,
}: CreateSignedUrlInput) {
  const signedParams = expandParamValues({
    ...params,
    PublicKey: accessKey,
  })
  const signature = createUCloudSignature(signedParams, secretKey)

  return {
    ...signedParams,
    Signature: signature,
  }
}

export async function callUCloudAction<T>({
  credentials,
  params,
  method = "POST",
}: CallUCloudActionInput) {
  const signedParams = createUCloudSignedParams({
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
    params,
  })
  const url =
    method === "GET"
      ? createUCloudSignedUrl({
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          params,
        })
      : UCLOUD_ENDPOINT

  let response: Response

  try {
    response = await fetch(url, {
      method,
      headers:
        method === "POST"
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
      body: method === "POST" ? JSON.stringify(signedParams) : undefined,
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
