"use client"

import { LanguageSwitcher } from "@/components/language-switcher"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useI18n } from "@/components/i18n-provider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Project = {
  ProjectID?: string
  ProjectName?: string
}

function formatProjectName(project: Project, fallback: string) {
  return project.ProjectName || project.ProjectID || fallback
}

function hasProjectId(
  project: Project
): project is Project & { ProjectID: string } {
  return typeof project.ProjectID === "string" && project.ProjectID.length > 0
}

export function SiteHeader({
  title,
  isLoadingProjects,
  projectError,
  projects,
  selectedProjectId,
  onProjectChange,
}: {
  title: string
  isLoadingProjects: boolean
  projectError: string | null
  projects: Project[]
  selectedProjectId: string
  onProjectChange: (projectId: string) => void
}) {
  const { t } = useI18n()
  const selectableProjects = projects.filter(hasProjectId)
  const projectItems = selectableProjects.map((project) => ({
    label: formatProjectName(project, t.project),
    value: project.ProjectID,
  }))

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Select
            disabled={isLoadingProjects}
            items={projectItems}
            value={selectedProjectId}
            onValueChange={(value) => {
              if (typeof value === "string") {
                onProjectChange(value)
              }
            }}
          >
            <SelectTrigger
              aria-label={t.selectProject}
              className="w-[13ch] max-w-[36vw]"
              title={projectError ?? undefined}
            >
              <SelectValue
                placeholder={
                  isLoadingProjects ? t.loadingProjects : t.selectProject
                }
              />
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              <SelectGroup>
                {selectableProjects.map((project) => (
                  <SelectItem key={project.ProjectID} value={project.ProjectID}>
                    <span className="flex min-w-0 flex-col">
                      <span
                        className="truncate"
                        title={formatProjectName(project, t.project)}
                      >
                        {formatProjectName(project, t.project)}
                      </span>
                      <span
                        className="truncate font-mono text-xs text-muted-foreground"
                        title={project.ProjectID}
                      >
                        {project.ProjectID}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}
