// editors/lib/server-core.js — サーバの純粋ヘルパ（I/Oなし）
(function(exports) {
  var path = require('path');

  var TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };

  // contentTypeFor(filePath) — 拡張子からMIMEタイプを返す
  exports.contentTypeFor = function(filePath) {
    var i = filePath.lastIndexOf('.');
    var ext = i >= 0 ? filePath.slice(i) : '';
    return TYPES[ext] || 'application/octet-stream';
  };

  // resolveStaticPath(urlPath, rootDir) — URLパスをroot内の絶対パスへ解決
  //   '/' は editor.html を指す。rootの外へ出る場合は null（トラバーサル防止）
  exports.resolveStaticPath = function(urlPath, rootDir) {
    var rel = urlPath === '/' ? 'editor.html' : urlPath.replace(/^\/+/, '');
    var resolved = path.resolve(rootDir, rel);
    var normRoot = path.resolve(rootDir);
    if (resolved !== normRoot && !resolved.startsWith(normRoot + path.sep)) return null;
    return resolved;
  };

})(typeof module !== 'undefined' ? module.exports : (window.__serverCore = {}));
