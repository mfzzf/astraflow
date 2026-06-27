import { NextResponse } from "next/server"

import { readStringParam, toErrorResponse } from "@/lib/api-utils"
import { getCredentialSession } from "@/lib/session"
import { callUCloudAction } from "@/lib/ucloud"

type BillingOption = {
  Name?: string
  Value?: string | number
}

type GetFilterOptionsResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  request_uuid?: string
  ResourceIds?: BillingOption[]
  Models?: BillingOption[]
  Regions?: BillingOption[]
  Dimensions?: BillingOption[]
  PricingUnits?: BillingOption[]
  ProductCodes?: BillingOption[]
  Projects?: BillingOption[]
  PricingSKUs?: BillingOption[]
  OrderTypes?: BillingOption[]
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
    const productCode = readStringParam(searchParams, "productCode", "modelverse")

    const response = await callUCloudAction<GetFilterOptionsResponse>({
      credentials: session,
      params: {
        Action: "GetFilterOptions",
        ProjectId: projectId,
        ProductCode: productCode,
      },
    })

    return NextResponse.json({
      ok: true,
      data: response,
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected usage filter request failure.")
  }
}
