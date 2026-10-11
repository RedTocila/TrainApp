import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getPublicCoachingFeatures,
  listPublicPlans,
  searchPublicExercises,
} from "@/lib/mcp/public-tools";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function jsonResult<T extends Record<string, unknown>>(data: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

/**
 * Public discovery server for ChatGPT.
 *
 * Authenticated tools (account data, saved plans, AI generation) are not registered.
 * Add them only after a ChatGPT-compatible OAuth flow is implemented and verified,
 * and only by calling the same subscription and usage-limit checks as the web app.
 */
export function createRutinaMcpServer(): McpServer {
  const server = new McpServer(
    { name: "rutina", version: "0.1.0" },
    { instructions: "RUTINA public fitness discovery. Tools are read-only and do not access user accounts." }
  );

  server.registerTool(
    "list_plans",
    {
      title: "List Rutina plans",
      description:
        "List the Rutina plans currently sold, with EUR prices and feature summaries. Does not include legacy plans or a user's subscription.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => jsonResult(listPublicPlans())
  );

  server.registerTool(
    "search_exercises",
    {
      title: "Search exercises",
      description:
        "Search the public Rutina exercise catalogue by name, muscle, or equipment. Returns at most 8 short matches. Does not return personal workout history.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .describe("Exercise name or keyword, for example squat or dumbbell row"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(8)
          .optional()
          .describe("Maximum matches to return. Defaults to 5."),
        muscle: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .optional()
          .describe("Optional muscle filter, matched against catalogue muscle tags"),
        equipment: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .optional()
          .describe("Optional equipment filter, matched against catalogue equipment tags"),
      }),
      annotations: readOnly,
    },
    async (args) => jsonResult(searchPublicExercises(args))
  );

  server.registerTool(
    "get_coaching_features",
    {
      title: "Explain Rutina coaching",
      description:
        "Describe Rutina workout and nutrition coaching and return public pricing and signup links. Does not generate a personal plan.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => jsonResult(getPublicCoachingFeatures())
  );

  return server;
}
