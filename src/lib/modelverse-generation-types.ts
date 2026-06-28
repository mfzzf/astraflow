export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue }

export type ModelverseGenerationKind = "audio" | "image" | "video"

export type ModelverseOpenApiExample = {
  id: string
  summary: string
  value: JsonValue
}

export type ModelverseOpenApiOperation = {
  id: string
  method: string
  path: string
  summary: string
  contentType: string
  examples: ModelverseOpenApiExample[]
}

export type ModelverseOpenApiSpec = {
  id: string
  kind: ModelverseGenerationKind
  title: string
  sourceFile: string
  serverUrl: string
  aliases: string[]
  operations: ModelverseOpenApiOperation[]
}

export type ModelverseMatchedSpec = Omit<ModelverseOpenApiSpec, "aliases"> & {
  score: number
}

export type ModelverseGenerationModel = {
  id: string
  name: string
  displayName: string
  vendor: string
  modelType: string
  inputModalities: string[]
  outputModalities: string[]
  icon: string
  hot: boolean
  updatedAt?: number
  specs: ModelverseMatchedSpec[]
}

export type ModelverseApiKeyOption = {
  id: string
  name: string
}

export type ModelverseGenerationOptions = {
  kind: ModelverseGenerationKind
  models: ModelverseGenerationModel[]
  apiKeys: ModelverseApiKeyOption[]
  totalModels: number
  matchedModels: number
  unmatchedModels: number
  catalogSpecs: number
}

export type ModelverseGenerationOptionsResponse = {
  ok: boolean
  message?: string
  data?: ModelverseGenerationOptions
}
