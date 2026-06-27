import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai"
import { NextResponse } from "next/server"

import { getCredentialSession } from "@/lib/session"
import { callUCloudAction, UCloudApiError } from "@/lib/ucloud"

type UMInferAPIKey = {
  KeyId?: string
  Name?: string
  Key?: string
  Status?: number
  ModelverseDisabled?: number
}

type ListUMInferAPIKeyResponse = {
  Action?: string
  RetCode?: number
  Message?: string
  Data?: UMInferAPIKey[] | Record<string, UMInferAPIKey>
  TotalCount?: number
}

type ChatRequestBody = {
  messages?: UIMessage[]
  model?: unknown
  apiKeyId?: unknown
  projectId?: unknown
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeApiKeys(data: ListUMInferAPIKeyResponse["Data"]) {
  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === "object") {
    return Object.values(data)
  }

  return []
}

function toErrorResponse(error: unknown) {
  if (error instanceof UCloudApiError) {
    return NextResponse.json(
      {
        error: error.message,
        retCode: error.retCode,
      },
      { status: error.status }
    )
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 400 }
    )
  }

  return NextResponse.json(
    {
      error: "Unexpected chat request failure.",
    },
    { status: 500 }
  )
}

async function findApiKey({
  projectId,
  apiKeyId,
  credentials,
}: {
  projectId: string
  apiKeyId: string
  credentials: NonNullable<Awaited<ReturnType<typeof getCredentialSession>>>
}) {
  const response = await callUCloudAction<ListUMInferAPIKeyResponse>({
    credentials,
    params: {
      Action: "ListUMInferAPIKey",
      ProjectId: projectId,
      Offset: 0,
      Limit: 100,
    },
  })

  return normalizeApiKeys(response.Data).find(
    (apiKey) =>
      apiKey.KeyId === apiKeyId &&
      (apiKey.Status === undefined || apiKey.Status === 1) &&
      apiKey.ModelverseDisabled !== 1
  )
}

export async function POST(request: Request) {
  const session = await getCredentialSession()

  if (!session) {
    return NextResponse.json(
      {
        error: "Login is required.",
      },
      { status: 401 }
    )
  }

  try {
    const body = (await request.json()) as ChatRequestBody
    const projectId = readString(body.projectId) || session.projectId
    const model = readString(body.model)
    const apiKeyId = readString(body.apiKeyId)
    const messages = Array.isArray(body.messages) ? body.messages : []

    if (!model) {
      return NextResponse.json(
        {
          error: "Model is required.",
        },
        { status: 400 }
      )
    }

    if (!apiKeyId) {
      return NextResponse.json(
        {
          error: "API key is required.",
        },
        { status: 400 }
      )
    }

    if (messages.length === 0) {
      return NextResponse.json(
        {
          error: "Message is required.",
        },
        { status: 400 }
      )
    }

    const apiKey = await findApiKey({
      projectId,
      apiKeyId,
      credentials: session,
    })

    if (!apiKey?.Key) {
      return NextResponse.json(
        {
          error: "Selected API key is unavailable.",
        },
        { status: 400 }
      )
    }

    const modelverse = createOpenAICompatible({
      name: "modelverse",
      baseURL: "https://api.modelverse.cn/v1",
      apiKey: apiKey.Key,
    })
    const result = streamText({
      model: modelverse.chatModel(model),
      messages: await convertToModelMessages(messages),
    })

    return result.toUIMessageStreamResponse({
      onError(error) {
        return error instanceof Error ? error.message : "Chat request failed."
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
