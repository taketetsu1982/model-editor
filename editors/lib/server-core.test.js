import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const { contentTypeFor, resolveStaticPath } = require('./server-core.js');

describe('contentTypeFor', () => {
  it('拡張子ごとに正しいMIMEを返す', () => {
    expect(contentTypeFor('/x/editor.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeFor('/x/lib/file-io.js')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeFor('/x/lib/editor-base.css')).toBe('text/css; charset=utf-8');
    expect(contentTypeFor('/x/product-model.json')).toBe('application/json; charset=utf-8');
  });
  it('未知の拡張子はoctet-stream', () => {
    expect(contentTypeFor('/x/foo.bin')).toBe('application/octet-stream');
    expect(contentTypeFor('/x/noext')).toBe('application/octet-stream');
  });
});

describe('resolveStaticPath', () => {
  const root = '/srv/editors';
  it("'/' は editor.html を指す", () => {
    expect(resolveStaticPath('/', root)).toBe(path.resolve(root, 'editor.html'));
  });
  it('lib配下のファイルを解決する', () => {
    expect(resolveStaticPath('/lib/file-io.js', root)).toBe(path.resolve(root, 'lib/file-io.js'));
  });
  it('rootの外へ出るパスはnullを返す（トラバーサル防止）', () => {
    expect(resolveStaticPath('/../secrets.txt', root)).toBe(null);
    expect(resolveStaticPath('/../../etc/passwd', root)).toBe(null);
  });
});
