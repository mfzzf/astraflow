import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type PriceRate = {
  ChargeItem?: string
  ChargeItemDescription?: string
  ChargeItemDescriptionEn?: string
  Currency?: string
  Unit?: string
  UnitEn?: string
  Price?: string | number
}

type PriceTier = {
  Rates?: PriceRate[]
  Description?: string
  DescriptionEn?: string
  Condition?: string
}

type ModelPriceGroup = {
  Manufacturer?: string
  ModelName?: string
  ModelId?: string
  Tiers?: PriceTier[]
}

type GetUFSquareModelPricesResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  RequestId?: string
  TotalCount?: number | string
  Models?: ModelPriceGroup[] | Record<string, ModelPriceGroup>
}

const PRICE_PAGE_SIZE = 50

function readString(value: string | null) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeTotalCount(
  totalCount: GetUFSquareModelPricesResponse["TotalCount"],
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

function normalizeListData(data: GetUFSquareModelPricesResponse["Models"]) {
  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === "object") {
    return Object.values(data)
  }

  return []
}

async function fetchPricePage({
  credentials,
  projectId,
  keyword,
  offset,
  limit,
}: {
  credentials: NonNullable<Awaited<ReturnType<typeof getCredentialSession>>>
  projectId: string
  keyword: string
  offset: number
  limit: number
}) {
  return callUCloudAction<GetUFSquareModelPricesResponse>({
    credentials,
    params: {
      Action: "GetUFSquareModelPrices",
      ProjectId: projectId,
      Keyword: keyword,
      Offset: offset,
      Limit: limit,
    },
  })
}

async function fetchAllPriceGroups({
  credentials,
  projectId,
  keyword,
}: {
  credentials: NonNullable<Awaited<ReturnType<typeof getCredentialSession>>>
  projectId: string
  keyword: string
}) {
  const firstPage = await fetchPricePage({
    credentials,
    projectId,
    keyword,
    offset: 0,
    limit: PRICE_PAGE_SIZE,
  })
  const priceGroups = normalizeListData(firstPage.Models)
  const totalCount = normalizeTotalCount(firstPage.TotalCount, priceGroups.length)

  for (
    let offset = PRICE_PAGE_SIZE;
    offset < totalCount;
    offset += PRICE_PAGE_SIZE
  ) {
    const page = await fetchPricePage({
      credentials,
      projectId,
      keyword,
      offset,
      limit: PRICE_PAGE_SIZE,
    })

    priceGroups.push(...normalizeListData(page.Models))
  }

  return {
    priceGroups,
    totalCount,
    requestId: firstPage.RequestId,
  }
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
      message: "Unexpected model price request failure.",
    },
    { status: 500 }
  )
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
    const projectId = readString(searchParams.get("projectId")) || session.projectId
    const keyword = readString(searchParams.get("keyword"))

    if (!keyword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Keyword is required.",
        },
        { status: 400 }
      )
    }

    const data = await fetchAllPriceGroups({
      credentials: session,
      projectId,
      keyword,
    })

    return NextResponse.json({
      ok: true,
      data: data.priceGroups,
      totalCount: data.totalCount,
      requestId: data.requestId,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
