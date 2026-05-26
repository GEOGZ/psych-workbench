# Personal Workbench - Claude Code 项目指南

## 项目定位

心理测评服务独立个体经营者的**个人工作台系统**。单租户架构，支持客户/项目全生命周期管理、RBAC 权限控制、客户只读门户。

**仓库**: https://github.com/GEOGZ/psych-workbench.git
**部署**: Vercel (prj_Xgr2IyhdsdRHi0WSVIGWNgHBVzzI)
**本地路径**: `/Users/gzh/Library/CloudStorage/OneDrive-个人/Project Melody/psych-test-Project`

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js 14 (App Router) | ^14.2.5 |
| 语言 | TypeScript | strict 模式 |
| API | tRPC + Zod | v10 + v3 |
| 数据库 | PostgreSQL + Drizzle ORM | pg@8 + drizzle@0.30 |
| 认证 | NextAuth v4 + Email Magic Link | ^4.24.7 |
| 状态管理 | Zustand | ^4.5.4 |
| 测试 | Vitest + Playwright | v1.6 + v1.45 |
| 部署 | Vercel + GitHub Actions | Node 20.x |

---

## 项目结构

```
src/
  app/                    # Next.js App Router
    (portal)/             # 客户只读门户路由组
      portal/[token]/     # Magic-link 入口
      portal/expired/     # 令牌过期页
    (workbench)/          # 管理工作台路由组
      workbench/          # Dashboard + 各模块
    api/auth/             # NextAuth 路由
    api/trpc/             # tRPC API 路由
  auth/                   # 认证适配器
  components/             # React 组件
  db/                     # 数据库
    schema/               # Drizzle 表定义 (12 张表)
    migrations/           # 迁移文件
  lib/                    # 工具函数
  server/                 # 服务端代码
    email/                # 邮件发送
    state/                # 项目状态机推进
    trpc/                 # tRPC 路由和中间件
  types/                  # 类型声明
tests/
  unit/                   # 单元测试
  server/                 # API 路由测试
  db/                     # 数据库测试 (需 Docker)
  e2e/                    # Playwright E2E
docs/                     # 业务文档 (SOP/PRD/架构)
```

---

## 核心数据模型

### 8 阶段项目状态机

```
lead → qualifying → discovery → contract → execution → reporting → closing → done
```

### RBAC 四角色

| 角色 | 权限范围 |
|------|----------|
| owner | 全权 + 主权操作（任命 admin、转让所有权）|
| admin | 全业务写，无主权操作 |
| contractor | 仅被 grant 的项目，字段过滤 |
| client_readonly | Magic-link 只读自家项目进度 |

### 关键表

- `users` — 用户 (role: owner/admin/contractor)
- `clients` — 客户档案 (crisisContact* NOT NULL)
- `projects` — 项目 (8 状态 + stageMeta JSONB)
- `project_events` — 审计流水 (append-only)
- `hat_logs` — 四顶帽子时间记录
- `client_portal_tokens` — 客户门户 magic-link
- `contractor_grants` — 外包授权 (expiresAt)

---

## 环境要求

### Node.js

```bash
# 使用 nvm 管理 Node 版本
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"
nvm use 20
```

### 数据库

```bash
# PostgreSQL 16 (Homebrew)
brew services start postgresql@16

# 数据库已创建: workbench
# 连接: postgresql://gzh@localhost:5432/workbench
```

### 环境变量

`.env` 文件（已创建，不提交到 Git）：

```
DATABASE_URL=postgresql://gzh@localhost:5432/workbench
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<已生成>
EMAIL_SERVER_HOST=<配置你的 SMTP>
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=<>
EMAIL_SERVER_PASSWORD=<>
EMAIL_FROM=<>
PORTAL_BASE_URL=http://localhost:3000
```

---

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器 (localhost:3000)

# 代码质量
npm run typecheck        # TypeScript 检查
npm run lint             # ESLint

# 测试
npm run test             # Vitest 单元/集成测试
npm run test:e2e         # Playwright E2E 测试

# 数据库
npm run db:generate      # Drizzle 生成迁移
npm run db:migrate       # 执行迁移
npm run db:studio        # Drizzle Studio GUI

# 构建
npm run build            # Next.js 生产构建
```

---

## 开发规范

### 代码规范

- **不可变性**: 始终创建新对象，绝不 mutate
- **文件大小**: 200-400 行典型，800 行上限
- **函数大小**: < 50 行
- **嵌套深度**: 不超过 4 层
- **错误处理**: 全面 try/catch，不泄漏敏感信息
- **输入验证**: 所有用户输入用 Zod 校验

### Git 规范

```
<type>: <description>

types: feat, fix, refactor, docs, test, chore, perf, ci
```

### 测试规范

- 最小覆盖率 80%
- TDD 流程: 写测试(RED) → 实现(GREEN) → 重构(IMPROVE)
- 新功能必须先用 tdd-guide agent

---

## 关键业务规则

### 经营手册红线（代码守护）

| 条款 | 守护方式 |
|------|----------|
| §4.2 报告禁 AI 直接对客 | v1 不做报告功能 |
| §4.3 不外包客户关系 | contractor 看不到客户联系/危机联系人/金额 |
| §5.3 不直接联系受测者 | v1 不存受测者数据 |
| §6.1 并发 ≤3 | Dashboard 自警（人工）|
| §八 危机联系人必填 | `clients.crisisContact*` NOT NULL |
| 账户主权 | `role='owner'` 限 1 行，仅 owner 能任命/撤销 admin |

### 状态推进规则

- 仅允许预定义的状态转换（见 `src/server/state/transitions.ts`）
- 前进时必须完成当前阶段自检清单
- 事务内完成：行锁 → 清单检查 → 状态更新 → 审计记录
- 邮件通知 fire-and-forget，失败不影响推进

---

## 部署

### Vercel 自动部署

- `main` 分支推送 → 自动部署到生产
- CI 检查：TypeScript + ESLint（GitHub Actions）

### 环境变量（Vercel Dashboard 配置）

- `DATABASE_URL` — 生产数据库
- `NEXTAUTH_SECRET` — 生产密钥
- `EMAIL_SERVER_*` — 生产 SMTP
- `PORTAL_BASE_URL` — 生产域名

---

## 故障排查

### 常见问题

| 问题 | 解决 |
|------|------|
| `DATABASE_URL is not set` | 检查 `.env` 文件 |
| `tx.select is not a function` | state-machine 测试 mock 需更新 |
| testcontainers 失败 | 需要 Docker，或跳过 DB 测试 |
| OneDrive 同步冲突 | 始终用 Git 推拉，不依赖文件同步 |

### 多机同步注意

- **代码**: Git 推拉（origin: github.com/GEOGZ/psych-workbench）
- **环境**: 各机器独立 `.env`
- **数据库**: 各机器独立本地 Postgres（或共用远程）
- **node_modules**: 各自 `npm ci`，不提交

---

## 文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 全景 SOP | `docs/00-全景SOP.md` | 业务全貌导航 |
| 经营手册 | `docs/独立个体经营手册.md` | 宪法级规范 |
| PRD | `docs/PRD/PRD.md` | 产品需求 |
| 技术架构 | `docs/tech-architecture.md` | 架构设计 |
| 客户旅程 | `docs/customer-journey.md` | 用户旅程 |
| Handoff | `docs/HANDOFF-2026-05-23-v3.md` | 跨会话上下文 |
| Design Spec | `docs/superpowers/specs/` | 设计规格 |

---

## 会话启动检查清单

新会话开始时：

1. [ ] 确认在正确目录：`cd '/Users/gzh/Library/CloudStorage/OneDrive-个人/Project Melody/psych-test-Project'`
2. [ ] 激活 Node 20：`nvm use 20`
3. [ ] 检查 Git 状态：`git status`
4. [ ] 读取 Handoff 文档（如有）
5. [ ] 确认当前任务范围
