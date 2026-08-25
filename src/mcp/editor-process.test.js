import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { EventEmitter } from 'events';
import { spawn as realSpawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { createEditorProcess, IDLE_TIMEOUT_MS } = require('./editor-process.js');

function createModelPath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'model-editor-process-'));
  const modelPath = path.join(directory, 'model.json');
  fs.writeFileSync(modelPath, '{}');
  return { directory, modelPath };
}

function createFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => queueMicrotask(() => child.emit('close', 0, 'SIGTERM'));
  return child;
}

describe('editor process lifecycle', () => {
  let manager;
  let fixture;

  afterEach(async () => {
    if (manager) await manager.stop();
    if (fixture) fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  it('起動した URL でモデルを配信し、同じ path では再利用する', async () => {
    fixture = createModelPath();
    manager = createEditorProcess();

    const url = await manager.start(fixture.modelPath);
    expect(url).toMatch(/^http:\/\/localhost:\d+\/$/);
    await expect(fetch(`${url}model`)).resolves.toMatchObject({ status: 200 });
    await expect(manager.start(fixture.modelPath)).resolves.toBe(url);
  });

  it('別 path では旧プロセスを停止して起動し直す', async () => {
    fixture = createModelPath();
    const other = path.join(fixture.directory, 'other.json');
    fs.writeFileSync(other, '{}');
    const children = [];
    manager = createEditorProcess({ spawn(...args) { const child = realSpawn(...args); children.push(child); return child; } });

    const first = await manager.start(fixture.modelPath);
    const second = await manager.start(other);
    expect(children).toHaveLength(2);
    expect(children[0].killed).toBe(true);
    await expect(fetch(`${second}model`).then((response) => response.json())).resolves.toEqual({});
    expect(first).toMatch(/^http:\/\/localhost:/);
  });

  it('停止は未起動・起動中とも冪等', async () => {
    fixture = createModelPath();
    manager = createEditorProcess();
    await expect(manager.stop()).resolves.toBeUndefined();
    await manager.start(fixture.modelPath);
    await expect(manager.stop()).resolves.toBeUndefined();
    await expect(manager.stop()).resolves.toBeUndefined();
  });

  it('アイドル timeout は reset がある間は停止しない', async () => {
    let time = 0;
    let nextTimer = 0;
    const timers = new Map();
    const children = [];
    manager = createEditorProcess({
      now: () => time,
      setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: time + delay }); return id; },
      clearTimeout(id) { timers.delete(id); },
      spawn() { const child = createFakeChild(); children.push(child); return child; },
    });
    const startup = manager.start('/tmp/model.json');
    children[0].stdout.emit('data', 'http://localhost:8765/\n');
    await startup;

    time = IDLE_TIMEOUT_MS - 60_000;
    expect(manager.running).toBe(true);
    manager.resetActivity();
    time += IDLE_TIMEOUT_MS - 60_000;
    for (const timer of [...timers.values()]) if (timer.at <= time) await timer.callback();
    expect(manager.running).toBe(true);

    time += 60_000;
    for (const timer of [...timers.values()]) if (timer.at <= time) await timer.callback();
    await new Promise(queueMicrotask);
    expect(manager.running).toBe(false);
  });

  it('起動前に異常終了した子の原因を返し、次回は再起動できる', async () => {
    const children = [];
    manager = createEditorProcess({ spawn() { const child = createFakeChild(); children.push(child); return child; } });
    const failed = manager.start('/tmp/model.json');
    children[0].stderr.emit('data', 'error: bind denied');
    children[0].emit('close', 1, null);
    await expect(failed).rejects.toThrow('bind denied');

    const restarted = manager.start('/tmp/model.json');
    children[1].stdout.emit('data', 'http://localhost:8766/\n');
    await expect(restarted).resolves.toBe('http://localhost:8766/');
  });

  it('外部終了後は停止状態へ戻り、再起動できる', async () => {
    fixture = createModelPath();
    let child;
    manager = createEditorProcess({ spawn(...args) { child = realSpawn(...args); return child; } });
    await manager.start(fixture.modelPath);
    // Why not（pgrep で全サーバーを検索する）: 他セッションのエディタまで判定対象になり得るため、
    // このテストでは自身が spawn した PID だけを終了させる。
    child.kill('SIGKILL');
    await new Promise((resolve) => child.once('close', resolve));
    expect(manager.running).toBe(false);
    await expect(manager.start(fixture.modelPath)).resolves.toMatch(/^http:\/\/localhost:/);
  });
});
