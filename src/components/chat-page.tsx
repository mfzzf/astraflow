"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import {
  ArrowUpIcon,
  BotIcon,
  KeyRoundIcon,
  PaperclipIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react"

import {
  getMessageText,
  useChatHistory,
} from "@/components/chat-history-provider"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container"
import { CodeBlock, CodeBlockCode } from "@/components/ui/code-block"
import {
  FileUpload,
  FileUploadContent,
  FileUploadTrigger,
} from "@/components/ui/file-upload"
import { Image as PromptKitImage } from "@/components/ui/image"
import { JSXPreview } from "@/components/ui/jsx-preview"
import { Loader } from "@/components/ui/loader"
import { Markdown } from "@/components/ui/markdown"
import { Message, MessageContent } from "@/components/ui/message"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { PromptSuggestion } from "@/components/ui/prompt-suggestion"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ui/reasoning"
import { ScrollButton } from "@/components/ui/scroll-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Source, SourceContent, SourceTrigger } from "@/components/ui/source"
import { SystemMessage } from "@/components/ui/system-message"
import { TextShimmer } from "@/components/ui/text-shimmer"
import { Tool, type ToolPart } from "@/components/ui/tool"
import { cn } from "@/lib/utils"

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

const TOOL_STATES = [
  "input-streaming",
  "input-available",
  "output-available",
  "output-error",
] as const

function isGenerating(status: ReturnType<typeof useChat>["status"]) {
  return status === "submitted" || status === "streaming"
}

function formatContextLength(value: number | undefined) {
  if (!value) {
    return ""
  }

  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`
  }

  return String(value)
}

function attachmentsText(files: File[]) {
  if (files.length === 0) {
    return ""
  }

  return files.map((file) => `[Attachment: ${file.name}]`).join("\n")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]

  return typeof value === "string" ? value : ""
}

function extractPreviewJsx(markdown: string) {
  const match = markdown.match(/```(?:jsx|tsx)\s+preview\s*\n([\s\S]*?)```/i)

  return match?.[1]?.trim() ?? ""
}

function toToolPart(part: MessagePartRecord): ToolPart | null {
  if (!part.type.startsWith("tool-")) {
    return null
  }

  const stateValue = readString(part, "state")
  const state = TOOL_STATES.includes(
    stateValue as (typeof TOOL_STATES)[number]
  )
    ? (stateValue as ToolPart["state"])
    : "output-available"
  const input = isRecord(part.input)
    ? part.input
    : isRecord(part.args)
      ? part.args
      : undefined
  const output = isRecord(part.output)
    ? part.output
    : isRecord(part.result)
      ? part.result
      : undefined

  return {
    type: part.type.replace(/^tool-/, ""),
    state,
    input,
    output,
    toolCallId: readString(part, "toolCallId"),
    errorText: readString(part, "errorText"),
  }
}

function renderTextPart(text: string, id: string, isUser: boolean) {
  if (isUser) {
    return <p className="whitespace-pre-wrap text-sm leading-6">{text}</p>
  }

  const previewJsx = extractPreviewJsx(text)

  return (
    <div className="flex flex-col gap-3">
      <Markdown
        id={id}
        className="chat-response-text text-sm leading-6 text-foreground"
      >
        {text}
      </Markdown>
      {previewJsx ? (
        <div className="grid gap-3 rounded-xl border bg-background p-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <JSXPreview jsx={previewJsx} components={{ Button }} />
          </div>
          <CodeBlock>
            <CodeBlockCode code={previewJsx} language="tsx" />
          </CodeBlock>
        </div>
      ) : null}
    </div>
  )
}

function renderSourcePart(part: MessagePartRecord, key: string) {
  const href =
    readString(part, "url") ||
    readString(part, "href") ||
    (isRecord(part.source) ? readString(part.source, "url") : "")

  if (!href) {
    return null
  }

  const title =
    readString(part, "title") ||
    (isRecord(part.source) ? readString(part.source, "title") : "") ||
    href
  const description =
    readString(part, "description") ||
    (isRecord(part.source) ? readString(part.source, "description") : "")

  return (
    <Source key={key} href={href}>
      <SourceTrigger showFavicon />
      <SourceContent title={title} description={description || href} />
    </Source>
  )
}

function renderImagePart(part: MessagePartRecord, key: string) {
  const mediaType =
    readString(part, "mediaType") || readString(part, "mimeType") || ""

  if (!mediaType.startsWith("image/")) {
    return null
  }

  const base64 = readString(part, "base64") || readString(part, "data")

  return (
    <PromptKitImage
      key={key}
      base64={base64}
      mediaType={mediaType}
      alt={readString(part, "name") || "Generated image"}
      className="max-h-80 rounded-xl border object-contain"
    />
  )
}

function AssistantAvatar({ active = false }: { active?: boolean }) {
  return (
    <div
      className={cn(
        "chat-assistant-avatar flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground [&_svg]:size-4",
        active && "chat-assistant-avatar-active"
      )}
    >
      <BotIcon />
    </div>
  )
}

function renderMessageParts(message: UIMessage, isUser: boolean) {
  const parts = message.parts as MessagePartRecord[]

  return parts.map((part, index) => {
    const key = `${message.id}-${part.type}-${index}`

    if (part.type === "text" && typeof part.text === "string") {
      return (
        <div key={key}>
          {renderTextPart(part.text, `${message.id}-${index}`, isUser)}
        </div>
      )
    }

    if (part.type === "reasoning") {
      const text = readString(part, "text")

      if (!text) {
        return null
      }

      return (
        <Reasoning key={key}>
          <ReasoningTrigger className="text-sm">Reasoning</ReasoningTrigger>
          <ReasoningContent markdown>{text}</ReasoningContent>
        </Reasoning>
      )
    }

    const toolPart = toToolPart(part)

    if (toolPart) {
      return <Tool key={key} toolPart={toolPart} />
    }

    const imagePart = renderImagePart(part, key)

    if (imagePart) {
      return imagePart
    }

    const sourcePart = renderSourcePart(part, key)

    if (sourcePart) {
      return sourcePart
    }

    return null
  })
}

export function ChatPage({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const {
    activeSession,
    activeSessionId,
    isLoaded,
    updateActiveSessionMessages,
    updateActiveSessionPreferences,
  } = useChatHistory()
  const [input, setInput] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [models, setModels] = useState<ChatModel[]>([])
  const [apiKeys, setApiKeys] = useState<ChatApiKey[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState("")
  const [requestError, setRequestError] = useState("")
  const hydratedSessionIdRef = useRef("")
  const isHydratingSessionRef = useRef(false)
  const suggestions = useMemo(
    () => [
      t.chatSuggestionSummary,
      t.chatSuggestionCode,
      t.chatSuggestionDesign,
      t.chatSuggestionResearch,
    ],
    [
      t.chatSuggestionCode,
      t.chatSuggestionDesign,
      t.chatSuggestionResearch,
      t.chatSuggestionSummary,
    ]
  )
  const transport = useMemo(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/chat" }),
    []
  )
  const {
    messages,
    setMessages,
    sendMessage,
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
  const selectedModel = models.find((model) => model.id === selectedModelId)
  const selectedApiKey = apiKeys.find((apiKey) => apiKey.id === selectedApiKeyId)
  const isLoading = isGenerating(status)
  const canSubmit =
    (input.trim().length > 0 || files.length > 0) &&
    selectedModelId.length > 0 &&
    selectedApiKeyId.length > 0 &&
    !isLoading
  const lastMessage = messages.at(-1)
  const showThinking =
    isLoading &&
    (!lastMessage ||
      lastMessage.role !== "assistant" ||
      getMessageText(lastMessage).trim().length === 0)

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

  async function handleSubmit() {
    const text = input.trim()
    const attachedFiles = attachmentsText(files)
    const textToSend = [text, attachedFiles].filter(Boolean).join("\n\n")

    if (!textToSend || isLoading) {
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

    setInput("")
    setFiles([])
    setRequestError("")
    clearError()

    await sendMessage(
      { text: textToSend },
      {
        body: {
          model: selectedModelId,
          apiKeyId: selectedApiKeyId,
          projectId,
        },
      }
    )
  }

  function handleFilesAdded(nextFiles: File[]) {
    setFiles((currentFiles) => [...currentFiles, ...nextFiles])
  }

  function removeFile(index: number) {
    setFiles((currentFiles) =>
      currentFiles.filter((_, fileIndex) => fileIndex !== index)
    )
  }

  function handleModelChange(modelId: string) {
    updateActiveSessionPreferences({
      modelId,
      apiKeyId: selectedApiKeyId || apiKeys[0]?.id,
    })
  }

  function handleApiKeyChange(apiKeyId: string) {
    updateActiveSessionPreferences({
      modelId: selectedModelId || models[0]?.id,
      apiKeyId,
    })
  }

  const visibleError = optionsError || requestError || error?.message || ""

  function renderComposer() {
    return (
      <PromptInput
        value={input}
        onValueChange={setInput}
        onSubmit={() => void handleSubmit()}
        isLoading={isLoading}
        data-loading={isLoading ? "true" : undefined}
        data-has-input={
          input.trim().length > 0 || files.length > 0 ? "true" : undefined
        }
        className="chat-composer w-full rounded-[28px] border-input bg-background p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-300 focus-within:-translate-y-0.5 focus-within:shadow-md"
      >
        {files.length > 0 ? (
          <div className="flex flex-wrap gap-2 pb-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="chat-file-chip flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                onClick={(event) => event.stopPropagation()}
              >
                <PaperclipIcon />
                <span className="max-w-[18ch] truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={t.removeFile}
                  onClick={() => removeFile(index)}
                  className="rounded-full p-1 hover:bg-muted"
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <PromptInputTextarea
          placeholder={t.messagePlaceholder}
          className="min-h-8 px-1 py-1 text-base"
        />
        <PromptInputActions className="items-center justify-between gap-2 pt-2">
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <PromptInputAction tooltip={t.attachFiles}>
              <FileUploadTrigger
                className="flex size-8 cursor-pointer items-center justify-center rounded-full transition-transform hover:bg-muted active:scale-95"
                aria-label={t.attachFiles}
              >
                <PlusIcon className="text-primary" />
              </FileUploadTrigger>
            </PromptInputAction>
            <Select
              value={selectedModelId}
              onValueChange={handleModelChange}
              disabled={isLoadingOptions || models.length === 0}
            >
              <SelectTrigger
                aria-label={t.selectModel}
                className="h-8 w-fit max-w-[42vw] rounded-full px-3 sm:max-w-[28rem]"
              >
                <span className="truncate">
                  {selectedModel?.displayName ||
                    selectedModel?.name ||
                    t.selectModel}
                </span>
                {isLoadingOptions ? <Loader variant="classic" size="sm" /> : null}
              </SelectTrigger>
              <SelectContent className="min-w-72" align="start">
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">
                        {model.displayName || model.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[
                          model.vendor,
                          formatContextLength(model.contextLength),
                          model.hot ? t.hot : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedApiKeyId}
              onValueChange={handleApiKeyChange}
              disabled={isLoadingOptions || apiKeys.length === 0}
            >
              <SelectTrigger
                aria-label={t.selectApiKey}
                className="h-8 w-fit max-w-[32vw] rounded-full px-3 sm:max-w-[18rem]"
              >
                <KeyRoundIcon />
                <span className="truncate">
                  {selectedApiKey?.name || t.selectApiKey}
                </span>
              </SelectTrigger>
              <SelectContent align="start">
                {apiKeys.map((apiKey) => (
                  <SelectItem key={apiKey.id} value={apiKey.id}>
                    {apiKey.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PromptInputAction
            tooltip={isLoading ? t.stopGenerating : t.sendMessage}
          >
            <Button
              type="button"
              variant="default"
              size="icon"
              className={cn(
                "rounded-full transition-transform active:scale-95",
                isLoading && "chat-send-loading"
              )}
              disabled={!isLoading && !canSubmit}
              onClick={() => {
                if (isLoading) {
                  stop()
                  return
                }

                void handleSubmit()
              }}
            >
              {isLoading ? (
                <SquareIcon className="fill-current" />
              ) : (
                <ArrowUpIcon />
              )}
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pt-3">
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
      <FileUpload
        onFilesAdded={handleFilesAdded}
        multiple
        disabled={isLoading}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FileUploadContent>
            <div className="rounded-2xl border bg-background px-6 py-4 text-sm shadow-sm">
              {t.dropFilesHere}
            </div>
          </FileUploadContent>
          {messages.length > 0 ? (
            <>
              <ChatContainerRoot className="relative min-h-0 flex-1">
                <ChatContainerContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
                  {messages.map((message) => {
                    const isUser = message.role === "user"

                    return (
                      <Message
                        key={message.id}
                        className={cn(
                          "chat-message-row group w-full",
                          isUser
                            ? "chat-user-message-row justify-end"
                            : "justify-start"
                        )}
                      >
                        {!isUser ? <AssistantAvatar /> : null}
                        <div
                          className={cn(
                            "min-w-0",
                            isUser
                              ? "max-w-[78%]"
                              : "max-w-[calc(100%-2.5rem)] flex-1"
                          )}
                        >
                          <MessageContent
                            className={cn(
                              "flex flex-col gap-3 break-words text-sm leading-6 shadow-none",
                              isUser
                                ? "chat-user-bubble rounded-2xl bg-muted px-4 py-2.5"
                                : "bg-transparent px-0 pt-1 pb-0"
                            )}
                          >
                            {renderMessageParts(message, isUser)}
                          </MessageContent>
                        </div>
                      </Message>
                    )
                  })}
                  {showThinking ? (
                    <Message className="chat-message-row w-full">
                      <AssistantAvatar active />
                      <MessageContent className="w-full bg-transparent px-0 pt-1 pb-0">
                        <div className="flex items-center gap-2">
                          <TextShimmer duration={2} className="text-sm">
                            {t.thinking}
                          </TextShimmer>
                          <span aria-hidden className="chat-thinking-dots">
                            <span />
                            <span />
                            <span />
                          </span>
                        </div>
                      </MessageContent>
                    </Message>
                  ) : null}
                  <ChatContainerScrollAnchor />
                </ChatContainerContent>
                <div className="pointer-events-none absolute right-6 bottom-4">
                  <ScrollButton className="pointer-events-auto" />
                </div>
              </ChatContainerRoot>
              <div className="bg-background px-4 pt-2 pb-5">
                <div className="mx-auto w-full max-w-3xl">
                  {renderComposer()}
                </div>
              </div>
            </>
          ) : (
            <div className="chat-empty-stage flex min-h-0 flex-1 items-center justify-center px-4 pb-[10vh]">
              <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5">
                <h2 className="chat-empty-title text-center text-xl font-semibold text-foreground">
                  {t.readyToStart}
                </h2>
                <div className="chat-empty-composer w-full">
                  {renderComposer()}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion, index) => (
                    <PromptSuggestion
                      key={suggestion}
                      type="button"
                      size="sm"
                      className="chat-suggestion h-8 rounded-full px-3 text-muted-foreground transition-[border-color,transform,color] duration-200 hover:-translate-y-0.5 hover:text-foreground active:scale-95"
                      style={{
                        animationDelay: `${120 + index * 55}ms`,
                      }}
                      onClick={() => setInput(suggestion)}
                    >
                      {suggestion}
                    </PromptSuggestion>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </FileUpload>
    </section>
  )
}
