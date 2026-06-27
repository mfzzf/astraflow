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

type SandboxItem = {
  ID?: string
  Alias?: string
  TemplateID?: string
  CPU?: number
  MemoryMB?: number
  CreateTime?: number
  Status?: string
}

type ListSandboxSandboxesResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Total?: number
  TotalCount?: number
  Sandboxes?: SandboxItem[] | Record<string, SandboxItem>
}

const orderOptions = new Set(["CPU", "Memory", "CreateTime"])

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
      Action: "ListSandboxSandboxes",
      ProjectId: projectId,
      Region: region,
      Offset: readIntegerParam(searchParams, "offset", 0, { min: 0 }),
      Limit: readIntegerParam(searchParams, "limit", 20, { min: 1, max: 100 }),
    }
    const search = readStringParam(searchParams, "search")
    const templateId = readStringParam(searchParams, "templateId")
    const cpu = readIntegerParam(searchParams, "cpu", 0, { min: 0 })
    const memoryMb = readIntegerParam(searchParams, "memoryMb", 0, { min: 0 })

    if (orderOptions.has(order)) {
      params.Order = order
      params.OrderDesc = readBooleanParam(searchParams, "orderDesc")
    }

    if (search) {
      params.Search = search
    }

    if (templateId) {
      params.TemplateID = templateId
    }

    if (cpu > 0) {
      params.CPU = cpu
    }

    if (memoryMb > 0) {
      params.MemoryMB = memoryMb
    }

    const response = await callUCloudAction<ListSandboxSandboxesResponse>({
      credentials: session,
      params,
    })
    const sandboxes = normalizeListData(response.Sandboxes)

    return NextResponse.json({
      ok: true,
      data: sandboxes,
      totalCount: response.Total ?? response.TotalCount ?? sandboxes.length,
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected sandbox list request failure.")
  }
}
