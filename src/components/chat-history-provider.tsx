"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { UIMessage } from "ai"

const CHAT_HISTORY_STORAGE_KEY = "astraflow_chat_history_v1"

export type ChatSession = {
  id: string
  title: string
  messages: UIMessage[]
  modelId?: string
  apiKeyId?: string
  createdAt: number
  updatedAt: number
}

type ChatHistoryContextValue = {
  sessions: ChatSession[]
  activeSessionId: string
  activeSession: ChatSession | null
  isLoaded: boolean
  createSession: () => string
  selectSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  updateActiveSessionMessages: (messages: UIMessage[]) => void
  updateActiveSessionPreferences: (preferences: {
    modelId?: string
    apiKeyId?: string
  }) => void
}

const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null)

function makeSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createEmptySession(): ChatSession {
  const now = Date.now()

  return {
    id: makeSessionId(),
    title: "",
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function isValidSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== "object") {
    return false
  }

  const session = value as Partial<ChatSession>

  return (
    typeof session.id === "string" &&
    Array.isArray(session.messages) &&
    typeof session.createdAt === "number" &&
    typeof session.updatedAt === "number"
  )
}

function readStoredSessions() {
  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown

    return Array.isArray(parsed) ? parsed.filter(isValidSession) : []
  } catch {
    return []
  }
}

function persistSessions(sessions: ChatSession[]) {
  window.localStorage.setItem(
    CHAT_HISTORY_STORAGE_KEY,
    JSON.stringify(sessions)
  )
}

export function getMessageText(message: UIMessage | undefined) {
  if (!message) {
    return ""
  }

  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}

function titleFromMessages(messages: UIMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")
  const text = getMessageText(firstUserMessage).replaceAll(/\s+/g, " ").trim()

  if (!text) {
    return ""
  }

  return text.length > 42 ? `${text.slice(0, 42)}...` : text
}

function sameMessages(left: UIMessage[], right: UIMessage[]) {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return JSON.stringify(left) === JSON.stringify(right)
}

export function ChatHistoryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState("")
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedSessions = readStoredSessions()
      const initialSessions =
        storedSessions.length > 0 ? storedSessions : [createEmptySession()]

      setSessions(initialSessions)
      setActiveSessionId(initialSessions[0]?.id ?? "")
      setIsLoaded(true)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    persistSessions(sessions)
  }, [isLoaded, sessions])

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ??
      sessions[0] ??
      null,
    [activeSessionId, sessions]
  )

  const createSession = useCallback(() => {
    const session = createEmptySession()

    setSessions((currentSessions) => [session, ...currentSessions])
    setActiveSessionId(session.id)

    return session.id
  }, [])

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
  }, [])

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((currentSessions) => {
        const nextSessions = currentSessions.filter(
          (session) => session.id !== sessionId
        )

        if (nextSessions.length > 0) {
          if (activeSessionId === sessionId) {
            setActiveSessionId(nextSessions[0].id)
          }

          return nextSessions
        }

        const replacementSession = createEmptySession()

        setActiveSessionId(replacementSession.id)

        return [replacementSession]
      })
    },
    [activeSessionId]
  )

  const updateActiveSessionMessages = useCallback(
    (messages: UIMessage[]) => {
      if (!activeSessionId) {
        return
      }

      setSessions((currentSessions) => {
        let changed = false
        const nextSessions = currentSessions.map((session) => {
          if (session.id !== activeSessionId) {
            return session
          }

          if (sameMessages(session.messages, messages)) {
            return session
          }

          changed = true

          return {
            ...session,
            title: titleFromMessages(messages),
            messages,
            updatedAt: Date.now(),
          }
        })

        return changed ? nextSessions : currentSessions
      })
    },
    [activeSessionId]
  )

  const updateActiveSessionPreferences = useCallback(
    (preferences: { modelId?: string; apiKeyId?: string }) => {
      if (!activeSessionId) {
        return
      }

      setSessions((currentSessions) => {
        let changed = false
        const nextSessions = currentSessions.map((session) => {
          if (session.id !== activeSessionId) {
            return session
          }

          if (
            session.modelId === preferences.modelId &&
            session.apiKeyId === preferences.apiKeyId
          ) {
            return session
          }

          changed = true

          return {
            ...session,
            ...preferences,
            updatedAt: Date.now(),
          }
        })

        return changed ? nextSessions : currentSessions
      })
    },
    [activeSessionId]
  )

  const value = useMemo<ChatHistoryContextValue>(
    () => ({
      sessions,
      activeSessionId: activeSession?.id ?? "",
      activeSession,
      isLoaded,
      createSession,
      selectSession,
      deleteSession,
      updateActiveSessionMessages,
      updateActiveSessionPreferences,
    }),
    [
      activeSession,
      createSession,
      deleteSession,
      isLoaded,
      selectSession,
      sessions,
      updateActiveSessionMessages,
      updateActiveSessionPreferences,
    ]
  )

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  )
}

export function useChatHistory() {
  const context = useContext(ChatHistoryContext)

  if (!context) {
    throw new Error("useChatHistory must be used within ChatHistoryProvider.")
  }

  return context
}
