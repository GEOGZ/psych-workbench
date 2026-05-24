# 个人工作台 v1 设计 spec

> **日期**:2026-05-23
> **会话**:基于 superpowers:brainstorming 流程产出
> **上游宪法**:`docs/独立个体经营手册.md` v1.1.0-draft、`docs/00-全景SOP.md` v1.1.0-draft
> **下游派生**:`docs/PRD/PRD.md` v1.1(待重写)、`docs/tech-architecture.md` v1.1(待重写)
> **范围**:**v1 极简骨架** — 项目主体限 + 8 状态机 + 今日帽子 widget + 切帽计时

---

## 0. v1 范围声明(读其他章前先读这里)

### 0.1 v1 = 极简骨架

v1 工作台**只做**这 4 件事:

1. 客户/项目档案的最小集
2. 项目 8 状态推进(纯手动、有审计流水、合法性校验)
3. 今日帽子 widget(手动切 + 事后补记)
4. 客户只读 magic-link 门户(只看进度,不下载报告)

### 0.2 v1 显式不做(全部推 v1.5+)

- 阈值化报价合同(总额/周期/范围阈值规则、24h 冷静期倒计时、范围变更拦截)
- 自检清单门禁(合同/报告/上线 三类)
- 报告生成器(react-pdf 模板填空 + LLM 段落)
- 应收账款日历(看板 + 红线告警 + 催款邮件草稿)
- 月度复盘日志
- AI 替代矩阵
- 受测者答题入口(一律走第三方问卷,工作台不碰量表分发)
- 多租户(经营者本人 + 客户 + 偶尔外包,**单租户**)

### 0.3 经营手册红线在 v1 由谁守

| 经营手册条款 | 守护方 |
|---|---|
| §4.2 报告禁 AI 直接对客 | 人(v1 不做报告) |
| §4.3 不外包客户关系 | **代码守(RBAC)** — contractor 看不到客户联系字段、危机联系人、金额;admin 与 owner 同权可见(同公司内部,不受 §4.3 约束) |
| §5.3 不直接联系受测者 | 物理边界(v1 不存受测者数据) |
| §6.1 并发 ≤3 | 人 — Dashboard 显示当前 execution+reporting 项目数自警 |
| §6.2 50/30/20 收款 + 应收红线 | 人(v1 不做应收) |
| §7.1 4h 响应/7 工作日交付 | 人(v1 不做 SLA 监控) |
| §八 危机干预联系人必填 | **代码守** — `clients.crisisContactName/Phone` NOT NULL |
| 账户主权 | **代码守** — DB partial unique index 限定 `role='owner'` 至多 1 行,仅 owner 能任命/撤销 admin |

> **§4.3 口径脚注**:经营手册 §4.3「不外包客户关系」中的「外包」在本 spec 范围内**仅指 `contractor` 角色**(外部第三方,有 `expiresAt`)。`admin` 是同公司合伙人/员工,不属于「外包」,因此与 owner 同视野(可见客户联系字段、危机联系人、金额)。

### 0.4 v1 完成的判据

跑两个月后回看 — 哪条红线最常被自己破,**那条优先工程化进 v1.5**。这条原则比"按手册 P0 顺序做"更重要。

---

## 1. 架构总览

### 1.1 部署边界

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (Next.js 14)                      │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │ /(workbench)         │  │ /(portal)                │    │
│  │ 经营者主控台         │  │ 客户只读 magic-link      │    │
│  │ - /projects          │  │ - /portal/[token]/       │    │
│  │ - /hat               │  │   project/[id]           │    │
│  │ - / (dashboard)      │  │                          │    │
│  └──────────────────────┘  └──────────────────────────┘    │
│              │                          │                   │
│              ▼                          ▼                   │
│        ┌───────────────────────────────────────┐            │
│        │ tRPC routers (server/trpc/router/)    │            │
│        │  - projects  - hatLog  - clients      │            │
│        │  - auth      - portal                 │            │
│        └───────────────────────────────────────┘            │
│                          │                                  │
│                          ▼                                  │
│        ┌───────────────────────────────────────┐            │
│        │ state machine (server/state/)         │            │
│        │ 纯 TS enum + 事务推进函数             │            │
│        └───────────────────────────────────────┘            │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
                ┌──────────────────────┐
                │ Neon Postgres        │
                │ (Drizzle ORM)        │
                └──────────────────────┘

本地(v1 不接,留 v1.5)
   ↑
   └── 原始量表数据 / 访谈原文 / 报告成品 → 本地 vault(手工管)
```

### 1.2 数据隔离原则

| 数据类别 | 存储位置 | 进 v1 工作台? |
|---|---|---|
| 项目元信息(名称、状态、日期) | 云端 Neon | ✅ |
| 客户基本档案(姓名、公司、联系方式、危机联系人) | 云端 Neon | ✅ |
| 帽子日志 | 云端 Neon | ✅ |
| 状态推进流水 | 云端 Neon | ✅ |
| **原始量表数据/访谈原文** | **本地 vault** | **❌(v1 不接)** |
| **报告成品 PDF** | **本地 vault** | **❌(v1 不接)** |
| 受测者个人信息 | 不存 | ❌ |

**经营手册 §5.3 自动满足**:原始数据物理上够不到云端,客户门户访问不到。

### 1.3 技术栈(沿用 tech-architecture v1.1 调整后版本)

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | Next.js 14 App Router | 沿用 |
| API | tRPC | 沿用,单人维护友好 |
| ORM | Drizzle | 沿用 |
| 数据库 | Neon Postgres | 免费 tier 够 v1 |
| 认证 | NextAuth v4 (stable) | 从 v5 降回 v4 |
| 状态管理 | Zustand | 已去掉 XState |
| PDF | (v1 不需要) | 报告生成器进 v1.5 才接 react-pdf |
| 部署 | Vercel | 沿用 |
| 测试 | Vitest + Playwright | 沿用 |

**特意删除的**:
- `src/machines/` 目录(原 XState)— 状态机改纯 TS enum + 事务函数
- Puppeteer + PDF-lib(原报告)— v1 不上报告

**Postgres 扩展**:启用 `btree_gist`(`hat_logs` exclusion constraint 必需,见 §2.5)。Neon 默认未启用,首次 migration 含 `CREATE EXTENSION IF NOT EXISTS btree_gist;`。

---

## 2. 数据模型

7 张表,Drizzle schema 草稿。所有表均有 `id` (uuid pk)、`createdAt`、`updatedAt`(除流水表)。

### 2.1 users

```ts
users: {
  id: uuid pk,
  email: text unique not null,
  emailVerified: timestamp,
  role: enum('owner', 'admin', 'contractor') not null,
  invitedByUserId: uuid fk → users.id,  // admin 由谁任命(owner 或上一任 owner)
  createdAt, updatedAt
}

// DB 约束:owner 至多 1 行
CREATE UNIQUE INDEX users_single_owner ON users ((1)) WHERE role = 'owner';
```

- `role='owner'` 由 DB partial unique index 强制至多 1 行(防并发 transferOwnership 出现双 owner)
- `role='admin'`:同公司内部合伙人/员工,N 个,与 owner 近似同权;只有 owner 能任命/撤销
- `role='contractor'` 的过期由 `contractor_grants.expiresAt` 表达 — 没有 grant 的 contractor 等于零权限,因此不在 users 表上单设 `expiresAt`,避免「身份过期 vs 授权过期」的双轨语义

### 2.2 clients

```ts
clients: {
  id: uuid pk,
  name: text not null,                  // 公司名
  contactName: text not null,           // 对接人
  contactEmail: text,
  contactPhone: text,
  crisisContactName: text not null,     // 经营手册 §八 必填
  crisisContactPhone: text not null,    // 经营手册 §八 必填
  notes: text,
  createdAt, updatedAt
}
```

- `crisisContact*` NOT NULL 是经营手册红线的代码体现
- 没有 `tenantId`(单租户)

### 2.3 projects

```ts
projects: {
  id: uuid pk,
  clientId: uuid fk → clients.id not null,
  name: text not null,
  scope: text,                          // 范围说明,纯文本(v1 不做结构化)
  state: enum(ProjectState) not null default 'lead',
  startDate: date,
  expectedEndDate: date,
  amountTotal: numeric(12,2),           // 仅展示,v1 不做阈值规则
  notes: text,
  createdAt, updatedAt
}

enum ProjectState {
  Lead, Qualifying, Discovery,
  Contract, Execution, Reporting,
  Closing, Done
}
```

### 2.4 project_events(状态推进与节点流水)

```ts
project_events: {
  id: uuid pk,
  projectId: uuid fk → projects.id not null,
  type: enum('state_change', 'note') not null,
  fromState: enum(ProjectState),        // 仅 state_change
  toState: enum(ProjectState),          // 仅 state_change
  note: text,
  byUserId: uuid fk → users.id not null,
  at: timestamp not null
}
```

- 不可改、不可删(append-only)— 应用层强制
- 索引:`(projectId, at desc)`

### 2.5 hat_logs

```ts
hat_logs: {
  id: uuid pk,
  userId: uuid fk → users.id not null,
  hat: enum('🎩', '🧠', '🛠', '📊') not null,
  projectId: uuid fk → projects.id,     // 可空(行政时间)
  startAt: timestamp not null,
  endAt: timestamp,                     // 空 = 当前在戴
  source: enum('manual', 'backfill') not null,
  createdAt
}
```

- 同一 `userId` 不允许时间区间重叠 — 数据库 GiST exclusion constraint + 应用层事务校验
- 当前在戴 = `endAt IS NULL` 的最新一行(应用层保证至多一行)

```sql
-- 需启用 btree_gist 扩展(见 §1.3)
ALTER TABLE hat_logs ADD CONSTRAINT hat_logs_no_overlap
EXCLUDE USING gist (
  user_id WITH =,
  tstzrange(start_at, COALESCE(end_at, 'infinity')) WITH &&
);
```

### 2.6 client_portal_tokens

```ts
client_portal_tokens: {
  id: uuid pk,
  clientId: uuid fk → clients.id not null,
  token: text unique not null,          // 32 字节 random hex
  expiresAt: timestamp not null,
  lastUsedAt: timestamp,
  createdAt
}
```

- 默认有效期 90 天,可手动撤销(把 `expiresAt` 设为过去)

### 2.7 contractor_grants

```ts
contractor_grants: {
  id: uuid pk,
  userId: uuid fk → users.id not null,  // 必须 role='contractor'
  projectId: uuid fk → projects.id not null,
  expiresAt: timestamp not null,
  createdAt
}
```

- contractor 用户只能看到 `contractor_grants` 内的项目
- 单项目级粒度,不支持"全公司可见"这种范围

---

## 3. 状态机

### 3.1 合法转换图

```
lead ──┬──→ qualifying ──┬──→ discovery ──┬──→ contract ──→ execution
       │                 │                │                       │
       │                 │                │                       ▼
       └─→ done          └─→ done         └─→ done            reporting
                                                                  │
                                                                  ▼
                                                              closing
                                                                  │
                                                                  ▼
                                                                done
```

- 任意"前期"状态(lead/qualifying/discovery/contract)可直接 → done(早夭/丢单)
- execution 起不允许跳过 reporting 直接 done(交付红线)
- done 终态,无后续

### 3.2 推进函数(伪代码)

```ts
async function advanceProject(
  projectId: string,
  toState: ProjectState,
  byUserId: string,
  note?: string
) {
  return db.transaction(async tx => {
    const proj = await tx
      .select().from(projects)
      .where(eq(projects.id, projectId))
      .for('update');               // 行锁防并发

    if (!transitions[proj.state].includes(toState)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `非法状态推进:${proj.state} → ${toState}`
      });
    }

    await tx.update(projects)
      .set({ state: toState, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await tx.insert(project_events).values({
      projectId,
      type: 'state_change',
      fromState: proj.state,
      toState,
      byUserId,
      note,
      at: new Date()
    });
  });
}
```

### 3.3 v1 故意不做的

- 前置条件校验(自检清单门禁)— v1.5 上自检清单时再加
- 自动事件触发(合同上传 → 自动推进)— v1.5 上文件存储时再加
- 状态回退 — v1 不允许;实在错了走"加 note + 用 done 关掉重新建项目"

---

## 4. 帽子日程

### 4.1 模式

**手动切 + 事后补记**。不自动建议、不与状态机耦合。

### 4.2 Dashboard widget(ASCII 草图)

```
┌─ 今日帽子 ──────────────────────────────┐
│ 现在戴:🛠 (从 09:30 起,已 2h 14m)      │
│ 关联项目:Acme · 高管胜任力评估           │
│ [切到 🎩] [切到 🧠] [切到 📊] [摘下]     │
│                                         │
│ 今日累计:                                │
│   🎩 0:45  🧠 1:30  🛠 2:14  📊 0:00     │
│                                         │
│ [事后补记一段时间]                        │
└─────────────────────────────────────────┘
```

切帽行为:
1. 关闭当前在戴的 hat_log(`endAt = now()`)
2. 插入新 hat_log(`startAt = now()`,`source='manual'`)

"摘下" = 关闭当前 hat_log,不开新的(下班/午休)。

**事务边界**:切帽两步(关旧 + 开新)必须在同一 `db.transaction` 内执行。GiST exclusion constraint 在 commit 时一次性校验,事务内中间状态(旧 endAt 已填、新 startAt 与之首尾相接)不会触发约束;若分两次写,瞬间会出现「旧未关、新已开」的重叠态。

### 4.3 事后补记表单

```
┌─ 补记一段时间 ──────────────────────────┐
│ 日期:[2026-05-23]                       │
│ 起 [09:00]  止 [12:00]                  │
│ 帽子:( ) 🎩 (•) 🧠 ( ) 🛠 ( ) 📊        │
│ 项目:[下拉,可空]                        │
│ [保存]                                  │
└─────────────────────────────────────────┘
```

- 校验:同一 user 时间区间不重叠 — 表单内联报错并高亮冲突段
- 标记 `source='backfill'`

### 4.4 周/月汇总(只读)

简单 SQL 聚合,显示每顶帽子总时数 + 占比。无图表库,纯 HTML 表格。

---

## 5. RBAC 与门户

### 5.1 四种身份

| 角色 | 进入 | 看到 | 能做 |
|------|---|---|---|
| **owner** | NextAuth 邮箱 + magic-link | 全部 | 全部写操作 + 任命/撤销 admin + 转让所有权 + 删账户 |
| **admin** | NextAuth 邮箱 + magic-link | 全部(与 owner 同视野) | 全部业务写操作(项目/客户/帽子/门户 token);**不能** 管理 admin / 删账户 |
| **contractor** | NextAuth 邮箱 + magic-link | 仅被 grant 的项目 — **看不到客户联系字段、危机联系人、金额** | 仅在被授权项目下加 note |
| **client_readonly** | `/portal/[token]` 链接,无登录 | 自家项目的状态、当前阶段、预计交付日 | 无 |

owner vs admin 差异(共 3 项,称为「主权操作」):
- `users.invite(role='admin')`、`users.revoke(role='admin')`
- `users.transferOwnership(toUserId)`
- `account.delete()`

其余所有操作 admin 等同 owner。

### 5.2 server-side guards

```ts
// server/trpc/middleware.ts

// 主权操作专用 — 仅 owner
const ownerOnly = middleware(({ ctx, next }) => {
  if (ctx.user?.role !== 'owner') throw new TRPCError({ code: 'FORBIDDEN' });
  return next();
});

// 业务写操作 — owner 或 admin
const adminOrOwner = middleware(({ ctx, next }) => {
  if (ctx.user?.role !== 'owner' && ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

const contractorScoped = middleware(async ({ ctx, input, next }) => {
  if (ctx.user?.role === 'owner' || ctx.user?.role === 'admin') return next();   // owner/admin 全过
  if (ctx.user?.role !== 'contractor') throw new TRPCError({ code: 'UNAUTHORIZED' });

  const projectId = input?.projectId;              // 调用方需传
  const grant = await db.query.contractor_grants.findFirst({
    where: and(
      eq(contractor_grants.userId, ctx.user.id),
      eq(contractor_grants.projectId, projectId),
      gt(contractor_grants.expiresAt, new Date())
    )
  });
  if (!grant) throw new TRPCError({ code: 'FORBIDDEN' });
  return next();
});
```

**安全约定**:
- 凡挂 `contractorScoped` 的 endpoint,**`input.projectId` 必须存在**;若 contractor 调用方未传 projectId,按 FORBIDDEN 处理(因为 grant 查询会因 `projectId=undefined` 直接 miss → 落 FORBIDDEN 分支)。**此路径必须有单测覆盖**,防止将来重构成「projectId 缺失则放过」的危险默认。
- spec 写作期一份「需挂 contractorScoped 的 router 清单」由 plan 阶段拆出。

### 5.3 客户门户

- 路由 `/portal/[token]` 不走 NextAuth
- 独立中间件:查 `client_portal_tokens`,过期 → 404
- 命中后 set `lastUsedAt`,渲染该 client 的所有项目的极简卡片
- 单项目页 `/portal/[token]/project/[id]`:状态、当前阶段中文名、预计交付日、最近一次状态推进时间
- **不渲染**:金额、scope、note、project_events 内部内容、客户联系字段

**v1 安全边界(显式声明)**:
- token 熵:32 字节随机 hex(见 §2.6),足以抗暴力枚举,因此 v1 **不做 rate limit**(留 v1.5)
- `lastUsedAt` 字段:**仅 owner/admin 在管理面可见**,不向 client_readonly 暴露(避免「最近何时看过」的隐性追踪争议)
- 链接撤销:把 `expiresAt` 设为过去即可,客户侧立即失效

---

## 6. 错误处理

| 场景 | 处理 |
|---|---|
| 状态非法推进 | tRPC `BAD_REQUEST` + 中文消息「非法状态推进:X → Y」 |
| magic-link 过期/无效 | 门户返回静态页:「这个链接已过期,请联系顾问重新发送」 |
| 帽子时间重叠 | 表单内联错误,高亮冲突 hat_log,提示「与 X 项目 09:30-12:00 冲突」 |
| contractor 越权访问 | tRPC `FORBIDDEN`(不暴露具体原因) |
| crisis contact 未填 | clients 表 NOT NULL,创建时表单内联错误 |
| 服务器错误 | 全局 ErrorBoundary + 简体中文兜底页 + 错误 ID 用于查日志 |
| DB 事务失败 | 自动回滚,前端 toast 提示 |

不静默吞错(common/coding-style.md)。所有 server 端错误带 errorId + Sentry 上报(可选 v1.5)。

---

## 7. 测试策略

### 7.1 覆盖率目标

≥ 80%(common/testing.md)。

### 7.2 单元测试(Vitest)

- `transitions` 表 + `advanceProject` — 每对合法转换覆盖一例,代表性非法转换覆盖一例
- hat_logs 时间重叠校验
- contractor RBAC 中间件(过期、grant 缺失、跨项目越权)

### 7.3 集成测试(Vitest + testcontainers)

- tRPC routers 全量(projects/hatLog/clients/portal)
- 起一次性 Postgres 容器,跑 Drizzle migration

### 7.4 E2E(Playwright)

关键流:

1. **owner 流**:登录 → 建客户(含危机联系人)→ 建项目 → 推进 lead → qualifying → ... → done
2. **admin 流**:owner 邀请 admin → admin 登录 → 建客户/项目/推进状态全部能做 → 但调 `users.invite` 被拒(FORBIDDEN)
3. **帽子流**:切 🎩 → 切 🧠 → 摘下 → 事后补记一段 → 看今日累计正确
4. **门户流**:owner 生成 magic-link → 浏览器开 token URL → 看到进度,看不到金额/note
5. **RBAC 流**(关键安全测试):contractor 登录 → 调 `clients.getById` → 返回字段不含 `contactPhone`/`crisisContactPhone`/`notes`/`amountTotal`;调主权操作 `users.invite` 也被拒

### 7.5 不做

- 视觉回归(v1 UI 极简,无 visual identity 投入)
- 性能基准(数据量 < 100 项目时无意义)

---

## 8. 完成定义(DoD)

v1 上线判据:

- [ ] 7 张表 schema + Drizzle migration 跑通
- [ ] 状态机 `transitions` + `advanceProject` 单元测试覆盖所有合法/代表性非法转换
- [ ] 项目列表 + 详情 + 推进按钮 + project_events 时间线
- [ ] 客户列表 + 创建/编辑(含危机联系人必填校验)
- [ ] 今日帽子 widget(切换 + 摘下) + 补记表单(含重叠校验)
- [ ] 客户 magic-link 门户(只读项目进度,**字段过滤通过 RBAC E2E**)
- [ ] contractor 角色 + grants 过滤(**关键 RBAC E2E 通过**)
- [ ] admin 角色:owner 可邀请/撤销 admin;admin 可做全业务写操作但不能调主权操作(**RBAC E2E 通过**)
- [ ] Dashboard 顶部显示「当前 execution + reporting 项目数」(经营手册 §6.1 自警)
- [ ] 部署 Vercel + Neon,生产环境跑通完整 E2E
- [ ] 测试覆盖率 ≥ 80%
- [ ] 经营手册 §4.3 / §八红线由代码守的两条(contractor 字段过滤、危机联系人 NOT NULL)有专项测试

预估工作量:**集中编码 8-12 天**(单人,带 PRD/tech-arch 知识储备)。

---

## 9. v1.5+ 优先级建议

> 本节为 spec 自带的"下一步指引",不是 v1.5 的 spec 本身。

**建议优先级排序原则**:**v1 跑两个月后看你最常破的红线**,对应模块优先工程化。

候选清单(按经营手册 P0 顺序,非时间顺序):

1. 阈值化报价合同 + 24h 冷静期(经营手册 §八 阈值规则 — 最易破)
2. 自检清单门禁(合同/报告/上线 三类 — 与状态机推进耦合)
3. 应收账款日历 + 红线告警(经营手册 §6.2)
4. 报告生成器(react-pdf 模板 + 可选 LLM 段落)
5. 月度复盘日志(经营手册 P1)
6. AI 替代矩阵(各项设置)

每个 v1.5+ 模块走相同的 brainstorming → spec → plan 流程,**不在本 spec 里展开**。

---

## 10. 显式不做的事(YAGNI)

避免读 spec 时出现"这里怎么没写 X"的疑问 — 因为 X 是有意没做:

| 不做 | 理由 |
|---|---|
| 多租户 / `tenantId` 字段 | 单经营者,不需要 |
| 工作流引擎(XState、Temporal) | 8 状态 + 纯函数转换,过度工程 |
| Server Actions 替代 tRPC | 现 PRD 已用 tRPC,迁移成本 > 收益 |
| Tauri 桌面端 | v1 没有原始数据上手,等 v1.5 接报告时再评估本地优先 |
| 报告生成 / PDF | v1.5 才上,本 spec 不展开 |
| 应收账款 | v1.5 才上 |
| 自动催款邮件 | v1.5 才上(且需经营手册 §4.2 审视) |
| 受测者答题入口 | 经营手册红线 §5.3 — 永不直接联系 |
| RBAC 之外的审计日志 | project_events 已经够 v1;PIPL 自评级别 v2 才考虑 |
| 可视化图表(echarts 等) | 数据量小,HTML 表格足够 v1 |
| i18n / 暗黑模式 | YAGNI |
| PWA / 离线支持 | YAGNI |

---

## 11. 派生文档计划

本 spec 获批后,**派生**(rewrite)以下两份文档:

1. `docs/PRD/PRD.md` v1.1 — 把现 v0.2.0 的 RBAC 矩阵砍单租户、保留状态机、单租户化数据模型、删 §503 多租户支持
2. `docs/tech-architecture.md` v1.1 — 应用本 spec §1.3 的栈调整(去 XState、降 NextAuth v4、删 Puppeteer + 报告章节)

派生流程走 `superpowers:writing-plans` skill,把 spec → 实现 plan 后再做 PRD/tech-arch 的 doc-update。

---

**END OF SPEC v1**
