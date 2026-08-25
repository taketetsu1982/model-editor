import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { createTestClient } = require('../test-client.js');
const repoRoot = path.resolve(__dirname, '../../..');
const editorModule = path.join(repoRoot, 'src/mcp/tools/editor.js');
const processModule = path.join(repoRoot, 'src/mcp/editor-process.js');

function createFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'model-editor-mcp-editor-'));
  const modelPath = path.join(directory, 'model.json');
  fs.writeFileSync(modelPath, '{}');
  return { directory, modelPath };
}

function createToolsDir(source) {
  const toolsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-editor-mcp-editor-tools-'));
  fs.writeFileSync(path.join(toolsDir, 'editor.js'), source);
  return toolsDir;
}

function normalToolModule() {
  return `module.exports = require(${JSON.stringify(editorModule)});\n`;
}

function failingToolModule() {
  return `
const { EventEmitter } = require('events');
const { createEditorProcess } = require(${JSON.stringify(processModule)});
const { register } = require(${JSON.stringify(editorModule)});
exports.register = (ctx) => register(ctx, {
  createEditorProcess: () => createEditorProcess({
    spawn() {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => queueMicrotask(() => child.emit('close', 0, 'SIGTERM'));
      queueMicrotask(() => {
        child.stderr.emit('data', 'bind denied');
        child.emit('close', 1, null);
      });
      return child;
    },
  }),
});
`;
}

function resultValue(response) {
  return JSON.parse(response.content.find((item) => item.type === 'text').text);
}

async function openReachableEditor(harness, modelPath) {
  let response = await harness.client.callTool({ name: 'open_editor', arguments: { path: modelPath } });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const url = resultValue(response).url;
    try {
      const model = await fetch(`${url}model`);
      return { url, model };
    } catch (error) {
      if (attempt === 2) throw error;
      await harness.client.callTool({ name: 'close_editor', arguments: {} });
      response = await harness.client.callTool({ name: 'open_editor', arguments: { path: modelPath } });
    }
  }
}

describe('editor tools', () => {
  let harness;
  let fixture;
  let toolsDir;

  afterEach(async () => {
    if (harness) await harness.teardown();
    if (toolsDir) fs.rmSync(toolsDir, { recursive: true, force: true });
    if (fixture) fs.rmSync(fixture.directory, { recursive: true, force: true });
    harness = undefined;
    toolsDir = undefined;
    fixture = undefined;
  });

  async function connect(source = normalToolModule()) {
    fixture = createFixture();
    toolsDir = createToolsDir(source);
    harness = await createTestClient({ toolsDir });
  }

  it('open_editor は URL を返し、同じ path では既存サーバーを再利用する', async () => {
    await connect();
    const startedAt = Date.now();
    const { url: firstUrl, model } = await openReachableEditor(harness, fixture.modelPath);

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(firstUrl).toMatch(/^http:\/\/localhost:\d+\/$/);
    expect(model).toMatchObject({ status: 200 });

    const second = await harness.client.callTool({ name: 'open_editor', arguments: { path: fixture.modelPath } });
    expect(resultValue(second)).toEqual({ url: firstUrl });
  });

  it('close_editor は冪等に成功する', async () => {
    await connect();
    await harness.client.callTool({ name: 'open_editor', arguments: { path: fixture.modelPath } });

    expect(resultValue(await harness.client.callTool({ name: 'close_editor', arguments: {} }))).toEqual({ ok: true });
    expect(resultValue(await harness.client.callTool({ name: 'close_editor', arguments: {} }))).toEqual({ ok: true });
  });

  it('クライアント切断時に起動済みエディタを停止する', async () => {
    await connect();
    const response = await harness.client.callTool({ name: 'open_editor', arguments: { path: fixture.modelPath } });
    const url = resultValue(response).url;

    await harness.teardown();
    harness = undefined;
    await expect(fetch(`${url}model`)).rejects.toThrow();
  });

  it('ローカル専用の説明と edit prompt を登録する', async () => {
    await connect();
    const { tools } = await harness.client.listTools();
    expect(tools).toContainEqual(expect.objectContaining({
      name: 'open_editor',
      description: expect.stringMatching(/ローカル|local/i),
    }));
    await expect(harness.client.listPrompts()).resolves.toMatchObject({
      prompts: [expect.objectContaining({ name: 'edit' })],
    });
  });

  it('bind 失敗時は read_model / save_model への案内を返す', async () => {
    await connect(failingToolModule());
    const response = await harness.client.callTool({ name: 'open_editor', arguments: { path: fixture.modelPath } });
    const text = response.content.find((item) => item.type === 'text').text;

    expect(response.isError).toBe(true);
    expect(text).toContain('read_model');
    expect(text).toContain('save_model');
    expect(text).toContain('起動できません');
  });

  it('存在しない path は path を含むエラーになる', async () => {
    await connect();
    const missingPath = path.join(fixture.directory, 'missing.json');
    const response = await harness.client.callTool({ name: 'open_editor', arguments: { path: missingPath } });

    expect(response.isError).toBe(true);
    expect(response.content.find((item) => item.type === 'text').text).toContain(missingPath);
  });
});
