import { redirect } from "next/navigation"

import { getCredentialSession } from "@/lib/session"

export default async function Home() {
  const session = await getCredentialSession()

  redirect(session ? "/overview" : "/login")
}
