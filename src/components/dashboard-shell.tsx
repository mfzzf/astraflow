"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { APIKeysDashboard } from "@/components/api-keys-dashboard"
import { AppSidebar, type DashboardView } from "@/components/app-sidebar"
import { ChatHistoryProvider } from "@/components/chat-history-provider"
import { ChatPage } from "@/components/chat-page"
import { CostDashboard } from "@/components/cost-dashboard"
import { useI18n } from "@/components/i18n-provider"
import { ModelSquarePage } from "@/components/model-square-page"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

type Project = {
  ProjectID?: string
  ProjectName?: string
  UserCount?: number
  CreatedAt?: number
}

type ProjectsResponse = {
  ok: boolean
  message?: string
  data?: Project[]
  totalCount?: number
}

function normalizeProject(projectId: string): Project {
  return {
    ProjectID: projectId,
    ProjectName: projectId,
  }
}

function titleForView(view: DashboardView, t: ReturnType<typeof useI18n>["t"]) {
  if (view === "api-keys") {
    return t.apiKeys
  }

  if (view === "model-square") {
    return t.modelSquare
  }

  if (view === "chat") {
    return t.chat
  }

  return t.dashboard
}

export function DashboardShell({
  initialProjectId,
  activeView,
}: {
  initialProjectId: string
  activeView: DashboardView
}) {
  const { t } = useI18n()
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId)
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true)
    setProjectError(null)

    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      })
      const result = (await response.json()) as ProjectsResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok || !Array.isArray(result.data)) {
        setProjectError(result.message || t.requestFailed)
        setProjects([normalizeProject(initialProjectId)])
        return
      }

      setProjects(result.data)
    } catch {
      setProjectError(t.requestFailed)
      setProjects([normalizeProject(initialProjectId)])
    } finally {
      setIsLoadingProjects(false)
    }
  }, [initialProjectId, t.requestFailed])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProjects()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadProjects])

  const projectsForSelect = useMemo(() => {
    const hasSelectedProject = projects.some(
      (project) => project.ProjectID === selectedProjectId
    )

    if (hasSelectedProject) {
      return projects
    }

    return [normalizeProject(selectedProjectId), ...projects]
  }, [projects, selectedProjectId])

  return (
    <ChatHistoryProvider>
      <SidebarProvider
        className="h-svh min-h-0 overflow-hidden"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          activeView={activeView}
          variant="inset"
        />
        <SidebarInset className="min-h-0 overflow-hidden">
          <SiteHeader
            title={titleForView(activeView, t)}
            isLoadingProjects={isLoadingProjects}
            projectError={projectError}
            projects={projectsForSelect}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
          />
          <div
            className={
              activeView === "chat" || activeView === "model-square"
                ? "flex min-h-0 flex-1 overflow-hidden"
                : "min-h-0 flex-1 overflow-y-auto"
            }
          >
            {activeView === "dashboard" ? (
              <CostDashboard projectId={selectedProjectId} />
            ) : activeView === "api-keys" ? (
              <APIKeysDashboard projectId={selectedProjectId} />
            ) : activeView === "model-square" ? (
              <ModelSquarePage projectId={selectedProjectId} />
            ) : (
              <ChatPage projectId={selectedProjectId} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ChatHistoryProvider>
  )
}
