import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { load } from "js-yaml"

import type {
  JsonValue,
  ModelverseGenerationKind,
  ModelverseMatchedSpec,
  ModelverseOpenApiExample,
  ModelverseOpenApiOperation,
  ModelverseOpenApiSpec,
} from "@/lib/modelverse-generation-types"

export type SquareModelForOpenApiMatch = {
  Id?: string
  Name?: string
  ChineseName?: string
  Manufacturer?: string
  ModelType?: string
  ModalTypes?: string[] | null
  SupportedCapabilities?: string[] | null
  InputModalities?: string[] | null
  OutputModalities?: string[] | null
}

type UnknownRecord = Record<string, unknown>

const OPENAPI_ROOT = path.join(
  process.cwd(),
  "openapi/modelverse-api-protocol-docs/openapi/english"
)
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"])
const GENERATION_KINDS: ModelverseGenerationKind[] = [
  "audio",
  "image",
  "video",
]

let catalogPromise: Promise<ModelverseOpenApiSpec[]> | null = null

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeProductName(value: string) {
  return value.replaceAll("ModelVerse", "Modelverse")
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : undefined
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function normalizeId(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "default"
  )
}

function normalizeMatchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function splitMatchTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
}

function sanitizeJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, sanitizeJsonValue(item)])
    )
  }

  return value === undefined ? null : String(value)
}

function resolveLocalRef(document: UnknownRecord, ref: string) {
  if (!ref.startsWith("#/")) {
    return undefined
  }

  return ref
    .slice(2)
    .split("/")
    .reduce<unknown>((currentValue, key) => {
      if (!isRecord(currentValue)) {
        return undefined
      }

      return currentValue[key]
    }, document)
}

function collectModelAliasesFromValue(
  value: unknown,
  aliases: Set<string>
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectModelAliasesFromValue(item, aliases)
    }

    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (key.toLowerCase() === "model") {
      if (typeof childValue === "string") {
        aliases.add(childValue)
      }

      if (Array.isArray(childValue)) {
        for (const item of childValue) {
          if (typeof item === "string") {
            aliases.add(item)
          }
        }
      }
    }

    collectModelAliasesFromValue(childValue, aliases)
  }
}

function collectSchemaModelAliases(
  value: unknown,
  aliases: Set<string>,
  parentKey = ""
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaModelAliases(item, aliases, parentKey)
    }

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (parentKey.toLowerCase() === "model") {
    const constValue = readString(value.const)

    if (constValue) {
      aliases.add(constValue)
    }

    for (const item of readArray(value.enum)) {
      if (typeof item === "string") {
        aliases.add(item)
      }
    }

    for (const item of readArray(value.examples)) {
      if (typeof item === "string") {
        aliases.add(item)
      }
    }
  }

  for (const [key, childValue] of Object.entries(value)) {
    collectSchemaModelAliases(childValue, aliases, key)
  }
}

function readExamples(
  document: UnknownRecord,
  examplesRecord: unknown
): ModelverseOpenApiExample[] {
  const examples = readRecord(examplesRecord)

  if (!examples) {
    return []
  }

  return Object.entries(examples)
    .map(([id, rawExample]) => {
      const exampleRecord = readRecord(rawExample)
      const resolvedExample =
        exampleRecord?.$ref && typeof exampleRecord.$ref === "string"
          ? readRecord(resolveLocalRef(document, exampleRecord.$ref))
          : exampleRecord

      if (!resolvedExample || !("value" in resolvedExample)) {
        return undefined
      }

      return {
        id,
        summary: readString(resolvedExample.summary) || id,
        value: sanitizeJsonValue(resolvedExample.value),
      }
    })
    .filter((item): item is ModelverseOpenApiExample => Boolean(item))
}

function readOpenApiOperations(
  document: UnknownRecord,
  aliases: Set<string>
) {
  const operations: ModelverseOpenApiOperation[] = []
  const paths = readRecord(document.paths)

  if (!paths) {
    return operations
  }

  for (const [apiPath, rawPathItem] of Object.entries(paths)) {
    const pathItem = readRecord(rawPathItem)

    if (!pathItem) {
      continue
    }

    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) {
        continue
      }

      const operation = readRecord(rawOperation)
      const operationId =
        readString(operation?.operationId) ||
        `${method}-${normalizeId(apiPath)}`
      const operationSummary =
        normalizeProductName(readString(operation?.summary)) ||
        readString(operation?.operationId) ||
        `${method.toUpperCase()} ${apiPath}`
      const requestBody = readRecord(operation?.requestBody)
      const content = readRecord(requestBody?.content)

      if (!operation) {
        continue
      }

      if (!content) {
        const isStatusOperation =
          method === "get" &&
          (apiPath.toLowerCase().includes("status") ||
            operationId.toLowerCase().includes("status") ||
            operationSummary.toLowerCase().includes("status"))

        if (isStatusOperation) {
          operations.push({
            id: operationId,
            method: method.toUpperCase(),
            path: apiPath,
            summary: operationSummary,
            contentType: "application/json",
            examples: [
              {
                id: "taskStatus",
                summary: "Task status",
                value: {
                  task_id: "task_id",
                },
              },
            ],
          })
        }

        continue
      }

      for (const [contentType, rawContentItem] of Object.entries(content)) {
        const contentItem = readRecord(rawContentItem)
        const examples = readExamples(document, contentItem?.examples)

        if (examples.length === 0) {
          continue
        }

        for (const example of examples) {
          collectModelAliasesFromValue(example.value, aliases)
        }

        operations.push({
          id: operationId,
          method: method.toUpperCase(),
          path: apiPath,
          summary: operationSummary,
          contentType,
          examples,
        })
      }
    }
  }

  return operations
}

async function readOpenApiSpecFile(
  kind: ModelverseGenerationKind,
  fileName: string
) {
  const absolutePath = path.join(OPENAPI_ROOT, kind, fileName)
  const rawDocument = await readFile(absolutePath, "utf8")
  const document = readRecord(load(rawDocument))

  if (!document) {
    return undefined
  }

  const aliases = new Set<string>([path.basename(fileName, ".yaml")])
  const info = readRecord(document.info)
  const rawTitle = readString(info?.title) || path.basename(fileName, ".yaml")
  const title = normalizeProductName(rawTitle)

  aliases.add(rawTitle)
  aliases.add(title)

  for (const rawTag of readArray(document.tags)) {
    const tag = readRecord(rawTag)
    const tagName = readString(tag?.name)

    if (tagName) {
      aliases.add(tagName)
    }
  }

  collectSchemaModelAliases(readRecord(document.components)?.schemas, aliases)

  const operations = readOpenApiOperations(document, aliases)

  if (operations.length === 0) {
    return undefined
  }

  return {
    id: `${kind}-${normalizeId(path.basename(fileName, ".yaml"))}`,
    kind,
    title,
    sourceFile: `openapi/modelverse-api-protocol-docs/openapi/english/${kind}/${fileName}`,
    serverUrl:
      readString(readRecord(readArray(document.servers)[0])?.url) ||
      "https://api.modelverse.cn",
    aliases: Array.from(aliases).filter(Boolean).sort(),
    operations,
  } satisfies ModelverseOpenApiSpec
}

async function loadLocalOpenApiCatalog() {
  const specs: ModelverseOpenApiSpec[] = []

  for (const kind of GENERATION_KINDS) {
    const directory = path.join(OPENAPI_ROOT, kind)
    const fileNames = (await readdir(directory))
      .filter((fileName) => fileName.endsWith(".yaml"))
      .sort()
    const kindSpecs = await Promise.all(
      fileNames.map((fileName) => readOpenApiSpecFile(kind, fileName))
    )

    specs.push(
      ...kindSpecs.filter(
        (spec): spec is ModelverseOpenApiSpec => spec !== undefined
      )
    )
  }

  return specs
}

export function getModelverseOpenApiCatalog() {
  catalogPromise ??= loadLocalOpenApiCatalog()

  return catalogPromise
}

export function getModelverseOpenApiSpecs(kind: ModelverseGenerationKind) {
  return getModelverseOpenApiCatalog().then((specs) =>
    specs.filter((spec) => spec.kind === kind)
  )
}

function scoreAlias(left: string, right: string) {
  const leftNormalized = normalizeMatchValue(left)
  const rightNormalized = normalizeMatchValue(right)

  if (!leftNormalized || !rightNormalized) {
    return 0
  }

  if (left.toLowerCase() === right.toLowerCase()) {
    return 120
  }

  if (leftNormalized === rightNormalized) {
    return 110
  }

  const shortestLength = Math.min(leftNormalized.length, rightNormalized.length)

  if (
    shortestLength >= 5 &&
    (leftNormalized.includes(rightNormalized) ||
      rightNormalized.includes(leftNormalized))
  ) {
    return 70 + Math.min(30, shortestLength)
  }

  const leftTokens = new Set(splitMatchTokens(left))
  const rightTokens = splitMatchTokens(right)
  const sharedTokens = rightTokens.filter((token) => leftTokens.has(token))

  if (sharedTokens.length === 0) {
    return 0
  }

  return Math.min(65, sharedTokens.length * 18)
}

function modelAliases(model: SquareModelForOpenApiMatch) {
  return [
    model.Name,
    model.Id,
    model.ChineseName,
    model.ModelType ? `${model.Manufacturer ?? ""} ${model.ModelType}` : "",
  ].filter((value): value is string => Boolean(value))
}

export function modelSupportsGenerationKind(
  model: SquareModelForOpenApiMatch,
  kind: ModelverseGenerationKind
) {
  const signals = [
    model.ModelType,
    ...(model.ModalTypes ?? []),
    ...(model.InputModalities ?? []),
    ...(model.OutputModalities ?? []),
    ...(model.SupportedCapabilities ?? []),
  ]
    .map((value) => readString(value).toLowerCase())
    .filter(Boolean)

  if (kind === "audio") {
    return signals.some((signal) =>
      ["audio", "speech", "music", "sound", "tts", "voice"].some((token) =>
        signal.includes(token)
      )
    )
  }

  return signals.some((signal) => signal.includes(kind))
}

export function findMatchingOpenApiSpecs(
  model: SquareModelForOpenApiMatch,
  specs: ModelverseOpenApiSpec[],
  limit = 5
): ModelverseMatchedSpec[] {
  const aliasesForModel = modelAliases(model)

  return specs
    .map((spec) => {
      const score = Math.max(
        ...aliasesForModel.flatMap((modelAlias) =>
          spec.aliases.map((specAlias) => scoreAlias(modelAlias, specAlias))
        ),
        0
      )

      return {
        ...spec,
        score,
      }
    })
    .filter((spec) => spec.score >= 70)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((spec) => ({
      id: spec.id,
      kind: spec.kind,
      title: spec.title,
      sourceFile: spec.sourceFile,
      serverUrl: spec.serverUrl,
      operations: spec.operations,
      score: spec.score,
    }))
}
