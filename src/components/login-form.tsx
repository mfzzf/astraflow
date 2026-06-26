"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type CheckResponse = {
  ok: boolean
  message: string
  regionCount?: number
  retCode?: number
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const { t } = useI18n()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const secretKey = String(formData.get("secretKey") ?? "").trim()
    const accessKey = String(formData.get("accessKey") ?? "").trim()
    const projectId = String(formData.get("projectId") ?? "").trim()

    setIsPending(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/auth/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secretKey,
          accessKey,
          projectId,
        }),
      })

      const result = (await response.json()) as CheckResponse

      if (!response.ok || !result.ok) {
        setError(result.message || t.loginFailed)
        return
      }

      setSuccess(
        result.regionCount === undefined
          ? result.message
          : t.regionsAvailable(result.message, result.regionCount)
      )
      router.push("/dashboard")
    } catch {
      setError(t.loginCheckUnavailable)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t.login}</CardTitle>
          <p className="text-sm text-muted-foreground">
            <a
              href="https://console.ucloud.cn/uaccount/api_manage"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t.getApiKeysHere}
            </a>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="secret-key">{t.secretKey}</FieldLabel>
                <Input
                  id="secret-key"
                  name="secretKey"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="access-key">{t.accessKey}</FieldLabel>
                <Input
                  id="access-key"
                  name="accessKey"
                  autoComplete="username"
                  required
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="project-id">{t.projectId}</FieldLabel>
                <Input
                  id="project-id"
                  name="projectId"
                  autoComplete="off"
                  required
                  disabled={isPending}
                />
              </Field>
              <Field data-invalid={Boolean(error)}>
                {error ? (
                  <FieldError>{error}</FieldError>
                ) : success ? (
                  <FieldDescription aria-live="polite">
                    {success}
                  </FieldDescription>
                ) : null}
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <LoaderCircleIcon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : null}
                  {isPending ? t.checking : t.login}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
