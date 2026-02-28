# Agent Token Metering & Availability Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** エージェントの実使用トークンをCore Daemonで計測・永続化し、アカウント状態/リミットに基づく可用ステータスをUIに表示する。

**Architecture:** 計測・判定ロジックはすべて `apps/server` 側に実装し、`/api/agents/status` と `/:id/usage` で決定的な構造化データとして返す。Web Client は表示とポーリングだけを担当し、可用性判定や閾値判定は一切持たない。計測値は `usage_records` と in-memory metrics の双方を更新し、Observerの介入判断に再利用可能な形へ統一する。

**Tech Stack:** TypeScript, Hono, better-sqlite3, Vitest, React

---

### Task 1: Usage/Availability API 契約を先に固定する

**Files:**
- Create: `apps/server/src/types/agent-status.ts`
- Modify: `apps/server/src/routes/agents.ts`
- Test: `apps/server/src/__tests__/unit/agents-status-contract.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { AgentAvailabilityState } from "../../types/agent-status.js";

describe("Agent status contract", () => {
  it("should expose deterministic availability states", () => {
    const states: AgentAvailabilityState[] = [
      "available",
      "missing_api_key",
      "subscription_expired",
      "credits_exhausted",
      "rate_limited",
      "disabled",
      "error",
    ];
    expect(states).toContain("available");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -F side-server test apps/server/src/__tests__/unit/agents-status-contract.test.ts`
Expected: FAIL with missing module/type error

**Step 3: Write minimal implementation**

```ts
export type AgentAvailabilityState =
  | "available"
  | "missing_api_key"
  | "subscription_expired"
  | "credits_exhausted"
  | "rate_limited"
  | "disabled"
  | "error";

export interface AgentAvailabilityStatus {
  state: AgentAvailabilityState;
  reasonCode?: string;
  message?: string;
  checkedAt: string;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -F side-server test apps/server/src/__tests__/unit/agents-status-contract.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/server/src/types/agent-status.ts apps/server/src/__tests__/unit/agents-status-contract.test.ts
git commit -m "feat(agents): define availability status contract"
```

### Task 2: 実トークン計測の正規化ロジックを追加する

**Files:**
- Create: `apps/server/src/utils/token-metering.ts`
- Modify: `apps/server/src/routes/agents.ts`
- Test: `apps/server/src/__tests__/unit/token-metering.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { extractTokenUsage } from "../../utils/token-metering.js";

describe("extractTokenUsage", () => {
  it("should prefer metadata token fields when provided", () => {
    const usage = extractTokenUsage({
      metadata: { inputTokens: 120, outputTokens: 80 },
      inputText: "x",
      outputText: "y",
    });
    expect(usage.inputTokens).toBe(120);
    expect(usage.outputTokens).toBe(80);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -F side-server test apps/server/src/__tests__/unit/token-metering.test.ts`
Expected: FAIL with missing function

**Step 3: Write minimal implementation**

```ts
export function extractTokenUsage(input: {
  metadata?: Record<string, unknown>;
  inputText?: string;
  outputText?: string;
}): { inputTokens: number; outputTokens: number; estimated: boolean } {
  const md = input.metadata ?? {};
  const inMeta = Number(md.inputTokens ?? md.prompt_tokens ?? 0);
  const outMeta = Number(md.outputTokens ?? md.completion_tokens ?? 0);
  if (inMeta > 0 || outMeta > 0) {
    return { inputTokens: inMeta, outputTokens: outMeta, estimated: false };
  }

  const estimate = (text?: string) => Math.ceil((text?.length ?? 0) / 4);
  return {
    inputTokens: estimate(input.inputText),
    outputTokens: estimate(input.outputText),
    estimated: true,
  };
}
```

`routes/agents.ts` の `/:id/execute` と `/:id/send` で `recordUsage(...)` と `recordTokenUsage(...)` を呼び、`taskId/sessionId/model` を渡す。

**Step 4: Run test to verify it passes**

Run: `pnpm -F side-server test apps/server/src/__tests__/unit/token-metering.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/server/src/utils/token-metering.ts apps/server/src/routes/agents.ts apps/server/src/__tests__/unit/token-metering.test.ts
git commit -m "feat(agents): meter token usage from task execution results"
```

### Task 3: サブスク/クレジット/閾値から可用性を決定する判定器を実装する

**Files:**
- Create: `apps/server/src/utils/agent-availability.ts`
- Modify: `apps/server/src/utils/usage-tracking.ts`
- Test: `apps/server/src/__tests__/unit/agent-availability.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resolveAvailability } from "../../utils/agent-availability.js";

describe("resolveAvailability", () => {
  it("should return credits_exhausted when remaining credits <= 0", () => {
    const status = resolveAvailability({
      configHasApiKey: true,
      subscription: { status: "active", remainingCredits: 0 },
      thresholdExceeded: false,
    });
    expect(status.state).toBe("credits_exhausted");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -F side-server test apps/server/src/__tests__/unit/agent-availability.test.ts`
Expected: FAIL with missing function/module

**Step 3: Write minimal implementation**

```ts
export function resolveAvailability(input: {
  configHasApiKey: boolean;
  subscription?: { status: "active" | "expired" | "suspended"; remainingCredits?: number };
  thresholdExceeded: boolean;
}) {
  if (!input.configHasApiKey) return { state: "missing_api_key", checkedAt: new Date().toISOString() };
  if (input.subscription?.status === "expired") return { state: "subscription_expired", checkedAt: new Date().toISOString() };
  if ((input.subscription?.remainingCredits ?? 1) <= 0) return { state: "credits_exhausted", checkedAt: new Date().toISOString() };
  if (input.thresholdExceeded) return { state: "rate_limited", checkedAt: new Date().toISOString() };
  return { state: "available", checkedAt: new Date().toISOString() };
}
```

`usage-tracking.ts` に `getAgentSubscription(db, agentId)` を追加し、`agent_subscriptions` から読み出す。

**Step 4: Run test to verify it passes**

Run: `pnpm -F side-server test apps/server/src/__tests__/unit/agent-availability.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/server/src/utils/agent-availability.ts apps/server/src/utils/usage-tracking.ts apps/server/src/__tests__/unit/agent-availability.test.ts
git commit -m "feat(agents): add deterministic availability resolver"
```

### Task 4: `/api/agents/status` と `/:id/usage` を可観測契約に拡張する

**Files:**
- Modify: `apps/server/src/routes/agents.ts`
- Create: `apps/server/src/__tests__/unit/agents-routes-status.test.ts`
- Modify: `apps/server/src/agents/base/AgentInterface.ts`

**Step 1: Write the failing test**

```ts
it("should include availability and usage breakdown in /api/agents/status response", async () => {
  const res = await app.request("/api/agents/status");
  const body = await res.json();
  expect(body.agents[0].availability.state).toBeDefined();
  expect(body.agents[0].usage.totalTokens).toBeTypeOf("number");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -F side-server test apps/server/src/__tests__/unit/agents-routes-status.test.ts`
Expected: FAIL because response shape does not include new fields

**Step 3: Write minimal implementation**

`/api/agents/status` の1エージェント応答を以下に統一:

```ts
{
  id, name, icon, runtimeStatus: "idle" | "running" | "error",
  availability: { state, reasonCode, message, checkedAt },
  usage: {
    totalInputTokens, totalOutputTokens, totalTokens,
    totalCost, totalRequests, averageDuration
  },
  limits: { tokenLimit, contextLimit },
  uptime
}
```

`AgentInterface` に `getAvailabilityDetails?(): Promise<Record<string, unknown>>` を任意追加し、各Adapterの個別情報を将来拡張可能にする。

**Step 4: Run test to verify it passes**

Run: `pnpm -F side-server test apps/server/src/__tests__/unit/agents-routes-status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/server/src/routes/agents.ts apps/server/src/agents/base/AgentInterface.ts apps/server/src/__tests__/unit/agents-routes-status.test.ts
git commit -m "feat(agents): expose availability-aware status API"
```

### Task 5: Web Client で可用ステータスと実トークンを表示する

**Files:**
- Modify: `apps/web/src/components/panel/AgentStatusPanelContent.tsx`
- Modify: `apps/web/src/api.ts`
- Create: `apps/web/src/__tests__/components/agentStatusPanel.test.tsx`

**Step 1: Write the failing test**

```tsx
it("should render availability reason when agent is not available", async () => {
  render(<AgentStatusPanelContent />);
  expect(await screen.findByText(/credits_exhausted/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -F side-web test apps/web/src/__tests__/components/agentStatusPanel.test.tsx`
Expected: FAIL because UI does not render availability fields

**Step 3: Write minimal implementation**

`api.ts` に型付きラッパー追加:

```ts
export function getAgentStatus(): Promise<{ agents: AgentStatusDto[] }> {
  return request("/api/agents/status");
}
```

`AgentStatusPanelContent.tsx` を直接 `fetch` からAPI clientへ寄せ、以下を表示:
- `availability.state`
- 非`available`時の `availability.message`/`reasonCode`
- `usage.totalTokens` と `usage.totalCost`

**Step 4: Run test to verify it passes**

Run: `pnpm -F side-web test apps/web/src/__tests__/components/agentStatusPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/api.ts apps/web/src/components/panel/AgentStatusPanelContent.tsx apps/web/src/__tests__/components/agentStatusPanel.test.tsx
git commit -m "feat(web): show agent availability and real token usage"
```

### Task 6: Quality Gate と回帰確認

**Files:**
- Modify: `docs/specs/agents.md` (必要ならレスポンス例を更新)
- Modify: `docs/specs/frontend.md` (必要ならUI責務追記)
- Modify: `docs/specs/server.md` (必要なら新規/拡張ルート追記)

**Step 1: Run focused tests**

Run:
- `pnpm -F side-server test apps/server/src/__tests__/unit/token-metering.test.ts apps/server/src/__tests__/unit/agent-availability.test.ts apps/server/src/__tests__/unit/agents-routes-status.test.ts`
- `pnpm -F side-web test apps/web/src/__tests__/components/agentStatusPanel.test.tsx`

Expected: PASS

**Step 2: Run required project checks**

Run:
- `pnpm run type-check`
- `pnpm run lint`
- `pnpm run test`

Expected: all PASS

**Step 3: Invariant checklist**

- Q-1/Q-2: 可用性判定・トークン計測は `apps/server` に限定
- Q-3: APIレスポンスを固定型にし、テストで決定性を検証
- Q-4: エージェント間通信は既存MCP経路を維持
- Q-5: 閾値/課金パラメータは設定・DB経由
- Q-6: UIには要約済み構造化データのみ返却
- Q-7: 既存 `stop/restart` と Observer介入経路を維持

**Step 4: Evaluation score sanity**

- HIS: 維持/向上（UIは表示のみ）
- CES: 向上（生ログではなくusage集計を返す）
- CAS: 維持（既存契約レイヤー内）
- DS: 向上（判定器/抽出器を単体テスト）
- IS: 維持/向上（可用性理由を外部観測可能化）

**Step 5: Commit**

```bash
git add docs/specs/agents.md docs/specs/frontend.md docs/specs/server.md
git commit -m "docs(agents): document token metering and availability status contracts"
```

