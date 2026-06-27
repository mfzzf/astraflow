"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"

import { getMessageText, useChatHistory } from "@/components/chat-history-provider"
import { useI18n } from "@/components/i18n-provider"
import { Input } from "@/components/ui/input"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

function sessionPreview(messages: ReturnType<typeof useChatHistory>["sessions"][number]["messages"]) {
  const lastMessage = messages.at(-1)
  const text = getMessageText(lastMessage).replaceAll(/\s+/g, " ").trim()

  return text
}

export function ChatHistorySidebar() {
  const { t } = useI18n()
  const {
    sessions,
    activeSessionId,
    createSession,
    deleteSession,
    selectSession,
  } = useChatHistory()
  const [keyword, setKeyword] = useState("")
  const filteredSessions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return sessions
    }

    return sessions.filter((session) => {
      const title = session.title || t.newChat
      const preview = sessionPreview(session.messages)

      return `${title} ${preview}`.toLowerCase().includes(normalizedKeyword)
    })
  }, [keyword, sessions, t.newChat])

  return (
    <>
      <SidebarGroup className="px-2 pt-2">
        <SidebarGroupContent className="flex flex-col gap-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-9 gap-2 rounded-lg px-2 text-sm font-medium"
                onClick={createSession}
              >
                <PlusIcon />
                <span>{t.newChat}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <label className="relative flex h-9 items-center rounded-lg px-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
            <SearchIcon className="mr-2 size-4 shrink-0" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t.searchChats}
              className="h-auto flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </label>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="min-h-0 flex-1 px-2 pt-3">
        <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">
          {t.recent}
        </div>
        <SidebarGroupContent className="min-h-0 overflow-y-auto pr-1">
          {filteredSessions.length > 0 ? (
            <SidebarMenu className="gap-0.5">
              {filteredSessions.map((session) => {
                const title = session.title || t.newChat

                return (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      isActive={session.id === activeSessionId}
                      className={cn(
                        "h-8 rounded-lg px-2 pr-8 text-sm font-normal",
                        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                      )}
                      onClick={() => selectSession(session.id)}
                    >
                      <span className="truncate">{title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      type="button"
                      aria-label={t.deleteChat}
                      showOnHover
                      className="top-1 right-1 size-6 rounded-md"
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteSession(session.id)
                      }}
                    >
                      <Trash2Icon />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          ) : (
            <div className="px-2 py-4 text-sm text-muted-foreground">
              {t.noChatHistory}
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="mt-auto px-2 pb-2 pt-1">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-9 gap-2 rounded-lg px-2 text-sm font-normal text-muted-foreground"
                render={<Link href="/overview" />}
              >
                <ArrowLeftIcon />
                <span>{t.back}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
