"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DateRange as CalendarDateRange } from "react-day-picker"
import { enUS, zhCN } from "react-day-picker/locale"
import {
  CalendarRangeIcon,
  CheckCircle2Icon,
  CopyIcon,
  InfoIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type RequestLogSummary = {
  TotalRequests?: number
  FailedRequests?: number
}

type RequestLogItem = {
  RequestId?: string
  StartTime?: number
  StartTimeReadable?: string
  Region?: string
  ModelName?: string
  ApiKeyId?: string
  ApiKeyName?: string
  Latency?: number
  FirstTokenLatency?: number
  OutputTokenThroughput?: number
  HttpStatusCode?: number
  ErrorCode?: string
  IsSuccess?: boolean
  TotalTokens?: number
  PromptTokens?: number
  CompletionTokens?: number
  CacheHitTokens?: number
  CacheCreationTokens?: number
  CacheCreation5mTokens?: number
  CacheCreation1hTokens?: number
  HasInferenceLog?: boolean
}

type RequestLogsResponse = {
  ok: boolean
  message?: string
  data?: RequestLogItem[]
  summary?: RequestLogSummary
  totalCount?: number
}

type RequestLogRegion = {
  Region?: string
  Name?: string
  IsLocal?: boolean
}

type RequestLogRegionsResponse = {
  ok: boolean
  message?: string
  data?: RequestLogRegion[]
}

type APIKeyOption = {
  KeyId?: string
  Name?: string
}

type APIKeysResponse = {
  ok: boolean
  message?: string
  data?: APIKeyOption[]
}

const FALLBACK_REGION: RequestLogRegion = {
  Region: "cn-wlcb",
  Name: "cn-wlcb",
  IsLocal: true,
}

const PAGE_SIZE_ITEMS = [
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
]

function getDefaultDateRange(): CalendarDateRange {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 1)

  return {
    from: start,
    to: end,
  }
}

function dateToMs(value: Date | undefined, endOfDay = false) {
  const date = new Date(value ?? new Date())
  date.setHours(
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  )

  return date.getTime()
}

function localeTag(locale: string) {
  return locale === "zh" ? "zh-CN" : "en-US"
}

function formatCalendarDate(value: Date | undefined, locale: string) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value)
}

function datePickerLocale(locale: string) {
  return locale === "zh" ? zhCN : enUS
}

function formatInteger(value: number | undefined) {
  return new Intl.NumberFormat().format(value ?? 0)
}

function formatCompactNumber(value: number | undefined) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0)
}

function formatLatency(value: number | undefined) {
  return value === undefined || value === null ? "-" : `${value} ms`
}

function formatThroughput(value: number | undefined) {
  if (value === undefined || value === null) {
    return "-"
  }

  return `${value.toFixed(2)} t/s`
}

function formatCacheHitRatio(item: RequestLogItem, locale: "en" | "zh") {
  const promptTokens = item.PromptTokens ?? 0

  if (!promptTokens) {
    return "-"
  }

  return new Intl.NumberFormat(localeTag(locale), {
    style: "percent",
    maximumFractionDigits: 1,
  }).format((item.CacheHitTokens ?? 0) / promptTokens)
}

function formatTimestamp(
  item: RequestLogItem,
  locale: "en" | "zh"
) {
  if (item.StartTimeReadable) {
    return item.StartTimeReadable
  }

  if (!item.StartTime) {
    return "-"
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(item.StartTime))
}

function failureRate(summary: RequestLogSummary) {
  const total = summary.TotalRequests ?? 0

  if (!total) {
    return "0%"
  }

  return `${(((summary.FailedRequests ?? 0) / total) * 100).toFixed(1)}%`
}

function regionLabel(region: RequestLogRegion) {
  if (region.Name && region.Region && region.Name !== region.Region) {
    return `${region.Name} · ${region.Region}`
  }

  return region.Name || region.Region || "-"
}

function apiKeyLabel(apiKey: APIKeyOption) {
  if (apiKey.Name && apiKey.KeyId) {
    return `${apiKey.Name} · ${apiKey.KeyId.slice(-8)}`
  }

  return apiKey.Name || apiKey.KeyId || "-"
}

function tokenBreakdown(item: RequestLogItem) {
  return [
    item.PromptTokens ? `P ${formatInteger(item.PromptTokens)}` : "",
    item.CompletionTokens ? `C ${formatInteger(item.CompletionTokens)}` : "",
    item.CacheHitTokens ? `H ${formatInteger(item.CacheHitTokens)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string | number | boolean | undefined
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground">
        {value === undefined || value === "" ? "-" : String(value)}
      </span>
    </div>
  )
}

export function RequestLogsPage({ projectId }: { projectId: string }) {
  const { locale, t } = useI18n()
  const [dateRange, setDateRange] =
    useState<CalendarDateRange>(getDefaultDateRange)
  const [regions, setRegions] = useState<RequestLogRegion[]>([])
  const [selectedRegion, setSelectedRegion] = useState("")
  const [apiKeys, setApiKeys] = useState<APIKeyOption[]>([])
  const [selectedApiKeyId, setSelectedApiKeyId] = useState("all")
  const [requestId, setRequestId] = useState("")
  const [modelName, setModelName] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState<RequestLogItem[]>([])
  const [summary, setSummary] = useState<RequestLogSummary>({
    TotalRequests: 0,
    FailedRequests: 0,
  })
  const [totalCount, setTotalCount] = useState(0)
  const [isLoadingRegions, setIsLoadingRegions] = useState(true)
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarMenuRef = useRef<HTMLDivElement>(null)

  const regionItems = regions.length ? regions : [FALLBACK_REGION]
  const regionSelectItems = regionItems.map((region) => ({
    label: regionLabel(region),
    value: region.Region || "",
  }))
  const selectedApiKeyValue =
    selectedApiKeyId === "all" ? "" : selectedApiKeyId
  const pageStart = totalCount ? offset + 1 : 0
  const pageEnd = Math.min(offset + items.length, totalCount)
  const currentPage = totalCount ? Math.floor(offset / pageSize) + 1 : 0
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 0
  const selectedRange = useMemo(() => {
    const fallback = getDefaultDateRange()
    const from = dateRange.from ?? fallback.from

    return {
      startDate: from,
      endDate: dateRange.to ?? from ?? fallback.to,
    }
  }, [dateRange.from, dateRange.to])
  const { startDate, endDate } = selectedRange

  const apiKeyItems = useMemo(
    () => apiKeys.filter((apiKey) => apiKey.KeyId),
    [apiKeys]
  )
  const apiKeySelectItems = useMemo(
    () => [
      { label: t.allApiKeys, value: "all" },
      ...apiKeyItems.map((apiKey) => ({
        label: apiKeyLabel(apiKey),
        value: apiKey.KeyId || "",
      })),
    ],
    [apiKeyItems, t.allApiKeys]
  )

  const loadRegions = useCallback(async () => {
    setIsLoadingRegions(true)

    try {
      const response = await fetch(
        `/api/request-logs/regions?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" }
      )
      const result = (await response.json()) as RequestLogRegionsResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok || !Array.isArray(result.data)) {
        setRegions([FALLBACK_REGION])
        setSelectedRegion((current) => current || FALLBACK_REGION.Region || "")
        return
      }

      const nextRegions = result.data.filter((region) => region.Region)

      if (!nextRegions.length) {
        setRegions([FALLBACK_REGION])
        setSelectedRegion((current) => current || FALLBACK_REGION.Region || "")
        return
      }

      setRegions(nextRegions)
      setSelectedRegion((current) => {
        if (current && nextRegions.some((region) => region.Region === current)) {
          return current
        }

        return (
          nextRegions.find((region) => region.IsLocal)?.Region ||
          nextRegions[0]?.Region ||
          FALLBACK_REGION.Region ||
          ""
        )
      })
    } catch {
      setRegions([FALLBACK_REGION])
      setSelectedRegion((current) => current || FALLBACK_REGION.Region || "")
    } finally {
      setIsLoadingRegions(false)
    }
  }, [projectId])

  const loadApiKeys = useCallback(async () => {
    setIsLoadingApiKeys(true)

    try {
      const response = await fetch(
        `/api/api-keys?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" }
      )
      const result = (await response.json()) as APIKeysResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (response.ok && result.ok && Array.isArray(result.data)) {
        setApiKeys(result.data)
      } else {
        setApiKeys([])
      }
    } catch {
      setApiKeys([])
    } finally {
      setIsLoadingApiKeys(false)
    }
  }, [projectId])

  const loadRequestLogs = useCallback(async () => {
    if (!selectedRegion) {
      return
    }

    const startTimeMs = dateToMs(startDate)
    const endTimeMs = dateToMs(endDate, true)

    if (!startTimeMs || !endTimeMs || endTimeMs < startTimeMs) {
      setError(t.invalidTimeRange)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const searchParams = new URLSearchParams({
        projectId,
        region: selectedRegion,
        startTime: String(startTimeMs),
        endTime: String(endTimeMs),
        offset: String(offset),
        limit: String(pageSize),
      })

      if (requestId.trim()) {
        searchParams.set("requestId", requestId.trim())
      }

      if (modelName.trim()) {
        searchParams.set("modelName", modelName.trim())
      }

      if (selectedApiKeyValue) {
        searchParams.set("apiKeyId", selectedApiKeyValue)
      }

      const response = await fetch(`/api/request-logs?${searchParams}`, {
        cache: "no-store",
      })
      const result = (await response.json()) as RequestLogsResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok || !Array.isArray(result.data)) {
        setError(result.message || t.requestFailed)
        setItems([])
        setSummary({ TotalRequests: 0, FailedRequests: 0 })
        setTotalCount(0)
        return
      }

      setItems(result.data)
      setSummary(result.summary ?? { TotalRequests: 0, FailedRequests: 0 })
      setTotalCount(result.totalCount ?? result.data.length)
    } catch {
      setError(t.requestFailed)
      setItems([])
      setSummary({ TotalRequests: 0, FailedRequests: 0 })
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [
    modelName,
    offset,
    pageSize,
    projectId,
    requestId,
    selectedApiKeyValue,
    selectedRegion,
    endDate,
    startDate,
    t.invalidTimeRange,
    t.requestFailed,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRegions()
      void loadApiKeys()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadApiKeys, loadRegions])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOffset(0)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [
    dateRange.from,
    dateRange.to,
    modelName,
    pageSize,
    projectId,
    requestId,
    selectedApiKeyId,
    selectedRegion,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRequestLogs()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadRequestLogs, refreshToken])

  useEffect(() => {
    if (!isCalendarOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!calendarMenuRef.current?.contains(event.target as Node)) {
        setIsCalendarOpen(false)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)

    return () => window.removeEventListener("pointerdown", handlePointerDown)
  }, [isCalendarOpen])

  async function copyRequestId(value: string) {
    try {
      await window.navigator.clipboard.writeText(value)
      setCopiedId(value)
      window.setTimeout(() => {
        setCopiedId((current) => (current === value ? null : current))
      }, 1400)
    } catch {
      setError(t.copyFailed)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
        <div ref={calendarMenuRef} className="relative min-w-0">
          <Button
            variant="outline"
            className="w-full justify-start font-normal lg:max-w-[300px]"
            onClick={() => setIsCalendarOpen((open) => !open)}
          >
            <CalendarRangeIcon data-icon="inline-start" />
            <span className="truncate">
              {formatCalendarDate(startDate, locale)} -{" "}
              {formatCalendarDate(endDate, locale)}
            </span>
          </Button>
          {isCalendarOpen ? (
            <Card className="absolute top-full left-0 z-20 mt-2 w-fit p-0 shadow-lg">
              <CardContent className="p-2">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    if (!range) {
                      return
                    }

                    setDateRange(range)

                    if (range.from && range.to) {
                      setIsCalendarOpen(false)
                    }
                  }}
                  defaultMonth={startDate}
                  locale={datePickerLocale(locale)}
                  disabled={(date) => date > new Date()}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
        <div className="relative min-w-0 lg:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={requestId}
            placeholder={t.searchRequestId}
            onChange={(event) => setRequestId(event.target.value)}
          />
        </div>
        <Input
          className="min-w-0 lg:w-56"
          value={modelName}
          placeholder={t.filterModelName}
          onChange={(event) => setModelName(event.target.value)}
        />
        <Select
          items={regionSelectItems}
          value={selectedRegion}
          onValueChange={(value) => setSelectedRegion(String(value))}
        >
          <SelectTrigger
            aria-label={t.region}
            className="w-full lg:w-[22ch]"
            disabled={isLoadingRegions}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="w-60 min-w-60">
            <SelectGroup>
              {regionItems.map((region) => (
                <SelectItem
                  key={region.Region || region.Name}
                  value={region.Region || ""}
                >
                  {regionLabel(region)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={apiKeySelectItems}
          value={selectedApiKeyId}
          onValueChange={(value) => setSelectedApiKeyId(String(value))}
        >
          <SelectTrigger
            aria-label={t.selectApiKey}
            className="w-full lg:w-[22ch]"
            disabled={isLoadingApiKeys}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-64">
            <SelectGroup>
              <SelectItem value="all">{t.allApiKeys}</SelectItem>
              {apiKeyItems.map((apiKey) => (
                <SelectItem key={apiKey.KeyId} value={apiKey.KeyId || ""}>
                  {apiKeyLabel(apiKey)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={PAGE_SIZE_ITEMS}
          value={String(pageSize)}
          onValueChange={(value) => setPageSize(Number(value))}
        >
          <SelectTrigger aria-label={t.pageSize} className="w-full lg:w-[9ch]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PAGE_SIZE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 lg:ml-auto">
          <p className="text-sm whitespace-nowrap text-muted-foreground">
            {t.logsSummary(pageStart, pageEnd, totalCount)}
          </p>
          <Button
            variant="outline"
            onClick={() => setRefreshToken((value) => value + 1)}
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

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t.totalRequests}</CardDescription>
            <CardTitle className="text-2xl">
              {formatCompactNumber(summary.TotalRequests)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t.failedRequests}</CardDescription>
            <CardTitle className="text-2xl">
              {formatCompactNumber(summary.FailedRequests)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t.failureRate}</CardDescription>
            <CardTitle className="text-2xl">{failureRate(summary)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">{t.requestTime}</TableHead>
                <TableHead className="text-center">{t.region}</TableHead>
                <TableHead className="text-center">{t.models}</TableHead>
                <TableHead className="text-center">{t.apiKey}</TableHead>
                <TableHead className="text-center">{t.status}</TableHead>
                <TableHead className="text-center">{t.httpStatus}</TableHead>
                <TableHead className="text-center">{t.latency}</TableHead>
                <TableHead className="text-center">
                  {t.firstTokenLatency}
                </TableHead>
                <TableHead className="text-center">{t.totalTokens}</TableHead>
                <TableHead className="text-center">
                  {t.cacheHitRatio}
                </TableHead>
                <TableHead className="text-center">{t.requestId}</TableHead>
                <TableHead className="text-center">{t.details}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <LoaderCircleIcon className="mx-auto mb-2 size-5 animate-spin" />
                    {t.loadingRequestLogs}
                  </TableCell>
                </TableRow>
              ) : items.length ? (
                items.map((item) => {
                  const rowKey =
                    item.RequestId ||
                    `${item.StartTime}-${item.ModelName}-${item.ApiKeyId}`
                  const copied = copiedId === item.RequestId

                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="text-center">
                        {formatTimestamp(item, locale)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.Region || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-block max-w-48 truncate align-bottom">
                          {item.ModelName || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-block max-w-40 truncate align-bottom">
                          {item.ApiKeyName || item.ApiKeyId || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={item.IsSuccess ? "secondary" : "destructive"}
                        >
                          {item.IsSuccess ? (
                            <CheckCircle2Icon data-icon="inline-start" />
                          ) : (
                            <XCircleIcon data-icon="inline-start" />
                          )}
                          {item.IsSuccess ? t.success : t.failed}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.HttpStatusCode || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatLatency(item.Latency)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatLatency(item.FirstTokenLatency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span>{formatInteger(item.TotalTokens)}</span>
                        {tokenBreakdown(item) ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {tokenBreakdown(item)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatCacheHitRatio(item, locale)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.RequestId ? (
                          <div className="inline-flex max-w-56 items-center gap-1">
                            <span className="min-w-0 truncate font-mono text-xs">
                              {item.RequestId}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t.copyRequestId}
                              title={copied ? t.copied : t.copyRequestId}
                              onClick={() =>
                                item.RequestId
                                  ? void copyRequestId(item.RequestId)
                                  : undefined
                              }
                            >
                              <CopyIcon />
                            </Button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label={t.requestLogDetails}
                              />
                            }
                          >
                            <InfoIcon />
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            side="bottom"
                            className="w-96 max-w-[calc(100vw-2rem)]"
                          >
                            <PopoverHeader>
                              <PopoverTitle>{t.requestLogDetails}</PopoverTitle>
                            </PopoverHeader>
                            <div className="grid gap-1.5 text-xs">
                              <DetailRow
                                label={t.requestId}
                                value={item.RequestId}
                              />
                              <DetailRow
                                label={t.modelName}
                                value={item.ModelName}
                              />
                              <DetailRow
                                label={t.apiKey}
                                value={item.ApiKeyName || item.ApiKeyId}
                              />
                              <DetailRow
                                label={t.region}
                                value={item.Region}
                              />
                              <DetailRow
                                label={t.outputThroughput}
                                value={formatThroughput(
                                  item.OutputTokenThroughput
                                )}
                              />
                              <DetailRow
                                label={t.promptTokens}
                                value={item.PromptTokens}
                              />
                              <DetailRow
                                label={t.completionTokens}
                                value={item.CompletionTokens}
                              />
                              <DetailRow
                                label={t.cacheHitTokens}
                                value={item.CacheHitTokens}
                              />
                              <DetailRow
                                label={t.cacheHitRatio}
                                value={formatCacheHitRatio(item, locale)}
                              />
                              <DetailRow
                                label={t.cacheCreationTokens}
                                value={item.CacheCreationTokens}
                              />
                              <DetailRow
                                label={t.cacheCreation5mTokens}
                                value={item.CacheCreation5mTokens}
                              />
                              <DetailRow
                                label={t.cacheCreation1hTokens}
                                value={item.CacheCreation1hTokens}
                              />
                              <DetailRow
                                label={t.errorCode}
                                value={item.ErrorCode}
                              />
                              <DetailRow
                                label={t.inferenceLog}
                                value={item.HasInferenceLog ? t.yes : t.no}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="h-32 text-center text-muted-foreground"
                  >
                    {requestId || modelName || selectedApiKeyValue
                      ? t.noRequestLogResults
                      : t.noRequestLogs}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          disabled={isLoading || offset <= 0}
          onClick={() => setOffset((value) => Math.max(value - pageSize, 0))}
        >
          {t.previous}
        </Button>
        <span className="min-w-24 text-center text-sm text-muted-foreground">
          {t.pageIndicator(currentPage, totalPages)}
        </span>
        <Button
          variant="outline"
          disabled={isLoading || offset + items.length >= totalCount}
          onClick={() => setOffset((value) => value + pageSize)}
        >
          {t.next}
        </Button>
      </div>
    </div>
  )
}
