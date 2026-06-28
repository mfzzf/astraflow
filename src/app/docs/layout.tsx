import type { CSSProperties, ReactNode } from "react"
import { redirect } from "next/navigation"
import { DocsLayout } from "fumadocs-ui/layouts/docs"
import { RootProvider } from "fumadocs-ui/provider/next"

import { getModelverseDocsSource } from "@/lib/modelverse-docs"
import { getCredentialSession } from "@/lib/session"

export default async function ModelverseDocsLayout({
  children,
}: {
  children: ReactNode
}) {
  const [session, source] = await Promise.all([
    getCredentialSession(),
    getModelverseDocsSource(),
  ])

  if (!session) {
    redirect("/login")
  }

  return (
    <RootProvider
      search={{ enabled: false }}
      theme={{ enabled: false }}
    >
      <div className="min-h-svh bg-fd-background text-fd-foreground">
        <DocsLayout
          tree={source.pageTree}
          nav={{
            title: "Modelverse API",
            url: "/docs",
          }}
          searchToggle={{
            enabled: false,
          }}
          themeSwitch={{
            enabled: false,
          }}
          sidebar={{
            defaultOpenLevel: 1,
          }}
          containerProps={{
            style: {
              "--fd-docs-height": "100svh",
            } as CSSProperties,
          }}
        >
          {children}
        </DocsLayout>
      </div>
    </RootProvider>
  )
}
