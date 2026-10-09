(function (G) {
  function createMatch(seed, difficulty, mode) {
    const planet = G.createPlanet(seed, difficulty);
    const rng = G.mulberry32(G.hashSeed(`${seed}|locations|${difficulty}|${mode}`));
    const match = {
      seed,
      difficulty,
      mode,
      planet,
      rng,
      seenRegions: new Set(),
      rounds: [],
      roundIndex: 0,
      totalScore: 0,
      phase: "guessing",
      pin: null,
      mapOpen: false,
      lastResult: null,
      roundScores: [],
    };
    const count = mode === "play" ? 5 : 1;
    for (let i = 0; i < count; i++) {
      match.rounds.push(G.pickLocation(planet, rng, match.seenRegions));
    }
    return match;
  }

  function currentRound(match) {
    return match.rounds[match.roundIndex];
  }

  function currentRegion(match) {
    const round = currentRound(match);
    return match.planet.regions[round.regionId];
  }

  function photoRng(match) {
    const round = currentRound(match);
    return G.mulberry32(G.hashSeed(`${match.seed}|photo|${match.difficulty}|${round.x.toFixed(2)}|${round.y.toFixed(2)}`));
  }

  function submitGuess(match) {
    if (!match.pin || match.phase !== "guessing") return;
    const round = currentRound(match);
    const dist = G.distance(match.pin, round);
    const points = G.pointsForDistance(dist);
    match.totalScore += points;
    match.roundScores.push(points);
    match.lastResult = {
      dist,
      points,
      total: match.totalScore,
    };
    match.phase = "revealed";
    match.mapOpen = true;
  }

  function advance(match) {
    if (match.phase !== "revealed") return "stay";
    if (match.mode === "study") {
      match.rounds.push(G.pickLocation(match.planet, match.rng, match.seenRegions));
      match.roundIndex += 1;
      resetRound(match);
      return "stay";
    }
    if (match.roundIndex >= 4) {
      match.phase = "done";
      return "done";
    }
    match.roundIndex += 1;
    resetRound(match);
    return "stay";
  }

  function resetRound(match) {
    match.phase = "guessing";
    match.pin = null;
    match.mapOpen = false;
    match.lastResult = null;
  }

  G.createMatch = createMatch;
  G.currentRound = currentRound;
  G.currentRegion = currentRegion;
  G.photoRng = photoRng;
  G.submitGuess = submitGuess;
  G.advance = advance;
})(window.AlienGuessr = window.AlienGuessr || {});
