"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CopyIcon,
  EllipsisVerticalIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type APIKey = {
  IPWhitelist?: string
  KeyId?: string
  Name?: string
  Status?: number
  CreateTime?: number
  Key?: string
  ExpireTime?: number
  ModelverseDisabled?: number
  SandBoxDisabled?: number
  DailyLimitAmount?: string
  DailyUsedAmount?: string
  MonthlyLimitAmount?: string
  MonthlyUsedAmount?: string
  GrantAllModels?: boolean
  GrantedModels?: string[] | string
}

type APIKeysResponse = {
  ok: boolean
  message?: string
  data?: APIKey[] | APIKey
  totalCount?: number
}

type APIKeyFormState = {
  keyId?: string
  name: string
  modelverseEnabled: boolean
  sandboxEnabled: boolean
  dailyLimitAmount: string
  monthlyLimitAmount: string
  grantAllModels: boolean
  grantedModels: string
  ipWhitelist: string
}

const emptyForm: APIKeyFormState = {
  name: "",
  modelverseEnabled: true,
  sandboxEnabled: true,
  dailyLimitAmount: "",
  monthlyLimitAmount: "",
  grantAllModels: true,
  grantedModels: "",
  ipWhitelist: "",
}

function formatTimestamp(
  timestamp: number | undefined,
  locale: string,
  fallback: string
) {
  if (!timestamp || timestamp < 0) {
    return fallback
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000))
}

function formatModels(
  models: APIKey["GrantedModels"] | undefined,
  fallback: string
) {
  if (!models) {
    return fallback
  }

  if (Array.isArray(models)) {
    return models.length ? models.join(", ") : fallback
  }

  return models || fallback
}

function formFromKey(apiKey: APIKey): APIKeyFormState {
  return {
    keyId: apiKey.KeyId,
    name: apiKey.Name ?? "",
    modelverseEnabled: apiKey.ModelverseDisabled !== 1,
    sandboxEnabled: apiKey.SandBoxDisabled !== 1,
    dailyLimitAmount: apiKey.DailyLimitAmount ?? "",
    monthlyLimitAmount: apiKey.MonthlyLimitAmount ?? "",
    grantAllModels: apiKey.GrantAllModels ?? true,
    grantedModels: Array.isArray(apiKey.GrantedModels)
      ? apiKey.GrantedModels.join("\n")
      : apiKey.GrantedModels ?? "",
    ipWhitelist: apiKey.IPWhitelist ?? "",
  }
}

export function APIKeysDashboard({ projectId }: { projectId: string }) {
  const { locale, t } = useI18n()
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<APIKey | null>(null)
  const [form, setForm] = useState<APIKeyFormState>(emptyForm)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  const isEditing = Boolean(form.keyId)

  const loadApiKeys = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/api-keys?projectId=${encodeURIComponent(projectId)}`,
        {
          cache: "no-store",
        }
      )
      const result = (await response.json()) as APIKeysResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok || !Array.isArray(result.data)) {
        setError(result.message || t.requestFailed)
        return
      }

      setApiKeys(result.data)
      setTotalCount(result.totalCount ?? result.data.length)
    } catch {
      setError(t.requestFailed)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, t.requestFailed])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCreatedSecret(null)
      setSheetOpen(false)
      setDeleteOpen(false)
      setPendingDelete(null)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [projectId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadApiKeys()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadApiKeys])

  const activeCount = useMemo(
    () => apiKeys.filter((apiKey) => apiKey.Status === 1).length,
    [apiKeys]
  )

  function openCreateSheet() {
    setForm(emptyForm)
    setCreatedSecret(null)
    setError(null)
    setSheetOpen(true)
  }

  function openEditSheet(apiKey: APIKey) {
    setForm(formFromKey(apiKey))
    setCreatedSecret(null)
    setError(null)
    setSheetOpen(true)
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setCreatedSecret(null)

    try {
      const response = await fetch("/api/api-keys", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          projectId,
        }),
      })
      const result = (await response.json()) as APIKeysResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok) {
        setError(result.message || t.requestFailed)
        return
      }

      const createdKey = !Array.isArray(result.data) ? result.data?.Key : null

      if (createdKey) {
        setCreatedSecret(createdKey)
      }

      setSheetOpen(false)
      await loadApiKeys()
    } catch {
      setError(t.requestFailed)
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteApiKey() {
    if (!pendingDelete?.KeyId) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyId: pendingDelete.KeyId,
          projectId,
        }),
      })
      const result = (await response.json()) as APIKeysResponse

      if (response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok || !result.ok) {
        setError(result.message || t.requestFailed)
        return
      }

      setDeleteOpen(false)
      setPendingDelete(null)
      await loadApiKeys()
    } catch {
      setError(t.requestFailed)
    } finally {
      setIsSaving(false)
    }
  }

  async function copyApiKey(apiKey: APIKey) {
    if (!apiKey.Key) {
      return
    }

    try {
      await window.navigator.clipboard.writeText(apiKey.Key)
      const copiedId = apiKey.KeyId ?? apiKey.Name ?? apiKey.Key
      setCopiedKeyId(copiedId)
      window.setTimeout(() => {
        setCopiedKeyId((current) => (current === copiedId ? null : current))
      }, 1800)
    } catch {
      setError(t.copyFailed)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          {t.keysSummary(activeCount, totalCount)}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadApiKeys()}>
            <RefreshCwIcon
              data-icon="inline-start"
              className={isLoading ? "animate-spin" : undefined}
            />
            {t.refresh}
          </Button>
          <Button onClick={openCreateSheet}>
            <PlusIcon data-icon="inline-start" />
            {t.createApiKey}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t.requestFailed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {createdSecret ? (
        <Alert>
          <AlertTitle>{t.newApiKeyCreated}</AlertTitle>
          <AlertDescription>
            {t.storeSecret}{" "}
            <code className="font-mono">{createdSecret}</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.name}</TableHead>
                <TableHead>{t.keyId}</TableHead>
                <TableHead>{t.apiKey}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead>{t.modelverse}</TableHead>
                <TableHead>{t.sandbox}</TableHead>
                <TableHead>{t.daily}</TableHead>
                <TableHead>{t.monthly}</TableHead>
                <TableHead>{t.models}</TableHead>
                <TableHead>{t.created}</TableHead>
                <TableHead>
                  <span className="sr-only">{t.actions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11}>{t.loadingApiKeys}</TableCell>
                </TableRow>
              ) : apiKeys.length ? (
                apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.KeyId ?? apiKey.Name}>
                    <TableCell className="font-medium">
                      {apiKey.Name || t.unnamedKey}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {apiKey.KeyId || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!apiKey.Key}
                        onClick={() => void copyApiKey(apiKey)}
                      >
                        <CopyIcon data-icon="inline-start" />
                        {copiedKeyId === (apiKey.KeyId ?? apiKey.Name ?? apiKey.Key)
                          ? t.copied
                          : t.copy}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={apiKey.Status === 1 ? "secondary" : "outline"}
                      >
                        {apiKey.Status === 1 ? t.active : t.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          apiKey.ModelverseDisabled === 1
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {apiKey.ModelverseDisabled === 1
                          ? t.disabled
                          : t.enabled}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          apiKey.SandBoxDisabled === 1
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {apiKey.SandBoxDisabled === 1
                          ? t.disabled
                          : t.enabled}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {apiKey.DailyUsedAmount ?? "0"} /{" "}
                      {apiKey.DailyLimitAmount || t.noCap}
                    </TableCell>
                    <TableCell>
                      {apiKey.MonthlyUsedAmount ?? "0"} /{" "}
                      {apiKey.MonthlyLimitAmount || t.noCap}
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-56 truncate">
                        {apiKey.GrantAllModels
                          ? t.allModels
                          : formatModels(apiKey.GrantedModels, t.none)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(apiKey.CreateTime, locale, t.never)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${
                                apiKey.Name || t.apiKey
                              }`}
                            />
                          }
                        >
                          <EllipsisVerticalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => openEditSheet(apiKey)}
                            >
                              <PencilIcon />
                              {t.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setPendingDelete(apiKey)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2Icon />
                              {t.delete}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11}>{t.noApiKeys}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {isEditing ? t.editApiKey : t.createApiKey}
            </SheetTitle>
            <SheetDescription>{t.configureApiKey}</SheetDescription>
          </SheetHeader>
          <form onSubmit={submitForm} className="flex flex-col gap-4 px-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="api-key-name">{t.name}</FieldLabel>
                <Input
                  id="api-key-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  disabled={isSaving}
                />
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="modelverse-enabled"
                  checked={form.modelverseEnabled}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      modelverseEnabled: Boolean(checked),
                    }))
                  }
                  disabled={isSaving}
                />
                <FieldLabel htmlFor="modelverse-enabled">
                  {t.enableModelverse}
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="sandbox-enabled"
                  checked={form.sandboxEnabled}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      sandboxEnabled: Boolean(checked),
                    }))
                  }
                  disabled={isSaving}
                />
                <FieldLabel htmlFor="sandbox-enabled">
                  {t.enableSandbox}
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="grant-all-models"
                  checked={form.grantAllModels}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      grantAllModels: Boolean(checked),
                    }))
                  }
                  disabled={isSaving}
                />
                <FieldLabel htmlFor="grant-all-models">
                  {t.grantAllModels}
                </FieldLabel>
              </Field>
              <Field data-invalid={!form.grantAllModels && !form.grantedModels}>
                <FieldLabel htmlFor="granted-models">
                  {t.grantedModels}
                </FieldLabel>
                <Textarea
                  id="granted-models"
                  value={form.grantedModels}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      grantedModels: event.target.value,
                    }))
                  }
                  placeholder={'["deepseek-ai/DeepSeek-V3.2-Think"]'}
                  disabled={isSaving || form.grantAllModels}
                />
                {!form.grantAllModels && !form.grantedModels ? (
                  <FieldError>{t.grantedModelsRequired}</FieldError>
                ) : (
                  <FieldDescription>{t.grantedModelsHelp}</FieldDescription>
                )}
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="daily-limit">{t.dailyLimit}</FieldLabel>
                  <Input
                    id="daily-limit"
                    value={form.dailyLimitAmount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dailyLimitAmount: event.target.value,
                      }))
                    }
                    placeholder={t.noCap}
                    disabled={isSaving}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="monthly-limit">
                    {t.monthlyLimit}
                  </FieldLabel>
                  <Input
                    id="monthly-limit"
                    value={form.monthlyLimitAmount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        monthlyLimitAmount: event.target.value,
                      }))
                    }
                    placeholder={t.noCap}
                    disabled={isSaving}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="ip-whitelist">{t.ipWhitelist}</FieldLabel>
                <Textarea
                  id="ip-whitelist"
                  value={form.ipWhitelist}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ipWhitelist: event.target.value,
                    }))
                  }
                  placeholder={"192.168.1.1\n192.168.1.10/24"}
                  disabled={isSaving}
                />
                <FieldDescription>{t.ipWhitelistHelp}</FieldDescription>
              </Field>
            </FieldGroup>
            <SheetFooter className="px-0">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircleIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : null}
                {isEditing ? t.saveChanges : t.createApiKey}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteApiKeyQuestion}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteApiKeyDescription(
                pendingDelete?.Name || pendingDelete?.KeyId || t.apiKey
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isSaving}
              onClick={() => void deleteApiKey()}
            >
              {isSaving ? (
                <LoaderCircleIcon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : null}
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
