import { NextResponse } from "next/server"

import { clearCredentialSession } from "@/lib/session"

export async function POST() {
  await clearCredentialSession()

  return NextResponse.json({
    ok: true,
  })
}
