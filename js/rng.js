(function (G) {
  function hashSeed(text) {
    let h1 = 1779033703;
    let h2 = 3144134277;
    let h3 = 1013904242;
    let h4 = 2773480762;
    for (let i = 0; i < text.length; i++) {
      const k = text.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    const first = ["violet", "crimson", "azure", "amber", "neon", "lunar", "coral", "ion", "prism", "nova", "velvet", "static"];
    const second = ["marsh", "ridge", "basin", "spire", "drift", "cinder", "bloom", "quartz", "harbor", "dune", "reef", "vault"];
    const buf = new Uint32Array(3);
    crypto.getRandomValues(buf);
    return `${first[buf[0] % first.length]}-${second[buf[1] % second.length]}-${(buf[2] % 900) + 100}`;
  }

  G.hashSeed = hashSeed;
  G.mulberry32 = mulberry32;
  G.randomSeed = randomSeed;
})(window.ProbeDrop = window.ProbeDrop || {});
