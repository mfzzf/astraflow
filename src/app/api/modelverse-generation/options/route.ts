import { NextResponse } from "next/server"

import {
  findMatchingOpenApiSpecs,
  getModelverseOpenApiSpecs,
  modelSupportsGenerationKind,
  type SquareModelForOpenApiMatch,
} from "@/lib/modelverse-openapi"
import type {
  ModelverseGenerationKind,
  ModelverseGenerationModel,
} from "@/lib/modelverse-generation-types"
import { listModelverseApiKeys } from "@/lib/modelverse-api-keys"
import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

export const runtime = "nodejs"

type SquareModel = SquareModelForOpenApiMatch & {
  Id?: string
  Name?: string
  ChineseName?: string
  Manufacturer?: string
  ModelType?: string
  ModalTypes?: string[] | null
  HfUpdateTime?: number
  CreateAt?: number
  UpdateAt?: number
  SupportedCapabilities?: string[] | null
  InputModalities?: string[] | null
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
const generationKinds = new Set<ModelverseGenerationKind>([
  "audio",
  "image",
  "video",
])

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readKind(value: string | null): ModelverseGenerationKind {
  const normalized = readString(value).toLowerCase()

  return generationKinds.has(normalized as ModelverseGenerationKind)
    ? (normalized as ModelverseGenerationKind)
    : "image"
}

function normalizeListData(data: ListUFSquareModelResponse["SquareModels"]) {
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

function hasHotTag(model: SquareModel) {
  return (model.SupportedCapabilities ?? []).some(
    (tag) => readString(tag).toLowerCase() === "hot"
  )
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => readString(item))
        .filter((item) => item.length > 0)
    : []
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
  const models = normalizeListData(firstPage.SquareModels)
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

    models.push(...normalizeListData(page.SquareModels))
  }

  return models
}

function toGenerationModel(
  model: SquareModel,
  specs: Awaited<ReturnType<typeof getModelverseOpenApiSpecs>>
): ModelverseGenerationModel | undefined {
  if (!model.Name) {
    return undefined
  }

  const matchedSpecs = findMatchingOpenApiSpecs(model, specs)

  if (matchedSpecs.length === 0) {
    return undefined
  }

  return {
    id: model.Id || model.Name,
    name: model.Name,
    displayName: model.ChineseName || model.Name,
    vendor: model.Manufacturer || "",
    modelType: model.ModelType || "",
    inputModalities: stringList(model.InputModalities),
    outputModalities: stringList(model.OutputModalities),
    icon: model.Icon || "",
    hot: hasHotTag(model),
    updatedAt: model.HfUpdateTime || model.UpdateAt || model.CreateAt,
    specs: matchedSpecs,
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
      message: "Unexpected Modelverse generation options request failure.",
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
    const kind = readKind(searchParams.get("kind"))
    const [models, specs, apiKeys] = await Promise.all([
      fetchAllModels({
        credentials: session,
        projectId,
      }),
      getModelverseOpenApiSpecs(kind),
      listModelverseApiKeys({
        credentials: session,
        projectId,
      }),
    ])
    const candidateModels = sortModels(
      models.filter(
        (model) =>
          model.Name &&
          (modelSupportsGenerationKind(model, kind) ||
            findMatchingOpenApiSpecs(model, specs, 1).length > 0)
      )
    )
    const generationModels = candidateModels
      .map((model) => toGenerationModel(model, specs))
      .filter(
        (model): model is ModelverseGenerationModel => model !== undefined
      )

    return NextResponse.json({
      ok: true,
      data: {
        kind,
        models: generationModels,
        apiKeys: apiKeys.map(({ id, name }) => ({ id, name })),
        totalModels: candidateModels.length,
        matchedModels: generationModels.length,
        unmatchedModels: candidateModels.length - generationModels.length,
        catalogSpecs: specs.length,
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
