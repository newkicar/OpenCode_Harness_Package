/**
 * Pre-Tool-Use Plugin - 安全拦截与代码质量检查
 * 
 * 功能：在工具执行前检查安全规则和代码质量规则
 * 拦截范围：文件写入工具 (write/edit/apply_patch) + bash 命令
 */

import type { Plugin } from "@opencode-ai/plugin"

// ==================== 规则定义 ====================

interface Rule {
  id: string
  name: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  action: "BLOCK" | "ALERT" | "WARN"
  description: string
  fixSuggestion?: string
}

// ==================== 文件写入规则 ====================

const sensitiveFilePatterns = [
  /\.env\.production$/i,
  /\.env\.staging$/i,
  /\.env\.prod$/i,
  /credentials?\.json$/i,
  /secrets?\.json$/i,
  /\.pem$/i,
  /\.key$/i,
]

const sqlInjectionPatterns = [
  // Python f-string SQL 拼接
  { pattern: /f["'].*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|VALUES).*\{/i, hint: "Python f-string SQL 拼接" },
  // Python .format() SQL 拼接
  { pattern: /["'].*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|VALUES).*["']\.format\s*\(/i, hint: "Python .format() SQL 拼接" },
  // Python % 格式化 SQL 拼接
  { pattern: /["'].*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|VALUES).*%\s*s.*["']\s*%\s*/i, hint: "Python % 格式化 SQL 拼接" },
  // JS/TS template literal SQL 拼接
  { pattern: /`.*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|VALUES).*\$\{/i, hint: "JS/TS template literal SQL 拼接" },
  // JS/TS 字符串拼接 SQL
  { pattern: /["'].*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|VALUES).*["']\s*\+\s*\w+/i, hint: "JS/TS 字符串拼接 SQL" },
]

const hardcodedCredentialPatterns = [
  // OpenAI/Stripe key
  { pattern: /=\s*(?:["'])sk-[a-zA-Z0-9]{20,}(?:["'])/i, hint: "OpenAI/Stripe API Key" },
  // GitHub token
  { pattern: /=\s*(?:["'])ghp_[a-zA-Z0-9]{36}(?:["'])/i, hint: "GitHub Token" },
  // AWS key
  { pattern: /=\s*(?:["'])AKIA[0-9A-Z]{16}(?:["'])/i, hint: "AWS Access Key" },
  // Slack token
  { pattern: /=\s*(?:["'])xox[baprs]-[a-zA-Z0-9\-]+(?:["'])/i, hint: "Slack Token" },
  // Base64 长串
  { pattern: /=\s*(?:["'])[a-zA-Z0-9+/]{40,}={0,2}(?:["'])/i, hint: "高熵值凭据（可能是 Base64 编码的密钥）" },
]

const testDataPatterns = [
  // 测试邮箱
  { pattern: /test@example\.com|demo@.*\.com|fake@email/i, hint: "测试邮箱" },
  // 测试密码
  { pattern: /password123|admin123|test123|123456/i, hint: "测试密码" },
  // 测试姓名
  { pattern: /("John Doe"|Jane Smith|Test User|Fake Name)/i, hint: "测试姓名" },
  // 示例 URL
  { pattern: /http:\/\/example\.com(\/|$)/, hint: "示例 URL" },
  // 测试 ID
  { pattern: /"test_id"|"sample_id"|"fake_id"|"placeholder"/i, hint: "测试 ID" },
]

// ==================== Bash 命令规则 ====================

const dangerousBashPatterns = [
  // 远程代码执行
  { pattern: /curl\s+[^|]*\|\s*(?:ba)?sh/i, hint: "远程代码执行: curl | sh" },
  { pattern: /wget\s+[^|]*\|\s*(?:ba)?sh/i, hint: "远程代码执行: wget | sh" },
  { pattern: /curl\s+[^|]*-o\s*-\s*\|\s*(?:ba)?sh/i, hint: "远程代码执行: curl -o - | sh" },

  // 危险删除
  { pattern: /rm\s+(-[rRf]+\s+)?\//, hint: "删除根目录或绝对路径文件" },
  { pattern: /rm\s+(-[rRf]+\s+)?~\//, hint: "删除用户主目录文件" },
  { pattern: /rm\s+(-[rRf]+\s+)\*/, hint: "通配符递归删除" },
  { pattern: /rmdir\s+\/(\s|$)/, hint: "删除根目录" },

  // 危险权限
  { pattern: /chmod\s+(-[Rr]+\s+)?777\s/, hint: "全局可写权限 (777)" },

  // 环境变量泄露
  { pattern: /env\s*\|\s*(?:curl|wget|nc|ncat|netcat)/i, hint: "环境变量可能通过网络泄露" },
  { pattern: /printenv\s*\|\s*(?:curl|wget|nc|ncat|netcat)/i, hint: "环境变量可能通过网络泄露" },

  // 反弹 shell
  { pattern: /nc\s+.*-e\s*(?:\/bin\/)?(?:ba)?sh/i, hint: "反弹 shell: nc -e" },
  { pattern: /ncat\s+.*-e\s*(?:\/bin\/)?(?:ba)?sh/i, hint: "反弹 shell: ncat -e" },
  { pattern: /bash\s+-i\s+>.*\/dev\/tcp/i, hint: "反弹 shell: bash -i > /dev/tcp" },

  // fork bomb
  { pattern: /:\(\)\s*\{.*\|.*&\s*\};/, hint: "Fork bomb 检测" },
]

// ==================== Git 操作规则 ====================

const dangerousGitPatterns = [
  // 强制推送
  { pattern: /git\s+push\s+[^-]*--force/i, hint: "强制推送 (git push --force)" },
  { pattern: /git\s+push\s+[^-]*-f\b/i, hint: "强制推送 (git push -f)" },
  { pattern: /git\s+push\s+\S+\s+\+/, hint: "强制推送 (git push +branch)" },

  // 强制推送特定分支
  { pattern: /git\s+push\s+origin\s+(main|master|develop|release).*--force/i, hint: "强制推送到受保护分支" },

  // 删除未合并分支
  { pattern: /git\s+branch\s+-[dD]\s+(main|master|develop)/i, hint: "删除受保护分支" },

  // 重写历史
  { pattern: /git\s+rebase\s+(-i|--interactive)\s/, hint: "交互式变基 (改写历史)" },
  { pattern: /git\s+reset\s+--hard/, hint: "硬重置 (丢失未提交更改)" },
  { pattern: /git\s+clean\s+-[fFdDx]+/, hint: "清理未跟踪文件" },

  // 危险的 checkout
  { pattern: /git\s+checkout\s+[^-]*--\s*\./, hint: "检出覆盖所有文件" },

  // 删除 .git 目录
  { pattern: /rm\s+(-[rRf]+\s+)?\.git(\s|\/|$)/, hint: "删除 .git 目录" },

  // 修改全局 git 配置
  { pattern: /git\s+config\s+--global/, hint: "修改全局 git 配置" },

  // 子模块操作
  { pattern: /git\s+submodule\s+.*--force/, hint: "强制子模块操作" },
]

// ==================== 假测试检测辅助函数 ====================

/**
 * 检查文件是否包含真实的断言语句
 * 用于避免"假测试"反模式（只有 import 和函数定义，没有断言）
 */
function checkRealAssertions(content: string, filePath: string): boolean {
  // 移除注释
  const noComments = content
    .replace(/#.*$/gm, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'''[\s\S]*?'''/g, "")   // Python 多行字符串
    .replace(/"""[\s\S]*?"""/g, "")
    .replace(/`[\s\S]*?`/g, "")       // 模板字符串
  
  const ext = filePath.toLowerCase()
  
  if (ext.endsWith(".py")) {
    // Python 断言模式（排除 assert True 这个假断言）
    const pythonPatterns = [
      /\bassert\s+\w+/m,                 // assert actual_value
      /self\.assert\w+\(/m,              // self.assertEqual, self.assertTrue
      /pytest\.raises\(/m,
      /with\s+pytest\.raises\(/m,
      /self\.fail\s*\(/m,
    ]
    return pythonPatterns.some(p => p.test(noComments))
  }
  
  if (/\.(ts|tsx|js|jsx)$/.test(ext)) {
    const jsPatterns = [
      /expect\s*\(/m,
      /\bassert\s*\.\s*\w+\s*\(/m,       // assert.strictEqual
      /\bassert\s*\(/m,                   // assert(value)
      /t\.\s*(?:is|true|false|deepEqual|ok|notOk|equal)\s*\(/m,  // node test
      /vi\.(?:expect|assert)\s*\(/m,      // vitest
    ]
    return jsPatterns.some(p => p.test(noComments))
  }
  
  // 其他语言：只要有 assert 关键字就算（简化处理）
  return /\bassert\b|\bAssert\b/.test(noComments)
}

// ==================== 规则引擎：文件写入 ====================

function checkPathRules(filePath: string): { rule: Rule; matched: boolean }[] {
  const results: { rule: Rule; matched: boolean }[] = []
  
  // SEC-READ-001: 禁止读取敏感配置文件
  const isSensitiveFile = sensitiveFilePatterns.some(p => p.test(filePath))
  results.push({
    rule: {
      id: "SEC-READ-001",
      name: "BlockSensitiveFileRead",
      severity: "HIGH",
      action: "BLOCK",
      description: "禁止读取生产环境配置、凭据、.pem、.key 文件",
      fixSuggestion: "使用环境变量：os.getenv(\"DB_PASSWORD\") 或密钥管理器（Azure Key Vault, AWS Secrets Manager）"
    },
    matched: isSensitiveFile
  })
  
  return results
}

function checkContentRules(content: string, filePath: string): { rule: Rule; errors: string[] }[] {
  const results: { rule: Rule; errors: string[] }[] = []
  
  // 跳过测试文件
  const isTestFile = /test_|_test\.|_spec\./i.test(filePath)
  
  // SEC-SQL-001: 禁止 SQL 注入
  if (!isTestFile) {
    const sqlErrors: string[] = []
    for (const { pattern, hint } of sqlInjectionPatterns) {
      if (pattern.test(content)) {
        sqlErrors.push(`检测到 SQL 注入风险：${hint}。必须使用参数化查询或 ORM。`)
      }
    }
    if (sqlErrors.length > 0) {
      results.push({
        rule: {
          id: "SEC-SQL-001",
          name: "NoSqlInjectionViaStringConcat",
          severity: "CRITICAL",
          action: "ALERT",
          description: "禁止 SQL 字符串拼接",
          fixSuggestion: "使用参数化查询：cursor.execute(\"SELECT * FROM users WHERE id = ?\", (user_id,)) 或 ORM：User.objects.filter(id=user_id)"
        },
        errors: sqlErrors
      })
    }
  }
  
  // CODE-PY-001: 禁止空的 except
  if (/\.py$/.test(filePath)) {
    const emptyExceptPattern = /except\s*:\s*$/m
    if (emptyExceptPattern.test(content)) {
      results.push({
        rule: {
          id: "CODE-PY-001",
          name: "NoEmptyExcept",
          severity: "HIGH",
          action: "ALERT",
          description: "禁止空的 except 子句",
          fixSuggestion: "替换 'except:' 为 'except (ValueError, ConnectionError) as e: logger.error(e); raise'"
        },
        errors: ["检测到空的 except 子句。这会捕获所有异常包括 KeyboardInterrupt 和 SystemExit。请指定异常类型或重新抛出。"]
      })
    }
  }
  
  // CODE-JS-001: 禁止 debugger 语句
  if (/\.(js|ts|jsx|tsx)$/.test(filePath)) {
    const debuggerPattern = /^\s*debugger\s*;/m
    if (debuggerPattern.test(content)) {
      results.push({
        rule: {
          id: "CODE-JS-001",
          name: "NoDebuggerStatement",
          severity: "HIGH",
          action: "ALERT",
          description: "禁止 debugger 语句",
          fixSuggestion: "移除 \"debugger;\" 行 — 它会在 DevTools 中暂停执行。使用日志或 IDE 断点代替。"
        },
        errors: ["检测到 debugger 语句。提交前请移除。"]
      })
    }
  }
  
  // SEC-CODE-001: 禁止硬编码凭据
  if (!isTestFile) {
    const credErrors: string[] = []
    for (const { pattern, hint } of hardcodedCredentialPatterns) {
      if (pattern.test(content)) {
        credErrors.push(`检测到硬编码凭据：${hint}`)
      }
    }
    if (credErrors.length > 0) {
      results.push({
        rule: {
          id: "SEC-CODE-001",
          name: "NoHardcodedCredentials",
          severity: "CRITICAL",
          action: "ALERT",
          description: "禁止硬编码密码、API 密钥和令牌",
          fixSuggestion: "替换为：password = os.getenv(\"DB_PASSWORD\")。在 .env 中设置环境变量（不要提交 .env）。"
        },
        errors: credErrors
      })
    }
  }
  
  // GEN-001: 禁止测试数据在生产代码中
  if (!isTestFile) {
    const testErrors: string[] = []
    for (const { pattern, hint } of testDataPatterns) {
      if (pattern.test(content)) {
        testErrors.push(`可能包含测试数据：${hint}`)
      }
    }
    if (testErrors.length > 0) {
      results.push({
        rule: {
          id: "GEN-001",
          name: "NoTestDataInProductionCode",
          severity: "HIGH",
          action: "ALERT",
          description: "禁止在生产代码中使用测试数据/示例值",
          fixSuggestion: "将测试值抽取为配置常量（如 DEFAULT_EMAIL = \"user@example.com\"）或使用工厂函数生成测试数据。"
        },
        errors: testErrors
      })
    }
  }
  
  // CODE-TEST-001: 假测试检测（有测试骨架但没有断言）
  if (isTestFile && content.includes("def ") || isTestFile && content.includes("it(") || isTestFile && content.includes("describe(")) {
    if (!checkRealAssertions(content, filePath)) {
      results.push({
        rule: {
          id: "CODE-TEST-001",
          name: "FakeTestDetection",
          severity: "HIGH",
          action: "WARN",
          description: "检测到可能的假测试文件（有函数定义但缺少断言语句）",
          fixSuggestion: "添加真实的断言：assert result == expected、self.assertEqual(actual, expected)、expect(value).toBe(expected) 等"
        },
        errors: [
          "测试文件包含了函数定义/describe/it 块，但没有检测到任何断言语句。" +
          "根据 00-core.md §10 反模式检查：测试必须有断言（assert），不能只有空函数体。"
        ]
      })
    }
  }
  
  // PT-MINIMAL-001: 文件行数警告 (>500 行)
  if (/\.(py|js|ts|java|go|rb|cs)$/.test(filePath)) {
    const lineCount = content.split("\n").length
    if (lineCount > 500) {
      results.push({
        rule: {
          id: "PT-MINIMAL-001",
          name: "FileSizeGuardWarn",
          severity: "LOW",
          action: "WARN",
          description: "文件行数超过 500 行建议上限",
          fixSuggestion: "拆分为多个 100-200 行的小文件，按职责组织。参考 00-core §4 单一职责原则。"
        },
        errors: [`文件 ${lineCount} 行，超过 500 行建议上限。可以考虑按职责拆分。`]
      })
    }
  }
  
  return results
}

// ==================== 规则引擎：Bash 命令 ====================

function checkBashRules(command: string): { rule: Rule; errors: string[] }[] {
  const results: { rule: Rule; errors: string[] }[] = []
  
  // SEC-BASH-001: 危险 bash 命令
  const bashErrors: string[] = []
  for (const { pattern, hint } of dangerousBashPatterns) {
    if (pattern.test(command)) {
      bashErrors.push(`检测到危险命令模式：${hint}`)
    }
  }
  if (bashErrors.length > 0) {
    results.push({
      rule: {
        id: "SEC-BASH-001",
        name: "DangerousBashCommand",
        severity: "CRITICAL",
        action: "BLOCK",
        description: "阻止危险的 bash 命令执行",
        fixSuggestion: "避免 curl|sh 模式，先下载再审查；避免绝对路径 rm；避免 777 权限"
      },
      errors: bashErrors
    })
  }
  
  // SEC-GIT-001: 危险 git 操作（仅对包含 git 的命令检查）
  if (/\bgit\b/.test(command)) {
    const gitErrors: string[] = []
    for (const { pattern, hint } of dangerousGitPatterns) {
      if (pattern.test(command)) {
        gitErrors.push(`检测到危险 git 操作：${hint}`)
      }
    }
    if (gitErrors.length > 0) {
      results.push({
        rule: {
          id: "SEC-GIT-001",
          name: "DangerousGitOperation",
          severity: "HIGH",
          action: "ALERT",
          description: "检测到危险的 git 操作",
          fixSuggestion: "避免 force push 到主分支；避免 reset --hard；使用 git stash 暂存更改"
        },
        errors: gitErrors
      })
    }
  }
  
  return results
}

// ==================== 日志工具 ====================

function appendToFile(filePath: string, content: string): void {
  try {
    const fs = require("fs")
    const dir = require("path").dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.appendFileSync(filePath, content + "\n", "utf8")
  } catch {
    // 日志写入失败不应该影响主流程
  }
}

function writeRuleTriggerLog(
  ruleId: string,
  severity: string,
  action: string,
  target: string,
  toolName: string,
  errors: string[]
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    rule_id: ruleId,
    severity,
    action,
    target,
    tool_name: toolName,
    errors,
  }
  appendToFile("logs/rule-triggers.jsonl", JSON.stringify(logEntry))
}

// ==================== 插件实现 ====================

export const PreToolUsePlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      const toolName = input.tool
      const blockErrors: string[] = []
      const alertErrors: string[] = []
      const warnErrors: string[] = []
      
      // ==================== 文件写入工具检查 ====================
      if (["write", "edit", "apply_patch"].includes(toolName)) {
        const filePath = output.args?.filePath || output.args?.path || ""
        if (!filePath) return
        
        // 路径规则检查
        const pathResults = checkPathRules(filePath)
        for (const { rule, matched } of pathResults) {
          if (matched) {
            writeRuleTriggerLog(rule.id, rule.severity, rule.action, filePath, toolName, [rule.description])
            
            switch (rule.action) {
              case "BLOCK":
                blockErrors.push(`[${rule.id}] ${rule.description}\n修复建议: ${rule.fixSuggestion}`)
                break
              case "ALERT":
                alertErrors.push(`[${rule.id}] ${rule.description}\n修复建议: ${rule.fixSuggestion}`)
                break
              case "WARN":
                warnErrors.push(`[${rule.id}] ${rule.description}\n修复建议: ${rule.fixSuggestion}`)
                break
            }
          }
        }
        
        // 内容规则检查
        const content = output.args?.content || ""
        if (content) {
          const contentResults = checkContentRules(content, filePath)
          for (const { rule, errors } of contentResults) {
            if (errors.length > 0) {
              writeRuleTriggerLog(rule.id, rule.severity, rule.action, filePath, toolName, errors)
              
              const errorMsg = `[${rule.id}] ${rule.description}\n${errors.join("\n")}\n修复建议: ${rule.fixSuggestion}`
              
              switch (rule.action) {
                case "BLOCK":
                  blockErrors.push(errorMsg)
                  break
                case "ALERT":
                  alertErrors.push(errorMsg)
                  break
                case "WARN":
                  warnErrors.push(errorMsg)
                  break
              }
            }
          }
        }
      }
      
      // ==================== Bash 命令检查 ====================
      if (toolName === "bash") {
        const command = output.args?.command || ""
        if (!command) return
        
        // CODE-TEST-002: pytest 自动追加覆盖率参数
        const pytestPattern = /^(?:python\s+(?:-m\s+)?)?pytest\b/
        const hasCoverageFlag = /--cov(?:erage)?\b/
        const isPytestInfo = /pytest\s+(--version|--help|-h|--coverage\b)/
        if (pytestPattern.test(command) && !hasCoverageFlag.test(command) && !isPytestInfo.test(command)) {
          const newCommand = command + " --cov --cov-fail-under=80"
          output.args.command = newCommand
          writeRuleTriggerLog("CODE-TEST-002", "LOW", "WARN", command.substring(0, 60), toolName, [
            "自动追加 --cov --cov-fail-under=80 覆盖率检查"
          ])
          warnErrors.push(`[CODE-TEST-002] 自动追加覆盖率参数: pytest → pytest --cov --cov-fail-under=80`)
        }
        
        const bashResults = checkBashRules(command)
        for (const { rule, errors } of bashResults) {
          if (errors.length > 0) {
            const target = "bash: " + command.substring(0, 80)
            writeRuleTriggerLog(rule.id, rule.severity, rule.action, target, toolName, errors)
            
            const errorMsg = `[${rule.id}] ${rule.description}\n${errors.join("\n")}\n修复建议: ${rule.fixSuggestion}`
            
            switch (rule.action) {
              case "BLOCK":
                blockErrors.push(errorMsg)
                break
              case "ALERT":
                alertErrors.push(errorMsg)
                break
              case "WARN":
                warnErrors.push(errorMsg)
                break
            }
          }
        }
      }
      
      // ==================== 决策输出 ====================
      if (blockErrors.length > 0) {
        throw new Error(
          `🚫 操作被阻止\n\n` +
          `阻止原因:\n${blockErrors.join("\n\n")}\n\n` +
          (alertErrors.length > 0 ? `警告:\n${alertErrors.join("\n\n")}\n\n` : "") +
          (warnErrors.length > 0 ? `提示:\n${warnErrors.join("\n\n")}\n\n` : "") +
          `请修复上述问题后重试。`
        )
      }
      
      if (alertErrors.length > 0 || warnErrors.length > 0) {
        await client.app.log({
          body: {
            service: "pre-tool-use",
            level: "warn",
            message: `规则检查发现潜在问题`,
            extra: {
              tool: toolName,
              alerts: alertErrors,
              warnings: warnErrors,
            },
          },
        })
      }
    },
  }
}

export default PreToolUsePlugin
