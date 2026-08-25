const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { createEditorProcess } = require('../editor-process.js');

const EDIT_SKILL_PATH = path.resolve(__dirname, '../../../skills/edit/SKILL.md');

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error) {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

function register(ctx, { createEditorProcess: makeEditorProcess = createEditorProcess } = {}) {
  const editor = makeEditorProcess();

  ctx.onToolCall(() => editor.resetActivity());
  ctx.onShutdown(() => editor.stop());

  // Why not（ここでブラウザを開く）: MCP サーバーは URL を返すだけにしてクライアントが開くことで、
  // macOS の open コマンドへ依存せず、ローカル実行できない環境にも適切に失敗を返せる。
  ctx.server.registerTool('open_editor', {
    description: 'ローカル実行環境専用: モデルを視覚編集するエディタを localhost で起動し、URL を返します。',
    inputSchema: { path: z.string() },
  }, async ({ path: modelPath }) => {
    try {
      await fs.promises.access(modelPath, fs.constants.F_OK);
    } catch (error) {
      return errorResult(`モデル JSON を読み取れません: ${modelPath}: ${error.message}`);
    }

    try {
      return textResult({ url: await editor.start(modelPath) });
    } catch (error) {
      return errorResult(
        `この実行環境ではエディタを起動できません。read_model / save_model で編集してください。詳細: ${error.message}`,
      );
    }
  });

  ctx.server.registerTool('close_editor', {
    description: '起動中のローカルエディタを停止します。未起動でも成功します。',
  }, async () => {
    await editor.stop();
    return textResult({ ok: true });
  });

  ctx.server.registerPrompt(
    'edit',
    { description: 'ローカルエディタを起動してモデルを視覚編集する手順' },
    async () => ({
      messages: [{ role: 'user', content: { type: 'text', text: fs.readFileSync(EDIT_SKILL_PATH, 'utf8') } }],
    }),
  );
}

module.exports = { register };
