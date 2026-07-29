# OpenCode Harness Package

This is an OpenCode project that integrates various AI-assisted development tools and standards to improve code quality and development efficiency. This harness system can be directly copied to new projects.

## Project Overview

This project provides a complete OpenCode harness system, including:

- **Development Standards**: Security red lines, code quality, architecture principles
- **Skill System**: Core skills and domain-specific skills
- **MCP Servers**: Extended functionality integration
- **Workflows**: Standardized development processes

## Available Skills

### Core Skills (from superpowers plugin)

- `brainstorming`: Exploration and design before creative work
- `systematic-debugging`: Systematic debugging methods
- `test-driven-development`: Test-driven development workflow
- `writing-plans`: Formulating implementation plans
- `verification-before-completion`: Pre-completion verification checks
- `using-superpowers`: Skill usage guide

### Domain-Specific Skills

- `bdd-practices`: BDD best practices guidance
- `karpathy-guidelines`: Avoid common LLM coding mistakes
- `robust-design`: Ensure code generalization and handle edge cases
- `semantic-extraction`: Extract information from unstructured text
- `pytorch-advanced`: PyTorch advanced techniques

## MCP Server Configuration

MCP servers are configured in the global `~/.config/opencode/opencode.jsonc`. Enable servers (context7, tavily, etc.) as needed for each project.

## Configuration Files

- **Project Configuration**: `./opencode.json`
- **Global Configuration**: `~/.config/opencode/opencode.jsonc`
- **Agent Configuration**: `./AGENTS.md`

## Quick Start

1. **Install Dependencies**: Ensure OpenCode and related tools are installed
2. **Configure Environment**: Adjust `opencode.json` or global configuration as needed
3. **Use Skills**: Call the `skill` tool in conversations to load required skills
4. **Follow Standards**: Refer to development standards and workflows in `AGENTS.md`

## File Structure

```text
Project Root/
├── AGENTS.md              # Agent configuration and development standards
├── README.md              # This file (Chinese)
├── README-EN.md           # This file (English)
├── opencode.json          # OpenCode project configuration
├── .agents/skills/        # Skills directory
├── .opencode/             # OpenCode configuration and plugins
└── .rules/                # Rules files
```

## Development Standards

The project follows strict development standards, detailed in `AGENTS.md`, including:

- **Security Red Lines**: Input validation, parameterized queries, encryption standards, etc.
- **Code Quality**: Exception handling, TDD discipline, generalization principles
- **Architecture Principles**: Single responsibility, clear hierarchy, dependency inversion
- **Delivery Checklist**: Verification, testing, documentation, cleanup

## Verification Commands

- **Python Testing**: `pytest` or `python -m pytest`
- **Code Checking**: `ruff check .`
- **Code Formatting**: `ruff format .`

## Related Resources

- [OpenCode Documentation](https://opencode.ai)
- [Superpowers Plugin](https://github.com/obra/superpowers)
- [MCP Server Configuration](https://modelcontextprotocol.io)
