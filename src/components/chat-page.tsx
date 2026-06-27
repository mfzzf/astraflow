"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"

import { useChatHistory } from "@/components/chat-history-provider"
import { useI18n } from "@/components/i18n-provider"
import { PlaygroundChat } from "@/components/playground/components/chat/playground-chat"
import { PlaygroundInput } from "@/components/playground/components/input/playground-input"
import { MESSAGE_STATUS } from "@/components/playground/constants"
import {
  ensurePlaygroundI18n,
  setPlaygroundLanguage,
} from "@/components/playground/i18n"
import { parseThinkTags } from "@/components/playground/lib/message/message-reasoning-utils"
import type {
  Message as PlaygroundMessage,
  ModelOption,
} from "@/components/playground/types"
import { SystemMessage } from "@/components/ui/system-message"

ensurePlaygroundI18n()

type ChatModel = {
  id: string
  name: string
  displayName: string
  vendor: string
  contextLength?: number
  icon?: string
  hot?: boolean
}

type ChatApiKey = {
  id: string
  name: string
}

type ChatOptionsResponse = {
  ok: boolean
  message?: string
  models?: ChatModel[]
  apiKeys?: ChatApiKey[]
}

type MessagePartRecord = UIMessage["parts"][number] & Record<string, unknown>

const PENDING_ASSISTANT_MESSAGE_KEY = "__astraflow_pending_assistant__"

function isGenerating(status: ReturnType<typeof useChat>["status"]) {
  return status === "submitted" || status === "streaming"
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]

  return typeof value === "string" ? value : ""
}

function getUiMessageText(message: UIMessage | undefined) {
  if (!message) {
    return ""
  }

  return (message.parts as MessagePartRecord[])
    .filter((part) => part.type === "text")
    .map((part) => readString(part, "text"))
    .join("")
}

function getUiMessageReasoning(message: UIMessage) {
  return (message.parts as MessagePartRecord[])
    .filter((part) => part.type === "reasoning")
    .map((part) => readString(part, "text"))
    .filter(Boolean)
    .join("\n\n")
}

function hasStreamingReasoningPart(message: UIMessage) {
  return (message.parts as MessagePartRecord[]).some(
    (part) =>
      part.type === "reasoning" && readString(part, "state") === "streaming"
  )
}

function replaceUiMessageText(message: UIMessage, content: string): UIMessage {
  const parts = message.parts as MessagePartRecord[]
  const hasTextPart = parts.some((part) => part.type === "text")
  const nextParts = hasTextPart
    ? parts.map((part) =>
        part.type === "text" ? { ...part, text: content } : part
      )
    : [{ type: "text", text: content }]

  return {
    ...message,
    parts: nextParts as UIMessage["parts"],
  }
}

function toPlaygroundMessages({
  messages,
  status,
}: {
  messages: UIMessage[]
  status: ReturnType<typeof useChat>["status"]
}): PlaygroundMessage[] {
  const active = isGenerating(status)
  const lastMessage = messages.at(-1)

  const playgroundMessages: PlaygroundMessage[] = messages.map((message) => {
    const rawContent = getUiMessageText(message)
    const parsedThinkTags = rawContent.includes("<think>")
      ? parseThinkTags(rawContent)
      : undefined
    const content = parsedThinkTags?.visibleContent ?? rawContent
    const reasoning =
      getUiMessageReasoning(message) || parsedThinkTags?.reasoning || ""
    const isActiveAssistant =
      active && message.role === "assistant" && message.id === lastMessage?.id
    const hasVisibleContent = content.trim().length > 0
    const isReasoningStreaming = Boolean(
      isActiveAssistant &&
        reasoning &&
        (hasStreamingReasoningPart(message) ||
          parsedThinkTags?.hasUnclosedTag ||
          !hasVisibleContent)
    )

    return {
      key: message.id,
      from: message.role,
      versions: [
        {
          id: `${message.id}-current`,
          content: rawContent,
        },
      ],
      reasoning: reasoning
        ? {
            content: reasoning,
          }
        : undefined,
      isReasoningStreaming,
      isReasoningComplete: Boolean(reasoning) && !isReasoningStreaming,
      isContentComplete: !isActiveAssistant,
      status:
        message.role === "assistant"
          ? isActiveAssistant
            ? hasVisibleContent || reasoning
              ? MESSAGE_STATUS.STREAMING
              : MESSAGE_STATUS.LOADING
            : MESSAGE_STATUS.COMPLETE
          : undefined,
    }
  })

  if (active && lastMessage?.role !== "assistant") {
    playgroundMessages.push({
      key: PENDING_ASSISTANT_MESSAGE_KEY,
      from: "assistant",
      versions: [
        {
          id: `${PENDING_ASSISTANT_MESSAGE_KEY}-current`,
          content: "",
        },
      ],
      reasoning: undefined,
      isReasoningStreaming: false,
      isReasoningComplete: false,
      isContentComplete: false,
      status: MESSAGE_STATUS.LOADING,
    })
  }

  return playgroundMessages
}

function toModelOptions(models: ChatModel[]): ModelOption[] {
  return models.map((model) => ({
    label: model.displayName || model.name || model.id,
    value: model.id,
    category: model.vendor || undefined,
    description: model.id,
  }))
}

function getMessageRole(messages: UIMessage[], key: string) {
  return messages.find((message) => message.id === key)?.role
}

export function ChatPage({ projectId }: { projectId: string }) {
  const { locale, t } = useI18n()
  const {
    activeSession,
    activeSessionId,
    isLoaded,
    updateActiveSessionMessages,
    updateActiveSessionPreferences,
  } = useChatHistory()
  const [models, setModels] = useState<ChatModel[]>([])
  const [apiKeys, setApiKeys] = useState<ChatApiKey[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState("")
  const [requestError, setRequestError] = useState("")
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(
    null
  )
  const hydratedSessionIdRef = useRef("")
  const isHydratingSessionRef = useRef(false)
  const transport = useMemo(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/chat" }),
    []
  )
  const {
    messages,
    setMessages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
    clearError,
  } = useChat<UIMessage>({
    id: activeSessionId || "chat",
    messages: activeSession?.messages ?? [],
    transport,
    onError(chatError) {
      setRequestError(chatError.message || t.chatRequestFailed)
    },
  })
  const selectedModelId = activeSession?.modelId ?? models[0]?.id ?? ""
  const selectedApiKeyId = activeSession?.apiKeyId ?? apiKeys[0]?.id ?? ""
  const isGeneratingResponse = isGenerating(status)
  const playgroundMessages = useMemo(
    () => toPlaygroundMessages({ messages, status }),
    [messages, status]
  )
  const modelOptions = useMemo(() => toModelOptions(models), [models])

  const getRequestBody = useCallback(
    () => ({
      model: selectedModelId,
      apiKeyId: selectedApiKeyId,
      projectId,
    }),
    [projectId, selectedApiKeyId, selectedModelId]
  )

  const loadOptions = useCallback(async () => {
    setIsLoadingOptions(true)
    setOptionsError("")

    try {
      const response = await fetch(
        `/api/chat/options?projectId=${encodeURIComponent(projectId)}`,
        {
          cache: "no-store",
        }
      )
      const result = (await response.json()) as ChatOptionsResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok) {
        setOptionsError(result.message || t.chatOptionsFailed)
        return
      }

      setModels(result.models ?? [])
      setApiKeys(result.apiKeys ?? [])
    } catch {
      setOptionsError(t.chatOptionsFailed)
    } finally {
      setIsLoadingOptions(false)
    }
  }, [projectId, t.chatOptionsFailed])

  useEffect(() => {
    setPlaygroundLanguage(locale)
  }, [locale])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOptions()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadOptions])

  useEffect(() => {
    if (!activeSession || !activeSessionId) {
      return
    }

    if (hydratedSessionIdRef.current === activeSessionId) {
      return
    }

    hydratedSessionIdRef.current = activeSessionId
    isHydratingSessionRef.current = true
    setMessages(activeSession.messages)
    setEditingMessageKey(null)
  }, [activeSession, activeSessionId, setMessages])

  useEffect(() => {
    if (!isLoaded || !activeSession || !activeSessionId) {
      return
    }

    if (isHydratingSessionRef.current) {
      isHydratingSessionRef.current = false
      return
    }

    updateActiveSessionMessages(messages)
  }, [
    activeSession,
    activeSessionId,
    isLoaded,
    messages,
    updateActiveSessionMessages,
  ])

  useEffect(() => {
    if (!activeSession || isLoadingOptions) {
      return
    }

    const nextModelId = activeSession.modelId || models[0]?.id
    const nextApiKeyId = activeSession.apiKeyId || apiKeys[0]?.id

    if (!nextModelId && !nextApiKeyId) {
      return
    }

    if (
      nextModelId !== activeSession.modelId ||
      nextApiKeyId !== activeSession.apiKeyId
    ) {
      updateActiveSessionPreferences({
        modelId: nextModelId,
        apiKeyId: nextApiKeyId,
      })
    }
  }, [
    activeSession,
    apiKeys,
    isLoadingOptions,
    models,
    updateActiveSessionPreferences,
  ])

  async function handleSendMessage(text: string) {
    const content = text.trim()

    if (!content || isGeneratingResponse) {
      return
    }

    if (!selectedModelId) {
      setRequestError(t.modelRequired)
      return
    }

    if (!selectedApiKeyId) {
      setRequestError(t.apiKeyRequired)
      return
    }

    setRequestError("")
    clearError()

    await sendMessage(
      { text: content },
      {
        body: getRequestBody(),
      }
    )
  }

  async function handleRegenerateMessage(message: PlaygroundMessage) {
    if (isGeneratingResponse) {
      return
    }

    if (!selectedModelId) {
      setRequestError(t.modelRequired)
      return
    }

    if (!selectedApiKeyId) {
      setRequestError(t.apiKeyRequired)
      return
    }

    setRequestError("")
    clearError()

    await regenerate({
      messageId: message.key,
      body: getRequestBody(),
    })
  }

  function handleEditMessage(message: PlaygroundMessage) {
    if (isGeneratingResponse) {
      return
    }

    setEditingMessageKey(message.key)
  }

  function handleDeleteMessage(message: PlaygroundMessage) {
    if (isGeneratingResponse) {
      return
    }

    setMessages((currentMessages) =>
      currentMessages.filter((item) => item.id !== message.key)
    )
  }

  function handleEditOpenChange(open: boolean) {
    if (!open) {
      setEditingMessageKey(null)
    }
  }

  function applyEdit(newContent: string, shouldSubmit: boolean) {
    const messageKey = editingMessageKey

    if (!messageKey) {
      return
    }

    const editedRole = getMessageRole(messages, messageKey)

    setMessages((currentMessages) => {
      const messageIndex = currentMessages.findIndex(
        (message) => message.id === messageKey
      )

      if (messageIndex === -1) {
        return currentMessages
      }

      const updatedMessages = currentMessages.map((message) =>
        message.id === messageKey
          ? replaceUiMessageText(message, newContent)
          : message
      )

      if (shouldSubmit && editedRole === "user") {
        return updatedMessages.slice(0, messageIndex + 1)
      }

      return updatedMessages
    })

    setEditingMessageKey(null)

    if (shouldSubmit && editedRole === "user") {
      window.setTimeout(() => {
        void regenerate({
          messageId: messageKey,
          body: getRequestBody(),
        })
      }, 0)
    }
  }

  function handleClearMessages() {
    if (isGeneratingResponse) {
      return
    }

    setMessages([])
    setEditingMessageKey(null)
    setRequestError("")
    clearError()
  }

  function handleModelChange(modelId: string) {
    updateActiveSessionPreferences({
      modelId,
      apiKeyId: selectedApiKeyId || apiKeys[0]?.id,
    })
  }

  const visibleError = optionsError || requestError || error?.message || ""

  return (
    <section className="relative flex size-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 pt-3">
        {visibleError ? (
          <SystemMessage variant="error" fill>
            {visibleError}
          </SystemMessage>
        ) : null}
        {!isLoadingOptions && models.length === 0 ? (
          <SystemMessage variant="warning">{t.noTextModels}</SystemMessage>
        ) : null}
        {!isLoadingOptions && apiKeys.length === 0 ? (
          <SystemMessage variant="warning">{t.noApiKeysForChat}</SystemMessage>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PlaygroundChat
          messages={playgroundMessages}
          isLoadingMessages={!isLoaded}
          onRegenerateMessage={handleRegenerateMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onSelectPrompt={(prompt) => void handleSendMessage(prompt)}
          isGenerating={isGeneratingResponse}
          editingKey={editingMessageKey}
          onCancelEdit={handleEditOpenChange}
          onSaveEdit={(newContent) => applyEdit(newContent, false)}
          onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
        />
      </div>

      <div className="mx-auto w-full max-w-4xl">
        <PlaygroundInput
          disabled={
            isGeneratingResponse ||
            isLoadingOptions ||
            models.length === 0 ||
            apiKeys.length === 0
          }
          isGenerating={isGeneratingResponse}
          isModelLoading={isLoadingOptions}
          modelValue={selectedModelId}
          models={modelOptions}
          onClearMessages={handleClearMessages}
          onModelChange={handleModelChange}
          onStop={() => void stop()}
          onSubmit={(text) => void handleSendMessage(text)}
          hasMessages={messages.length > 0}
        />
      </div>
    </section>
  )
}
