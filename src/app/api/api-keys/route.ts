import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type UMInferAPIKey = {
  IPWhitelist?: string
  KeyId?: string
  Name?: string
  ChannelId?: number
  TopOrganizationId?: number
  OrganizationId?: number
  Status?: number
  CreateTime?: number
  Key?: string
  ExpireTime?: number
  ModelverseDisabled?: number
  SandBoxDisabled?: number
  DailyLimitAmount?: string
  DailyUsedAmount?: string
  MonthlyLimitAmount?: string
  MonthlyUsedAmount?: string
  GrantAllModels?: boolean
  GrantedModels?: string[] | string
}

type ListUMInferAPIKeyResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Data?: UMInferAPIKey[] | Record<string, UMInferAPIKey>
  TotalCount?: number
}

type MutateUMInferAPIKeyResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Data?: UMInferAPIKey
  UminferID?: string
  TotalCount?: number
}

type APIKeyPayload = {
  projectId?: unknown
  keyId?: unknown
  name?: unknown
  modelverseEnabled?: unknown
  sandboxEnabled?: unknown
  dailyLimitAmount?: unknown
  monthlyLimitAmount?: unknown
  grantAllModels?: unknown
  grantedModels?: unknown
  ipWhitelist?: unknown
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeGrantedModels(input: string) {
  if (!input) {
    return ""
  }

  if (input.startsWith("[")) {
    const parsed = JSON.parse(input) as unknown

    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== "string")
    ) {
      throw new Error("Granted models must be a JSON array of strings.")
    }

    return JSON.stringify(parsed)
  }

  const models = input
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)

  return JSON.stringify(models)
}

function toMutationParams(projectId: string, payload: APIKeyPayload) {
  const name = readString(payload.name)
  const dailyLimitAmount = readString(payload.dailyLimitAmount)
  const monthlyLimitAmount = readString(payload.monthlyLimitAmount)
  const grantAllModels = readBoolean(payload.grantAllModels, true)
  const grantedModels = readString(payload.grantedModels)
  const ipWhitelist = readString(payload.ipWhitelist)
  const params: Record<string, string | number | boolean> = {
    ProjectId: projectId,
    ModelverseDisabled: readBoolean(payload.modelverseEnabled, true) ? 0 : 1,
    SandBoxDisabled: readBoolean(payload.sandboxEnabled, true) ? 0 : 1,
    GrantAllModels: grantAllModels,
  }

  if (name) {
    params.Name = name
  }

  if (dailyLimitAmount) {
    params.DailyLimitAmount = dailyLimitAmount
  }

  if (monthlyLimitAmount) {
    params.MonthlyLimitAmount = monthlyLimitAmount
  }

  if (!grantAllModels) {
    const normalizedModels = normalizeGrantedModels(grantedModels)

    if (!normalizedModels || normalizedModels === "[]") {
      throw new Error("Granted models are required when all-model access is off.")
    }

    params.GrantedModels = normalizedModels
  }

  if (ipWhitelist) {
    params.IPWhitelist = ipWhitelist
  }

  return params
}

function normalizeListData(data: ListUMInferAPIKeyResponse["Data"]) {
  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === "object") {
    return Object.values(data)
  }

  return []
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
      message: "Unexpected API key request failure.",
    },
    { status: 500 }
  )
}

async function readSession() {
  const session = await getCredentialSession()

  if (!session) {
    return null
  }

  return session
}

function readProjectId(sessionProjectId: string, value: unknown) {
  return readString(value) || sessionProjectId
}

export async function GET(request: Request) {
  const session = await readSession()

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
    const projectId = readProjectId(
      session.projectId,
      searchParams.get("projectId")
    )
    const data = await callUCloudAction<ListUMInferAPIKeyResponse>({
      credentials: session,
      params: {
        Action: "ListUMInferAPIKey",
        ProjectId: projectId,
        Offset: 0,
        Limit: 100,
      },
    })

    return NextResponse.json({
      ok: true,
      data: normalizeListData(data.Data),
      totalCount: data.TotalCount ?? normalizeListData(data.Data).length,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const session = await readSession()

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
    const payload = (await request.json()) as APIKeyPayload
    const name = readString(payload.name)
    const projectId = readProjectId(session.projectId, payload.projectId)

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          message: "Name is required.",
        },
        { status: 400 }
      )
    }

    const data = await callUCloudAction<MutateUMInferAPIKeyResponse>({
      credentials: session,
      params: {
        Action: "CreateUMInferAPIKey",
        ...toMutationParams(projectId, payload),
        Name: name,
      },
    })

    return NextResponse.json({
      ok: true,
      data: data.Data,
      totalCount: data.TotalCount,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const session = await readSession()

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
    const payload = (await request.json()) as APIKeyPayload
    const keyId = readString(payload.keyId)
    const projectId = readProjectId(session.projectId, payload.projectId)

    if (!keyId) {
      return NextResponse.json(
        {
          ok: false,
          message: "KeyId is required.",
        },
        { status: 400 }
      )
    }

    const data = await callUCloudAction<MutateUMInferAPIKeyResponse>({
      credentials: session,
      params: {
        Action: "UpdateUMInferAPIKey",
        KeyId: keyId,
        ...toMutationParams(projectId, payload),
      },
    })

    return NextResponse.json({
      ok: true,
      uminferId: data.UminferID,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const session = await readSession()

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
    const payload = (await request.json()) as APIKeyPayload
    const keyId = readString(payload.keyId)
    const projectId = readProjectId(session.projectId, payload.projectId)

    if (!keyId) {
      return NextResponse.json(
        {
          ok: false,
          message: "KeyId is required.",
        },
        { status: 400 }
      )
    }

    const data = await callUCloudAction<MutateUMInferAPIKeyResponse>({
      credentials: session,
      params: {
        Action: "DeleteUMInferAPIKey",
        ProjectId: projectId,
        KeyId: keyId,
      },
    })

    return NextResponse.json({
      ok: true,
      uminferId: data.UminferID,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
