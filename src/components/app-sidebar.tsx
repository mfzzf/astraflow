"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import {
  ChartAreaIcon,
  KeyRoundIcon,
  LogOutIcon,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type UserInfo = {
  UserEmail?: string
  UserName?: string
  CompanyName?: string
}

type UserInfoResponse = {
  ok: boolean
  message?: string
  data?: UserInfo | null
}

export type DashboardView = "dashboard" | "api-keys"

function displayNameForUser(user: UserInfo | null, locale: string) {
  if (locale === "zh") {
    return user?.CompanyName || user?.UserName || user?.UserEmail || ""
  }

  return user?.UserName || user?.CompanyName || user?.UserEmail || ""
}

function secondaryTextForUser(user: UserInfo | null, locale: string) {
  if (!user) {
    return ""
  }

  if (user.UserEmail && user.UserEmail !== displayNameForUser(user, locale)) {
    return user.UserEmail
  }

  return user.CompanyName && user.CompanyName !== displayNameForUser(user, locale)
    ? user.CompanyName
    : ""
}

function initialsForUser(user: UserInfo | null, locale: string) {
  const source = displayNameForUser(user, locale) || "Astraflow"
  const normalized = source.includes("@") ? source.split("@")[0] : source
  const compact = normalized.replaceAll(/\s+/g, "")

  return compact.slice(0, 2).toUpperCase()
}

export function AppSidebar({
  activeView,
  onViewChange,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeView: DashboardView
  onViewChange: (view: DashboardView) => void
}) {
  const { locale, t } = useI18n()
  const [user, setUser] = useState<UserInfo | null>(null)

  const loadUser = useCallback(async () => {
    try {
      const response = await fetch("/api/user", {
        cache: "no-store",
      })
      const result = (await response.json()) as UserInfoResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (response.ok && result.ok && result.data) {
        setUser(result.data)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadUser()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadUser])

  async function logOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
    })
    window.location.href = "/login"
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="px-2 pt-2 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-12 justify-start overflow-hidden data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              <Image
                src="https://astraflow.ucloud.cn/static/logo-lg-zh.png"
                alt="Astraflow"
                width={210}
                height={48}
                unoptimized
                className="h-9 w-[210px] max-w-full object-contain object-left"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeView === "dashboard"}
              tooltip={t.dashboard}
              className="pl-4"
              onClick={() => onViewChange("dashboard")}
            >
              <ChartAreaIcon />
              <span>{t.dashboard}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeView === "api-keys"}
              tooltip={t.apiKeys}
              className="pl-4"
              onClick={() => onViewChange("api-keys")}
            >
              <KeyRoundIcon />
              <span>{t.apiKeys}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
            <Avatar size="sm">
              <AvatarFallback>{initialsForUser(user, locale)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {displayNameForUser(user, locale)}
              </span>
              {secondaryTextForUser(user, locale) ? (
                <span className="truncate text-xs text-muted-foreground">
                  {secondaryTextForUser(user, locale)}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t.logOut} onClick={() => void logOut()}>
              <LogOutIcon />
              <span>{t.logOut}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
