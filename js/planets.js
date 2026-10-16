(function (G) {
  function mix(a, b, t) {
    const dh = ((((b.h - a.h) % 360) + 540) % 360) - 180;
    return {
      h: (a.h + dh * t + 360) % 360,
      s: a.s + (b.s - a.s) * t,
      l: a.l + (b.l - a.l) * t,
    };
  }

  const KITS = {
    candy: {
      id: "candy",
      name: "Candy Reach",
      blurb: "Pastel gumdrops",
      sky: [
        { h: 168, s: 42, l: 78 },
        { h: 78, s: 48, l: 76 },
        { h: 46, s: 62, l: 70 },
        { h: 28, s: 70, l: 66 },
      ],
      hillFar: { h: 150, s: 38, l: 74 },
      hillMid: { h: 142, s: 46, l: 64 },
      hillNear: { h: 132, s: 52, l: 54 },
      ground: { h: 118, s: 42, l: 62 },
      road: { h: 330, s: 28, l: 74 },
      wall: { h: 330, s: 48, l: 74 },
      shoulder: "walk",
      house: "round",
      tree: "lollipop",
      orb: "sun",
    },
    suburb: {
      id: "suburb",
      name: "Cul-de-Void",
      blurb: "Sickly suburb",
      sky: [
        { h: 78, s: 55, l: 78 },
        { h: 68, s: 48, l: 72 },
        { h: 58, s: 42, l: 66 },
        { h: 50, s: 38, l: 60 },
      ],
      hillFar: { h: 230, s: 28, l: 74 },
      hillMid: { h: 236, s: 32, l: 64 },
      hillNear: { h: 242, s: 36, l: 54 },
      ground: { h: 250, s: 28, l: 62 },
      road: { h: 230, s: 12, l: 46 },
      wall: { h: 210, s: 22, l: 72 },
      shoulder: "lawn",
      house: "siding",
      tree: "oak",
      orb: "none",
    },
    dust: {
      id: "dust",
      name: "Dust Orbit",
      blurb: "Rust and mesas",
      sky: [
        { h: 42, s: 70, l: 72 },
        { h: 32, s: 74, l: 64 },
        { h: 22, s: 72, l: 56 },
        { h: 14, s: 68, l: 48 },
      ],
      hillFar: { h: 28, s: 42, l: 68 },
      hillMid: { h: 22, s: 48, l: 56 },
      hillNear: { h: 16, s: 46, l: 44 },
      ground: { h: 32, s: 40, l: 62 },
      road: { h: 28, s: 30, l: 48 },
      wall: { h: 18, s: 36, l: 58 },
      shoulder: "dust",
      house: "rust",
      tree: "cactus",
      orb: "sun",
    },
    jelly: {
      id: "jelly",
      name: "Jelly Coast",
      blurb: "Soft shore",
      sky: [
        { h: 200, s: 48, l: 76 },
        { h: 214, s: 46, l: 70 },
        { h: 228, s: 42, l: 64 },
        { h: 250, s: 38, l: 58 },
      ],
      hillFar: { h: 190, s: 36, l: 72 },
      hillMid: { h: 200, s: 40, l: 62 },
      hillNear: { h: 210, s: 44, l: 50 },
      ground: { h: 186, s: 32, l: 64 },
      road: { h: 205, s: 18, l: 58 },
      wall: { h: 176, s: 42, l: 68 },
      shoulder: "pier",
      house: "blob",
      tree: "jelly",
      orb: "moon",
    },
  };

  const ORDER = ["candy", "suburb", "dust", "jelly"];

  function get(id) {
    const key = String(id || "");
    const n = Number(key);
    if (n >= 1 && n <= ORDER.length) return KITS[ORDER[n - 1]];
    return KITS[key] || KITS.candy;
  }

  function tintProfile(profile, kit) {
    if (!profile || !profile.skyGradient) return;
    profile.skyGradient = [
      mix(profile.skyGradient[0], kit.sky[0], 0.7),
      mix(profile.skyGradient[1], kit.sky[3], 0.7),
    ];
    profile.groundColor = mix(profile.groundColor, kit.ground, 0.72);
    profile.wallColor = mix(profile.wallColor, kit.wall, 0.78);
    profile.roofColor = mix(profile.roofColor, shadeHue(kit.wall, -14), 0.74);
    profile.vegetationColor = mix(profile.vegetationColor, kit.hillNear, 0.68);
    profile.pathColor = mix(profile.pathColor, kit.road, 0.62);
  }

  function shadeHue(c, dl) {
    return { h: c.h, s: c.s, l: Math.max(8, Math.min(92, c.l + dl)) };
  }

  function tint(planet) {
    const kit = planet.kit || KITS.candy;
    Object.keys(planet.countries || {}).forEach((id) => tintProfile(planet.countries[id].profile, kit));
    Object.keys(planet.regions || {}).forEach((id) => tintProfile(planet.regions[id].profile, kit));
  }

  function dailyId(now) {
    const date = now || new Date();
    const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const day = Math.floor(utc / 86400000);
    return ORDER[((day % ORDER.length) + ORDER.length) % ORDER.length];
  }

  G.PLANETS = { get, list: ORDER.map((id) => KITS[id]), tint, dailyId, ORDER };
})(window.ProbeDrop = window.ProbeDrop || {});
