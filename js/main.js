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
    if (level === "medium") return "A few continents, twelve countries. Bollards, plates and road lines start to matter.";
    if (level === "hard") return "Up to four continents, twenty countries. Neighbors look alike: read poles, phone codes and km markers.";
    return "One continent, six countries. The sky and the color of the locals give it away.";
  }

  function placeName(place) {
    if (place.sea) return "the open sea";
    return `${place.country.name} (${place.province.name})`;
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
      highlight: revealed ? G.placeOfRegion(match.planet, G.currentRound(match).regionId).country.id : null,
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
      const result = match.lastResult;
      $("result-quip").textContent = quip(result.base);
      $("round-points").textContent = formatPoints(result.points);
      $("result-place").textContent = `You guessed ${placeName(result.guess)}, it was ${placeName(result.truth)}`;
      const bonus = $("result-bonus");
      bonus.hidden = !result.bonus.points;
      bonus.textContent = [
        result.bonus.country ? `+${G.BONUS.country} right country` : "",
        result.bonus.province ? `+${G.BONUS.province} right province` : "",
      ].filter(Boolean).join(" · ");
      $("distance-label").textContent = `${Math.round(result.dist)} units off · ${formatPoints(result.base)} for distance`;
      const round = G.currentRound(match);
      const place = G.settlementAt(match.planet, round.x, round.y);
      const where = place.kind === "wild"
        ? `Somewhere outside ${place.town ? place.town.name : "civilization"}`
        : `${place.kind === "city" ? "Downtown" : place.town.kind === "city" ? "Outskirts of" : "Village of"} ${place.town.name}`;
      tag.textContent = `${where} · ${result.truth.province.name}, ${result.truth.country.name}`;
    }

    if (study && revealed) G.guide.open(match);
    else G.guide.close();
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
  G.guide.attach();
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
})(window.ProbeDrop);
