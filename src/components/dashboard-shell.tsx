"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { APIKeysDashboard } from "@/components/api-keys-dashboard"
import { SiteHeader } from "@/components/site-header"
import { useI18n } from "@/components/i18n-provider"

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
    <>
      <SiteHeader
        isLoadingProjects={isLoadingProjects}
        projectError={projectError}
        projects={projectsForSelect}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
      />
      <APIKeysDashboard projectId={selectedProjectId} />
    </>
  )
}
