import i18next from "i18next"
import { initReactI18next } from "react-i18next"

const resources = {
  en: {
    translation: {},
  },
  zh: {
    translation: {
      "Ask anything": "有问题，尽管问",
      Attach: "附加",
      Back: "返回",
      Cancel: "取消",
      Clear: "清空",
      "Clear chat history": "清空聊天记录",
      "Clear chat history?": "清空聊天记录？",
      "Conversation cleared": "对话已清空",
      Copy: "复制",
      "Copied!": "已复制",
      Delete: "删除",
      Edit: "编辑",
      "Failed to copy to clipboard": "复制失败",
      "Get advice": "获取建议",
      "Loading conversation...": "正在加载对话...",
      "No model found.": "未找到模型。",
      "No messages yet": "暂无消息",
      "No changes": "没有修改",
      "Please wait for the current generation to complete":
        "请等待当前生成完成",
      Regenerate: "重新生成",
      Retry: "重试",
      Save: "保存",
      "Save & Submit": "保存并提交",
      Search: "搜索",
      "Search models...": "搜索模型...",
      Send: "发送",
      Stop: "停止",
      "Start a playground chat": "开始 Playground 对话",
      "Start a conversation to see messages here": "开始对话后将在这里显示消息",
      "Summarize text": "总结文本",
      "Surprise me": "给我惊喜",
      "Analyze data": "分析数据",
      Code: "代码",
      More: "更多",
      "Test a model with a starter prompt, or write your own request below.":
        "使用一个快捷提示测试模型，或在下方输入自己的问题。",
      "Thought for {{duration}} seconds": "思考了 {{duration}} 秒",
      "Thinking...": "正在思考...",
      "Used": "使用了",
      "sources": "个来源",
      "Response time: {{duration}}": "响应时间：{{duration}}",
      "{{value}}ms": "{{value}}ms",
      "{{value}}s": "{{value}}s",
    },
  },
}

export function ensurePlaygroundI18n() {
  if (i18next.isInitialized) {
    return
  }

  void i18next.use(initReactI18next).init({
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    lng: "en",
    resources,
  })
}

export function setPlaygroundLanguage(locale: "en" | "zh") {
  ensurePlaygroundI18n()
  void i18next.changeLanguage(locale)
}
