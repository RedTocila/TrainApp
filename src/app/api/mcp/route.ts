import { handleMcpRequest } from "@/lib/mcp/handle-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function mcp(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export const GET = mcp;
export const POST = mcp;
export const DELETE = mcp;
