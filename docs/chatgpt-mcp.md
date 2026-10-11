# ChatGPT MCP connector

Public, read-only discovery server for ChatGPT. It does not sign users in, read accounts, or generate personal plans.

## Endpoint

`https://rutina.al/api/mcp`

Local: `http://localhost:3000/api/mcp`

The route uses the official `@modelcontextprotocol/sdk` Streamable HTTP transport in stateless JSON mode. Each request creates a new server. There is no session id and no API key.

## Tools

- `list_plans` — sold plans from `src/lib/subscription-plans.ts` (AI Pro and Elite), with EUR prices and features.
- `search_exercises` — public exercise catalogue. `query` is required (2–80 characters). `limit` is 1–8 and defaults to 5.
- `get_coaching_features` — workout and nutrition coaching summary, plus `https://rutina.al/pricing` and `https://rutina.al/register`.

Clients must send `Accept: application/json, text/event-stream` and `Content-Type: application/json` on POST.

## Authenticated tools

Not implemented. Do not add account, subscription, or AI generation tools until a ChatGPT-compatible OAuth flow is in place and those tools call the existing subscription and usage-limit checks.

## ChatGPT setup

1. Deploy the app so `https://rutina.al/api/mcp` is live. This repository does not publish that for you.
2. In ChatGPT, create an app or connector that uses a remote MCP server and set the server URL to `https://rutina.al/api/mcp`.
3. Leave authentication off for this first version. The tools are anonymous and read-only.
4. Confirm `list_plans`, `search_exercises`, and `get_coaching_features` appear, then call `search_exercises` with a query such as `squat`.

## Local check

```bash
npx tsx --test src/lib/mcp/__tests__/mcp-endpoint.test.ts
```
