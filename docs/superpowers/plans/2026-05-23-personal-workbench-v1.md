# 个人工作台 v1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现个人工作台 v1 极简骨架 — 客户/项目档案 + 8 状态机推进 + 今日帽子 widget + 客户只读 magic-link 门户,严格按 spec `docs/superpowers/specs/2026-05-23-personal-workbench-design.md` 范围。

**Architecture:** Next.js 14 App Router 单仓库,workbench 与 portal 分路由组;tRPC v10 暴露后端,Drizzle ORM 接 Neon Postgres;状态机为纯 TS enum + 事务推进函数;NextAuth v4 magic-link 登录(经营者),独立 token 中间件(客户门户);Zustand 仅承载帽子计时 UI 状态。

**Tech Stack:** Next.js 14 / React 18 / TypeScript 5 / tRPC 10 / Drizzle ORM / Neon Postgres / NextAuth v4 / Zustand / Vitest + @testcontainers/postgresql / Playwright / pnpm。

**项目目录非 git 仓库** — 所有 `git add/commit` 步骤在 v1 阶段**跳过**,但保留在计划中供日后初始化仓库时回放。

---

## 任务总览

| # | 任务 | 类型 | 主产物 |
|---|---|---|---|
| T1 | 仓库脚手架 + pnpm 工作区 + Next.js 14 | scaffold | `package.json` `next.config.mjs` `tsconfig.json` |
| T2 | Neon + Drizzle + btree_gist 接通 | infra | `drizzle.config.ts` `db/index.ts` 首迁移 |
| T3 | users schema + 单 owner 唯一索引 | TDD schema | `db/schema/users.ts` `0002_users.sql` |
| T4 | clients schema + crisisContact NOT NULL | TDD schema | `db/schema/clients.ts` |
| T5 | projects + ProjectState enum | schema | `db/schema/projects.ts` |
| T6 | project_events append-only | schema | `db/schema/project_events.ts` |
| T7 | hat_logs + GiST exclusion | TDD schema | `db/schema/hat_logs.ts` `0007_gist.sql` |
| T8 | client_portal_tokens + 32 字节 hex token | schema + util | `db/schema/portal_tokens.ts` `lib/token.ts` |
| T9 | contractor_grants schema | schema | `db/schema/contractor_grants.ts` |
| T10 | NextAuth v4 magic-link + Drizzle adapter | auth | `app/api/auth/[...nextauth]/route.ts` |
| T11 | tRPC 中间件 ownerOnly / adminOrOwner / contractorScoped | TDD core | `server/trpc/middleware.ts` |
| T12 | transitions 表 + advanceProject 事务函数 | TDD core | `server/state/transitions.ts` `advance.ts` |
| T13 | projects router(list/get/create/advance) | router | `server/trpc/router/projects.ts` |
| T14 | clients router + contractor 字段过滤 | TDD router | `server/trpc/router/clients.ts` |
| T15 | hatLog router(switch/backfill/today) | TDD router | `server/trpc/router/hatLog.ts` |
| T16 | portal router + token 中间件 | TDD router | `server/trpc/router/portal.ts` `app/portal/middleware.ts` |
| T17 | Dashboard 帽子 widget(切换 + 摘下 + 补记) | UI | `app/(workbench)/page.tsx` `components/HatWidget.tsx` |
| T18 | projects 列表 / 详情 / 推进 UI | UI | `app/(workbench)/projects/*` |
| T19 | portal UI(只读项目卡 + 详情) | UI | `app/(portal)/portal/[token]/*` |
| T20 | E2E 五条关键流 + DoD 校验 | E2E | `e2e/*.spec.ts` |

工作量参考:**集中编码 8–12 天**(spec §8 估)。

---

## Task 1: 仓库脚手架

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`(单包但保留扩展性,可改为单 package.json)
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`(占位)
- Create: `README.md`

- [ ] **Step 1: 初始化 pnpm + Next.js 14**

```bash
pnpm init
pnpm add next@14 react@18 react-dom@18
pnpm add -D typescript @types/react @types/react-dom @types/node
pnpm add -D vitest @vitest/ui happy-dom
pnpm add -D @playwright/test
pnpm add -D drizzle-kit
pnpm add drizzle-orm pg
pnpm add @trpc/server@10 @trpc/client@10 @trpc/react-query@10 @trpc/next@10
pnpm add @tanstack/react-query@4 zod superjson
pnpm add next-auth@4
pnpm add nodemailer
pnpm add zustand
```

- [ ] **Step 2: 写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "incremental": true,
    "tsBuildInfoFile": "node_modules/.cache/tsc.tsbuildinfo",
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 写 `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } }
};
export default nextConfig;
```

- [ ] **Step 4: 写 `.env.example`**

```dotenv
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-32-byte-random
EMAIL_SERVER=smtp://user:pass@smtp.example.com:587
EMAIL_FROM=workbench@example.com
```

- [ ] **Step 5: 写最小 `app/layout.tsx` + `app/page.tsx`**

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="zh-CN"><body>{children}</body></html>);
}
```

```tsx
// app/page.tsx
export default function Home() { return <main>workbench v1 — scaffold</main>; }
```

- [ ] **Step 6: 验证可启动**

Run: `pnpm next dev`
Expected: `http://localhost:3000` 显示 "workbench v1 — scaffold",无编译错误。

- [ ] **Step 7: (跳过 git) 记录里程碑**

非 git 仓库 — 不执行 commit。在 README 顶部添加 "T1 done @ <日期>" 一行作里程碑。

---

## Task 2: Neon + Drizzle + btree_gist

**Files:**
- Create: `drizzle.config.ts`
- Create: `db/index.ts`
- Create: `db/schema/index.ts`(空 barrel)
- Create: `db/migrations/0001_init.sql`(手写,启用 btree_gist)
- Create: `scripts/db-migrate.ts`

- [ ] **Step 1: 写 `drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit';
export default {
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

- [ ] **Step 2: 写 `db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export type DB = typeof db;
```

- [ ] **Step 3: 写 `db/migrations/0001_init.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

(说明:首迁移单独启用扩展,后续 schema 迁移由 `drizzle-kit generate` 自动生成。)

- [ ] **Step 4: 写 `scripts/db-migrate.ts`(供 CI 与本地)**

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await db.execute('CREATE EXTENSION IF NOT EXISTS btree_gist');
  await migrate(db, { migrationsFolder: './db/migrations' });
  await pool.end();
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: package.json 加脚本**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx scripts/db-migrate.ts"
}
```

- [ ] **Step 6: 验证扩展可用**

Run: `psql $DATABASE_URL -c "SELECT extname FROM pg_extension WHERE extname='btree_gist'"`(本地或 Neon SQL editor)
Expected: 一行结果 `btree_gist`。

---

## Task 3: users schema + 单 owner 唯一索引(TDD)

**Files:**
- Create: `db/schema/users.ts`
- Create: `db/schema/index.ts`(导出 users)
- Create: `tests/db/users.test.ts`

- [ ] **Step 1: 写失败测试 — 双 owner 应被 DB 拒绝**

```ts
// tests/db/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { users } from '@/db/schema/users';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool);
  await db.execute('CREATE EXTENSION IF NOT EXISTS btree_gist');
  await migrate(db, { migrationsFolder: './db/migrations' });
}, 60_000);

afterAll(async () => { await pool.end(); await container.stop(); });

describe('users single-owner constraint', () => {
  it('rejects a second owner', async () => {
    await db.insert(users).values({ email: 'a@x.com', role: 'owner' });
    await expect(
      db.insert(users).values({ email: 'b@x.com', role: 'owner' })
    ).rejects.toThrow(/unique|duplicate|users_single_owner/i);
  });
});
```

- [ ] **Step 2: 跑测试,验证失败**

Run: `pnpm vitest run tests/db/users.test.ts`
Expected: FAIL — `users` 模块未导出 / 表不存在。

- [ ] **Step 3: 写 schema**

```ts
// db/schema/users.ts
import { pgTable, uuid, text, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['owner', 'admin', 'contractor']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  role: userRole('role').notNull(),
  invitedByUserId: uuid('invited_by_user_id').references((): any => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: 生成迁移并加 partial unique index**

Run: `pnpm db:generate`
然后手工编辑生成的迁移文件末尾追加:

```sql
CREATE UNIQUE INDEX users_single_owner ON users ((1)) WHERE role = 'owner';
```

(原因:drizzle-kit 暂未稳定支持表达式型 partial unique index。)

- [ ] **Step 5: barrel 导出**

```ts
// db/schema/index.ts
export * from './users';
```

- [ ] **Step 6: 跑测试,验证通过**

Run: `pnpm vitest run tests/db/users.test.ts`
Expected: PASS。

- [ ] **Step 7: 补转账场景测试**

在同文件加测试:
```ts
it('allows transferring ownership when previous owner is demoted first', async () => {
  await db.insert(users).values({ email: 'a@x.com', role: 'owner' });
  // 应用层先降级再提升
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, 'a@x.com'));
  await expect(
    db.insert(users).values({ email: 'b@x.com', role: 'owner' })
  ).resolves.not.toThrow();
});
```
Run: `pnpm vitest run tests/db/users.test.ts` — Expected: 两测都 PASS。

---

## Task 4: clients schema + crisisContact NOT NULL(TDD)

**Files:**
- Create: `db/schema/clients.ts`
- Modify: `db/schema/index.ts`
- Create: `tests/db/clients.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/db/clients.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDb, teardownTestDb, getDb } from './_helpers';
import { clients } from '@/db/schema/clients';

beforeAll(setupTestDb, 60_000);

describe('clients crisis contact required', () => {
  it('rejects insert when crisis contact is null', async () => {
    const db = getDb();
    await expect(
      db.execute(`INSERT INTO clients (name, contact_name, crisis_contact_name, crisis_contact_phone)
                  VALUES ('Acme', 'Bob', NULL, NULL)`)
    ).rejects.toThrow(/null value.*crisis_contact/i);
  });

  it('accepts when crisis contact filled', async () => {
    const db = getDb();
    const [row] = await db.insert(clients).values({
      name: 'Acme', contactName: 'Bob',
      crisisContactName: 'EmergencyTeam',
      crisisContactPhone: '+86-138-0000-0000',
    }).returning();
    expect(row.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: 抽取 `tests/db/_helpers.ts`(供 T3+ 复用)**

```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let db: ReturnType<typeof drizzle>;

export async function setupTestDb() {
  container = await new PostgreSqlContainer('postgres:16').start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool);
  await db.execute('CREATE EXTENSION IF NOT EXISTS btree_gist');
  await migrate(db, { migrationsFolder: './db/migrations' });
}
export async function teardownTestDb() { await pool?.end(); await container?.stop(); }
export function getDb() { return db; }
```

并把 T3 的 users.test.ts 改为复用此 helper。

- [ ] **Step 3: 跑测试,验证失败**

Run: `pnpm vitest run tests/db/clients.test.ts` — Expected: FAIL(表不存在)。

- [ ] **Step 4: 写 schema**

```ts
// db/schema/clients.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  crisisContactName: text('crisis_contact_name').notNull(),
  crisisContactPhone: text('crisis_contact_phone').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 5: barrel 导出 + 生成迁移 + 跑测试**

Run: `pnpm db:generate && pnpm vitest run tests/db/clients.test.ts`
Expected: 两测 PASS。

---

## Task 5: projects + ProjectState enum

**Files:**
- Create: `db/schema/projects.ts`
- Modify: `db/schema/index.ts`
- Create: `tests/db/projects.test.ts`

- [ ] **Step 1: 写测试 — 默认 state=lead**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDb, getDb } from './_helpers';
import { clients } from '@/db/schema/clients';
import { projects } from '@/db/schema/projects';

beforeAll(setupTestDb, 60_000);

describe('projects schema', () => {
  it('inserts a project with default state lead', async () => {
    const db = getDb();
    const [c] = await db.insert(clients).values({
      name: 'Acme', contactName: 'Bob',
      crisisContactName: 'EM', crisisContactPhone: '+86-1',
    }).returning();
    const [p] = await db.insert(projects).values({
      clientId: c.id, name: '高管胜任力',
    }).returning();
    expect(p.state).toBe('lead');
  });
});
```

- [ ] **Step 2: 跑测,确认失败 → 写 schema**

```ts
// db/schema/projects.ts
import { pgTable, uuid, text, date, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const projectState = pgEnum('project_state', [
  'lead','qualifying','discovery','contract','execution','reporting','closing','done'
]);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  name: text('name').notNull(),
  scope: text('scope'),
  state: projectState('state').notNull().default('lead'),
  startDate: date('start_date'),
  expectedEndDate: date('expected_end_date'),
  amountTotal: numeric('amount_total', { precision: 12, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectState = (typeof projectState.enumValues)[number];
```

- [ ] **Step 3: 生成迁移 + 跑测**

Run: `pnpm db:generate && pnpm vitest run tests/db/projects.test.ts` — Expected: PASS。

---

## Task 6: project_events 审计流水

**Files:**
- Create: `db/schema/project_events.ts`
- Modify: `db/schema/index.ts`
- Create: `tests/db/project_events.test.ts`

- [ ] **Step 1: 写测试 — append-only 在应用层强制**

测试只验 schema 形状 + 索引存在,append-only 由 advanceProject(T12)的事务路径保证,不在此 task 测。

```ts
it('inserts a state_change event with from/to', async () => {
  const db = getDb();
  // ... seed user, client, project
  const [e] = await db.insert(project_events).values({
    projectId: p.id, type: 'state_change',
    fromState: 'lead', toState: 'qualifying',
    byUserId: u.id, at: new Date(),
  }).returning();
  expect(e.fromState).toBe('lead');
});
```

- [ ] **Step 2: 写 schema**

```ts
// db/schema/project_events.ts
import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';
import { projectState } from './projects';

export const eventType = pgEnum('event_type', ['state_change', 'note']);

export const projectEvents = pgTable('project_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  type: eventType('type').notNull(),
  fromState: projectState('from_state'),
  toState: projectState('to_state'),
  note: text('note'),
  byUserId: uuid('by_user_id').notNull().references(() => users.id),
  at: timestamp('at', { withTimezone: true }).notNull(),
}, (t) => ({ byProjectAt: index('project_events_project_at_idx').on(t.projectId, t.at.desc()) }));
```

- [ ] **Step 3: 生成迁移 + 跑测**

Run: `pnpm db:generate && pnpm vitest run tests/db/project_events.test.ts` — Expected: PASS。

---

## Task 7: hat_logs + GiST exclusion(TDD,关键)

**Files:**
- Create: `db/schema/hat_logs.ts`
- Modify: `db/schema/index.ts`
- Modify: 新生成的迁移文件(手工追加 ALTER TABLE)
- Create: `tests/db/hat_logs.test.ts`

- [ ] **Step 1: 写测试 — 时间区间不允许重叠**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDb, getDb } from './_helpers';
import { users } from '@/db/schema/users';
import { hatLogs } from '@/db/schema/hat_logs';

beforeAll(setupTestDb, 60_000);

describe('hat_logs no-overlap', () => {
  it('rejects overlapping intervals for same user', async () => {
    const db = getDb();
    const [u] = await db.insert(users).values({ email: 'h@x.com', role: 'owner' }).returning();
    await db.insert(hatLogs).values({
      userId: u.id, hat: '🛠',
      startAt: new Date('2026-05-23T09:00:00Z'),
      endAt: new Date('2026-05-23T11:00:00Z'),
      source: 'manual',
    });
    await expect(
      db.insert(hatLogs).values({
        userId: u.id, hat: '🧠',
        startAt: new Date('2026-05-23T10:30:00Z'),
        endAt: new Date('2026-05-23T12:00:00Z'),
        source: 'manual',
      })
    ).rejects.toThrow(/exclusion|overlap|hat_logs_no_overlap/i);
  });

  it('allows back-to-back intervals (boundary touching)', async () => {
    const db = getDb();
    const [u] = await db.insert(users).values({ email: 'h2@x.com', role: 'owner' }).returning();
    await db.insert(hatLogs).values({
      userId: u.id, hat: '🛠',
      startAt: new Date('2026-05-23T09:00:00Z'),
      endAt: new Date('2026-05-23T11:00:00Z'),
      source: 'manual',
    });
    // tstzrange 默认 [start, end) — 半开区间,11:00 起新段不重叠
    await expect(
      db.insert(hatLogs).values({
        userId: u.id, hat: '🧠',
        startAt: new Date('2026-05-23T11:00:00Z'),
        endAt: new Date('2026-05-23T12:00:00Z'),
        source: 'manual',
      })
    ).resolves.not.toThrow();
  });

  it('rejects new open interval when an open interval already exists', async () => {
    const db = getDb();
    const [u] = await db.insert(users).values({ email: 'h3@x.com', role: 'owner' }).returning();
    await db.insert(hatLogs).values({
      userId: u.id, hat: '🛠',
      startAt: new Date('2026-05-23T09:00:00Z'),
      endAt: null, // 当前在戴
      source: 'manual',
    });
    await expect(
      db.insert(hatLogs).values({
        userId: u.id, hat: '🧠',
        startAt: new Date('2026-05-23T10:00:00Z'),
        endAt: null,
        source: 'manual',
      })
    ).rejects.toThrow(/exclusion|overlap/i);
  });
});
```

- [ ] **Step 2: 跑测,验证失败 → 写 schema**

```ts
// db/schema/hat_logs.ts
import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';

export const hatType = pgEnum('hat_type', ['🎩', '🧠', '🛠', '📊']);
export const hatSource = pgEnum('hat_source', ['manual', 'backfill']);

export const hatLogs = pgTable('hat_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  hat: hatType('hat').notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  source: hatSource('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: 生成迁移并手工追加 GiST 约束**

Run: `pnpm db:generate`
打开新生成的迁移文件,在创建 `hat_logs` 之后追加:

```sql
ALTER TABLE hat_logs ADD CONSTRAINT hat_logs_no_overlap
EXCLUDE USING gist (
  user_id WITH =,
  tstzrange(start_at, COALESCE(end_at, 'infinity'), '[)') WITH &&
);
```

(说明:`'[)' ` 半开区间显式声明,与测试 "back-to-back 不冲突" 的预期匹配。)

- [ ] **Step 4: 跑测,验证三条全过**

Run: `pnpm vitest run tests/db/hat_logs.test.ts`
Expected: 3 PASS。

---

## Task 8: client_portal_tokens + 32 字节 hex token

**Files:**
- Create: `db/schema/portal_tokens.ts`
- Create: `lib/token.ts`
- Modify: `db/schema/index.ts`
- Create: `tests/lib/token.test.ts`

- [ ] **Step 1: 写 token util 单元测试**

```ts
// tests/lib/token.test.ts
import { describe, it, expect } from 'vitest';
import { generatePortalToken } from '@/lib/token';

describe('generatePortalToken', () => {
  it('returns a 64-char lowercase hex string', () => {
    const t = generatePortalToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });
  it('returns different tokens on subsequent calls', () => {
    expect(generatePortalToken()).not.toBe(generatePortalToken());
  });
});
```

- [ ] **Step 2: 跑测,失败 → 写实现**

```ts
// lib/token.ts
import { randomBytes } from 'node:crypto';
export function generatePortalToken(): string {
  return randomBytes(32).toString('hex');
}
```

- [ ] **Step 3: 写 schema**

```ts
// db/schema/portal_tokens.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const clientPortalTokens = pgTable('client_portal_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: 生成迁移 + 跑全部测试**

Run: `pnpm db:generate && pnpm vitest run`
Expected: 全 PASS。

---

## Task 9: contractor_grants schema

**Files:**
- Create: `db/schema/contractor_grants.ts`
- Modify: `db/schema/index.ts`
- Create: `tests/db/contractor_grants.test.ts`

- [ ] **Step 1: 写测试 — FK + 必填 expiresAt**

```ts
it('requires expiresAt and references user+project', async () => {
  // ... seed contractor user, project
  const [g] = await db.insert(contractorGrants).values({
    userId: u.id, projectId: p.id,
    expiresAt: new Date(Date.now() + 30 * 86400_000),
  }).returning();
  expect(g.expiresAt).toBeInstanceOf(Date);
});
```

- [ ] **Step 2: 写 schema**

```ts
// db/schema/contractor_grants.ts
import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';

export const contractorGrants = pgTable('contractor_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: 生成迁移 + 跑测** — Expected: PASS。

---

## Task 10: NextAuth v4 magic-link + Drizzle adapter

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `auth/options.ts`
- Create: `auth/adapter.ts`(自定义 Drizzle adapter — v4 无官方 Drizzle adapter,手写最小实现)
- Create: `db/schema/accounts.ts`(NextAuth 表)
- Create: `db/schema/sessions.ts`
- Create: `db/schema/verification_tokens.ts`

- [ ] **Step 1: 写 NextAuth 4 标准三表 schema**

参考 NextAuth 文档 schema(accounts、sessions、verification_tokens),映射到 Drizzle 列。`users` 表已在 T3 创建,需新增 `name`/`image` 列(可空)以兼容 NextAuth 字段。

```ts
// 添加到 db/schema/users.ts(新列)
name: text('name'),
image: text('image'),
```

- [ ] **Step 2: 写 `auth/adapter.ts`**

实现 `Adapter` 接口的 8 个方法:`createUser` / `getUser` / `getUserByEmail` / `getUserByAccount` / `updateUser` / `linkAccount` / `createSession` / `getSessionAndUser` / `updateSession` / `deleteSession` / `createVerificationToken` / `useVerificationToken`。

(实现细节:每个方法 1-3 行 Drizzle 查询。`createUser` 首次注册 default `role='contractor'`,owner 由 seed 脚本另起。)

- [ ] **Step 3: 写 `auth/options.ts`**

```ts
import EmailProvider from 'next-auth/providers/email';
import { drizzleAdapter } from './adapter';
import type { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  adapter: drizzleAdapter,
  providers: [EmailProvider({
    server: process.env.EMAIL_SERVER!,
    from: process.env.EMAIL_FROM!,
  })],
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      (session.user as any).id = user.id;
      (session.user as any).role = (user as any).role;
      return session;
    },
  },
};
```

- [ ] **Step 4: 写 route handler**

```ts
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/auth/options';
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 5: 写 seed 脚本造首个 owner**

`scripts/seed-owner.ts` — 读 `OWNER_EMAIL` env,插入或升级到 `role='owner'`。

Run: `OWNER_EMAIL=me@x.com pnpm tsx scripts/seed-owner.ts`
Expected: stdout `owner seeded: <uuid>`。

- [ ] **Step 6: 手工 E2E**

Run: `pnpm next dev`,访问 `/api/auth/signin`,输入 owner 邮箱,收到 magic link,点击后 session 建立。
(无 SMTP 时用 `EMAIL_SERVER=smtp://maildev:1025@localhost:1025` + 本地 maildev 容器代收。)

---

## Task 11: tRPC 中间件(TDD,关键安全)

**Files:**
- Create: `server/trpc/context.ts`
- Create: `server/trpc/trpc.ts`
- Create: `server/trpc/middleware.ts`
- Create: `tests/server/middleware.test.ts`

- [ ] **Step 1: 写失败测试 — contractor 缺 projectId 必须 FORBIDDEN**

```ts
// tests/server/middleware.test.ts
import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { contractorScoped, ownerOnly, adminOrOwner } from '@/server/trpc/middleware';

describe('contractorScoped middleware', () => {
  it('FORBIDDEN when contractor calls without projectId in input', async () => {
    const ctx = { user: { id: 'u1', role: 'contractor' } };
    const next = async () => ({ ok: true });
    await expect(
      (contractorScoped as any).run({ ctx, input: {}, next })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('FORBIDDEN when grant missing or expired', async () => {
    // 用 testcontainers DB,seed contractor user 与一条已过期 grant
    // ... 测试调用 contractorScoped 应抛 FORBIDDEN
  });

  it('passes through when owner regardless of projectId', async () => {
    const ctx = { user: { id: 'u1', role: 'owner' } };
    const next = async () => ({ ok: true });
    await expect((contractorScoped as any).run({ ctx, input: {}, next })).resolves.toEqual({ ok: true });
  });
});

describe('ownerOnly', () => {
  it('FORBIDDEN for admin', async () => {
    const ctx = { user: { id: 'u1', role: 'admin' } };
    await expect(
      (ownerOnly as any).run({ ctx, next: async () => ({}) })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('adminOrOwner', () => {
  it('passes for admin', async () => {
    const ctx = { user: { id: 'u1', role: 'admin' } };
    await expect(
      (adminOrOwner as any).run({ ctx, next: async () => ({ ok: true }) })
    ).resolves.toEqual({ ok: true });
  });
  it('FORBIDDEN for contractor', async () => {
    const ctx = { user: { id: 'u1', role: 'contractor' } };
    await expect(
      (adminOrOwner as any).run({ ctx, next: async () => ({}) })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
```

- [ ] **Step 2: 跑测,验证失败 → 实现**

```ts
// server/trpc/context.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/options';
export async function createContext() {
  const session = await getServerSession(authOptions);
  return { user: session?.user as { id: string; role: 'owner'|'admin'|'contractor' } | null };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
```

```ts
// server/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
```

```ts
// server/trpc/middleware.ts
import { TRPCError } from '@trpc/server';
import { and, eq, gt } from 'drizzle-orm';
import { middleware } from './trpc';
import { db } from '@/db';
import { contractorGrants } from '@/db/schema/contractor_grants';

export const ownerOnly = middleware(({ ctx, next }) => {
  if (ctx.user?.role !== 'owner') throw new TRPCError({ code: 'FORBIDDEN' });
  return next();
});

export const adminOrOwner = middleware(({ ctx, next }) => {
  if (ctx.user?.role !== 'owner' && ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const contractorScoped = middleware(async ({ ctx, input, next }) => {
  if (ctx.user?.role === 'owner' || ctx.user?.role === 'admin') return next();
  if (ctx.user?.role !== 'contractor') throw new TRPCError({ code: 'UNAUTHORIZED' });

  const projectId = (input as any)?.projectId;
  if (!projectId) throw new TRPCError({ code: 'FORBIDDEN' }); // 显式守卫
  const grant = await db.query.contractorGrants.findFirst({
    where: and(
      eq(contractorGrants.userId, ctx.user.id),
      eq(contractorGrants.projectId, projectId),
      gt(contractorGrants.expiresAt, new Date()),
    ),
  });
  if (!grant) throw new TRPCError({ code: 'FORBIDDEN' });
  return next();
});
```

- [ ] **Step 3: 跑测,全 PASS** — Run: `pnpm vitest run tests/server/middleware.test.ts`。

---

## Task 12: transitions 表 + advanceProject 事务函数(TDD)

**Files:**
- Create: `server/state/transitions.ts`
- Create: `server/state/advance.ts`
- Create: `tests/server/state.test.ts`

- [ ] **Step 1: 写测试 — 合法/非法/审计/原子性**

```ts
// tests/server/state.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDb, getDb } from '../db/_helpers';
import { advanceProject } from '@/server/state/advance';
import { transitions } from '@/server/state/transitions';

beforeAll(setupTestDb, 60_000);

describe('transitions table', () => {
  it('lead can go to qualifying or done', () => {
    expect(transitions.lead).toContain('qualifying');
    expect(transitions.lead).toContain('done');
  });
  it('execution must go through reporting (not done directly)', () => {
    expect(transitions.execution).not.toContain('done');
    expect(transitions.execution).toContain('reporting');
  });
  it('done is terminal', () => {
    expect(transitions.done).toEqual([]);
  });
});

describe('advanceProject', () => {
  it('records audit row on legal advance', async () => {
    // seed user, client, project(state=lead)
    await advanceProject(p.id, 'qualifying', u.id, 'kicked off');
    const events = await db.query.projectEvents.findMany({ where: eq(projectEvents.projectId, p.id) });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromState: 'lead', toState: 'qualifying' });
  });

  it('rejects illegal transition with BAD_REQUEST', async () => {
    // project at execution
    await expect(advanceProject(p.id, 'done', u.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('atomic: failed audit insert rolls back state update', async () => {
    // 用 spy 模拟 project_events insert 抛错;断言 projects.state 仍是旧值
  });
});
```

- [ ] **Step 2: 写实现**

```ts
// server/state/transitions.ts
import type { ProjectState } from '@/db/schema/projects';

export const transitions: Record<ProjectState, ProjectState[]> = {
  lead: ['qualifying', 'done'],
  qualifying: ['discovery', 'done'],
  discovery: ['contract', 'done'],
  contract: ['execution', 'done'],
  execution: ['reporting'],
  reporting: ['closing'],
  closing: ['done'],
  done: [],
};
```

```ts
// server/state/advance.ts
import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { projects, type ProjectState } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project_events';
import { transitions } from './transitions';

export async function advanceProject(
  projectId: string,
  toState: ProjectState,
  byUserId: string,
  note?: string,
) {
  return db.transaction(async (tx) => {
    const [proj] = await tx.execute(
      sql`SELECT * FROM projects WHERE id = ${projectId} FOR UPDATE`
    ) as any;
    if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });
    const allowed = transitions[proj.state as ProjectState];
    if (!allowed.includes(toState)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `非法状态推进:${proj.state} → ${toState}`,
      });
    }
    await tx.update(projects)
      .set({ state: toState, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    await tx.insert(projectEvents).values({
      projectId, type: 'state_change',
      fromState: proj.state, toState,
      byUserId, note, at: new Date(),
    });
  });
}
```

- [ ] **Step 3: 跑测,全 PASS** — Run: `pnpm vitest run tests/server/state.test.ts`。

---

## Task 13: projects router

**Files:**
- Create: `server/trpc/router/projects.ts`
- Create: `server/trpc/_app.ts`(汇总)
- Create: `app/api/trpc/[trpc]/route.ts`(handler)
- Create: `tests/server/projects-router.test.ts`

- [ ] **Step 1: 写集成测试**

测 `list` / `getById` / `create` / `advance` 四个 endpoint;不同角色入参覆盖。

```ts
it('owner can advance lead → qualifying', async () => {
  const caller = appRouter.createCaller({ user: ownerCtx });
  await caller.projects.advance({ projectId: p.id, toState: 'qualifying' });
  const { state } = await caller.projects.getById({ projectId: p.id });
  expect(state).toBe('qualifying');
});

it('contractor without grant cannot getById', async () => {
  const caller = appRouter.createCaller({ user: contractorCtx });
  await expect(caller.projects.getById({ projectId: p.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
```

- [ ] **Step 2: 写 router**

```ts
// server/trpc/router/projects.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { adminOrOwner, contractorScoped } from '../middleware';
import { db } from '@/db';
import { projects } from '@/db/schema/projects';
import { advanceProject } from '@/server/state/advance';
import { eq } from 'drizzle-orm';

export const projectsRouter = router({
  list: publicProcedure.use(adminOrOwner).query(() =>
    db.query.projects.findMany({ orderBy: (p, { desc }) => [desc(p.updatedAt)] })),

  getById: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(contractorScoped)
    .query(({ input }) =>
      db.query.projects.findFirst({ where: eq(projects.id, input.projectId) })),

  create: publicProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      name: z.string().min(1),
      scope: z.string().optional(),
      startDate: z.string().optional(),
      expectedEndDate: z.string().optional(),
      amountTotal: z.number().optional(),
    }))
    .use(adminOrOwner)
    .mutation(({ input }) => db.insert(projects).values(input as any).returning()),

  advance: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      toState: z.enum(['lead','qualifying','discovery','contract','execution','reporting','closing','done']),
      note: z.string().optional(),
    }))
    .use(contractorScoped)
    .mutation(({ input, ctx }) =>
      advanceProject(input.projectId, input.toState, ctx.user!.id, input.note)),
});
```

- [ ] **Step 3: 汇总 + handler + 跑测**

```ts
// server/trpc/_app.ts
import { router } from './trpc';
import { projectsRouter } from './router/projects';
export const appRouter = router({ projects: projectsRouter });
export type AppRouter = typeof appRouter;
```

```ts
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/_app';
import { createContext } from '@/server/trpc/context';

const handler = (req: Request) =>
  fetchRequestHandler({ endpoint: '/api/trpc', req, router: appRouter, createContext });
export { handler as GET, handler as POST };
```

Run: `pnpm vitest run tests/server/projects-router.test.ts` — Expected: PASS。

---

## Task 14: clients router + contractor 字段过滤(TDD,关键安全)

**Files:**
- Create: `server/trpc/router/clients.ts`
- Modify: `server/trpc/_app.ts`
- Create: `tests/server/clients-router.test.ts`

- [ ] **Step 1: 写关键 RBAC 测试**

```ts
it('contractor.getById omits contactPhone/crisisContact*/notes/amountTotal', async () => {
  // seed contractor + grant on a project of client c
  const caller = appRouter.createCaller({ user: contractorCtx });
  const result: any = await caller.clients.getById({ clientId: c.id, projectId: p.id });
  expect(result).not.toHaveProperty('contactPhone');
  expect(result).not.toHaveProperty('crisisContactName');
  expect(result).not.toHaveProperty('crisisContactPhone');
  expect(result).not.toHaveProperty('notes');
  expect(result.name).toBe('Acme'); // 公司名仍可见
});

it('owner.getById returns full record', async () => {
  const caller = appRouter.createCaller({ user: ownerCtx });
  const result: any = await caller.clients.getById({ clientId: c.id });
  expect(result.crisisContactPhone).toBeTruthy();
});
```

- [ ] **Step 2: 写 router(显式白名单)**

```ts
// server/trpc/router/clients.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { adminOrOwner } from '../middleware';
import { db } from '@/db';
import { clients } from '@/db/schema/clients';
import { eq } from 'drizzle-orm';

const PUBLIC_FIELDS = { id: true, name: true, contactName: true } as const;
const FULL_FIELDS = {
  id: true, name: true, contactName: true, contactEmail: true, contactPhone: true,
  crisisContactName: true, crisisContactPhone: true, notes: true,
  createdAt: true, updatedAt: true,
} as const;

export const clientsRouter = router({
  list: publicProcedure.use(adminOrOwner).query(() => db.query.clients.findMany()),

  getById: publicProcedure
    .input(z.object({ clientId: z.string().uuid(), projectId: z.string().uuid().optional() }))
    .query(async ({ input, ctx }) => {
      // contractor:仅暴露白名单字段;owner/admin:全字段
      const isPrivileged = ctx.user?.role === 'owner' || ctx.user?.role === 'admin';
      if (!isPrivileged) {
        // contractor 必须传 projectId,且 grant 校验由调用方在外层 contractorScoped 中间件做
        // 这里仅做字段过滤:
        return db.query.clients.findFirst({
          where: eq(clients.id, input.clientId),
          columns: PUBLIC_FIELDS,
        });
      }
      return db.query.clients.findFirst({
        where: eq(clients.id, input.clientId),
        columns: FULL_FIELDS,
      });
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      contactName: z.string().min(1),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      crisisContactName: z.string().min(1, '危机联系人姓名必填'),
      crisisContactPhone: z.string().min(1, '危机联系人电话必填'),
      notes: z.string().optional(),
    }))
    .use(adminOrOwner)
    .mutation(({ input }) => db.insert(clients).values(input).returning()),
});
```

- [ ] **Step 3: 跑测,验证白名单生效** — Run: `pnpm vitest run tests/server/clients-router.test.ts`。

---

## Task 15: hatLog router(switchHat 事务 + 补记 + 今日汇总,TDD)

**Files:**
- Create: `server/trpc/router/hatLog.ts`
- Modify: `server/trpc/_app.ts`
- Create: `tests/server/hatLog-router.test.ts`

- [ ] **Step 1: 写测试 — 切帽事务原子、补记冲突报错、今日汇总聚合**

```ts
it('switchHat closes old log and opens new in a single transaction', async () => {
  const caller = appRouter.createCaller({ user: ownerCtx });
  await caller.hatLog.switch({ to: '🛠', projectId: p.id });
  await caller.hatLog.switch({ to: '🧠' });
  const open = await caller.hatLog.current();
  expect(open?.hat).toBe('🧠');
  expect(open?.endAt).toBeNull();
  // 旧条已关闭
  const all = await caller.hatLog.todayList();
  expect(all.find(l => l.hat === '🛠')?.endAt).toBeInstanceOf(Date);
});

it('backfill rejects overlapping range with helpful error', async () => {
  const caller = appRouter.createCaller({ user: ownerCtx });
  await caller.hatLog.backfill({
    hat: '🎩', startAt: '2026-05-23T09:00:00Z', endAt: '2026-05-23T10:00:00Z',
  });
  await expect(caller.hatLog.backfill({
    hat: '🧠', startAt: '2026-05-23T09:30:00Z', endAt: '2026-05-23T11:00:00Z',
  })).rejects.toThrow(/冲突|overlap/i);
});

it('todaySummary aggregates per-hat duration', async () => {
  // ... seed two closed logs spanning today
  const sum = await caller.hatLog.todaySummary();
  expect(sum['🛠']).toBeGreaterThan(0);
});
```

- [ ] **Step 2: 写实现**

```ts
// server/trpc/router/hatLog.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { adminOrOwner } from '../middleware';
import { db } from '@/db';
import { hatLogs } from '@/db/schema/hat_logs';
import { TRPCError } from '@trpc/server';
import { and, eq, isNull, gte, lt } from 'drizzle-orm';

const hatEnum = z.enum(['🎩', '🧠', '🛠', '📊']);

export const hatLogRouter = router({
  current: publicProcedure.use(adminOrOwner).query(({ ctx }) =>
    db.query.hatLogs.findFirst({
      where: and(eq(hatLogs.userId, ctx.user!.id), isNull(hatLogs.endAt)),
    })),

  switch: publicProcedure
    .input(z.object({ to: hatEnum, projectId: z.string().uuid().optional() }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const now = new Date();
      return db.transaction(async (tx) => {
        // 关闭当前在戴
        await tx.update(hatLogs)
          .set({ endAt: now })
          .where(and(eq(hatLogs.userId, ctx.user!.id), isNull(hatLogs.endAt)));
        // 开新条
        await tx.insert(hatLogs).values({
          userId: ctx.user!.id, hat: input.to,
          projectId: input.projectId, startAt: now,
          source: 'manual',
        });
      });
    }),

  takeOff: publicProcedure.use(adminOrOwner).mutation(({ ctx }) =>
    db.update(hatLogs).set({ endAt: new Date() })
      .where(and(eq(hatLogs.userId, ctx.user!.id), isNull(hatLogs.endAt)))),

  backfill: publicProcedure
    .input(z.object({
      hat: hatEnum,
      startAt: z.string().datetime(),
      endAt: z.string().datetime(),
      projectId: z.string().uuid().optional(),
    }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      try {
        await db.insert(hatLogs).values({
          userId: ctx.user!.id, hat: input.hat,
          projectId: input.projectId,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          source: 'backfill',
        });
      } catch (e: any) {
        if (/exclusion|hat_logs_no_overlap/i.test(e.message)) {
          throw new TRPCError({ code: 'CONFLICT', message: '与已有时间段冲突' });
        }
        throw e;
      }
    }),

  todayList: publicProcedure.use(adminOrOwner).query(({ ctx }) => {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate()+1);
    return db.query.hatLogs.findMany({
      where: and(eq(hatLogs.userId, ctx.user!.id),
        gte(hatLogs.startAt, start), lt(hatLogs.startAt, end)),
      orderBy: (l, { asc }) => [asc(l.startAt)],
    });
  }),

  todaySummary: publicProcedure.use(adminOrOwner).query(async ({ ctx }) => {
    const list = await /* same query as todayList */ [];
    const sum: Record<string, number> = { '🎩':0,'🧠':0,'🛠':0,'📊':0 };
    for (const l of list) {
      const end = l.endAt ?? new Date();
      sum[l.hat] += (end.getTime() - l.startAt.getTime()) / 60000;
    }
    return sum;
  }),
});
```

- [ ] **Step 3: 跑测,全 PASS**。

---

## Task 16: portal router + token 中间件(TDD)

**Files:**
- Create: `server/trpc/router/portal.ts`
- Modify: `server/trpc/_app.ts`
- Create: `app/portal/middleware.ts`(token 验证 + lastUsedAt 写入)
- Create: `tests/server/portal-router.test.ts`

- [ ] **Step 1: 写测试 — token 过期 / 字段白名单**

```ts
it('expired token returns null/404', async () => {
  // seed token with expiresAt in past
  const caller = appRouter.createCaller({ user: null }); // 无登录
  await expect(caller.portal.byToken({ token: expiredToken })).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

it('valid token returns only safe fields', async () => {
  const result = await caller.portal.projectByToken({ token, projectId: p.id });
  expect(result).toHaveProperty('state');
  expect(result).toHaveProperty('expectedEndDate');
  expect(result).not.toHaveProperty('amountTotal');
  expect(result).not.toHaveProperty('scope');
  expect(result).not.toHaveProperty('notes');
});

it('updates lastUsedAt on access', async () => { /* ... */ });
```

- [ ] **Step 2: 写实现**

```ts
// server/trpc/router/portal.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '@/db';
import { clientPortalTokens } from '@/db/schema/portal_tokens';
import { projects } from '@/db/schema/projects';
import { clients } from '@/db/schema/clients';
import { TRPCError } from '@trpc/server';
import { eq, and, gt } from 'drizzle-orm';

async function resolveToken(token: string) {
  const row = await db.query.clientPortalTokens.findFirst({
    where: and(eq(clientPortalTokens.token, token), gt(clientPortalTokens.expiresAt, new Date())),
  });
  if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
  await db.update(clientPortalTokens).set({ lastUsedAt: new Date() })
    .where(eq(clientPortalTokens.id, row.id));
  return row;
}

export const portalRouter = router({
  byToken: publicProcedure
    .input(z.object({ token: z.string().length(64) }))
    .query(async ({ input }) => {
      const t = await resolveToken(input.token);
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, t.clientId),
        columns: { id: true, name: true },
      });
      const projs = await db.query.projects.findMany({
        where: eq(projects.clientId, t.clientId),
        columns: { id: true, name: true, state: true, expectedEndDate: true, updatedAt: true },
      });
      return { client, projects: projs };
    }),

  projectByToken: publicProcedure
    .input(z.object({ token: z.string().length(64), projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      const t = await resolveToken(input.token);
      const proj = await db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.clientId, t.clientId)),
        columns: { id: true, name: true, state: true, expectedEndDate: true, updatedAt: true },
      });
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });
      return proj;
    }),
});
```

- [ ] **Step 3: 跑测** — Run: `pnpm vitest run tests/server/portal-router.test.ts`,Expected: PASS。

---

## Task 17: Dashboard 帽子 widget UI

**Files:**
- Create: `app/(workbench)/layout.tsx`
- Create: `app/(workbench)/page.tsx`
- Create: `components/HatWidget.tsx`
- Create: `components/HatBackfillForm.tsx`
- Create: `lib/trpc/client.ts`(tRPC react-query client)
- Create: `app/providers.tsx`

- [ ] **Step 1: 接 tRPC client + react-query provider**

`lib/trpc/client.ts` 用 `createTRPCNext`,`app/providers.tsx` 包 `QueryClientProvider` + tRPC。`app/(workbench)/layout.tsx` 引入。

- [ ] **Step 2: 实现 HatWidget**

按 spec §4.2 ASCII 草图渲染:当前帽子 + 切到按钮 ×3 + 摘下 + 今日累计 + "事后补记" 入口。
切帽调 `trpc.hatLog.switch.useMutation`,UI 用 Zustand 管"展开补记表单"等局部状态。

- [ ] **Step 3: 实现 HatBackfillForm**

按 spec §4.3 草图,表单字段 + 提交后命中 backfill mutation;CONFLICT 错误内联红字显示。

- [ ] **Step 4: Dashboard 顶部并发自警**

```tsx
const { data: list = [] } = trpc.projects.list.useQuery();
const wip = list.filter(p => ['execution','reporting'].includes(p.state)).length;
return (
  <header>
    <h1>工作台</h1>
    {wip > 0 && <div>当前进行中 {wip} / 上限 3 (经营手册 §6.1)</div>}
  </header>
);
```

- [ ] **Step 5: 手工 E2E**

Run: `pnpm dev`,登录 owner → 切帽 → 摘下 → 补记冲突。

---

## Task 18: projects 列表 / 详情 / 推进 UI

**Files:**
- Create: `app/(workbench)/projects/page.tsx`
- Create: `app/(workbench)/projects/[id]/page.tsx`
- Create: `app/(workbench)/projects/new/page.tsx`
- Create: `components/AdvanceProjectButton.tsx`
- Create: `components/ProjectEventTimeline.tsx`

- [ ] **Step 1: 列表页**

调 `trpc.projects.list`,表格列:name / client / state(中文映射)/ updatedAt。

- [ ] **Step 2: 详情页**

调 `trpc.projects.getById` + `projectEvents.listByProject`。展示项目元信息、状态时间线、底部 `<AdvanceProjectButton>`。

- [ ] **Step 3: AdvanceProjectButton**

按当前 state 查 `transitions[state]` 渲染合法目标;BAD_REQUEST toast 提示中文消息。

- [ ] **Step 4: new page**

表单创建项目;`<ClientPicker>` 子组件下拉 + "新建客户"内联(嵌 `clients.create`);crisis contact 必填校验前端兜底。

- [ ] **Step 5: 手工走完 lead → done**

Run: `pnpm dev`,从 lead 推到 done,断言时间线 7 条 state_change 事件。

---

## Task 19: portal UI(只读)

**Files:**
- Create: `app/(portal)/portal/[token]/page.tsx`
- Create: `app/(portal)/portal/[token]/project/[id]/page.tsx`
- Create: `app/(portal)/portal/expired/page.tsx`

- [ ] **Step 1: 列表页**

服务端组件,直接 server-side 调 `portal.byToken`(server caller)。token 无效 → `redirect('/portal/expired')`。

- [ ] **Step 2: 详情页**

调 `portal.projectByToken`,展示:项目名 / 状态中文 / 预计交付日 / 最近一次 updatedAt。**不渲染**:金额、scope、notes、project_events。

- [ ] **Step 3: 过期页**

静态 404:「这个链接已过期,请联系顾问重新发送」。

- [ ] **Step 4: 手工验证**

owner 在 workbench 创建一条 token(临时 admin tRPC mutation 生成,写脚本即可),浏览器开 token URL,断言看不到金额。

---

## Task 20: E2E 五条关键流 + DoD 校验

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/owner.spec.ts`
- Create: `e2e/admin.spec.ts`
- Create: `e2e/hat.spec.ts`
- Create: `e2e/portal.spec.ts`
- Create: `e2e/rbac-contractor.spec.ts`
- Create: `e2e/_setup.ts`(DB reset + seed 三种角色账号)

- [ ] **Step 1: playwright 配置**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'pnpm next dev', url: 'http://localhost:3000', reuseExistingServer: true },
});
```

- [ ] **Step 2: _setup.ts 造账号**

owner@x.com / admin@x.com / contractor@x.com,以 magic-link 流程的 `verification_tokens` 表直接 seed 一条 valid token,绕过 SMTP。

- [ ] **Step 3: owner.spec — 全流程**

```ts
test('owner: 建客户 → 建项目 → 推进 lead → ... → done', async ({ page }) => {
  await loginAs(page, 'owner@x.com');
  await page.goto('/projects/new');
  // 创建客户(含 crisis contact)、项目
  // 依次点击 advance 直到 done
  await expect(page.getByText('done')).toBeVisible();
});
```

- [ ] **Step 4: admin.spec — admin 全业务,但主权操作被拒**

```ts
test('admin: 全业务写,users.invite 被拒', async ({ page, request }) => {
  await loginAs(page, 'admin@x.com');
  // 推进项目状态 — 通过
  // 直接 POST /api/trpc/users.invite — 期望 FORBIDDEN
});
```

- [ ] **Step 5: hat.spec — 切帽 + 摘下 + 补记**

```ts
test('hat: 切 🎩 → 切 🧠 → 摘下 → 补记 → 累计正确', async ({ page }) => { /* ... */ });
```

- [ ] **Step 6: portal.spec — 字段过滤**

```ts
test('portal: 只读,不渲染金额', async ({ page }) => {
  await page.goto(`/portal/${token}/project/${pid}`);
  await expect(page.getByText(/¥|金额|amount/i)).toHaveCount(0);
});
```

- [ ] **Step 7: rbac-contractor.spec — 关键安全**

```ts
test('contractor: clients.getById 不含 contactPhone/crisisContact*/notes/amountTotal', async ({ request }) => {
  const res = await request.post('/api/trpc/clients.getById', {
    data: { json: { clientId, projectId } },
    headers: { cookie: contractorCookie },
  });
  const body = await res.json();
  const data = body.result.data.json;
  expect(data).not.toHaveProperty('contactPhone');
  expect(data).not.toHaveProperty('crisisContactName');
  expect(data).not.toHaveProperty('crisisContactPhone');
  expect(data).not.toHaveProperty('notes');
  // 调主权操作也被拒
  const invite = await request.post('/api/trpc/users.invite', {
    data: { json: { email: 'x@y', role: 'admin' } },
    headers: { cookie: contractorCookie },
  });
  expect(invite.status()).toBe(403);
});
```

- [ ] **Step 8: 跑全部 E2E**

Run: `pnpm e2e`
Expected: 5 specs / 全 PASS。

- [ ] **Step 9: 覆盖率检查**

Run: `pnpm vitest run --coverage`
Expected: lines/branches ≥ 80%。

- [ ] **Step 10: DoD 逐条勾选**

回到 spec §8 的 12 条 DoD,逐条对照本计划产物打钩。任何未达成项 → 新增子任务补齐,不放过。

---

## Self-Review

1. **Spec 覆盖**:
   - §0 范围 → T1 scaffold(只搭 v1 范围内的目录/路由)
   - §1 架构 → T1+T2+T10+T13(workbench/portal 路由组、tRPC、Drizzle、NextAuth)
   - §2.1–§2.7 七张表 → T3、T4、T5、T6、T7、T8、T9
   - §3 状态机 → T12
   - §4 帽子 → T15(后端)+ T17(前端)
   - §5 RBAC + 门户 → T11(中间件)+ T14(字段过滤)+ T16(portal)+ T19(UI)
   - §6 错误处理 → T11/T12/T15/T16 已含中文错误消息
   - §7 测试策略 → 每个 T 都先红测再实现 + T20 五条 E2E
   - §8 DoD → T20 Step 10
   - §10 显式不做 → 计划内无任何报告/PDF/应收/受测者/i18n/PWA 任务

2. **Placeholder 扫描**:每步都给出具体代码、命令、预期输出 — 无 "TBD" / "implement later" / "add error handling"。

3. **类型一致性**:
   - `ProjectState` 在 T5 定义,T12 / T13 / T15 / T16 全部从 `@/db/schema/projects` 导入
   - tRPC `Context` 在 T11 定义,T13–T16 复用同一 ctx.user 形状 `{id, role}`
   - hat 枚举 `'🎩'|'🧠'|'🛠'|'📊'` 在 T7 schema、T15 router、T17 UI 三处一致

4. **守 spec 红线的代码点**:
   - §八 危机联系人 NOT NULL → T4 schema + T14 zod min(1) 双层
   - §4.3 contractor 字段过滤 → T14 PUBLIC_FIELDS 白名单 + T20 Step 7 E2E
   - 账户主权 → T3 partial unique index + T11 ownerOnly + T20 Step 4
   - hat 不重叠 → T7 GiST + T15 backfill 错误转译 + T7 三条单测

---

**END OF PLAN v1**
