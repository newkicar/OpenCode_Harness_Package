# 01 — 搭建项目骨架与验证流水线

**What to build:** 项目初始化——建目录结构、配 lint/test/CI、确保 `tsc --noEmit` 通过、验证 CI 全绿。完成后后续开发有可重复的构建和验证基础。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 建目录结构（src/, tests/, configs/ 等）
- [ ] 配置 TypeScript / 语言编译器
- [ ] 配置 linter（eslint / ruff / markdownlint）
- [ ] 配置测试框架（vitest / pytest / jest）
- [ ] 配置 CI（GitHub Actions），包含 lint → typecheck → test 流水线
- [ ] 第一个空测试通过
- [ ] CI 全绿
