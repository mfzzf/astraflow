import { NextResponse } from "next/server"

import {
  readStringListParam,
  readStringParam,
  toErrorResponse,
} from "@/lib/api-utils"
import { getCredentialSession } from "@/lib/session"
import { callUCloudAction } from "@/lib/ucloud"

type MonthlyAmountResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  request_uuid?: string
  BillingCycle?: string
  TotalOrderAmount?: string
  PaidAmount?: string
  UnpaidAmount?: string
  StarCardAmount?: string
  IsCurrentMonth?: boolean
}

type MonthlyBill = {
  OrganizationID?: number
  OrganizationName?: string
  OrderTotalPrice?: string
  Coupon?: string
  BonusAccount?: string
  CashAccount?: string
  StarCardAccount?: string
}

type MonthlyPaidBillResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  request_uuid?: string
  BillingCycle?: string
  Bills?: MonthlyBill[]
}

function currentBillingCycle() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")

  return `${now.getFullYear()}-${month}`
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
    const billingCycle = readStringParam(
      searchParams,
      "billingCycle",
      currentBillingCycle()
    )
    const dimension = readStringParam(searchParams, "dimension", "project")
    const productCodes = readStringListParam(searchParams, "productCodes", [
      "modelverse",
    ])
    const commonParams = {
      ProjectId: projectId,
      BillingCycle: billingCycle,
      ProductCodes: productCodes,
    }

    const [amount, paidBill] = await Promise.all([
      callUCloudAction<MonthlyAmountResponse>({
        credentials: session,
        params: {
          ...commonParams,
          Action: "GetTxMonthlyAmount",
        },
      }),
      callUCloudAction<MonthlyPaidBillResponse>({
        credentials: session,
        params: {
          ...commonParams,
          Action: "GetTxMonthlyPaidBill",
          Dimension: dimension,
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        amount,
        paidBill,
      },
    })
  } catch (error) {
    return toErrorResponse(error, "Unexpected monthly usage request failure.")
  }
}
