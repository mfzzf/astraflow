import { NextResponse } from "next/server"

import {
  readNumberListParam,
  readStringListParam,
  readStringParam,
  toErrorResponse,
} from "@/lib/api-utils"
import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, type UCloudParamValue } from "@/lib/ucloud"

type PaidOrderSummary = {
  ResourceId?: string
  ResourceName?: string
  Region?: string
  RegionDisplay?: string
  PricingSkuId?: number
  PricingSKU?: string
  ModelID?: string
  ModelName?: string
  PricingUnit?: number
  PricingUnitName?: string
  OrderType?: number
  OrderTypeDisplay?: string
  ChargeType?: number
  Status?: number
  StatusDisplay?: string
  ListPrice?: string
  DiscountPrice?: string
  SumQuantity?: number
  SumQuantityDisplay?: string
  SumOrderPrice?: string
  SumOriginalPrice?: string
  SumCashAccount?: string
  SumStarCardAccount?: string
  SumBonusAccount?: string
  SumCoupon?: string
}

type ListPaidOrderSummaryResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  request_uuid?: string
  Summaries?: PaidOrderSummary[]
}

function todayStartInSeconds() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  return Math.floor(date.getTime() / 1000)
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000)
}

function addOptionalFilters(
  params: Record<string, UCloudParamValue>,
  searchParams: URLSearchParams
) {
  const region = readStringParam(searchParams, "region")
  const resourceId = readStringParam(searchParams, "resourceId")
  const modelId = readStringParam(searchParams, "modelId")
  const pricingSku = readStringParam(searchParams, "pricingSku")
  const pricingUnit = readStringParam(searchParams, "pricingUnit")

  if (region) {
    params.Region = region
  }

  if (resourceId) {
    params.ResourceId = resourceId
  }

  if (modelId) {
    params.ModelID = modelId
  }

  if (pricingSku) {
    params.PricingSKU = pricingSku
  }

  if (pricingUnit) {
    params.PricingUnit = Number(pricingUnit)
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

  try {
    const searchParams = new URL(request.url).searchParams
    const projectId = readStringParam(searchParams, "projectId", session.projectId)
    const productCodes = readStringListParam(searchParams, "productCodes", [
      "modelverse",
    ])
    const orderTypes = readNumberListParam(searchParams, "orderTypes", [102, 301])
    const startTime =
      Number.parseInt(searchParams.get("startTime") ?? "", 10) ||
      todayStartInSeconds()
    const endTime =
      Number.parseInt(searchParams.get("endTime") ?? "", 10) || nowInSeconds()
    const queryPeriod = readStringParam(searchParams, "queryPeriod")
    const params: Record<string, UCloudParamValue> = {
      Action: "ListPaidOrderSummary",
      ProjectId: projectId,
      ProductCodes: productCodes,
      OrderTypes: orderTypes,
      StartTime: startTime,
      EndTime: endTime,
    }

    if (queryPeriod) {
      params.QueryPeriod = queryPeriod
    }

    addOptionalFilters(params, searchParams)

    const response = await callUCloudAction<ListPaidOrderSummaryResponse>({
      credentials: session,
      params,
    })

    return NextResponse.json({
      ok: true,
      data: response.Summaries ?? [],
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected paid order summary request failure.")
  }
}
