(function (G) {
  const COUNTRY_BONUS = 500;
  const PROVINCE_BONUS = 250;

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointsForDistance(dist) {
    return Math.round(5000 * Math.exp(-dist / 280));
  }

  function placeBonus(guess, truth) {
    const country = !guess.sea && guess.country.id === truth.country.id;
    const province = country && guess.province.id === truth.province.id;
    return { country, province, points: (country ? COUNTRY_BONUS : 0) + (province ? PROVINCE_BONUS : 0) };
  }

  G.distance = distance;
  G.pointsForDistance = pointsForDistance;
  G.placeBonus = placeBonus;
  G.BONUS = { country: COUNTRY_BONUS, province: PROVINCE_BONUS };
})(window.ProbeDrop = window.ProbeDrop || {});
