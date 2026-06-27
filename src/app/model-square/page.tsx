import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard-shell"
import { getCredentialSession } from "@/lib/session"

export default async function Page() {
  const session = await getCredentialSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <DashboardShell
      initialProjectId={session.projectId}
      activeView="model-square"
    />
  )
}
