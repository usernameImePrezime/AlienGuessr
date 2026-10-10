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
      rounds: [],
      roundIndex: 0,
      totalScore: 0,
      bestRound: 0,
      phase: "guessing",
      pin: null,
      lastResult: null,
      roundScores: [],
    };
    match.rounds.push(G.pickLocation(planet, rng));
    return match;
  }

  function currentRound(match) {
    return match.rounds[match.roundIndex];
  }

  function currentRegion(match) {
    return match.planet.regions[currentRound(match).regionId];
  }

  function photoKey(match) {
    const round = currentRound(match);
    return `${match.seed}|photo|${match.difficulty}|${round.x.toFixed(2)}|${round.y.toFixed(2)}`;
  }

  function photoRng(match) {
    return G.mulberry32(G.hashSeed(photoKey(match)));
  }

  function averageScore(match) {
    if (!match.roundScores.length) return 0;
    return match.totalScore / match.roundScores.length;
  }

  function submitGuess(match) {
    if (!match.pin || match.phase !== "guessing") return;
    const round = currentRound(match);
    const dist = G.distance(match.pin, round);
    const base = G.pointsForDistance(dist);
    const guess = G.placeAt(match.planet, match.pin.x, match.pin.y);
    const truth = G.placeOfRegion(match.planet, round.regionId);
    const bonus = G.placeBonus(guess, truth);
    const points = base + bonus.points;
    match.totalScore += points;
    match.roundScores.push(points);
    match.bestRound = Math.max(match.bestRound, points);
    match.lastResult = { dist, base, bonus, points, guess, truth, total: match.totalScore };
    match.phase = "revealed";
  }

  function advance(match) {
    if (match.phase !== "revealed") return;
    match.rounds.push(G.pickLocation(match.planet, match.rng));
    match.roundIndex += 1;
    match.phase = "guessing";
    match.pin = null;
    match.lastResult = null;
  }

  G.createMatch = createMatch;
  G.currentRound = currentRound;
  G.currentRegion = currentRegion;
  G.photoKey = photoKey;
  G.photoRng = photoRng;
  G.averageScore = averageScore;
  G.submitGuess = submitGuess;
  G.advance = advance;
})(window.ProbeDrop = window.ProbeDrop || {});
