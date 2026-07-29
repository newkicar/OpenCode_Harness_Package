# 如何添加新规则

> 为 `.opencode/plugins/pre-tool-use.ts` 或 `.opencode/plugins/post-tool-use.ts` 添加新的质量规则。

---

## 规则引擎结构

每个规则是一个 Hashtable，包含以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| RuleId | string | 是 | 唯一标识，格式见下方「命名空间」 |
| Name | string | 是 | 规则名称 |
| Description | string | 是 | 规则描述 |
| Severity | string | 是 | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` |
| Scope | string | 否 | `Security` \| `FileAccess` \| `CodeQuality`（可选，用于分类统计） |
| ApplicableTools | array | 是 | 适用的工具列表：`write`、`edit`、`apply_patch`、`bash` |
| MatchTarget | string | 是 | `Path` \| `Content` |
| Patterns | array | 是 | 正则表达式列表 |
| Action | string | 是 | `BLOCK` \| `ALERT` \| `WARN` |
| Enabled | bool | 是 | 是否启用 |
| ErrorMessage | string | 是 | 触发时的用户消息 |
| FixSuggestion | string | 否 | 修复建议（附加在 ErrorMessage 后的 `⚠️ Fix: ...`） |
| ValidationLogic | scriptblock | 否 | 复杂校验逻辑（仅 PreToolUse） |

---

## 命名空间（RuleId 前缀选择）

新增规则时，按以下流程图选择前缀：

```
新规则属于哪个系统？
│
├─ 安全/凭据/敏感文件读取 → SEC-*
│   例: SEC-READ-001, SEC-CODE-001
│
├─ 安全/Bash命令 → SEC-BASH-*
│   例: SEC-BASH-001 (危险 bash 命令拦截)
│
├─ 安全/Git操作 → SEC-GIT-*
│   例: SEC-GIT-001 (危险 git 操作拦截)
│
├─ 代码质量(Python) → CODE-PY-*
│   例: CODE-PY-001 (except: 检测)
│
├─ 代码质量(JS/TS) → CODE-JS-*
│   例: CODE-JS-001 (debugger 检测)
│
├─ 泛化性 → GEN-*
│   例: GEN-001 (测试数据检测)
│
├─ 格式/编码 → OPS-FMT-*
│   例: OPS-FMT-001 (Python 编码声明)
│
├─ Memory 状态专属 → MEM-STATE-*
│   例: MEM-STATE-001, MEM-STATE-002
│
├─ 后置审计(PostToolUse) → AUDIT-*
│   例: AUDIT-SEC-001, AUDIT-CODE-001
│   ⚠️ 注意：与 PreToolUse CODE-* 重叠的规则，只在 Pre 中保留
│
└─ 其他/通用 → CAT-*
    例: CAT-NEW-001
```

### `Scope` 字段与 RuleId 前缀的对应关系

| Scope 值 | 推荐的 RuleId 前缀 |
|----------|-------------------|
| `Security` | SEC-*, SEC-BASH-*, SEC-GIT-*, AUDIT-SEC-* |
| `FileAccess` | SEC-READ-*, MEM-BANK-* |
| `CodeQuality` | CODE-PY-*, CODE-JS-*, OPS-FMT-*, AUDIT-CODE-*, GEN-* |

---

## 添加步骤

### 1. 确定规则类型

| 需求 | 工具 | 位置 |
|------|------|------|
| 写文件前拦截 | PreToolUse | `.opencode/plugins/pre-tool-use.ts` |
| 写文件后审计 | PostToolUse | `.opencode/plugins/post-tool-use.ts` |
| Bash 命令拦截 | PreToolUse | `.opencode/plugins/pre-tool-use.ts` → `checkBashRules()` |
| Git 操作拦截 | PreToolUse | `.opencode/plugins/pre-tool-use.ts` → `checkBashRules()` |

### 2. 编写规则

**路径规则示例（pre-tool-use.ts）：**
```typescript
// 在 checkPathRules() 中添加
const sensitiveFilePatterns = [
  /\.env\.production$/i,
  /credentials?\.json$/i,
  // 追加新规则...
]
```

**内容规则示例（pre-tool-use.ts）：**
```typescript
// 在 checkContentRules() 中添加
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
      errors: ["检测到空的 except 子句。"]
    })
  }
}
```

**Bash 命令规则示例（pre-tool-use.ts）：**
```typescript
// 在 dangerousBashPatterns 数组中添加
const dangerousBashPatterns = [
  // 远程代码执行
  { pattern: /curl\s+[^|]*\|\s*(?:ba)?sh/i, hint: "远程代码执行: curl | sh" },
  // 危险删除
  { pattern: /rm\s+(-[rRf]+\s+)?\//, hint: "删除根目录或绝对路径文件" },
  // 追加新规则...
]
```

**Git 操作规则示例（pre-tool-use.ts）：**
```typescript
// 在 dangerousGitPatterns 数组中添加
const dangerousGitPatterns = [
  // 强制推送
  { pattern: /git\s+push\s+[^-]*--force/i, hint: "强制推送 (git push --force)" },
  // 危险重置
  { pattern: /git\s+reset\s+--hard/, hint: "硬重置 (丢失未提交更改)" },
  // 追加新规则...
]
```

### 3. 避免重复规则

添加规则前，**先检查现有规则是否已覆盖**：
- PreToolUse 的 `CODE-PY-001` 已检测 `except:` → PostToolUse 不需要 `AUDIT-PY-001`
- 同类检测只保留在 PreToolUse（更早拦截，效果更好）

### 4. 测试规则

在 OpenCode 中尝试触发规则，确认：
- 规则能正确匹配目标文件
- 触发时显示正确的 ErrorMessage
- 不影响正常操作

### 5. 更新文档

在本文档的规则目录中添加条目（如需要）。

---

## 常见陷阱

1. **TypeScript 字符串中的正则转义**：`.` `*` `+` `?` 需要转义
2. **正则表达式特殊字符**：确保在 RegExp 中正确转义
3. **ApplicableTools 不匹配**：确认工具名与 OpenCode 内部名称一致（`write`、`edit`、`apply_patch`、`bash` 等）
4. **忘记启用新规则**：在 `checkContentRules()`、`checkPathRules()` 或 `checkBashRules()` 中添加后，确认逻辑可达
5. **Bash 命令误报**：`rm -rf /` 匹配绝对路径删除，但 `rm -rf /tmp/test` 是合法操作。考虑使用更精确的正则或添加白名单。
6. **Git 规则仅在 bash 工具中触发**：`tool === "bash"` 时才检查 git 规则，直接调用 git 工具（如 `gh` CLI）不会触发。

---

## 禁用/启用规则

临时禁用规则：注释掉对应规则块或将 `action` 改为 `"WARN"`。

全局开关：编辑文件顶部，注释掉对应规则数组中的条目。