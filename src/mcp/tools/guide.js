const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const SECTIONS = ['glossary', 'schema', 'patterns', 'examples'];
const GUIDE_DIR = path.resolve(__dirname, '../../../skills/generate');
const GENERATE_SKILL_PATH = path.join(GUIDE_DIR, 'SKILL.md');

function readGuide(section) {
  return fs.readFileSync(path.join(GUIDE_DIR, `${section}.md`), 'utf8');
}

function readAllGuides() {
  return SECTIONS.map(readGuide).join('\n\n');
}

function register(ctx) {
  ctx.server.registerTool(
    'get_modeling_guide',
    {
      description: 'OOUI モデリング手法のガイドを取得する。section を省略すると全章を返す。',
      inputSchema: {
        section: z.enum(SECTIONS).optional(),
      },
    },
    async ({ section } = {}) => {
      if (section !== undefined && !SECTIONS.includes(section)) {
        throw new Error(`Unknown section "${section}". Valid sections: ${SECTIONS.join(', ')}`);
      }

      return {
        content: [{ type: 'text', text: section ? readGuide(section) : readAllGuides() }],
      };
    },
  );

  for (const section of SECTIONS) {
    ctx.server.registerResource(
      `guide_${section}`,
      `model-editor://guide/${section}`,
      {
        description: `OOUI モデリングガイド: ${section}`,
        mimeType: 'text/markdown',
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: readGuide(section) }],
      }),
    );
  }

  ctx.server.registerPrompt(
    'generate',
    { description: 'PRD から OOUI プロダクトモデル JSON を生成する手順' },
    async () => ({
      messages: [{ role: 'user', content: { type: 'text', text: fs.readFileSync(GENERATE_SKILL_PATH, 'utf8') } }],
    }),
  );
}

// Why not（markdown を src/mcp/ に複製する）: skills/generate/ が plugin と MCP の共通の正典であり、
// 複製すると Phase 3 が前提とする single source 化を損なう。
module.exports = { register };
