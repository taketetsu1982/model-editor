import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { createTestClient } = require('./test-client.js');

function createToolsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'model-editor-mcp-tools-'));
}

describe('stdio MCP server', () => {
  let harness;

  afterEach(async () => {
    if (harness) await harness.teardown();
  });

  it('空の tools/ でも initialize と 3 つの空 list に応答する', async () => {
    const toolsDir = createToolsDir();
    try {
      harness = await createTestClient({ toolsDir });

      expect(harness.client.getServerCapabilities()).toMatchObject({
        tools: {},
        resources: {},
        prompts: {},
      });
      await expect(harness.client.listTools()).resolves.toMatchObject({ tools: [] });
      await expect(harness.client.listResources()).resolves.toMatchObject({ resources: [] });
      await expect(harness.client.listPrompts()).resolves.toMatchObject({ prompts: [] });
    } finally {
      fs.rmSync(toolsDir, { recursive: true, force: true });
    }
  });

  it('登録モジュールが tool、resource、prompt の list を上書きできる', async () => {
    const toolsDir = createToolsDir();
    const probePath = path.join(toolsDir, '__server-test-probe.js');
    fs.writeFileSync(probePath, `
exports.register = (ctx) => {
  ctx.server.registerTool('probe_tool', {}, async () => ({ content: [] }));
  ctx.server.registerResource('probe_resource', 'model-editor://probe', {}, async () => ({ contents: [] }));
  ctx.server.registerPrompt('probe_prompt', {}, async () => ({ messages: [] }));
};
`);

    try {
      harness = await createTestClient({ toolsDir });
      await expect(harness.client.listTools()).resolves.toMatchObject({
        tools: [expect.objectContaining({ name: 'probe_tool' })],
      });
      await expect(harness.client.listResources()).resolves.toMatchObject({
        resources: [expect.objectContaining({ name: 'probe_resource' })],
      });
      await expect(harness.client.listPrompts()).resolves.toMatchObject({
        prompts: [expect.objectContaining({ name: 'probe_prompt' })],
      });
    } finally {
      fs.rmSync(toolsDir, { recursive: true, force: true });
    }
  });

  it('teardown 後に子プロセスを終了する', async () => {
    harness = await createTestClient();
    const transport = harness.transport;
    expect(transport.pid).not.toBeNull();

    await harness.teardown();
    harness = undefined;
    expect(transport.pid).toBeNull();
  });
});
