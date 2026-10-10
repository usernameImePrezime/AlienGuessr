(function (G) {
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('400 20px "Luckiest Guy"'),
      document.fonts.load('600 20px "Fredoka"'),
      document.fonts.load('500 20px "Fredoka"'),
    ]).catch(() => {});
  }

  G.assetsReady = loadFonts();
})(window.ProbeDrop = window.ProbeDrop || {});
