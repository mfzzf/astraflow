import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardShell } from "@/components/dashboard-shell"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getCredentialSession } from "@/lib/session"

export default async function Page() {
  const session = await getCredentialSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <DashboardShell initialProjectId={session.projectId} />
      </SidebarInset>
    </SidebarProvider>
  )
}
