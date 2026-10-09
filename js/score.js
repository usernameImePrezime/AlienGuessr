(function (G) {
  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointsForDistance(dist) {
    return Math.round(5000 * Math.exp(-dist / 280));
  }

  G.distance = distance;
  G.pointsForDistance = pointsForDistance;
})(window.AlienGuessr = window.AlienGuessr || {});
