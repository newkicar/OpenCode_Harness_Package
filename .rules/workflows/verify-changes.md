# 验证闭环（Verify Changes）

> 所有 workflow 的必经步骤。写完代码 ≠ 完成任务，必须先验证再交付。

---

## 适用范围

本文件定义该项目的标准验证流程。根据任务风险等级（参见 `task-risk-gates.md`）可适当裁剪：

| 风险等级 | 验证范围 |
|---------|---------|
| 轻量任务 | Markdown lint（如修改了 `.md` 文件） |
| 普通工程任务 | 受影响模块的 lint + test |
| 标准任务 | 全量 lint + test + 类型检查 |
| 高风险任务 | 全量验证 + 额外安全审计 |

---

## 验证命令

```bash
# 1. TypeScript 插件类型检查（如修改了 .opencode/plugins/）
cd .opencode && npx tsc --noEmit

# 2. TypeScript 插件构建（如修改了 .opencode/plugins/）
cd .opencode && npx tsc

# 3. 插件测试
cd .opencode && npm test

# 4. Markdown lint
markdownlint '**/*.md' --ignore node_modules

# 5. JSON 验证
node -e "JSON.parse(require('fs').readFileSync('opencode.json', 'utf8'))"
node -e "JSON.parse(require('fs').readFileSync('.opencode/package.json', 'utf8'))"
```

> 注：Python 命令（`pytest`、`ruff`）仅当目标项目使用 Python 时启用。本 harness 模板不包含 Python 代码。

---

## 流程

1. **确定验证范围** — 根据任务风险等级，选择对应的验证命令
2. **逐项执行** — 按上面的顺序依次运行
3. **记录结果** — 每项标注 ✅ 通过 / ❌ 失败
4. **修复失败项** — 失败项走 `better-errors.md` 分类修复
5. **全部通过后** — 标记任务完成

---

## 与其他规则的关系

- **任务风险分级**：决定验证范围的宽窄
- **Better Errors**：验证失败时的第一响应线
- **交付自检清单**：验证通过后对照清单逐项确认
