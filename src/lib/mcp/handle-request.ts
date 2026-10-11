import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRutinaMcpServer } from "@/lib/mcp/server";

/**
 * Stateless Streamable HTTP. A fresh server and transport are required per request.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const server = createRutinaMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    console.error("MCP request failed", error instanceof Error ? error.message : "unknown");
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "MCP request failed" },
        id: null,
      },
      { status: 500 }
    );
  }
}
