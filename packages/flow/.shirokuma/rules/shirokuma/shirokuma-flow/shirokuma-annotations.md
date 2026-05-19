---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "lib/actions/**/*.ts"
  - "**/app/**/page.tsx"
  - "components/**/*.tsx"
---

# shirokuma-flow アノテーション

## ファイルタイプ別の必須タグ

| ファイルタイプ | 必須タグ |
|---------------|---------|
| テスト (`*.test.ts`) | 各 `it()` に `@testdoc` |
| Server Action | `@serverAction`, `@feature`, `@dbTables` |
| ページコンポーネント | `@screen`, `@route` |
| コンポーネント | `@component` |
| 型定義のみのファイル | `@skip-test` |

## テストアノテーション（必須）

```typescript
/**
 * @testdoc Creates a new user with valid data
 * @purpose Verify user creation happy path
 * @precondition Valid email and password
 * @expected User is created and ID is returned
 */
it("should create user with valid data", async () => {
  // test
});
```

## スクリーンアノテーション

```typescript
/**
 * Dashboard screen
 *
 * @screen DashboardScreen
 * @route /dashboard
 * @usedComponents ProjectList, ActivityFeed
 * @usedActions getProjects, getActivities
 */
export default function DashboardPage() { }
```

## Server Action アノテーション

```typescript
/**
 * Get project list
 *
 * @serverAction
 * @feature ProjectManagement
 * @dbTables projects
 * @authLevel member
 */
export async function getProjects(orgId: string) { }
```

## テストスキップアノテーション

```typescript
/**
 * @skip-test Type definitions only - no runtime logic
 */
export type Project = typeof projects.$inferSelect
```

## 検証

```bash
shirokuma-flow lint tests -p . -f terminal
shirokuma-flow lint coverage -p . -f summary
```
