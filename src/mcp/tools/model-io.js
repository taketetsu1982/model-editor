const fs = require('fs');
const path = require('path');
const { z } = require('zod');

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error) {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

async function saveModel(modelPath, model, force) {
  if (model === null || typeof model !== 'object' || Array.isArray(model)) {
    throw new TypeError('model は JSON object である必要があります');
  }

  let serialized;
  try {
    serialized = JSON.stringify(model, null, 2);
  } catch (error) {
    throw new TypeError(`model を JSON に変換できません: ${error.message}`);
  }

  const parentDir = path.dirname(modelPath);
  const parent = await fs.promises.stat(parentDir);
  if (!parent.isDirectory()) {
    throw new Error(`保存先の親パスはディレクトリではありません: ${parentDir}`);
  }

  let existing;
  try {
    // Why not（force: true なら既存ファイルを一切読まない）: rename は親ディレクトリの権限だけで
    // 成立するため、読み取り不能なファイルまで置換でき、force の意味が変種保護の解除を超えてしまう。
    const existingText = await fs.promises.readFile(modelPath, 'utf8');
    try {
      existing = JSON.parse(existingText);
    } catch (error) {
      if (!force || !(error instanceof SyntaxError)) throw error;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing && Object.prototype.hasOwnProperty.call(existing, '_variants') && !force) {
    throw new Error(`_variants を含むモデルを上書きするには force: true が必要です: ${modelPath}`);
  }

  const temporaryPath = `${modelPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.promises.writeFile(temporaryPath, serialized);
    await fs.promises.rename(temporaryPath, modelPath);
  } catch (error) {
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function register(ctx) {
  const pathDescription = 'path はホスト側の権限機構が一次のゲートであり、サーバー側ではパスを制限しません。';

  // Why not（パスをリポジトリ配下に制限する）: MCP クライアントが正当に指定する絶対パスを壊し、
  // ホスト側の権限機構を一次のゲートとする契約にも反するため。
  ctx.server.registerTool('read_model', {
    description: `モデル JSON を読み取ります。${pathDescription}`,
    inputSchema: { path: z.string() },
  }, async ({ path: modelPath }) => {
    try {
      return textResult(JSON.parse(await fs.promises.readFile(modelPath, 'utf8')));
    } catch (error) {
      return errorResult(`モデル JSON を読み取れません: ${modelPath}: ${error.message}`);
    }
  });

  ctx.server.registerTool('save_model', {
    description: `モデル JSON を原子的に保存します。${pathDescription}`,
    inputSchema: {
      path: z.string(),
      model: z.object({}).passthrough(),
      force: z.boolean().optional(),
    },
  }, async ({ path: modelPath, model, force }) => {
    try {
      await saveModel(modelPath, model, force);
      return textResult({ ok: true });
    } catch (error) {
      return errorResult(error);
    }
  });
}

module.exports = { register, saveModel };
