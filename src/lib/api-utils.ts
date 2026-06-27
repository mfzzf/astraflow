import { NextResponse } from "next/server"

import { UCloudApiError } from "@/lib/ucloud"

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function readStringParam(
  searchParams: URLSearchParams,
  key: string,
  fallback = ""
) {
  return readString(searchParams.get(key)) || fallback
}

export function readIntegerParam(
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
  options: {
    min?: number
    max?: number
  } = {}
) {
  const parsed = Number.parseInt(searchParams.get(key) ?? "", 10)
  const min = options.min ?? Number.MIN_SAFE_INTEGER
  const max = options.max ?? Number.MAX_SAFE_INTEGER

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(parsed, min), max)
}

export function readBooleanParam(
  searchParams: URLSearchParams,
  key: string,
  fallback = false
) {
  const value = readString(searchParams.get(key)).toLowerCase()

  if (value === "true" || value === "1") {
    return true
  }

  if (value === "false" || value === "0") {
    return false
  }

  return fallback
}

export function readStringListParam(
  searchParams: URLSearchParams,
  key: string,
  fallback: string[] = []
) {
  const values = searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)

  return values.length ? values : fallback
}

export function readNumberListParam(
  searchParams: URLSearchParams,
  key: string,
  fallback: number[] = []
) {
  const values = readStringListParam(searchParams, key)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value))

  return values.length ? values : fallback
}

export function normalizeListData<T>(data: T[] | Record<string, T> | undefined) {
  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === "object") {
    return Object.values(data)
  }

  return []
}

export function toErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof UCloudApiError) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message,
        retCode: error.retCode,
      },
      { status: error.status }
    )
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message,
      },
      { status: 400 }
    )
  }

  return NextResponse.json(
    {
      ok: false,
      message: fallbackMessage,
    },
    { status: 500 }
  )
}
