const path = require('path');
const { spawn: defaultSpawn } = require('child_process');

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const URL_PATTERN = /(http:\/\/localhost:\d+\/)/;

function createEditorProcess({
  spawn = defaultSpawn,
  now = Date.now,
  setTimeout: schedule = setTimeout,
  clearTimeout: cancel = clearTimeout,
} = {}) {
  let child;
  let activePath;
  let activeUrl;
  let idleTimer;

  function clearIdleTimer() {
    if (idleTimer !== undefined) {
      cancel(idleTimer);
      idleTimer = undefined;
    }
  }

  function clearState(process) {
    if (process && child !== process) return;
    clearIdleTimer();
    child = undefined;
    activePath = undefined;
    activeUrl = undefined;
  }

  function scheduleIdleStop(lastActivity) {
    clearIdleTimer();
    idleTimer = schedule(async () => {
      const remaining = IDLE_TIMEOUT_MS - (now() - lastActivity);
      if (remaining > 0) {
        clearIdleTimer();
        idleTimer = schedule(async () => {
          await stop();
        }, remaining);
        return;
      }
      await stop();
    }, IDLE_TIMEOUT_MS);
  }

  function resetActivity() {
    if (!child) return;
    scheduleIdleStop(now());
  }

  function stop() {
    if (!child) return Promise.resolve();

    const process = child;
    clearState(process);
    return new Promise((resolve) => {
      process.once('close', () => resolve());
      process.once('error', () => resolve());
      try {
        process.kill('SIGTERM');
      } catch (_) {
        resolve();
      }
    });
  }

  async function start(modelPath) {
    const resolvedPath = path.resolve(modelPath);
    if (child && activePath === resolvedPath && activeUrl) return activeUrl;
    if (child) await stop();

    let childProcess;
    try {
      childProcess = spawn(process.execPath, [path.join(__dirname, '..', '..', 'editors', 'server.js'), resolvedPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      throw new Error(`エディタサーバーを起動できません: ${error.message}`);
    }
    child = childProcess;
    activePath = resolvedPath;

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;

      function fail(reason) {
        if (settled) return;
        settled = true;
        clearState(childProcess);
        reject(new Error(`エディタサーバーを起動できません: ${reason}`));
      }

      function succeed(url) {
        if (settled) return;
        settled = true;
        activeUrl = url;
        resetActivity();
        resolve(url);
      }

      childProcess.stdout.on('data', (chunk) => {
        stdout += String(chunk);
        const match = URL_PATTERN.exec(stdout);
        if (match) succeed(match[1]);
      });
      childProcess.stderr.on('data', (chunk) => { stderr += String(chunk); });
      childProcess.once('error', (error) => fail(error.message));
      childProcess.once('close', (code, signal) => {
        const wasStarting = !settled;
        clearState(childProcess);
        if (wasStarting) {
          // Why not（終了コードだけを返す）: bind 失敗などの診断は既存サーバーが stderr に出すため、
          // それを捨てると呼び出し側がローカル実行不可を説明できない。
          fail(stderr.trim() || `終了しました (code=${code}, signal=${signal})`);
        }
      });
    });
  }

  return {
    start,
    stop,
    resetActivity,
    shutdown: stop,
    get url() { return activeUrl; },
    get running() { return Boolean(child); },
  };
}

module.exports = { createEditorProcess, IDLE_TIMEOUT_MS };
