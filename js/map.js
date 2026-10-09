(function (G) {
  function layout(width, height) {
    const pad = Math.round(Math.min(width, height) * 0.07);
    const size = Math.min(width, height) - pad * 2;
    return {
      pad,
      size,
      left: (width - size) / 2,
      top: (height - size) / 2,
    };
  }

  function mapToCanvas(point, width, height) {
    const box = layout(width, height);
    return {
      x: box.left + (point.x / 1000) * box.size,
      y: box.top + (point.y / 1000) * box.size,
    };
  }

  function canvasToMap(px, py, width, height) {
    const box = layout(width, height);
    return {
      x: clamp(((px - box.left) / box.size) * 1000, 0, 1000),
      y: clamp(((py - box.top) / box.size) * 1000, 0, 1000),
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function traceRegion(ctx, polygon, width, height) {
    ctx.beginPath();
    polygon.forEach((point, index) => {
      const projected = mapToCanvas(point, width, height);
      if (index === 0) ctx.moveTo(projected.x, projected.y);
      else ctx.lineTo(projected.x, projected.y);
    });
    ctx.closePath();
  }

  function insetPolygon(polygon, amount) {
    let cx = 0;
    let cy = 0;
    polygon.forEach((point) => {
      cx += point.x;
      cy += point.y;
    });
    cx /= polygon.length;
    cy /= polygon.length;
    return polygon.map((point) => ({
      x: point.x + (cx - point.x) * amount,
      y: point.y + (cy - point.y) * amount,
    }));
  }

  function hslToRgb(color) {
    const h = ((((color.h % 360) + 360) % 360) / 360);
    const s = clamp(color.s, 0, 100) / 100;
    const l = clamp(color.l, 0, 100) / 100;
    const hue = (t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    let q;
    let p;
    if (s === 0) {
      const gray = Math.round(l * 255);
      return [gray, gray, gray];
    }
    q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    p = 2 * l - q;
    return [
      Math.round(hue(h + 1 / 3) * 255),
      Math.round(hue(h) * 255),
      Math.round(hue(h - 1 / 3) * 255),
    ];
  }

  function mixRgb(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  function nearestRegion(regions, x, y) {
    let best = regions[0];
    let bestDist = Infinity;
    regions.forEach((region) => {
      const dx = region.site.x - x;
      const dy = region.site.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = region;
      }
    });
    return best;
  }

  function geographyImage(planet) {
    if (planet.mapRaster) return planet.mapRaster;
    const size = 420;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const raster = canvas.getContext("2d");
    const image = raster.createImageData(size, size);
    const data = image.data;
    const water = [28, 98, 158];
    const land = [132, 168, 86];
    const shore = [214, 196, 154];
    const mountain = [118, 96, 70];
    const peak = [176, 164, 146];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sample = G.landSample(planet.geo, x / (size - 1), y / (size - 1));
        let color = water;
        if (sample.lake || !sample.land) color = water;
        else if (sample.coast) color = shore;
        else if (sample.mountain) color = sample.height > 0.64 ? peak : mountain;
        else color = land;
        const index = (y * size + x) * 4;
        data[index] = color[0];
        data[index + 1] = color[1];
        data[index + 2] = color[2];
        data[index + 3] = 255;
      }
    }
    raster.putImageData(image, 0, 0);
    planet.mapRaster = canvas;
    return canvas;
  }

  function drawRoads(ctx, width, height, planet, box) {
    const roads = planet.roads || [];
    if (!roads.length) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    roads.forEach((road) => {
      ctx.beginPath();
      road.forEach((point, index) => {
        const projected = mapToCanvas(point, width, height);
        if (index === 0) ctx.moveTo(projected.x, projected.y);
        else ctx.lineTo(projected.x, projected.y);
      });
      ctx.strokeStyle = "rgba(62, 46, 28, 0.9)";
      ctx.lineWidth = Math.max(2.2, box.size * 0.011);
      ctx.stroke();
      ctx.strokeStyle = "#f3ead8";
      ctx.lineWidth = Math.max(1.1, box.size * 0.0045);
      ctx.stroke();
    });
  }

  function drawMap(ctx, width, height, planet, options) {
    const box = layout(width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#07060f";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.left, box.top, box.size, box.size);
    ctx.clip();
    ctx.drawImage(geographyImage(planet), box.left, box.top, box.size, box.size);
    drawRoads(ctx, width, height, planet, box);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.left, box.top, box.size, box.size);

    if (options && options.truth && options.pin) {
      const from = mapToCanvas(options.pin, width, height);
      const to = mapToCanvas(options.truth, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (options && options.truth) {
      const truth = mapToCanvas(options.truth, width, height);
      ctx.fillStyle = "#3d7dff";
      ctx.beginPath();
      ctx.arc(truth.x, truth.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f4f8ff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (options && options.pin) {
      drawPin(ctx, mapToCanvas(options.pin, width, height));
    }
  }

  function drawPin(ctx, point) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(2, 4, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff4f9a";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-18, -16, -14, -40, 0, -40);
    ctx.bezierCurveTo(14, -40, 18, -16, 0, 0);
    ctx.fill();
    ctx.fillStyle = "#fff7fb";
    ctx.beginPath();
    ctx.arc(0, -25, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function eventToMap(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return canvasToMap(px, py, canvas.width, canvas.height);
  }

  G.drawMap = drawMap;
  G.eventToMap = eventToMap;
})(window.AlienGuessr = window.AlienGuessr || {});
