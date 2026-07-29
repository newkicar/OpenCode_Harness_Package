# Harness 领域术语

> 本文件由 `grilling` + `domain-modeling` session 逐步构建。定义本项目的核心领域概念，避免 Agent 在不同文件间产生歧义。

---

## 用户角色

| 术语 | 定义 |
|------|------|
| **Harness 使用者** | 将本模板复制到自己的 OpenCode 项目中、直接受益于规则和插件的开发者。也可根据自身需求增删文件 |
| **Harness 维护者** | 修改此模板本身（规则、插件、工作流、技能）的开发者 |

---

## 核心理念

| 术语 | 定义 |
|------|------|
| **安全红线** | 不可逾越的安全规则。触则 BLOCK/ALERT。包括：输入验证、SQL 参数化、加密规范、敏感信息保护、依赖安全。与 PreToolUse 插件的 BLOCK 动作同级，任何 workflow 指令不得覆盖 |
| **Ponytail 哲学** | 代码层面的懒人模式——不写冗余代码、不建没被要求的抽象、不引入没必要的依赖。与安全红线/质量规则不冲突 |
| **质量管控机制** | 安全红线 + TDD 纪律 + 交付自检清单 + 验证闭环。这是对代码质量的强制性检查，与 Ponytail 哲学互补 |

## 质量管控三层

| 术语 | 定义 |
|------|------|
| **PreToolUse 拦截** | TypeScript plugin 在写文件前执行的安全拦截。查敏感文件、SQL 拼接、硬编码凭据。BLOCK 动作等同于安全红线级别 |
| **Hook 审计** | PostToolUse 插件在每次写文件后自动执行的单文件快速扫描。查密钥泄漏、debugger 残留、Windows 路径硬编码。快、局部、自动化 |
| **验证闭环** | 执行 `verify-changes.md` 跑完整 test + lint + 类型检查。收工时的最终把关。慢、完整、最终结论 |

## 规则层级

| 术语 | 对应文件 | 加载方式 |
|------|---------|---------|
| **L1 核心规则** | `00-core.md`, `01-ponytail.md`, `plugins/*` | 永远加载 |
| **L2 领域规则** | `rules/l2/02-deepagents-code-rule.md`, `03-pytorch-code-rule.md` | AI 自动检测项目类型后按需加载 |
| **L3 工作流** | `workflows/*.md` | 按任务风险等级选择 |
| **L3 Speckit** | `workflows/speckit/*.md` | 在 `.specify/extensions.yml` 存在时激活，是 L3 的特化子集 |
| **L4 模板** | `memory/*.md` | 被 workflow 读写的数据文件 |
| **Memory 状态** | `memory/` 目录下的 `progress.md`, `decisions.md` | 跨 Session 持久化状态文件。由 Agent 收工时写入，开新 Session 时读取 |

## Workflow vs Skill 区分

| | Workflow | Skill |
|---|----------|-------|
| **加载方式** | 自动加载 — `opencode.json` 的 `instructions` 数组引用 | 按需加载 — Agent 用 `skill` 工具主动调用 |
| **作用** | **流程约束** — 定义"不出错"的流程：分级、救援、验证 | **能力增强** — 定义"把事情做好"的方法：BDD 规范、鲁棒设计 |
| **Agent 控制权** | 无 — 已自动加载，必须遵守 | 有 — Agent 判断任务匹配后才加载 |

> 区分标准只看加载方式，不看内容类型。

## 规则优先级（冲突时按此裁决）

| 优先级 | 规则类别 |
|--------|---------|
| 🥇 1 | 安全红线（§1 + PreToolUse BLOCK）> 一切 |
| 🥇 2 | 异常传播（§2a）> workflow 建议 |
| 🥇 3 | 当前工作流指令 > L1 原则性规则 |
| 🥇 4 | L2 领域规则 > L1 通用规则 |
| 🥇 5 | 具体规则 > 通用原则 |
