# 技术架构建议书

> **文档编号**：TA-2024-001  
> **版本**：v1.4.0  
> **日期**：2026-05-30  
> **编写**：大马 🐴  
> **目标读者**：技术负责人、Claude Code 开发者、架构评审委员会  
> **关联文档**：[PRD.md](./PRD.md) | [客户旅程地图](./customer-journey.md) | [全景SOP](./00-全景SOP.md)

---

## 零、域名与入口架构（v1.3 新增）

| 域名 | 用途 | 部署 |
|------|------|------|
| `www.wisepsy.cn` | 品牌官网落地页（含"进入运营系统"CTA） | 同一 Next.js 项目，`/` 路由 |
| `admin.wisepsy.cn` | 运营系统 / 工作台（本系统） | 同一 Next.js 项目，Next.js middleware 将根路径跳转 `/login` |
| `admin.wisepsy.cn/portal/[token]` | 客户门户（token 鉴权，只读） | 同上 |

**入口关系：**

```
www.wisepsy.cn（官网落地页）
  ├── 顶部导航"运营系统登录" → admin.wisepsy.cn/login
  └── Hero CTA"进入运营系统" → admin.wisepsy.cn/login

admin.wisepsy.cn/（根路径）
  └── Next.js middleware redirect → /login

admin.wisepsy.cn/login（登录页）
  └── 底部"返回官网" → www.wisepsy.cn

admin.wisepsy.cn/workbench（工作台）
  └── 顶部 WisePsy 品牌链接 → www.wisepsy.cn（新标签页）
```

**同仓库双域名部署（Vercel）：**
- 同一 Next.js 项目同时绑定 `www.wisepsy.cn` 和 `admin.wisepsy.cn`
- `src/middleware.ts` 通过 `host` header 区分域名并分流
- 无需独立部署，零额外运维成本

---

## 一、架构设计原则

### 1.1 核心原则

| 原则 | 说明 | 决策影响 |
|------|------|----------|
| **渐进式复杂** | 从简单开始，按需引入复杂度 | 初期 SQLite → 后期 PostgreSQL |
| **文档即代码** | SOP/PRD 与代码同仓库，版本同步 | 所有业务文档纳入 Git 管理 |
| **状态机驱动** | 业务流程用显式状态机建模 | 选择 XState 或自研状态机引擎 |
| **类型安全优先** | 全链路 TypeScript，API 契约自动生成 | 拒绝 any，强制 strict 模式 |
| **Claude Code 友好** | 目录结构、命名规范、模块化设计便于 AI 理解 | 单文件职责 < 300 行 |

### 1.2 技术选型约束

```
✅ 必须支持：
   - TypeScript 严格模式
   - React 18+ (函数组件 + Hooks)
   - 显式状态管理（拒绝隐式魔法）
   - 自动化测试（单元 + 集成 + E2E）
   - 一键部署（Vercel / Railway / Fly.io）

❌ 避免使用：
   - 过度抽象的 ORM（如 Prisma 初期可接受，后期考虑迁移）
   - 隐式全局状态（如 Redux 不加规范）
   - 未类型化的 API 层
   - 超过 3 层的嵌套组件
```

---

## 二、系统架构总览

### 2.1 架构分层图

```
┌─────────────────────────────────────────────────────────────┐
│                      表现层 (Presentation)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  客户门户    │  │  管理后台    │  │  报告查看器 (PDF/网页) │  │
│  │  (Next.js)  │  │  (Next.js)  │  │  (React + PDF-lib)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      API 层 (API Layer)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  REST API   │  │  WebSocket  │  │  Webhook 处理器      │  │
│  │  (tRPC)     │  │  (实时通知)  │  │  (第三方集成)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     业务逻辑层 (Domain)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  状态机引擎  │  │  工作流引擎  │  │  报告生成器          │  │
│  │  (XState)   │  │  (自研)      │  │  (模板引擎)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     数据访问层 (Data Access)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  主数据库    │  │  文件存储    │  │  缓存层             │  │
│  │  (SQLite/   │  │  (本地/S3)   │  │  (Redis/Memory)     │  │
│  │   PostgreSQL)│  │              │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈选型

| 层级 | 技术选型 | 备选方案 | 选择理由 |
|------|----------|----------|----------|
| **前端框架** | Next.js 14 (App Router) | Remix, Astro | SSR/SSG 一体、Vercel 原生支持、Claude Code 生态成熟 |
| **UI 组件库** | Shadcn/ui + Tailwind CSS | Ant Design, Chakra UI | 无运行时依赖、可定制、与 Tailwind 无缝集成 |
| **状态管理** | Zustand + XState | Redux Toolkit, Jotai | Zustand 极简、XState 显式状态机完美匹配业务 |
| **API 层** | tRPC + Zod | GraphQL, REST + OpenAPI | 端到端类型安全、自动 API 文档、开发体验最佳 |
| **数据库** | SQLite (初期) → PostgreSQL | MySQL, MongoDB | 零配置启动、后期无缝迁移到 PostgreSQL |
| **ORM** | Drizzle ORM | Prisma, TypeORM | 类型安全、SQL-like API、无运行时依赖 |
| **认证** | NextAuth.js v5 | Clerk, Auth0 | 自托管、多种 Provider、与 Next.js 深度集成 |
| **文件存储** | 本地文件系统 → AWS S3 | MinIO, Cloudflare R2 | 初期零成本、后期云原生 |
| **报告生成** | Puppeteer + PDF-lib | React-PDF, LaTeX | HTML→PDF 灵活、支持复杂布局 |
| **部署** | Vercel (前端) + Railway (DB) | Fly.io, Render | 一键部署、自动 HTTPS、成本可控 |
| **监控** | Vercel Analytics + Sentry | Datadog, LogRocket | 免费额度充足、集成简单 |

---

## 三、核心模块设计

### 3.1 业务流程状态机（核心）

基于 PRD 第4章的 6 阶段状态机，技术实现采用 **XState** 显式建模：

```typescript
// src/machines/projectMachine.ts
import { createMachine, assign } from 'xstate';

export const projectMachine = createMachine({
  id: 'project',
  initial: 'draft',
  context: {
    projectId: '',
    currentStage: 0,
    slaDeadlines: {},
    approvals: [],
    risks: [],
  },
  states: {
    draft: {
      on: {
        SUBMIT: {
          target: 'pending_approval',
          guard: 'isValidDraft',
        },
      },
    },
    pending_approval: {
      on: {
        APPROVE: { target: 'active', actions: 'recordApproval' },
        REJECT: { target: 'draft', actions: 'recordRejection' },
      },
    },
    active: {
      type: 'parallel',
      states: {
        stage: {
          initial: 'stage_0',
          states: {
            stage_0: { on: { COMPLETE: 'stage_1' } },
            stage_1: { on: { COMPLETE: 'stage_2' } },
            stage_2: { on: { COMPLETE: 'stage_3' } },
            stage_3: { on: { COMPLETE: 'stage_4' } },
            stage_4: { on: { COMPLETE: 'stage_5' } },
            stage_5: { on: { COMPLETE: 'completed' } },
          },
        },
        monitoring: {
          initial: 'normal',
          states: {
            normal: { on: { SLA_WARNING: 'warning' } },
            warning: { on: { SLA_BREACH: 'breached', RESOLVE: 'normal' } },
            breached: { on: { ESCALATE: 'escalated' } },
            escalated: {},
          },
        },
      },
      on: {
        PAUSE: 'paused',
        CANCEL: 'cancelled',
      },
    },
    paused: {
      on: { RESUME: 'active', CANCEL: 'cancelled' },
    },
    completed: {
      type: 'final',
      entry: 'triggerPostProjectWorkflow',
    },
    cancelled: {
      type: 'final',
      entry: 'cleanupResources',
    },
  },
});
```

**关键设计决策**：
- 使用 **并行状态** 分离「阶段推进」和「监控预警」两条线
- 所有状态转换必须通过 **显式事件** 触发，禁止隐式跳转
- 状态机持久化到数据库，支持断点续传

### 3.2 数据模型设计

基于 PRD 第5章 ER 图，核心实体关系：

```typescript
// src/db/schema.ts (Drizzle ORM)
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 客户实体
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry').notNull(),
  scale: text('scale').notNull(), // enterprise | mid | small
  contactInfo: text('contact_info', { mode: 'json' }),
  riskLevel: text('risk_level').notNull().default('medium'), // low | medium | high
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// 项目实体（状态机实例）
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'), // 状态机当前状态
  currentStage: integer('current_stage').notNull().default(0),
  stageProgress: real('stage_progress').notNull().default(0), // 0-100
  slaConfig: text('sla_config', { mode: 'json' }), // 各阶段 SLA 配置
  stateMachineContext: text('sm_context', { mode: 'json' }), // XState 上下文快照
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// 阶段执行记录
export const stageExecutions = sqliteTable('stage_executions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  stageNumber: integer('stage_number').notNull(), // 0-5
  status: text('status').notNull().default('pending'), // pending | active | completed | blocked
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  deliverables: text('deliverables', { mode: 'json' }), // 交付物清单
  checklist: text('checklist', { mode: 'json' }), // 检查项完成情况
  notes: text('notes'),
});

// 报告实体
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  type: text('type').notNull(), // individual | group | aggregate
  status: text('status').notNull().default('generating'), // generating | ready | delivered
  templateId: text('template_id').notNull(),
  dataSnapshot: text('data_snapshot', { mode: 'json' }), // 报告数据源
  generatedAt: integer('generated_at', { mode: 'timestamp' }),
  fileUrl: text('file_url'),
});

// 关系定义
export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  stages: many(stageExecutions),
  reports: many(reports),
}));
```

**迁移策略**：
- 初期 SQLite 单文件，便于 Claude Code 本地开发
- 数据量 > 10GB 或并发 > 100 时迁移至 PostgreSQL
- Drizzle ORM 支持 SQLite → PostgreSQL 无缝迁移

> **实际已实现（PostgreSQL / Neon）**：上述为设计期草图。当前生产 schema 基于 PostgreSQL，核心表如下：
>
> | 表 | 关键字段 |
> |----|---------|
> | `users` | `id`, `email`, `name`, `role (enum: owner/admin/contractor)`, `invited_by_user_id`, `last_login_at`, `created_at`, `updated_at` |
> | `clients` | `id`, `name`, `contact_name`, `contact_email`, `contact_phone`, `crisis_contact_name`, `crisis_contact_phone`, `notes`, `created_at` |
> | `projects` | `id`, `client_id`, `title`, `state`, `stage_meta (jsonb)`, `created_at`, `updated_at` |
> | `sessions` / `verification_tokens` | NextAuth 数据库会话表 |
>
> **用户管理 tRPC 端点**（`src/server/trpc/router/users.ts`，仅 owner 可调用）：
> - `users.list` — 列出所有用户，含 `lastLoginAt`
> - `users.invite` — 预设账号（姓名必填）；邮箱已存在时更新信息
> - `users.updateProfile` — 按 userId 修改姓名（内联编辑）
> - `users.setRole` — 修改角色（不可修改自己）
> - `users.delete` — 删除用户（不可删除自己）
>
> 每次登录通过 NextAuth `events.signIn` 回调自动更新 `last_login_at`。

### 3.3 报告生成引擎

```
┌─────────────────────────────────────────────────────────────┐
│                    报告生成流水线                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  数据源聚合 → 模板选择 → 数据填充 → 渲染引擎 → 输出格式      │
│      │           │          │         │         │           │
│      ▼           ▼          ▼         ▼         ▼           │
│  ┌────────┐  ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐     │
│  │ 测试数据 │  │ 报告模板 │ │ 变量替换 │ │ HTML  │ │ PDF/   │     │
│  │ 客户信息 │  │ (EJS/   │ │ 条件逻辑 │ │ 渲染   │ │ 网页/  │     │
│  │ 群体统计 │  │ Handlebars)│ 循环处理 │ │       │ │ API    │     │
│  └────────┘  └────────┘ └────────┘ └──────┘ └────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**技术实现**：
- 模板引擎：Handlebars（逻辑简单）或 EJS（需要复杂逻辑时）
- HTML→PDF：Puppeteer（Chrome headless）
- 群体报告：先聚合个体数据，再应用统计模板
- 缓存策略：相同参数报告缓存 24 小时

---

## 四、非功能需求技术方案

### 4.1 性能指标达成路径

| 指标 | 目标值 | 技术方案 |
|------|--------|----------|
| 首屏加载 | < 2s | Next.js SSR + 图片优化 + 代码分割 |
| API 响应 | < 200ms | 数据库索引 + 连接池 + 查询优化 |
| 报告生成 | < 30s | 异步队列 + 增量渲染 + 缓存 |
| 并发用户 | 100+ | 无状态服务 + 水平扩展 |
| 数据导出 | < 60s | 流式处理 + 分页 + 后台任务 |

### 4.2 安全架构

```
┌─────────────────────────────────────────────────────────────┐
│                      安全分层                                 │
├─────────────────────────────────────────────────────────────┤
│  边缘层：Cloudflare / Vercel Edge — DDoS 防护、WAF           │
├─────────────────────────────────────────────────────────────┤
│  传输层：TLS 1.3 + HSTS + 证书固定                            │
├─────────────────────────────────────────────────────────────┤
│  认证层：NextAuth.js — OAuth 2.0 / SAML / 企业微信            │
├─────────────────────────────────────────────────────────────┤
│  授权层：RBAC — 角色-权限矩阵（参见 PRD 第3章）               │
├─────────────────────────────────────────────────────────────┤
│  数据层：字段级加密（PII）+ 审计日志 + 备份加密                 │
├─────────────────────────────────────────────────────────────┤
│  应用层：输入校验（Zod）+ SQL 注入防护 + XSS 过滤              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 高可用设计

- **数据库**：SQLite 初期单点，迁移 PostgreSQL 后采用主从 + 定时备份
- **文件存储**：本地 → S3（跨区域冗余）
- **服务部署**：Vercel 自动多区域 CDN
- **灾难恢复**：RPO < 1 小时，RTO < 4 小时

---

## 五、项目结构规范

### 5.1 目录结构（Claude Code 友好）

```
psych-test-saas/
├── 📁 docs/                          # 业务文档（与代码同仓库）
│   ├── PRD.md
│   ├── SOP/
│   ├── customer-journey.md
│   └── tech-architecture.md          # 本文档
│
├── 📁 src/
│   ├── 📁 app/                       # Next.js App Router
│   │   ├── (dashboard)/              # 管理后台路由组
│   │   │   ├── projects/
│   │   │   ├── clients/
│   │   │   └── reports/
│   │   ├── (portal)/                 # 客户门户路由组
│   │   └── api/                      # API 路由（tRPC 入口）
│   │
│   ├── 📁 components/                # React 组件
│   │   ├── ui/                       # 基础 UI（Shadcn/ui）
│   │   ├── forms/                    # 表单组件
│   │   ├── charts/                   # 数据可视化
│   │   └── project/                  # 项目相关组件
│   │
│   ├── 📁 lib/                       # 工具库
│   │   ├── utils.ts                  # 通用工具
│   │   ├── constants.ts              # 常量定义
│   │   └── validations.ts            # Zod Schema
│   │
│   ├── 📁 server/                    # 服务端代码
│   │   ├── 📁 api/                   # tRPC Routers
│   │   │   ├── routers/
│   │   │   │   ├── project.ts
│   │   │   │   ├── client.ts
│   │   │   │   └── report.ts
│   │   │   └── trpc.ts               # tRPC 初始化
│   │   ├── 📁 db/                    # 数据库
│   │   │   ├── schema.ts             # Drizzle Schema
│   │   │   └── migrations/           # 迁移文件
│   │   ├── 📁 auth/                  # 认证逻辑
│   │   │   └── index.ts              # NextAuth 配置
│   │   └── 📁 services/              # 业务服务层
│   │       ├── project.service.ts
│   │       ├── report.service.ts
│   │       └── workflow.service.ts
│   │
│   ├── 📁 machines/                  # XState 状态机
│   │   ├── project.machine.ts
│   │   ├── stage.machine.ts
│   │   └── report.machine.ts
│   │
│   ├── 📁 types/                     # TypeScript 类型
│   │   ├── project.ts
│   │   ├── client.ts
│   │   └── api.ts
│   │
│   └── 📁 hooks/                     # React Hooks
│       ├── useProject.ts
│       ├── useStage.ts
│       └── useReport.ts
│
├── 📁 tests/
│   ├── unit/                         # 单元测试（Vitest）
│   ├── integration/                  # 集成测试
│   └── e2e/                          # E2E 测试（Playwright）
│
├── 📁 scripts/                       # 工具脚本
│   ├── seed.ts                       # 数据初始化
│   └── migrate.ts                    # 迁移脚本
│
├── .env.example                      # 环境变量模板
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── drizzle.config.ts
└── package.json
```

### 5.2 文件命名规范

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 组件 | PascalCase | `ProjectCard.tsx`, `StageTimeline.tsx` |
| 工具/Hook | camelCase | `useProject.ts`, `formatDate.ts` |
| 常量 | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`, `STAGE_CONFIG` |
| 类型 | PascalCase + 后缀 | `ProjectStatus`, `ClientInput` |
| 状态机 | kebab-case + .machine.ts | `project.machine.ts` |
| 测试文件 | .test.ts / .spec.ts | `project.test.ts` |

### 5.3 代码规范（Claude Code 优化）

```typescript
// ✅ 推荐：显式类型 + 单一职责 + 自解释命名
export async function transitionProjectStage(
  projectId: string,
  targetStage: StageNumber,
  actorId: string,
): Promise<Result<StageTransition, StageError>> {
  // 1. 验证权限
  // 2. 加载当前状态
  // 3. 执行状态机转换
  // 4. 持久化新状态
  // 5. 发送通知
}

// ❌ 避免：隐式类型 + 多职责 + 缩写
function moveProj(id, stage, user) {
  // 混在一起处理...
}
```

---

## 六、开发工作流

### 6.1 Claude Code 协作模式

```
┌─────────────────────────────────────────────────────────────┐
│                  Claude Code 开发循环                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 需求澄清    →  2. 任务拆分  →  3. 代码生成  →  4. 验证   │
│      │               │              │            │          │
│      ▼               ▼              ▼            ▼          │
│  ┌────────┐      ┌────────┐    ┌────────┐   ┌────────┐     │
│  │ 阅读 PRD│      │ <300行  │    │ 类型优先 │   │ 测试驱动 │     │
│  │ 确认边界│      │ 单文件  │    │ 显式状态 │   │ 自动化  │     │
│  └────────┘      └────────┘    └────────┘   └────────┘     │
│                                                             │
│  5. 文档同步    →  6. 代码审查  →  7. 合并部署               │
│      │               │              │                       │
│      ▼               ▼              ▼                       │
│  ┌────────┐      ┌────────┐    ┌────────┐                  │
│  │ SOP更新 │      │ 自审+AI │    │ CI/CD  │                  │
│  │ 变更记录│      │ 双审    │    │ 自动化  │                  │
│  └────────┘      └────────┘    └────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 分支策略

```
main (生产环境)
  ↑
release/v1.0.0 (预发布)
  ↑
develop (开发集成)
  ↑
feature/project-state-machine  ← Claude Code 工作分支
feature/report-generation
bugfix/sla-calculation
```

### 6.3 测试策略

| 测试类型 | 工具 | 覆盖目标 | 执行时机 |
|----------|------|----------|----------|
| 单元测试 | Vitest | 业务逻辑、工具函数 | 每次提交 |
| 集成测试 | Vitest + test DB | API 端点、数据库操作 | PR 时 |
| E2E 测试 | Playwright | 关键用户流程 | 每日构建 |
| 视觉回归 | Chromatic | UI 组件 | PR 时 |

---

## 七、部署架构

### 7.1 初期部署（MVP）

```
┌─────────────────────────────────────────────────────────────┐
│                      Vercel (免费层)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Next.js 应用                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   前端页面   │  │  API 路由   │  │  边缘函数    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SQLite (Vercel Blob / 本地)              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 生产部署（Scale-up）

```
┌─────────────────────────────────────────────────────────────┐
│                      Vercel Pro                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Next.js 应用                         │   │
│  │              (自动扩缩容 / 全球 CDN)                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Railway / AWS RDS                       │   │
│  │            PostgreSQL (主从 + 自动备份)                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AWS S3 / Cloudflare R2                  │   │
│  │              文件存储 + CDN 分发                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| SQLite 性能瓶颈 | 高 | 中 | 预设迁移路径到 PostgreSQL，监控查询性能 |
| 状态机复杂度失控 | 高 | 中 | 模块化拆分，单状态机 < 20 个状态 |
| 报告生成超时 | 中 | 高 | 异步队列 + 进度反馈 + 超时降级 |
| 第三方电子签集成失败 | 中 | 低 | 抽象适配层，支持多厂商切换 |
| Claude Code 生成代码质量不稳定 | 中 | 中 | 严格 Code Review + 测试覆盖 + 类型约束 |

---

## 九、实施路线图

### Phase 1：MVP（4-6 周）
- [ ] 项目基础框架（Next.js + tRPC + Drizzle）
- [ ] 客户管理模块（CRUD + 准入评分）
- [ ] 项目状态机（阶段 0-1 完整流转）
- [ ] 基础报告生成（个人报告 HTML→PDF）
- [ ] 管理后台 Dashboard（项目列表 + 状态看板）

### Phase 2：核心功能（4-6 周）
- [ ] 完整 6 阶段状态机
- [ ] SLA 监控与预警
- [ ] 群体报告生成
- [ ] 客户门户（报告查看 + 下载）
- [ ] 审批工作流

### Phase 3：优化扩展（4-6 周）
- [ ] 数据迁移 PostgreSQL
- [ ] 性能优化（缓存 + 索引 + 异步化）
- [ ] 第三方集成（电子签 + 企业微信 + 飞书）
- [ ] 高级分析（项目统计 + 预测）
- [ ] 移动端适配

---

## 十、附录

### 10.1 术语表

| 术语 | 说明 |
|------|------|
| XState | JavaScript 状态机库，支持有限状态机 + 状态图 |
| tRPC | 端到端类型安全的 RPC 框架，TypeScript 原生 |
| Drizzle ORM | 类型安全的 SQL-like ORM，轻量无依赖 |
| Shadcn/ui | 基于 Radix UI 和 Tailwind 的组件库 |
| RPO/RTO | 恢复点目标 / 恢复时间目标 |

### 10.2 参考文档

- [PRD 产品需求文档](./PRD.md)
- [客户旅程地图](./customer-journey.md)
- [全景 SOP](./00-全景SOP.md)
- [Next.js 文档](https://nextjs.org/docs)
- [XState 文档](https://stately.ai/docs)
- [Drizzle ORM 文档](https://orm.drizzle.team)

### 10.3 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0.0-draft | 2024-01-15 | 大马 | 初始版本，建立技术架构框架 |

---

> **文档维护**：本文档由技术负责人维护，架构变更需经过技术评审。  
> **反馈渠道**：对架构的改进建议请提交至技术评审会议。

*本文档是心理测评 SaaS 系统的技术架构权威参考，具体实现细节请以代码和 API 文档为准。*
