"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import type { DateRange as CalendarDateRange } from "react-day-picker"
import { enUS, zhCN } from "react-day-picker/locale"
import {
  BoxIcon,
  BrainCircuitIcon,
  CalendarRangeIcon,
  CircleAlertIcon,
  RefreshCwIcon,
  TrendingUpIcon,
} from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Calendar } from "@/components/ui/calendar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useI18n } from "@/components/i18n-provider"

type CostService = "modelverse" | "sandbox"

type CostSummary = {
  TotalAmount?: string
  AvgDailyAmount?: string
  AvgPerUserAmount?: string
  MaxDailyAmount?: string
  MaxDailyDate?: string
  KeyCount?: number
  CPUAmount?: string
  MemoryAmount?: string
  StorageAmount?: string
  TrendAvailable?: boolean
  HeatmapAvailable?: boolean
}

type DailyTrendPoint = {
  Day?: string
  Amount?: string
}

type ModelDistributionPoint = {
  ModelID?: string
  ModelName?: string
  Amount?: string
  Usage?: string
  CallCount?: number
  Percent?: string
}

type APIKeyCostPoint = {
  ResourceID?: string
  ResourceName?: string
  Amount?: string
  Usage?: string
  CallCount?: number
}

type RegionDistributionPoint = {
  Region?: string
  Amount?: string
  Percent?: string
}

type SandboxInstancePoint = {
  OrganizationID?: number
  OrganizationName?: string
  Amount?: string
}

type CostAnalysisPayload = {
  Action?: string
  RetCode?: number
  Message?: string
  Summary?: CostSummary
  DailyTrend?: DailyTrendPoint[]
  ModelDistribution?: ModelDistributionPoint[]
  KeyTopN?: APIKeyCostPoint[]
  RegionDistribution?: RegionDistributionPoint[]
  InstanceTopN?: SandboxInstancePoint[]
}

type CostAnalysisResult = {
  service: CostService
  action: string
  ok: boolean
  retCode?: number
  message?: string
  data?: CostAnalysisPayload
}

type CostAnalysisResponse = {
  ok: boolean
  message?: string
  projectId?: string
  startTime?: number
  endTime?: number
  topN?: number
  data?: CostAnalysisResult[]
}

type CostTrendPoint = {
  day: string
  label: string
  modelverse: number
  sandbox: number
}

const chartConfig = {
  modelverse: {
    label: "Modelverse",
    color: "var(--chart-1)",
  },
  sandbox: {
    label: "Sandbox",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function getDefaultDateRange(): CalendarDateRange {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)

  return {
    from: start,
    to: end,
  }
}

function dateToUnixSeconds(value: Date | undefined, endOfDay = false) {
  const date = new Date(value ?? new Date())
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, 0)

  return Math.floor(date.getTime() / 1000)
}

function normalizeDay(value: string | undefined) {
  return value ? value.slice(0, 10) : ""
}

function numberFromAmount(value: string | number | undefined) {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

function localeTag(locale: string) {
  return locale === "zh" ? "zh-CN" : "en-US"
}

function formatAmount(value: string | number | undefined, locale: string) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return "-"
  }

  return new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: 2,
  }).format(number)
}

function formatAmountWithUnit(
  value: string | number | undefined,
  locale: string,
  unit: string
) {
  return `${formatAmount(value, locale)} ${unit}`
}

function formatInteger(value: string | number | undefined, locale: string) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return "-"
  }

  return new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: 0,
  }).format(number)
}

function formatIntegerWithUnit(
  value: string | number | undefined,
  locale: string,
  unit: string
) {
  return `${formatInteger(value, locale)} ${unit}`
}

function formatCompactAmount(value: string | number | undefined, locale: string) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return "-"
  }

  return new Intl.NumberFormat(localeTag(locale), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number)
}

function formatPercent(value: string | undefined) {
  if (!value) {
    return "-"
  }

  return value.includes("%") ? value : `${value}%`
}

function formatDay(value: string | undefined, locale: string) {
  const day = normalizeDay(value)

  if (!day) {
    return "-"
  }

  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T00:00:00`))
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

function buildTrendData(
  results: CostAnalysisResult[],
  locale: string
): CostTrendPoint[] {
  const byDay = new Map<string, CostTrendPoint>()

  for (const result of results) {
    for (const point of result.data?.DailyTrend ?? []) {
      const day = normalizeDay(point.Day)

      if (!day) {
        continue
      }

      const item = byDay.get(day) ?? {
        day,
        label: formatDay(day, locale),
        modelverse: 0,
        sandbox: 0,
      }

      item[result.service] = numberFromAmount(point.Amount)
      byDay.set(day, item)
    }
  }

  return Array.from(byDay.values()).sort((left, right) =>
    left.day.localeCompare(right.day)
  )
}

function statusFor(results: CostAnalysisResult[], service: CostService) {
  return results.find((result) => result.service === service)
}

function peakSummary(
  modelverse: CostSummary | undefined,
  sandbox: CostSummary | undefined
) {
  const candidates = [
    {
      service: "Modelverse",
      amount: numberFromAmount(modelverse?.MaxDailyAmount),
      date: modelverse?.MaxDailyDate,
    },
    {
      service: "Sandbox",
      amount: numberFromAmount(sandbox?.MaxDailyAmount),
      date: sandbox?.MaxDailyDate,
    },
  ]

  return candidates.sort((left, right) => right.amount - left.amount)[0]
}

export function CostDashboard({ projectId }: { projectId: string }) {
  const { locale, t } = useI18n()
  const [dateRange, setDateRange] =
    useState<CalendarDateRange>(getDefaultDateRange)
  const [results, setResults] = useState<CostAnalysisResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarMenuRef = useRef<HTMLDivElement>(null)
  const selectedRange = useMemo(() => {
    const fallback = getDefaultDateRange()
    const from = dateRange.from ?? fallback.from

    return {
      startDate: from,
      endDate: dateRange.to ?? from ?? fallback.to,
    }
  }, [dateRange.from, dateRange.to])
  const { startDate, endDate } = selectedRange

  const loadCostAnalysis = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const searchParams = new URLSearchParams({
        projectId,
        startTime: String(dateToUnixSeconds(startDate)),
        endTime: String(dateToUnixSeconds(endDate, true)),
        topN: "15",
      })
      const response = await fetch(`/api/cost-analysis?${searchParams}`, {
        cache: "no-store",
      })
      const result = (await response.json()) as CostAnalysisResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok || !Array.isArray(result.data)) {
        setError(result.message || t.requestFailed)
        setResults([])
        return
      }

      setResults(result.data)
    } catch {
      setError(t.requestFailed)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [
    endDate,
    projectId,
    startDate,
    t.requestFailed,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCostAnalysis()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadCostAnalysis])

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

  const trendData = useMemo(
    () => buildTrendData(results, locale),
    [locale, results]
  )
  const onlineCount = results.filter((result) => result.ok).length
  const modelverse = statusFor(results, "modelverse")
  const sandbox = statusFor(results, "sandbox")
  const modelverseSummary = modelverse?.data?.Summary
  const sandboxSummary = sandbox?.data?.Summary
  const peak = peakSummary(modelverseSummary, sandboxSummary)
  const modelRows = (modelverse?.data?.ModelDistribution ?? []).slice(0, 6)
  const keyRows = (modelverse?.data?.KeyTopN ?? []).slice(0, 6)
  const sandboxRegionRows = (sandbox?.data?.RegionDistribution ?? []).slice(0, 4)
  const sandboxInstanceRows = (sandbox?.data?.InstanceTopN ?? []).slice(0, 4)

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div ref={calendarMenuRef} className="relative">
            <Button
              variant="outline"
              className="min-w-[260px] justify-start font-normal"
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
          <div className="min-w-0 text-sm text-muted-foreground">
            {t.project}{" "}
            <span className="font-mono text-foreground">{projectId}</span>
          </div>
        </div>
        <Button onClick={() => void loadCostAnalysis()} disabled={isLoading}>
          <RefreshCwIcon
            data-icon="inline-start"
            className={isLoading ? "animate-spin" : undefined}
          />
          {t.refresh}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuitIcon className="text-muted-foreground" />
                <CardTitle>{t.modelverse}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {formatAmountWithUnit(
                  modelverseSummary?.TotalAmount,
                  locale,
                  t.yuan
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">
                    {t.avgDailySpend}
                  </div>
                  <div className="font-medium tabular-nums">
                    {formatAmountWithUnit(
                      modelverseSummary?.AvgDailyAmount,
                      locale,
                      t.yuan
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t.keyCount}</div>
                  <div className="font-medium tabular-nums">
                    {formatIntegerWithUnit(
                      modelverseSummary?.KeyCount,
                      locale,
                      t.itemUnit
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BoxIcon className="text-muted-foreground" />
                <CardTitle>{t.sandbox}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {formatAmountWithUnit(
                  sandboxSummary?.TotalAmount,
                  locale,
                  t.yuan
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">{t.cpu}</div>
                  <div className="font-medium tabular-nums">
                    {formatAmountWithUnit(
                      sandboxSummary?.CPUAmount,
                      locale,
                      t.yuan
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t.memory}</div>
                  <div className="font-medium tabular-nums">
                    {formatAmountWithUnit(
                      sandboxSummary?.MemoryAmount,
                      locale,
                      t.yuan
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t.storage}</div>
                  <div className="font-medium tabular-nums">
                    {formatAmountWithUnit(
                      sandboxSummary?.StorageAmount,
                      locale,
                      t.yuan
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="text-muted-foreground" />
                <CardTitle>{t.peakSpend}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {formatAmountWithUnit(peak?.amount, locale, t.yuan)}
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {formatDay(peak?.date, locale)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="min-h-[430px]">
          <CardHeader className="border-b">
            <CardTitle>{t.costOverview}</CardTitle>
            <CardAction>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t.unitYuan}</Badge>
                <Badge variant={onlineCount === 2 ? "secondary" : "outline"}>
                  {onlineCount}/2 {t.available}
                </Badge>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartContainer
              config={chartConfig}
              className="h-[300px] w-full"
              initialDimension={{ width: 900, height: 300 }}
            >
              <AreaChart
                accessibilityLayer
                data={trendData}
                margin={{
                  left: 4,
                  right: 12,
                  top: 12,
                }}
              >
                <defs>
                  <linearGradient
                    id="fillModelverse"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-modelverse)"
                      stopOpacity={0.36}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-modelverse)"
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillSandbox"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-sandbox)"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-sandbox)"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, "dataMax"]}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={56}
                  tickFormatter={(value) => formatCompactAmount(value, locale)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="sandbox"
                  type="linear"
                  fill="url(#fillSandbox)"
                  fillOpacity={1}
                  stroke="var(--color-sandbox)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="modelverse"
                  type="linear"
                  fill="url(#fillModelverse)"
                  fillOpacity={1}
                  stroke="var(--color-modelverse)"
                  strokeWidth={2}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{t.requestFailed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.topModels}</CardTitle>
            <CardDescription>{t.modelverse}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.models}</TableHead>
                    <TableHead>{t.amount}</TableHead>
                    <TableHead>{t.calls}</TableHead>
                    <TableHead>{t.percent}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelRows.length ? (
                    modelRows.map((model) => (
                      <TableRow key={model.ModelID ?? model.ModelName}>
                        <TableCell className="max-w-[260px] truncate font-medium">
                          {model.ModelName || model.ModelID || "-"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatAmountWithUnit(model.Amount, locale, t.yuan)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatInteger(model.CallCount, locale)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatPercent(model.Percent)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4}>{t.noCostData}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.topApiKeys}</CardTitle>
            <CardDescription>{t.modelverse}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.apiKey}</TableHead>
                    <TableHead>{t.amount}</TableHead>
                    <TableHead>{t.usage}</TableHead>
                    <TableHead>{t.calls}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keyRows.length ? (
                    keyRows.map((apiKey) => (
                      <TableRow key={apiKey.ResourceID ?? apiKey.ResourceName}>
                        <TableCell className="max-w-[260px] truncate font-medium">
                          {apiKey.ResourceName || apiKey.ResourceID || "-"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatAmountWithUnit(apiKey.Amount, locale, t.yuan)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatInteger(apiKey.Usage, locale)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatInteger(apiKey.CallCount, locale)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4}>{t.noCostData}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.sandboxBreakdown}</CardTitle>
            <CardDescription>{t.regionShare}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.region}</TableHead>
                    <TableHead>{t.amount}</TableHead>
                    <TableHead>{t.percent}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sandboxRegionRows.length ? (
                    sandboxRegionRows.map((item) => (
                      <TableRow key={item.Region}>
                        <TableCell className="font-medium">
                          {item.Region || "-"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatAmountWithUnit(item.Amount, locale, t.yuan)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatPercent(item.Percent)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3}>{t.noCostData}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.sandboxUsers}</CardTitle>
            <CardDescription>{t.sandbox}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.name}</TableHead>
                    <TableHead>{t.amount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sandboxInstanceRows.length ? (
                    sandboxInstanceRows.map((item) => (
                      <TableRow
                        key={item.OrganizationID ?? item.OrganizationName}
                      >
                        <TableCell className="font-medium">
                          {item.OrganizationName || item.OrganizationID || "-"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatAmountWithUnit(item.Amount, locale, t.yuan)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2}>{t.noCostData}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
