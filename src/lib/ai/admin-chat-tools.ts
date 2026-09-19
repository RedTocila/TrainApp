import type OpenAI from "openai";
import {
  adminBuildNutritionForClient,
  adminBuildWorkoutForClient,
  adminCreateClientAccount,
  adminDeleteClient,
  adminGetClientDetail,
  adminGetPlatformStats,
  adminGetRevenue,
  adminGrantSubscription,
  adminListClients,
  adminListOffers,
  adminResolveClient,
  adminRevokeSubscription,
  adminSendMail,
} from "@/lib/actions/admin-ops";
import type { RevenuePeriod } from "@/lib/actions/admin-stats";
import type { MailAudience } from "@/lib/mail-presets";
import type { BillingInterval, SoldSubscriptionPlanId } from "@/lib/subscription-plans";

export type AdminChatToolEvent =
  | { type: "tool_start"; name: string }
  | { type: "tool_done"; name: string };

export const ADMIN_TOOL_STATUS_LABELS: Record<string, string> = {
  list_clients: "Loading clients…",
  find_client: "Searching clients…",
  get_client_detail: "Loading client…",
  get_platform_stats: "Loading platform stats…",
  get_revenue: "Loading revenue…",
  list_offers: "Loading offers…",
  grant_subscription: "Updating subscription…",
  revoke_subscription: "Revoking subscription…",
  create_client_account: "Creating account…",
  delete_client: "Deleting client…",
  build_workout_for_client: "Building workout…",
  build_nutrition_for_client: "Building nutrition plan…",
  send_mail: "Preparing mail…",
};

export const ADMIN_CHAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_clients",
      description:
        "List clients with subscription labels. Use filter to narrow: all, subscribed, trialing, not_subscribed.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "subscribed", "trialing", "not_subscribed"],
          },
          limit: { type: "number", description: "Max rows (1-100, default 40)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_client",
      description:
        "Find a client by UUID, email, or name fragment. Prefer this before mutating when the admin names someone.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "UUID, email, or name" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_client_detail",
      description:
        "Get one client's subscription, profile basics, and active workout/nutrition assignments.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_platform_stats",
      description: "Platform totals: client counts, trials, paid subs, revenue summaries.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_revenue",
      description: "Revenue for a period from completed subscription orders.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["1d", "7d", "30d", "90d", "all"],
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_offers",
      description: "List subscription offers (discounts) configured in admin.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "grant_subscription",
      description:
        "Grant or extend a paid subscription (ai = AI Pro, elite = Elite). Destructive-ish: first call without confirm (or confirm=false) returns a preview; only call with confirm=true after the admin explicitly approves.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          plan: { type: "string", enum: ["ai", "elite"] },
          interval: { type: "string", enum: ["monthly", "annual"] },
          extend_from_now: {
            type: "boolean",
            description:
              "If true (default), period starts now. If false and they still have time left, extend from current expiry.",
          },
          confirm: { type: "boolean" },
        },
        required: ["client_id", "plan", "interval"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "revoke_subscription",
      description:
        "Cancel a client's subscription access. Preview first; confirm=true only after admin approval.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client_account",
      description:
        "Create a new client auth account + profile. Optionally grant a plan. Returns a temporary password when confirmed. Preview first; confirm=true only after approval.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string" },
          full_name: { type: "string" },
          password: {
            type: "string",
            description: "Optional; auto-generated if omitted",
          },
          plan: { type: "string", enum: ["ai", "elite"] },
          interval: { type: "string", enum: ["monthly", "annual"] },
          confirm: { type: "boolean" },
        },
        required: ["email", "full_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_client",
      description:
        "Permanently delete a client account. Preview first; confirm=true only after explicit approval.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_workout_for_client",
      description:
        "Generate a personalized workout from the client's profile and assign it as their active personal plan. Preview first; confirm=true applies and assigns.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          preferences: {
            type: "string",
            description: "Extra instructions (days/week, equipment, focus).",
          },
          workout_kind: {
            type: "string",
            enum: ["strength", "hiit"],
          },
          confirm: { type: "boolean" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_nutrition_for_client",
      description:
        "Generate a nutrition day menu from the client's profile, assign it, and update macro targets. Preview first; confirm=true applies.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          preferences: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_mail",
      description:
        "Email clients. Without confirm, runs a dry-run preview. With confirm=true, sends for real (max 100 recipients).",
      parameters: {
        type: "object",
        properties: {
          audience: {
            type: "string",
            enum: ["all", "subscribed", "not_subscribed", "trialing", "single"],
          },
          client_id: {
            type: "string",
            description: "Required when audience=single",
          },
          subject: { type: "string" },
          body: {
            type: "string",
            description: "Plain text; use {{name}} for first name personalization",
          },
          confirm: { type: "boolean" },
        },
        required: ["audience", "subject", "body"],
        additionalProperties: false,
      },
    },
  },
];

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

export async function executeAdminChatTool(
  name: string,
  argsJson: string,
  onEvent?: (event: AdminChatToolEvent) => void
): Promise<string> {
  onEvent?.({ type: "tool_start", name });
  const args = parseToolArgs(argsJson);

  try {
    let result: unknown;

    switch (name) {
      case "list_clients": {
        const filter = args.filter as
          | "all"
          | "subscribed"
          | "trialing"
          | "not_subscribed"
          | undefined;
        const limit = typeof args.limit === "number" ? args.limit : undefined;
        result = await adminListClients({ filter, limit });
        break;
      }
      case "find_client": {
        result = await adminResolveClient(asString(args.query));
        break;
      }
      case "get_client_detail": {
        result = await adminGetClientDetail(asString(args.client_id));
        break;
      }
      case "get_platform_stats": {
        result = await adminGetPlatformStats();
        break;
      }
      case "get_revenue": {
        const period = (asString(args.period) || "30d") as RevenuePeriod;
        result = await adminGetRevenue(period);
        break;
      }
      case "list_offers": {
        result = await adminListOffers();
        break;
      }
      case "grant_subscription": {
        result = await adminGrantSubscription({
          clientId: asString(args.client_id),
          plan: asString(args.plan) as SoldSubscriptionPlanId,
          interval: asString(args.interval) as BillingInterval,
          extendFromNow: asBool(args.extend_from_now),
          confirm: asBool(args.confirm),
        });
        break;
      }
      case "revoke_subscription": {
        result = await adminRevokeSubscription({
          clientId: asString(args.client_id),
          confirm: asBool(args.confirm),
        });
        break;
      }
      case "create_client_account": {
        result = await adminCreateClientAccount({
          email: asString(args.email),
          fullName: asString(args.full_name),
          password: asString(args.password) || undefined,
          plan: asString(args.plan)
            ? (asString(args.plan) as SoldSubscriptionPlanId)
            : null,
          interval: asString(args.interval)
            ? (asString(args.interval) as BillingInterval)
            : undefined,
          confirm: asBool(args.confirm),
        });
        break;
      }
      case "delete_client": {
        result = await adminDeleteClient({
          clientId: asString(args.client_id),
          confirm: asBool(args.confirm),
        });
        break;
      }
      case "build_workout_for_client": {
        const kind = asString(args.workout_kind);
        result = await adminBuildWorkoutForClient({
          clientId: asString(args.client_id),
          preferences: asString(args.preferences) || undefined,
          workoutKind:
            kind === "hiit" || kind === "strength" ? kind : null,
          confirm: asBool(args.confirm),
        });
        break;
      }
      case "build_nutrition_for_client": {
        result = await adminBuildNutritionForClient({
          clientId: asString(args.client_id),
          preferences: asString(args.preferences) || undefined,
          confirm: asBool(args.confirm),
        });
        break;
      }
      case "send_mail": {
        result = await adminSendMail({
          audience: asString(args.audience) as MailAudience,
          clientId: asString(args.client_id) || null,
          subject: asString(args.subject),
          body: asString(args.body),
          confirm: asBool(args.confirm),
        });
        break;
      }
      default:
        result = { error: `Unknown tool: ${name}` };
    }

    onEvent?.({ type: "tool_done", name });
    return JSON.stringify(result);
  } catch (error) {
    onEvent?.({ type: "tool_done", name });
    const message = error instanceof Error ? error.message : "Tool failed";
    return JSON.stringify({ error: message });
  }
}

export const ADMIN_SYSTEM_PROMPT = `You are the RUTINA platform admin copilot. You help the coach/admin operate the product via tools.

Capabilities:
- Look up clients, subscriptions, revenue, offers
- Grant/revoke subscriptions (ai = AI Pro, elite = Elite)
- Create or delete client accounts
- Build and assign personalized workouts and nutrition plans for a client
- Send mail (dry-run first)

Rules:
1. Never invent client IDs or emails — use find_client / list_clients first.
2. For any mutating tool (grant, revoke, create, delete, build_*, send_mail): call once with confirm omitted/false to get a preview, summarize it to the admin, and ONLY call again with confirm=true after they clearly approve (yes / confirm / do it / etc.).
3. Be concise and operational. Prefer bullet facts over fluff.
4. When you create an account, surface the temporary_password clearly so the admin can share it.
5. You cannot run arbitrary SQL or change Supabase schema. Stay within these tools.
6. If multiple clients match a name, ask which one (show id + email) before mutating.`;
