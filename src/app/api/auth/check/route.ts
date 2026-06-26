import { NextResponse } from "next/server"

import { setCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type CheckRequestBody = {
  secretKey?: unknown
  accessKey?: unknown
  projectId?: unknown
}

type UCloudListRegionsResponse = {
  RetCode?: number
  Action?: string
  Message?: string
  Regions?: Array<{
    Region?: string
    LocalName?: string
    CounrtyCode?: string
    ChineseMainland?: boolean
    Category?: string
  }>
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  let body: CheckRequestBody

  try {
    body = (await request.json()) as CheckRequestBody
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid login payload.",
      },
      { status: 400 }
    )
  }

  const secretKey = readString(body.secretKey)
  const accessKey = readString(body.accessKey)
  const projectId = readString(body.projectId)

  if (!secretKey || !accessKey || !projectId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Secret Key, Access Key, and Project Id are required.",
      },
      { status: 400 }
    )
  }

  try {
    const data = await callUCloudAction<UCloudListRegionsResponse>({
      credentials: {
        accessKey,
        secretKey,
        projectId,
      },
      params: {
        Action: "ListRegions",
      },
    })

    await setCredentialSession({
      accessKey,
      secretKey,
      projectId,
    })

    return NextResponse.json({
      ok: true,
      message: "Login check passed.",
      projectId,
      regionCount: data.Regions?.length ?? 0,
    })
  } catch (error) {
    if (error instanceof UCloudApiError) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message || "UCloud credential check failed.",
          retCode: error.retCode,
        },
        { status: error.retCode === 170 ? 401 : error.status }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Unable to complete UCloud credential check.",
      },
      { status: 502 }
    )
  }
}
