import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpRequest } from "../handle-request";
import {
  getPublicCoachingFeatures,
  listPublicPlans,
  searchPublicExercises,
} from "../public-tools";

const MCP_URL = "https://rutina.al/api/mcp";
const ACCEPT = "application/json, text/event-stream";

function rpc(id: number, method: string, params?: unknown) {
  return new Request(MCP_URL, {
    method: "POST",
    headers: {
      accept: ACCEPT,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });
}

test("list_plans returns sold plans and public pricing", () => {
  const result = listPublicPlans();
  assert.deepEqual(
    result.plans.map((plan) => plan.name),
    ["RUTINA Free", "RUTINA Plus", "RUTINA Pro"]
  );
  assert.equal(result.plans[0]?.monthlyPrice, "Free");
  assert.equal(result.plans[0]?.annualPrice, "Free");
  assert.equal(result.plans[1]?.monthlyPrice, "€7/month");
  assert.equal(result.plans[1]?.annualPrice, "€70/year");
  assert.equal(result.plans[2]?.monthlyPrice, "€25/month");
  assert.equal(result.plans[2]?.annualPrice, "€250/year");
  assert.equal(result.pricingUrl, "https://rutina.al/pricing");
  assert.equal(result.plans.some((plan) => plan.id === "basic"), false);
});

test("search_exercises limits matches and omits private fields", () => {
  const result = searchPublicExercises({ query: "squat", limit: 3 });
  assert.equal(result.limit, 3);
  assert.ok(result.totalMatches >= result.exercises.length);
  assert.ok(result.exercises.length > 0);
  assert.ok(result.exercises.length <= 3);
  assert.match(result.exercises[0]?.name ?? "", /squat/i);
  assert.equal("gif_url" in (result.exercises[0] ?? {}), false);
});

test("search limit cannot exceed 8", () => {
  const result = searchPublicExercises({ query: "press", limit: 50 });
  assert.equal(result.limit, 8);
  assert.ok(result.exercises.length <= 8);
});

test("coaching features stay public", () => {
  const features = getPublicCoachingFeatures();
  assert.equal(features.links.pricing, "https://rutina.al/pricing");
  assert.equal(features.links.signup, "https://rutina.al/register");
  assert.match(features.accountNote, /cannot create an account/i);
});

test("streamable HTTP initialize and tools/list need no session", async () => {
  const init = await handleMcpRequest(
    rpc(1, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "rutina-test", version: "0.0.1" },
    })
  );
  assert.equal(init.status, 200);
  const initBody = (await init.json()) as {
    result?: { serverInfo?: { name?: string }; protocolVersion?: string };
  };
  assert.equal(initBody.result?.serverInfo?.name, "rutina");
  assert.ok(initBody.result?.protocolVersion);

  const listed = await handleMcpRequest(rpc(2, "tools/list"));
  assert.equal(listed.status, 200);
  const listBody = (await listed.json()) as {
    result?: { tools?: { name: string }[] };
  };
  assert.deepEqual(
    listBody.result?.tools?.map((tool) => tool.name).sort(),
    ["get_coaching_features", "list_plans", "search_exercises"]
  );
});

test("search_exercises rejects a query that is too short", async () => {
  const response = await handleMcpRequest(
    rpc(3, "tools/call", {
      name: "search_exercises",
      arguments: { query: "a" },
    })
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    result?: { isError?: boolean };
    error?: { message?: string };
  };
  assert.ok(body.result?.isError || body.error);
});
