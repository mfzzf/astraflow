"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BoxesIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  InfoIcon,
  LoaderCircleIcon,
  PackageIcon,
  RefreshCwIcon,
  SearchIcon,
  TagsIcon,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"

type SkillMarketSkill = {
  Slug?: string
  Version?: string
  Name?: string
  Author?: string
  Desc?: string
  DescZh?: string
  Category?: string
  Downloads?: number
  FileCount?: number
  SizeBytes?: number
  ArchiveUrl?: string
  UpStreamUrl?: string
  UpStreamUpdatedAt?: number
  FilesJson?: string
  SkillMdUrl?: string
  UpStream?: string
  Latest?: boolean
}

type SkillLabResponse = {
  ok: boolean
  message?: string
  data?: SkillMarketSkill[]
  totalCount?: number
  categories?: string[]
}

type SkillLabDetailResponse = {
  ok: boolean
  message?: string
  data?: SkillMarketSkill | null
  skillMd?: string
}

type SkillFileEntry = {
  path?: string
  sha256?: string
  size?: number
}

type SkillFilesManifest = {
  count?: number
  files?: SkillFileEntry[]
  version?: string
}

const PAGE_SIZE_ITEMS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
]

const CATEGORY_LABELS_ZH: Record<string, string> = {
  "ai-agent": "AI Agent",
  "business-ops": "业务运营",
  "content-creation": "内容创作",
  "data-analysis": "数据分析",
  "design-media": "设计与媒体",
  "dev-programming": "开发编程",
  education: "教育",
  "it-ops-security": "IT 运维安全",
  "knowledge-management": "知识管理",
  "life-service": "生活服务",
  "office-efficiency": "办公效率",
  professional: "专业服务",
  uncategorized: "未分类",
}

function localeTag(locale: string) {
  return locale === "zh" ? "zh-CN" : "en-US"
}

function formatNumber(value: number | undefined, locale: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-"
  }

  return new Intl.NumberFormat(localeTag(locale), {
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatBytes(value: number | undefined, locale: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "-"
  }

  const units = ["B", "KB", "MB", "GB"]
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: size >= 10 || unitIndex === 0 ? 0 : 1,
  }).format(size)} ${units[unitIndex]}`
}

function formatTimestamp(
  value: number | undefined,
  locale: string,
  fallback: string
) {
  if (!value) {
    return fallback
  }

  const timestamp = value > 10_000_000_000 ? value : value * 1000

  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
  }).format(new Date(timestamp))
}

function formatCategory(category: string | undefined, locale: string) {
  if (!category) {
    return "-"
  }

  if (locale === "zh" && CATEGORY_LABELS_ZH[category]) {
    return CATEGORY_LABELS_ZH[category]
  }

  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function getSkillDescription(
  skill: SkillMarketSkill,
  locale: string,
  fallback: string
) {
  if (locale === "zh") {
    return skill.DescZh || skill.Desc || fallback
  }

  return skill.Desc || skill.DescZh || fallback
}

function skillKey(skill: SkillMarketSkill, index: number) {
  return [skill.Slug, skill.Version, skill.Name, index].filter(Boolean).join(":")
}

function getSkillDownloadHref(skill: SkillMarketSkill, projectId: string) {
  if (!skill.Slug || !skill.Version) {
    return skill.ArchiveUrl
  }

  const params = new URLSearchParams({
    projectId,
    slug: skill.Slug,
    version: skill.Version,
  })

  return `/api/skill-lab/download?${params.toString()}`
}

function parseSkillFiles(filesJson: string | undefined): SkillFileEntry[] {
  if (!filesJson) {
    return []
  }

  try {
    const manifest = JSON.parse(filesJson) as SkillFilesManifest

    return Array.isArray(manifest.files) ? manifest.files : []
  } catch {
    return []
  }
}

function SkillIcon({ skill }: { skill: SkillMarketSkill }) {
  const initials = (skill.Name || skill.Slug || "SL")
    .split(/\s+|-/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-xs font-semibold text-muted-foreground">
      {initials || <BoxesIcon />}
    </span>
  )
}

function SkillStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </div>
  )
}

function SkillLinkButton({
  href,
  label,
  icon,
  download,
}: {
  href?: string
  label: string
  icon: React.ReactNode
  download?: boolean
}) {
  if (!href) {
    return null
  }

  return (
    <Button
      variant="outline"
      size="sm"
      render={
        <a
          href={href}
          target={download ? undefined : "_blank"}
          rel={download ? undefined : "noreferrer"}
          download={download ? "" : undefined}
        />
      }
    >
      {icon}
      {label}
    </Button>
  )
}

function SkillCard({
  skill,
  projectId,
  locale,
  t,
  onShowDetails,
}: {
  skill: SkillMarketSkill
  projectId: string
  locale: string
  t: ReturnType<typeof useI18n>["t"]
  onShowDetails: (skill: SkillMarketSkill) => void
}) {
  return (
    <Card size="sm" className="shrink-0 rounded-lg">
      <CardHeader className="gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="flex min-w-0 gap-3">
          <SkillIcon skill={skill} />
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {skill.Name || skill.Slug || "Skill"}
            </CardTitle>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">{skill.Author || "-"}</span>
              {skill.Version ? <span>v{skill.Version}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 sm:justify-end">
          {skill.Latest ? (
            <Badge variant="secondary">{t.latest}</Badge>
          ) : null}
          {skill.Category ? (
            <Badge variant="outline">{formatCategory(skill.Category, locale)}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {getSkillDescription(skill, locale, t.noSkillDescription)}
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <SkillStat
            icon={<DownloadIcon />}
            label={t.downloads}
            value={formatNumber(skill.Downloads, locale)}
          />
          <SkillStat
            icon={<FileTextIcon />}
            label={t.files}
            value={formatNumber(skill.FileCount, locale)}
          />
          <SkillStat
            icon={<PackageIcon />}
            label={t.size}
            value={formatBytes(skill.SizeBytes, locale)}
          />
          <SkillStat
            icon={<RefreshCwIcon />}
            label={t.updated}
            value={formatTimestamp(skill.UpStreamUpdatedAt, locale, t.none)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {skill.UpStream ? (
            <Badge variant="outline" className="h-7">
              {skill.UpStream}
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onShowDetails(skill)}
          >
            <InfoIcon data-icon="inline-start" />
            {t.details}
          </Button>
          <SkillLinkButton
            href={skill.UpStreamUrl}
            label={t.openUpstream}
            icon={<ExternalLinkIcon data-icon="inline-start" />}
          />
          <SkillLinkButton
            href={skill.SkillMdUrl}
            label={t.skillMd}
            icon={<FileTextIcon data-icon="inline-start" />}
          />
          <SkillLinkButton
            href={getSkillDownloadHref(skill, projectId)}
            label={t.downloadArchive}
            icon={<DownloadIcon data-icon="inline-start" />}
            download
          />
        </div>
      </CardContent>
    </Card>
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0 break-words font-medium">{value}</div>
    </div>
  )
}

function SkillDetailSheet({
  open,
  onOpenChange,
  projectId,
  selectedSkill,
  detailSkill,
  skillMd,
  isLoading,
  error,
  locale,
  t,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  selectedSkill: SkillMarketSkill | null
  detailSkill: SkillMarketSkill | null
  skillMd: string
  isLoading: boolean
  error: string | null
  locale: string
  t: ReturnType<typeof useI18n>["t"]
}) {
  const skill = detailSkill ?? selectedSkill
  const files = parseSkillFiles(skill?.FilesJson)
  const description = skill
    ? getSkillDescription(skill, locale, t.noSkillDescription)
    : t.noSkillDescription

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(100vw,52rem)] gap-0 p-0 data-[side=right]:sm:max-w-3xl"
      >
        <SheetHeader className="border-b p-4 pr-12">
          <div className="flex min-w-0 items-start gap-3">
            {skill ? <SkillIcon skill={skill} /> : null}
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {skill?.Name || skill?.Slug || t.skillDetails}
              </SheetTitle>
              <SheetDescription className="mt-1 line-clamp-2">
                {description}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : skill ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-2">
                {skill.Latest ? (
                  <Badge variant="secondary">{t.latest}</Badge>
                ) : null}
                {skill.Category ? (
                  <Badge variant="outline">
                    {formatCategory(skill.Category, locale)}
                  </Badge>
                ) : null}
                {skill.UpStream ? (
                  <Badge variant="outline">{skill.UpStream}</Badge>
                ) : null}
                <SkillLinkButton
                  href={getSkillDownloadHref(skill, projectId)}
                  label={t.downloadArchive}
                  icon={<DownloadIcon data-icon="inline-start" />}
                  download
                />
                <SkillLinkButton
                  href={skill.UpStreamUrl}
                  label={t.openUpstream}
                  icon={<ExternalLinkIcon data-icon="inline-start" />}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label={t.slug} value={skill.Slug || "-"} />
                <DetailField label={t.version} value={skill.Version || "-"} />
                <DetailField label={t.author} value={skill.Author || "-"} />
                <DetailField
                  label={t.category}
                  value={formatCategory(skill.Category, locale)}
                />
                <DetailField
                  label={t.downloads}
                  value={formatNumber(skill.Downloads, locale)}
                />
                <DetailField
                  label={t.files}
                  value={formatNumber(skill.FileCount, locale)}
                />
                <DetailField
                  label={t.size}
                  value={formatBytes(skill.SizeBytes, locale)}
                />
                <DetailField
                  label={t.updated}
                  value={formatTimestamp(
                    skill.UpStreamUpdatedAt,
                    locale,
                    t.none
                  )}
                />
              </div>

              <section className="grid gap-2">
                <div className="text-sm font-medium">{t.skillFiles}</div>
                {files.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border">
                    {files.map((file, index) => (
                      <div
                        key={[file.path, file.sha256, index]
                          .filter(Boolean)
                          .join(":")}
                        className="grid gap-2 border-b p-3 text-sm last:border-b-0 md:grid-cols-[minmax(0,1fr)_7rem]"
                      >
                        <div className="min-w-0">
                          <div className="break-all font-mono text-xs">
                            {file.path || "-"}
                          </div>
                          {file.sha256 ? (
                            <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                              {t.sha256}: {file.sha256}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground md:text-right">
                          {formatBytes(file.size, locale)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card size="sm" className="rounded-lg">
                    <CardContent className="py-6 text-center text-muted-foreground">
                      {t.none}
                    </CardContent>
                  </Card>
                )}
              </section>

              <section className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{t.skillMarkdown}</div>
                  <SkillLinkButton
                    href={skill.SkillMdUrl}
                    label={t.skillMd}
                    icon={<FileTextIcon data-icon="inline-start" />}
                  />
                </div>
                <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-5 text-foreground">
                  {skillMd || t.none}
                </pre>
              </section>
            </div>
          ) : (
            <Card size="sm" className="rounded-lg">
              <CardContent className="py-8 text-center text-muted-foreground">
                {t.noSkillsFound}
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SkillSkeleton() {
  return (
    <Card size="sm" className="shrink-0 rounded-lg">
      <CardHeader className="gap-3">
        <div className="flex gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  )
}

export function SkillLabPage({ projectId }: { projectId: string }) {
  const { locale, t } = useI18n()
  const [searchQuery, setSearchQuery] = useState("")
  const [keyword, setKeyword] = useState("")
  const [category, setCategory] = useState("all")
  const [pageSize, setPageSize] = useState(10)
  const [offset, setOffset] = useState(0)
  const [skills, setSkills] = useState<SkillMarketSkill[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillMarketSkill | null>(
    null
  )
  const [detailSkill, setDetailSkill] = useState<SkillMarketSkill | null>(null)
  const [skillMd, setSkillMd] = useState("")
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const pageStart = totalCount ? offset + 1 : 0
  const pageEnd = Math.min(offset + skills.length, totalCount)

  const categoryItems = useMemo(
    () => [
      { value: "all", label: t.allCategories },
      ...categories.map((item) => ({
        value: item,
        label: formatCategory(item, locale),
      })),
    ],
    [categories, locale, t.allCategories]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setKeyword(searchQuery.trim())
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOffset(0)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [category, keyword, pageSize, projectId])

  const loadSkills = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        projectId,
        orderBy: "popular",
        offset: String(offset),
        limit: String(pageSize),
      })

      if (keyword) {
        params.set("keyword", keyword)
      }

      if (category !== "all") {
        params.set("category", category)
      }

      const response = await fetch(`/api/skill-lab?${params.toString()}`, {
        cache: "no-store",
      })
      const result = (await response.json()) as SkillLabResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok || !Array.isArray(result.data)) {
        setError(result.message || t.requestFailed)
        setSkills([])
        setTotalCount(0)
        return
      }

      setSkills(result.data)
      setTotalCount(result.totalCount ?? result.data.length)
      if (result.categories?.length) {
        setCategories(result.categories)
      }
    } catch {
      setError(t.requestFailed)
      setSkills([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [
    category,
    keyword,
    offset,
    pageSize,
    projectId,
    t.requestFailed,
  ])

  const loadSkillDetail = useCallback(
    async (skill: SkillMarketSkill) => {
      setSelectedSkill(skill)
      setDetailSkill(null)
      setSkillMd("")
      setDetailError(null)
      setIsDetailOpen(true)

      if (!skill.Slug || !skill.Version) {
        setDetailError(t.requestFailed)
        return
      }

      setIsLoadingDetail(true)

      try {
        const params = new URLSearchParams({
          projectId,
          slug: skill.Slug,
          version: skill.Version,
        })
        const response = await fetch(
          `/api/skill-lab/detail?${params.toString()}`,
          {
            cache: "no-store",
          }
        )
        const result = (await response.json()) as SkillLabDetailResponse

        if (response.status === 401) {
          window.location.href = "/login"
          return
        }

        if (!response.ok || !result.ok) {
          setDetailError(result.message || t.requestFailed)
          return
        }

        setDetailSkill(result.data ?? skill)
        setSkillMd(result.skillMd ?? "")
      } catch {
        setDetailError(t.requestFailed)
      } finally {
        setIsLoadingDetail(false)
      }
    },
    [projectId, t.requestFailed]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSkills()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadSkills, refreshToken])

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 sm:w-[320px]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-8"
            placeholder={t.searchSkills}
          />
        </div>
        <Select
          items={categoryItems}
          value={category}
          onValueChange={(value) => setCategory(String(value))}
        >
          <SelectTrigger aria-label={t.allCategories} className="w-full sm:w-[18ch]">
            <TagsIcon />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              {categoryItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
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
          <SelectTrigger aria-label={t.pageSize} className="w-full sm:w-[9ch]">
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
        <div className="flex items-center gap-2 xl:ml-auto">
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            {t.skillsSummary(skills.length, totalCount)}
          </span>
          <Button
            variant="outline"
            size="sm"
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
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
        <div className="grid min-w-0 gap-3 pb-1 xl:grid-cols-2">
          {isLoading ? (
            <>
              <SkillSkeleton />
              <SkillSkeleton />
              <SkillSkeleton />
              <SkillSkeleton />
            </>
          ) : skills.length > 0 ? (
            skills.map((skill, index) => (
              <SkillCard
                key={skillKey(skill, index)}
                skill={skill}
                projectId={projectId}
                locale={locale}
                t={t}
                onShowDetails={(nextSkill) => void loadSkillDetail(nextSkill)}
              />
            ))
          ) : (
            <Card size="sm" className="shrink-0 rounded-lg xl:col-span-2">
              <CardContent className="py-8 text-center text-muted-foreground">
                {t.noSkillsFound}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button
          variant="outline"
          disabled={isLoading || offset <= 0}
          onClick={() => setOffset((value) => Math.max(value - pageSize, 0))}
        >
          {t.previous}
        </Button>
        <span className="min-w-28 text-center text-sm text-muted-foreground">
          {t.logsSummary(pageStart, pageEnd, totalCount)}
        </span>
        <Button
          variant="outline"
          disabled={isLoading || offset + skills.length >= totalCount}
          onClick={() => setOffset((value) => value + pageSize)}
        >
          {t.next}
        </Button>
      </div>

      <SkillDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        projectId={projectId}
        selectedSkill={selectedSkill}
        detailSkill={detailSkill}
        skillMd={skillMd}
        isLoading={isLoadingDetail}
        error={detailError}
        locale={locale}
        t={t}
      />
    </main>
  )
}
