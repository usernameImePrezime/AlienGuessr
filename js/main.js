(function (G) {
  const $ = (id) => document.getElementById(id);
  let match = null;
  let difficulty = "easy";

  const screens = {
    start: $("screen-start"),
    play: $("screen-play"),
    results: $("screen-results"),
  };

  function formatPoints(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  function difficultyHint(level) {
    if (level === "medium") return "Twelve regions. Pair the street with the sky.";
    if (level === "hard") return "Twenty regions. Neighbors share a sky. Read the sign, the stars, and the path.";
    return "Six big regions. The sky, the aliens, and the horizon give it away.";
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
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

  function start(mode) {
    const seed = selectedSeed();
    $("seed-input").value = seed;
    match = G.createMatch(seed, difficulty, mode);
    show("play");
    requestAnimationFrame(() => requestAnimationFrame(draw));
  }

  function draw() {
    if (!match || screens.play.hidden) return;
    updateHud();
    const photo = $("photo");
    const size = fitCanvas(photo);
    if (photo.getBoundingClientRect().width < 20) {
      requestAnimationFrame(draw);
      return;
    }
    const region = G.currentRegion(match);
    G.drawScene(photo.getContext("2d"), size.width, size.height, region.profile, G.photoRng(match), match.difficulty);

    const map = $("map");
    const mapSize = fitCanvas(map);
    if (map.getBoundingClientRect().width < 20) return;
    const revealed = match.phase === "revealed";
    G.drawMap(map.getContext("2d"), mapSize.width, mapSize.height, match.planet, {
      pin: match.pin,
      truth: revealed ? G.currentRound(match) : null,
    });
  }

  function updateHud() {
    const study = match.mode === "study";
    $("mode-label").textContent = study ? "Study" : "Match";
    $("round-label").textContent = study
      ? `Location ${match.roundIndex + 1}`
      : `Round ${match.roundIndex + 1}/5`;
    $("seed-label").textContent = match.seed;
    $("score-label").textContent = formatPoints(match.totalScore);
    $("difficulty-pill").textContent = titleCase(match.difficulty);
    $("map-bar").hidden = match.phase !== "guessing";
    $("result-banner").hidden = match.phase !== "revealed";
    $("confirm-btn").disabled = !match.pin;
    $("map-hint").hidden = match.phase !== "guessing";
    $("map-hint").textContent = match.pin
      ? "Click again to move the pin, then lock it in."
      : "Click the map to place your pin.";

    if (match.lastResult) {
      $("round-points").textContent = `${formatPoints(match.lastResult.points)} points this round · ${formatPoints(match.lastResult.total)} total`;
      $("distance-label").textContent = `${Math.round(match.lastResult.dist)} units away`;
      $("next-btn").textContent = study
        ? "Next location"
        : match.roundIndex >= 4
          ? "See results"
          : "Next round";
    }

    const showClues = study && match.phase === "revealed";
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
      spiral: "Spiral mass",
      worm: "Sky serpent",
    };
    const eyeNames = { 1: "one eye", 2: "two eyes", 3: "three eyes" };
    const groups = [
      ["Sky", [
        ["Sky", "Two-tone", profile.skyGradient],
        ["Stars", titleCase(profile.starPattern), null],
        ["Sky event", eventNames[profile.skyEvent] || titleCase(profile.skyEvent), null],
        ["Weather", titleCase(profile.weather), null],
      ]],
      ["Land", [
        ["Horizon", titleCase(profile.terrain), null],
        ["Soil", "Ground color", profile.groundColor],
        ["Soil pattern", titleCase(profile.groundPattern), null],
        ["Vegetation", titleCase(profile.vegetation), profile.vegetationColor],
      ]],
      ["Street", [
        ["Path", titleCase(profile.pathStyle), profile.pathLineColor],
        ["Side", titleCase(profile.drivingSide), null],
        ["Fence", titleCase(profile.fence), profile.poleColor],
        ["Banner", titleCase(profile.banner), profile.accentColor],
      ]],
      ["Built", [
        ["Roof", titleCase(profile.roofShape), profile.roofColor],
        ["Windows", titleCase(profile.windowStyle), null],
        ["Pole", poleNames[profile.poleTop], profile.poleColor],
        ["Sign", titleCase(profile.signShape), profile.accentColor],
        ["Glyph", `Symbol ${profile.signGlyph + 1}`, "glyph"],
      ]],
      ["Locals", [[
        "Aliens",
        `${alienNames[profile.alienMix]}, ${profile.alienHeight}, ${profile.alienTrait}, ${eyeNames[profile.eyeCount]}`,
        null,
      ]]],
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
      rows.forEach((row) => grid.appendChild(clueRow(profile, row)));
      group.append(heading, grid);
      list.appendChild(group);
    });
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
      value.textContent = text || "Two-tone sky";
      copy.append(name, value);
      row.appendChild(copy);
      return row;
  }

  function showResults() {
    show("results");
    $("results-score").textContent = formatPoints(match.totalScore);
    $("results-seed").textContent = match.seed;
    const list = $("results-list");
    list.replaceChildren();
    match.roundScores.forEach((points, index) => {
      const item = document.createElement("li");
      item.textContent = `Round ${index + 1}: ${formatPoints(points)}`;
      list.appendChild(item);
    });
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
    const previous = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = previous;
    }, 1200);
  }

  document.querySelectorAll(".diff").forEach((button) => {
    button.addEventListener("click", () => {
      difficulty = button.dataset.difficulty;
      document.querySelectorAll(".diff").forEach((item) => {
        item.classList.toggle("is-selected", item === button);
      });
      const hint = $("diff-hint");
      if (hint) hint.textContent = difficultyHint(difficulty);
    });
  });

  $("play-btn").addEventListener("click", () => start("play"));
  $("study-btn").addEventListener("click", () => start("study"));
  $("map-dock").addEventListener("mouseenter", () => {
    $("map-dock").classList.add("is-zoomed");
    requestAnimationFrame(() => requestAnimationFrame(draw));
  });
  $("map-dock").addEventListener("mouseleave", () => {
    $("map-dock").classList.remove("is-zoomed");
    requestAnimationFrame(() => requestAnimationFrame(draw));
  });
  $("map-dock").addEventListener("transitionend", (event) => {
    if (event.propertyName === "width" || event.propertyName === "transform") draw();
  });
  $("confirm-btn").addEventListener("click", () => {
    G.submitGuess(match);
    draw();
  });
  $("next-btn").addEventListener("click", () => {
    const status = G.advance(match);
    if (status === "done") showResults();
    else draw();
  });
  $("back-btn").addEventListener("click", () => {
    $("seed-input").value = match.seed;
    show("start");
  });
  $("copy-seed").addEventListener("click", () => copyText(match.seed, $("copy-seed")));
  $("map").addEventListener("click", (event) => {
    if (!match || match.phase !== "guessing") return;
    match.pin = G.eventToMap(event, $("map"));
    draw();
  });

  $("again-btn").addEventListener("click", () => {
    $("seed-input").value = match.seed;
    start("play");
  });
  $("results-study").addEventListener("click", () => {
    $("seed-input").value = match.seed;
    start("study");
  });

  $("seed-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") start("play");
  });

  document.addEventListener("keydown", (event) => {
    if (!match || screens.play.hidden) return;
    if (event.target === $("seed-input")) return;
    if (event.key === "Enter" && match.pin && match.phase === "guessing") {
      event.preventDefault();
      G.submitGuess(match);
      draw();
    }
  });

  window.addEventListener("resize", draw);
})(window.AlienGuessr);
