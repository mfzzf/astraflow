"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

import { APIKeysDashboard } from "@/components/api-keys-dashboard"
import { AppSidebar, type DashboardView } from "@/components/app-sidebar"
import { ChatHistoryProvider } from "@/components/chat-history-provider"
import { ChatPage } from "@/components/chat-page"
import { CostDashboard } from "@/components/cost-dashboard"
import { GsapViewTransition } from "@/components/gsap-view-transition"
import { useI18n } from "@/components/i18n-provider"
import { ModelSquarePage } from "@/components/model-square-page"
import { RequestLogsPage } from "@/components/request-logs-page"
import { SandboxResourcesPage } from "@/components/sandbox-resources-page"
import { SiteHeader } from "@/components/site-header"
import { SkillLabPage } from "@/components/skill-lab-page"
import { UsagePage } from "@/components/usage-page"
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

  if (view === "usage") {
    return t.usage
  }

  if (view === "model-square") {
    return t.modelSquare
  }

  if (view === "skill-lab") {
    return t.skillLab
  }

  if (view === "chat") {
    return t.chat
  }

  if (view === "request-logs") {
    return t.requestLogs
  }

  if (view === "sandbox-list") {
    return t.sandboxList
  }

  if (view === "sandbox-templates") {
    return t.sandboxTemplates
  }

  return t.dashboard
}

function viewForPathname(pathname: string): DashboardView {
  if (pathname === "/usage") {
    return "usage"
  }

  if (pathname === "/api-keys") {
    return "api-keys"
  }

  if (pathname === "/model-square") {
    return "model-square"
  }

  if (pathname === "/skill-lab") {
    return "skill-lab"
  }

  if (pathname === "/chat") {
    return "chat"
  }

  if (pathname === "/request-logs") {
    return "request-logs"
  }

  if (pathname === "/sandbox") {
    return "sandbox-list"
  }

  if (pathname === "/sandbox-templates") {
    return "sandbox-templates"
  }

  return "dashboard"
}

export function DashboardShell({
  initialProjectId,
}: {
  initialProjectId: string
}) {
  const { t } = useI18n()
  const pathname = usePathname()
  const activeView = viewForPathname(pathname)
  const viewOwnsScroll =
    activeView === "chat" ||
    activeView === "model-square" ||
    activeView === "skill-lab"
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
        data-electron-titlebar-safe-area="true"
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
          <GsapViewTransition
            animateOnInitial={false}
            view={activeView}
            surfaceClassName={
              viewOwnsScroll ? "flex min-h-0 flex-1" : "min-h-full"
            }
            className={
              viewOwnsScroll
                ? "flex min-h-0 flex-1 overflow-hidden"
                : "min-h-0 flex-1 overflow-y-auto"
            }
          >
            {activeView === "dashboard" ? (
              <CostDashboard projectId={selectedProjectId} />
            ) : activeView === "usage" ? (
              <UsagePage projectId={selectedProjectId} />
            ) : activeView === "api-keys" ? (
              <APIKeysDashboard projectId={selectedProjectId} />
            ) : activeView === "model-square" ? (
              <ModelSquarePage projectId={selectedProjectId} />
            ) : activeView === "skill-lab" ? (
              <SkillLabPage projectId={selectedProjectId} />
            ) : activeView === "request-logs" ? (
              <RequestLogsPage projectId={selectedProjectId} />
            ) : activeView === "sandbox-list" ? (
              <SandboxResourcesPage
                projectId={selectedProjectId}
                mode="sandboxes"
              />
            ) : activeView === "sandbox-templates" ? (
              <SandboxResourcesPage
                projectId={selectedProjectId}
                mode="templates"
              />
            ) : (
              <ChatPage projectId={selectedProjectId} />
            )}
          </GsapViewTransition>
        </SidebarInset>
      </SidebarProvider>
    </ChatHistoryProvider>
  )
}
