"use client"

import * as React from "react"

type Locale = "en" | "zh"

const LOCALE_STORAGE_KEY = "astraflow_locale"

const dictionaries = {
  en: {
    dashboard: "Dashboard",
    apiKeys: "API Keys",
    keysSummary: (activeCount: number, totalCount: number) =>
      `${activeCount} active · ${totalCount} total`,
    costOverview: "Cost overview",
    costOverviewDescription:
      "Live status for Modelverse and Sandbox cost analysis endpoints.",
    available: "available",
    costScope: "Cost scope",
    costScopeDescription:
      "Project and date range used for cost analysis.",
    region: "Region",
    zone: "Zone",
    analysisReadiness: "Analysis readiness",
    analysisReadinessDescription:
      "Current response state for each analysis endpoint.",
    ready: "Ready",
    pending: "Pending",
    endpointResponded: "Endpoint responded successfully.",
    costEndpoints: "Cost analysis endpoints",
    costEndpointsDescription: "Raw request status returned by UCloud.",
    service: "Service",
    retCode: "RetCode",
    message: "Message",
    loadingCostAnalysis: "Loading cost analysis...",
    avgDailySpend: "Avg daily",
    keyCount: "API keys",
    dateRange: "Date range",
    yuan: "CNY",
    unitYuan: "Unit: CNY",
    itemUnit: "items",
    cpu: "CPU",
    memory: "Memory",
    storage: "Storage",
    peakSpend: "Peak daily spend",
    costPeak: "Peak",
    startDate: "Start date",
    endDate: "End date",
    topModels: "Top models",
    topApiKeys: "Top API keys",
    amount: "Amount",
    usage: "Usage",
    calls: "Calls",
    percent: "Percent",
    noCostData: "No cost data returned for this period.",
    sandboxBreakdown: "Sandbox breakdown",
    regionShare: "Region share",
    sandboxUsers: "Sandbox users",
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
    userMenu: "User menu",
    userInformation: "User information",
    company: "Company",
    displayName: "Display name",
    companyName: "Company name",
    companyId: "Company ID",
    details: "Details",
    userName: "Username",
    email: "Email",
    userId: "User ID",
    phone: "Phone",
    location: "Location",
    address: "Address",
    administrator: "Administrator",
    authState: "Auth state",
    userVersion: "User version",
    admin: "Admin",
    finance: "Finance",
    apiToken: "API token",
    bindEmail: "Bind email",
    phoneLogin: "Phone login",
    yes: "Yes",
    no: "No",
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
    dashboard: "概览",
    apiKeys: "API 密钥",
    keysSummary: (activeCount: number, totalCount: number) =>
      `${activeCount} 个启用 · 共 ${totalCount} 个`,
    costOverview: "成本概览",
    costOverviewDescription:
      "Modelverse 和 Sandbox 成本分析接口的实时状态。",
    available: "可用",
    costScope: "成本范围",
    costScopeDescription: "用于成本分析的项目和日期范围。",
    region: "地域",
    zone: "可用区",
    analysisReadiness: "分析就绪状态",
    analysisReadinessDescription: "各成本分析接口当前响应状态。",
    ready: "就绪",
    pending: "待确认",
    endpointResponded: "接口响应成功。",
    costEndpoints: "成本分析接口",
    costEndpointsDescription: "UCloud 返回的原始请求状态。",
    service: "服务",
    retCode: "RetCode",
    message: "消息",
    loadingCostAnalysis: "正在加载成本分析...",
    avgDailySpend: "日均",
    keyCount: "API 密钥",
    dateRange: "日期范围",
    yuan: "元",
    unitYuan: "单位：元",
    itemUnit: "个",
    cpu: "CPU",
    memory: "内存",
    storage: "存储",
    peakSpend: "单日峰值消费",
    costPeak: "峰值",
    startDate: "开始日期",
    endDate: "结束日期",
    topModels: "模型排行",
    topApiKeys: "API 密钥排行",
    amount: "金额",
    usage: "用量",
    calls: "调用数",
    percent: "占比",
    noCostData: "当前时间范围没有返回成本数据。",
    sandboxBreakdown: "Sandbox 明细",
    regionShare: "地域占比",
    sandboxUsers: "Sandbox 用户",
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
    userMenu: "用户菜单",
    userInformation: "用户信息",
    company: "公司",
    displayName: "显示名称",
    companyName: "公司名称",
    companyId: "公司 ID",
    details: "详情",
    userName: "用户名",
    email: "邮箱",
    userId: "用户 ID",
    phone: "手机",
    location: "地区",
    address: "地址",
    administrator: "管理员",
    authState: "实名状态",
    userVersion: "账号版本",
    admin: "超级管理员",
    finance: "财务权限",
    apiToken: "API Token",
    bindEmail: "绑定邮箱",
    phoneLogin: "手机号登录",
    yes: "是",
    no: "否",
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
