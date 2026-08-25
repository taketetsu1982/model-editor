import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { createTestClient } = require('../test-client.js');
const { saveModel } = require('./model-io.js');
const modelIoPath = require.resolve('./model-io.js');

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'model-editor-model-io-'));
  const toolsDir = path.join(root, 'tools');
  fs.mkdirSync(toolsDir);
  fs.writeFileSync(path.join(toolsDir, 'model-io.js'), `module.exports = require(${JSON.stringify(modelIoPath)});\n`);
  return { root, toolsDir };
}

function resultJson(result) {
  return JSON.parse(result.content[0].text);
}

describe('モデル JSON MCP tools', () => {
  let harness;
  let fixture;

  afterEach(async () => {
    if (harness) await harness.teardown();
    if (fixture) fs.rmSync(fixture.root, { recursive: true, force: true });
    harness = undefined;
    fixture = undefined;
  });

  async function connect() {
    fixture = createFixture();
    harness = await createTestClient({ toolsDir: fixture.toolsDir });
  }

  it('既存 JSON を読み取り、不在のパスはそのパスを含むエラーにする', async () => {
    await connect();
    const modelPath = path.join(fixture.root, 'model.json');
    const model = { objects: [{ id: 'product' }] };
    fs.writeFileSync(modelPath, JSON.stringify(model));

    const read = await harness.client.callTool({ name: 'read_model', arguments: { path: modelPath } });
    expect(resultJson(read)).toEqual(model);
    const tools = await harness.client.listTools();
    expect(tools.tools.find((tool) => tool.name === 'read_model').description).toContain('ホスト側の権限機構が一次のゲート');

    const missingPath = path.join(fixture.root, 'missing.json');
    const missing = await harness.client.callTool({ name: 'read_model', arguments: { path: missingPath } });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain(missingPath);
  });

  it('object でない model を書き込まずに拒否する', async () => {
    await connect();
    const modelPath = path.join(fixture.root, 'model.json');
    const original = '{"unchanged":true}\n';
    fs.writeFileSync(modelPath, original);

    const rejected = await harness.client.callTool({ name: 'save_model', arguments: { path: modelPath, model: ['invalid'] } });
    expect(rejected.isError).toBe(true);
    expect(fs.readFileSync(modelPath, 'utf8')).toBe(original);
  });

  it('循環参照の model を書き込まずに拒否する', async () => {
    await connect();
    const modelPath = path.join(fixture.root, 'cycle.json');
    const original = '{"unchanged":true}\n';
    fs.writeFileSync(modelPath, original);
    const model = {};
    model.self = model;

    await expect(saveModel(modelPath, model)).rejects.toThrow('JSON に変換できません');
    expect(fs.readFileSync(modelPath, 'utf8')).toBe(original);
  });

  it('原子的に保存し、一時ファイルを残さない', async () => {
    await connect();
    const modelPath = path.join(fixture.root, 'model.json');
    const saved = await harness.client.callTool({ name: 'save_model', arguments: { path: modelPath, model: { name: 'new' } } });

    expect(resultJson(saved)).toEqual({ ok: true });
    expect(JSON.parse(fs.readFileSync(modelPath, 'utf8'))).toEqual({ name: 'new' });
    expect(fs.readdirSync(fixture.root).filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
  });

  it('新規ファイルを作成するが、親ディレクトリは作成しない', async () => {
    await connect();
    const modelPath = path.join(fixture.root, 'new-model.json');
    const created = await harness.client.callTool({ name: 'save_model', arguments: { path: modelPath, model: { name: 'new' } } });
    expect(resultJson(created)).toEqual({ ok: true });
    expect(fs.existsSync(modelPath)).toBe(true);

    const missingDir = path.join(fixture.root, 'missing');
    const missingPath = path.join(missingDir, 'model.json');
    const missing = await harness.client.callTool({ name: 'save_model', arguments: { path: missingPath, model: {} } });
    expect(missing.isError).toBe(true);
    expect(fs.existsSync(missingDir)).toBe(false);
  });

  it('_variants を持つ既存モデルの上書きには force を要求する', async () => {
    await connect();
    const protectedPath = path.join(fixture.root, 'protected.json');
    const protectedOriginal = '{"_variants":{},"name":"original"}\n';
    fs.writeFileSync(protectedPath, protectedOriginal);

    const rejected = await harness.client.callTool({ name: 'save_model', arguments: { path: protectedPath, model: { name: 'new' } } });
    expect(rejected.isError).toBe(true);
    expect(fs.readFileSync(protectedPath, 'utf8')).toBe(protectedOriginal);

    const forced = await harness.client.callTool({ name: 'save_model', arguments: { path: protectedPath, model: { name: 'new' }, force: true } });
    expect(resultJson(forced)).toEqual({ ok: true });

    const ordinaryPath = path.join(fixture.root, 'ordinary.json');
    fs.writeFileSync(ordinaryPath, '{"name":"original"}\n');
    const ordinary = await harness.client.callTool({ name: 'save_model', arguments: { path: ordinaryPath, model: { name: 'new' } } });
    expect(resultJson(ordinary)).toEqual({ ok: true });
  });

  it('壊れた既存 JSON は force 無しで保持し、force があれば上書きする', async () => {
    await connect();
    const modelPath = path.join(fixture.root, 'broken.json');
    const broken = '{"_variants":';
    fs.writeFileSync(modelPath, broken);

    const rejected = await harness.client.callTool({ name: 'save_model', arguments: { path: modelPath, model: { name: 'new' } } });
    expect(rejected.isError).toBe(true);
    expect(fs.readFileSync(modelPath, 'utf8')).toBe(broken);

    const forced = await harness.client.callTool({ name: 'save_model', arguments: { path: modelPath, model: { name: 'new' }, force: true } });
    expect(resultJson(forced)).toEqual({ ok: true });
    expect(JSON.parse(fs.readFileSync(modelPath, 'utf8'))).toEqual({ name: 'new' });
  });

  it('読み取り不能な既存ファイルは force があっても保持する', async () => {
    await connect();
    const modelPath = path.join(fixture.root, 'unreadable.json');
    const original = '{"name":"original"}\n';
    fs.writeFileSync(modelPath, original);
    fs.chmodSync(modelPath, 0o000);

    try {
      try {
        fs.readFileSync(modelPath, 'utf8');
        console.warn('SKIPPED: 現在の実行ユーザーは mode 000 のファイルを読み取れるため EACCES を再現できません');
        return;
      } catch (error) {
        if (error.code !== 'EACCES') throw error;
      }

      const rejected = await harness.client.callTool({ name: 'save_model', arguments: { path: modelPath, model: { name: 'new' }, force: true } });
      expect(rejected.isError).toBe(true);
    } finally {
      fs.chmodSync(modelPath, 0o600);
    }

    expect(fs.readFileSync(modelPath, 'utf8')).toBe(original);
  });
});
