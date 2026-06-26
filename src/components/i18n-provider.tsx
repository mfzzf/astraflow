"use client"

import * as React from "react"

type Locale = "en" | "zh"

const LOCALE_STORAGE_KEY = "astraflow_locale"

const dictionaries = {
  en: {
    apiKeys: "API Keys",
    keysSummary: (activeCount: number, totalCount: number) =>
      `${activeCount} active · ${totalCount} total`,
    project: "Project",
    selectProject: "Select project",
    loadingProjects: "Loading projects...",
    refresh: "Refresh",
    createApiKey: "Create API Key",
    requestFailed: "Request failed",
    newApiKeyCreated: "New API key created",
    storeSecret: "Store this secret now. It is returned by UCloud as",
    name: "Name",
    keyId: "Key ID",
    apiKey: "API Key",
    status: "Status",
    modelverse: "Modelverse",
    sandbox: "Sandbox",
    daily: "Daily",
    monthly: "Monthly",
    models: "Models",
    created: "Created",
    actions: "Actions",
    loadingApiKeys: "Loading API keys...",
    noApiKeys: "No API keys found for this project.",
    unnamedKey: "Unnamed key",
    active: "Active",
    inactive: "Inactive",
    enabled: "Enabled",
    disabled: "Disabled",
    noCap: "No cap",
    allModels: "All models",
    none: "None",
    never: "Never",
    copy: "Copy",
    copyApiKey: "Copy API key",
    copied: "Copied",
    copyFailed: "Unable to copy the API key.",
    edit: "Edit",
    delete: "Delete",
    editApiKey: "Edit API Key",
    configureApiKey:
      "Configure Modelverse access, model scope, spend limits, and IP restrictions.",
    enableModelverse: "Enable Modelverse",
    enableSandbox: "Enable Sandbox",
    grantAllModels: "Grant all models",
    grantedModels: "Granted Models",
    grantedModelsRequired:
      "Add at least one model when all-model access is off.",
    grantedModelsHelp:
      "Enter a JSON array, comma-separated list, or one model per line.",
    dailyLimit: "Daily Limit",
    monthlyLimit: "Monthly Limit",
    ipWhitelist: "IP Whitelist",
    ipWhitelistHelp: "Optional. Use one IPv4, range, or CIDR per line.",
    saveChanges: "Save Changes",
    deleteApiKeyQuestion: "Delete API key?",
    deleteApiKeyDescription: (name: string) =>
      `This permanently deletes ${name}. Services using it will stop authenticating immediately.`,
    cancel: "Cancel",
    logOut: "Log out",
    login: "Login",
    getApiKeysHere: "Get your API keys here",
    secretKey: "Secret Key",
    accessKey: "Access Key",
    projectId: "Project ID",
    checking: "Checking...",
    loginFailed: "Login failed.",
    loginCheckUnavailable: "Unable to reach the login check endpoint.",
    regionsAvailable: (message: string, count: number) =>
      `${message} ${count} regions available.`,
    languageLabel: "Language",
    switchLanguage: "中文",
  },
  zh: {
    apiKeys: "API 密钥",
    keysSummary: (activeCount: number, totalCount: number) =>
      `${activeCount} 个启用 · 共 ${totalCount} 个`,
    project: "项目",
    selectProject: "选择项目",
    loadingProjects: "正在加载项目...",
    refresh: "刷新",
    createApiKey: "创建 API 密钥",
    requestFailed: "请求失败",
    newApiKeyCreated: "已创建新的 API 密钥",
    storeSecret: "请立即保存这个密钥。UCloud 返回值为",
    name: "名称",
    keyId: "Key ID",
    apiKey: "API 密钥",
    status: "状态",
    modelverse: "Modelverse",
    sandbox: "Sandbox",
    daily: "日额度",
    monthly: "月额度",
    models: "模型",
    created: "创建时间",
    actions: "操作",
    loadingApiKeys: "正在加载 API 密钥...",
    noApiKeys: "当前项目没有 API 密钥。",
    unnamedKey: "未命名密钥",
    active: "启用",
    inactive: "停用",
    enabled: "开启",
    disabled: "关闭",
    noCap: "不限额",
    allModels: "全部模型",
    none: "无",
    never: "永不过期",
    copy: "复制",
    copyApiKey: "复制 API 密钥",
    copied: "已复制",
    copyFailed: "无法复制 API 密钥。",
    edit: "编辑",
    delete: "删除",
    editApiKey: "编辑 API 密钥",
    configureApiKey: "配置 Modelverse 权限、模型范围、额度和 IP 限制。",
    enableModelverse: "开启 Modelverse",
    enableSandbox: "开启 Sandbox",
    grantAllModels: "授权全部模型",
    grantedModels: "授权模型",
    grantedModelsRequired: "关闭全部模型权限时，至少需要添加一个模型。",
    grantedModelsHelp: "输入 JSON 数组、逗号分隔列表，或每行一个模型。",
    dailyLimit: "日额度",
    monthlyLimit: "月额度",
    ipWhitelist: "IP 白名单",
    ipWhitelistHelp: "可选。每行一个 IPv4、范围或 CIDR。",
    saveChanges: "保存修改",
    deleteApiKeyQuestion: "删除 API 密钥？",
    deleteApiKeyDescription: (name: string) =>
      `这会永久删除 ${name}。正在使用该密钥的服务会立即认证失败。`,
    cancel: "取消",
    logOut: "退出登录",
    login: "登录",
    getApiKeysHere: "在这里获取 API 密钥",
    secretKey: "Secret Key",
    accessKey: "Access Key",
    projectId: "Project ID",
    checking: "校验中...",
    loginFailed: "登录失败。",
    loginCheckUnavailable: "无法连接登录校验接口。",
    regionsAvailable: (message: string, count: number) =>
      `${message} 可用地域数：${count}。`,
    languageLabel: "语言",
    switchLanguage: "English",
  },
} as const

type Dictionary = typeof dictionaries.en

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  t: Dictionary
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

function resolveBrowserLocale(): Locale {
  if (typeof window === "undefined") {
    return "en"
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)

  if (storedLocale === "en" || storedLocale === "zh") {
    return storedLocale
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en")

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLocaleState(resolveBrowserLocale())
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  const setLocale = React.useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
  }, [])

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "en" ? "zh" : "en")
  }, [locale, setLocale])

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: dictionaries[locale],
    }),
    [locale, setLocale, toggleLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = React.useContext(I18nContext)

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.")
  }

  return context
}
