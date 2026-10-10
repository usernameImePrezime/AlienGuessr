(function (G) {
  const BASE = "assets/aliens/";
  const INK = "#1b1033";
  const TINTS = {
    pink: ["#ff6fae", "#ff92c4", "#f25aa0"],
    blue: ["#5b8cff", "#78a8ff", "#4a76f0"],
  };
  const names = [];
  ["A", "B", "C", "D", "E", "F"].forEach((k) => names.push(`body_white${k}`));
  ["A", "B", "C", "D", "E"].forEach((k) => names.push(`arm_white${k}`, `leg_white${k}`));
  ["antenna_large", "antenna_small", "ear", "ear_round", "horn_large", "horn_small"].forEach((k) => names.push(`detail_white_${k}`));
  ["cute_light", "human", "psycho_light", "yellow", "red", "blue", "angry_blue", "human_green", "cute_dark", "closed_happy"].forEach((k) => names.push(`eye_${k}`));
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].forEach((k) => names.push(`mouth${k}`));
  ["closed_fangs", "closed_happy", "closed_teeth"].forEach((k) => names.push(`mouth_${k}`));
  names.push("shipPink", "shipBlue", "shipPink_manned", "shipBlue_manned");

  const images = {};
  const spriteCache = new Map();

  function loadImage(name) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        images[name] = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `${BASE}${name}.png`;
    });
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('400 20px "Luckiest Guy"'),
      document.fonts.load('600 20px "Fredoka"'),
      document.fonts.load('500 20px "Fredoka"'),
    ]).catch(() => {});
  }

  G.assetsReady = Promise.all([...names.map(loadImage), loadFonts()]);

  function image(name) {
    const img = images[name];
    return img && img.naturalWidth ? img : null;
  }

  function makeCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(w));
    canvas.height = Math.max(1, Math.ceil(h));
    return canvas;
  }

  function tinted(img, color) {
    const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  function outlined(source, thickness) {
    const t = Math.ceil(thickness);
    const w = source.width || source.naturalWidth;
    const h = source.height || source.naturalHeight;
    const silhouette = makeCanvas(w, h);
    const sctx = silhouette.getContext("2d");
    sctx.drawImage(source, 0, 0);
    sctx.globalCompositeOperation = "source-in";
    sctx.fillStyle = INK;
    sctx.fillRect(0, 0, w, h);
    const canvas = makeCanvas(w + t * 2, h + t * 2);
    const ctx = canvas.getContext("2d");
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.drawImage(silhouette, t + Math.cos(a) * t, t + Math.sin(a) * t);
    }
    ctx.drawImage(source, t, t);
    return canvas;
  }

  function placePart(ctx, part, jointX, jointY, anchorX, anchorY, mirror, angle, scale) {
    if (!part) return;
    const s = scale || 1;
    ctx.save();
    ctx.translate(jointX, jointY);
    if (angle) ctx.rotate(angle);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(part, -anchorX * s, -anchorY * s, part.width * s, part.height * s);
    ctx.restore();
  }

  function compose(species, color, pose) {
    const body = image(`body_white${species.body}`);
    if (!body) return null;
    const T = 6;
    const bw = body.naturalWidth;
    const bh = body.naturalHeight;
    const fit = bw / 165;
    const armImg = image(`arm_white${species.arm}`);
    const legImg = image(`leg_white${species.leg}`);
    const detailImg = species.detail !== "none" ? image(`detail_white_${species.detail}`) : null;
    const eyeImg = image(`eye_${species.eye}`);
    const mouthImg = image(`mouth${species.mouth.length === 1 ? species.mouth : `_${species.mouth}`}`);
    const arm = armImg ? outlined(tinted(armImg, color), T) : null;
    const leg = legImg ? outlined(tinted(legImg, color), T) : null;
    const detail = detailImg ? outlined(tinted(detailImg, color), T) : null;
    const torso = outlined(tinted(body, color), T);
    const eye = eyeImg ? outlined(eyeImg, T * 0.6) : null;
    const mouth = mouthImg ? outlined(mouthImg, T * 0.5) : null;

    const armW = arm ? arm.width : 0;
    const legH = leg ? leg.height : 0;
    const detailH = detail ? detail.height : 0;
    const W = bw + armW * 2 + 40;
    const H = detailH + bh + legH + 40;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const bx = (W - bw) / 2;
    const by = 16 + detailH * 0.8;

    if (leg) {
      const jx = leg.width * 0.38;
      const jy = leg.width * 0.3;
      placePart(ctx, leg, bx + bw * 0.32, by + bh * 0.84, jx, jy, true, 0);
      placePart(ctx, leg, bx + bw * 0.68, by + bh * 0.84, jx, jy, false, 0);
    }
    if (arm) {
      const jx = arm.width * 0.4;
      const jy = arm.width * 0.3;
      placePart(ctx, arm, bx + bw * 0.1, by + bh * 0.46, jx, jy, true, 0.18);
      placePart(ctx, arm, bx + bw * 0.9, by + bh * 0.46, jx, jy, false, pose === 1 ? -2.6 : -0.18);
    }
    if (detail) {
      const dx = detail.width * 0.3;
      const dy = detail.height * 0.92;
      placePart(ctx, detail, bx + bw * 0.28, by + bh * 0.12, dx, dy, true, -0.15);
      placePart(ctx, detail, bx + bw * 0.72, by + bh * 0.12, dx, dy, false, 0.15);
    }
    ctx.drawImage(torso, bx - T, by - T);

    if (eye) {
      const layouts = {
        1: [[0.5, 0.36, 1.3]],
        2: [[0.31, 0.36, 0.95], [0.69, 0.36, 0.95]],
        3: [[0.23, 0.4, 0.78], [0.5, 0.27, 0.86], [0.77, 0.4, 0.78]],
      };
      (layouts[species.eyes] || layouts[2]).forEach(([ex, ey, es]) => {
        const s = es * fit;
        ctx.drawImage(eye, bx + bw * ex - (eye.width * s) / 2, by + bh * ey - (eye.height * s) / 2, eye.width * s, eye.height * s);
      });
    }
    if (mouth) {
      const s = fit * 0.95;
      ctx.drawImage(mouth, bx + bw * 0.5 - (mouth.width * s) / 2, by + bh * 0.66 - (mouth.height * s) / 2, mouth.width * s, mouth.height * s);
    }
    return { canvas, footY: by + bh * 0.84 + (leg ? leg.height * 0.92 : bh * 0.16), centerX: W / 2, bodyH: bh };
  }

  function alienSprite(species, colorName, variant, pose) {
    const palette = TINTS[colorName] || TINTS.pink;
    const color = palette[variant % palette.length];
    const key = `${species.body}${species.arm}${species.leg}${species.detail}${species.eye}${species.eyes}${species.mouth}|${color}|${pose}`;
    if (!spriteCache.has(key)) spriteCache.set(key, compose(species, color, pose));
    return spriteCache.get(key);
  }

  function drawAlienPreview(ctx, profile, w, h) {
    ctx.clearRect(0, 0, w, h);
    const color = profile.alienMix === "blue" ? "blue" : "pink";
    const sprite = alienSprite(profile.alienSpecies, color, 0, 0);
    if (!sprite) return;
    const scale = Math.min((w * 0.9) / sprite.canvas.width, (h * 0.94) / sprite.footY);
    const dw = sprite.canvas.width * scale;
    ctx.drawImage(sprite.canvas, (w - dw) / 2, h * 0.97 - sprite.footY * scale, dw, sprite.canvas.height * scale);
  }

  G.assetImage = image;
  G.alienSprite = alienSprite;
  G.drawAlienPreview = drawAlienPreview;
})(window.AlienGuessr = window.AlienGuessr || {});
