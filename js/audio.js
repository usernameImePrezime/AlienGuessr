(function (G) {
  const TRACKS = [
    { file: "assets/music/stargazer.ogg", title: "Stargazer", author: "Centurion_of_war" },
    { file: "assets/music/space-adventure.ogg", title: "Space Adventure", author: "MintoDog" },
    { file: "assets/music/zenostar.ogg", title: "ZenoStar", author: "Centurion_of_war" },
    { file: "assets/music/wacky-idlings.ogg", title: "Wacky Idlings", author: "Fupi" },
    { file: "assets/music/banana-track.ogg", title: "Banana Track", author: "skrjablin" },
  ];
  const SFX = {
    beam: "assets/sfx/beam.ogg",
    drop: "assets/sfx/drop.ogg",
    lock: "assets/sfx/lock.ogg",
    great: "assets/sfx/great.ogg",
    meh: "assets/sfx/meh.ogg",
  };
  const STORE = "alienGuessr.audio";
  const TRACK_MS = 150000;
  const FADE_MS = 1800;
  const MUSIC_LEVEL = 0.55;

  const state = loadState();
  let started = false;
  let order = [];
  let cursor = 0;
  let current = null;
  let switchTimer = 0;
  let toastTimer = 0;
  let duck = 1;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      return {
        muted: saved.muted === true,
        volume: typeof saved.volume === "number" ? Math.max(0, Math.min(1, saved.volume)) : 0.5,
      };
    } catch (error) {
      return { muted: false, volume: 0.5 };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (error) {
      // storage can be unavailable in private windows
    }
  }

  function shuffled(count) {
    const items = Array.from({ length: count }, (_, i) => i);
    const bytes = new Uint32Array(count);
    crypto.getRandomValues(bytes);
    for (let i = count - 1; i > 0; i--) {
      const j = bytes[i] % (i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function musicLevel() {
    return state.muted ? 0 : state.volume * MUSIC_LEVEL * duck;
  }

  function fade(el, to, ms, done) {
    if (el.fadeTimer) clearInterval(el.fadeTimer);
    const from = el.volume;
    const start = performance.now();
    el.fadeTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t >= 1) {
        clearInterval(el.fadeTimer);
        el.fadeTimer = 0;
        if (done) done();
      }
    }, 40);
  }

  function toast(track) {
    const node = document.getElementById("now-playing");
    if (!node) return;
    node.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = track.title;
    node.append("Now playing ", title, ` by ${track.author} (CC0)`);
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.hidden = true;
    }, 4500);
  }

  function playNext() {
    clearTimeout(switchTimer);
    if (!order.length || cursor >= order.length) {
      const last = order[order.length - 1];
      order = shuffled(TRACKS.length);
      if (order[0] === last && order.length > 1) order.push(order.shift());
      cursor = 0;
    }
    const track = TRACKS[order[cursor++]];
    const previous = current;
    const el = new Audio(track.file);
    el.loop = true;
    el.volume = 0;
    el.preload = "auto";
    current = el;
    if (!state.muted) {
      el.play().then(() => toast(track)).catch(() => {});
      fade(el, musicLevel(), FADE_MS);
    }
    el.addEventListener("error", () => {
      if (current === el) switchTimer = setTimeout(playNext, 400);
    });
    if (previous) {
      fade(previous, 0, FADE_MS, () => {
        previous.pause();
        previous.src = "";
      });
    }
    switchTimer = setTimeout(playNext, TRACK_MS);
  }

  function start() {
    if (started) return;
    started = true;
    try {
      playNext();
    } catch (error) {
      started = false;
    }
  }

  function apply() {
    if (!current) return;
    if (state.muted) {
      fade(current, 0, 300, () => current && state.muted && current.pause());
    } else {
      if (current.paused) current.play().catch(() => {});
      fade(current, musicLevel(), 400);
    }
  }

  function syncUi() {
    document.querySelectorAll(".music-toggle").forEach((button) => {
      button.textContent = state.muted ? "Music off" : "Music on";
      button.classList.toggle("is-muted", state.muted);
      button.setAttribute("aria-pressed", String(!state.muted));
    });
    document.querySelectorAll(".volume").forEach((input) => {
      input.value = String(Math.round(state.volume * 100));
    });
  }

  function toggle() {
    state.muted = !state.muted;
    saveState();
    syncUi();
    if (!state.muted && !started) start();
    else apply();
  }

  function setVolume(value) {
    state.volume = Math.max(0, Math.min(1, value));
    if (state.volume > 0 && state.muted) state.muted = false;
    saveState();
    syncUi();
    if (!started && !state.muted) start();
    else apply();
  }

  function sfx(name) {
    if (state.muted || !SFX[name]) return;
    try {
      const el = new Audio(SFX[name]);
      el.volume = Math.min(1, state.volume * 0.9);
      el.play().catch(() => {});
      if (current && !current.paused) {
        duck = 0.35;
        fade(current, musicLevel(), 150);
        el.addEventListener("ended", () => {
          duck = 1;
          if (current) fade(current, musicLevel(), 600);
        });
      }
    } catch (error) {
      duck = 1;
    }
  }

  document.querySelectorAll(".music-toggle").forEach((button) => {
    button.addEventListener("click", toggle);
  });
  document.querySelectorAll(".volume").forEach((input) => {
    input.addEventListener("input", () => setVolume(Number(input.value) / 100));
  });
  document.addEventListener("visibilitychange", () => {
    if (!current || state.muted) return;
    if (document.hidden) current.pause();
    else current.play().catch(() => {});
  });
  syncUi();

  function status() {
    if (!current) return { started, playing: false };
    return { started, playing: !current.paused, src: current.src, volume: current.volume, time: current.currentTime };
  }

  G.audio = { start, toggle, setVolume, sfx, status, state, tracks: TRACKS };
})(window.AlienGuessr = window.AlienGuessr || {});
