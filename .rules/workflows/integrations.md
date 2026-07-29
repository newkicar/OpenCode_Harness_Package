# 外部集成（Integrations）

> CI/CD、GitHub PR、Slack 通知的自动化和触发指南。

---

## GitHub PR 自动化

### 前置条件

- `gh` CLI 已安装并登录
- 项目已推送到 GitHub

### 自动创建 PR

验证通过后，使用以下命令创建 PR：

```bash
gh pr create \
  --title "feat: 简明的 PR 标题" \
  --body "## 变更内容\n- 清单\n\n## 验证\n- lint: ✅\n- tests: ✅" \
  --base main
```

### 检查 PR 状态

```bash
gh pr view --json state,title,url
gh pr checks  # 查看 CI 状态
```

### 自动合并（低风险变更）

```bash
gh pr merge --squash --delete-branch
```

---

## Slack 通知

### 前置条件

1. 在 Slack App 中创建 Webhook URL
2. 将 URL 存入项目 `.env`：
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
   ```

### 发送通知

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ Harness 验证通过\n- pytest: 12 passed\n- lint: clean"}' \
  "$SLACK_WEBHOOK_URL"
```

### 通知模板

| 场景 | 内容 | 触发时机 |
|------|------|---------|
| 验证通过 | ✅ [项目名] 验证通过 | verify-changes 全部通过 |
| 验证失败 | ❌ [项目名] 验证失败 | verify-changes 有失败 |
| PR 创建 | 🔀 [项目名] 新 PR: 标题 | `gh pr create` 成功后 |
| CI 通过 | ✅ [项目名] CI 通过 | GitHub Actions 成功 |
| CI 失败 | ❌ [项目名] CI 失败 | GitHub Actions 失败 |

---

## 使用方式

在验证通过后，AI 自动提示：

```
验证通过。是否：
1. 创建 GitHub PR？
2. 推送并通知 Slack？
3. 跳过集成？
```

用户确认后执行对应命令。
