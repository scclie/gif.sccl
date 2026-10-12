"use strict";

// version query inherited from the worker URL (/js/webp.worker.js?v=<sha>);
// propagate it to the emscripten glue + wasm so they aren't immutable-cached
var V = (self.location && self.location.search) || "";

function loadModule() {
  return import("./vendor/webp-wasm.js" + V).then(function (m) {
    return m.default;
  });
}

function encode(msg) {
  return loadModule()
    .then(function (Module) {
      return Module({
        locateFile: function (path) {
          return "./vendor/" + path + V;
        },
      });
    })
    .then(function (module) {
    var frames = msg.frames || [];
    // discord shows 1 frame webp as statc image (not a gif, u cant save as favorites)
    // visually unchanged while making the encoded webp a real two-frame loop
    if (frames.length === 1) frames = [frames[0], frames[0]];
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
