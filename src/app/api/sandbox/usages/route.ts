import { NextResponse } from "next/server"

import {
  normalizeListData,
  readStringParam,
  toErrorResponse,
} from "@/lib/api-utils"
import { getCredentialSession } from "@/lib/session"
import { DEFAULT_SANDBOX_REGION, isSandboxRegion } from "@/lib/sandbox-regions"
import { callUCloudAction } from "@/lib/ucloud"

type SandboxUsageItem = Record<string, unknown>
type SandboxUsageCollection =
  | SandboxUsageItem[]
  | Record<string, SandboxUsageItem>

type SandboxUsageEnvelope = {
  Usages?: SandboxUsageCollection
  Items?: SandboxUsageCollection
  UsageSet?: SandboxUsageCollection
  Total?: number | string
  TotalCount?: number | string
}

type ListSandboxUsagesResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Total?: number | string
  TotalCount?: number | string
  Usages?: SandboxUsageCollection
  Items?: SandboxUsageCollection
  UsageSet?: SandboxUsageCollection
  Data?: SandboxUsageCollection | SandboxUsageEnvelope
}

function readIntegerParamAlias(
  searchParams: URLSearchParams,
  keys: string[],
  fallback = 0
) {
  for (const key of keys) {
    const parsed = Number.parseInt(searchParams.get(key) ?? "", 10)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function readStringParamAlias(
  searchParams: URLSearchParams,
  keys: string[],
  fallback = ""
) {
  for (const key of keys) {
    const value = readStringParam(searchParams, key)

    if (value) {
      return value
    }
  }

  return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asUsageCollection(value: unknown): SandboxUsageCollection | undefined {
  if (Array.isArray(value) || isRecord(value)) {
    return value as SandboxUsageCollection
  }

  return undefined
}

function normalizeSandboxUsages(response: ListSandboxUsagesResponse) {
  const dataEnvelope = isRecord(response.Data) ? response.Data : undefined
  const nestedCollection =
    asUsageCollection(dataEnvelope?.Usages) ??
    asUsageCollection(dataEnvelope?.Items) ??
    asUsageCollection(dataEnvelope?.UsageSet)
  const collection =
    response.Usages ??
    response.Items ??
    response.UsageSet ??
    nestedCollection ??
    asUsageCollection(response.Data)

  return collection ? normalizeListData(collection) : []
}

function readCount(value: unknown) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
}

function totalCountFor(response: ListSandboxUsagesResponse, itemCount: number) {
  const dataEnvelope = isRecord(response.Data) ? response.Data : undefined

  return (
    readCount(response.Total) ??
    readCount(response.TotalCount) ??
    readCount(dataEnvelope?.Total) ??
    readCount(dataEnvelope?.TotalCount) ??
    itemCount
  )
}

export async function GET(request: Request) {
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
    const searchParams = new URL(request.url).searchParams
    const projectId = readStringParam(searchParams, "projectId", session.projectId)
    const region = readStringParam(
      searchParams,
      "region",
      DEFAULT_SANDBOX_REGION
    )
    const beginTime = readIntegerParamAlias(searchParams, [
      "beginTime",
      "BeginTime",
    ])
    const endTime = readIntegerParamAlias(searchParams, ["endTime", "EndTime"])
    const step = readStringParamAlias(searchParams, ["step", "Step"], "day")
    const templateId = readStringParamAlias(searchParams, [
      "templateId",
      "TemplateID",
    ])

    if (!isSandboxRegion(region)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unsupported sandbox region.",
        },
        { status: 400 }
      )
    }

    if (!beginTime || !endTime) {
      return NextResponse.json(
        {
          ok: false,
          message: "BeginTime and EndTime are required.",
        },
        { status: 400 }
      )
    }

    if (endTime < beginTime) {
      return NextResponse.json(
        {
          ok: false,
          message: "EndTime must be greater than BeginTime.",
        },
        { status: 400 }
      )
    }

    const params: Record<string, string | number | boolean> = {
      Action: "ListSandboxUsages",
      ProjectId: projectId,
      Region: region,
      BeginTime: beginTime,
      EndTime: endTime,
      Step: step,
    }

    if (templateId) {
      params.TemplateID = templateId
    }

    const response = await callUCloudAction<ListSandboxUsagesResponse>({
      credentials: session,
      params,
    })
    const usages = normalizeSandboxUsages(response)

    return NextResponse.json({
      ok: true,
      data: usages,
      totalCount: totalCountFor(response, usages.length),
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected sandbox usage request failure.")
  }
}
