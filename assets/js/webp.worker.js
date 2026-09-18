"use strict";

// version query inherited from the worker URL (/js/webp.worker.js?v=<sha>);
// propagate it to the emscripten glue + wasm so they aren't immutable-cached
var V = (self.location && self.location.search) || "";

function loadModule() {
  return import("./vendor/webp-wasm.js" + V).then(function (m) {
    return m.default;
  });
}

function patchAnimationFlag(buf) {
  var u = new Uint8Array(buf);
  var pos = 12;
  while (pos + 8 <= u.length) {
    var tag = String.fromCharCode(u[pos], u[pos + 1], u[pos + 2], u[pos + 3]);
    var sz = u[pos + 4] | (u[pos + 5] << 8) | (u[pos + 6] << 16) | (u[pos + 7] << 24);
    if (tag === "VP8X") {
      u[pos + 8] |= 0x20;
      break;
    }
    pos += 8 + sz + (sz & 1);
  }
}

function encode(msg) {
  return loadModule()
    .then(function (Module) {
      return Module({
        locateFile: function (path) {
          return path + V;
        },
      });
    })
    .then(function (module) {
    var frames = msg.frames || [];
    var frameVector = new module.VectorWebPAnimationFrame();
    var q = typeof msg.quality === "number" ? msg.quality : 80;
    frames.forEach(function (f) {
      frameVector.push_back({
        duration: f.duration,
        data: new Uint8Array(f.data),
        config: { lossless: 0, quality: q },
        has_config: true,
      });
    });
    var buf = module.encodeAnimation(msg.width, msg.height, true, frameVector);
    if (buf && buf.length) patchAnimationFlag(buf);
    return buf;
  });
}

self.onmessage = function (e) {
  encode(e.data)
    .then(function (buf) {
      if (!buf || !buf.length) {
        self.postMessage({ error: "webp encode failed" });
        return;
      }
      var blob = new Blob([buf], { type: "image/webp" });
      self.postMessage({ blob: blob });
    })
    .catch(function (err) {
      self.postMessage({
        error: (err && err.message) ? err.message : String(err),
      });
    });
};