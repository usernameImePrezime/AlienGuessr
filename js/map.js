(function (G) {
  const INK = "#1b1033";
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const view = { zoom: 1, cx: 500, cy: 500, anim: null, reveal: 1 };
  let host = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function layout(width, height) {
    const size = Math.min(width, height);
    return { size, left: (width - size) / 2, top: (height - size) / 2 };
  }

  function span() {
    return 1000 / view.zoom;
  }

  function clampView() {
    view.zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
    const half = span() / 2;
    view.cx = clamp(view.cx, half, 1000 - half);
    view.cy = clamp(view.cy, half, 1000 - half);
  }

  function mapToCanvas(point, box) {
    const s = span();
    return {
      x: box.left + ((point.x - (view.cx - s / 2)) / s) * box.size,
      y: box.top + ((point.y - (view.cy - s / 2)) / s) * box.size,
    };
  }

  function canvasToMap(px, py, box) {
    const s = span();
    return {
      x: clamp(view.cx - s / 2 + ((px - box.left) / box.size) * s, 0, 1000),
      y: clamp(view.cy - s / 2 + ((py - box.top) / box.size) * s, 0, 1000),
    };
  }

  // ---------- labels ----------

  function ribbon(ctx, text, x, y, size, rects) {
    ctx.font = `${size}px "Luckiest Guy", Fredoka, sans-serif`;
    const w = ctx.measureText(text).width + size * 1.1;
    const h = size * 1.45;
    const rect = { l: x - w / 2 - size * 0.6, r: x + w / 2 + size * 0.6, t: y - h / 2, b: y + h / 2 };
    if (rects.some((o) => rect.l < o.r && rect.r > o.l && rect.t < o.b && rect.b > o.t)) return;
    rects.push(rect);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, size * 0.14);
    [-1, 1].forEach((side) => {
      const ex = x + side * (w / 2);
      ctx.beginPath();
      ctx.moveTo(ex, y - h * 0.32);
      ctx.lineTo(ex + side * size * 0.6, y - h * 0.4);
      ctx.lineTo(ex + side * size * 0.32, y + h * 0.12);
      ctx.lineTo(ex + side * size * 0.6, y + h * 0.6);
      ctx.lineTo(ex, y + h * 0.5);
      ctx.closePath();
      ctx.fillStyle = "#c2155f";
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, size * 0.3);
    ctx.fillStyle = "#ff4f9a";
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x, y + size * 0.08);
    ctx.restore();
  }

  function haloText(ctx, text, x, y, size, rects) {
    ctx.font = `600 ${size}px Fredoka, "Segoe UI", sans-serif`;
    const w = ctx.measureText(text).width;
    const rect = { l: x - w / 2 - 3, r: x + w / 2 + 3, t: y - size * 0.6, b: y + size * 0.6 };
    if (rects.some((o) => rect.l < o.r && rect.r > o.l && rect.t < o.b && rect.b > o.t)) return;
    rects.push(rect);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.36;
    ctx.strokeStyle = "rgba(255, 250, 236, 0.95)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = INK;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawLabels(ctx, planet, box, unit, width, height) {
    const rects = [];
    const atlasScale = box.size / (span() * 2.048);
    const ordered = planet.towns.slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "city" ? -1 : 1));
    ordered.forEach((town) => {
      const city = town.kind === "city";
      if (!city && view.zoom < 1.8) return;
      const p = mapToCanvas(town, box);
      if (p.x < -60 || p.y < -60 || p.x > width + 60 || p.y > height + 60) return;
      const below = p.y + (city ? 24 : 16) * atlasScale + (city ? 11 : 8) * unit;
      const grow = Math.min(view.zoom, 3);
      if (city) ribbon(ctx, town.name, p.x, below, (8.8 + grow * 1.2) * unit, rects);
      else haloText(ctx, town.name, p.x, below, (8.5 + grow * 1) * unit, rects);
    });
  }

  // ---------- pins ----------

  function drawProbe(ctx, point, unit) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(unit, unit);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.fillStyle = "rgba(27, 16, 51, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, -24);
    ctx.bezierCurveTo(-16, -46, 16, -46, 14, -24);
    ctx.quadraticCurveTo(0, -14, -14, -24);
    ctx.fillStyle = "#ff4f9a";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -40);
    ctx.quadraticCurveTo(-10, -52, -4, -56);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-4, -57, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#5ff2ff";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -30, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1.5, -29, 3, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.restore();
  }

  function drawTruth(ctx, point, unit) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(unit, unit);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(61, 125, 255, 0.28)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#3d7dff";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 1.6 : 4;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  }

  function drawFrame(ctx, width, height, unit) {
    ctx.save();
    const inset = 5 * unit;
    ctx.strokeStyle = "rgba(255, 248, 230, 0.85)";
    ctx.lineWidth = 2.2 * unit;
    ctx.setLineDash([10 * unit, 7 * unit]);
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    ctx.setLineDash([]);
    ctx.font = `600 ${10 * unit}px Fredoka, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3 * unit;
    ctx.strokeStyle = "rgba(27, 16, 51, 0.7)";
    const label = `${view.zoom.toFixed(1)}x`;
    ctx.strokeText(label, width - 12 * unit, height - 10 * unit);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, width - 12 * unit, height - 10 * unit);
    ctx.restore();
  }

  function drawMap(ctx, width, height, planet, options) {
    const box = layout(width, height);
    const atlas = G.buildAtlas(planet);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = G.ATLAS_SEA;
    ctx.fillRect(0, 0, width, height);
    const k = atlas.size / 1000;
    const s = span();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(atlas.canvas, (view.cx - s / 2) * k, (view.cy - s / 2) * k, s * k, s * k, box.left, box.top, box.size, box.size);
    const unit = clamp(box.size / 460, 0.7, 2.4);
    drawLabels(ctx, planet, box, unit, width, height);

    if (options.truth && options.pin) {
      const from = mapToCanvas(options.pin, box);
      const to = mapToCanvas(options.truth, box);
      const t = clamp(view.reveal, 0, 1);
      const end = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      ctx.lineCap = "round";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5 * unit;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.strokeStyle = "#ffe56b";
      ctx.lineWidth = 2.5 * unit;
      ctx.setLineDash([7 * unit, 6 * unit]);
      ctx.lineDashOffset = -t * 60 * unit;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      if (t >= 1) drawTruth(ctx, to, unit);
    } else if (options.truth) {
      drawTruth(ctx, mapToCanvas(options.truth, box), unit);
    }
    if (options.pin) drawProbe(ctx, mapToCanvas(options.pin, box), unit);
    drawFrame(ctx, width, height, unit);
  }

  // ---------- interaction ----------

  function canvasPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      scale: canvas.width / rect.width,
    };
  }

  function eventToMap(event, canvas) {
    const p = canvasPoint(event, canvas);
    return canvasToMap(p.x, p.y, layout(canvas.width, canvas.height));
  }

  let frameQueued = false;
  function redraw() {
    if (!host || frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => {
      frameQueued = false;
      host.redraw();
    });
  }

  function zoomAt(px, py, factor) {
    if (!host) return;
    stopAnim();
    const box = layout(host.canvas.width, host.canvas.height);
    const anchor = canvasToMap(px, py, box);
    view.zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const s = span();
    view.cx = anchor.x - ((px - box.left) / box.size - 0.5) * s;
    view.cy = anchor.y - ((py - box.top) / box.size - 0.5) * s;
    clampView();
    redraw();
  }

  function stopAnim() {
    if (view.anim) cancelAnimationFrame(view.anim.raf);
    view.anim = null;
    view.reveal = 1;
  }

  function animateTo(target, ms, withReveal) {
    stopAnim();
    const from = { zoom: view.zoom, cx: view.cx, cy: view.cy };
    const start = performance.now();
    const anim = { raf: 0 };
    view.anim = anim;
    if (withReveal) view.reveal = 0;
    const step = (now) => {
      const t = clamp((now - start) / ms, 0, 1);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      view.zoom = Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * e);
      view.cx = from.cx + (target.cx - from.cx) * e;
      view.cy = from.cy + (target.cy - from.cy) * e;
      clampView();
      if (withReveal) view.reveal = e;
      if (host) host.redraw();
      if (t < 1 && view.anim === anim) anim.raf = requestAnimationFrame(step);
      else if (view.anim === anim) view.anim = null;
    };
    anim.raf = requestAnimationFrame(step);
  }

  function fit(points) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const extent = Math.max(maxX - minX, maxY - minY) * 1.5 + 110;
    animateTo({
      zoom: clamp(1000 / extent, MIN_ZOOM, 3.2),
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    }, 900, true);
  }

  function reset(animated) {
    if (animated) {
      animateTo({ zoom: 1, cx: 500, cy: 500 }, 420, false);
      return;
    }
    stopAnim();
    view.zoom = 1;
    view.cx = 500;
    view.cy = 500;
  }

  function zoomBy(factor) {
    if (!host) return;
    const target = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const next = { zoom: target, cx: view.cx, cy: view.cy };
    animateTo(next, 260, false);
  }

  function attach(canvas, handlers) {
    host = { canvas, redraw: handlers.redraw };
    let down = null;
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const p = canvasPoint(event, canvas);
      const delta = event.deltaMode === 1 ? event.deltaY * 30 : event.deltaY;
      zoomAt(p.x, p.y, Math.exp(-clamp(delta, -240, 240) * 0.0022));
    }, { passive: false });
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      down = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // synthetic or already-released pointers cannot be captured
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!down || down.id !== event.pointerId) return;
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (!down.dragging && Math.hypot(dx, dy) > 5) {
        down.dragging = true;
        canvas.classList.add("is-dragging");
      }
      if (!down.dragging) return;
      stopAnim();
      const rect = canvas.getBoundingClientRect();
      const box = layout(canvas.width, canvas.height);
      const perPx = (span() / box.size) * (canvas.width / rect.width);
      view.cx -= dx * perPx;
      view.cy -= dy * perPx;
      down.x = event.clientX;
      down.y = event.clientY;
      clampView();
      redraw();
    });
    const finish = (event) => {
      if (!down || down.id !== event.pointerId) return;
      const wasDrag = down.dragging;
      down = null;
      canvas.classList.remove("is-dragging");
      if (!wasDrag && event.type === "pointerup") handlers.onPin(eventToMap(event, canvas));
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
  }

  G.drawMap = drawMap;
  G.eventToMap = eventToMap;
  G.mapView = { attach, fit, reset, zoomBy, state: view };
})(window.AlienGuessr = window.AlienGuessr || {});
