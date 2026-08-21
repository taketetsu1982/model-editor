#!/usr/bin/env node
// bin/model-editor.js — model-editor の CLI 入口。サブコマンドを解釈して実体へ委ねる
//   使い方: model-editor serve <modelPath> [port]
//           model-editor mcp                     （Phase 2 で実装）
const path = require('path');
const { spawn } = require('child_process');

const SERVER = path.join(__dirname, '..', 'editors', 'server.js');
const USAGE = 'usage: model-editor <serve|mcp> [args]\n' +
  '  serve <modelPath> [port]  エディタを localhost で配信する\n' +
  '  mcp                       MCP サーバーを stdio で起動する';

const [subcommand, ...rest] = process.argv.slice(2);

// Why not（server.js を require して argv を差し替える）: server.js の契約は「引数 <modelPath> [port]
// と stdout の URL 1 行」であり、process.argv を書き換えて読ませる形は契約ではなく実装詳細に依存する。
// 子プロセスなら server.js を一切変更せずに同じ契約のまま再利用でき、Phase 2 の editor-process.js も
// 同じ起動経路を使える。
function serve(args) {
  const child = spawn(process.execPath, [SERVER, ...args], { stdio: 'inherit' });
  // 親が先に死ぬと子が孤児として localhost を掴んだままになる。シグナルを素通しして道連れにする。
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => child.kill(sig));
  }
  child.on('exit', (code, signal) => {
    if (signal) { process.kill(process.pid, signal); return; }
    process.exit(code);
  });
}

function fail(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(1);
}

switch (subcommand) {
  case 'serve':
    serve(rest);
    break;
  case 'mcp':
    // 未知のサブコマンドと区別する。無言で成功すると、MCP クライアントは設定が効いたと誤解する。
    fail('error: mcp サブコマンドは Phase 2 で実装予定です。現時点では利用できません');
    break;
  case undefined:
    fail('error: サブコマンドを指定してください');
    break;
  default:
    fail('error: 未知のサブコマンド: ' + subcommand);
}
