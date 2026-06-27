import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import {
  callUCloudAction,
  UCloudApiError,
  type UCloudParamValue,
} from "@/lib/ucloud"

type RequestLogSummary = {
  TotalRequests?: number
  FailedRequests?: number
}

type RequestLogItem = {
  RequestId?: string
  StartTime?: number
  StartTimeReadable?: string
  Region?: string
  ModelName?: string
  ApiKeyId?: string
  ApiKeyName?: string
  Latency?: number
  FirstTokenLatency?: number
  OutputTokenThroughput?: number
  HttpStatusCode?: number
  ErrorCode?: string
  IsSuccess?: boolean
  TotalTokens?: number
  PromptTokens?: number
  CompletionTokens?: number
  CacheHitTokens?: number
  CacheCreationTokens?: number
  CacheCreation5mTokens?: number
  CacheCreation1hTokens?: number
  HasInferenceLog?: boolean
}

type RequestLogsData = {
  Summary?: RequestLogSummary
  Items?: RequestLogItem[]
}

type ListUMInferRequestLogsResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Data?: RequestLogsData
  Summary?: RequestLogSummary
  Items?: RequestLogItem[]
  TotalCount?: number
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readInteger(value: unknown, fallback: number) {
  const parsed = Number(value)

  return Number.isInteger(parsed) ? parsed : fallback
}

function toErrorResponse(error: unknown) {
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
      message: "Unexpected request log failure.",
    },
    { status: 500 }
  )
}

function readProjectId(sessionProjectId: string, value: unknown) {
  return readString(value) || sessionProjectId
}

function readTimeMs(value: unknown) {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
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
    const projectId = readProjectId(
      session.projectId,
      searchParams.get("projectId")
    )
    const region = readString(searchParams.get("region"))
    const startTime = readTimeMs(searchParams.get("startTime"))
    const endTime = readTimeMs(searchParams.get("endTime"))
    const requestId = readString(searchParams.get("requestId"))
    const modelName = readString(searchParams.get("modelName"))
    const apiKeyId = readString(searchParams.get("apiKeyId"))
    const offset = Math.max(readInteger(searchParams.get("offset"), 0), 0)
    const limit = Math.min(
      Math.max(readInteger(searchParams.get("limit"), 20), 1),
      100
    )

    if (!region) {
      throw new Error("Region is required.")
    }

    if (!startTime || !endTime) {
      throw new Error("StartTime and EndTime are required.")
    }

    if (endTime < startTime) {
      throw new Error("EndTime must be greater than StartTime.")
    }

    const params: Record<string, UCloudParamValue> = {
      Action: "ListUMInferRequestLogs",
      ProjectId: projectId,
      Region: region,
      StartTime: startTime,
      EndTime: endTime,
      Offset: offset,
      Limit: limit,
    }

    if (requestId) {
      params.RequestId = requestId
    }

    if (modelName) {
      params.ModelNames = [modelName]
    }

    if (apiKeyId) {
      params.ApiKeyIds = [apiKeyId]
    }

    const response = await callUCloudAction<ListUMInferRequestLogsResponse>({
      credentials: session,
      params,
    })
    const summary = response.Data?.Summary ?? response.Summary ?? {}
    const items = response.Data?.Items ?? response.Items ?? []
    const totalCount =
      response.TotalCount ?? summary.TotalRequests ?? items.length

    return NextResponse.json({
      ok: true,
      data: items,
      summary: {
        TotalRequests: summary.TotalRequests ?? 0,
        FailedRequests: summary.FailedRequests ?? 0,
      },
      totalCount,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
