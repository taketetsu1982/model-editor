import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { createTestClient } = require('../test-client.js');
const sections = ['glossary', 'schema', 'patterns', 'examples'];
const repoRoot = path.resolve(__dirname, '../../..');
const guideModule = path.join(repoRoot, 'src/mcp/tools/guide.js');

function firstSentence(section) {
  const markdown = fs.readFileSync(path.join(repoRoot, 'skills/generate', `${section}.md`), 'utf8');
  return markdown.split('\n').find((line) => line.trim() && !line.startsWith('#')).trim();
}

function createToolsDir() {
  const toolsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-editor-mcp-guide-'));
  fs.writeFileSync(
    path.join(toolsDir, 'guide.js'),
    `module.exports = require(${JSON.stringify(guideModule)});\n`,
  );
  return toolsDir;
}

function toolText(response) {
  return response.content.find((item) => item.type === 'text').text;
}

describe('get_modeling_guide', () => {
  let harness;
  let toolsDir;

  afterEach(async () => {
    if (harness) await harness.teardown();
    if (toolsDir) fs.rmSync(toolsDir, { recursive: true, force: true });
    harness = undefined;
    toolsDir = undefined;
  });

  async function connect() {
    toolsDir = createToolsDir();
    harness = await createTestClient({ toolsDir });
  }

  it('section 未指定では全ガイドを返す', async () => {
    await connect();
    const response = await harness.client.callTool({ name: 'get_modeling_guide', arguments: {} });
    const text = toolText(response);

    for (const section of sections) expect(text).toContain(firstSentence(section));
  });

  it('section 指定では対応するガイドだけを返す', async () => {
    await connect();
    const response = await harness.client.callTool({
      name: 'get_modeling_guide',
      arguments: { section: 'schema' },
    });
    const text = toolText(response);

    expect(text).toContain(firstSentence('schema'));
    expect(text).not.toContain(firstSentence('patterns'));
  });

  it('未知の section は有効な section 名を示して拒否する', async () => {
    await connect();
    const response = await harness.client.callTool({
      name: 'get_modeling_guide',
      arguments: { section: 'bogus' },
    });
    const text = toolText(response);

    expect(response.isError).toBe(true);
    for (const section of sections) expect(text).toContain(section);
  });

  it('各ガイドを resource として提供する', async () => {
    await connect();
    const { resources } = await harness.client.listResources();

    for (const section of sections) {
      const uri = `model-editor://guide/${section}`;
      expect(resources).toContainEqual(expect.objectContaining({ uri }));
      const response = await harness.client.readResource({ uri });
      expect(response.contents[0]).toMatchObject({ uri, text: expect.stringContaining(firstSentence(section)) });
    }
  });

  it('generate prompt と tool を登録する', async () => {
    await connect();
    await expect(harness.client.listTools()).resolves.toMatchObject({
      tools: [expect.objectContaining({ name: 'get_modeling_guide' })],
    });
    await expect(harness.client.listPrompts()).resolves.toMatchObject({
      prompts: [expect.objectContaining({ name: 'generate' })],
    });
  });
});
