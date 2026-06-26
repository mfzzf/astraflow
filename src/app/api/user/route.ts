import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type OriginUser = {
  UserEmail?: string
  CompanyName?: string
  UserName?: string
  Administrator?: string
}

type UserInfo = {
  UserId?: number
  UserEmail?: string
  UserPhone?: string
  PhonePrefix?: string
  UserType?: number
  UserName?: string
  CompanyName?: string
  IndustryType?: number
  Province?: string
  City?: string
  UserAddress?: string
  Admin?: number
  UserVersion?: number
  Finance?: number
  Administrator?: string
  AuthState?: string
  PasswordPolicyDate?: number
  PasswordPolicyTipsStatus?: number
  MandatoryTOTP?: number
  IsAlias?: number
  HasNewRole?: number
  OriginUser?: OriginUser
  IsAPIToken?: number
  IsBindEmail?: boolean
  IsOpenPhoneLogin?: boolean
}

type GetUserInfoResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  DataSet?: unknown[]
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
      message: "Unexpected user request failure.",
    },
    { status: 500 }
  )
}

function isUserInfo(value: unknown): value is UserInfo {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function normalizeUserInfo(dataSet: unknown[] = []) {
  const user = dataSet.find(isUserInfo)

  return user ?? null
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
    const data = await callUCloudAction<GetUserInfoResponse>({
      credentials: session,
      params: {
        Action: "GetUserInfo",
      },
    })

    return NextResponse.json({
      ok: true,
      data: normalizeUserInfo(data.DataSet),
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
