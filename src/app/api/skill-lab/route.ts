import { NextResponse } from "next/server"

import {
  normalizeListData,
  readIntegerParam,
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

type DescribeSkillMarketResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  request_uuid?: string
  TotalCount?: number | string
  Skills?: SkillMarketSkill[] | Record<string, SkillMarketSkill>
  AllCategories?: string[]
}

const orderByOptions = new Set(["popular"])

function readOrderBy(value: string | null) {
  const orderBy = (value ?? "").trim()

  return orderByOptions.has(orderBy) ? orderBy : "popular"
}

function normalizeTotalCount(
  totalCount: DescribeSkillMarketResponse["TotalCount"],
  fallback: number
) {
  if (typeof totalCount === "number") {
    return totalCount
  }

  if (typeof totalCount === "string") {
    const parsed = Number.parseInt(totalCount, 10)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
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
    const keyword = readStringParam(searchParams, "keyword")
    const category = readStringParam(searchParams, "category")
    const params: Record<string, string | number | boolean> = {
      Action: "DescribeSkillMarket",
      ProjectId: projectId,
      Backend: "SkillLab",
      OrderBy: readOrderBy(searchParams.get("orderBy")),
      Offset: readIntegerParam(searchParams, "offset", 0, {
        min: 0,
        max: 100_000,
      }),
      Limit: readIntegerParam(searchParams, "limit", 10, {
        min: 1,
        max: 50,
      }),
    }

    if (keyword) {
      params.Keyword = keyword
    }

    if (category && category !== "all") {
      params.Category = category
    }

    const response = await callUCloudAction<DescribeSkillMarketResponse>({
      credentials: session,
      params,
    })
    const skills = normalizeListData(response.Skills)

    return NextResponse.json({
      ok: true,
      data: skills,
      totalCount: normalizeTotalCount(response.TotalCount, skills.length),
      categories: response.AllCategories ?? [],
      requestUuid: response.request_uuid,
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected skill lab request failure.")
  }
}
