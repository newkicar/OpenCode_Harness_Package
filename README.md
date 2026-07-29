# OpenCode Harness Package

这是一个 OpenCode 项目，集成了多种 AI 辅助开发工具和规范，旨在提高代码质量和开发效率。该体系可直接复制到新项目中使用。

## 项目概述

本项目提供了一套完整的 OpenCode harness 体系，包括：

- **开发规范**：安全红线、代码质量、架构原则
- **技能体系**：核心技能和领域特化技能
- **MCP 服务器**：扩展功能集成
- **工作流**：标准化开发流程

## 可用技能

### 核心技能（来自 superpowers 插件）

- `brainstorming`：创造性工作前的探索和设计
- `systematic-debugging`：系统化调试方法
- `test-driven-development`：测试驱动开发流程
- `writing-plans`：制定实施计划
- `verification-before-completion`：完成前的验证检查
- `using-superpowers`：技能使用指南

### 领域特化技能

- `bdd-practices`：BDD 最佳实践指导
- `karpathy-guidelines`：避免 LLM 编码常见错误
- `robust-design`：确保代码泛化、处理边界情况
- `semantic-extraction`：从非结构化文本中提取信息
- `pytorch-advanced`：PyTorch 进阶
- `grill-with-docs`：结构化需求访谈，打磨术语并产出 CONTEXT.md + ADR

## MCP 服务器配置

MCP 服务器配置在全局 `~/.config/opencode/opencode.jsonc` 中管理，根据项目需要启用相应的服务器（context7、tavily 等）。

## 配置文件

- **项目配置**：`./opencode.json`
- **全局配置**：`~/.config/opencode/opencode.jsonc`
- **代理配置**：`./AGENTS.md`

## 快速开始

1. **安装依赖**：确保已安装 OpenCode 和相关工具
2. **配置环境**：根据需要调整 `opencode.json` 或全局配置
3. **使用技能**：在对话中调用 `skill` 工具加载所需技能
4. **遵循规范**：参考 `AGENTS.md` 中的开发规范和工作流

## 文件结构

```text
项目根目录/
├── AGENTS.md              # 代理配置和开发规范
├── README.md              # 本文件
├── opencode.json          # OpenCode 项目配置
├── .agents/skills/        # 技能目录
├── .opencode/             # OpenCode 配置和插件
└── .rules/                # 规则文件
```

## 开发规范

项目遵循严格的开发规范，详见 `AGENTS.md`，包括：

- **安全红线**：输入验证、参数化查询、加密规范等
- **代码质量**：异常处理、TDD 纪律、泛化原则
- **架构原则**：单一职责、层次清晰、依赖倒置
- **交付清单**：验证、测试、文档、清理

## 验证命令

- **Python 测试**：`pytest` 或 `python -m pytest`
- **代码检查**：`ruff check .`
- **代码格式化**：`ruff format .`

## 相关资源

- [OpenCode 文档](https://opencode.ai)
- [Superpowers 插件](https://github.com/obra/superpowers)
- [MCP 服务器配置](https://modelcontextprotocol.io)
