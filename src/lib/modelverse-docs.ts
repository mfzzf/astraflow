import fs from "node:fs"
import path from "node:path"

import {
  loader,
  type MetaData,
  type StaticSource,
  type VirtualFile,
} from "fumadocs-core/source"
import { createOpenAPI, type OpenAPIPageData } from "fumadocs-openapi/server"

const OPENAPI_ROOT = path.join(
  process.cwd(),
  "openapi/modelverse-api-protocol-docs/openapi"
)

const FOLDER_TITLES: Record<string, string> = {
  openapi: "OpenAPI",
  "openapi/chinese": "中文",
  "openapi/english": "English",
  anthropic: "Anthropic",
  audio: "Audio",
  chat: "Chat",
  common: "Common",
  gemini: "Gemini",
  image: "Image",
  responses: "Responses",
  video: "Video",
}

type ModelverseDocsSourceConfig = {
  pageData: OpenAPIPageData
  metaData: MetaData
}

type DocsSource = Awaited<ReturnType<typeof buildModelverseDocsSource>>

let docsSourcePromise: Promise<DocsSource> | undefined

function isYamlFile(fileName: string) {
  return /\.ya?ml$/i.test(fileName)
}

function toPosixPath(filePath: string) {
  return filePath.split(path.sep).join("/")
}

function readYamlFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return readYamlFiles(fullPath)
      }

      return isYamlFile(entry.name) ? [fullPath] : []
    })
    .sort((a, b) => a.localeCompare(b))
}

function slugifySegment(segment: string) {
  return segment
    .replace(/\.ya?ml$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function schemaIdToSlug(schemaId: string) {
  return schemaId
    .split("/")
    .map(slugifySegment)
    .filter(Boolean)
    .join("/")
}

function operationSlug(
  operationId: string | undefined,
  method: string,
  endpoint: string
) {
  return slugifySegment(operationId || `${method}-${endpoint}`)
}

function createOpenApiInput() {
  return Object.fromEntries(
    readYamlFiles(OPENAPI_ROOT).map((filePath) => [
      toPosixPath(path.relative(OPENAPI_ROOT, filePath)),
      filePath,
    ])
  )
}

function folderTitle(folderPath: string) {
  return (
    FOLDER_TITLES[folderPath] ||
    FOLDER_TITLES[path.basename(folderPath)] ||
    path.basename(folderPath)
  )
}

function createMetaFiles(
  pageFiles: VirtualFile<ModelverseDocsSourceConfig>[]
): VirtualFile<ModelverseDocsSourceConfig>[] {
  const folders = new Set<string>([
    "openapi",
    "openapi/chinese",
    "openapi/english",
  ])

  for (const file of pageFiles) {
    if (file.type !== "page") {
      continue
    }

    const directory = path.posix.dirname(file.path)
    const segments = directory.split("/").filter(Boolean)

    for (let index = 1; index <= segments.length; index += 1) {
      folders.add(segments.slice(0, index).join("/"))
    }
  }

  return [...folders].sort().map((folderPath) => ({
    type: "meta",
    path: `${folderPath}/meta.json`,
    data: {
      title: folderTitle(folderPath),
    },
  }))
}

async function buildModelverseDocsSource() {
  const openapi = createOpenAPI({
    input: createOpenApiInput(),
  })
  const openapiSource = await openapi.staticSource({
    baseDir: "openapi",
    per: "operation",
    groupBy(output) {
      return schemaIdToSlug(output.schemaId)
    },
    name(output) {
      if (output.type === "operation") {
        const operation =
          this.document.paths?.[output.item.path]?.[output.item.method]

        return operationSlug(
          operation?.operationId,
          output.item.method,
          output.item.path
        )
      }

      if (output.type === "webhook") {
        return operationSlug(undefined, output.item.method, output.item.name)
      }

      throw new Error("Unsupported OpenAPI page output.")
    },
  })
  const source: StaticSource<ModelverseDocsSourceConfig> = {
    files: [...openapiSource.files, ...createMetaFiles(openapiSource.files)],
  }

  return loader(source, {
    baseUrl: "/docs",
    plugins: [openapi.loaderPlugin()],
  })
}

export function getModelverseDocsSource() {
  docsSourcePromise ??= buildModelverseDocsSource()

  return docsSourcePromise
}
