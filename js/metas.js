(function (G) {
  const TIERS = { easy: 0, medium: 1, hard: 2 };

  const POOLS = {
    alienColor: ["yellow", "green", "blue", "pink"],
    hemisphere: ["north", "south"],
    soil: ["red", "ochre", "gray", "violet"],
    dryness: ["lush", "scrub", "dusty"],
    bollard: ["pill", "cap", "square", "jelly"],
    reflector: ["red", "yellow", "white", "cyan"],
    chevron: ["redwhite", "yellowblack", "bluewhite", "pinkgreen"],
    linePattern: ["yellow", "dashed", "double", "none"],
    plate: ["blueband", "yellow", "white", "black", "green"],
    antenna: ["snorkel", "dish", "whip", "ball"],
    tape: ["black", "orange", "cyan", "none"],
    poleBody: ["holes", "wood", "lattice", "tube", "crossbar"],
    insulators: [1, 2, 3, 4],
    guardrail: ["wbeam", "cable", "logs", "tubes"],
    kmMarker: ["slab", "stripe", "round", "tall"],
    curb: ["redwhite", "yellow", "blackwhite", "none"],
    flagLayout: ["stripesH", "stripesV", "dot", "cross", "diagonal", "triangle"],
    emblem: ["star", "moon", "eye", "blob", "zig"],
  };

  const FLAG_COLORS = ["#ff4f9a", "#5ff2ff", "#ffe56b", "#7cf27c", "#a970ff", "#ff8a3d", "#ffffff", "#1b1033", "#3d6fdc", "#e0313a"];

  const SOIL_TINT = {
    red: { h: 12, s: 62, l: 50 },
    ochre: { h: 40, s: 66, l: 58 },
    gray: { h: 230, s: 10, l: 58 },
    violet: { h: 282, s: 38, l: 54 },
  };

  const WORDS = {
    alienColor: { yellow: "Yellow", green: "Green", blue: "Blue", pink: "Pink" },
    hemisphere: { north: "North (sun to the south)", south: "South (sun to the north)" },
    soil: { red: "Red clay", ochre: "Ochre sand", gray: "Gray ash", violet: "Violet dust" },
    dryness: { lush: "Lush", scrub: "Scrubby", dusty: "Dusty and dry" },
    bollard: { pill: "Pill", cap: "Mushroom cap", square: "Square post", jelly: "Jelly bean" },
    reflector: { red: "red", yellow: "yellow", white: "white", cyan: "cyan" },
    chevron: { redwhite: "Red and white", yellowblack: "Yellow and black", bluewhite: "Blue and white", pinkgreen: "Pink and green" },
    linePattern: { yellow: "Solid yellow center", dashed: "White dashes", double: "Double line", none: "No center line" },
    plate: { blueband: "White, blue band", yellow: "Yellow", white: "Plain white", black: "Black", green: "Green" },
    antenna: { snorkel: "snorkel", dish: "dish", whip: "whip antenna", ball: "ball antenna" },
    tape: { black: "black tape", orange: "orange tape", cyan: "cyan tape", none: "no tape" },
    poleBody: { holes: "Concrete with holes", wood: "Wooden", lattice: "Lattice", tube: "Smooth tube", crossbar: "Crossbar" },
    guardrail: { wbeam: "Steel W-beam", cable: "Cable", logs: "Log rail", tubes: "Twin tubes" },
    kmMarker: { slab: "Short slab", stripe: "Striped post", round: "Round-top stone", tall: "Tall plate" },
    curb: { redwhite: "Red and white", yellow: "Yellow", blackwhite: "Black and white", none: "Bare" },
    vegetation: {
      mushroom: "Giant mushrooms",
      palm: "Space palms",
      tentacle: "Tentacle vines",
      crystal: "Crystal clusters",
      eyestalk: "Eyestalks",
      bulb: "Glow bulbs",
      spiralfern: "Spiral ferns",
      balloon: "Balloon pods",
    },
    skyEvent: {
      ring: "A ringed planet",
      eye: "A giant eye",
      jelly: "A jelly moon",
      shard: "A shattered planet",
      spiral: "A spiral galaxy",
      worm: "A sky serpent",
    },
  };

  const LEVELS = ["continent", "country", "province"];

  const CATALOG = [
    { key: "aliens", level: "continent", tier: "easy", feature: "aliens", label: "Alien color" },
    { key: "sky", level: "continent", tier: "easy", feature: null, label: "Sky tint" },
    { key: "skyEvent", level: "continent", tier: "easy", feature: "skyEvent", label: "Sky thing" },
    { key: "driving", level: "continent", tier: "medium", feature: null, label: "Driving side" },
    { key: "sun", level: "continent", tier: "medium", feature: null, label: "Sun side" },
    { key: "species", level: "country", tier: "easy", feature: "aliens", label: "Locals" },
    { key: "vegetation", level: "country", tier: "easy", feature: "vegetation", label: "Plants" },
    { key: "roof", level: "country", tier: "easy", feature: "building", label: "Roofs" },
    { key: "flag", level: "country", tier: "easy", feature: "banner", label: "Flag" },
    { key: "sign", level: "country", tier: "easy", feature: "sign", label: "Road sign" },
    { key: "terrain", level: "country", tier: "easy", feature: "landmark", label: "Landforms" },
    { key: "stars", level: "country", tier: "medium", feature: "stars", label: "Stars" },
    { key: "fence", level: "country", tier: "medium", feature: "fence", label: "Fences" },
    { key: "soil", level: "country", tier: "medium", feature: null, label: "Soil" },
    { key: "bollard", level: "country", tier: "medium", feature: "bollard", label: "Bollards" },
    { key: "chevron", level: "country", tier: "medium", feature: "chevron", label: "Chevrons" },
    { key: "lines", level: "country", tier: "medium", feature: null, label: "Road lines" },
    { key: "plate", level: "country", tier: "medium", feature: "plate", label: "Hovercar plates" },
    { key: "probeCar", level: "country", tier: "medium", feature: "probeCar", label: "Probe car" },
    { key: "domain", level: "country", tier: "medium", feature: "billboard", label: "Web domain" },
    { key: "pole", level: "country", tier: "hard", feature: "pole", label: "Poles" },
    { key: "phone", level: "country", tier: "hard", feature: "billboard", label: "Phone digit" },
    { key: "guardrail", level: "country", tier: "hard", feature: "guardrail", label: "Guardrails" },
    { key: "kmMarker", level: "country", tier: "hard", feature: "kmMarker", label: "Km markers" },
    { key: "curb", level: "country", tier: "hard", feature: "curb", label: "Curb paint" },
    { key: "areaCode", level: "province", tier: "hard", feature: "billboard", label: "Area code" },
    { key: "plateLetter", level: "province", tier: "hard", feature: "plate", label: "Plate letter" },
    { key: "provinceFlag", level: "province", tier: "hard", feature: "banner", label: "Province flag" },
  ];

  const FEATURE_CHANCE = {
    skyEvent: 0.34, stars: 0.3, building: 0.38, vegetation: 0.38, aliens: 0.4, fence: 0.3, banner: 0.66,
    sign: 0.68, pole: 0.7, groundPattern: 0.3, weather: 0.3, landmark: 0.32,
    bollard: 0.42, chevron: 0.34, guardrail: 0.3, kmMarker: 0.34, curb: 0.4, billboard: 0.42, plate: 0.36, probeCar: 0.45,
  };

  function tierOf(difficulty) {
    return TIERS[difficulty] === undefined ? 0 : TIERS[difficulty];
  }

  function enabled(entry, difficulty) {
    return TIERS[entry.tier] <= tierOf(difficulty);
  }

  function metasFor(difficulty, level) {
    return CATALOG.filter((entry) => enabled(entry, difficulty) && (!level || entry.level === level));
  }

  function featureTier(feature) {
    let best = 9;
    CATALOG.forEach((entry) => {
      if (entry.feature === feature) best = Math.min(best, TIERS[entry.tier]);
    });
    return best === 9 ? 0 : best;
  }

  // ---------- names ----------

  const ONSET = ["Bl", "Sn", "Gl", "Z", "Fl", "Kr", "Pl", "Qu", "Wh", "Gr", "Sk", "Br", "Dr", "Tw", "Zw", "Sl", "Vr", "Ch", "M", "N", "P", "B", "Fr", "Sp"];
  const CORE = ["or", "ub", "ee", "oo", "ax", "im", "op", "um", "iz", "eb", "oz", "ar", "il", "ug", "en", "af"];
  const LINK = ["", "b", "n", "l", "r", "z", "v", "m"];
  const COUNTRY_END = ["ania", "via", "land", "stan", "onia", "ia", "ovia", "istan", "aria", "onesia", "ador", "ique"];
  const CONTINENT_END = ["ica", "asia", "opa", "andia", "antis", "oria", "urnia", "ezia"];
  const SHORT_END = ["p", "zz", "b", "nk", "x", "m", "t", "rp", "sh", "g", "ck", "ff"];
  const SHORT_VOWEL = ["i", "o", "u", "a", "oo", "ee"];

  function pick(rand, list) {
    return list[Math.floor(rand() * list.length)];
  }

  function makeNamer(rand) {
    const used = new Set();
    function unique(build) {
      for (let i = 0; i < 60; i++) {
        const name = build();
        if (!used.has(name) && name.length <= 11) {
          used.add(name);
          return name;
        }
      }
      const name = `${build()}${used.size}`;
      used.add(name);
      return name;
    }
    return {
      continent: () => unique(() => `${pick(rand, ONSET)}${pick(rand, CORE)}${pick(rand, CONTINENT_END)}`),
      country: () => unique(() => {
        const core = pick(rand, CORE);
        const end = pick(rand, COUNTRY_END);
        const link = /[aeiou]$/.test(core) && /^[aeiou]/.test(end) ? pick(rand, LINK.slice(1)) : "";
        return `${pick(rand, ONSET)}${core}${link}${end}`;
      }),
      province: () => unique(() => `${pick(rand, ONSET)}${pick(rand, SHORT_VOWEL)}${pick(rand, SHORT_END)}`),
    };
  }

  function domainFor(name, used) {
    const letters = name.toLowerCase().replace(/[^a-z]/g, "");
    const consonants = letters.slice(1).replace(/[aeiou]/g, "");
    const options = [];
    for (let i = 0; i < consonants.length; i++) {
      for (let j = i + 1; j < consonants.length; j++) options.push(`${letters[0]}${consonants[i]}${consonants[j]}`);
    }
    for (let i = 1; i < letters.length; i++) options.push(`${letters[0]}${letters[i]}`);
    const found = options.find((d) => !used.has(d)) || `${letters.slice(0, 2)}${used.size}`;
    used.add(found);
    return `.${found}`;
  }

  // ---------- words ----------

  function word(pool, value) {
    return (WORDS[pool] && WORDS[pool][value]) || String(value);
  }

  const HUES = [[15, "red"], [40, "orange"], [65, "yellow"], [160, "green"], [195, "teal"], [250, "blue"], [290, "violet"], [335, "pink"], [360, "red"]];

  function hueName(color) {
    if (color.s < 18) return color.l > 60 ? "pale gray" : "gray";
    const h = ((color.h % 360) + 360) % 360;
    return HUES.find(([limit]) => h < limit)[1];
  }

  function describe(key, profile, place) {
    const p = profile;
    switch (key) {
      case "aliens":
        return p.alienColors.map((c) => word("alienColor", c)).join(" + ");
      case "sky": {
        const [top, low] = p.skyGradient.map(hueName);
        return top === low ? `${top} sky all the way down` : `${top} on top, ${low} near the horizon`;
      }
      case "skyEvent":
        return `${word("skyEvent", p.skyEvent)} in the sky`;
      case "driving":
        return `Hovercars keep ${p.drivingSide}`;
      case "sun":
        return word("hemisphere", p.hemisphere);
      case "species":
        return G.describeSpecies ? G.describeSpecies(p.alienSpecies) : "Locals";
      case "vegetation":
        return word("vegetation", p.vegetation);
      case "roof":
        return `${p.roofShape} roofs, ${p.windowStyle} windows`;
      case "flag":
        return "Flags and bunting in these colors";
      case "sign":
        return `${p.signShape} signs`;
      case "terrain":
        return `${p.terrain} landforms`;
      case "stars":
        return `${p.starPattern} star pattern`;
      case "fence":
        return p.fence === "none" ? "No fences" : `${p.fence} fences`;
      case "soil":
        return `${word("soil", p.soil)}, ${word("dryness", p.dryness).toLowerCase()}`;
      case "bollard":
        return `${word("bollard", p.bollard.shape)}, ${word("reflector", p.bollard.reflector)} reflector`;
      case "chevron":
        return word("chevron", p.chevron);
      case "lines":
        return word("linePattern", p.linePattern);
      case "plate":
        return word("plate", p.plate);
      case "probeCar":
        return `${word("antenna", p.probeCar.antenna)}, ${word("tape", p.probeCar.tape)}`;
      case "domain":
        if (p.domainScope === "continent") return `${p.domain} on every country of this continent`;
        if (p.domainScope === "pair") return `${p.domain}, shared with one other country`;
        return p.domain;
      case "pole":
        return `${word("poleBody", p.poleBody)}, ${p.insulators} insulator${p.insulators === 1 ? "" : "s"}`;
      case "phone":
        return `Numbers start with ${p.phoneDigit}`;
      case "guardrail":
        return word("guardrail", p.guardrail);
      case "kmMarker":
        return word("kmMarker", p.kmMarker);
      case "curb":
        return word("curb", p.curb);
      case "areaCode":
        return `Area code ${p.areaCode}`;
      case "plateLetter":
        return `Plates start with ${p.plateLetter}`;
      case "provinceFlag":
        return `${place && place.province ? place.province.name : "Province"} flag`;
      default:
        return "";
    }
  }

  function fingerprint(key, profile) {
    const p = profile || {};
    switch (key) {
      case "aliens":
        return (p.alienColors || []).slice().sort().join("+");
      case "sky":
        return (p.skyGradient || []).map((c) => `${Math.round(c.h)}/${Math.round(c.s)}/${Math.round(c.l)}`).join(" ");
      case "skyEvent":
        return p.skyEvent || "";
      case "driving":
        return p.drivingSide || "";
      case "sun":
        return p.hemisphere || "";
      case "species": {
        const s = p.alienSpecies || {};
        return `${s.body}|${s.arm}|${s.leg}|${s.detail}|${s.eye}|${s.eyes}|${s.mouth}|${p.alienHeight}`;
      }
      case "vegetation":
        return p.vegetation || "";
      case "roof":
        return `${p.roofShape}|${p.windowStyle}|${p.roofColor ? Math.round(p.roofColor.h) : ""}`;
      case "flag":
        return p.flag ? `${p.flag.layout}|${p.flag.colors.join(",")}` : "";
      case "sign":
        return `${p.signShape}|${p.signGlyph}`;
      case "terrain":
        return p.terrain || "";
      case "stars":
        return p.starPattern || "";
      case "fence":
        return p.fence || "";
      case "soil":
        return p.soil ? `${p.soil}|${p.dryness}` : "";
      case "bollard":
        return p.bollard ? `${p.bollard.shape}|${p.bollard.reflector}` : "";
      case "chevron":
        return p.chevron || "";
      case "lines":
        return p.linePattern || "";
      case "plate":
        return p.plate || "";
      case "probeCar":
        return p.probeCar ? `${p.probeCar.antenna}|${p.probeCar.tape}` : "";
      case "domain":
        return p.domainScope === "country" ? (p.domain || "") : "";
      case "pole":
        return p.poleBody ? `${p.poleBody}|${p.insulators}` : "";
      case "phone":
        return p.phoneDigit === null || p.phoneDigit === undefined ? "" : String(p.phoneDigit);
      case "guardrail":
        return p.guardrail || "";
      case "kmMarker":
        return p.kmMarker || "";
      case "curb":
        return p.curb || "";
      case "areaCode":
        return p.areaCode ? String(p.areaCode) : "";
      case "plateLetter":
        return p.plateLetter || "";
      case "provinceFlag":
        return p.provinceFlag ? `${p.provinceFlag.emblem}|${p.provinceFlag.color}` : "";
      default:
        return "";
    }
  }

  function tell(planet, truth, guess) {
    if (!truth || !truth.province || !truth.province.profile) return "";
    const wrongCountry = !guess || guess.sea || !guess.country || guess.country.id !== truth.country.id;
    const wrongProvince = !wrongCountry && guess.province.id !== truth.province.id;
    if (!wrongCountry && !wrongProvince) return "";
    const profile = truth.province.profile;
    const entries = CATALOG.filter((entry) => enabled(entry, profile.difficulty) && (wrongCountry ? entry.level !== "province" : entry.level === "province"));
    const units = wrongCountry
      ? planet.countries.map((country) => ({ name: country.name, profile: country.profile }))
      : truth.country.provinceIds.map((id) => {
        const province = planet.regions[id];
        return { name: province.name, profile: province.profile };
      });
    const ranked = [];
    entries.forEach((entry) => {
      const value = fingerprint(entry.key, profile);
      if (!value) return;
      const names = [];
      units.forEach((unit) => {
        if (fingerprint(entry.key, unit.profile) === value && names.indexOf(unit.name) < 0) names.push(unit.name);
      });
      if (names.length === 1 || names.length === 2) ranked.push({ entry, names, tier: TIERS[entry.tier] });
    });
    if (!ranked.length) return "";
    const fewest = ranked.reduce((best, row) => Math.min(best, row.names.length), 2);
    const atFewest = ranked.filter((row) => row.names.length === fewest);
    const hardest = atFewest.reduce((best, row) => Math.max(best, row.tier), 0);
    const options = atFewest.filter((row) => row.tier === hardest);
    const rng = G.mulberry32(G.hashSeed(`${planet.seed}|tell|${truth.province.id}|${wrongCountry ? "c" : "p"}`));
    const picked = options[Math.floor(rng() * options.length)];
    const said = describe(picked.entry.key, profile, truth);
    const line = said.charAt(0).toUpperCase() + said.slice(1);
    const where = picked.names.length === 1
      ? `only in ${picked.names[0]}`
      : `in ${picked.names[0]} and ${picked.names[1]}`;
    return `${line} — ${where}.`;
  }

  G.METAS = {
    TIERS,
    POOLS,
    WORDS,
    LEVELS,
    CATALOG,
    FLAG_COLORS,
    SOIL_TINT,
    FEATURE_CHANCE,
    tierOf,
    enabled,
    metasFor,
    featureTier,
    makeNamer,
    domainFor,
    describe,
    word,
    hueName,
    tell,
  };
})(window.ProbeDrop = window.ProbeDrop || {});
