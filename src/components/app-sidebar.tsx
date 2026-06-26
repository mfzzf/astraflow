"use client"

import Image from "next/image"
import {
  KeyRoundIcon,
  LogOutIcon,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useI18n()

  async function logOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
    })
    window.location.href = "/login"
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="px-0 pt-1 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-16 justify-start overflow-hidden data-[slot=sidebar-menu-button]:px-0! data-[slot=sidebar-menu-button]:py-0!"
              render={<a href="/dashboard" />}
            >
              <Image
                src="https://astraflow.ucloud.cn/static/logo-lg-zh.png"
                alt="Astraflow"
                width={260}
                height={64}
                unoptimized
                className="h-14 w-[260px] max-w-none -translate-x-4 object-contain object-left"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive tooltip={t.apiKeys}>
              <KeyRoundIcon />
              <span>{t.apiKeys}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
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
