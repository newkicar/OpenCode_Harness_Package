/**
 * Todo Enforcer Plugin - 任务追踪与上下文保持
 * 
 * 功能：
 * 1. 在 compaction 时保留活跃 todo 上下文
 * 
 * 轻量设计：只在关键时刻介入，不做运行时监控。
 */

import type { Plugin } from "@opencode-ai/plugin"

export const TodoEnforcerPlugin: Plugin = async () => {
  return {
    // 在 compaction 时保留活跃上下文
    "experimental.session.compacting": async (_input, output) => {
      output.context = [
        ...output.context,
        "继续使用 todowrite 追踪剩余任务。如果卡住了，停下来检查是否需要切换方法。",
      ]
    },
  }
}

export default TodoEnforcerPlugin
