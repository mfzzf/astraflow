import Link from "next/link"
import { BookOpenTextIcon, FileTextIcon } from "lucide-react"
import { DocsPage } from "fumadocs-ui/page"

import type { getModelverseDocsSource } from "@/lib/modelverse-docs"

type DocsSource = Awaited<ReturnType<typeof getModelverseDocsSource>>
type DocsPageItem = ReturnType<DocsSource["getPages"]>[number]

type ModelverseDocsIndexProps = {
  pages: DocsPageItem[]
}

const LANGUAGE_LABELS: Record<string, string> = {
  chinese: "中文",
  english: "English",
}

const CATEGORY_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  audio: "Audio",
  chat: "Chat",
  common: "Common",
  gemini: "Gemini",
  image: "Image",
  responses: "Responses",
  video: "Video",
}

function countBySegment(pages: DocsPageItem[], segmentIndex: number) {
  const counts = new Map<string, number>()

  for (const page of pages) {
    const segment = page.slugs[segmentIndex]

    if (!segment) {
      continue
    }

    counts.set(segment, (counts.get(segment) || 0) + 1)
  }

  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function firstPageForCategory(pages: DocsPageItem[], language: string, category: string) {
  return pages.find(
    (page) => page.slugs[1] === language && page.slugs[2] === category
  )
}

export function ModelverseDocsIndex({ pages }: ModelverseDocsIndexProps) {
  const languageCounts = countBySegment(pages, 1)
  const categoryCounts = countBySegment(
    pages.filter((page) => page.slugs[1] === "chinese"),
    2
  )
  const featured = [
    firstPageForCategory(pages, "chinese", "chat"),
    firstPageForCategory(pages, "chinese", "image"),
    firstPageForCategory(pages, "chinese", "video"),
    firstPageForCategory(pages, "chinese", "audio"),
  ].filter((page): page is DocsPageItem => Boolean(page))

  return (
    <DocsPage
      breadcrumb={{ enabled: false }}
      footer={{ enabled: false }}
      tableOfContent={{ enabled: false }}
      tableOfContentPopover={{ enabled: false }}
    >
      <div className="flex flex-col gap-8 px-1 py-4 text-sm">
        <section className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpenTextIcon className="size-4" />
            <span>Modelverse API Protocol</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            OpenAPI Reference
          </h1>
          <p className="text-muted-foreground">
            Generated from the local OpenAPI protocol files under
            <span className="font-mono"> openapi/modelverse-api-protocol-docs/openapi</span>.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-card p-4">
            <div className="text-2xl font-semibold">{pages.length}</div>
            <div className="text-muted-foreground">REST operations</div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <div className="text-2xl font-semibold">{languageCounts.length}</div>
            <div className="text-muted-foreground">Languages</div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <div className="text-2xl font-semibold">{categoryCounts.length}</div>
            <div className="text-muted-foreground">Chinese categories</div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          {featured.map((page) => (
            <Link
              key={page.url}
              href={page.url}
              className="group rounded-md border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent"
            >
              <div className="flex items-start gap-3">
                <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                <div className="min-w-0 space-y-1">
                  <div className="truncate font-medium text-foreground">
                    {page.data.title}
                  </div>
                  {page.data.description ? (
                    <p className="line-clamp-2 text-muted-foreground">
                      {page.data.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-base font-medium">Languages</h2>
            <div className="flex flex-wrap gap-2">
              {languageCounts.map(([language, count]) => (
                <span
                  key={language}
                  className="rounded-md border px-2.5 py-1 text-muted-foreground"
                >
                  {LANGUAGE_LABELS[language] || language} · {count}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-medium">Chinese Categories</h2>
            <div className="flex flex-wrap gap-2">
              {categoryCounts.map(([category, count]) => (
                <span
                  key={category}
                  className="rounded-md border px-2.5 py-1 text-muted-foreground"
                >
                  {CATEGORY_LABELS[category] || category} · {count}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DocsPage>
  )
}
