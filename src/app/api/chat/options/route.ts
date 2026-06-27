import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type UMInferAPIKey = {
  KeyId?: string
  Name?: string
  Status?: number
  ModelverseDisabled?: number
}

type ListUMInferAPIKeyResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Data?: UMInferAPIKey[] | Record<string, UMInferAPIKey>
  TotalCount?: number
}

type SquareModel = {
  Id?: string
  Name?: string
  ChineseName?: string
  Manufacturer?: string
  MaxModelLen?: number
  MaxInputTokens?: number
  MaxOutputTokens?: number
  HfUpdateTime?: number
  CreateAt?: number
  UpdateAt?: number
  SupportedCapabilities?: string[] | null
  OutputModalities?: string[] | null
  Icon?: string
}

type ListUFSquareModelResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  TotalCount?: number | string
  SquareModels?: SquareModel[] | Record<string, SquareModel>
}

const LIST_PAGE_SIZE = 100

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeApiKeys(data: ListUMInferAPIKeyResponse["Data"]) {
  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === "object") {
    return Object.values(data)
  }

  return []
}

function normalizeModels(data: ListUFSquareModelResponse["SquareModels"]) {
  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === "object") {
    return Object.values(data)
  }

  return []
}

function normalizeTotalCount(
  totalCount: ListUFSquareModelResponse["TotalCount"],
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

function getContextLength(model: SquareModel) {
  const lengths = [
    model.MaxModelLen,
    model.MaxInputTokens,
    model.MaxOutputTokens,
  ].filter(
    (value): value is number => typeof value === "number" && value > 0
  )

  return lengths.length > 0 ? Math.max(...lengths) : undefined
}

function hasHotTag(model: SquareModel) {
  return (model.SupportedCapabilities ?? []).some(
    (tag) => tag.toLowerCase() === "hot"
  )
}

function supportsTextOutput(model: SquareModel) {
  return (model.OutputModalities ?? []).some(
    (modality) => modality.toLowerCase() === "text"
  )
}

function compareByRecency(left: SquareModel, right: SquareModel) {
  const leftTime = left.HfUpdateTime ?? left.UpdateAt ?? left.CreateAt ?? 0
  const rightTime = right.HfUpdateTime ?? right.UpdateAt ?? right.CreateAt ?? 0

  return rightTime - leftTime
}

function sortModels(models: SquareModel[]) {
  return models.toSorted((left, right) => {
    const hotRank = Number(hasHotTag(right)) - Number(hasHotTag(left))

    if (hotRank !== 0) {
      return hotRank
    }

    const recency = compareByRecency(left, right)

    if (recency !== 0) {
      return recency
    }

    return (left.Name ?? "").localeCompare(right.Name ?? "")
  })
}

async function fetchAllModels({
  credentials,
  projectId,
}: {
  credentials: NonNullable<Awaited<ReturnType<typeof getCredentialSession>>>
  projectId: string
}) {
  const firstPage = await callUCloudAction<ListUFSquareModelResponse>({
    credentials,
    params: {
      Action: "ListUFSquareModel",
      ProjectId: projectId,
      Offset: 0,
      Limit: LIST_PAGE_SIZE,
      OrderBy: "HfUpdateTime",
      Order: "Desc",
    },
  })
  const models = normalizeModels(firstPage.SquareModels)
  const totalCount = normalizeTotalCount(firstPage.TotalCount, models.length)

  for (
    let offset = LIST_PAGE_SIZE;
    offset < totalCount;
    offset += LIST_PAGE_SIZE
  ) {
    const page = await callUCloudAction<ListUFSquareModelResponse>({
      credentials,
      params: {
        Action: "ListUFSquareModel",
        ProjectId: projectId,
        Offset: offset,
        Limit: LIST_PAGE_SIZE,
        OrderBy: "HfUpdateTime",
        Order: "Desc",
      },
    })

    models.push(...normalizeModels(page.SquareModels))
  }

  return models
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
      message: "Unexpected chat options request failure.",
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
    const [apiKeysResponse, allModels] = await Promise.all([
      callUCloudAction<ListUMInferAPIKeyResponse>({
        credentials: session,
        params: {
          Action: "ListUMInferAPIKey",
          ProjectId: projectId,
          Offset: 0,
          Limit: 100,
        },
      }),
      fetchAllModels({
        credentials: session,
        projectId,
      }),
    ])
    const apiKeys = normalizeApiKeys(apiKeysResponse.Data)
      .filter(
        (apiKey) =>
          apiKey.KeyId &&
          (apiKey.Status === undefined || apiKey.Status === 1) &&
          apiKey.ModelverseDisabled !== 1
      )
      .map((apiKey) => ({
        id: apiKey.KeyId as string,
        name: apiKey.Name || apiKey.KeyId || "Unnamed key",
      }))
    const models = sortModels(allModels.filter(supportsTextOutput))
      .filter((model) => model.Name)
      .map((model) => ({
        id: model.Name as string,
        name: model.Name as string,
        displayName: model.ChineseName || model.Name || "",
        vendor: model.Manufacturer || "",
        contextLength: getContextLength(model),
        icon: model.Icon || "",
        hot: hasHotTag(model),
      }))

    return NextResponse.json({
      ok: true,
      models,
      apiKeys,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
