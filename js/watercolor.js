(function (G) {
  const TAU = Math.PI * 2;
  const INK = "#1b1033";
  const PEN = "#24163d";

  const stack = [];
  let state = { active: false, rand: G.mulberry32(1), line: "pencil", U: 1 };

  function begin(seed, U) {
    stack.push(state);
    state = { active: true, rand: G.mulberry32((seed >>> 0) || 1), line: "pencil", U: U || 1 };
  }

  function end() {
    state = stack.pop() || { active: false, rand: G.mulberry32(1), line: "pencil", U: 1 };
  }

  function active() {
    return state.active;
  }

  function setLine(mode) {
    state.line = mode === "pen" ? "pen" : "pencil";
  }

  function withLine(mode, fn) {
    const prev = state.line;
    setLine(mode);
    try {
      fn();
    } finally {
      state.line = prev;
    }
  }

  function rand() {
    return state.rand();
  }

  // ---------- textures ----------

  function tileNoise(size, seed, scale, octaves) {
    const out = new Float32Array(size * size);
    const n = (x, y) => G.fbm(x * scale, y * scale, seed, octaves);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const a = n(x, y);
        const b = n(x - size, y);
        const c = n(x, y - size);
        const d = n(x - size, y - size);
        out[y * size + x] = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
      }
    }
    return out;
  }

  let mottleCanvas = null;
  function mottle() {
    if (mottleCanvas) return mottleCanvas;
    const size = 256;
    const field = tileNoise(size, 5151, 0.03, 3);
    const fine = tileNoise(size, 808, 0.16, 2);
    mottleCanvas = document.createElement("canvas");
    mottleCanvas.width = size;
    mottleCanvas.height = size;
    const ctx = mottleCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.max(0, Math.min(1, (field[i] - 0.32) * 1.9));
      const g = Math.max(0, fine[i] - 0.5) * 1.4;
      const tide = Math.exp(-Math.pow((field[i] - 0.56) / 0.011, 2)) + 0.6 * Math.exp(-Math.pow((field[i] - 0.44) / 0.009, 2));
      img.data[i * 4] = 90;
      img.data[i * 4 + 1] = 40;
      img.data[i * 4 + 2] = 110;
      img.data[i * 4 + 3] = Math.min(255, Math.round((v * 0.7 + g) * 120 + tide * 22));
    }
    ctx.putImageData(img, 0, 0);
    return mottleCanvas;
  }

  let liftCanvas = null;
  function lift() {
    if (liftCanvas) return liftCanvas;
    const size = 256;
    const field = tileNoise(size, 2727, 0.022, 3);
    liftCanvas = document.createElement("canvas");
    liftCanvas.width = size;
    liftCanvas.height = size;
    const ctx = liftCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.max(0, Math.min(1, (0.5 - field[i]) * 4));
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 252;
      img.data[i * 4 + 2] = 246;
      img.data[i * 4 + 3] = Math.round(v * 150);
    }
    ctx.putImageData(img, 0, 0);
    return liftCanvas;
  }

  let graphiteCanvas = null;
  function graphite() {
    if (graphiteCanvas) return graphiteCanvas;
    const size = 64;
    const r = G.mulberry32(4242);
    graphiteCanvas = document.createElement("canvas");
    graphiteCanvas.width = size;
    graphiteCanvas.height = size;
    const ctx = graphiteCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = r();
      img.data[i * 4] = 58;
      img.data[i * 4 + 1] = 52;
      img.data[i * 4 + 2] = 74;
      img.data[i * 4 + 3] = v < 0.18 ? 40 : Math.round(150 + v * 105);
    }
    ctx.putImageData(img, 0, 0);
    return graphiteCanvas;
  }

  let paperCanvas = null;
  function paper() {
    if (paperCanvas) return paperCanvas;
    const size = 256;
    const tooth = tileNoise(size, 3131, 0.11, 2);
    const cloud = tileNoise(size, 9191, 0.018, 3);
    const r = G.mulberry32(707);
    paperCanvas = document.createElement("canvas");
    paperCanvas.width = size;
    paperCanvas.height = size;
    const ctx = paperCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 255 - Math.max(0, tooth[i] - 0.45) * 70 - (cloud[i] - 0.5) * 22 - r() * 10;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v - 4;
      img.data[i * 4 + 2] = v - 12;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return paperCanvas;
  }

  const patterns = new WeakMap();
  function patternFor(ctx, kind) {
    let set = patterns.get(ctx);
    if (!set) {
      set = {};
      patterns.set(ctx, set);
    }
    if (!set[kind]) {
      const source = kind === "mottle" ? mottle() : kind === "lift" ? lift() : kind === "graphite" ? graphite() : paper();
      set[kind] = ctx.createPattern(source, "repeat");
    }
    return set[kind];
  }

  // ---------- strokes ----------

  function line(ctx, build, width, color) {
    const U = state.U;
    const A = ctx.globalAlpha;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (state.line === "pen") {
      ctx.strokeStyle = color || PEN;
      ctx.lineWidth = Math.max(0.7, width * 0.78);
      ctx.beginPath();
      build();
      ctx.stroke();
      const a = rand() * TAU;
      ctx.translate(Math.cos(a) * 0.7 * U, Math.sin(a) * 0.7 * U);
      ctx.globalAlpha = A * 0.32;
      ctx.lineWidth = Math.max(0.5, width * 0.42);
      ctx.beginPath();
      build();
      ctx.stroke();
    } else {
      const grain = patternFor(ctx, "graphite");
      ctx.strokeStyle = grain;
      for (let pass = 0; pass < 2; pass++) {
        const a = rand() * TAU;
        const d = (0.35 + rand() * 0.6) * U;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.globalAlpha = A * (pass === 0 ? 0.95 : 0.55);
        ctx.lineWidth = Math.max(0.7, width * (pass === 0 ? 0.62 : 0.4));
        ctx.beginPath();
        build();
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function wash(ctx, build, fill, opts) {
    const o = opts || {};
    const U = state.U;
    const a = rand() * TAU;
    const off = (0.8 + rand() * 1.4) * U * (o.bleed === undefined ? 1 : o.bleed);
    ctx.save();
    ctx.fillStyle = fill;
    if (!o.soft) {
      ctx.save();
      ctx.translate(Math.cos(a) * off, Math.sin(a) * off);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      build();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = o.alpha || 0.9;
    ctx.beginPath();
    build();
    ctx.fill();
    ctx.clip();
    ctx.globalAlpha = 1;
    if (!o.flat) {
      const m = patternFor(ctx, "mottle");
      if (m.setTransform) {
        const k = 1 + rand() * 1.5;
        m.setTransform(new DOMMatrix([k, 0, 0, k, rand() * 256, rand() * 256]));
      }
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = m;
      ctx.globalAlpha = o.mottle === undefined ? 0.62 : o.mottle;
      ctx.beginPath();
      build();
      ctx.fill();
      const l = patternFor(ctx, "lift");
      if (l.setTransform) {
        const k = 0.8 + rand() * 1.6;
        l.setTransform(new DOMMatrix([k, 0, 0, k, rand() * 256, rand() * 256]));
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = l;
      ctx.globalAlpha = 0.24;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (o.soft) {
      ctx.restore();
      return;
    }
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "rgba(80, 30, 100, 0.2)";
    ctx.lineWidth = 3.4 * U;
    ctx.beginPath();
    build();
    ctx.stroke();
    ctx.strokeStyle = "rgba(80, 30, 100, 0.16)";
    ctx.lineWidth = 1.3 * U;
    ctx.stroke();
    ctx.restore();
  }

  function texture(ctx, x, y, w, h, alpha, scale) {
    const m = patternFor(ctx, "mottle");
    if (m.setTransform) {
      const k = scale || 1 + rand() * 1.5;
      m.setTransform(new DOMMatrix([k, 0, 0, k, rand() * 256, rand() * 256]));
    }
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = alpha === undefined ? 0.55 : alpha;
    ctx.fillStyle = m;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function glaze(ctx, build, color, width, alpha) {
    ctx.save();
    ctx.beginPath();
    build();
    ctx.clip();
    ctx.globalAlpha = alpha || 0.32;
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 6;
    ctx.beginPath();
    build();
    ctx.stroke();
    ctx.restore();
  }

  function paint(ctx, build, fill, o) {
    wash(ctx, build, fill, o);
    if (o && o.glaze) glaze(ctx, build, o.glaze, o.edge, o.glazeAlpha);
    if (o && o.ink) line(ctx, build, o.ink);
  }

  function bloom(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.35 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * TAU;
      const rr = r * (0.75 + rand() * 0.4);
      if (i === 0) ctx.moveTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
      else ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = (alpha === undefined ? 0.35 : alpha) * 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, r * 0.08);
    ctx.stroke();
    ctx.restore();
  }

  function finish(ctx, W, H, rng, U, accents) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = patternFor(ctx, "paper");
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, W, H);
    const m = patternFor(ctx, "mottle");
    if (m.setTransform) m.setTransform(new DOMMatrix([3, 0, 0, 3, rng() * 512, rng() * 512]));
    ctx.fillStyle = m;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const drops = 6 + Math.floor(rng() * 8);
    for (let i = 0; i < drops; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const r = (1 + Math.pow(rng(), 3) * 7) * U;
      const c = accents[Math.floor(rng() * accents.length)];
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.35 + rng() * 0.3;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha *= 0.8;
      ctx.strokeStyle = c;
      ctx.lineWidth = Math.max(0.5, r * 0.25);
      ctx.stroke();
      for (let k = 0; k < 3 && r > 3 * U; k++) {
        const a = rng() * TAU;
        const d = r * (1.4 + rng() * 1.6);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.15 + rng() * 0.2), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  G.wc = { begin, end, active, setLine, withLine, rand, line, wash, texture, glaze, paint, bloom, finish, paper, patternFor, INK, PEN };
})(window.ProbeDrop = window.ProbeDrop || {});
