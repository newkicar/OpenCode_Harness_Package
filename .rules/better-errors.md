# Better Errors（错误分类与恢复指引）

> **所有工具执行失败的第一响应线。** AI 在任何错误发生后先查此表：分类 → 格式化 → 恢复 → 升级。
> 
> 与 `error-rescue.md` 互补：本文件处理单次错误；连续失败升级到 error-rescue。

---

## 1. 错误分类表

当工具（bash / write / edit 等）执行失败时，AI 根据错误输出**匹配分类 ID**，按对应策略恢复。

| # | 错误信号 | 类 ID | 根因 | 默认动作 | 恢复策略 |
|---|---------|-------|------|---------|---------|
| 1 | `ModuleNotFoundError` / `No module named` | PYTHON-DEP | 依赖未安装 / 包名错误 / 虚拟环境未激活 | Self-fix | `pip install <module>` 或修正 import 语句 |
| 2 | `SyntaxError: invalid syntax` / `ParseError` | PYTHON-SYNTAX | 语法错误（缩进、括号、冒号等） | Self-fix | 读 traceback 行号，修正该行代码 |
| 3 | `TypeError` / `ValueError` / `IndexError` / `KeyError` | PYTHON-RUNTIME | 类型/值不匹配，数据结构访问越界 | Self-fix | 检查调用参数类型，修复数据访问逻辑 |
| 4 | `FileNotFoundError: No such file or directory` | FILE-NOT-FOUND | 文件不存在 / 路径拼写 / 工作目录不对 | Self-fix | 创建文件 / 修正路径 / 确认 `workdir` 参数 |
| 5 | `PermissionError` / `EACCES` | FILE-PERM | 文件/目录权限不足 | Ask | `chmod` 改权限，或换目录写入 |
| 6 | `CUDA out of memory` / `CUDA error: out of memory` | CUDA-OOM | GPU 显存不足 | Self-fix | 缩小 batch_size / 用 `map_location='cpu'` / 换 CPU 回退 |
| 7 | `command not found` / `不是内部或外部命令` | TOOL-NOT-FOUND | CLI 工具未安装 / 不在 PATH | Ask | 安装对应工具（`npm install -g` / `pip install` 等） |
| 8 | `ConnectionError` / `TimeoutError` / `socket.timeout` | NETWORK | 网络不可达 / DNS 解析失败 | Self-fix → Ask | 先重试 1 次，失败后检查 URL / 网络连性 |
| 9 | `npm ERR!` / `ERR_PNPM` / `yarn error` | NPM-ERROR | 依赖安装/版本冲突 | Self-fix | `rm -rf node_modules && npm install` / 检查 version 兼容性 |
| 10 | `ruff` / `eslint` / `pylint` 报错（非 warn） | LINT | 代码风格 / 类型违规 | Self-fix | 尝试 `--fix` 自动修复；不行则手动修正违规行 |
| 11 | test `FAILED` / `AssertionError` | TEST-FAIL | 测试断言失败 | Self-fix | 读 assertion 期望值 vs 实际值，修正业务逻辑或测试 |
| 12 | `git: fatal` / `fatal: not a git repository` | GIT-ERROR | Git 操作异常 | Ask | `git status` 确认状态，修正命令参数 |
| 13 | PowerShell 特有错误（`PS>` 环境） | PS-SPECIFIC | 路径分隔符 / 命令语法不兼容 | Self-fix | 检查是否是 Windows 路径问题；改用 bash 工具或反义路径 |
| 14 | `pip` / `conda` 环境冲突 | PYTHON-ENV | 多个 Python 版本 / 包版本冲突 | Ask | 检查 `pip list`，建议用 venv / conda 隔离 |
| 15 | 其他无法匹配的错误 | UNKNOWN | 无法自动分类 | Ask | 展示完整错误 + 结构化报告，询问用户 |
| 16 | 用户说"不对"/"不是这个效果"、verify-changes 通过但用户反馈不符预期 | LOGIC-DRIFT | 代码执行正确但语义/逻辑偏离需求（用错 API、理解错需求、实现了 PRD 没有的功能、边界条件处理错误） | Ask | 重读需求文档或验收标准 → 对比当前实现 → 与用户确认预期 → 修正逻辑 |
| 17 | 同一任务中多次工具执行失败，但部分文件已修改 / agent 开始重做已完成步骤 | PARTIAL-STATE | 多步操作中某步失败，agent 丢弃进度从头重来而非从中断点继续 | Self-fix | 列出已修改文件 → 核对未完成步骤列表 → 从中断点继续，不重做已完成步骤 |

### 匹配规则

1. **精确匹配优先**：错误信息能对上表中某个信号 → 用该分类的策略
2. **多信号模糊**：匹配多个类 → 选匹配度最高的一个
3. **无匹配**：默认 `UNKNOWN`，展示结构化报告

---

## 2. 错误响应模板

AI 在报告错误给用户时，按以下模板格式化：

```
❌ 错误报告

分类: {CLASS} — {一句话说明}
命令: `{command}`
错误输出:
```
{原始错误输出（前 20 行）}
```

根因: {一行根因判断}
恢复: {一行恢复建议}

[Self-fix 尝试中...]   ← 当动作为 Self-fix 时显示
或
[请确认] 是否执行：{具体操作}？  ← 当动作为 Ask 时显示
```

**示例**：

```
❌ 错误报告

分类: PYTHON-DEP — 缺少依赖模块 requests
命令: `python -m pytest tests/`
错误输出:
```
ModuleNotFoundError: No module named 'requests'
```

根因: requests 未在 requirements.txt 中声明或未安装
恢复: 执行 pip install requests 并重新运行

[Self-fix 尝试中...] pip install requests
```

---

## 3. 恢复策略指南

### 动作定义

| 动作 | 含义 | AI 行为 |
|------|------|---------|
| **Self-fix** | AI 可自行修复 | 格式化报告后直接执行修正命令，无需用户确认。修正完后验证结果 |
| **Self-fix → Ask** | 先自修复，失败后问用户 | 先试一次 self-fix；仍失败则降到 Ask |
| **Ask** | 需要用户确认 | 格式化报告后，用 `question` 工具或文本询问用户是否执行恢复操作 |
| **Silent** | 极小错误，不打断 | 直接修复，不输出错误报告（仅用于极轻微 lint 等） |

### 通用恢复检查清单

无论哪种分类，AI 应默认检查以下三项：

1. **工作目录是否正确？** — 确认 `workdir` 参数与期望一致
2. **参数拼写？** — 命令参数是否有大小写/拼写错误
3. **重试 1 次？** — 网络/时序类错误，重试 1 次看是否解决

---

## 4. 升级标准

当以下条件满足时，**不再在 better-errors 内循环**，升级到 `error-rescue.md`：

| 条件 | 说明 | 操作 |
|------|------|------|
| Self-fix 连续失败 2 次 | 同类错误修复后重复出现 | 升级到 error-rescue Phase 1（停手） |
| 错误类 ID 为 `UNKNOWN` 且用户无法帮助 | 分类表无匹配 + 用户也无法判断 | 升级到 error-rescue Phase 3（隔离） |
| 环境/权限类错误且用户不处理 | `FILE-PERM` / `PYTHON-ENV` 等，用户说"你自己解决" | 升级到 error-rescue 做根因分析 |
| 同一文件连续修改 ≥ 3 次 | 修一个 bug 引出更多 bug | 升级到 error-rescue |
| 工具自身崩溃 | OpenCode / LLM 自身异常 | 升级到 error-rescue |

---

## 5. 与其它规则的关系

```
工具执行失败
    │
    ▼
better-errors.md ←── 第一响应线（本文件）
    │
    ├── Self-fix 成功 → 继续
    │
    └── 升级条件触发
            │
            ▼
    error-rescue.md ←── 死循环救援（较重）
            │
            └── 仍失败 → 记录到 memory/progress.md
```

- **verify-changes.md**：验证失败的错误走 better-errors 分类 → 修复 → 重新验证
- **00-core.md §2a 异常传播**：内层逻辑禁止吞异常，系统边界做结构化错误处理 — better-errors 的模板就是边界的格式化标准
