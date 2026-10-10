(function (G) {
  const $ = (id) => document.getElementById(id);
  let match = null;
  let difficulty = "easy";
  const photoCache = { key: "", canvas: null };

  const screens = {
    start: $("screen-start"),
    play: $("screen-play"),
  };

  function formatPoints(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  function difficultyHint(level) {
    if (level === "medium") return "Twelve regions. Pair the street stuff with the sky stuff.";
    if (level === "hard") return "Twenty regions. Neighbors share a sky. Read signs, poles, stars, and the locals' faces.";
    return "Six big regions. The sky, the locals, and the vibes give it away.";
  }

  function quip(points) {
    if (points >= 4990) return "Perfect. Are you... from here?";
    if (points >= 4500) return "Basically psychic. Suspicious.";
    if (points >= 3500) return "Solid. The locals are mildly impressed.";
    if (points >= 2000) return "Right continent. Probably.";
    if (points >= 800) return "Bold guess. Wrong, but bold.";
    return "Not even the same dimension, buddy.";
  }

  function titleCase(value) {
    const text = String(value).replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function show(name) {
    Object.keys(screens).forEach((key) => {
      screens[key].hidden = key !== name;
    });
  }

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height };
  }

  function selectedSeed() {
    const typed = $("seed-input").value.trim();
    return typed || G.randomSeed();
  }

  function sound(name) {
    try {
      if (!G.audio) return;
      G.audio.start();
      if (name) G.audio.sfx(name);
    } catch (error) {
      // audio is optional
    }
  }

  async function start(mode) {
    sound("beam");
    const seed = selectedSeed();
    $("seed-input").value = seed;
    $("loading-note").hidden = false;
    document.body.classList.add("is-loading");
    await G.assetsReady;
    await new Promise((resolve) => setTimeout(resolve, 30));
    match = G.createMatch(seed, difficulty, mode);
    G.buildAtlas(match.planet);
    G.mapView.reset(false);
    photoCache.key = "";
    $("loading-note").hidden = true;
    document.body.classList.remove("is-loading");
    show("play");
    requestAnimationFrame(() => requestAnimationFrame(draw));
  }

  function drawPhoto() {
    const photo = $("photo");
    const size = fitCanvas(photo);
    if (photo.getBoundingClientRect().width < 20) return false;
    const key = `${G.photoKey(match)}|${size.width}x${size.height}`;
    if (photoCache.key !== key) {
      const buffer = photoCache.canvas || document.createElement("canvas");
      buffer.width = size.width;
      buffer.height = size.height;
      const round = G.currentRound(match);
      G.drawScene(buffer.getContext("2d"), size.width, size.height, {
        planet: match.planet,
        location: round,
        profile: G.currentRegion(match).profile,
        rng: G.photoRng(match),
        difficulty: match.difficulty,
      });
      photoCache.canvas = buffer;
      photoCache.key = key;
    }
    const ctx = photo.getContext("2d");
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(photoCache.canvas, 0, 0);
    updatePhotoCompass(G.photoKey(match), G.currentRound(match).heading);
    return true;
  }

  const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const roseState = { key: null, rot: 0 };

  function updatePhotoCompass(key, heading) {
    if (roseState.key === key) return;
    const bearing = (((heading * 180) / Math.PI + 90) % 360 + 360) % 360;
    const target = -bearing;
    const delta = ((((target - roseState.rot) % 360) + 540) % 360) - 180;
    roseState.rot += roseState.key === null ? delta : delta + 360;
    roseState.key = key;
    $("rose-dial").style.transform = `rotate(${roseState.rot}deg)`;
    $("photo-compass-label").textContent = `Facing ${DIRECTIONS[Math.round(bearing / 45) % 8]}`;
  }

  function drawMapOnly() {
    const map = $("map");
    const mapSize = fitCanvas(map);
    if (map.getBoundingClientRect().width < 20) return;
    const revealed = match.phase === "revealed";
    G.drawMap(map.getContext("2d"), mapSize.width, mapSize.height, match.planet, {
      pin: match.pin,
      truth: revealed ? G.currentRound(match) : null,
    });
  }

  function draw() {
    if (!match || screens.play.hidden) return;
    updateHud();
    if (!drawPhoto()) {
      requestAnimationFrame(draw);
      return;
    }
    drawMapOnly();
  }

  function bump(id, text) {
    const node = $(id);
    if (node.textContent === text) return;
    node.textContent = text;
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
  }

  function updateHud() {
    const study = match.mode === "study";
    const played = match.roundScores.length;
    $("mode-label").textContent = study ? "Study" : "Endless";
    $("round-label").textContent = String(match.roundIndex + 1);
    bump("score-label", formatPoints(match.totalScore));
    $("avg-label").textContent = played ? formatPoints(G.averageScore(match)) : "-";
    $("best-label").textContent = played ? formatPoints(match.bestRound) : "-";
    $("seed-label").textContent = match.seed;
    $("difficulty-pill").textContent = titleCase(match.difficulty);
    const revealed = match.phase === "revealed";
    $("map-bar").hidden = revealed;
    $("result-banner").hidden = !revealed;
    $("confirm-btn").disabled = !match.pin;
    $("map-hint").textContent = revealed
      ? "Pink is you, blue is the truth"
      : match.pin ? "Click again to move the probe" : "Click to drop · scroll to zoom · drag to pan";

    const tag = $("place-tag");
    tag.hidden = !revealed;
    if (match.lastResult) {
      $("result-quip").textContent = quip(match.lastResult.points);
      $("round-points").textContent = formatPoints(match.lastResult.points);
      $("distance-label").textContent = `${Math.round(match.lastResult.dist)} units off`;
      const round = G.currentRound(match);
      const place = G.settlementAt(match.planet, round.x, round.y);
      const where = place.kind === "wild"
        ? `Somewhere outside ${place.town ? place.town.name : "civilization"}`
        : `${place.kind === "city" ? "Downtown" : place.town.kind === "city" ? "Outskirts of" : "Village of"} ${place.town.name}`;
      tag.textContent = `${where} · Region ${round.regionId + 1}`;
    }

    const showClues = study && revealed;
    $("clue-panel").hidden = !showClues;
    if (showClues) renderClues(G.currentRegion(match).profile);
  }

  function renderClues(profile) {
    const alienNames = { blue: "Blue", pink: "Pink", mixed: "Blue and pink" };
    const poleNames = { ball: "Ball top", ring: "Ring top", fork: "Fork top", none: "Plain pole" };
    const eventNames = {
      ring: "Ringed oddity",
      eye: "Eye world",
      jelly: "Jelly moon",
      shard: "Shattered planet",
      spiral: "Spiral sky",
      worm: "Sky serpent",
    };
    const plantNames = {
      mushroom: "Giant mushrooms",
      palm: "Space palms",
      tentacle: "Tentacle vines",
      crystal: "Crystal clusters",
      eyestalk: "Eyestalks",
      bulb: "Glow bulbs",
      spiralfern: "Spiral ferns",
      balloon: "Balloon pods",
    };
    const species = profile.alienSpecies;
    const eyeNames = { 1: "one eye", 2: "two eyes", 3: "three eyes" };
    const detail = species.detail === "none" ? "bald" : titleCase(species.detail).toLowerCase();
    const groups = [
      ["Locals", [
        ["Colors", `${alienNames[profile.alienMix]}, ${profile.alienHeight}`, null],
      ]],
      ["Sky", [
        ["Sky", "Two-tone", profile.skyGradient],
        ["Stars", titleCase(profile.starPattern), null],
        ["Sky event", eventNames[profile.skyEvent] || titleCase(profile.skyEvent), null],
        ["Weather", titleCase(profile.weather), null],
      ]],
      ["Land", [
        ["Rocks", titleCase(profile.terrain), null],
        ["Grass", "Ground color", profile.groundColor],
        ["Soil pattern", titleCase(profile.groundPattern), null],
        ["Plants", plantNames[profile.vegetation] || titleCase(profile.vegetation), profile.vegetationColor],
      ]],
      ["Street", [
        ["Road", titleCase(profile.pathStyle), profile.pathLineColor],
        ["Driving side", titleCase(profile.drivingSide), null],
        ["Fence", titleCase(profile.fence), profile.poleColor],
        ["Decor", titleCase(profile.banner), profile.accentColor],
      ]],
      ["Built", [
        ["Roof", titleCase(profile.roofShape), profile.roofColor],
        ["Walls", "Wall paint", profile.wallColor],
        ["Windows", titleCase(profile.windowStyle), null],
        ["Pole", poleNames[profile.poleTop], profile.poleColor],
        ["Sign", titleCase(profile.signShape), profile.accentColor],
        ["Glyph", `Symbol ${profile.signGlyph + 1}`, "glyph"],
      ]],
    ];

    const list = $("clue-list");
    list.replaceChildren();
    groups.forEach(([title, rows]) => {
      const group = document.createElement("section");
      group.className = "clue-group";
      const heading = document.createElement("h3");
      heading.textContent = title;
      const grid = document.createElement("div");
      grid.className = "clue-rows";
      if (title === "Locals") {
        const text = G.describeSpecies ? G.describeSpecies(species) : `Body ${species.body}, ${eyeNames[species.eyes]}, ${detail}`;
        grid.appendChild(speciesCard(profile, text));
      }
      rows.forEach((row) => grid.appendChild(clueRow(profile, row)));
      group.append(heading, grid);
      list.appendChild(group);
    });
  }

  function speciesCard(profile, text) {
    const card = document.createElement("div");
    card.className = "species-card";
    const canvas = document.createElement("canvas");
    canvas.width = 1040;
    canvas.height = 600;
    G.drawSpeciesCard(canvas.getContext("2d"), profile, canvas.width, canvas.height);
    const caption = document.createElement("div");
    caption.className = "species-caption";
    const name = document.createElement("span");
    name.textContent = "Species";
    const value = document.createElement("strong");
    value.textContent = text;
    caption.append(name, value);
    card.append(canvas, caption);
    return card;
  }

  function clueRow(profile, [label, text, color]) {
    const row = document.createElement("div");
    row.className = "clue";
    if (color === "glyph") {
      const canvas = document.createElement("canvas");
      canvas.className = "glyph-swatch";
      canvas.width = 72;
      canvas.height = 72;
      row.appendChild(canvas);
      const ink = profile.accentColor.l > 62 ? "#1a1024" : "#f7f4ff";
      canvas.style.background = G.cssColor(profile.accentColor);
      G.drawGlyph(canvas.getContext("2d"), profile.signGlyph, 36, 36, 46, ink);
    } else if (Array.isArray(color)) {
      const swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.background = `linear-gradient(${G.cssColor(color[0])}, ${G.cssColor(color[1])})`;
      row.appendChild(swatch);
    } else if (color) {
      const swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.background = G.cssColor(color);
      row.appendChild(swatch);
    }
    const copy = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = label;
    const value = document.createElement("strong");
    value.textContent = text;
    copy.append(name, value);
    row.appendChild(copy);
    return row;
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    button.classList.add("copied");
    setTimeout(() => button.classList.remove("copied"), 1200);
  }

  function lockIn() {
    if (!match || !match.pin || match.phase !== "guessing") return;
    G.submitGuess(match);
    const points = match.lastResult.points;
    sound(points >= 3500 ? "great" : points < 1200 ? "meh" : "lock");
    updateHud();
    G.mapView.fit([match.pin, G.currentRound(match)]);
    spinCompass();
  }

  function spinCompass() {
    const compass = $("compass");
    if (!compass) return;
    compass.classList.remove("is-spinning");
    void compass.getBoundingClientRect();
    compass.classList.add("is-spinning");
    clearTimeout(spinCompass.timer);
    spinCompass.timer = setTimeout(() => compass.classList.remove("is-spinning"), 1400);
  }

  function next() {
    if (!match || match.phase !== "revealed") return;
    G.advance(match);
    sound("beam");
    G.mapView.reset(false);
    draw();
  }

  document.querySelectorAll(".diff").forEach((button) => {
    button.addEventListener("click", () => {
      difficulty = button.dataset.difficulty;
      document.querySelectorAll(".diff").forEach((item) => {
        item.classList.toggle("is-selected", item === button);
      });
      $("diff-hint").textContent = difficultyHint(difficulty);
    });
  });

  $("play-btn").addEventListener("click", () => start("play"));
  $("study-btn").addEventListener("click", () => start("study"));
  $("confirm-btn").addEventListener("click", lockIn);
  $("next-btn").addEventListener("click", next);
  $("back-btn").addEventListener("click", () => {
    $("seed-input").value = match.seed;
    show("start");
  });
  $("copy-seed").addEventListener("click", () => copyText(match.seed, $("copy-seed")));
  G.mapView.attach($("map"), {
    redraw: () => {
      if (match && !screens.play.hidden) drawMapOnly();
    },
    onPin: (point) => {
      if (!match || match.phase !== "guessing") return;
      match.pin = point;
      sound("drop");
      updateHud();
      drawMapOnly();
    },
  });
  $("zoom-in").addEventListener("click", () => G.mapView.zoomBy(1.6));
  $("zoom-out").addEventListener("click", () => G.mapView.zoomBy(1 / 1.6));
  $("zoom-reset").addEventListener("click", () => G.mapView.reset(true));

  $("seed-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") start("play");
  });

  document.addEventListener("keydown", (event) => {
    if (!match || screens.play.hidden) return;
    if (event.target === $("seed-input")) return;
    if (event.key === "+" || event.key === "=") G.mapView.zoomBy(1.6);
    else if (event.key === "-" || event.key === "_") G.mapView.zoomBy(1 / 1.6);
    else if (event.key === "0") G.mapView.reset(true);
    if (event.key === "Enter" || event.key === " ") {
      if (match.phase === "guessing" && match.pin) {
        event.preventDefault();
        lockIn();
      } else if (match.phase === "revealed") {
        event.preventDefault();
        next();
      }
    }
  });

  document.addEventListener("mousemove", (event) => {
    if (screens.start.hidden) return;
    document.querySelectorAll(".mascot .eye").forEach((eye) => {
      const rect = eye.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, len / 160) * rect.width * 0.22;
      eye.firstElementChild.style.transform = `translate(${(dx / len) * reach}px, ${(dy / len) * reach}px)`;
    });
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 80);
  });
})(window.AlienGuessr);
