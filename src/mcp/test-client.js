const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function createTestClient({ toolsDir } = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '..', '..', 'bin', 'model-editor.js'), 'mcp'],
    stderr: 'pipe',
    env: toolsDir ? { MODEL_EDITOR_MCP_TOOLS_DIR: toolsDir } : undefined,
  });
  const client = new Client({ name: 'model-editor-test', version: '1.0.0' });
  await client.connect(transport);

  return {
    client,
    transport,
    async teardown() {
      await client.close();
    },
  };
}

module.exports = { createTestClient };
