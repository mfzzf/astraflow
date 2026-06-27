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
  ArchiveUrl?: string
}

type DescribeSkillDetailResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Skill?: SkillMarketSkill
}

function sanitizeFilenamePart(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "-").replaceAll(/-+/g, "-")
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
    const detail = await callUCloudAction<DescribeSkillDetailResponse>({
      credentials: session,
      params: {
        Action: "DescribeSkillDetail",
        ProjectId: projectId,
        Backend: "SkillLab",
        Slug: slug,
        Version: version,
      },
    })
    const archiveUrl = detail.Skill?.ArchiveUrl

    if (!archiveUrl) {
      return NextResponse.json(
        {
          ok: false,
          message: "Skill archive is unavailable.",
        },
        { status: 404 }
      )
    }

    const archiveResponse = await fetch(archiveUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })

    if (!archiveResponse.ok || !archiveResponse.body) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unable to download the skill archive.",
        },
        { status: archiveResponse.status || 502 }
      )
    }

    const filename = `${sanitizeFilenamePart(slug)}-${sanitizeFilenamePart(
      version
    )}.zip`
    const headers = new Headers()

    headers.set(
      "Content-Type",
      archiveResponse.headers.get("Content-Type") || "application/zip"
    )
    headers.set("Content-Disposition", `attachment; filename="${filename}"`)

    const contentLength = archiveResponse.headers.get("Content-Length")

    if (contentLength) {
      headers.set("Content-Length", contentLength)
    }

    return new Response(archiveResponse.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected skill download request failure.")
  }
}
