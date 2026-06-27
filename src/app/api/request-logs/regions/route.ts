import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type RequestLogRegion = {
  Region?: string
  Name?: string
  IsLocal?: boolean
}

type ListUMInferRegionsResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Data?: RequestLogRegion[]
  TotalCount?: number
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
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
      message: "Unexpected request log region failure.",
    },
    { status: 500 }
  )
}

function readProjectId(sessionProjectId: string, value: unknown) {
  return readString(value) || sessionProjectId
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
    const response = await callUCloudAction<ListUMInferRegionsResponse>({
      credentials: session,
      params: {
        Action: "ListUMInferRegions",
        ProjectId: projectId,
      },
    })
    const data = Array.isArray(response.Data) ? response.Data : []

    return NextResponse.json({
      ok: true,
      data,
      totalCount: response.TotalCount ?? data.length,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
