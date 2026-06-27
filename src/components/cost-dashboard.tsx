"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import type { DateRange as CalendarDateRange } from "react-day-picker"
import { enUS, zhCN } from "react-day-picker/locale"
import {
  CalendarRangeIcon,
  CircleAlertIcon,
  RefreshCwIcon,
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

type AmountBarPoint = {
  id: string
  label: string
  amount: number
  valueLabel: string
}

const chartConfig = {
  modelverse: {
    label: "Modelverse",
    color: "oklch(0.58 0.22 263)",
  },
  sandbox: {
    label: "Sandbox",
    color: "oklch(0.62 0.17 154)",
  },
} satisfies ChartConfig

const modelverseChartColor = "oklch(0.58 0.22 263)"
const sandboxChartColor = "oklch(0.62 0.17 154)"
const peakChartColor = "oklch(0.72 0.18 70)"
const regionChartColors = [
  sandboxChartColor,
  "oklch(0.64 0.2 35)",
  "oklch(0.61 0.19 245)",
  "oklch(0.66 0.18 315)",
  peakChartColor,
]

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
  const amount = formatAmount(value, locale)

  return amount === "-" ? amount : `${amount} ${unit}`
}

function formatTooltipAmount(value: unknown, locale: string, unit: string) {
  if (typeof value === "number" || typeof value === "string") {
    return formatAmountWithUnit(value, locale, unit)
  }

  return "-"
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
  const amount = formatInteger(value, locale)

  return amount === "-" ? amount : `${amount} ${unit}`
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

function compactLabel(value: string | number | undefined, fallback: string) {
  const label = String(value ?? fallback)

  return label.length > 24 ? `${label.slice(0, 21)}...` : label
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

function toAmountBarPoint(
  id: string | number | undefined,
  label: string | number | undefined,
  amount: string | number | undefined,
  locale: string,
  unit: string
): AmountBarPoint {
  const normalizedAmount = numberFromAmount(amount)

  return {
    id: String(id ?? label ?? "-"),
    label: compactLabel(label, "-"),
    amount: normalizedAmount,
    valueLabel: formatAmountWithUnit(normalizedAmount, locale, unit),
  }
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

function AmountBarCard({
  title,
  description,
  data,
  emptyText,
  color = modelverseChartColor,
}: {
  title: string
  description: string
  data: AmountBarPoint[]
  emptyText: string
  color?: string
}) {
  const amountBarConfig = useMemo(
    () =>
      ({
        amount: {
          label: "Amount",
          color,
        },
      }) satisfies ChartConfig,
    [color]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <ChartContainer
            config={amountBarConfig}
            className="h-[260px] w-full"
            initialDimension={{ width: 520, height: 260 }}
          >
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              margin={{
                left: 8,
                right: 112,
              }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={132}
              />
              <XAxis
                dataKey="amount"
                type="number"
                domain={[0, "dataMax"]}
                hide
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={4}>
                <LabelList
                  dataKey="valueLabel"
                  position="right"
                  offset={8}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[260px] items-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RegionPieCard({
  title,
  description,
  data,
  emptyText,
  locale,
  unit,
}: {
  title: string
  description: string
  data: AmountBarPoint[]
  emptyText: string
  locale: string
  unit: string
}) {
  const regionPieConfig = useMemo(
    () =>
      ({
        amount: {
          label: "Amount",
          color: sandboxChartColor,
        },
      }) satisfies ChartConfig,
    []
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="grid min-h-[260px] gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <ChartContainer
              config={regionPieConfig}
              className="h-[260px] w-full"
              initialDimension={{ width: 320, height: 260 }}
            >
              <PieChart accessibilityLayer>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      nameKey="label"
                      formatter={(value, name, item) => (
                        <>
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor:
                                item.payload?.fill ?? item.color,
                            }}
                          />
                          <span className="text-muted-foreground">
                            {String(name)}
                          </span>
                          <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                            {item.payload?.valueLabel ??
                              formatTooltipAmount(value, locale, unit)}
                          </span>
                        </>
                      )}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius={54}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {data.map((item, index) => (
                    <Cell
                      key={item.id}
                      fill={regionChartColors[index % regionChartColors.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col justify-center gap-2">
              {data.map((item, index) => (
                <div
                  key={item.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          regionChartColors[index % regionChartColors.length],
                      }}
                    />
                    <span className="truncate text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono font-medium tabular-nums">
                    {item.valueLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-[260px] items-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
      </CardContent>
    </Card>
  )
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
  const modelChartRows = modelRows.map((model) =>
    toAmountBarPoint(
      model.ModelID,
      model.ModelName ?? model.ModelID,
      model.Amount,
      locale,
      t.yuan
    )
  ).sort((left, right) => right.amount - left.amount)
  const keyChartRows = keyRows.map((apiKey) =>
    toAmountBarPoint(
      apiKey.ResourceID,
      apiKey.ResourceName ?? apiKey.ResourceID,
      apiKey.Amount,
      locale,
      t.yuan
    )
  ).sort((left, right) => right.amount - left.amount)
  const sandboxRegionChartRows = sandboxRegionRows.map((item) =>
    toAmountBarPoint(item.Region, item.Region, item.Amount, locale, t.yuan)
  ).sort((left, right) => right.amount - left.amount)
  const sandboxInstanceChartRows = sandboxInstanceRows.map((item) =>
    toAmountBarPoint(
      item.OrganizationID,
      item.OrganizationName ?? item.OrganizationID,
      item.Amount,
      locale,
      t.yuan
    )
  ).sort((left, right) => right.amount - left.amount)

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div ref={calendarMenuRef} className="relative">
            <Button
              variant="outline"
              className="max-w-[300px] justify-start font-normal"
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
              <CardTitle>{t.modelverse}</CardTitle>
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
              <CardTitle>{t.sandbox}</CardTitle>
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
              <CardTitle>{t.peakSpend}</CardTitle>
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
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-modelverse)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-modelverse)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillSandbox"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-sandbox)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-sandbox)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  interval="preserveStartEnd"
                  tickFormatter={(value) => formatDay(String(value), locale)}
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
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(value) =>
                        formatDay(String(value), locale)
                      }
                    />
                  }
                />
                <Area
                  dataKey="sandbox"
                  type="monotone"
                  fill="url(#fillSandbox)"
                  fillOpacity={1}
                  stroke="var(--color-sandbox)"
                  stackId="cost"
                />
                <Area
                  dataKey="modelverse"
                  type="monotone"
                  fill="url(#fillModelverse)"
                  fillOpacity={1}
                  stroke="var(--color-modelverse)"
                  stackId="cost"
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
        <AmountBarCard
          title={t.topModels}
          description={t.modelverse}
          data={modelChartRows}
          emptyText={t.noCostData}
          color={modelverseChartColor}
        />
        <AmountBarCard
          title={t.topApiKeys}
          description={t.modelverse}
          data={keyChartRows}
          emptyText={t.noCostData}
          color="oklch(0.61 0.19 245)"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RegionPieCard
          title={t.sandboxBreakdown}
          description={t.regionShare}
          data={sandboxRegionChartRows}
          emptyText={t.noCostData}
          locale={locale}
          unit={t.yuan}
        />
        <AmountBarCard
          title={t.sandboxUsers}
          description={t.sandbox}
          data={sandboxInstanceChartRows}
          emptyText={t.noCostData}
          color={sandboxChartColor}
        />
      </div>
    </div>
  )
}
