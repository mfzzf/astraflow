import { NextResponse } from "next/server"

import {
  readStringParam,
  toErrorResponse,
} from "@/lib/api-utils"
import { getCredentialSession } from "@/lib/session"
import { callUCloudAction } from "@/lib/ucloud"

type SkillMarketSkill = {
  Slug?: string
  Version?: string
  Name?: string
  Author?: string
  Desc?: string
  DescZh?: string
  Category?: string
  Downloads?: number
  FileCount?: number
  SizeBytes?: number
  ArchiveUrl?: string
  UpStreamUrl?: string
  UpStreamUpdatedAt?: number
  FilesJson?: string
  SkillMdUrl?: string
  UpStream?: string
  Latest?: boolean
}

type DescribeSkillDetailResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  request_uuid?: string
  Skill?: SkillMarketSkill
  SkillMd?: string
}

function requireSkillParam(value: string, label: string) {
  if (!value) {
    throw new Error(`${label} is required.`)
  }

  return value
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
    const slug = requireSkillParam(readStringParam(searchParams, "slug"), "Slug")
    const version = requireSkillParam(
      readStringParam(searchParams, "version"),
      "Version"
    )
    const response = await callUCloudAction<DescribeSkillDetailResponse>({
      credentials: session,
      params: {
        Action: "DescribeSkillDetail",
        ProjectId: projectId,
        Backend: "SkillLab",
        Slug: slug,
        Version: version,
      },
    })

    return NextResponse.json({
      ok: true,
      data: response.Skill ?? null,
      skillMd: response.SkillMd ?? "",
      requestUuid: response.request_uuid,
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected skill detail request failure.")
  }
}
