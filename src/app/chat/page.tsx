import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard-shell"
import { getCredentialSession } from "@/lib/session"

export default async function ChatRoute() {
  const session = await getCredentialSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <DashboardShell
      initialProjectId={session.projectId}
      activeView="chat"
    />
  )
}
