/**
 * Post-Tool-Use Plugin - 审计日志 + 自动验证
 * 
 * 功能：
 * 1. 写文件后审计（凭据泄漏、调试代码残留）
 * 2. 自动运行 per-file linter（ruff / eslint）
 * 3. 每 N 次写文件后触发项目级验证（tsc / ruff check .）
 */

import type { Plugin } from "@opencode-ai/plugin"
import * as fs from "fs"
import * as path from "path"

// ==================== 审计规则 ====================

interface AuditRule {
  id: string
  patterns: RegExp[]
  action: "ALERT" | "WARN"
  fixSuggestion: string
}

const auditRules: AuditRule[] = [
  // AUDIT-SEC-001: 检测凭据泄漏
  {
    id: "AUDIT-SEC-001",
    patterns: [
      /sk-[a-z0-9]{32,}/,
      /ghp_[a-zA-Z0-9]{36}/,
      /AKIA[0-9A-Z]{16}/,
    ],
    action: "ALERT",
    fixSuggestion: "撤销凭据，使用环境变量或密钥管理器。"
  },
  // AUDIT-CODE-001: 检测调试代码
  {
    id: "AUDIT-CODE-001",
    patterns: [
      /debugger\s*;/,
      /console\.log\s*\(/,
      /#\s*TODO:\s*remove/,
      /#\s*FIXME:/,
      /pdb\.set_trace\(\)/,
      /breakpoint\(\)/,
    ],
    action: "WARN",
    fixSuggestion: "提交前移除调试代码。"
  },
  // AUDIT-PY-002: 检测 Windows 硬编码路径
  {
    id: "AUDIT-PY-002",
    patterns: [
      /path\s*=\s*["']C:\\/,
    ],
    action: "WARN",
    fixSuggestion: "使用 pathlib: Path(\"data\") / \"file.csv\""
  },
]

// ==================== 自动验证 ====================

// 写文件计数器：每 N 次触发项目级检查
let fileWriteCount = 0
const PROJECT_CHECK_INTERVAL = 3  // 每 3 次写文件触发一次项目级检查

interface LintResult {
  tool: string
  status: "PASS" | "FAIL"
  output: string
}

/** Per-file linter */
async function runLinter(filePath: string, $: any): Promise<LintResult[]> {
  const results: LintResult[] = []
  const ext = path.extname(filePath).toLowerCase()
  
  // Python: ruff
  if (ext === ".py") {
    try {
      const result = await $`ruff check "${filePath}" --output-format=text`.nothrow()
      if (result.exitCode > 0) {
        results.push({
          tool: "ruff",
          status: "FAIL",
          output: result.stdout.toString()
        })
      }
    } catch {
      // ruff 未安装或执行失败
    }
  }
  
  // JS/TS: ESLint
  if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
    try {
      const result = await $`npx eslint --format compact "${filePath}"`.nothrow()
      if (result.exitCode > 0) {
        results.push({
          tool: "eslint",
          status: "FAIL",
          output: result.stdout.toString()
        })
      }
    } catch {
      // eslint 未安装或执行失败
    }
  }
  
  return results
}

/** 项目级验证（每 N 次触发） */
async function runProjectCheck(worktree: string, $: any): Promise<LintResult[]> {
  const results: LintResult[] = []
  
  // 检测项目类型
  const hasPyproject = fs.existsSync(path.join(worktree, "pyproject.toml"))
  const hasPackageJson = fs.existsSync(path.join(worktree, "package.json"))
  
  if (hasPyproject) {
    try {
      const result = await $`ruff check . --output-format=text`.nothrow()
      if (result.exitCode > 0) {
        results.push({
          tool: "ruff-project",
          status: "FAIL",
          output: `项目级 ruff 检查发现 ${result.stdout.toString().split("\n").length} 行问题`,
        })
      }
    } catch {
      // ruff 未安装
    }
  }
  
  if (hasPackageJson) {
    // 检查是否有 tsconfig
    if (fs.existsSync(path.join(worktree, "tsconfig.json"))) {
      try {
        const result = await $`npx tsc --noEmit`.nothrow()
        if (result.exitCode > 0) {
          results.push({
            tool: "tsc",
            status: "FAIL",
            output: `TypeScript 编译错误: ${result.stdout.toString().substring(0, 500)}`,
          })
        }
      } catch {
        // tsc 未安装
      }
    }
  }
  
  return results
}

// ==================== 日志工具 ====================

function appendToFile(filePath: string, content: string): void {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.appendFileSync(filePath, content + "\n", "utf8")
  } catch {
    // 日志写入失败不应该影响主流程
  }
}

function writeAuditLog(entry: Record<string, unknown>): void {
  appendToFile("logs/audit-trail.jsonl", JSON.stringify(entry))
}

// ==================== 插件实现 ====================

export const PostToolUsePlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.after": async (input, output) => {
      // 只检查文件写入工具
      const fileTools = ["write", "edit", "apply_patch"]
      if (!fileTools.includes(input.tool)) {
        return
      }
      
      const filePath = (output as any).args?.filePath || (output as any).args?.path || ""
      if (!filePath) {
        return
      }
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return
      }
      
      // 跳过大文件 (>500KB)
      const stats = fs.statSync(filePath)
      if (stats.size > 500 * 1024) {
        return
      }
      
      // 读取文件内容
      let content: string
      try {
        content = fs.readFileSync(filePath, "utf8")
      } catch {
        return
      }
      
      if (!content) {
        return
      }
      
      const toolName = input.tool
      const messages: string[] = []
      
      // ========== 1. 审计规则检查 ==========
      for (const rule of auditRules) {
        for (const pattern of rule.patterns) {
          if (pattern.test(content)) {
            const prefix = rule.action === "ALERT" ? "ALERT" : "WARN"
            messages.push(`${prefix} [${rule.id}]: 检测到可疑模式\n修复建议: ${rule.fixSuggestion}`)
            
            writeAuditLog({
              timestamp: new Date().toISOString(),
              rule_id: rule.id,
              action: rule.action,
              file_path: filePath,
              tool_name: toolName,
              pattern: pattern.source,
            })
            
            break
          }
        }
      }
      
      // ========== 2. Per-file Linter ==========
      const lintResults = await runLinter(filePath, $)
      for (const result of lintResults) {
        if (result.status === "FAIL") {
          messages.push(`LINTER [${result.tool}]: ${result.output}`)
          
          writeAuditLog({
            timestamp: new Date().toISOString(),
            rule_id: `LINTER-${result.tool.toUpperCase()}`,
            action: "WARN",
            file_path: filePath,
            tool_name: toolName,
            linter_output: result.output,
          })
        }
      }
      
      // ========== 3. 项目级验证（每 N 次触发） ==========
      fileWriteCount++
      if (fileWriteCount % PROJECT_CHECK_INTERVAL === 0) {
        const projectResults = await runProjectCheck(worktree || directory, $)
        for (const result of projectResults) {
          if (result.status === "FAIL") {
            messages.push(`PROJECT [${result.tool}]: ${result.output}`)
            
            writeAuditLog({
              timestamp: new Date().toISOString(),
              rule_id: `PROJECT-${result.tool.toUpperCase()}`,
              action: "WARN",
              file_path: filePath,
              tool_name: toolName,
              project_check: true,
            })
          }
        }
      }
      
      // 记录工具执行日志
      writeAuditLog({
        timestamp: new Date().toISOString(),
        event: "tool.executed",
        tool_name: toolName,
        file_path: filePath,
        file_size: stats.size,
        messages_count: messages.length,
        write_count: fileWriteCount,
      })
      
      // 如果有警告，输出给用户
      if (messages.length > 0) {
        await client.app.log({
          body: {
            service: "post-tool-use",
            level: "warn",
            message: `文件 ${path.basename(filePath)} 检查发现 ${messages.length} 个问题${
              fileWriteCount % PROJECT_CHECK_INTERVAL === 0 ? " (含项目级检查)" : ""
            }`,
            extra: {
              messages,
            },
          },
        })
      }
    },
  }
}

export default PostToolUsePlugin
