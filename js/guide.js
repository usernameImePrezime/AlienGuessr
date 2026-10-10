(function (G) {
  const { INK, TAU, col, mixC, shade, paint, stroke } = G.ink;
  const P = G.props;
  const CW = 480;
  const CH = 300;
  const ALIEN_PAINT = { yellow: "#ffd84a", green: "#7cf27c", blue: "#5b8cff", pink: "#ff6fae" };
  const TIER_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };

  function flat(cx, base, S) {
    return { p: (x, z, y) => ({ x: cx + x * S, y: base - (y || 0) * S, s: S }) };
  }

  function backdrop(ctx, kit, pal, profile, rng, U, horizon) {
    const cam = kit.camera(CW, CH * 2 * horizon, 0);
    kit.drawSky(ctx, cam, pal, profile, rng, U);
    const y0 = cam.y0;
    const g = ctx.createLinearGradient(0, y0, 0, CH);
    g.addColorStop(0, col(pal.groundFar, 4));
    g.addColorStop(1, col(pal.ground, -6));
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, CW, CH - y0);
    stroke(ctx, () => {
      ctx.moveTo(0, y0);
      ctx.lineTo(CW, y0);
    }, "rgba(27, 16, 51, 0.4)", 1.2 * U);
    return cam;
  }

  function plainBack(ctx, pal) {
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, "#fffaf2");
    g.addColorStop(1, col(mixC(pal.ground, { h: 40, s: 60, l: 94 }, 0.75)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = "rgba(27, 16, 51, 0.12)";
    ctx.fillRect(0, CH * 0.93, CW, CH * 0.07);
  }

  function roadQuad(ctx, cam, halfW, z0, z1, color) {
    const a = cam.p(-halfW, z0, 0);
    const b = cam.p(halfW, z0, 0);
    const c = cam.p(halfW, z1, 0);
    const d = cam.p(-halfW, z1, 0);
    paint(ctx, () => {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
    }, color, { ink: 1.2 });
  }

  function laneLine(ctx, cam, x, z0, z1, color, dash) {
    for (let z = z0; z < z1; z += dash ? 4 : 200) {
      const za = z;
      const zb = Math.min(z1, z + (dash ? 2 : 200));
      const a = cam.p(x - 0.07, za, 0);
      const b = cam.p(x + 0.07, za, 0);
      const c = cam.p(x + 0.07, zb, 0);
      const d = cam.p(x - 0.07, zb, 0);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function bigText(ctx, text, x, y, size, color, align) {
    ctx.save();
    ctx.font = `${size}px "Luckiest Guy", Fredoka, sans-serif`;
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = INK;
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function blobAlien(ctx, x, y, r, color, U) {
    paint(ctx, () => {
      ctx.moveTo(x - r, y);
      ctx.bezierCurveTo(x - r * 1.1, y - r * 1.5, x - r * 0.4, y - r * 2.1, x, y - r * 2.1);
      ctx.bezierCurveTo(x + r * 0.4, y - r * 2.1, x + r * 1.1, y - r * 1.5, x + r, y);
      ctx.closePath();
    }, color, { ink: 2.4 * U, glaze: "rgba(27, 16, 51, 0.25)", edge: r * 0.3 });
    paint(ctx, () => ctx.arc(x, y - r * 1.25, r * 0.38, 0, TAU), "#fffaf2", { ink: 1.6 * U });
    paint(ctx, () => ctx.arc(x + r * 0.06, y - r * 1.2, r * 0.17, 0, TAU), INK);
    stroke(ctx, () => ctx.arc(x, y - r * 0.6, r * 0.28, 0.2, Math.PI - 0.2), INK, 2 * U);
  }

  function bigFlag(ctx, o, emblem) {
    plainBack(ctx, o.pal);
    const x = CW * 0.24;
    const top = CH * 0.12;
    stroke(ctx, () => {
      ctx.moveTo(x, CH * 0.95);
      ctx.lineTo(x, top - 6 * o.U);
    }, INK, 9 * o.U);
    stroke(ctx, () => {
      ctx.moveTo(x, CH * 0.95);
      ctx.lineTo(x, top - 6 * o.U);
    }, "#e8e4f0", 5.5 * o.U);
    paint(ctx, () => ctx.arc(x, top - 10 * o.U, 7 * o.U, 0, TAU), "#ffd84a", { ink: 2 * o.U });
    P.drawFlag(ctx, x, top, CW * 0.56, CH * 0.5, o.profile.flag, emblem, 1, 2.6 * o.U);
  }

  // ---------- card art ----------

  const ART = {
    aliens(ctx, o) {
      plainBack(ctx, o.pal);
      const colors = o.profile.alienColors;
      const n = colors.length;
      colors.forEach((name, i) => {
        const x = CW * ((i + 1) / (n + 1));
        blobAlien(ctx, x, CH * 0.8, CH * (n > 1 ? 0.16 : 0.2), ALIEN_PAINT[name] || "#ff6fae", o.U);
        bigText(ctx, G.METAS.word("alienColor", name), x, CH * 0.9, 24 * o.U, ALIEN_PAINT[name] || "#fff");
      });
    },
    sky(ctx, o) {
      const cam = o.kit.camera(CW, CH * 2, 0);
      o.kit.drawSky(ctx, cam, o.pal, o.profile, o.rng, o.U);
    },
    skyEvent(ctx, o) {
      const cam = o.kit.camera(CW, CH * 2, 0);
      o.kit.drawSky(ctx, cam, o.pal, o.profile, o.rng, o.U);
      o.kit.drawSkyEvent(ctx, cam, o.profile, o.rng, o.U * 1.2);
    },
    stars(ctx, o) {
      const night = { ...o.pal, sky0: { h: 250, s: 50, l: 18 }, sky1: { h: 262, s: 45, l: 30 }, glow: { h: 280, s: 40, l: 42 } };
      const cam = o.kit.camera(CW, CH * 2, 0);
      o.kit.drawSky(ctx, cam, night, o.profile, o.rng, o.U);
      o.kit.drawStars(ctx, { ...cam, y0: CH * 0.72 }, o.profile, o.rng, o.U * 1.4);
    },
    driving(ctx, o) {
      const cam = backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.42);
      roadQuad(ctx, cam, 3.2, 1.2, 140, "#6e6688");
      laneLine(ctx, cam, 0, 2, 140, "#fffaf2", true);
      const side = o.profile.drivingSide === "left" ? -1 : 1;
      const p = cam.p(side * 1.5, 8, 0);
      P.hoverCar(ctx, p.x, p.y, p.s, { h: 330, s: 75, l: 66 }, o.U, o.rng, null);
      const q = cam.p(-side * 1.5, 22, 0);
      P.hoverCar(ctx, q.x, q.y, q.s, { h: 200, s: 70, l: 64 }, o.U, o.rng, null);
      bigText(ctx, side < 0 ? "KEEP LEFT" : "KEEP RIGHT", CW * 0.5, CH * 0.14, 34 * o.U, "#ffe56b");
    },
    sun(ctx, o) {
      plainBack(ctx, o.pal);
      const cx = CW * 0.5;
      const cy = CH * 0.52;
      const R = CH * 0.34;
      paint(ctx, () => ctx.arc(cx, cy, R, 0, TAU), col(o.pal.ground, 6), { ink: 2.4 * o.U });
      stroke(ctx, () => {
        ctx.moveTo(cx, cy - R * 0.85);
        ctx.lineTo(cx, cy + R * 0.85);
        ctx.moveTo(cx - R * 0.85, cy);
        ctx.lineTo(cx + R * 0.85, cy);
      }, "rgba(27, 16, 51, 0.35)", 2 * o.U);
      bigText(ctx, "N", cx, cy - R - 16 * o.U, 26 * o.U, "#ff4f9a");
      bigText(ctx, "S", cx, cy + R + 16 * o.U, 22 * o.U, "#fffaf2");
      const south = o.profile.hemisphere !== "south";
      P.sun(ctx, cx, south ? cy + R * 0.55 : cy - R * 0.55, R * 0.26, o.U);
      blobAlien(ctx, cx, cy + R * 0.2, R * 0.16, "#b9a8ff", o.U);
    },
    species(ctx, o) {
      plainBack(ctx, o.pal);
      G.drawSpeciesCard(ctx, o.profile, CW, CH);
    },
    vegetation(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.7);
      const kind = o.profile.vegetation;
      const S = kind === "palm" ? CH / 13 : CH / 7.5;
      const vc = o.profile.vegetationColor;
      o.kit.metaPlant(ctx, CW * 0.36, CH * 0.95, S, kind, vc, o.pal, o.rng, o.U);
      o.kit.metaPlant(ctx, CW * 0.72, CH * 0.86, S * 0.7, kind, shade(vc, 8), o.pal, o.rng, o.U);
    },
    roof(ctx, o) {
      const cam = backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.5);
      ctx.save();
      ctx.translate(-CW * 0.24, 0);
      P.shack(ctx, cam, {
        xa: 1.2,
        side: 1,
        z0: 9,
        width: 5.2,
        depth: 4,
        height: 3,
        wall: o.kit.wallPalette(o.profile, o.rng, true),
        roof: o.profile.roofColor,
        roofShape: o.profile.roofShape,
        windowStyle: o.profile.windowStyle,
        glyphs: null,
        board: { h: 48, s: 60, l: 80 },
        awning: null,
        rand: o.rng,
      }, o.U);
      ctx.restore();
    },
    flag(ctx, o) {
      bigFlag(ctx, o, null);
    },
    sign(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.62);
      P.sign(ctx, flat(CW * 0.5, CH * 0.96, CH / 3.7), 0, 0, o.profile, o.U);
    },
    terrain(ctx, o) {
      const cam = backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.66);
      o.kit.drawLandmarks(ctx, cam, o.profile, o.pal, o.rng, o.U * 1.3);
    },
    fence(ctx, o) {
      const cam = backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.45);
      roadQuad(ctx, cam, 1.4, 1.5, 120, col(o.pal.dirt || o.pal.ground, -8));
      if (o.profile.fence !== "none") {
        P.fencePiece(ctx, cam, 2.4, 2.2, 40, o.profile, o.U);
        P.fencePiece(ctx, cam, -2.4, 2.2, 40, o.profile, o.U);
      }
    },
    soil(ctx, o) {
      const tint = G.METAS.SOIL_TINT[o.profile.soil];
      const ground = mixC(o.pal.ground, tint, 0.6);
      const g = ctx.createLinearGradient(0, 0, 0, CH);
      g.addColorStop(0, col(ground, 8));
      g.addColorStop(1, col(ground, -10));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
      const dry = o.profile.dryness;
      const tufts = dry === "lush" ? 70 : dry === "scrub" ? 26 : 6;
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = col(tint, (o.rng() - 0.5) * 20, 0, 0.35);
        ctx.beginPath();
        ctx.ellipse(o.rng() * CW, o.rng() * CH, 6 + o.rng() * 18, 3 + o.rng() * 6, 0, 0, TAU);
        ctx.fill();
      }
      if (dry === "dusty") {
        stroke(ctx, () => {
          for (let i = 0; i < 9; i++) {
            let x = o.rng() * CW;
            let y = o.rng() * CH;
            ctx.moveTo(x, y);
            for (let k = 0; k < 4; k++) {
              x += (o.rng() - 0.5) * 60;
              y += (o.rng() - 0.5) * 30;
              ctx.lineTo(x, y);
            }
          }
        }, col(ground, -30, 0, 0.7), 1.6 * o.U);
      }
      stroke(ctx, () => {
        for (let i = 0; i < tufts; i++) {
          const x = o.rng() * CW;
          const y = CH * 0.2 + o.rng() * CH * 0.8;
          const h = (8 + o.rng() * 14) * o.U * (y / CH + 0.3);
          for (let k = -1; k <= 1; k++) {
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + k * h * 0.2, y - h * 0.6, x + k * h * 0.45, y - h);
          }
        }
      }, col(o.profile.vegetationColor, -6), 1.8 * o.U);
      bigText(ctx, G.METAS.word("soil", o.profile.soil).toUpperCase(), CW * 0.5, CH * 0.5, 34 * o.U, "#fffaf2");
    },
    bollard(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.5);
      P.bollard(ctx, CW * 0.4, CH * 0.96, CH * 0.72, o.profile.bollard, o.U);
      P.bollard(ctx, CW * 0.72, CH * 0.8, CH * 0.38, o.profile.bollard, o.U);
    },
    chevron(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.5);
      P.chevron(ctx, CW * 0.36, CH * 0.97, CH * 0.46, o.profile.chevron, 1, o.U);
      P.chevron(ctx, CW * 0.7, CH * 0.82, CH * 0.3, o.profile.chevron, 1, o.U);
    },
    lines(ctx, o) {
      const cam = backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.36);
      roadQuad(ctx, cam, 3.1, 1.2, 160, "#6e6688");
      const L = G.metaColors.LINE;
      const pat = o.profile.linePattern;
      if (pat === "yellow") laneLine(ctx, cam, 0, 1.3, 160, L.yellow, false);
      else if (pat === "dashed") laneLine(ctx, cam, 0, 1.3, 160, L.dashed, true);
      else if (pat === "double") {
        laneLine(ctx, cam, -0.18, 1.3, 160, L.double, false);
        laneLine(ctx, cam, 0.18, 1.3, 160, L.double, false);
      }
      laneLine(ctx, cam, -2.9, 1.3, 160, "rgba(255, 250, 242, 0.85)", false);
      laneLine(ctx, cam, 2.9, 1.3, 160, "rgba(255, 250, 242, 0.85)", false);
    },
    plate(ctx, o) {
      plainBack(ctx, o.pal);
      const spec = o.kit.plateFor(o.profile, o.rng);
      P.plate(ctx, CW * 0.5, CH * 0.5, CW * 0.74, spec, o.U * 2);
    },
    probeCar(ctx, o) {
      const H3 = CH * 2.1;
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.55);
      ctx.save();
      ctx.translate(0, -(H3 - CH));
      P.probeCar(ctx, CW, H3, o.profile.probeCar, o.pal.sky1, H3 / 720);
      ctx.restore();
    },
    domain(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.6);
      P.billboard(ctx, CW * 0.5, CH * 0.98, CH * 0.245, { domain: `snax${o.profile.domain}`, word: "SNAX", bg: { h: 48, s: 90, l: 74 } }, o.U);
    },
    pole(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.6);
      const S = CH / 8.2;
      const view = flat(CW * 0.5, CH * 0.97, S);
      const a = P.pole(ctx, view, -3.6, 0, o.profile, o.U, true);
      const b = P.pole(ctx, view, 3.6, 0, o.profile, o.U, true);
      P.wires(ctx, [a, b], o.U * 1.6);
    },
    phone(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.6);
      P.billboard(ctx, CW * 0.5, CH * 0.98, CH * 0.245, { phone: `${o.profile.phoneDigit}?-???`, word: "CALL", bg: { h: 190, s: 80, l: 74 } }, o.U);
    },
    guardrail(ctx, o) {
      const cam = backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.45);
      roadQuad(ctx, cam, 2.2, 1.2, 140, "#6e6688");
      P.guardrail(ctx, cam, 2.7, 2.2, 60, o.profile.guardrail, o.U * 1.4);
    },
    kmMarker(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.5);
      P.kmMarker(ctx, CW * 0.42, CH * 0.97, CH * 0.68, o.profile.kmMarker, 42, o.U * 1.6);
      P.kmMarker(ctx, CW * 0.76, CH * 0.82, CH * 0.36, o.profile.kmMarker, 43, o.U);
    },
    curb(ctx, o) {
      const cam = backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.4);
      roadQuad(ctx, cam, 3.4, 1.2, 140, "#6e6688");
      const colors = G.metaColors.CURB[o.profile.curb];
      for (let i = 0; i < 40; i++) {
        const z0 = 1.2 + i * 1.4;
        const z1 = z0 + 1.4;
        [-1, 1].forEach((side) => {
          const x0 = side * 3.4;
          const x1 = side * 3.75;
          const pts = [cam.p(x0, z0, 0.18), cam.p(x1, z0, 0.18), cam.p(x1, z1, 0.18), cam.p(x0, z1, 0.18)];
          ctx.fillStyle = colors ? colors[i % 2] : "#c9c2d6";
          ctx.beginPath();
          pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.fill();
          const f = [cam.p(x0, z0, 0), cam.p(x0, z0, 0.18), cam.p(x0, z1, 0.18), cam.p(x0, z1, 0)];
          ctx.beginPath();
          f.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.fillStyle = colors ? colors[i % 2] : "#a79fb8";
          ctx.globalAlpha = 0.75;
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }
    },
    areaCode(ctx, o) {
      backdrop(ctx, o.kit, o.pal, o.profile, o.rng, o.U, 0.6);
      P.billboard(ctx, CW * 0.5, CH * 0.98, CH * 0.245, { phone: `${o.profile.areaCode}-555`, word: "ZORP", bg: { h: 300, s: 70, l: 78 } }, o.U);
    },
    plateLetter(ctx, o) {
      plainBack(ctx, o.pal);
      P.plate(ctx, CW * 0.5, CH * 0.5, CW * 0.74, { style: o.profile.plate, text: `${o.profile.plateLetter}·123` }, o.U * 2);
    },
    provinceFlag(ctx, o) {
      bigFlag(ctx, o, o.profile.provinceFlag);
    },
  };

  const HAS = {
    aliens: (p) => !!(p.alienColors && p.alienColors.length),
    skyEvent: (p) => !!p.skyEvent && p.skyEvent !== "none",
    driving: (p) => !!p.drivingSide,
    sun: (p) => !!p.hemisphere,
    flag: (p) => !!p.flag,
    soil: (p) => !!p.soil,
    bollard: (p) => !!p.bollard,
    chevron: (p) => !!p.chevron,
    lines: (p) => !!p.linePattern,
    plate: (p) => !!p.plate,
    probeCar: (p) => !!p.probeCar,
    domain: (p) => !!p.domain,
    pole: (p) => !!p.poleBody,
    phone: (p) => p.phoneDigit !== null && p.phoneDigit !== undefined,
    guardrail: (p) => !!p.guardrail,
    kmMarker: (p) => !!p.kmMarker,
    curb: (p) => !!p.curb,
    areaCode: (p) => !!p.areaCode,
    plateLetter: (p) => !!p.plateLetter && !!p.plate,
    provinceFlag: (p) => !!p.provinceFlag && !!p.flag,
  };

  function entriesFor(difficulty, level, profile) {
    return G.METAS.metasFor(difficulty, level).filter((entry) => ART[entry.key] && (!HAS[entry.key] || HAS[entry.key](profile)));
  }

  function drawCard(canvas, entry, info) {
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext("2d");
    const U = CH / 360;
    const rng = G.mulberry32(G.hashSeed(`${info.key}|guide|${entry.key}`));
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    G.wc.begin(Math.floor(rng() * 4294967296), U);
    try {
      ART[entry.key](ctx, { profile: info.profile, pal: info.pal, kit: G.sceneKit, rng, U, place: info.place });
    } finally {
      G.wc.end();
      ctx.restore();
    }
  }

  // ---------- overlay ----------

  const $ = (id) => document.getElementById(id);
  const state = { key: null, level: "continent", info: null, collapsed: false };

  function levelNote(level, difficulty, place) {
    if (level === "continent") {
      const base = `${place.continent.name} · ${place.continent.hemisphere === "south" ? "southern" : "northern"} hemisphere`;
      return difficulty === "easy" ? `${base}. Only one continent on Easy, so the sky and alien color change per country.` : base;
    }
    if (level === "country") return `${place.country.name} · phone digit, domain and road furniture belong to the country`;
    return `${place.province.name}, a province of ${place.country.name}`;
  }

  function renderCards() {
    const info = state.info;
    const list = $("guide-cards");
    list.replaceChildren();
    const entries = entriesFor(info.difficulty, state.level, info.profile);
    $("guide-note").textContent = levelNote(state.level, info.difficulty, info.place);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "guide-empty";
      empty.textContent = "No province metas on this difficulty. Play Hard to unlock area codes, plate letters and province flags.";
      list.appendChild(empty);
      return;
    }
    entries.forEach((entry) => {
      const card = document.createElement("figure");
      card.className = "guide-card";
      card.tabIndex = 0;
      const canvas = document.createElement("canvas");
      drawCard(canvas, entry, info);
      const caption = document.createElement("figcaption");
      const head = document.createElement("span");
      head.className = "guide-label";
      head.textContent = entry.label;
      const tier = document.createElement("span");
      tier.className = `guide-tier tier-${entry.tier}`;
      tier.textContent = TIER_NAMES[entry.tier];
      const text = document.createElement("strong");
      const said = G.METAS.describe(entry.key, info.profile, info.place);
      text.textContent = said.charAt(0).toUpperCase() + said.slice(1);
      caption.append(head, tier, text);
      card.append(canvas, caption);
      card.addEventListener("mouseenter", () => aimZoom(card, list));
      card.addEventListener("focus", () => aimZoom(card, list));
      list.appendChild(card);
    });
  }

  function aimZoom(card, list) {
    const box = list.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    const fx = (r.left + r.width / 2 - box.left) / box.width;
    const fy = (r.top + r.height / 2 - box.top) / box.height;
    const ox = fx < 0.34 ? "left" : fx > 0.66 ? "right" : "center";
    const oy = fy < 0.4 ? "top" : fy > 0.6 ? "bottom" : "center";
    card.style.transformOrigin = `${ox} ${oy}`;
  }

  function setLevel(level) {
    state.level = level;
    document.querySelectorAll(".guide-tab").forEach((tab) => {
      const on = tab.dataset.level === level;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    renderCards();
  }

  function open(match) {
    const round = G.currentRound(match);
    const key = `${G.photoKey(match)}|guide`;
    const fresh = state.key !== key;
    if (fresh) {
      let biome = G.biomeAt(match.planet.terrain, round.x, round.y);
      if (biome === "sea" || biome === "lake") biome = "beach";
      const profile = G.currentRegion(match).profile;
      state.key = key;
      state.collapsed = false;
      state.info = {
        key,
        profile,
        difficulty: match.difficulty,
        place: G.placeOfRegion(match.planet, round.regionId),
        pal: G.sceneKit.palette(profile, biome),
      };
      const place = state.info.place;
      $("guide-title").textContent = `${place.country.name} · ${place.province.name}`;
      document.querySelectorAll(".guide-tab").forEach((tab) => {
        const level = tab.dataset.level;
        tab.querySelector("small").textContent = place[level].name;
      });
      setLevel("continent");
    }
    $("field-guide").hidden = state.collapsed;
    $("guide-open").hidden = !state.collapsed;
  }

  function close() {
    $("field-guide").hidden = true;
    $("guide-open").hidden = true;
    state.key = null;
  }

  function collapse(value) {
    state.collapsed = value;
    $("field-guide").hidden = value;
    $("guide-open").hidden = !value;
  }

  function attach() {
    document.querySelectorAll(".guide-tab").forEach((tab) => {
      tab.addEventListener("click", () => setLevel(tab.dataset.level));
    });
    $("guide-close").addEventListener("click", () => collapse(true));
    $("guide-open").addEventListener("click", () => collapse(false));
  }

  G.guide = { open, close, attach, entriesFor, drawCard, ART };
})(window.ProbeDrop = window.ProbeDrop || {});
