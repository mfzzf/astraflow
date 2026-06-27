import { NextResponse } from "next/server"

import {
  normalizeListData,
  readBooleanParam,
  readIntegerParam,
  readStringParam,
  toErrorResponse,
} from "@/lib/api-utils"
import { getCredentialSession } from "@/lib/session"
import { DEFAULT_SANDBOX_REGION, isSandboxRegion } from "@/lib/sandbox-regions"
import { callUCloudAction } from "@/lib/ucloud"

type SandboxTemplate = {
  ID?: string
  Alias?: string
  CPU?: number
  MemoryMB?: number
  Type?: string
  CreateTime?: number
  UpdateTime?: number
}

type ListSandboxTemplatesResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Total?: number
  TotalCount?: number
  Templates?: SandboxTemplate[] | Record<string, SandboxTemplate>
}

const orderOptions = new Set(["CPU", "Memory", "CreateTime", "UpdateTime"])

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

    if (!isSandboxRegion(region)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unsupported sandbox region.",
        },
        { status: 400 }
      )
    }

    const order = readStringParam(searchParams, "order")
    const params: Record<string, string | number | boolean> = {
      Action: "ListSandboxTemplates",
      ProjectId: projectId,
      Region: region,
      Offset: readIntegerParam(searchParams, "offset", 0, { min: 0 }),
      Limit: readIntegerParam(searchParams, "limit", 20, { min: 1, max: 100 }),
    }
    const search = readStringParam(searchParams, "search")

    if (orderOptions.has(order)) {
      params.Order = order
      params.OrderDesc = readBooleanParam(searchParams, "orderDesc")
    }

    if (search) {
      params.Search = search
    }

    const response = await callUCloudAction<ListSandboxTemplatesResponse>({
      credentials: session,
      params,
    })
    const templates = normalizeListData(response.Templates)

    return NextResponse.json({
      ok: true,
      data: templates,
      totalCount: response.Total ?? response.TotalCount ?? templates.length,
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected sandbox template request failure.")
  }
}
