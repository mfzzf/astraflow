import { NextResponse } from "next/server"

import {
  normalizeListData,
  readIntegerParam,
  readNumberListParam,
  readStringListParam,
  readStringParam,
  toErrorResponse,
} from "@/lib/api-utils"
import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, type UCloudParamValue } from "@/lib/ucloud"

type PaidOrderItem = Record<string, string | number | boolean | undefined>

type ListPaidOrdersResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  request_uuid?: string
  Total?: number
  TotalCount?: number
  Orders?: PaidOrderItem[] | Record<string, PaidOrderItem>
  Items?: PaidOrderItem[] | Record<string, PaidOrderItem>
  PaidOrders?: PaidOrderItem[] | Record<string, PaidOrderItem>
  Data?: PaidOrderItem[] | Record<string, PaidOrderItem>
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

function normalizePaidOrders(response: ListPaidOrdersResponse) {
  return normalizeListData(
    response.Orders ?? response.Items ?? response.PaidOrders ?? response.Data
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
    const params: Record<string, UCloudParamValue> = {
      Action: "ListPaidOrders",
      ProjectId: projectId,
      ProductCodes: productCodes,
      OrderTypes: orderTypes,
      StartTime: startTime,
      EndTime: endTime,
      Page: readIntegerParam(searchParams, "page", 1, { min: 1 }),
      PageSize: readIntegerParam(searchParams, "pageSize", 20, {
        min: 1,
        max: 100,
      }),
    }

    addOptionalFilters(params, searchParams)

    const response = await callUCloudAction<ListPaidOrdersResponse>({
      credentials: session,
      params,
    })
    const orders = normalizePaidOrders(response)

    return NextResponse.json({
      ok: true,
      data: orders,
      totalCount: response.Total ?? response.TotalCount ?? orders.length,
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected paid order detail request failure.")
  }
}
