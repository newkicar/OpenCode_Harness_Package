---
name: worktree-isolation
description: 使用 git worktree 创建隔离开发环境，不干扰主分支。实现新功能或开始实验时激活。
---

# Worktree 隔离

> 在开始大的功能开发或实验前，使用 git worktree 创建隔离的工作空间。
> 保证主分支始终处于可工作状态。

## 步骤

### 1. 创建 worktree

```bash
# 基于当前分支创建
git worktree add ../project-name-feature feature-branch

# 或者基于远程分支
git worktree add ../project-name-feature -b feature-branch origin/main
```

### 2. 在 worktree 中工作

```bash
cd ../project-name-feature
npm install  # 或 pip install -e .
# ... 开发、测试 ...
```

### 3. 推送和清理

```bash
# 在 worktree 中
git add . && git commit -m "feat: ..."
git push origin feature-branch

# 回到主项目
cd ../project-name

# 删除 worktree
git worktree remove project-name-feature

# 列出剩余 worktree
git worktree list
```

## 不适用场景

- 小改动（单文件、< 20 行）→ 直接在主分支修改
- 修 bug → 直接在 bugfix 分支修改
- 只是想快速验证想法 → 用 `git stash` 或临时分支

## 注意事项

- worktree 共享同一个 `.git` 目录，但工作目录独立
- 切换分支在 worktree 内进行，不影响其他 worktree
- 删除 worktree 前确保所有更改已提交或 stash
