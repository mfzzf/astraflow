"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  BoxesIcon,
  ChartAreaIcon,
  ChevronDownIcon,
  KeyRoundIcon,
  LogOutIcon,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type UserInfo = {
  UserId?: number
  CompanyId?: number
  UserEmail?: string
  UserPhone?: string
  PhonePrefix?: string
  UserType?: number
  UserName?: string
  DisplayName?: string
  CompanyName?: string
  Province?: string
  City?: string
  UserAddress?: string
  UserVersion?: number
  Admin?: number
  Finance?: number
  Administrator?: string
  AuthState?: string
  IsAPIToken?: number
  IsBindEmail?: boolean
  IsOpenPhoneLogin?: boolean
  SSOEnabled?: boolean
}

type UserInfoResponse = {
  ok: boolean
  message?: string
  data?: UserInfo | null
}

export type DashboardView = "dashboard" | "api-keys" | "model-square"

function displayNameForUser(user: UserInfo | null, locale: string) {
  if (locale === "zh") {
    return (
      user?.DisplayName ||
      user?.UserName ||
      user?.CompanyName ||
      user?.UserEmail ||
      ""
    )
  }

  return (
    user?.DisplayName ||
    user?.UserName ||
    user?.CompanyName ||
    user?.UserEmail ||
    ""
  )
}

function secondaryTextForUser(user: UserInfo | null) {
  if (!user) {
    return ""
  }

  if (user.CompanyName && user.CompanyId) {
    return `${user.CompanyName} · ${user.CompanyId}`
  }

  return user.CompanyName || (user.CompanyId ? String(user.CompanyId) : "")
}

function initialsForUser(user: UserInfo | null, locale: string) {
  const source = displayNameForUser(user, locale) || "Astraflow"
  const normalized = source.includes("@") ? source.split("@")[0] : source
  const compact = normalized.replaceAll(/\s+/g, "")

  return compact.slice(0, 2).toUpperCase()
}

function hasUserValue(value: unknown) {
  return value !== undefined && value !== null && value !== ""
}

function flagValue(value: number | undefined) {
  return value === undefined ? undefined : value === 1
}

function formatPhoneForUser(user: UserInfo) {
  if (!user.UserPhone) {
    return undefined
  }

  return user.PhonePrefix ? `+${user.PhonePrefix} ${user.UserPhone}` : user.UserPhone
}

function formatLocationForUser(user: UserInfo) {
  return [user.Province, user.City].filter(Boolean).join(" ")
}

export function AppSidebar({
  activeView,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeView: DashboardView
}) {
  const { locale, t } = useI18n()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false)

  function formatUserValue(value: unknown) {
    if (typeof value === "boolean") {
      return value ? t.yes : t.no
    }

    return hasUserValue(value) ? String(value) : "-"
  }

  const userSummaryRows = user
    ? [
        {
          label: t.displayName,
          value: displayNameForUser(user, locale),
        },
        {
          label: t.companyName,
          value: user.CompanyName,
        },
        {
          label: t.companyId,
          value: user.CompanyId,
        },
      ]
    : []
  const userDetailRows = user
    ? [
        { label: t.userName, value: user.UserName },
        { label: t.email, value: user.UserEmail },
        { label: t.userId, value: user.UserId },
        { label: t.phone, value: formatPhoneForUser(user) },
        { label: t.location, value: formatLocationForUser(user) },
        { label: t.address, value: user.UserAddress },
        { label: t.administrator, value: user.Administrator },
        { label: t.authState, value: user.AuthState },
        { label: t.userVersion, value: user.UserVersion },
        { label: t.admin, value: flagValue(user.Admin) },
        { label: t.finance, value: flagValue(user.Finance) },
        { label: t.apiToken, value: flagValue(user.IsAPIToken) },
        { label: t.bindEmail, value: user.IsBindEmail },
        { label: t.phoneLogin, value: user.IsOpenPhoneLogin },
        { label: "SSO", value: user.SSOEnabled },
      ].filter((row) => hasUserValue(row.value))
    : []

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
      <SidebarHeader className="px-2 pt-2 pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 justify-start overflow-hidden data-[slot=sidebar-menu-button]:p-1!"
              render={<Link href="/overview" />}
            >
              <Image
                src="https://astraflow.ucloud.cn/static/logo-lg-zh.png"
                alt="Astraflow"
                width={210}
                height={48}
                unoptimized
                className="h-8 w-[210px] max-w-full object-contain object-left"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel>{t.overview}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "dashboard"}
                  tooltip={t.dashboard}
                  render={<Link href="/overview" />}
                >
                  <ChartAreaIcon />
                  <span>{t.dashboard}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "api-keys"}
                  tooltip={t.apiKeys}
                  render={<Link href="/api-keys" />}
                >
                  <KeyRoundIcon />
                  <span>{t.apiKeys}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t.modelverse}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "model-square"}
                  tooltip={t.modelSquare}
                  render={<Link href="/model-square" />}
                >
                  <BoxesIcon />
                  <span>{t.modelSquare}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t.agentSandbox}</SidebarGroupLabel>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="h-auto py-1.5"
                      aria-label={t.userMenu}
                    />
                  }
                >
                  <Avatar size="sm">
                    <AvatarFallback>
                      {initialsForUser(user, locale)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {displayNameForUser(user, locale)}
                    </span>
                    {secondaryTextForUser(user) ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {secondaryTextForUser(user)}
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="w-64"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t.userInformation}</DropdownMenuLabel>
                    <div className="flex min-w-0 items-center gap-2 px-1.5 py-1.5">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {initialsForUser(user, locale)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {displayNameForUser(user, locale)}
                        </span>
                        {secondaryTextForUser(user) ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {secondaryTextForUser(user)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-1 px-1.5 py-1.5 text-xs">
                      {userSummaryRows.map((row) => (
                        <div
                          key={row.label}
                          className="grid grid-cols-[88px_minmax(0,1fr)] gap-2"
                        >
                          <span className="text-muted-foreground">
                            {row.label}
                          </span>
                          <span className="min-w-0 truncate text-foreground">
                            {formatUserValue(row.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                      aria-expanded={isUserDetailsOpen}
                      onClick={() =>
                        setIsUserDetailsOpen((isOpen) => !isOpen)
                      }
                    >
                      <span>{t.details}</span>
                      <ChevronDownIcon
                        className={
                          isUserDetailsOpen ? "ml-auto rotate-180" : "ml-auto"
                        }
                      />
                    </button>
                    {isUserDetailsOpen ? (
                      <div className="grid max-h-64 gap-1 overflow-auto px-1.5 py-1.5 text-xs">
                        {userDetailRows.map((row) => (
                          <div
                            key={row.label}
                            className="grid grid-cols-[88px_minmax(0,1fr)] gap-2"
                          >
                            <span className="text-muted-foreground">
                              {row.label}
                            </span>
                            <span className="min-w-0 break-words text-foreground">
                              {formatUserValue(row.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void logOut()}
                    >
                      <LogOutIcon />
                      {t.logOut}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t.logOut}
                onClick={() => void logOut()}
              >
                <LogOutIcon />
                <span>{t.logOut}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
