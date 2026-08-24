const fs = require('fs');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const DEFAULT_TOOLS_DIR = path.join(__dirname, 'tools');

function registerModules(ctx, toolsDir) {
  if (!fs.existsSync(toolsDir)) return;

  for (const entry of fs.readdirSync(toolsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) continue;
    const module = require(path.join(toolsDir, entry.name));
    if (typeof module.register !== 'function') {
      throw new TypeError(`${entry.name} must export register(ctx)`);
    }
    module.register(ctx);
  }
}

function registerListFallback(server, method, schema, response) {
  try {
    server.assertCanSetRequestHandler(method);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A request handler for ')) return;
    throw error;
  }
  server.setRequestHandler(schema, response);
}

function createServer({ toolsDir = DEFAULT_TOOLS_DIR } = {}) {
  const shutdownHandlers = new Set();
  const toolCallHandlers = new Set();
  const mcpServer = new McpServer(
    { name: 'model-editor', version: require('../../package.json').version },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  const server = new Proxy(mcpServer, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property !== 'registerTool' && property !== 'tool') return value;

      return (...args) => {
        const handler = args.at(-1);
        if (typeof handler !== 'function') return value.apply(target, args);
        args[args.length - 1] = async (...handlerArgs) => {
          for (const callback of toolCallHandlers) await callback();
          return handler(...handlerArgs);
        };
        return value.apply(target, args);
      };
    },
  });

  const ctx = {
    server,
    onToolCall(callback) { toolCallHandlers.add(callback); },
    onShutdown(callback) { shutdownHandlers.add(callback); },
  };
  registerModules(ctx, toolsDir);

  // Why not（空の list ハンドラを先に登録する）: McpServer の登録 API が自分で list
  // ハンドラを持つため、先行登録すると後続 Task の tool / resource / prompt 登録を妨げる。
  registerListFallback(mcpServer.server, 'tools/list', ListToolsRequestSchema, async () => ({ tools: [] }));
  registerListFallback(mcpServer.server, 'resources/list', ListResourcesRequestSchema, async () => ({ resources: [] }));
  registerListFallback(mcpServer.server, 'prompts/list', ListPromptsRequestSchema, async () => ({ prompts: [] }));

  return { mcpServer, shutdownHandlers, toolCallHandlers };
}

// Why not（toolsDir を引数だけで渡す）: テストは bin を子プロセスとして起動して stdio で繋ぐため、
// 呼び出し側から引数を渡す口がない。環境変数を既定値に据えるのが唯一の経路になる。
// これを本番の配布物にも開けたままにしているのは、MCP サーバーがユーザーのローカル権限で動く道具で、
// 環境変数を設定できる者は同じ権限で既にプロセスを起動できるため（spec F群の権限モデル）。
async function startServer({ toolsDir = process.env.MODEL_EDITOR_MCP_TOOLS_DIR } = {}) {
  const { mcpServer, shutdownHandlers } = createServer({ toolsDir });
  const transport = new StdioServerTransport();
  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const callback of shutdownHandlers) await callback();
    await mcpServer.close();
    process.exit(0);
  }

  mcpServer.server.onclose = shutdown;
  process.stdin.once('end', shutdown);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  await mcpServer.connect(transport);
}

module.exports = { createServer, startServer };
