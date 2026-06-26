"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { APIKeysDashboard } from "@/components/api-keys-dashboard"
import { AppSidebar, type DashboardView } from "@/components/app-sidebar"
import { CostDashboard } from "@/components/cost-dashboard"
import { useI18n } from "@/components/i18n-provider"
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

export function DashboardShell({
  initialProjectId,
}: {
  initialProjectId: string
}) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useState<DashboardView>("dashboard")
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
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        variant="inset"
      />
      <SidebarInset>
        <SiteHeader
          title={activeView === "dashboard" ? t.dashboard : t.apiKeys}
          isLoadingProjects={isLoadingProjects}
          projectError={projectError}
          projects={projectsForSelect}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
        />
        {activeView === "dashboard" ? (
          <CostDashboard projectId={selectedProjectId} />
        ) : (
          <APIKeysDashboard projectId={selectedProjectId} />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
