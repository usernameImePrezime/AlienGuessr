(function (G) {
  const ALIEN = { blue: "#3d7dff", pink: "#ff4f9a" };
  const HEIGHT = { short: 0.78, medium: 1, tall: 1.22 };
  const DIFFICULTY_SCALE = { easy: 1.05, medium: 0.94, hard: 0.78 };

  function css(color) {
    return G.cssColor(color);
  }

  function shade(color, lightDelta, satDelta) {
    return {
      h: color.h,
      s: color.s + (satDelta || 0),
      l: color.l + lightDelta,
    };
  }

  function hsla(color, alpha) {
    const h = ((color.h % 360) + 360) % 360;
    const s = Math.max(0, Math.min(100, color.s));
    const l = Math.max(0, Math.min(100, color.l));
    return `hsla(${h} ${s}% ${l}% / ${alpha})`;
  }

  function stableRand(profile, salt) {
    const key = [
      profile.terrain,
      profile.skyEvent,
      profile.starPattern,
      profile.groundPattern,
      profile.weather,
      profile.fence,
      Math.round(profile.skyGradient[0].h),
      Math.round(profile.skyGradient[1].h),
      Math.round(profile.groundColor.h),
      salt,
    ].join("|");
    return G.mulberry32(G.hashSeed(key));
  }

  function shownFeatures(profile, rng) {
    const keys = ["skyEvent", "stars", "building", "vegetation", "aliens", "fence", "banner", "sign", "pole", "groundPattern", "weather"];
    const shown = {};
    keys.forEach((key) => {
      shown[key] = rng() < 0.34;
    });
    if (profile.fence === "none") shown.fence = false;
    if (profile.banner === "none") shown.banner = false;
    if (profile.weather === "clear") shown.weather = false;
    let count = keys.filter((key) => shown[key]).length;
    ["sign", "aliens", "building", "vegetation", "skyEvent"].forEach((key) => {
      if (count >= 2 || shown[key]) return;
      shown[key] = true;
      count += 1;
    });
    return shown;
  }

  function drawScene(ctx, width, height, profile, rng, difficulty) {
    const unit = height / 720;
    const horizon = height * 0.58;
    const shown = shownFeatures(profile, rng);
    drawSky(ctx, width, height, horizon, profile);
    if (shown.stars) drawStars(ctx, width, horizon, profile, unit);
    if (shown.skyEvent) drawSkyEvent(ctx, width, horizon, profile, unit);
    drawTerrain(ctx, width, horizon, profile, unit, 0.62, -28);
    drawTerrain(ctx, width, horizon, profile, unit, 1.05, -8);
    drawHaze(ctx, width, horizon, profile, unit, 0.22);
    drawGround(ctx, width, height, horizon, profile);
    if (shown.groundPattern) drawGroundPattern(ctx, width, height, horizon, profile, unit);
    drawPath(ctx, width, height, horizon, profile, unit);
    const layer = [];
    const queue = (y, draw) => layer.push({ y, draw });
    if (shown.building) drawBuildings(ctx, width, height, horizon, profile, rng, unit, queue);
    if (shown.vegetation) drawVegetation(ctx, width, height, horizon, profile, rng, unit, queue);
    if (shown.banner) drawBanners(ctx, width, height, horizon, profile, rng, unit, queue);
    if (shown.fence) drawFence(ctx, width, height, horizon, profile, rng, unit, queue);
    if (shown.pole || shown.sign) drawPoleAndSign(ctx, width, height, horizon, profile, rng, unit, shown, queue);
    if (shown.aliens) drawAliens(ctx, width, height, horizon, profile, rng, unit, difficulty, queue);
    layer.sort((a, b) => a.y - b.y);
    layer.forEach((item) => item.draw());
    drawPebbles(ctx, width, height, horizon, profile, rng, unit);
    if (shown.weather) drawWeather(ctx, width, height, horizon, profile, rng, unit, difficulty);
    drawVignette(ctx, width, height);
  }

  function drawSky(ctx, width, height, horizon, profile) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, css(shade(profile.skyGradient[0], -14, 8)));
    sky.addColorStop(0.22, css(profile.skyGradient[0]));
    sky.addColorStop(0.48, css(shade(profile.accentColor, -8, -12)));
    sky.addColorStop(0.7, css(profile.skyGradient[1]));
    sky.addColorStop(1, css(shade(profile.groundColor, 14, -6)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const rand = stableRand(profile, "nebula");
    for (let i = 0; i < 5; i++) {
      const x = rand() * width;
      const y = rand() * horizon * 0.85;
      const radius = (70 + rand() * 120) * (height / 720);
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
      cloud.addColorStop(0, hsla(shade(profile.skyGradient[1], 16, 10), 0.28));
      cloud.addColorStop(0.45, hsla(profile.accentColor, 0.12));
      cloud.addColorStop(1, hsla(profile.skyGradient[0], 0));
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * (0.35 + rand() * 0.35), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const glow = ctx.createLinearGradient(0, horizon - height * 0.18, 0, horizon + height * 0.04);
    glow.addColorStop(0, hsla(profile.skyGradient[1], 0));
    glow.addColorStop(0.7, hsla(shade(profile.skyGradient[1], 18), 0.45));
    glow.addColorStop(1, hsla(profile.groundColor, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - height * 0.18, width, height * 0.22);

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(shade(profile.skyGradient[1], 22, 12), 0.28);
    ctx.lineWidth = Math.max(10, height * 0.018);
    for (let i = 0; i < 7; i++) {
      const y = horizon * (0.06 + rand() * 0.62);
      const x = rand() * width * 0.45;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + width * 0.12, y - horizon * 0.07,
        x + width * 0.26, y + horizon * 0.06,
        x + width * 0.48, y - horizon * 0.02
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStars(ctx, width, horizon, profile, unit) {
    const rand = stableRand(profile, "stars");
    const points = [];
    if (profile.starPattern === "cross") {
      for (let i = 0; i < 8; i++) points.push([width * 0.5, horizon * (0.08 + i * 0.08)]);
      for (let i = 0; i < 7; i++) points.push([width * (0.18 + i * 0.1), horizon * 0.36]);
    } else if (profile.starPattern === "arc") {
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        points.push([width * (0.08 + t * 0.84), horizon * (0.62 - Math.sin(t * Math.PI) * 0.46)]);
      }
    } else if (profile.starPattern === "cluster") {
      const cx = width * (0.28 + rand() * 0.44);
      const cy = horizon * (0.22 + rand() * 0.28);
      for (let i = 0; i < 18; i++) {
        points.push([cx + (rand() - 0.5) * width * 0.2, cy + (rand() - 0.5) * horizon * 0.24]);
      }
    } else if (profile.starPattern === "ring") {
      const cx = width * (0.35 + rand() * 0.3);
      const cy = horizon * 0.36;
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        points.push([cx + Math.cos(angle) * width * 0.16, cy + Math.sin(angle) * horizon * 0.2]);
      }
    } else {
      for (let i = 0; i < 42; i++) points.push([rand() * width, rand() * horizon * 0.88]);
    }

    points.forEach((point, index) => {
      const x = point[0];
      const y = point[1];
      if (y > horizon - 4) return;
      ctx.fillStyle = index % 5 === 0 ? "#fff4c8" : "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(x, y, (index % 4 === 0 ? 2.3 : 1.25) * unit, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 18; i++) {
      ctx.fillRect(rand() * width, rand() * horizon * 0.8, unit, unit);
    }
  }

  function drawSkyEvent(ctx, width, horizon, profile, unit) {
    const rand = stableRand(profile, "event");
    const x = width * (0.2 + rand() * 0.6);
    const y = horizon * (0.2 + rand() * 0.32);
    if (profile.skyEvent === "eye") drawEyePlanet(ctx, x, y, profile, unit);
    else if (profile.skyEvent === "jelly") drawJellyPlanet(ctx, x, y, profile, unit);
    else if (profile.skyEvent === "shard") drawShardPlanet(ctx, x, y, profile, unit);
    else if (profile.skyEvent === "spiral") drawSpiralPlanet(ctx, x, y, profile, unit);
    else if (profile.skyEvent === "worm") drawWormPlanet(ctx, x, y, width, profile, unit);
    else drawFunkyRing(ctx, x, y, profile, unit);
  }

  function drawFunkyRing(ctx, x, y, profile, unit) {
    const body = shade(profile.accentColor, 4, 10);
    ctx.fillStyle = hsla(body, 0.35);
    ctx.beginPath();
    ctx.arc(x, y, 78 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(body);
    ctx.beginPath();
    ctx.arc(x, y, 30 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hsla(shade(body, 24), 0.8);
    ctx.beginPath();
    ctx.arc(x - 8 * unit, y - 8 * unit, 8 * unit, 0, Math.PI * 2);
    ctx.arc(x + 12 * unit, y + 6 * unit, 5 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(shade(profile.skyGradient[1], 20));
    ctx.lineWidth = 5 * unit;
    [-0.5, 0.35, 1.1].forEach((tilt, index) => {
      ctx.beginPath();
      ctx.ellipse(x, y, (70 + index * 14) * unit, (16 + index * 4) * unit, tilt, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawEyePlanet(ctx, x, y, profile, unit) {
    const white = shade(profile.skyGradient[1], 28, -20);
    ctx.fillStyle = css(profile.accentColor);
    ctx.beginPath();
    ctx.ellipse(x, y, 78 * unit, 34 * unit, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(white);
    ctx.beginPath();
    ctx.arc(x, y, 22 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#140c18";
    ctx.beginPath();
    ctx.arc(x + 2 * unit, y, 9 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hsla(shade(profile.accentColor, 16), 0.7);
    ctx.lineWidth = 3 * unit;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 28 * unit, y + Math.sin(angle) * 16 * unit);
      ctx.lineTo(x + Math.cos(angle) * 70 * unit, y + Math.sin(angle) * 40 * unit);
      ctx.stroke();
    }
  }

  function drawJellyPlanet(ctx, x, y, profile, unit) {
    const blob = shade(profile.accentColor, 8, 16);
    ctx.fillStyle = hsla(blob, 0.72);
    ctx.beginPath();
    ctx.moveTo(x, y - 48 * unit);
    ctx.bezierCurveTo(x + 70 * unit, y - 60 * unit, x + 64 * unit, y + 20 * unit, x, y + 36 * unit);
    ctx.bezierCurveTo(x - 68 * unit, y + 24 * unit, x - 72 * unit, y - 40 * unit, x, y - 48 * unit);
    ctx.fill();
    ctx.strokeStyle = hsla(shade(blob, -16), 0.8);
    ctx.lineWidth = 3 * unit;
    ctx.lineCap = "round";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 14 * unit, y + 20 * unit);
      ctx.quadraticCurveTo(x + i * 22 * unit, y + 48 * unit, x + i * 10 * unit, y + 74 * unit);
      ctx.stroke();
    }
    ctx.fillStyle = hsla(shade(blob, 30), 0.85);
    ctx.beginPath();
    ctx.arc(x - 12 * unit, y - 8 * unit, 8 * unit, 0, Math.PI * 2);
    ctx.arc(x + 16 * unit, y + 4 * unit, 5 * unit, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawShardPlanet(ctx, x, y, profile, unit) {
    const color = shade(profile.accentColor, 6);
    ctx.fillStyle = css(color);
    [[0, -46, 18, -8, -16, 6], [20, -10, 58, 12, 16, 28], [-24, 8, -60, 24, -8, 36], [6, 10, 24, 52, -18, 40]].forEach((poly) => {
      ctx.beginPath();
      ctx.moveTo(x + poly[0] * unit, y + poly[1] * unit);
      ctx.lineTo(x + poly[2] * unit, y + poly[3] * unit);
      ctx.lineTo(x + poly[4] * unit, y + poly[5] * unit);
      ctx.closePath();
      ctx.fill();
    });
    ctx.strokeStyle = hsla(shade(color, 24), 0.7);
    ctx.lineWidth = 2 * unit;
    ctx.stroke();
  }

  function drawSpiralPlanet(ctx, x, y, profile, unit) {
    ctx.strokeStyle = css(shade(profile.accentColor, 10, 12));
    ctx.lineWidth = 7 * unit;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 48; i++) {
      const t = i / 48;
      const angle = t * Math.PI * 5.2;
      const radius = (8 + t * 62) * unit;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius * 0.72;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = css(shade(profile.skyGradient[1], 20));
    ctx.beginPath();
    ctx.arc(x, y, 8 * unit, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWormPlanet(ctx, x, y, width, profile, unit) {
    ctx.strokeStyle = css(profile.accentColor);
    ctx.fillStyle = css(shade(profile.accentColor, 8));
    ctx.lineWidth = 16 * unit;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - width * 0.12, y);
    ctx.bezierCurveTo(x, y - 50 * unit, x + width * 0.08, y + 40 * unit, x + width * 0.16, y - 10 * unit);
    ctx.stroke();
    const headX = x + width * 0.16;
    const headY = y - 10 * unit;
    ctx.beginPath();
    ctx.arc(headX, headY, 18 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f7fbff";
    ctx.beginPath();
    ctx.arc(headX - 6 * unit, headY - 2 * unit, 4 * unit, 0, Math.PI * 2);
    ctx.arc(headX + 6 * unit, headY - 2 * unit, 4 * unit, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSun(ctx, x, y, glow, unit) {
    const halo = ctx.createRadialGradient(x, y, 8 * unit, x, y, 170 * unit);
    halo.addColorStop(0, hsla(glow, 0.95));
    halo.addColorStop(0.35, hsla(glow, 0.35));
    halo.addColorStop(1, hsla(glow, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, 170 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(x, y, 28 * unit, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMoons(ctx, x, y, glow, unit) {
    drawCrescent(ctx, x - 54 * unit, y, 34 * unit, glow);
    drawCrescent(ctx, x + 46 * unit, y + 18 * unit, 22 * unit, shade(glow, 8));
  }

  function drawCrescent(ctx, x, y, radius, color) {
    ctx.fillStyle = css(shade(color, 18, -10));
    ctx.beginPath();
    ctx.arc(x, y, radius, 0.5, Math.PI * 1.7);
    ctx.arc(x + radius * 0.42, y - radius * 0.05, radius * 0.82, Math.PI * 1.7, 0.5, true);
    ctx.fill();
  }

  function drawRingedPlanet(ctx, x, y, profile, unit) {
    const body = shade(profile.accentColor, 6);
    const halo = ctx.createRadialGradient(x, y, 10, x, y, 90 * unit);
    halo.addColorStop(0, hsla(body, 0.45));
    halo.addColorStop(1, hsla(body, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, 90 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hsla(shade(body, 20), 0.85);
    ctx.lineWidth = 7 * unit;
    ctx.beginPath();
    ctx.ellipse(x, y, 78 * unit, 18 * unit, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = css(body);
    ctx.beginPath();
    ctx.arc(x, y, 26 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hsla(shade(body, 24), 0.9);
    ctx.beginPath();
    ctx.ellipse(x, y, 78 * unit, 18 * unit, -0.4, -0.2, Math.PI + 0.2);
    ctx.stroke();
  }

  function drawAurora(ctx, width, horizon, profile, unit) {
    const bands = 5;
    for (let i = 0; i < bands; i++) {
      const x = width * (0.12 + i * 0.16);
      const gradient = ctx.createLinearGradient(x, horizon * 0.05, x, horizon);
      gradient.addColorStop(0, hsla(shade(profile.accentColor, 10), 0));
      gradient.addColorStop(0.45, hsla(profile.accentColor, 0.38));
      gradient.addColorStop(1, hsla(profile.accentColor, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.quadraticCurveTo(x + 30 * unit, horizon * 0.45, x + 10 * unit, horizon * 0.08);
      ctx.quadraticCurveTo(x + 50 * unit, horizon * 0.4, x + 46 * unit, horizon);
      ctx.fill();
    }
  }

  function drawEclipse(ctx, x, y, glow, unit) {
    const corona = ctx.createRadialGradient(x, y, 22 * unit, x, y, 90 * unit);
    corona.addColorStop(0, hsla(glow, 0.9));
    corona.addColorStop(0.4, hsla(glow, 0.25));
    corona.addColorStop(1, hsla(glow, 0));
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(x, y, 90 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#140e18";
    ctx.beginPath();
    ctx.arc(x, y, 24 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hsla(shade(glow, 16), 0.8);
    ctx.lineWidth = 3 * unit;
    ctx.stroke();
  }

  function drawTerrain(ctx, width, horizon, profile, unit, depth, yShift) {
    const rand = stableRand(profile, `terrain-${depth}`);
    const base = horizon + yShift * unit;
    const color = depth < 1 ? shade(profile.groundColor, 18, -18) : shade(profile.groundColor, -4);
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.moveTo(0, base + 30 * unit);
    if (profile.terrain === "mesa") {
      let x = 0;
      while (x < width) {
        const block = (80 + rand() * 110) * unit * depth;
        const top = (24 + rand() * 78) * unit * depth;
        ctx.lineTo(x, base - top * 0.15);
        ctx.lineTo(x, base - top);
        ctx.lineTo(Math.min(width, x + block), base - top);
        x += block + (10 + rand() * 26) * unit;
        ctx.lineTo(Math.min(width, x), base - top * 0.2);
      }
    } else if (profile.terrain === "dune") {
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lift = (28 + Math.sin(t * Math.PI * 3.2 + depth) * 22 + Math.sin(t * 12) * 6) * unit * depth;
        ctx.lineTo(width * t, base - lift);
      }
    } else if (profile.terrain === "spire") {
      const spikes = 9;
      for (let i = 0; i <= spikes; i++) {
        const x = (width / spikes) * i;
        const tall = i % 2 === 0;
        ctx.lineTo(x, base - (tall ? 90 + rand() * 50 : 12 + rand() * 16) * unit * depth);
      }
    } else {
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const x = (width / steps) * i;
        ctx.lineTo(x, base - (18 + rand() * 62) * unit * depth);
      }
    }
    ctx.lineTo(width, base + 40 * unit);
    ctx.closePath();
    ctx.fill();
  }

  function drawHaze(ctx, width, horizon, profile, unit, alpha) {
    const haze = ctx.createLinearGradient(0, horizon - 70 * unit, 0, horizon + 50 * unit);
    haze.addColorStop(0, hsla(profile.skyGradient[1], 0));
    haze.addColorStop(0.55, hsla(shade(profile.skyGradient[1], 16, -20), alpha));
    haze.addColorStop(1, hsla(profile.groundColor, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - 70 * unit, width, 130 * unit);
  }

  function drawGround(ctx, width, height, horizon, profile) {
    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, css(shade(profile.groundColor, 12, -6)));
    ground.addColorStop(0.35, css(profile.groundColor));
    ground.addColorStop(1, css(shade(profile.groundColor, -14, -4)));
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon - 2, width, height - horizon + 4);
    const speckle = stableRand(profile, "soil");
    for (let i = 0; i < 70; i++) {
      const y = horizon + speckle() * (height - horizon);
      const near = (y - horizon) / (height - horizon);
      ctx.fillStyle = hsla(shade(profile.groundColor, speckle() < 0.5 ? -12 : 10), 0.18 + near * 0.2);
      ctx.beginPath();
      ctx.ellipse(speckle() * width, y, (1.2 + speckle() * 4) * (0.4 + near), (0.6 + speckle() * 1.4) * (0.4 + near), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGroundPattern(ctx, width, height, horizon, profile, unit) {
    const rand = stableRand(profile, "ground");
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, width, height - horizon);
    ctx.clip();
    if (profile.groundPattern === "cracked") {
      ctx.strokeStyle = hsla(shade(profile.groundColor, -22), 0.65);
      ctx.lineWidth = Math.max(1, 1.4 * unit);
      for (let i = 0; i < 16; i++) {
        let x = rand() * width;
        let y = horizon + rand() * (height - horizon);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let step = 0; step < 4; step++) {
          x += (rand() - 0.5) * 90 * unit;
          y += (rand() * 28 + 8) * unit;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (profile.groundPattern === "rippled") {
      ctx.strokeStyle = hsla(shade(profile.groundColor, 16), 0.45);
      ctx.lineWidth = Math.max(1, 2 * unit);
      for (let row = 0; row < 9; row++) {
        const y = horizon + (height - horizon) * (0.08 + row * 0.1);
        ctx.beginPath();
        for (let x = 0; x <= width; x += 16 * unit) {
          const wave = Math.sin(x / (28 * unit) + row) * 5 * unit;
          if (x === 0) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }
    } else if (profile.groundPattern === "hex") {
      ctx.strokeStyle = hsla(shade(profile.groundColor, 18), 0.4);
      ctx.lineWidth = Math.max(1, 1.5 * unit);
      const size = 28 * unit;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 14; col++) {
          const x = col * size * 1.7 + (row % 2) * size * 0.85;
          const y = horizon + 20 * unit + row * size * 1.15;
          drawHex(ctx, x, y, size * 0.72);
        }
      }
    } else {
      ctx.fillStyle = hsla(shade(profile.groundColor, -10), 0.35);
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.ellipse(rand() * width, horizon + rand() * (height - horizon), (2 + rand() * 5) * unit, (1 + rand() * 2) * unit, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawHex(ctx, x, y, radius) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function depthScale(y, height, horizon) {
    const t = (y - horizon) / (height - horizon);
    return 0.45 + Math.max(0, Math.min(1, t)) * 0.9;
  }

  function photoDepth(rng) {
    const roll = rng();
    if (roll < 0.34) return 0.1 + rng() * 0.16;
    if (roll < 0.67) return 0.34 + rng() * 0.2;
    return 0.62 + rng() * 0.3;
  }

  function distanceScale(y, height, horizon) {
    const t = Math.max(0, Math.min(1, (y - horizon) / (height - horizon)));
    return 0.28 + t * t * 1.65;
  }

  function sideX(rng, width, height, horizon, side, y, inset) {
    const t = Math.max(0, Math.min(1, (y - horizon) / (height - horizon)));
    const half = width * (0.04 + t * 0.2);
    const center = width / 2;
    const edge = 36 + inset;
    let x;
    if (side === "left") {
      const max = center - half - 18;
      x = edge + rng() * Math.max(12, max - edge);
    } else {
      const min = center + half + 18;
      x = min + rng() * Math.max(12, width - edge - min);
    }
    return Math.max(edge, Math.min(width - edge, x));
  }

  function bandPoint(rng, width, height, horizon, side, yNorm, inset) {
    const y = horizon + (height - horizon) * yNorm;
    return {
      x: sideX(rng, width, height, horizon, side, y, inset),
      y,
      scale: Math.max(0.62, depthScale(y, height, horizon)),
    };
  }

  function drawPath(ctx, width, height, horizon, profile, unit) {
    const rand = stableRand(profile, "road");
    const bottomL = width * 0.26;
    const bottomR = width * 0.74;
    const topL = width * 0.468;
    const topR = width * 0.532;
    function lane(y, bias) {
      const t = Math.max(0, Math.min(1, (y - horizon) / (height - horizon)));
      const left = topL + (bottomL - topL) * t;
      const right = topR + (bottomR - topR) * t;
      return left + (right - left) * bias;
    }
    function roadQuad(y0, y1, b0, b1) {
      ctx.beginPath();
      ctx.moveTo(lane(y0, b0), y0);
      ctx.lineTo(lane(y1, b0), y1);
      ctx.lineTo(lane(y1, b1), y1);
      ctx.lineTo(lane(y0, b1), y0);
      ctx.closePath();
    }

    ctx.fillStyle = hsla(shade(profile.groundColor, -10), 0.95);
    roadQuad(horizon, height, -0.1, 1.1);
    ctx.fill();

    ctx.save();
    roadQuad(horizon, height, 0, 1);
    ctx.clip();
    const crown = ctx.createLinearGradient(bottomL, 0, bottomR, 0);
    const dirt = {
      h: 28 + (profile.pathColor.h % 36) * 0.2,
      s: 26 + profile.pathColor.s * 0.12,
      l: 36 + profile.pathColor.l * 0.16,
    };
    crown.addColorStop(0, css(shade(dirt, -22, -8)));
    crown.addColorStop(0.14, css(shade(dirt, -10, -4)));
    crown.addColorStop(0.5, css(shade(dirt, 18, 6)));
    crown.addColorStop(0.86, css(shade(dirt, -10, -4)));
    crown.addColorStop(1, css(shade(dirt, -22, -8)));
    ctx.fillStyle = crown;
    ctx.fillRect(0, horizon, width, height - horizon);
    for (let i = 0; i < 48; i++) {
      const y = horizon + (height - horizon) * rand();
      const side = 0.08 + rand() * 0.84;
      const edge = Math.abs(side - 0.5) * 2;
      const spread = (3 + rand() * 14) * unit * (0.35 + (y - horizon) / (height - horizon));
      ctx.fillStyle = hsla(shade(dirt, (rand() - 0.5) * 16 - edge * 8), 0.35 + rand() * 0.4);
      ctx.beginPath();
      ctx.ellipse(lane(y, side), y, spread, spread * (0.28 + rand() * 0.25), rand() * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = hsla(shade(profile.pathColor, -20), 0.55);
    for (let i = 0; i < 26; i++) {
      const y = horizon + (height - horizon) * (0.08 + rand() * 0.9);
      const side = rand() < 0.5 ? 0.04 + rand() * 0.08 : 0.88 + rand() * 0.08;
      const spread = (4 + rand() * 10) * unit * (0.4 + (y - horizon) / (height - horizon));
      ctx.beginPath();
      ctx.ellipse(lane(y, side), y, spread, spread * 0.45, rand(), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = hsla(shade(profile.pathColor, -24), 0.55);
    ctx.lineWidth = Math.max(1, 2.2 * unit);
    [0.36, 0.64].forEach((bias) => {
      ctx.beginPath();
      for (let step = 0; step <= 16; step++) {
        const t = step / 16;
        const y = horizon + (height - horizon) * t;
        const wobble = Math.sin(t * 18 + bias * 6) * 0.012;
        const x = lane(y, bias + wobble);
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    const sideBias = profile.drivingSide === "left" ? 0.24 : 0.76;
    ctx.save();
    ctx.lineCap = "round";
    if (profile.pathStyle === "plates") {
      ctx.strokeStyle = hsla(shade(profile.pathColor, -26), 0.42);
      ctx.lineWidth = Math.max(1, 1.3 * unit);
      for (let i = 0; i < 6; i++) {
        const y = horizon + (height - horizon) * (0.16 + i * 0.13);
        const start = 0.12 + (i % 3) * 0.08;
        ctx.beginPath();
        ctx.moveTo(lane(y, start), y);
        ctx.lineTo(lane(y, start + 0.18), y);
        ctx.moveTo(lane(y + unit, 0.58), y + unit);
        ctx.lineTo(lane(y + unit, 0.78), y + unit);
        ctx.stroke();
      }
    } else if (profile.pathStyle === "glow") {
      ctx.shadowColor = css(profile.pathLineColor);
      ctx.shadowBlur = 14 * unit;
      ctx.strokeStyle = css(profile.pathLineColor);
      ctx.lineWidth = Math.max(3, 6 * unit);
      ctx.beginPath();
      ctx.moveTo(lane(horizon + 8, sideBias), horizon + 8);
      ctx.lineTo(lane(height - 6, sideBias), height - 6);
      ctx.stroke();
    } else if (profile.pathStyle === "rails") {
      ctx.strokeStyle = css(profile.pathLineColor);
      ctx.lineWidth = Math.max(2, 3.5 * unit);
      [sideBias - 0.07, sideBias + 0.07].forEach((bias) => {
        ctx.beginPath();
        ctx.moveTo(lane(horizon + 8, bias), horizon + 8);
        ctx.lineTo(lane(height - 6, bias), height - 6);
        ctx.stroke();
      });
      ctx.lineWidth = Math.max(1, 1.5 * unit);
      for (let i = 0; i < 10; i++) {
        const y = horizon + (height - horizon) * (0.12 + i * 0.08);
        ctx.beginPath();
        ctx.moveTo(lane(y, sideBias - 0.07), y);
        ctx.lineTo(lane(y, sideBias + 0.07), y);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = hsla(profile.pathLineColor, 0.85);
      ctx.lineWidth = Math.max(2, 4 * unit);
      ctx.setLineDash([14 * unit, 16 * unit]);
      ctx.beginPath();
      ctx.moveTo(lane(horizon + 8, sideBias), horizon + 8);
      ctx.lineTo(lane(height - 6, sideBias), height - 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawBuildings(ctx, width, height, horizon, profile, rng, unit, queue) {
    const count = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const spot = bandPoint(rng, width, height, horizon, profile.drivingSide, photoDepth(rng), 26);
      const scale = distanceScale(spot.y, height, horizon) * unit * 4.6;
      queue(spot.y, () => drawBuilding(ctx, spot.x, spot.y, scale, profile));
    }
  }

  function drawBuilding(ctx, x, y, scale, profile) {
    const w = 26 * scale;
    const h = 32 * scale;
    const left = x - w / 2;
    const wallTop = y - h * 0.72;
    const wall = shade(profile.roofColor, -18, -12);
    ctx.fillStyle = hsla(shade(wall, -18), 0.35);
    ctx.beginPath();
    ctx.ellipse(x + w * 0.15, y, w * 0.7, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = css(wall);
    if (profile.roofShape === "arch") {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left, wallTop + h * 0.28);
      ctx.quadraticCurveTo(x, wallTop - h * 0.08, left + w, wallTop + h * 0.28);
      ctx.lineTo(left + w, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(left, wallTop + h * 0.22, w, y - (wallTop + h * 0.22));
    }

    ctx.fillStyle = css(profile.roofColor);
    if (profile.roofShape === "dome") {
      ctx.beginPath();
      ctx.ellipse(x, wallTop + h * 0.28, w * 0.56, h * 0.28, 0, Math.PI, 0);
      ctx.fill();
    } else if (profile.roofShape === "spike") {
      ctx.beginPath();
      ctx.moveTo(left - w * 0.08, wallTop + h * 0.34);
      ctx.lineTo(x, wallTop - h * 0.16);
      ctx.lineTo(left + w * 1.08, wallTop + h * 0.34);
      ctx.closePath();
      ctx.fill();
    } else if (profile.roofShape === "flat") {
      ctx.fillRect(left - w * 0.08, wallTop + h * 0.12, w * 1.16, h * 0.12);
    } else {
      ctx.beginPath();
      ctx.moveTo(left + w * 0.08, wallTop + h * 0.36);
      ctx.quadraticCurveTo(x, wallTop - h * 0.12, left + w * 0.92, wallTop + h * 0.36);
      ctx.lineTo(left + w * 0.78, wallTop + h * 0.36);
      ctx.quadraticCurveTo(x, wallTop + h * 0.08, left + w * 0.22, wallTop + h * 0.36);
      ctx.closePath();
      ctx.fill();
    }

    drawWindows(ctx, x, y - h * 0.28, w, h, profile);
    ctx.fillStyle = css(shade(profile.roofColor, -28));
    ctx.fillRect(x - w * 0.08, y - h * 0.28, w * 0.16, h * 0.28);
  }

  function drawWindows(ctx, x, y, w, h, profile) {
    ctx.fillStyle = css(shade(profile.accentColor, 12));
    const style = profile.windowStyle;
    if (style === "round") {
      ctx.beginPath();
      ctx.arc(x - w * 0.22, y, w * 0.09, 0, Math.PI * 2);
      ctx.arc(x + w * 0.22, y, w * 0.09, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === "grid") {
      for (let col = 0; col < 2; col++) {
        for (let row = 0; row < 2; row++) {
          ctx.fillRect(x - w * 0.28 + col * w * 0.22, y - h * 0.08 + row * h * 0.1, w * 0.1, h * 0.07);
        }
      }
    } else if (style === "arch") {
      [-0.24, 0.12].forEach((offset) => {
        const left = x + w * offset;
        ctx.beginPath();
        ctx.moveTo(left, y + h * 0.08);
        ctx.lineTo(left, y - h * 0.02);
        ctx.quadraticCurveTo(left + w * 0.08, y - h * 0.12, left + w * 0.16, y - h * 0.02);
        ctx.lineTo(left + w * 0.16, y + h * 0.08);
        ctx.fill();
      });
    } else {
      ctx.fillRect(x - w * 0.28, y - h * 0.08, w * 0.07, h * 0.2);
      ctx.fillRect(x + w * 0.16, y - h * 0.08, w * 0.07, h * 0.2);
    }
  }

  function drawVegetation(ctx, width, height, horizon, profile, rng, unit, queue) {
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const spot = bandPoint(rng, width, height, horizon, profile.drivingSide, photoDepth(rng), 8);
      const scale = distanceScale(spot.y, height, horizon) * unit * 4.2;
      queue(spot.y, () => drawPlant(ctx, spot.x, spot.y, scale, profile));
    }
  }

  function drawPlant(ctx, x, y, scale, profile) {
    if (profile.vegetation === "crystal") drawCrystal(ctx, x, y, scale, profile);
    else if (profile.vegetation === "mushroom") drawMushroom(ctx, x, y, scale, profile);
    else if (profile.vegetation === "coral") drawCoral(ctx, x, y, scale, profile);
    else drawSpikePlant(ctx, x, y, scale, profile);
  }

  function drawCrystal(ctx, x, y, scale, profile) {
    ctx.fillStyle = css(profile.vegetationColor);
    ctx.beginPath();
    ctx.moveTo(x, y - 36 * scale);
    ctx.lineTo(x + 11 * scale, y - 8 * scale);
    ctx.lineTo(x, y);
    ctx.lineTo(x - 11 * scale, y - 8 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hsla(shade(profile.vegetationColor, 24), 0.85);
    ctx.beginPath();
    ctx.moveTo(x - 2 * scale, y - 30 * scale);
    ctx.lineTo(x + 2 * scale, y - 12 * scale);
    ctx.lineTo(x - 5 * scale, y - 12 * scale);
    ctx.fill();
    ctx.fillStyle = css(shade(profile.vegetationColor, -8));
    ctx.beginPath();
    ctx.moveTo(x + 14 * scale, y - 22 * scale);
    ctx.lineTo(x + 22 * scale, y - 4 * scale);
    ctx.lineTo(x + 12 * scale, y);
    ctx.lineTo(x + 7 * scale, y - 6 * scale);
    ctx.closePath();
    ctx.fill();
  }

  function drawMushroom(ctx, x, y, scale, profile) {
    ctx.fillStyle = css(shade(profile.vegetationColor, -24, -15));
    ctx.fillRect(x - 3.5 * scale, y - 18 * scale, 7 * scale, 18 * scale);
    const cap = ctx.createLinearGradient(x, y - 30 * scale, x, y - 12 * scale);
    cap.addColorStop(0, css(shade(profile.vegetationColor, 12)));
    cap.addColorStop(1, css(profile.vegetationColor));
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(x, y - 18 * scale, 18 * scale, 11 * scale, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = hsla(shade(profile.vegetationColor, 28), 0.9);
    ctx.beginPath();
    ctx.arc(x - 6 * scale, y - 21 * scale, 2.4 * scale, 0, Math.PI * 2);
    ctx.arc(x + 5 * scale, y - 19 * scale, 1.7 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCoral(ctx, x, y, scale, profile) {
    ctx.strokeStyle = css(profile.vegetationColor);
    ctx.fillStyle = css(shade(profile.vegetationColor, 14));
    ctx.lineWidth = Math.max(2, 4.5 * scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 10 * scale, y - 16 * scale, x - 6 * scale, y - 32 * scale);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2 * scale, y - 28 * scale);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 12 * scale, y - 14 * scale, x + 14 * scale, y - 30 * scale);
    ctx.stroke();
    [[-6, -32], [2, -28], [14, -30]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(x + dx * scale, y + dy * scale, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSpikePlant(ctx, x, y, scale, profile) {
    ctx.fillStyle = css(profile.vegetationColor);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 8 * scale, y);
      ctx.lineTo(x + i * 11 * scale, y - (20 + Math.abs(i) * 8) * scale);
      ctx.lineTo(x + (i * 8 + 5) * scale, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBanners(ctx, width, height, horizon, profile, rng, unit, queue) {
    if (profile.banner === "none") return;
    const yNorm = photoDepth(rng);
    const y = horizon + (height - horizon) * yNorm;
    const x = sideX(rng, width, height, horizon, profile.drivingSide, y, 20);
    const scale = distanceScale(y, height, horizon) * unit * 3.2;
    queue(y, () => drawBannerAt(ctx, x, y, scale, profile));
  }

  function drawBannerAt(ctx, x, y, scale, profile) {
    ctx.strokeStyle = css(profile.poleColor);
    ctx.lineWidth = Math.max(2, 2 * scale);
    ctx.beginPath();
    ctx.moveTo(x - 34 * scale, y - 28 * scale);
    ctx.lineTo(x + 34 * scale, y - 28 * scale);
    ctx.stroke();
    if (profile.banner === "flags") {
      for (let i = -1; i <= 1; i++) {
        const fx = x + i * 22 * scale;
        ctx.fillStyle = css(i === 0 ? profile.accentColor : shade(profile.accentColor, i * 8));
        ctx.beginPath();
        ctx.moveTo(fx, y - 28 * scale);
        ctx.lineTo(fx + 14 * scale, y - 20 * scale);
        ctx.lineTo(fx, y - 12 * scale);
        ctx.fill();
      }
    } else if (profile.banner === "lanterns") {
      for (let i = -1; i <= 1; i++) {
        const lx = x + i * 22 * scale;
        ctx.strokeStyle = css(profile.poleColor);
        ctx.beginPath();
        ctx.moveTo(lx, y - 28 * scale);
        ctx.lineTo(lx, y - 18 * scale);
        ctx.stroke();
        ctx.fillStyle = css(profile.accentColor);
        ctx.beginPath();
        ctx.arc(lx, y - 12 * scale, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = css(profile.accentColor);
      ctx.lineWidth = Math.max(2, 3 * scale);
      ctx.beginPath();
      ctx.moveTo(x - 34 * scale, y - 20 * scale);
      ctx.quadraticCurveTo(x, y - 6 * scale, x + 34 * scale, y - 22 * scale);
      ctx.stroke();
    }
  }

  function drawFence(ctx, width, height, horizon, profile, rng, unit, queue) {
    if (profile.fence === "none") return;
    const y = horizon + (height - horizon) * photoDepth(rng);
    const scale = distanceScale(y, height, horizon) * unit * 3.1;
    const x = sideX(rng, width, height, horizon, profile.drivingSide, y, 30);
    queue(y, () => drawFenceAt(ctx, x, y, scale, profile));
  }

  function drawFenceAt(ctx, x, y, scale, profile) {
    const posts = 4;
    const gap = 22 * scale;
    ctx.strokeStyle = css(profile.poleColor);
    ctx.fillStyle = css(shade(profile.poleColor, -8));
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.lineCap = "round";
    if (profile.fence === "wall") {
      ctx.fillRect(x - gap * 1.6, y - 16 * scale, gap * 3.2, 16 * scale);
      ctx.fillStyle = css(profile.accentColor);
      ctx.fillRect(x - gap * 1.6, y - 20 * scale, gap * 3.2, 5 * scale);
      return;
    }
    for (let i = 0; i < posts; i++) {
      const px = x + (i - 1.5) * gap;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y - 26 * scale);
      ctx.stroke();
      if (profile.fence === "posts" && i < posts - 1) {
        ctx.beginPath();
        ctx.moveTo(px, y - 18 * scale);
        ctx.lineTo(px + gap, y - 18 * scale);
        ctx.stroke();
      }
    }
    if (profile.fence === "chain") {
      ctx.beginPath();
      for (let i = 0; i < posts - 1; i++) {
        const px = x + (i - 1.5) * gap;
        ctx.moveTo(px, y - 20 * scale);
        ctx.quadraticCurveTo(px + gap / 2, y - 6 * scale, px + gap, y - 20 * scale);
      }
      ctx.stroke();
    }
  }

  function drawPoleAndSign(ctx, width, height, horizon, profile, rng, unit, shown, queue) {
    const pole = bandPoint(rng, width, height, horizon, profile.drivingSide, photoDepth(rng), 34);
    const scale = distanceScale(pole.y, height, horizon) * unit * 4.3;
    queue(pole.y, () => {
      if (!shown || shown.pole) drawPole(ctx, pole.x, pole.y, scale, profile);
      if (!shown || shown.sign) {
        const outward = profile.drivingSide === "left" ? -1 : 1;
        const signX = Math.max(56, Math.min(width - 56, pole.x + outward * Math.min(width * 0.11, 26 * scale)));
        drawSign(ctx, signX, pole.y, scale * 0.92, profile);
      }
    });
  }

  function drawPole(ctx, x, y, scale, profile) {
    ctx.strokeStyle = css(profile.poleColor);
    ctx.fillStyle = css(profile.poleColor);
    ctx.lineWidth = Math.max(3, 4.5 * scale);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 58 * scale);
    ctx.stroke();
    const top = y - 58 * scale;
    if (profile.poleTop === "ball") {
      ctx.beginPath();
      ctx.arc(x, top, 8 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (profile.poleTop === "ring") {
      ctx.beginPath();
      ctx.arc(x, top - 2 * scale, 9 * scale, 0, Math.PI * 2);
      ctx.stroke();
    } else if (profile.poleTop === "fork") {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x - 12 * scale, top - 18 * scale);
      ctx.moveTo(x, top);
      ctx.lineTo(x + 12 * scale, top - 18 * scale);
      ctx.stroke();
    }
  }

  function drawSign(ctx, x, y, scale, profile) {
    const board = y - 36 * scale;
    ctx.strokeStyle = css(profile.poleColor);
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, board + 14 * scale);
    ctx.stroke();
    ctx.fillStyle = css(profile.accentColor);
    const s = 18 * scale;
    ctx.beginPath();
    if (profile.signShape === "circle") ctx.arc(x, board, s, 0, Math.PI * 2);
    else if (profile.signShape === "diamond") {
      ctx.moveTo(x, board - s);
      ctx.lineTo(x + s, board);
      ctx.lineTo(x, board + s);
      ctx.lineTo(x - s, board);
      ctx.closePath();
    } else if (profile.signShape === "triangle") {
      ctx.moveTo(x, board - s * 1.05);
      ctx.lineTo(x + s, board + s * 0.82);
      ctx.lineTo(x - s, board + s * 0.82);
      ctx.closePath();
    } else {
      ctx.moveTo(x - s, board - s * 0.72);
      ctx.lineTo(x + s, board - s * 0.72);
      ctx.lineTo(x + s, board + s * 0.45);
      ctx.lineTo(x, board + s * 0.15);
      ctx.lineTo(x - s, board + s * 0.45);
      ctx.closePath();
    }
    ctx.fill();
    const ink = profile.accentColor.l > 62 ? "#1a1024" : "#f7f4ff";
    G.drawGlyph(ctx, profile.signGlyph, x, board, s * 1.35, ink);
  }

  function drawAliens(ctx, width, height, horizon, profile, rng, unit, difficulty, queue) {
    const boost = DIFFICULTY_SCALE[difficulty] || 1;
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const spot = bandPoint(rng, width, height, horizon, profile.drivingSide, photoDepth(rng), 14);
      let color = ALIEN.blue;
      if (profile.alienMix === "pink") color = ALIEN.pink;
      if (profile.alienMix === "mixed") color = i % 2 === 0 ? ALIEN.blue : ALIEN.pink;
      const scale = distanceScale(spot.y, height, horizon) * HEIGHT[profile.alienHeight] * boost * unit * 0.95;
      const x = Math.max(28 * scale, Math.min(width - 28 * scale, spot.x));
      queue(spot.y, () => drawAlien(ctx, x, spot.y, scale, color, profile));
    }
  }

  function drawAlien(ctx, x, y, scale, color, profile) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(4, 2, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-8, -34);
    ctx.lineTo(-14, -16);
    ctx.lineTo(-18, 0);
    ctx.moveTo(8, -34);
    ctx.lineTo(15, -16);
    ctx.lineTo(12, 0);
    ctx.moveTo(-16, -58);
    ctx.quadraticCurveTo(-28, -40, -22, -18);
    ctx.moveTo(16, -58);
    ctx.quadraticCurveTo(28, -42, 20, -16);
    ctx.stroke();

    const body = ctx.createLinearGradient(-18, -78, 20, -28);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.22, color);
    body.addColorStop(1, color);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-16, -78);
    ctx.quadraticCurveTo(-22, -48, -14, -30);
    ctx.lineTo(14, -30);
    ctx.quadraticCurveTo(22, -48, 16, -78);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.ellipse(-8, -56, 8, 14, -0.5, 0, Math.PI * 2);
    ctx.fill();

    if (profile.alienTrait === "spots") {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      [[-8, -62], [6, -48], [-2, -36]].forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (profile.alienTrait === "crest") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-4, -96);
      ctx.lineTo(0, -122);
      ctx.lineTo(8, -96);
      ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -90, 21, 0, Math.PI * 2);
    ctx.fill();
    drawEyes(ctx, profile.eyeCount);
    ctx.fillStyle = body;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(-7, -98, 6, 8, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (profile.alienTrait === "horns") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-14, -100);
      ctx.lineTo(-24, -122);
      ctx.lineTo(-6, -104);
      ctx.moveTo(14, -100);
      ctx.lineTo(24, -122);
      ctx.lineTo(6, -104);
      ctx.fill();
    } else if (profile.alienTrait === "antenna") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -108);
      ctx.quadraticCurveTo(-16, -124, -6, -132);
      ctx.moveTo(8, -108);
      ctx.quadraticCurveTo(16, -124, 6, -132);
      ctx.stroke();
      ctx.fillStyle = "#fff6ea";
      ctx.beginPath();
      ctx.arc(-6, -132, 3.5, 0, Math.PI * 2);
      ctx.arc(6, -132, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEyes(ctx, count) {
    const layout = count === 1 ? [[0, -90, 8]] : count === 3 ? [[-12, -90, 4.4], [0, -94, 4.4], [12, -90, 4.4]] : [[-8, -91, 6], [8, -91, 6]];
    layout.forEach(([x, y, radius]) => {
      ctx.fillStyle = "#f4f8ff";
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#16141f";
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - radius * 0.25, y - radius * 0.28, radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPebbles(ctx, width, height, horizon, profile, rng, unit) {
    ctx.fillStyle = hsla(shade(profile.groundColor, -16), 0.8);
    for (let i = 0; i < 8; i++) {
      const y = horizon + (height - horizon) * (0.2 + rng() * 0.55);
      const x = sideX(rng, width, height, horizon, profile.drivingSide, y, 4);
      ctx.beginPath();
      ctx.ellipse(x, y, (6 + rng() * 10) * unit, (3 + rng() * 4) * unit, rng(), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWeather(ctx, width, height, horizon, profile, rng, unit, difficulty) {
    if (difficulty === "hard") drawHaze(ctx, width, horizon, profile, unit, 0.1);
    if (profile.weather === "mist") drawHaze(ctx, width, horizon, profile, unit, 0.24);
    if (profile.weather === "dust") {
      ctx.strokeStyle = hsla(shade(profile.groundColor, 20), 0.35);
      ctx.lineWidth = 2 * unit;
      for (let i = 0; i < 7; i++) {
        const y = horizon * 0.75 + rng() * (height - horizon);
        ctx.beginPath();
        ctx.moveTo(rng() * width * 0.3, y);
        ctx.lineTo(width * (0.4 + rng() * 0.5), y - 8 * unit);
        ctx.stroke();
      }
    } else if (profile.weather === "spores") {
      ctx.fillStyle = hsla(profile.vegetationColor, 0.75);
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc(rng() * width, rng() * height * 0.92, (1.5 + rng() * 2.5) * unit, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawVignette(ctx, width, height) {
    const vignette = ctx.createRadialGradient(width / 2, height * 0.45, width * 0.2, width / 2, height * 0.5, width * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  G.drawScene = drawScene;
})(window.AlienGuessr = window.AlienGuessr || {});
