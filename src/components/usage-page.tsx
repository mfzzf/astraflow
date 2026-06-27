"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DateRange as CalendarDateRange } from "react-day-picker"
import { enUS, zhCN } from "react-day-picker/locale"
import {
  CalendarRangeIcon,
  InfoIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

type BillingOption = {
  Name?: string
  Value?: string | number
}

type UsageFilterOptions = {
  ProductCodes?: BillingOption[]
  OrderTypes?: BillingOption[]
  Regions?: BillingOption[]
  PricingSKUs?: BillingOption[]
  Dimensions?: BillingOption[]
  PricingUnits?: BillingOption[]
}

type FilterOptionsResponse = {
  ok: boolean
  message?: string
  data?: UsageFilterOptions
}

type MonthlyAmount = {
  BillingCycle?: string
  TotalOrderAmount?: string
  PaidAmount?: string
  UnpaidAmount?: string
  StarCardAmount?: string
  IsCurrentMonth?: boolean
}

type MonthlyBill = {
  OrganizationID?: number
  OrganizationName?: string
  OrderTotalPrice?: string
  Coupon?: string
  BonusAccount?: string
  CashAccount?: string
  StarCardAccount?: string
}

type MonthlyUsageData = {
  amount?: MonthlyAmount
  paidBill?: {
    BillingCycle?: string
    Bills?: MonthlyBill[]
  }
}

type MonthlyResponse = {
  ok: boolean
  message?: string
  data?: MonthlyUsageData
}

type PaidOrderSummary = {
  ResourceId?: string
  ResourceName?: string
  Region?: string
  RegionDisplay?: string
  PricingSkuId?: number
  PricingSKU?: string
  ModelID?: string
  ModelName?: string
  PricingUnit?: number
  PricingUnitName?: string
  OrderType?: number
  OrderTypeDisplay?: string
  ChargeType?: number
  Status?: number
  StatusDisplay?: string
  ListPrice?: string
  DiscountPrice?: string
  SumQuantity?: number
  SumQuantityDisplay?: string
  SumOrderPrice?: string
  SumOriginalPrice?: string
  SumCashAccount?: string
  SumStarCardAccount?: string
  SumBonusAccount?: string
  SumCoupon?: string
}

type PaidSummaryResponse = {
  ok: boolean
  message?: string
  data?: PaidOrderSummary[]
}

type PaidOrderValue = string | number | boolean | undefined
type PaidOrderItem = Record<string, PaidOrderValue>

type PaidOrdersResponse = {
  ok: boolean
  message?: string
  data?: PaidOrderItem[]
  totalCount?: number
}

type UsageView = "overview" | "monthly" | "summary" | "details"

const PAGE_SIZE_ITEMS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
]

const FALLBACK_PRODUCTS = [
  { Name: "Modelverse", Value: "modelverse" },
  { Name: "Sandbox", Value: "sandbox" },
  { Name: "Star Card", Value: "starcard" },
]

const FALLBACK_DIMENSIONS = [
  { Name: "project", Value: "project" },
  { Name: "sku", Value: "sku" },
  { Name: "region", Value: "region" },
]

const DEFAULT_REGION = "cn-wlcb"
const FALLBACK_REGIONS = [
  { Name: "乌兰察布", Value: DEFAULT_REGION },
  { Name: "洛杉矶", Value: "us-ca" },
]
const EMPTY_BILLING_OPTIONS: BillingOption[] = []

function getDefaultDateRange(): CalendarDateRange {
  const end = new Date()
  const start = new Date(end)
  start.setHours(0, 0, 0, 0)

  return {
    from: start,
    to: end,
  }
}

function billingCycleFromDate(value: Date | undefined) {
  const date = value ?? new Date()
  const month = String(date.getMonth() + 1).padStart(2, "0")

  return `${date.getFullYear()}-${month}`
}

function localeTag(locale: string) {
  return locale === "zh" ? "zh-CN" : "en-US"
}

function datePickerLocale(locale: string) {
  return locale === "zh" ? zhCN : enUS
}

function dateToUnixSeconds(value: Date | undefined, endOfDay = false) {
  const date = new Date(value ?? new Date())
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, 0)

  return Math.floor(date.getTime() / 1000)
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

function formatInteger(value: string | number | undefined, locale: string) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return "-"
  }

  return new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: 0,
  }).format(number)
}

function optionValue(option: BillingOption) {
  return option.Value === undefined ? "" : String(option.Value)
}

function optionLabel(option: BillingOption) {
  const value = optionValue(option)

  if (option.Name && value && option.Name !== value) {
    return `${option.Name} · ${value}`
  }

  return option.Name || value || "-"
}

function dimensionLabel(option: BillingOption, t: ReturnType<typeof useI18n>["t"]) {
  const value = optionValue(option)

  if (value === "project") {
    return t.project
  }

  if (value === "sku") {
    return t.pricingSku
  }

  if (value === "region") {
    return t.region
  }

  return optionLabel(option)
}

function getValue(item: PaidOrderItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key]

    if (value !== undefined && value !== null && value !== "") {
      return value
    }
  }

  return undefined
}

function formatValue(value: PaidOrderValue) {
  if (value === undefined || value === "") {
    return "-"
  }

  return String(value)
}

function formatOrderTime(value: PaidOrderValue, locale: string) {
  if (typeof value !== "number") {
    return formatValue(value)
  }

  const timestamp = value > 10_000_000_000 ? value : value * 1000

  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

function accountRowsFromSummary(item: PaidOrderSummary, t: ReturnType<typeof useI18n>["t"]) {
  return [
    { label: t.cashAccount, value: item.SumCashAccount },
    { label: t.starCardAccount, value: item.SumStarCardAccount },
    { label: t.bonusAccount, value: item.SumBonusAccount },
    { label: t.coupon, value: item.SumCoupon },
  ]
}

function accountRowsFromOrder(item: PaidOrderItem, t: ReturnType<typeof useI18n>["t"]) {
  return [
    { label: t.cashAccount, value: getValue(item, ["CashAccount", "SumCashAccount"]) },
    {
      label: t.starCardAccount,
      value: getValue(item, ["StarCardAccount", "SumStarCardAccount"]),
    },
    {
      label: t.bonusAccount,
      value: getValue(item, ["BonusAccount", "SumBonusAccount"]),
    },
    { label: t.coupon, value: getValue(item, ["Coupon", "SumCoupon"]) },
  ]
}

function AccountBreakdown({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: PaidOrderValue }[]
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={title}
          />
        }
      >
        <InfoIcon />
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        <div className="grid gap-1.5 text-xs">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2"
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span className="min-w-0 break-words text-foreground">
                {formatValue(row.value)}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function UsagePage({ projectId }: { projectId: string }) {
  const { locale, t } = useI18n()
  const [filterOptions, setFilterOptions] =
    useState<UsageFilterOptions | null>(null)
  const [dateRange, setDateRange] =
    useState<CalendarDateRange>(getDefaultDateRange)
  const [productCode, setProductCode] = useState("modelverse")
  const [orderType, setOrderType] = useState("all")
  const [region, setRegion] = useState("all")
  const [pricingSku, setPricingSku] = useState("all")
  const [activeView, setActiveView] = useState<UsageView>("overview")
  const [dimension, setDimension] = useState("project")
  const [pageSize, setPageSize] = useState(10)
  const [offset, setOffset] = useState(0)
  const [monthlyData, setMonthlyData] = useState<MonthlyUsageData | null>(null)
  const [summaries, setSummaries] = useState<PaidOrderSummary[]>([])
  const [orders, setOrders] = useState<PaidOrderItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoadingFilters, setIsLoadingFilters] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarMenuRef = useRef<HTMLDivElement>(null)
  const page = Math.floor(offset / pageSize) + 1
  const pageStart = totalCount ? offset + 1 : 0
  const pageEnd = Math.min(offset + orders.length, totalCount)
  const selectedRange = useMemo(() => {
    const fallback = getDefaultDateRange()
    const from = dateRange.from ?? fallback.from

    return {
      startDate: from,
      endDate: dateRange.to ?? from ?? fallback.to,
    }
  }, [dateRange.from, dateRange.to])
  const { startDate, endDate } = selectedRange
  const billingCycle = useMemo(
    () => billingCycleFromDate(startDate),
    [startDate]
  )
  const productOptions = filterOptions?.ProductCodes?.length
    ? filterOptions.ProductCodes
    : FALLBACK_PRODUCTS
  const orderTypeOptions = filterOptions?.OrderTypes ?? EMPTY_BILLING_OPTIONS
  const regionOptions = filterOptions?.Regions?.length
    ? filterOptions.Regions
    : FALLBACK_REGIONS
  const pricingSkuOptions = filterOptions?.PricingSKUs ?? EMPTY_BILLING_OPTIONS
  const dimensionOptions = filterOptions?.Dimensions?.length
    ? filterOptions.Dimensions
    : FALLBACK_DIMENSIONS
  const productSelectItems = useMemo(
    () =>
      productOptions.map((option) => ({
        value: optionValue(option),
        label: optionLabel(option),
      })),
    [productOptions]
  )
  const orderTypeSelectItems = useMemo(
    () => [
      { value: "all", label: t.allOrderTypes },
      ...orderTypeOptions.map((option) => ({
        value: optionValue(option),
        label: optionLabel(option),
      })),
    ],
    [orderTypeOptions, t.allOrderTypes]
  )
  const regionSelectItems = useMemo(
    () => [
      { value: "all", label: t.allRegions },
      ...regionOptions.map((option) => ({
        value: optionValue(option),
        label: optionLabel(option),
      })),
    ],
    [regionOptions, t.allRegions]
  )
  const pricingSkuSelectItems = useMemo(
    () => [
      { value: "all", label: t.allPricingSkus },
      ...pricingSkuOptions.map((option) => ({
        value: optionValue(option),
        label: optionLabel(option),
      })),
    ],
    [pricingSkuOptions, t.allPricingSkus]
  )
  const dimensionSelectItems = useMemo(
    () =>
      dimensionOptions.map((option) => ({
        value: optionValue(option),
        label: dimensionLabel(option, t),
      })),
    [dimensionOptions, t]
  )
  const monthlyBills = monthlyData?.paidBill?.Bills
  const bills = useMemo(
    () =>
      [...(monthlyBills ?? [])].sort(
        (left, right) =>
          Number(right.OrderTotalPrice ?? 0) - Number(left.OrderTotalPrice ?? 0)
      ),
    [monthlyBills]
  )
  const usageViews = useMemo(
    () =>
      [
        { label: t.overview, value: "overview" },
        { label: t.monthlyBill, value: "monthly" },
        { label: t.consumptionSummary, value: "summary" },
        { label: t.orderDetails, value: "details" },
      ] satisfies { label: string; value: UsageView }[],
    [t.consumptionSummary, t.monthlyBill, t.orderDetails, t.overview]
  )

  const loadFilterOptions = useCallback(async () => {
    setIsLoadingFilters(true)

    try {
      const searchParams = new URLSearchParams({
        projectId,
        productCode,
      })
      const response = await fetch(`/api/usage/filter-options?${searchParams}`, {
        cache: "no-store",
      })
      const result = (await response.json()) as FilterOptionsResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (response.ok && result.ok && result.data) {
        setFilterOptions(result.data)
      } else {
        setFilterOptions(null)
      }
    } catch {
      setFilterOptions(null)
    } finally {
      setIsLoadingFilters(false)
    }
  }, [productCode, projectId])

  const loadUsage = useCallback(async () => {
    const startTime = dateToUnixSeconds(startDate)
    const endTime = dateToUnixSeconds(endDate, true)

    if (!startTime || !endTime || endTime < startTime) {
      setError(t.invalidTimeRange)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const commonParams = new URLSearchParams({
        projectId,
        productCodes: productCode,
        startTime: String(startTime),
        endTime: String(endTime),
      })
      const ordersParams = new URLSearchParams(commonParams)
      const monthlyParams = new URLSearchParams({
        projectId,
        productCodes: productCode,
        billingCycle,
        dimension,
      })

      if (orderType !== "all") {
        commonParams.set("orderTypes", orderType)
        ordersParams.set("orderTypes", orderType)
      }

      if (region !== "all") {
        commonParams.set("region", region)
        ordersParams.set("region", region)
      }

      if (pricingSku !== "all") {
        commonParams.set("pricingSku", pricingSku)
        ordersParams.set("pricingSku", pricingSku)
      }

      ordersParams.set("page", String(page))
      ordersParams.set("pageSize", String(pageSize))

      const [monthlyResponse, summaryResponse, ordersResponse] =
        await Promise.all([
          fetch(`/api/usage/monthly?${monthlyParams}`, { cache: "no-store" }),
          fetch(`/api/usage/paid-order-summary?${commonParams}`, {
            cache: "no-store",
          }),
          fetch(`/api/usage/paid-orders?${ordersParams}`, {
            cache: "no-store",
          }),
        ])

      if (
        monthlyResponse.status === 401 ||
        summaryResponse.status === 401 ||
        ordersResponse.status === 401
      ) {
        window.location.href = "/login"
        return
      }

      const monthlyResult = (await monthlyResponse.json()) as MonthlyResponse
      const summaryResult = (await summaryResponse.json()) as PaidSummaryResponse
      const ordersResult = (await ordersResponse.json()) as PaidOrdersResponse

      if (!monthlyResponse.ok || !monthlyResult.ok) {
        throw new Error(monthlyResult.message || t.requestFailed)
      }

      if (!summaryResponse.ok || !summaryResult.ok) {
        throw new Error(summaryResult.message || t.requestFailed)
      }

      if (!ordersResponse.ok || !ordersResult.ok) {
        throw new Error(ordersResult.message || t.requestFailed)
      }

      setMonthlyData(monthlyResult.data ?? null)
      setSummaries(summaryResult.data ?? [])
      setOrders(ordersResult.data ?? [])
      setTotalCount(ordersResult.totalCount ?? ordersResult.data?.length ?? 0)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t.requestFailed)
      setMonthlyData(null)
      setSummaries([])
      setOrders([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [
    billingCycle,
    dimension,
    endDate,
    orderType,
    page,
    pageSize,
    pricingSku,
    productCode,
    projectId,
    region,
    startDate,
    t.invalidTimeRange,
    t.requestFailed,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFilterOptions()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadFilterOptions])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOrderType("all")
      setRegion("all")
      setPricingSku("all")
      setOffset(0)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [productCode])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOffset(0)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [
    dateRange.from,
    dateRange.to,
    dimension,
    orderType,
    pageSize,
    pricingSku,
    projectId,
    region,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadUsage()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadUsage, refreshToken])

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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-center">
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
        <Select
          items={productSelectItems}
          value={productCode}
          onValueChange={(value) => setProductCode(String(value))}
        >
          <SelectTrigger
            aria-label={t.product}
            className="w-full lg:w-[18ch]"
            disabled={isLoadingFilters}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-56">
            <SelectGroup>
              {productSelectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={orderTypeSelectItems}
          value={orderType}
          onValueChange={(value) => setOrderType(String(value))}
        >
          <SelectTrigger
            aria-label={t.orderType}
            className="w-full lg:w-[16ch]"
            disabled={isLoadingFilters}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-48">
            <SelectGroup>
              {orderTypeSelectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={regionSelectItems}
          value={region}
          onValueChange={(value) => setRegion(String(value))}
        >
          <SelectTrigger
            aria-label={t.region}
            className="w-full lg:w-[16ch]"
            disabled={isLoadingFilters}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-48">
            <SelectGroup>
              {regionSelectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={pricingSkuSelectItems}
          value={pricingSku}
          onValueChange={(value) => setPricingSku(String(value))}
        >
          <SelectTrigger
            aria-label={t.pricingSku}
            className="w-full lg:w-[22ch]"
            disabled={isLoadingFilters}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-64">
            <SelectGroup>
              {pricingSkuSelectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={dimensionSelectItems}
          value={dimension}
          onValueChange={(value) => setDimension(String(value))}
        >
          <SelectTrigger aria-label={t.dimension} className="w-full lg:w-[14ch]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              {dimensionSelectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
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
            {t.usageSummary(pageStart, pageEnd, totalCount)}
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

      <Tabs
        value={activeView}
        onValueChange={(value) => setActiveView(value as UsageView)}
        className="gap-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-foreground sm:h-11 sm:grid-cols-4">
          {usageViews.map((view) => (
            <TabsTrigger
              key={view.value}
              value={view.value}
              className="h-9 rounded-lg px-3 text-sm leading-none font-medium text-muted-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm"
            >
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="outline-none">
          <div className="grid gap-3 md:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t.totalOrderAmount}</CardDescription>
            <CardTitle className="text-2xl">
              {formatAmountWithUnit(
                monthlyData?.amount?.TotalOrderAmount,
                locale,
                t.yuan
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t.paidAmount}</CardDescription>
            <CardTitle className="text-2xl">
              {formatAmountWithUnit(monthlyData?.amount?.PaidAmount, locale, t.yuan)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t.unpaidAmount}</CardDescription>
            <CardTitle className="text-2xl">
              {formatAmountWithUnit(
                monthlyData?.amount?.UnpaidAmount,
                locale,
                t.yuan
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t.starCardAmount}</CardDescription>
            <CardTitle className="text-2xl">
              {formatAmountWithUnit(
                monthlyData?.amount?.StarCardAmount,
                locale,
                t.yuan
              )}
            </CardTitle>
          </CardHeader>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="outline-none">
      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">{t.organization}</TableHead>
                <TableHead className="text-center">{t.totalOrderAmount}</TableHead>
                <TableHead className="text-center">{t.cashAccount}</TableHead>
                <TableHead className="text-center">{t.starCardAccount}</TableHead>
                <TableHead className="text-center">{t.bonusAccount}</TableHead>
                <TableHead className="text-center">{t.coupon}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <LoaderCircleIcon className="mx-auto mb-2 size-5 animate-spin" />
                    {t.loadingUsage}
                  </TableCell>
                </TableRow>
              ) : bills.length ? (
                bills.map((bill) => (
                  <TableRow key={bill.OrganizationID ?? bill.OrganizationName}>
                    <TableCell className="text-center">
                      <span className="inline-block max-w-48 truncate align-bottom">
                        {bill.OrganizationName || bill.OrganizationID || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {formatAmountWithUnit(bill.OrderTotalPrice, locale, t.yuan)}
                    </TableCell>
                    <TableCell className="text-center">{bill.CashAccount ?? "-"}</TableCell>
                    <TableCell className="text-center">
                      {bill.StarCardAccount ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {bill.BonusAccount ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">{bill.Coupon ?? "-"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t.noUsageData}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="summary" className="outline-none">
      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">{t.resource}</TableHead>
                <TableHead className="text-center">{t.region}</TableHead>
                <TableHead className="text-center">{t.modelName}</TableHead>
                <TableHead className="text-center">{t.pricingSku}</TableHead>
                <TableHead className="text-center">{t.orderType}</TableHead>
                <TableHead className="text-center">{t.quantity}</TableHead>
                <TableHead className="text-center">{t.unitPrice}</TableHead>
                <TableHead className="text-center">{t.discountPrice}</TableHead>
                <TableHead className="text-center">{t.amount}</TableHead>
                <TableHead className="text-center">{t.accountBreakdown}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <LoaderCircleIcon className="mx-auto mb-2 size-5 animate-spin" />
                    {t.loadingUsage}
                  </TableCell>
                </TableRow>
              ) : summaries.length ? (
                summaries.map((item, index) => (
                  <TableRow
                    key={`${item.ResourceId ?? "resource"}-${item.PricingSKU ?? "sku"}-${index}`}
                  >
                    <TableCell className="text-center">
                      <span className="inline-block max-w-56 truncate align-bottom">
                        {item.ResourceName || item.ResourceId || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.RegionDisplay || item.Region || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-block max-w-48 truncate align-bottom">
                        {item.ModelName || item.ModelID || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-block max-w-56 truncate align-bottom">
                        {item.PricingSKU || item.PricingSkuId || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.OrderTypeDisplay || item.OrderType || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.SumQuantityDisplay ||
                        formatInteger(item.SumQuantity, locale)}
                    </TableCell>
                    <TableCell className="text-center">{item.ListPrice || "-"}</TableCell>
                    <TableCell className="text-center">
                      {item.DiscountPrice || "-"}
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {formatAmountWithUnit(item.SumOrderPrice, locale, t.yuan)}
                    </TableCell>
                    <TableCell className="text-center">
                      <AccountBreakdown
                        title={t.accountBreakdown}
                        rows={accountRowsFromSummary(item, t)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t.noUsageData}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="details" className="outline-none">
      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">{t.requestTime}</TableHead>
                <TableHead className="text-center">{t.resource}</TableHead>
                <TableHead className="text-center">{t.region}</TableHead>
                <TableHead className="text-center">{t.pricingSku}</TableHead>
                <TableHead className="text-center">{t.orderType}</TableHead>
                <TableHead className="text-center">{t.status}</TableHead>
                <TableHead className="text-center">{t.quantity}</TableHead>
                <TableHead className="text-center">{t.amount}</TableHead>
                <TableHead className="text-center">{t.accountBreakdown}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <LoaderCircleIcon className="mx-auto mb-2 size-5 animate-spin" />
                    {t.loadingUsage}
                  </TableCell>
                </TableRow>
              ) : orders.length ? (
                orders.map((item, index) => (
                  <TableRow
                    key={String(
                      getValue(item, ["OrderId", "OrderNo", "ResourceId"]) ??
                        index
                    )}
                  >
                    <TableCell className="text-center">
                      {formatOrderTime(
                        getValue(item, [
                          "CreateTime",
                          "OrderTime",
                          "PaidTime",
                          "StartTime",
                        ]),
                        locale
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-block max-w-56 truncate align-bottom">
                        {formatValue(
                          getValue(item, ["ResourceName", "ResourceId", "Name"])
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {formatValue(getValue(item, ["RegionDisplay", "Region"]))}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-block max-w-56 truncate align-bottom">
                        {formatValue(
                          getValue(item, ["PricingSKU", "PricingSkuId", "SKU"])
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {formatValue(getValue(item, ["OrderTypeDisplay", "OrderType"]))}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {formatValue(getValue(item, ["StatusDisplay", "Status"]))}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {formatValue(
                        getValue(item, [
                          "QuantityDisplay",
                          "Quantity",
                          "SumQuantityDisplay",
                          "SumQuantity",
                        ])
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {formatAmountWithUnit(
                        getValue(item, [
                          "OrderPrice",
                          "OrderTotalPrice",
                          "TotalPrice",
                          "Amount",
                          "SumOrderPrice",
                        ]) as string | number | undefined,
                        locale,
                        t.yuan
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <AccountBreakdown
                        title={t.accountBreakdown}
                        rows={accountRowsFromOrder(item, t)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t.noUsageData}
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
          {t.pageIndicator(page, totalCount ? Math.ceil(totalCount / pageSize) : 0)}
        </span>
        <Button
          variant="outline"
          disabled={isLoading || offset + orders.length >= totalCount}
          onClick={() => setOffset((value) => value + pageSize)}
        >
          {t.next}
        </Button>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
