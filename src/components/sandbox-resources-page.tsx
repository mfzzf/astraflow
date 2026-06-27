"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DEFAULT_SANDBOX_REGION, SANDBOX_REGIONS } from "@/lib/sandbox-regions"

type SandboxResourceMode = "sandboxes" | "templates"

type SandboxItem = {
  ID?: string
  Alias?: string
  TemplateID?: string
  CPU?: number
  MemoryMB?: number
  CreateTime?: number
  Status?: string
}

type SandboxTemplate = {
  ID?: string
  Alias?: string
  CPU?: number
  MemoryMB?: number
  Type?: string
  CreateTime?: number
  UpdateTime?: number
}

type SandboxResponse<T> = {
  ok: boolean
  message?: string
  data?: T[]
  totalCount?: number
}

const PAGE_SIZE_ITEMS = [
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
]

const sandboxRegionItems = SANDBOX_REGIONS.map((item) => ({
  value: item,
  label: item,
}))

const NO_SORT_VALUE = "none"

const sandboxOrderItems = [
  { value: "CreateTime", label: "CreateTime" },
  { value: "CPU", label: "CPU" },
  { value: "Memory", label: "Memory" },
]

const templateOrderItems = [
  ...sandboxOrderItems,
  { value: "UpdateTime", label: "UpdateTime" },
]

function localeTag(locale: string) {
  return locale === "zh" ? "zh-CN" : "en-US"
}

function formatTimestamp(value: number | undefined, locale: string) {
  if (!value) {
    return "-"
  }

  const timestamp = value > 10_000_000_000 ? value : value * 1000

  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

function formatMemory(value: number | undefined, locale: string) {
  if (!value) {
    return "-"
  }

  if (value >= 1024) {
    return `${new Intl.NumberFormat(localeTag(locale), {
      maximumFractionDigits: 1,
    }).format(value / 1024)} GB`
  }

  return `${value} MB`
}

function formatCPU(value: number | undefined) {
  return value ? `${value} vCPU` : "-"
}

function statusVariant(status: string | undefined) {
  return status === "running" ? "secondary" : "outline"
}

function rowKey(item: SandboxItem | SandboxTemplate, index: number) {
  return item.ID || `${item.Alias ?? "sandbox"}-${index}`
}

export function SandboxResourcesPage({
  projectId,
  mode,
}: {
  projectId: string
  mode: SandboxResourceMode
}) {
  const { locale, t } = useI18n()
  const [region, setRegion] = useState(DEFAULT_SANDBOX_REGION)
  const [search, setSearch] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [cpu, setCpu] = useState("")
  const [memoryMb, setMemoryMb] = useState("")
  const [order, setOrder] = useState(NO_SORT_VALUE)
  const [orderDesc, setOrderDesc] = useState("true")
  const [pageSize, setPageSize] = useState(20)
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState<(SandboxItem | SandboxTemplate)[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const isTemplates = mode === "templates"
  const endpoint = isTemplates
    ? "/api/sandbox/templates"
    : "/api/sandbox/sandboxes"
  const orderItems = isTemplates ? templateOrderItems : sandboxOrderItems
  const pageStart = totalCount ? offset + 1 : 0
  const pageEnd = Math.min(offset + items.length, totalCount)

  const filteredCountLabel = useMemo(
    () => t.resourcesSummary(items.length, totalCount),
    [items.length, t, totalCount]
  )

  const loadResources = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const searchParams = new URLSearchParams({
        projectId,
        region: region.trim(),
        offset: String(offset),
        limit: String(pageSize),
      })

      if (order !== NO_SORT_VALUE) {
        searchParams.set("order", order)
        searchParams.set("orderDesc", orderDesc)
      }

      if (search.trim()) {
        searchParams.set("search", search.trim())
      }

      if (!isTemplates) {
        if (templateId.trim()) {
          searchParams.set("templateId", templateId.trim())
        }

        if (cpu.trim()) {
          searchParams.set("cpu", cpu.trim())
        }

        if (memoryMb.trim()) {
          searchParams.set("memoryMb", memoryMb.trim())
        }
      }

      const response = await fetch(`${endpoint}?${searchParams}`, {
        cache: "no-store",
      })
      const result = (await response.json()) as SandboxResponse<
        SandboxItem | SandboxTemplate
      >

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok || !Array.isArray(result.data)) {
        setError(result.message || t.requestFailed)
        setItems([])
        setTotalCount(0)
        return
      }

      setItems(result.data)
      setTotalCount(result.totalCount ?? result.data.length)
    } catch {
      setError(t.requestFailed)
      setItems([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [
    cpu,
    endpoint,
    isTemplates,
    memoryMb,
    offset,
    order,
    orderDesc,
    pageSize,
    projectId,
    region,
    search,
    t.requestFailed,
    templateId,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOffset(0)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [
    cpu,
    memoryMb,
    order,
    orderDesc,
    pageSize,
    projectId,
    region,
    search,
    templateId,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadResources()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadResources, refreshToken])

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 lg:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={search}
            placeholder={isTemplates ? t.searchTemplates : t.searchSandboxes}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          items={sandboxRegionItems}
          value={region}
          onValueChange={(value) => setRegion(String(value))}
        >
          <SelectTrigger aria-label={t.region} className="w-full lg:w-[14ch]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              {SANDBOX_REGIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {!isTemplates ? (
          <>
            <Input
              className="min-w-0 lg:w-[18ch]"
              value={templateId}
              placeholder={t.templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            />
            <Input
              className="min-w-0 lg:w-[10ch]"
              inputMode="numeric"
              value={cpu}
              placeholder={t.cpu}
              onChange={(event) => setCpu(event.target.value)}
            />
            <Input
              className="min-w-0 lg:w-[12ch]"
              inputMode="numeric"
              value={memoryMb}
              placeholder={t.memoryMb}
              onChange={(event) => setMemoryMb(event.target.value)}
            />
          </>
        ) : null}
        <Select
          items={orderItems}
          value={order}
          onValueChange={(value) => setOrder(String(value))}
        >
          <SelectTrigger aria-label={t.orderBy} className="w-full lg:w-[16ch]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value={NO_SORT_VALUE}>{t.noSorting}</SelectItem>
              {orderItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={[
            { value: "true", label: t.descending },
            { value: "false", label: t.ascending },
          ]}
          value={orderDesc}
          onValueChange={(value) => setOrderDesc(String(value))}
          disabled={order === NO_SORT_VALUE}
        >
          <SelectTrigger
            aria-label={t.sortDirection}
            className="w-full lg:w-[12ch]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value="true">{t.descending}</SelectItem>
              <SelectItem value="false">{t.ascending}</SelectItem>
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
            {filteredCountLabel}
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

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">
                  {isTemplates ? t.templateId : t.sandboxId}
                </TableHead>
                <TableHead className="text-center">{t.alias}</TableHead>
                {!isTemplates ? (
                  <TableHead className="text-center">{t.templateId}</TableHead>
                ) : (
                  <TableHead className="text-center">{t.type}</TableHead>
                )}
                <TableHead className="text-center">{t.cpu}</TableHead>
                <TableHead className="text-center">{t.memory}</TableHead>
                <TableHead className="text-center">
                  {isTemplates ? t.updated : t.status}
                </TableHead>
                <TableHead className="text-center">{t.created}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <LoaderCircleIcon className="mx-auto mb-2 size-5 animate-spin" />
                    {t.loadingSandboxResources}
                  </TableCell>
                </TableRow>
              ) : items.length ? (
                items.map((item, index) => {
                  const sandbox = item as SandboxItem
                  const template = item as SandboxTemplate

                  return (
                    <TableRow key={rowKey(item, index)}>
                      <TableCell className="text-center">
                        <span className="inline-block max-w-56 truncate font-mono text-xs align-bottom">
                          {item.ID || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-block max-w-48 truncate align-bottom">
                          {item.Alias || "-"}
                        </span>
                      </TableCell>
                      {!isTemplates ? (
                        <TableCell className="text-center">
                          <span className="inline-block max-w-48 truncate font-mono text-xs align-bottom">
                            {sandbox.TemplateID || "-"}
                          </span>
                        </TableCell>
                      ) : (
                        <TableCell className="text-center">
                          <Badge variant="outline">{template.Type || "-"}</Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        {formatCPU(item.CPU)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatMemory(item.MemoryMB, locale)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isTemplates ? (
                          formatTimestamp(template.UpdateTime, locale)
                        ) : (
                          <Badge variant={statusVariant(sandbox.Status)}>
                            {sandbox.Status || "-"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatTimestamp(item.CreateTime, locale)}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    {search || templateId || cpu || memoryMb
                      ? t.noSandboxResults
                      : t.noSandboxResources}
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
          {t.logsSummary(pageStart, pageEnd, totalCount)}
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
