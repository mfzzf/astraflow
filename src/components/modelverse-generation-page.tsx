"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  FileJsonIcon,
  HistoryIcon,
  ImageIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  MusicIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  TerminalIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type {
  JsonValue,
  ModelverseApiKeyOption,
  ModelverseGenerationKind,
  ModelverseGenerationModel,
  ModelverseGenerationOptions,
  ModelverseGenerationOptionsResponse,
  ModelverseMatchedSpec,
  ModelverseOpenApiOperation,
} from "@/lib/modelverse-generation-types"
import { cn } from "@/lib/utils"

type PreviewTab = "parameters" | "json" | "curl"

type CopyTarget = "request" | "curl"

type RunResponse = {
  ok: boolean
  status?: number
  statusText?: string
  contentType?: string
  data?: JsonValue
  binary?: string
  message?: string
}

type MediaItem = {
  id: string
  kind: ModelverseGenerationKind
  src: string
  label: string
}

type GenerationRecord = {
  id: string
  createdAt: number
  kind: ModelverseGenerationKind
  modelId: string
  modelName: string
  modelDisplayName: string
  specId: string
  operationId: string
  exampleId: string
  operationLabel: string
  exampleLabel: string
  requestBody: JsonValue
  result: RunResponse
  mediaItems: MediaItem[]
  taskId: string
  taskStatus: string
}

type SelectItemValue = {
  value: string
  label: string
}

const LONG_TEXT_FIELD_PATTERN =
  /prompt|input|text|lyrics|description|negative|script|content/i
const LOCAL_RECORD_STORAGE_PREFIX = "astraflow:modelverse-generation-records"
const MAX_LOCAL_RECORDS = 20
const LOCAL_RECORD_DISPLAY_LIMIT = 6

const FIELD_LABELS: Record<string, Record<string, string>> = {
  en: {
    aspect_ratio: "Aspect ratio",
    audio: "Audio",
    background: "Background",
    duration: "Duration",
    file: "File",
    first_frame_image: "First frame image",
    fps: "FPS",
    height: "Height",
    image: "Image",
    image_url: "Image URL",
    images: "Images",
    input: "Input",
    language: "Language",
    language_type: "Language",
    last_frame_image: "Last frame image",
    lyrics: "Lyrics",
    mask: "Mask",
    model: "Model",
    n: "Count",
    negative_prompt: "Negative prompt",
    output_compression: "Output compression",
    output_format: "Output format",
    prompt: "Prompt",
    quality: "Quality",
    ratio: "Ratio",
    reference_image: "Reference image",
    reference_images: "Reference images",
    resolution: "Resolution",
    response_format: "Response format",
    seed: "Seed",
    size: "Size",
    stream: "Stream",
    task_id: "Task ID",
    text: "Text",
    title: "Title",
    url: "URL",
    video: "Video",
    voice: "Voice",
    watermark: "Watermark",
    width: "Width",
  },
  zh: {
    aspect_ratio: "画面比例",
    audio: "音频",
    background: "背景",
    duration: "时长",
    file: "文件",
    first_frame_image: "首帧图",
    fps: "帧率",
    height: "高度",
    image: "图片",
    image_url: "图片地址",
    images: "图片",
    input: "输入",
    language: "语言",
    language_type: "语言",
    last_frame_image: "尾帧图",
    lyrics: "歌词",
    mask: "蒙版",
    model: "模型",
    n: "数量",
    negative_prompt: "负向提示词",
    output_compression: "输出压缩率",
    output_format: "输出格式",
    prompt: "提示词",
    quality: "质量",
    ratio: "比例",
    reference_image: "参考图",
    reference_images: "参考图",
    resolution: "分辨率",
    response_format: "返回格式",
    seed: "随机种子",
    size: "尺寸",
    stream: "流式返回",
    task_id: "任务 ID",
    text: "文本",
    title: "标题",
    url: "地址",
    video: "视频",
    voice: "音色",
    watermark: "水印",
    width: "宽度",
  },
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function formatJson(value: JsonValue) {
  return JSON.stringify(value, null, 2)
}

function cloneJsonValue(value: JsonValue): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function humanizeFieldName(value: string) {
  return value
    .replace(/\[\]/g, "")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function normalizeFieldKey(value: string) {
  return value.replace(/\[\]/g, "").toLowerCase()
}

function formatFieldName(value: string, locale: string) {
  const fieldKey = normalizeFieldKey(value)
  const localizedLabel = FIELD_LABELS[locale]?.[fieldKey]

  return localizedLabel ?? humanizeFieldName(value)
}

function formatTimestamp(timestamp: number | undefined, locale: string) {
  if (!timestamp) {
    return ""
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
  }).format(new Date(timestamp * 1000))
}

function formatRecordTimestamp(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

function formatSpecLabel(spec: ModelverseMatchedSpec, locale: string) {
  if (locale !== "zh") {
    return spec.title
  }

  return spec.title
    .replace(/\bImage API\b/g, "图像 API")
    .replace(/\bVideo API\b/g, "视频 API")
    .replace(/\bAudio API\b/g, "音频 API")
    .replace(/\bSpeech API\b/g, "语音 API")
}

function translateOperationSummary(
  operation: ModelverseOpenApiOperation,
  kind: ModelverseGenerationKind
) {
  const summary = operation.summary.trim()
  const lowerSummary = summary.toLowerCase()
  const lowerPath = operation.path.toLowerCase()

  if (
    lowerSummary.includes("status") ||
    lowerPath.includes("status") ||
    (operation.method === "GET" && lowerPath.includes("tasks"))
  ) {
    return "查询任务状态"
  }

  if (operation.method === "GET") {
    if (lowerPath.includes("models")) {
      return "列出模型"
    }

    return "查询结果"
  }

  if (lowerSummary.includes("edit") || lowerSummary.includes("inpaint")) {
    return "图片编辑"
  }

  if (lowerSummary.includes("erase")) {
    return "图片擦除"
  }

  if (kind === "image") {
    return "图片生成"
  }

  if (kind === "video") {
    if (
      lowerSummary.includes("image-to-video") ||
      lowerSummary.includes("image to video")
    ) {
      return "图生视频"
    }

    return "视频生成"
  }

  if (lowerSummary.includes("transcrib")) {
    return "语音识别"
  }

  if (lowerSummary.includes("music")) {
    return "音乐生成"
  }

  if (lowerSummary.includes("speech") || lowerSummary.includes("tts")) {
    return "语音合成"
  }

  if (lowerSummary.includes("sound")) {
    return "声音生成"
  }

  return summary
}

function formatOperationLabel(
  operation: ModelverseOpenApiOperation,
  locale: string,
  kind: ModelverseGenerationKind
) {
  const summary =
    locale === "zh"
      ? translateOperationSummary(operation, kind)
      : operation.summary

  return `${operation.method} · ${summary}`
}

function formatExampleLabel(
  example: { summary: string },
  locale: string
) {
  if (locale !== "zh") {
    return example.summary
  }

  const summary = example.summary.trim()
  const lowerSummary = summary.toLowerCase()

  if (lowerSummary.includes("task status")) {
    return "任务状态查询"
  }

  if (lowerSummary.includes("web search")) {
    return "联网搜索生成"
  }

  if (lowerSummary.includes("reference image")) {
    return "参考图生成"
  }

  if (lowerSummary.includes("base64")) {
    return lowerSummary.includes("stream") ? "流式 Base64 图片" : "Base64 图片"
  }

  if (
    lowerSummary.includes("text-to-video") ||
    lowerSummary.includes("text to video")
  ) {
    return "文生视频"
  }

  if (
    lowerSummary.includes("image-to-video") ||
    lowerSummary.includes("image to video")
  ) {
    return "图生视频"
  }

  if (lowerSummary.includes("first") && lowerSummary.includes("last")) {
    return "首尾帧生成"
  }

  if (lowerSummary.includes("chinese")) {
    return "中文示例"
  }

  if (lowerSummary.includes("auto") && lowerSummary.includes("language")) {
    return "自动识别语言"
  }

  if (lowerSummary.includes("music")) {
    return "音乐生成"
  }

  if (lowerSummary.includes("speech") || lowerSummary.includes("tts")) {
    return "语音合成"
  }

  return summary
}

function modelMatchesSearch(model: ModelverseGenerationModel, keyword: string) {
  if (!keyword) {
    return true
  }

  const haystack = [
    model.name,
    model.displayName,
    model.vendor,
    model.modelType,
    ...model.inputModalities,
    ...model.outputModalities,
    ...model.specs.map((spec) => spec.title),
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(keyword)
}

function modelIcon(kind: ModelverseGenerationKind) {
  if (kind === "audio") {
    return <MusicIcon />
  }

  if (kind === "video") {
    return <VideoIcon />
  }

  return <ImageIcon />
}

function applyModelNameToDraft(value: JsonValue, modelName: string): JsonValue {
  const draft = cloneJsonValue(value)

  if (isJsonObject(draft) && "model" in draft) {
    return {
      ...draft,
      model: modelName,
    }
  }

  return draft
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

function shouldTreatAsFileField(key: string, value: JsonValue) {
  if (typeof value !== "string") {
    return false
  }

  return (
    /file|image|audio|video|mask|voice|avatar/i.test(key) &&
    (/^\.\//.test(value) || value.startsWith("/") || value.includes("."))
  )
}

function flattenMultipartFields(
  value: JsonValue,
  prefix = ""
): Array<{ key: string; value: JsonValue }> {
  if (!isJsonObject(value)) {
    return prefix ? [{ key: prefix, value }] : []
  }

  return Object.entries(value).flatMap(([key, childValue]) => {
    const fieldKey = prefix ? `${prefix}[${key}]` : key

    if (Array.isArray(childValue)) {
      return childValue.map((item) => ({
        key,
        value: item,
      }))
    }

    if (isJsonObject(childValue)) {
      return [
        {
          key: fieldKey,
          value: childValue,
        },
      ]
    }

    return {
      key: fieldKey,
      value: childValue,
    }
  })
}

function buildCurlCommand({
  method,
  url,
  contentType,
  body,
}: {
  method: string
  url: string
  contentType: string
  body: JsonValue
}) {
  const lines = [
    `curl -X ${method} ${shellQuote(url)}`,
    "  -H 'Authorization: Bearer $MODELVERSE_API_KEY'",
  ]

  if (contentType.includes("multipart/form-data")) {
    for (const field of flattenMultipartFields(body)) {
      const fieldValue =
        isJsonObject(field.value) || Array.isArray(field.value)
          ? JSON.stringify(field.value)
          : String(field.value ?? "")
      const valuePrefix = shouldTreatAsFileField(field.key, field.value)
        ? "@"
        : ""

      lines.push(`  -F ${shellQuote(`${field.key}=${valuePrefix}${fieldValue}`)}`)
    }

    return lines.join(" \\\n")
  }

  lines.push(`  -H ${shellQuote(`Content-Type: ${contentType}`)}`)
  lines.push(`  -d ${shellQuote(formatJson(body))}`)

  return lines.join(" \\\n")
}

function isUrl(value: string) {
  try {
    const url = new URL(value)

    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function inferMediaKind(
  value: string,
  fallbackKind: ModelverseGenerationKind
): ModelverseGenerationKind | undefined {
  const normalized = value.toLowerCase().split("?")[0]

  if (
    normalized.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(normalized)
  ) {
    return "image"
  }

  if (
    normalized.startsWith("data:audio/") ||
    /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(normalized)
  ) {
    return "audio"
  }

  if (
    normalized.startsWith("data:video/") ||
    /\.(mp4|mov|webm|m4v|avi)$/i.test(normalized)
  ) {
    return "video"
  }

  return fallbackKind
}

function collectMediaItems(
  value: JsonValue | undefined,
  fallbackKind: ModelverseGenerationKind,
  items: MediaItem[],
  path: string[] = []
) {
  if (value === undefined || value === null) {
    return
  }

  const key = path.at(-1)?.toLowerCase() ?? ""

  if (typeof value === "string") {
    if (key === "b64_json") {
      items.push({
        id: path.join(".") || `image-${items.length}`,
        kind: "image",
        src: `data:image/png;base64,${value}`,
        label: path.join(".") || "image",
      })
      return
    }

    if (isUrl(value) || value.startsWith("data:")) {
      const mediaKind = inferMediaKind(value, fallbackKind)

      if (mediaKind) {
        items.push({
          id: path.join(".") || `${mediaKind}-${items.length}`,
          kind: mediaKind,
          src: value,
          label: path.join(".") || mediaKind,
        })
      }
    }

    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectMediaItems(item, fallbackKind, items, [...path, String(index)])
    )
    return
  }

  if (isJsonObject(value)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectMediaItems(childValue, fallbackKind, items, [...path, childKey])
    }
  }
}

function mediaItemsFromRunResult(
  result: RunResponse | null,
  fallbackKind: ModelverseGenerationKind
) {
  const items: MediaItem[] = []

  if (!result) {
    return items
  }

  if (result.binary && result.contentType) {
    const mediaKind = inferMediaKind(
      `data:${result.contentType};base64,`,
      fallbackKind
    )

    if (mediaKind) {
      items.push({
        id: "binary",
        kind: mediaKind,
        src: `data:${result.contentType};base64,${result.binary}`,
        label: result.contentType,
      })
    }
  }

  collectMediaItems(result.data, fallbackKind, items)

  return items
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "result"
  )
}

function mediaExtension(item: MediaItem) {
  if (item.src.startsWith("data:")) {
    const mimeType = item.src.slice(5, item.src.indexOf(";"))
    const subtype = mimeType.split("/")[1]

    if (subtype) {
      return subtype.replace("jpeg", "jpg")
    }
  }

  try {
    const pathname = new URL(item.src).pathname
    const extension = pathname.split(".").pop()

    if (extension && extension.length <= 5) {
      return extension
    }
  } catch {
    const extension = item.src.split("?")[0]?.split(".").pop()

    if (extension && extension.length <= 5) {
      return extension
    }
  }

  if (item.kind === "video") {
    return "mp4"
  }

  if (item.kind === "audio") {
    return "mp3"
  }

  return "png"
}

function downloadMediaItem(item: MediaItem) {
  const anchor = document.createElement("a")
  const extension = mediaExtension(item)

  anchor.href = item.src
  anchor.download = `${item.kind}-${safeFileName(item.label)}.${extension}`
  anchor.rel = "noreferrer"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function localRecordStorageKey(
  projectId: string,
  kind: ModelverseGenerationKind
) {
  return `${LOCAL_RECORD_STORAGE_PREFIX}:${projectId}:${kind}`
}

function isGenerationRecord(value: unknown): value is GenerationRecord {
  if (!value || typeof value !== "object") {
    return false
  }

  const record = value as Partial<GenerationRecord>

  return (
    typeof record.id === "string" &&
    typeof record.createdAt === "number" &&
    typeof record.modelId === "string" &&
    typeof record.modelName === "string" &&
    typeof record.modelDisplayName === "string" &&
    typeof record.operationLabel === "string" &&
    Array.isArray(record.mediaItems) &&
    typeof record.taskId === "string" &&
    typeof record.taskStatus === "string" &&
    record.result !== null &&
    typeof record.result === "object"
  )
}

function readLocalGenerationRecords(storageKey: string) {
  try {
    const rawValue = window.localStorage.getItem(storageKey)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue) as unknown

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue
      .filter(isGenerationRecord)
      .slice(0, MAX_LOCAL_RECORDS)
  } catch {
    return []
  }
}

function writeLocalGenerationRecords(
  storageKey: string,
  records: GenerationRecord[]
) {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(records.slice(0, MAX_LOCAL_RECORDS))
    )
  } catch {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(records.slice(0, Math.min(5, records.length)))
      )
    } catch {
      // Local history is helpful, but generation should never fail because of it.
    }
  }
}

function mergeLocalGenerationRecord(
  records: GenerationRecord[],
  nextRecord: GenerationRecord
) {
  const remainingRecords = records.filter((record) => {
    if (nextRecord.taskId && record.taskId) {
      return record.taskId !== nextRecord.taskId
    }

    return record.id !== nextRecord.id
  })

  return [nextRecord, ...remainingRecords].slice(0, MAX_LOCAL_RECORDS)
}

function createRecordId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function findStringByKeys(value: JsonValue | undefined, keys: Set<string>) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const matchedValue = findStringByKeys(item, keys)

      if (matchedValue) {
        return matchedValue
      }
    }

    return undefined
  }

  if (!isJsonObject(value)) {
    return undefined
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (keys.has(key.toLowerCase()) && typeof childValue === "string") {
      return childValue
    }

    const matchedValue = findStringByKeys(childValue, keys)

    if (matchedValue) {
      return matchedValue
    }
  }

  return undefined
}

function findTaskId(value: JsonValue | undefined) {
  return findStringByKeys(value, new Set(["task_id", "taskid"]))
}

function findTaskStatus(value: JsonValue | undefined) {
  return findStringByKeys(
    value,
    new Set(["task_status", "taskstatus", "status", "state"])
  )
}

function isTerminalTaskStatus(status: string | undefined) {
  const normalized = status?.toLowerCase()

  return (
    normalized === "success" ||
    normalized === "succeeded" ||
    normalized === "completed" ||
    normalized === "failure" ||
    normalized === "failed" ||
    normalized === "error"
  )
}

function findStatusOperation(spec: ModelverseMatchedSpec) {
  return (
    spec.operations.find(
      (operation) =>
        operation.path.toLowerCase().includes("status") ||
        operation.summary.toLowerCase().includes("status") ||
        operation.id.toLowerCase().includes("status")
    ) ?? null
  )
}

function requestFromOperation({
  spec,
  operation,
  body,
}: {
  spec: ModelverseMatchedSpec
  operation: ModelverseOpenApiOperation
  body: JsonValue
}) {
  return {
    method: operation.method,
    serverUrl: spec.serverUrl,
    path: operation.path,
    contentType: operation.contentType,
    body,
  }
}

function ModelAvatar({
  model,
  kind,
}: {
  model?: ModelverseGenerationModel
  kind: ModelverseGenerationKind
}) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 text-muted-foreground">
      {model?.icon ? (
        // External model icons come from the model square API.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={model.icon}
          alt=""
          className="size-full object-contain p-1"
          loading="lazy"
        />
      ) : (
        modelIcon(kind)
      )}
    </span>
  )
}

function JsonParameterEditor({
  value,
  onChange,
  t,
  locale,
  depth = 0,
  label,
  fieldKey,
}: {
  value: JsonValue
  onChange: (value: JsonValue) => void
  t: ReturnType<typeof useI18n>["t"]
  locale: string
  depth?: number
  label?: string
  fieldKey?: string
}) {
  if (isJsonObject(value)) {
    const entries = Object.entries(value)

    return (
      <div
        className={cn(
          "grid gap-3",
          depth > 0 && "rounded-lg border bg-muted/20 p-3"
        )}
      >
        {label ? (
          <div className="text-sm font-medium">{label}</div>
        ) : null}
        {entries.length > 0 ? (
          entries.map(([key, childValue]) => (
            <JsonParameterEditor
              key={key}
              value={childValue}
              t={t}
              locale={locale}
              depth={depth + 1}
              label={formatFieldName(key, locale)}
              fieldKey={key}
              onChange={(nextValue) =>
                onChange({
                  ...value,
                  [key]: nextValue,
                })
              }
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            {"{}"}
          </div>
        )}
      </div>
    )
  }

  if (Array.isArray(value)) {
    return (
      <Field>
        {label ? <FieldLabel>{label}</FieldLabel> : null}
        <div className="grid gap-2">
          {value.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.item} {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t.removeItem}
                  onClick={() =>
                    onChange(value.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
              <JsonParameterEditor
                value={item}
                t={t}
                locale={locale}
                depth={depth + 1}
                fieldKey={fieldKey}
                onChange={(nextValue) =>
                  onChange(
                    value.map((currentItem, itemIndex) =>
                      itemIndex === index ? nextValue : currentItem
                    )
                  )
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              onChange([
                ...value,
                value.length > 0 ? cloneJsonValue(value[value.length - 1]) : "",
              ])
            }
          >
            {t.addItem}
          </Button>
        </div>
      </Field>
    )
  }

  if (typeof value === "boolean") {
    const inputId = `json-field-${fieldKey ?? label ?? "boolean"}-${depth}`

    return (
      <Field orientation="horizontal">
        <Checkbox
          id={inputId}
          checked={value}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
        />
        {label ? <FieldLabel htmlFor={inputId}>{label}</FieldLabel> : null}
      </Field>
    )
  }

  if (typeof value === "number") {
    return (
      <Field>
        {label ? <FieldLabel>{label}</FieldLabel> : null}
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => {
            const nextValue = Number(event.target.value)

            onChange(Number.isFinite(nextValue) ? nextValue : 0)
          }}
        />
      </Field>
    )
  }

  const stringValue = value === null ? "" : String(value)
  const isLongText =
    stringValue.length > 72 ||
    LONG_TEXT_FIELD_PATTERN.test(fieldKey ?? label ?? "")
  const isModelField = fieldKey === "model"

  return (
    <Field>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {isLongText ? (
        <Textarea
          value={stringValue}
          readOnly={isModelField}
          className="min-h-24"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          value={stringValue}
          readOnly={isModelField}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {value === null ? (
        <FieldDescription>{t.nullValue}</FieldDescription>
      ) : null}
    </Field>
  )
}

function RequestPreview({
  requestJson,
  curlCommand,
  activeCopiedTarget,
  onCopy,
  t,
}: {
  requestJson: string
  curlCommand: string
  activeCopiedTarget: CopyTarget | null
  onCopy: (target: CopyTarget, value: string) => void
  t: ReturnType<typeof useI18n>["t"]
}) {
  return (
    <div className="grid min-h-0 gap-3">
      <div className="flex items-center justify-between gap-2">
        <FieldTitle>{t.requestPreview}</FieldTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopy("request", requestJson)}
        >
          {activeCopiedTarget === "request" ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
          {activeCopiedTarget === "request" ? t.copied : t.copyRequest}
        </Button>
      </div>
      <pre className="max-h-72 min-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs leading-5">
        <code>{requestJson}</code>
      </pre>
      <div className="flex items-center justify-between gap-2">
        <FieldTitle>{t.curl}</FieldTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopy("curl", curlCommand)}
        >
          {activeCopiedTarget === "curl" ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
          {activeCopiedTarget === "curl" ? t.copied : t.copyCurl}
        </Button>
      </div>
      <pre className="max-h-72 min-h-36 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs leading-5">
        <code>{curlCommand}</code>
      </pre>
    </div>
  )
}

function ResultMediaGrid({
  items,
  t,
}: {
  items: MediaItem[]
  t: ReturnType<typeof useI18n>["t"]
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative overflow-hidden rounded-lg border bg-muted/20"
        >
          {item.kind === "image" || item.kind === "video" ? (
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="absolute top-2 right-2 z-10 bg-background/90 shadow-sm backdrop-blur"
              aria-label={`${t.download} ${item.label}`}
              onClick={() => downloadMediaItem(item)}
            >
              <DownloadIcon />
            </Button>
          ) : null}
          {item.kind === "image" ? (
            // Generated images can be base64 data URLs or temporary provider URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.src}
              alt=""
              className="aspect-square w-full object-contain"
            />
          ) : item.kind === "audio" ? (
            <div className="grid gap-3 p-3">
              <audio src={item.src} controls className="w-full" />
              <span className="truncate text-xs text-muted-foreground">
                {item.label}
              </span>
            </div>
          ) : (
            <video
              src={item.src}
              controls
              className="aspect-video w-full bg-black"
            />
          )}
        </div>
      ))}
    </div>
  )
}

function GenerationResult({
  result,
  mediaItems,
  isRunning,
  taskId,
  taskStatus,
  error,
  onCheckStatus,
  canCheckStatus,
  t,
}: {
  result: RunResponse | null
  mediaItems: MediaItem[]
  isRunning: boolean
  taskId: string
  taskStatus: string
  error: string
  onCheckStatus: () => void
  canCheckStatus: boolean
  t: ReturnType<typeof useI18n>["t"]
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>{t.generationFailed}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!result && !isRunning) {
    return (
      <div className="grid min-h-[28rem] place-items-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-muted-foreground">
        <div className="grid justify-items-center gap-3">
          <PlayIcon className="size-9" />
          <div className="text-sm">{t.readyToGenerate}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {isRunning ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
          <LoaderCircleIcon className="animate-spin" />
          <span>{taskId ? t.checkingTaskStatus : t.generating}</span>
        </div>
      ) : null}
      {taskId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
          <Badge variant="outline">{taskId}</Badge>
          {taskStatus ? <Badge variant="secondary">{taskStatus}</Badge> : null}
          {canCheckStatus ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCheckStatus}
              disabled={isRunning}
            >
              {isRunning ? (
                <LoaderCircleIcon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {t.checkStatus}
            </Button>
          ) : null}
        </div>
      ) : null}
      <ResultMediaGrid items={mediaItems} t={t} />
      {result ? (
        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs leading-5">
          <code>{formatJson(result.data ?? null)}</code>
        </pre>
      ) : null}
    </div>
  )
}

function LocalGenerationRecords({
  records,
  onRestore,
  locale,
  t,
}: {
  records: GenerationRecord[]
  onRestore: (record: GenerationRecord) => void
  locale: string
  t: ReturnType<typeof useI18n>["t"]
}) {
  if (records.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2 border-t pt-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <HistoryIcon className="size-4 text-muted-foreground" />
        {t.localRecords}
      </div>
      <div className="grid gap-2">
        {records.slice(0, LOCAL_RECORD_DISPLAY_LIMIT).map((record) => (
          <button
            key={record.id}
            type="button"
            className="grid w-full gap-1 rounded-lg border bg-muted/20 p-3 text-left transition hover:bg-muted/40"
            onClick={() => onRestore(record)}
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {record.modelDisplayName || record.modelName}
              </span>
              {record.mediaItems.length > 0 ? (
                <Badge variant="secondary">
                  {t.mediaCount(record.mediaItems.length)}
                </Badge>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{formatRecordTimestamp(record.createdAt, locale)}</span>
              <span className="truncate">{record.operationLabel}</span>
              {record.exampleLabel ? (
                <span className="truncate">{record.exampleLabel}</span>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function WorkbenchSkeleton() {
  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="grid h-fit gap-2 rounded-lg border bg-card p-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Card size="sm" className="rounded-lg">
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export function ModelverseGenerationPage({
  projectId,
  kind,
}: {
  projectId: string
  kind: ModelverseGenerationKind
}) {
  const { locale, t } = useI18n()
  const [options, setOptions] = useState<ModelverseGenerationOptions | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedModelId, setSelectedModelId] = useState("")
  const [selectedSpecId, setSelectedSpecId] = useState("")
  const [selectedOperationId, setSelectedOperationId] = useState("")
  const [selectedExampleId, setSelectedExampleId] = useState("")
  const [selectedApiKeyId, setSelectedApiKeyId] = useState("")
  const [activeTab, setActiveTab] = useState<PreviewTab>("parameters")
  const [draft, setDraft] = useState<JsonValue>({})
  const [jsonText, setJsonText] = useState("{}")
  const [jsonError, setJsonError] = useState("")
  const [showDocumentation, setShowDocumentation] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResponse | null>(null)
  const [runError, setRunError] = useState("")
  const [activeTaskId, setActiveTaskId] = useState("")
  const [activeTaskStatus, setActiveTaskStatus] = useState("")
  const [activeCopiedTarget, setActiveCopiedTarget] =
    useState<CopyTarget | null>(null)
  const [localRecords, setLocalRecords] = useState<GenerationRecord[]>([])

  const recordsStorageKey = useMemo(
    () => localRecordStorageKey(projectId, kind),
    [kind, projectId]
  )

  const resetDraftForSelection = useCallback(
    (
      model: ModelverseGenerationModel | undefined,
      example: { value: JsonValue } | undefined
    ) => {
      const nextDraft =
        model && example
          ? applyModelNameToDraft(example.value, model.name)
          : ({} as JsonValue)

      setDraft(nextDraft)
      setJsonText(formatJson(nextDraft))
      setJsonError("")
    },
    []
  )

  const loadOptions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        projectId,
        kind,
      })
      const response = await fetch(
        `/api/modelverse-generation/options?${params.toString()}`,
        {
          cache: "no-store",
        }
      )
      const result = (await response.json()) as ModelverseGenerationOptionsResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok || !result.data) {
        setError(result.message || t.requestFailed)
        return
      }

      const nextOptions = result.data
      const nextModel = nextOptions.models[0]
      const nextSpec = nextModel?.specs[0]
      const nextOperation = nextSpec?.operations[0]
      const nextExample = nextOperation?.examples[0]

      setOptions(nextOptions)
      setSelectedModelId(nextModel?.id ?? "")
      setSelectedSpecId(nextSpec?.id ?? "")
      setSelectedOperationId(nextOperation?.id ?? "")
      setSelectedExampleId(nextExample?.id ?? "")
      setSelectedApiKeyId(nextOptions.apiKeys[0]?.id ?? "")
      setRunResult(null)
      setRunError("")
      setActiveTaskId("")
      setActiveTaskStatus("")
      resetDraftForSelection(nextModel, nextExample)
    } catch {
      setError(t.requestFailed)
      setOptions(null)
    } finally {
      setIsLoading(false)
    }
  }, [kind, projectId, resetDraftForSelection, t.requestFailed])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOptions()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadOptions])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLocalRecords(readLocalGenerationRecords(recordsStorageKey))
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [recordsStorageKey])

  const keyword = searchQuery.trim().toLowerCase()
  const visibleModels = useMemo(
    () =>
      (options?.models ?? []).filter((model) =>
        modelMatchesSearch(model, keyword)
      ),
    [keyword, options?.models]
  )
  const selectedModel =
    visibleModels.find((model) => model.id === selectedModelId) ??
    options?.models.find((model) => model.id === selectedModelId) ??
    visibleModels[0] ??
    options?.models[0]
  const selectedSpec =
    selectedModel?.specs.find((spec) => spec.id === selectedSpecId) ??
    selectedModel?.specs[0]
  const selectedOperation =
    selectedSpec?.operations.find(
      (operation) => operation.id === selectedOperationId
    ) ?? selectedSpec?.operations[0]
  const selectedExample =
    selectedOperation?.examples.find(
      (example) => example.id === selectedExampleId
    ) ?? selectedOperation?.examples[0]

  const specItems = useMemo<SelectItemValue[]>(
    () =>
      selectedModel?.specs.map((spec) => ({
        value: spec.id,
        label: formatSpecLabel(spec, locale),
      })) ?? [],
    [locale, selectedModel?.specs]
  )
  const operationItems = useMemo<SelectItemValue[]>(
    () =>
      selectedSpec?.operations.map((operation) => ({
        value: operation.id,
        label: formatOperationLabel(operation, locale, kind),
      })) ?? [],
    [kind, locale, selectedSpec?.operations]
  )
  const exampleItems = useMemo<SelectItemValue[]>(
    () =>
      selectedOperation?.examples.map((example) => ({
        value: example.id,
        label: formatExampleLabel(example, locale),
      })) ?? [],
    [locale, selectedOperation?.examples]
  )
  const apiKeyItems = useMemo<SelectItemValue[]>(
    () =>
      options?.apiKeys.map((apiKey: ModelverseApiKeyOption) => ({
        value: apiKey.id,
        label: apiKey.name,
      })) ?? [],
    [options?.apiKeys]
  )
  const statusOperation = selectedSpec ? findStatusOperation(selectedSpec) : null
  const mediaItems = mediaItemsFromRunResult(runResult, kind)

  function rememberGenerationResult({
    result,
    body,
    taskId,
    taskStatus,
  }: {
    result: RunResponse
    body: JsonValue
    taskId: string
    taskStatus: string
  }) {
    if (!selectedModel || !selectedSpec || !selectedOperation) {
      return
    }

    const record: GenerationRecord = {
      id: createRecordId(),
      createdAt: Date.now(),
      kind,
      modelId: selectedModel.id,
      modelName: selectedModel.name,
      modelDisplayName: selectedModel.displayName,
      specId: selectedSpec.id,
      operationId: selectedOperation.id,
      exampleId: selectedExample?.id ?? "",
      operationLabel: formatOperationLabel(selectedOperation, locale, kind),
      exampleLabel: selectedExample ? formatExampleLabel(selectedExample, locale) : "",
      requestBody: cloneJsonValue(body),
      result,
      mediaItems: mediaItemsFromRunResult(result, kind),
      taskId,
      taskStatus,
    }
    const storedRecords = readLocalGenerationRecords(recordsStorageKey)
    const sourceRecords = storedRecords.length > 0 ? storedRecords : localRecords
    const nextRecords = mergeLocalGenerationRecord(sourceRecords, record)

    setLocalRecords(nextRecords)
    writeLocalGenerationRecords(recordsStorageKey, nextRecords)
  }

  function restoreLocalRecord(record: GenerationRecord) {
    setSelectedModelId(record.modelId)
    setSelectedSpecId(record.specId)
    setSelectedOperationId(record.operationId)
    setSelectedExampleId(record.exampleId)
    setDraft(record.requestBody)
    setJsonText(formatJson(record.requestBody))
    setJsonError("")
    setRunResult(record.result)
    setRunError("")
    setActiveTaskId(record.taskId)
    setActiveTaskStatus(record.taskStatus)
  }

  const requestUrl =
    selectedSpec && selectedOperation
      ? `${selectedSpec.serverUrl}${selectedOperation.path}`
      : ""
  const requestJson = selectedOperation
    ? formatJson({
        method: selectedOperation.method,
        url: requestUrl,
        contentType: selectedOperation.contentType,
        body: draft,
      })
    : "{}"
  const curlCommand =
    selectedOperation && requestUrl
      ? buildCurlCommand({
          method: selectedOperation.method,
          url: requestUrl,
          contentType: selectedOperation.contentType,
          body: draft,
        })
      : ""

  function updateDraft(nextDraft: JsonValue) {
    setDraft(nextDraft)
    setJsonText(formatJson(nextDraft))
    setJsonError("")
    setRunError("")
  }

  function applyJsonText() {
    try {
      const parsed = JSON.parse(jsonText) as JsonValue
      const nextDraft = selectedModel
        ? applyModelNameToDraft(parsed, selectedModel.name)
        : parsed

      setDraft(nextDraft)
      setJsonText(formatJson(nextDraft))
      setJsonError("")
    } catch {
      setJsonError(t.invalidJson)
    }
  }

  async function copyText(target: CopyTarget, value: string) {
    try {
      await window.navigator.clipboard.writeText(value)
      setActiveCopiedTarget(target)
      window.setTimeout(() => {
        setActiveCopiedTarget(null)
      }, 1800)
    } catch {
      setActiveCopiedTarget(null)
    }
  }

  function selectModel(model: ModelverseGenerationModel) {
    const nextSpec = model.specs[0]
    const nextOperation = nextSpec?.operations[0]
    const nextExample = nextOperation?.examples[0]

    setSelectedModelId(model.id)
    setSelectedSpecId(nextSpec?.id ?? "")
    setSelectedOperationId(nextOperation?.id ?? "")
    setSelectedExampleId(nextExample?.id ?? "")
    setRunResult(null)
    setRunError("")
    setActiveTaskId("")
    setActiveTaskStatus("")
    resetDraftForSelection(model, nextExample)
  }

  function selectSpec(specId: string) {
    const nextSpec = selectedModel?.specs.find((spec) => spec.id === specId)
    const nextOperation = nextSpec?.operations[0]
    const nextExample = nextOperation?.examples[0]

    setSelectedSpecId(nextSpec?.id ?? "")
    setSelectedOperationId(nextOperation?.id ?? "")
    setSelectedExampleId(nextExample?.id ?? "")
    setRunResult(null)
    setRunError("")
    setActiveTaskId("")
    setActiveTaskStatus("")
    resetDraftForSelection(selectedModel, nextExample)
  }

  function selectOperation(operationId: string) {
    const nextOperation = selectedSpec?.operations.find(
      (operation) => operation.id === operationId
    )
    const nextExample = nextOperation?.examples[0]

    setSelectedOperationId(nextOperation?.id ?? "")
    setSelectedExampleId(nextExample?.id ?? "")
    setRunResult(null)
    setRunError("")
    setActiveTaskId("")
    setActiveTaskStatus("")
    resetDraftForSelection(selectedModel, nextExample)
  }

  function selectExample(exampleId: string) {
    const nextExample = selectedOperation?.examples.find(
      (example) => example.id === exampleId
    )

    setSelectedExampleId(nextExample?.id ?? "")
    setRunResult(null)
    setRunError("")
    setActiveTaskId("")
    setActiveTaskStatus("")
    resetDraftForSelection(selectedModel, nextExample)
  }

  async function executeModelverseOperation({
    operation,
    body,
  }: {
    operation: ModelverseOpenApiOperation
    body: JsonValue
  }) {
    if (!selectedSpec) {
      throw new Error(t.matchedOpenApi)
    }

    const response = await fetch("/api/modelverse-generation/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        apiKeyId: selectedApiKeyId,
        request: requestFromOperation({
          spec: selectedSpec,
          operation,
          body,
        }),
      }),
    })
    const result = (await response.json()) as RunResponse

    if (response.status === 401) {
      window.location.href = "/login"
      throw new Error("Login is required.")
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.message || result.statusText || t.requestFailed)
    }

    return result
  }

  async function checkTaskStatus(taskId = activeTaskId) {
    if (!taskId || !statusOperation) {
      return
    }

    setIsRunning(true)
    setRunError("")

    try {
      const result = await executeModelverseOperation({
        operation: statusOperation,
        body: {
          task_id: taskId,
        },
      })
      const status = findTaskStatus(result.data)

      setRunResult(result)
      setActiveTaskStatus(status ?? "")
      rememberGenerationResult({
        result,
        body: draft,
        taskId,
        taskStatus: status ?? "",
      })
    } catch (error) {
      setRunError(error instanceof Error ? error.message : t.requestFailed)
    } finally {
      setIsRunning(false)
    }
  }

  async function generate() {
    if (!selectedOperation || !selectedApiKeyId) {
      setRunError(!selectedApiKeyId ? t.apiKeyRequired : t.requestFailed)
      return
    }

    setIsRunning(true)
    setRunError("")
    setRunResult(null)
    setActiveTaskId("")
    setActiveTaskStatus("")

    try {
      const result = await executeModelverseOperation({
        operation: selectedOperation,
        body: draft,
      })
      const taskId = findTaskId(result.data)
      const taskStatus = findTaskStatus(result.data)

      setRunResult(result)
      setActiveTaskId(taskId ?? "")
      setActiveTaskStatus(taskStatus ?? "")
      rememberGenerationResult({
        result,
        body: draft,
        taskId: taskId ?? "",
        taskStatus: taskStatus ?? "",
      })

      if (taskId && statusOperation && !isTerminalTaskStatus(taskStatus)) {
        window.setTimeout(() => {
          void checkTaskStatus(taskId)
        }, 2500)
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : t.requestFailed)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {options ? (
            <span className="text-sm text-muted-foreground">
              {t.modelsSummary(visibleModels.length, options.matchedModels)}
            </span>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => void loadOptions()}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCwIcon data-icon="inline-start" />
          )}
          {t.refresh}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>{t.requestFailed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <WorkbenchSkeleton />
      ) : options && selectedModel && selectedSpec && selectedOperation ? (
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
            <div className="min-h-0 overflow-y-auto p-3">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t.modelName}</FieldLabel>
                  <Select
                    items={visibleModels.map((model) => ({
                      value: model.id,
                      label: model.displayName,
                    }))}
                    value={selectedModel.id}
                    onValueChange={(value) => {
                      const nextModel = options.models.find(
                        (model) => model.id === value
                      )

                      if (nextModel) {
                        selectModel(nextModel)
                      }
                    }}
                  >
                    <SelectTrigger
                      aria-label={t.modelName}
                      className="w-full max-w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      className="w-max min-w-(--anchor-width) max-w-[min(42rem,calc(100vw-2rem))]"
                    >
                      <SelectGroup>
                        {visibleModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.displayName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="pl-8"
                      placeholder={t.searchModels}
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel>
                    <KeyRoundIcon />
                    {t.apiKey}
                  </FieldLabel>
                  <Select
                    items={apiKeyItems}
                    value={selectedApiKeyId}
                    onValueChange={setSelectedApiKeyId}
                  >
                    <SelectTrigger
                      aria-label={t.selectApiKey}
                      className="w-full max-w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      className="w-max min-w-(--anchor-width) max-w-[min(36rem,calc(100vw-2rem))]"
                    >
                      <SelectGroup>
                        {apiKeyItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t.matchedOpenApi}</FieldLabel>
                  <Select
                    items={specItems}
                    value={selectedSpec.id}
                    onValueChange={selectSpec}
                  >
                    <SelectTrigger
                      aria-label={t.matchedOpenApi}
                      className="w-full max-w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      className="w-max min-w-(--anchor-width) max-w-[min(44rem,calc(100vw-2rem))]"
                    >
                      <SelectGroup>
                        {specItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t.operation}</FieldLabel>
                  <Select
                    items={operationItems}
                    value={selectedOperation.id}
                    onValueChange={selectOperation}
                  >
                    <SelectTrigger
                      aria-label={t.operation}
                      className="w-full max-w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      className="w-max min-w-(--anchor-width) max-w-[min(44rem,calc(100vw-2rem))]"
                    >
                      <SelectGroup>
                        {operationItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {selectedExample ? (
                  <Field>
                    <FieldLabel>{t.example}</FieldLabel>
                    <Select
                      items={exampleItems}
                      value={selectedExample.id}
                      onValueChange={selectExample}
                    >
                      <SelectTrigger
                        aria-label={t.example}
                        className="w-full max-w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        className="w-max min-w-(--anchor-width) max-w-[min(44rem,calc(100vw-2rem))]"
                      >
                        <SelectGroup>
                          {exampleItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}

                <Tabs
                  value={activeTab}
                  onValueChange={(value) => setActiveTab(value as PreviewTab)}
                  className="gap-3"
                >
                  <TabsList>
                    <TabsTrigger value="parameters">
                      <Settings2Icon data-icon="inline-start" />
                      {t.parameters}
                    </TabsTrigger>
                    <TabsTrigger value="json">
                      <FileJsonIcon data-icon="inline-start" />
                      JSON
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="parameters">
                    <JsonParameterEditor
                      value={draft}
                      onChange={updateDraft}
                      t={t}
                      locale={locale}
                    />
                  </TabsContent>
                  <TabsContent value="json">
                    <FieldGroup>
                      <Field>
                        <FieldLabel>JSON</FieldLabel>
                        <Textarea
                          value={jsonText}
                          className="min-h-80 font-mono text-xs"
                          spellCheck={false}
                          onChange={(event) => {
                            setJsonText(event.target.value)
                            setJsonError("")
                          }}
                        />
                        {jsonError ? (
                          <FieldDescription className="text-destructive">
                            {jsonError}
                          </FieldDescription>
                        ) : null}
                      </Field>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit"
                        onClick={applyJsonText}
                      >
                        {t.applyJson}
                      </Button>
                    </FieldGroup>
                  </TabsContent>
                </Tabs>
              </FieldGroup>
            </div>
            <div className="border-t p-3">
              <Button
                type="button"
                className="w-full"
                onClick={() => void generate()}
                disabled={isRunning || !selectedApiKeyId}
              >
                {isRunning ? (
                  <LoaderCircleIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                {isRunning ? t.generating : t.generate}
              </Button>
            </div>
          </aside>

          <section className="min-h-0 min-w-0 overflow-y-auto pr-1">
            <div className="grid min-w-0 gap-4 pb-1">
              <Card size="sm" className="rounded-lg">
                <CardHeader className="gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="flex min-w-0 gap-3">
                    <ModelAvatar model={selectedModel} kind={kind} />
                    <div className="min-w-0">
                      <CardTitle className="whitespace-normal break-words text-lg font-bold group-data-[size=sm]/card:text-lg">
                        {selectedModel.displayName}
                      </CardTitle>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="break-all">{selectedModel.name}</span>
                        {selectedModel.vendor ? (
                          <span className="truncate">{selectedModel.vendor}</span>
                        ) : null}
                        {formatTimestamp(selectedModel.updatedAt, locale) ? (
                          <span>
                            {formatTimestamp(selectedModel.updatedAt, locale)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setShowDocumentation((isVisible) => !isVisible)
                      }
                    >
                      <FileTextIcon data-icon="inline-start" />
                      {showDocumentation ? t.hideOpenApiDoc : t.showOpenApiDoc}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <GenerationResult
                    result={runResult}
                    mediaItems={mediaItems}
                    isRunning={isRunning}
                    taskId={activeTaskId}
                    taskStatus={activeTaskStatus}
                    error={runError}
                    onCheckStatus={() => void checkTaskStatus()}
                    canCheckStatus={Boolean(activeTaskId && statusOperation)}
                    t={t}
                  />
                  <LocalGenerationRecords
                    records={localRecords}
                    onRestore={restoreLocalRecord}
                    locale={locale}
                    t={t}
                  />
                </CardContent>
              </Card>

              {showDocumentation ? (
                <Card size="sm" className="rounded-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TerminalIcon />
                      {t.openApiDocument}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RequestPreview
                      requestJson={requestJson}
                      curlCommand={curlCommand}
                      activeCopiedTarget={activeCopiedTarget}
                      onCopy={(target, value) => void copyText(target, value)}
                      t={t}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <Card size="sm" className="rounded-lg">
          <CardContent className="py-8 text-center text-muted-foreground">
            {options?.models.length ? t.noGenerationResults : t.noGenerationModels}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
