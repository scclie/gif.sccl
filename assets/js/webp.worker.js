"use strict";
import Module from "./vendor/webp-wasm.js";

function encode(msg) {
  return Module().then(function (module) {
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
    return module.encodeAnimation(msg.width, msg.height, true, frameVector);
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