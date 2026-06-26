import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type UCloudProject = {
  ProjectID?: string
  ProjectName?: string
  UserCount?: number
  CreatedAt?: number
}

type ListProjectsResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Projects?: UCloudProject[]
  TotalCount?: number
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

  return NextResponse.json(
    {
      ok: false,
      message: "Unexpected project request failure.",
    },
    { status: 500 }
  )
}

export async function GET() {
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
    const data = await callUCloudAction<ListProjectsResponse>({
      credentials: session,
      params: {
        Action: "ListProjects",
        Offset: 0,
        Limit: 100,
      },
    })

    return NextResponse.json({
      ok: true,
      data: data.Projects ?? [],
      totalCount: data.TotalCount ?? data.Projects?.length ?? 0,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
