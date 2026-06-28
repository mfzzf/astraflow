import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page"

import { ModelverseDocsIndex } from "@/components/modelverse-docs/modelverse-docs-index"
import { OpenAPIPage } from "@/components/modelverse-docs/openapi-page"
import { getModelverseDocsSource } from "@/lib/modelverse-docs"

type ModelverseDocsPageProps = {
  params: Promise<{
    slug?: string[]
  }>
}

export async function generateStaticParams() {
  const source = await getModelverseDocsSource()

  return source.generateParams("slug").map((params) => ({
    slug: params.slug,
  }))
}

export async function generateMetadata({
  params,
}: ModelverseDocsPageProps): Promise<Metadata> {
  const { slug } = await params
  const source = await getModelverseDocsSource()
  const page = source.getPage(slug)

  if (!page) {
    return {
      title: "Modelverse API Docs",
    }
  }

  return {
    title: `${page.data.title} - Modelverse API Docs`,
    description: page.data.description,
  }
}

function findFirstNestedPage(
  pages: ReturnType<Awaited<ReturnType<typeof getModelverseDocsSource>>["getPages"]>,
  slug: string[]
) {
  return pages.find((page) =>
    slug.every((segment, index) => page.slugs[index] === segment)
  )
}

export default async function ModelverseDocsPage({
  params,
}: ModelverseDocsPageProps) {
  const { slug } = await params
  const source = await getModelverseDocsSource()
  const page = source.getPage(slug)

  if (!page) {
    if (!slug?.length) {
      return <ModelverseDocsIndex pages={source.getPages()} />
    }

    const nestedPage = findFirstNestedPage(source.getPages(), slug)

    if (nestedPage) {
      redirect(nestedPage.url)
    }

    notFound()
  }

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <OpenAPIPage {...page.data.getOpenAPIPageProps()} />
      </DocsBody>
    </DocsPage>
  )
}
