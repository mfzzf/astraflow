"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BoxesIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  FlameIcon,
  ImageIcon,
  InfoIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type OutputTypeFilter = "all" | "text" | "image" | "video"
type ContextLengthFilter = "all" | "4k" | "64k" | "1m"
type SortOption = "newest" | "nameAsc" | "nameDesc"

type SquareModelPricing = {
  Prompt?: number
  Completion?: number
  Image?: number
  Video?: number | string
  Currency?: string
  Unit?: string
  UnitEn?: string
}

type SquareModelPriceRate = {
  ChargeItem?: string
  ChargeItemDescription?: string
  ChargeItemDescriptionEn?: string
  Currency?: string
  Unit?: string
  UnitEn?: string
  Price?: string
}

type SquareModelPriceTier = {
  Rates?: SquareModelPriceRate[]
  Description?: string
  DescriptionEn?: string
  Condition?: string
}

type SquareModel = {
  Id?: string
  Name?: string
  ChineseName?: string
  Manufacturer?: string
  SimpleDescribe?: string
  Describe?: string
  Language?: string[] | null
  MaxModelLen?: number
  MaxInputTokens?: number
  MaxOutputTokens?: number
  ModelType?: string
  ModalTypes?: string[] | null
  HfUpdateTime?: number
  CreateAt?: number
  UpdateAt?: number
  SupportedCapabilities?: string[] | null
  InputModalities?: string[] | null
  OutputModalities?: string[] | null
  Icon?: string
  CoverUrl?: string
  Pricing?: SquareModelPricing | null
  Tiers?: SquareModelPriceTier[] | null
}

type VendorFacet = {
  name: string
  icon?: string
  count: number
}

type ModelSquareResponse = {
  ok: boolean
  message?: string
  data?: SquareModel[]
  totalCount?: number
  vendors?: VendorFacet[]
}

type PriceRate = {
  ChargeItem?: string
  ChargeItemDescription?: string
  ChargeItemDescriptionEn?: string
  Currency?: string
  Unit?: string
  UnitEn?: string
  Price?: string | number
  PricingSku?: string
  PricingSkuId?: string | number
}

type PriceTier = {
  Rates?: PriceRate[]
  Description?: string
  DescriptionEn?: string
  Condition?: string
}

type ModelPriceGroup = {
  Manufacturer?: string
  ModelName?: string
  ModelId?: string
  Tiers?: PriceTier[]
}

type ModelPriceResponse = {
  ok: boolean
  message?: string
  data?: ModelPriceGroup[]
  totalCount?: number
}

type CachedModelPrice = {
  expiresAt: number
  data: ModelPriceGroup | null
}

type PriceDisplayRate = {
  key: string
  label: string
  value: string
  amount?: number
}

type PriceDisplaySection = {
  key: string
  labels: string[]
  rates: PriceDisplayRate[]
}

type PriceSummarySection = {
  key: string
  labels: string[]
  rates: PriceDisplayRate[]
}

const VENDOR_PREVIEW_COUNT = 6
const PRICE_SUMMARY_TIER_COUNT = 2
const MODEL_PRICE_CACHE_PREFIX = "astraflow:model-price"
const MODEL_PRICE_CACHE_TTL = 60 * 60 * 1000
const CONTEXT_LENGTH_OPTIONS: Array<{
  value: ContextLengthFilter
  label: string
  minValue: number
}> = [
  { value: "all", label: "", minValue: 0 },
  { value: "4k", label: "4K", minValue: 4_096 },
  { value: "64k", label: "64K", minValue: 65_536 },
  { value: "1m", label: "1M", minValue: 1_048_576 },
]

function sortToParams(sort: SortOption) {
  if (sort === "nameAsc") {
    return {
      orderBy: "Name",
      order: "Asc",
    }
  }

  if (sort === "nameDesc") {
    return {
      orderBy: "Name",
      order: "Desc",
    }
  }

  return {
    orderBy: "HfUpdateTime",
    order: "Desc",
  }
}

function formatTimestamp(
  timestamp: number | undefined,
  locale: string,
  fallback: string
) {
  if (!timestamp) {
    return fallback
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
  }).format(new Date(timestamp * 1000))
}

function formatContextLength(value: number | undefined, fallback: string) {
  if (!value || value <= 0) {
    return fallback
  }

  if (value >= 1_000_000) {
    return `${Number((value / 1_000_000).toFixed(1))}M`
  }

  if (value >= 1_000) {
    return `${Number((value / 1_000).toFixed(0))}K`
  }

  return String(value)
}

function getModelContextLength(model: SquareModel) {
  const values = [
    model.MaxModelLen,
    model.MaxInputTokens,
    model.MaxOutputTokens,
  ].filter(
    (value): value is number => typeof value === "number" && value > 0
  )

  return values.length > 0 ? Math.max(...values) : undefined
}

function normalizeModality(value: string | undefined) {
  return (value ?? "").trim().toLowerCase()
}

function isTextModality(value: string | undefined) {
  const normalized = normalizeModality(value)

  return normalized === "text" || normalized.includes("text")
}

function isVisualModality(value: string | undefined) {
  const normalized = normalizeModality(value)

  return normalized === "image" || normalized === "video"
}

function shouldShowContextLength(model: SquareModel) {
  const outputModalities = model.OutputModalities ?? []

  if (outputModalities.length > 0) {
    return outputModalities.some((item) => isTextModality(item))
  }

  return !isVisualModality(model.ModelType)
}

function getContextLengthFilterIndex(value: ContextLengthFilter) {
  return Math.max(
    0,
    CONTEXT_LENGTH_OPTIONS.findIndex((item) => item.value === value)
  )
}

function getContextLengthFilterValue(index: number): ContextLengthFilter {
  return CONTEXT_LENGTH_OPTIONS[index]?.value ?? "all"
}

function getContextLengthLabel(
  option: (typeof CONTEXT_LENGTH_OPTIONS)[number],
  t: ReturnType<typeof useI18n>["t"]
) {
  return option.value === "all" ? t.contextAny : option.label
}

function matchesContextLengthFilter(
  model: SquareModel,
  filter: ContextLengthFilter
) {
  const option = CONTEXT_LENGTH_OPTIONS.find((item) => item.value === filter)

  if (!option || option.value === "all") {
    return true
  }

  return (getModelContextLength(model) ?? 0) >= option.minValue
}

function formatModality(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function formatPrice(
  price: string | number | undefined,
  currency: string | undefined,
  unit: string | undefined,
  locale: string
) {
  if (price === undefined || price === null || price === "") {
    return ""
  }

  const value = typeof price === "number" ? String(price) : price
  const displayCurrency = locale === "zh" && currency === "CNY" ? "元" : currency
  const currencySuffix = displayCurrency ? ` ${displayCurrency}` : ""
  const unitSuffix = unit ? ` / ${unit}` : ""

  return `${value}${currencySuffix}${unitSuffix}`
}

function parsePriceAmount(price: string | number | undefined) {
  if (typeof price === "number") {
    return Number.isFinite(price) ? price : undefined
  }

  if (!price) {
    return undefined
  }

  const parsed = Number.parseFloat(price)

  return Number.isFinite(parsed) ? parsed : undefined
}

function getPriceRateLabel(rate: PriceRate, locale: string) {
  return locale === "zh"
    ? rate.ChargeItemDescription || rate.ChargeItemDescriptionEn
    : rate.ChargeItemDescriptionEn || rate.ChargeItemDescription
}

function formatBareConditionValue(value: string) {
  const normalized = value.trim()

  if (/^\d+p$/i.test(normalized) || normalized.toLowerCase() === "4k") {
    return normalized.toUpperCase()
  }

  return formatModality(normalized)
}

function formatConditionPart(part: string, locale: string) {
  const [rawKey, rawValue] = part.split("=")
  const key = rawKey?.trim()
  const value = rawValue?.trim()

  if (!key || !value) {
    return formatBareConditionValue(part)
  }

  const isZh = locale === "zh"
  const normalizedValue = value.toLowerCase()

  if (key === "video_input") {
    if (normalizedValue === "no_video") {
      return isZh ? "无视频输入" : "No video input"
    }

    if (normalizedValue === "with_video") {
      return isZh ? "含视频输入" : "With video input"
    }
  }

  if (key === "reference") {
    if (normalizedValue === "noref") {
      return isZh ? "无参考" : "No reference"
    }

    if (normalizedValue === "ref") {
      return isZh ? "有参考" : "With reference"
    }
  }

  if (key === "sound" || key === "generate_audio") {
    if (normalizedValue === "offsound" || normalizedValue === "false") {
      return isZh ? "无音频" : "No audio"
    }

    if (normalizedValue === "onsound" || normalizedValue === "true") {
      return isZh ? "含音频" : "With audio"
    }
  }

  if (key === "voice_list") {
    if (normalizedValue === "withoutvoice") {
      return isZh ? "未指定音色" : "No voice preset"
    }

    if (normalizedValue === "withvoice") {
      return isZh ? "指定音色" : "Voice preset"
    }
  }

  if (key === "duration") {
    return `${value}s`
  }

  if (key === "mode") {
    return formatBareConditionValue(value)
  }

  if (key === "service_tier") {
    if (normalizedValue === "flex") {
      return isZh ? "Flex 档" : "Flex tier"
    }

    return isZh ? "默认档" : "Default tier"
  }

  if (key === "variant") {
    const variantLabels: Record<string, string> = {
      i2v: isZh ? "图生视频" : "Image to video",
      t2v: isZh ? "文生视频" : "Text to video",
      mc: isZh ? "运动控制" : "Motion control",
    }

    return variantLabels[normalizedValue] ?? formatBareConditionValue(value)
  }

  if (key === "video") {
    if (normalizedValue === "withvideo") {
      return isZh ? "含参考视频" : "With reference video"
    }

    return isZh ? "无参考视频" : "No reference video"
  }

  return `${formatModality(key)} ${formatBareConditionValue(value)}`
}

function getPriceTierLabels(tier: PriceTier, locale: string) {
  const label =
    locale === "zh"
      ? tier.Description || tier.Condition || tier.DescriptionEn
      : tier.DescriptionEn || tier.Condition || tier.Description

  if (!label || label.toLowerCase() === "default" || label === "默认") {
    return []
  }

  return label
    .split(/\s+and\s+|\s*且\s*/)
    .map((part) => formatConditionPart(part, locale))
    .filter(Boolean)
}

function getPrimaryRate(section: PriceDisplaySection) {
  const positiveRates = section.rates.filter((rate) => (rate.amount ?? 0) > 0)

  return positiveRates[0] ?? section.rates[0]
}

function getInlinePriceSections(
  priceSections: PriceDisplaySection[]
): PriceSummarySection[] {
  if (priceSections.length === 1) {
    return priceSections
  }

  return priceSections.slice(0, PRICE_SUMMARY_TIER_COUNT).map((section) => {
    const primaryRate = getPrimaryRate(section)

    return {
      ...section,
      rates: primaryRate ? [primaryRate] : [],
    }
  })
}

function getPriceSections(
  priceGroup: ModelPriceGroup | null,
  locale: string
): PriceDisplaySection[] {
  return (
    priceGroup?.Tiers?.map((tier, tierIndex) => {
      const rates =
        tier.Rates?.map((rate, rateIndex) => {
          const label = getPriceRateLabel(rate, locale)
          const value = formatPrice(
            rate.Price,
            rate.Currency,
            locale === "zh" ? rate.Unit : rate.UnitEn || rate.Unit,
            locale
          )
          const amount = parsePriceAmount(rate.Price)

          return {
            key: [
              tier.Condition,
              rate.PricingSku,
              rate.PricingSkuId,
              rate.ChargeItem,
              rateIndex,
            ]
              .filter(Boolean)
              .join(":"),
            label: label ?? "",
            value,
            amount,
          }
        }).filter((rate) => rate.label && rate.value) ?? []

      return {
        key: [tier.Condition, tier.Description, tier.DescriptionEn, tierIndex]
          .filter(Boolean)
          .join(":"),
        labels: getPriceTierLabels(tier, locale),
        rates,
      }
    }).filter((section) => section.rates.length > 0) ?? []
  )
}

function normalizeModelName(value: string | undefined) {
  return (value ?? "").trim().toLowerCase()
}

function getPriceCacheKey(projectId: string, modelName: string) {
  return `${MODEL_PRICE_CACHE_PREFIX}:${projectId}:${modelName}`
}

function readCachedModelPrice(cacheKey: string) {
  try {
    const rawCache = window.localStorage.getItem(cacheKey)

    if (!rawCache) {
      return undefined
    }

    const parsed = JSON.parse(rawCache) as Partial<CachedModelPrice>

    if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(cacheKey)
      return undefined
    }

    return parsed.data ?? null
  } catch {
    window.localStorage.removeItem(cacheKey)
    return undefined
  }
}

function writeCachedModelPrice(cacheKey: string, data: ModelPriceGroup | null) {
  const cache: CachedModelPrice = {
    expiresAt: Date.now() + MODEL_PRICE_CACHE_TTL,
    data,
  }

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(cache))
  } catch {
    // Ignore storage quota and privacy mode failures; pricing still renders.
  }
}

function findMatchingPriceGroup(
  model: SquareModel,
  priceGroups: ModelPriceGroup[]
) {
  const modelName = normalizeModelName(model.Name)
  const modelId = normalizeModelName(model.Id)

  return (
    priceGroups.find((priceGroup) => {
      const priceModelName = normalizeModelName(priceGroup.ModelName)
      const priceModelId = normalizeModelName(priceGroup.ModelId)

      return (
        priceModelName === modelName ||
        priceModelId === modelName ||
        priceModelId === modelId
      )
    }) ??
    priceGroups[0] ??
    null
  )
}

function getModelDescription(model: SquareModel, fallback: string) {
  return model.SimpleDescribe || model.Describe || fallback
}

function getModelTitle(model: SquareModel) {
  return model.ChineseName || model.Name || "Model"
}

function hasHotTag(model: SquareModel) {
  return (model.SupportedCapabilities ?? []).some(
    (tag) => tag.toLowerCase() === "hot"
  )
}

function ModelTypeIcon({ type }: { type?: string }) {
  if (type === "Image") {
    return <ImageIcon />
  }

  if (type === "Video") {
    return <VideoIcon />
  }

  if (type === "Text") {
    return <FileTextIcon />
  }

  return <BoxesIcon />
}

function VendorIcon({ vendor }: { vendor?: VendorFacet }) {
  const initials = vendor?.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {vendor?.icon ? (
        // External vendor icons are provided by the model-square API.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vendor.icon}
          alt=""
          className="size-full object-contain p-1"
          loading="lazy"
        />
      ) : initials ? (
        initials
      ) : (
        <BoxesIcon />
      )}
    </span>
  )
}

function ModelIcon({ model }: { model: SquareModel }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 text-muted-foreground">
      {model.Icon ? (
        // External model icons are provider-hosted and not known at build time.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={model.Icon}
          alt=""
          className="size-full object-contain p-1"
          loading="lazy"
        />
      ) : (
        <ModelTypeIcon type={model.ModelType} />
      )}
    </div>
  )
}

function ModelCopyButton({
  value,
  t,
}: {
  value?: string
  t: ReturnType<typeof useI18n>["t"]
}) {
  const [isCopied, setIsCopied] = useState(false)

  if (!value) {
    return null
  }

  async function copyModelName() {
    try {
      await window.navigator.clipboard.writeText(value)
      setIsCopied(true)
      window.setTimeout(() => {
        setIsCopied(false)
      }, 1800)
    } catch {
      setIsCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={isCopied ? "xs" : "icon-xs"}
      aria-label={isCopied ? t.copied : t.copyModelId}
      onClick={() => void copyModelName()}
    >
      {isCopied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      {isCopied ? t.copied : null}
    </Button>
  )
}

function ModelPriceSummary({
  model,
  projectId,
  locale,
  t,
}: {
  model: SquareModel
  projectId: string
  locale: string
  t: ReturnType<typeof useI18n>["t"]
}) {
  const [priceGroup, setPriceGroup] = useState<ModelPriceGroup | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const modelName = model.Name ?? ""

  useEffect(() => {
    if (!modelName) {
      return
    }

    const cacheKey = getPriceCacheKey(projectId, modelName)
    const cachedPrice = readCachedModelPrice(cacheKey)

    if (cachedPrice !== undefined) {
      const timeout = window.setTimeout(() => {
        setPriceGroup(cachedPrice)
        setIsLoading(false)
      }, 0)

      return () => window.clearTimeout(timeout)
    }

    let isCancelled = false

    async function loadPrice() {
      setIsLoading(true)

      try {
        const params = new URLSearchParams({
          projectId,
          keyword: modelName,
        })
        const response = await fetch(
          `/api/model-square/prices?${params.toString()}`,
          {
            cache: "no-store",
          }
        )
        const result = (await response.json()) as ModelPriceResponse

        if (response.status === 401) {
          window.location.href = "/login"
          return
        }

        const nextPriceGroup =
          response.ok && result.ok && Array.isArray(result.data)
            ? findMatchingPriceGroup(model, result.data)
            : null

        if (!isCancelled) {
          setPriceGroup(nextPriceGroup)
          writeCachedModelPrice(cacheKey, nextPriceGroup)
        }
      } catch {
        if (!isCancelled) {
          setPriceGroup(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPrice()

    return () => {
      isCancelled = true
    }
  }, [model, modelName, projectId])

  const effectivePriceGroup = modelName ? priceGroup : null
  const priceSections = getPriceSections(effectivePriceGroup, locale)
  const inlinePriceSections = getInlinePriceSections(priceSections)
  const isTieredPricing = priceSections.length > 1

  if (isLoading) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{t.pricing}</span>
        <Skeleton className="h-5 w-40" />
      </div>
    )
  }

  return (
    <div className="mt-4 flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{t.pricing}</span>
      {priceSections.length > 0 ? (
        <div className="flex min-w-0 max-w-full items-center gap-1">
          <div className="flex min-w-0 items-center gap-x-4 overflow-hidden whitespace-nowrap">
            {inlinePriceSections.length > 0 ? (
              inlinePriceSections.map((section) =>
                section.rates.map((rate) => (
                  <span key={rate.key} className="shrink-0 font-medium">
                    {isTieredPricing && section.labels.length > 0 ? (
                      <span className="text-muted-foreground">
                        {section.labels.join(" ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {rate.label}
                      </span>
                    )}{" "}
                    {rate.value}
                  </span>
                ))
              )
            ) : (
              <span className="text-muted-foreground">
                {t.pricingUnavailable}
              </span>
            )}
          </div>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t.viewPricingDetails}
                  className="shrink-0"
                />
              }
            >
              <InfoIcon />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              className="max-h-[28rem] w-[40rem] max-w-[calc(100vw-2rem)] overflow-auto p-3"
            >
              <PopoverHeader className="sr-only">
                <PopoverTitle>{t.pricingDetails}</PopoverTitle>
              </PopoverHeader>
              <div className="grid gap-2 text-sm">
                {priceSections.map((section) => (
                  <div
                    key={section.key}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b pb-2 last:border-b-0 last:pb-0"
                  >
                    {section.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {section.labels.map((label) => (
                          <Badge
                            key={label}
                            variant="outline"
                            className="h-6 px-2"
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {section.rates.map((rate) => (
                      <span
                        key={rate.key}
                        className="inline-flex items-baseline gap-1.5 whitespace-nowrap"
                      >
                        <span className="text-muted-foreground">
                          {rate.label}
                        </span>
                        <span className="font-medium">{rate.value}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <span className="text-muted-foreground">
          {t.pricingUnavailable}
        </span>
      )}
    </div>
  )
}

function ModelCard({
  model,
  projectId,
  locale,
  t,
}: {
  model: SquareModel
  projectId: string
  locale: string
  t: ReturnType<typeof useI18n>["t"]
}) {
  const isHot = hasHotTag(model)
  const showContextLength = shouldShowContextLength(model)

  return (
    <Card
      size="sm"
      data-hot={isHot}
      className="shrink-0 rounded-lg"
    >
      <CardHeader className="gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="flex min-w-0 gap-3">
          <ModelIcon model={model} />
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {getModelTitle(model)}
            </CardTitle>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">{model.Manufacturer}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 sm:justify-end">
          <ModelCopyButton value={model.Name} t={t} />
          {isHot ? (
            <Badge variant="destructive">
              <FlameIcon data-icon="inline-start" />
              {t.hot}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {getModelDescription(model, t.noModelDescription)}
          </p>
          <div
            className={cn(
              "mt-4 grid gap-3 text-sm",
              showContextLength
                ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_9rem]"
                : "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]"
            )}
          >
            <div>
              <div className="text-xs text-muted-foreground">{t.input}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(model.InputModalities ?? []).length > 0 ? (
                  model.InputModalities?.map((item) => (
                    <Badge key={item} variant="secondary">
                      {formatModality(item)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">{t.none}</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t.output}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(model.OutputModalities ?? []).length > 0 ? (
                  model.OutputModalities?.map((item) => (
                    <Badge key={item} variant="outline">
                      {formatModality(item)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">{t.none}</span>
                )}
              </div>
            </div>
            {showContextLength ? (
              <div>
                <div className="text-xs text-muted-foreground">
                  {t.contextLength}
                </div>
                <div className="mt-1 font-medium">
                  {formatContextLength(getModelContextLength(model), t.none)}
                </div>
              </div>
            ) : null}
            <div>
              <div className="text-xs text-muted-foreground">{t.updated}</div>
              <div className="mt-1 font-medium">
                {formatTimestamp(
                  model.HfUpdateTime || model.UpdateAt,
                  locale,
                  t.none
                )}
              </div>
            </div>
          </div>
          <ModelPriceSummary
            model={model}
            projectId={projectId}
            locale={locale}
            t={t}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ModelSkeleton() {
  return (
    <Card size="sm" className="shrink-0 rounded-lg">
      <CardHeader className="gap-3">
        <div className="flex gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </CardContent>
    </Card>
  )
}

export function ModelSquarePage({ projectId }: { projectId: string }) {
  const { locale, t } = useI18n()
  const [models, setModels] = useState<SquareModel[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [keyword, setKeyword] = useState("")
  const [outputType, setOutputType] = useState<OutputTypeFilter>("all")
  const [contextLengthFilter, setContextLengthFilter] =
    useState<ContextLengthFilter>("all")
  const [vendor, setVendor] = useState("all")
  const [vendors, setVendors] = useState<VendorFacet[]>([])
  const [isVendorExpanded, setIsVendorExpanded] = useState(false)
  const [sortOption, setSortOption] = useState<SortOption>("newest")

  const typeItems = useMemo(
    () => [
      { value: "all" as const, label: t.allTypes },
      { value: "text" as const, label: t.textModels },
      { value: "image" as const, label: t.imageModels },
      { value: "video" as const, label: t.videoModels },
    ],
    [t.allTypes, t.imageModels, t.textModels, t.videoModels]
  )
  const sortItems = useMemo(
    () => [
      { value: "newest", label: t.newest },
      { value: "nameAsc", label: t.nameAsc },
      { value: "nameDesc", label: t.nameDesc },
    ],
    [t.nameAsc, t.nameDesc, t.newest]
  )
  const visibleVendors = useMemo(
    () =>
      isVendorExpanded ? vendors : vendors.slice(0, VENDOR_PREVIEW_COUNT),
    [isVendorExpanded, vendors]
  )
  const contextLengthIndex = getContextLengthFilterIndex(contextLengthFilter)
  const displayedModels = useMemo(
    () =>
      models.filter((model) =>
        matchesContextLengthFilter(model, contextLengthFilter)
      ),
    [contextLengthFilter, models]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setKeyword(searchQuery.trim())
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  const loadModels = useCallback(
    async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { orderBy, order } = sortToParams(sortOption)
        const params = new URLSearchParams({
          projectId,
          offset: "0",
          limit: "all",
          orderBy,
          order,
        })

        if (keyword) {
          params.set("keyword", keyword)
        }

        if (outputType !== "all") {
          params.set("outputType", outputType)
        }

        if (vendor !== "all") {
          params.set("vendor", vendor)
        }

        if (contextLengthFilter !== "all") {
          params.set("contextLength", contextLengthFilter)
        }

        const response = await fetch(`/api/model-square?${params.toString()}`, {
          cache: "no-store",
        })
        const result = (await response.json()) as ModelSquareResponse

        if (response.status === 401) {
          window.location.href = "/login"
          return
        }

        if (!response.ok || !result.ok || !Array.isArray(result.data)) {
          setError(result.message || t.requestFailed)
          return
        }

        setModels(result.data ?? [])
        setTotalCount(result.totalCount ?? result.data.length)
        setVendors(result.vendors ?? [])
      } catch {
        setError(t.requestFailed)
      } finally {
        setIsLoading(false)
      }
    },
    [
      contextLengthFilter,
      keyword,
      outputType,
      projectId,
      sortOption,
      t.requestFailed,
      vendor,
    ]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadModels()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadModels])

  function setContextLengthByIndex(index: number) {
    setContextLengthFilter(getContextLengthFilterValue(index))
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-[320px]">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-8"
              placeholder={t.searchModels}
            />
          </div>
          <Select
            items={sortItems}
            value={sortOption}
            onValueChange={(value) => {
              if (
                value === "newest" ||
                value === "nameAsc" ||
                value === "nameDesc"
              ) {
                setSortOption(value)
              }
            }}
          >
            <SelectTrigger aria-label={t.sortModels} className="w-[13ch]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                {sortItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t.modelsSummary(displayedModels.length, totalCount)}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadModels()}
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
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit max-h-full overflow-auto rounded-lg border bg-card p-3">
          <div className="mb-3 text-sm font-medium">{t.modelTypes}</div>
          <ToggleGroup
            className="w-full items-stretch"
            value={[outputType]}
            onValueChange={(value) => {
              setOutputType((value[0] as OutputTypeFilter | undefined) ?? "all")
              setVendor("all")
              setIsVendorExpanded(false)
            }}
            orientation="vertical"
            spacing={1}
          >
            {typeItems.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                className="justify-start"
              >
                {item.value === "text" ? <FileTextIcon /> : null}
                {item.value === "image" ? <ImageIcon /> : null}
                {item.value === "video" ? <VideoIcon /> : null}
                {item.value === "all" ? <BoxesIcon /> : null}
                <span>{item.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="mt-5">
            <div className="mb-3 text-sm font-medium">
              {t.contextLength}
            </div>
            <div className="px-2">
              <Slider
                min={0}
                max={CONTEXT_LENGTH_OPTIONS.length - 1}
                step={1}
                value={contextLengthIndex}
                aria-label={t.contextLength}
                onValueChange={(value) => {
                  setContextLengthByIndex(value as number)
                }}
              />
              <div className="relative mt-2 h-5 text-xs text-muted-foreground">
                {CONTEXT_LENGTH_OPTIONS.map((option, index) => {
                  const isFirst = index === 0
                  const isLast = index === CONTEXT_LENGTH_OPTIONS.length - 1
                  const isActive = option.value === contextLengthFilter
                  const left =
                    (index / (CONTEXT_LENGTH_OPTIONS.length - 1)) * 100

                  return (
                    <button
                      type="button"
                      key={option.value}
                      className={cn(
                        "absolute top-0 -mx-2 rounded px-2 py-0.5 whitespace-nowrap hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                        isFirst
                          ? "translate-x-0"
                          : isLast
                            ? "-translate-x-full"
                            : "-translate-x-1/2",
                        isActive && "font-medium text-foreground"
                      )}
                      style={{ left: `${left}%` }}
                      onClick={() => setContextLengthByIndex(index)}
                      aria-pressed={isActive}
                    >
                      {getContextLengthLabel(option, t)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 text-sm font-medium">{t.vendors}</div>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant={vendor === "all" ? "secondary" : "ghost"}
                className="h-9 justify-start gap-2 px-2 font-normal"
                aria-pressed={vendor === "all"}
                onClick={() => setVendor("all")}
              >
                <VendorIcon />
                <span className="truncate">{t.allVendors}</span>
              </Button>
              {visibleVendors.map((vendorOption) => (
                <Button
                  key={vendorOption.name}
                  type="button"
                  variant={
                    vendor === vendorOption.name ? "secondary" : "ghost"
                  }
                  className="h-9 justify-start gap-2 px-2 font-normal"
                  aria-pressed={vendor === vendorOption.name}
                  onClick={() => setVendor(vendorOption.name)}
                >
                  <VendorIcon vendor={vendorOption} />
                  <span className="truncate">{vendorOption.name}</span>
                </Button>
              ))}
            </div>
            {vendors.length > VENDOR_PREVIEW_COUNT ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 justify-start px-2"
                onClick={() =>
                  setIsVendorExpanded((currentValue) => !currentValue)
                }
              >
                {isVendorExpanded ? t.showLess : t.showMore}
              </Button>
            ) : null}
          </div>
        </aside>

        <section className="min-h-0 min-w-0 overflow-y-auto pr-1">
          <div className="flex min-w-0 flex-col gap-3 pb-1">
            {error ? (
              <Alert variant="destructive" className="shrink-0">
                <AlertTitle>{t.requestFailed}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {isLoading ? (
              <>
                <ModelSkeleton />
                <ModelSkeleton />
                <ModelSkeleton />
              </>
            ) : displayedModels.length > 0 ? (
              <>
                {displayedModels.map((model) => (
                  <ModelCard
                    key={model.Id || model.Name}
                    model={model}
                    projectId={projectId}
                    locale={locale}
                    t={t}
                  />
                ))}
              </>
            ) : (
              <Card size="sm" className="shrink-0 rounded-lg">
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t.noModelsFound}
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
