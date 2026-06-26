import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type CostAnalysisResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Summary?: Record<string, unknown>
  DailyTrend?: Array<Record<string, unknown>>
  ModelDistribution?: Array<Record<string, unknown>>
  KeyTopN?: Array<Record<string, unknown>>
  KeyDailyHeatmap?: Record<string, unknown>
  RegionDistribution?: Array<Record<string, unknown>>
  InstanceTopN?: Array<Record<string, unknown>>
  [key: string]: unknown
}

type CostAnalysisService = "modelverse" | "sandbox"

type CostAnalysisResult = {
  service: CostAnalysisService
  action: string
  ok: boolean
  retCode?: number
  message?: string
  data?: CostAnalysisResponse
}

function readParam(searchParams: URLSearchParams, key: string, fallback: string) {
  return searchParams.get(key)?.trim() || fallback
}

function readTimestamp(
  searchParams: URLSearchParams,
  key: string,
  fallback: number
) {
  const value = Number(searchParams.get(key))

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

async function callCostAnalysis(
  service: CostAnalysisService,
  action: string,
  credentials: NonNullable<Awaited<ReturnType<typeof getCredentialSession>>>,
  params: {
    projectId: string
    startTime: number
    endTime: number
    topN: number
  }
): Promise<CostAnalysisResult> {
  try {
    const data = await callUCloudAction<CostAnalysisResponse>({
      credentials,
      params: {
        Action: action,
        ProjectId: params.projectId,
        StartTime: params.startTime,
        EndTime: params.endTime,
        TopN: params.topN,
      },
    })

    return {
      service,
      action,
      ok: true,
      retCode: data.RetCode,
      data,
    }
  } catch (error) {
    if (error instanceof UCloudApiError) {
      return {
        service,
        action,
        ok: false,
        retCode: error.retCode,
        message: error.message,
      }
    }

    return {
      service,
      action,
      ok: false,
      message: error instanceof Error ? error.message : "Request failed.",
    }
  }
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

  const searchParams = new URL(request.url).searchParams
  const projectId = readParam(searchParams, "projectId", session.projectId)
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const endTime = readTimestamp(searchParams, "endTime", nowInSeconds)
  const startTime = readTimestamp(
    searchParams,
    "startTime",
    endTime - 7 * 24 * 60 * 60
  )
  const topN = readTimestamp(searchParams, "topN", 15)

  const [modelverse, sandbox] = await Promise.all([
    callCostAnalysis("modelverse", "GetModelVerseCostAnalysis", session, {
      projectId,
      startTime,
      endTime,
      topN,
    }),
    callCostAnalysis("sandbox", "GetSandboxCostAnalysis", session, {
      projectId,
      startTime,
      endTime,
      topN,
    }),
  ])

  return NextResponse.json({
    ok: true,
    projectId,
    startTime,
    endTime,
    topN,
    data: [modelverse, sandbox],
  })
}
