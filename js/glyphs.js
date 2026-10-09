(function (G) {
  const drawers = [
    function hook(ctx, s) {
      const h = s * 0.32;
      ctx.strokeRect(-h, -h, h * 2, h * 2);
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(0, 0);
      ctx.lineTo(h * 0.85, 0);
      ctx.stroke();
    },
    function dots(ctx, s) {
      const r = s * 0.09;
      [[0, -s * 0.22], [-s * 0.22, s * 0.16], [s * 0.22, s * 0.16]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    function chevrons(ctx, s) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = -s * 0.24 + i * s * 0.22;
        ctx.moveTo(-s * 0.28, y + s * 0.1);
        ctx.lineTo(0, y - s * 0.08);
        ctx.lineTo(s * 0.28, y + s * 0.1);
      }
      ctx.stroke();
    },
    function slashCircle(ctx, s) {
      const r = s * 0.28;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.7, r * 0.7);
      ctx.lineTo(r * 0.7, -r * 0.7);
      ctx.stroke();
    },
    function nested(ctx, s) {
      ctx.beginPath();
      diamond(ctx, s * 0.34);
      diamond(ctx, s * 0.16);
      ctx.stroke();
    },
    function waves(ctx, s) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = -s * 0.2 + i * s * 0.18;
        ctx.moveTo(-s * 0.32, y);
        ctx.quadraticCurveTo(-s * 0.16, y - s * 0.12, 0, y);
        ctx.quadraticCurveTo(s * 0.16, y + s * 0.12, s * 0.32, y);
      }
      ctx.stroke();
    },
    function plusDots(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.28);
      ctx.lineTo(0, s * 0.28);
      ctx.moveTo(-s * 0.28, 0);
      ctx.lineTo(s * 0.28, 0);
      ctx.stroke();
      ctx.beginPath();
      [[-s * 0.2, -s * 0.2], [s * 0.2, -s * 0.2], [-s * 0.2, s * 0.2], [s * 0.2, s * 0.2]].forEach(([x, y]) => {
        ctx.moveTo(x + s * 0.05, y);
        ctx.arc(x, y, s * 0.05, 0, Math.PI * 2);
      });
      ctx.fill();
    },
    function loop(ctx, s) {
      ctx.beginPath();
      ctx.arc(0, -s * 0.05, s * 0.2, Math.PI * 0.9, Math.PI * 2.15);
      ctx.moveTo(0, -s * 0.05);
      ctx.lineTo(0, s * 0.32);
      ctx.moveTo(-s * 0.1, s * 0.18);
      ctx.lineTo(0, s * 0.32);
      ctx.lineTo(s * 0.1, s * 0.18);
      ctx.stroke();
    },
    function arches(ctx, s) {
      ctx.beginPath();
      ctx.arc(-s * 0.12, s * 0.08, s * 0.2, Math.PI, 0);
      ctx.moveTo(s * 0.08, s * 0.08);
      ctx.arc(s * 0.16, s * 0.08, s * 0.16, Math.PI, 0);
      ctx.stroke();
    },
    function star(ctx, s) {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34);
        const b = a + Math.PI / 4;
        ctx.lineTo(Math.cos(b) * s * 0.12, Math.sin(b) * s * 0.12);
      }
      ctx.closePath();
      ctx.stroke();
    },
    function bars(ctx, s) {
      const heights = [0.55, 0.9, 0.35, 0.7];
      heights.forEach((ratio, i) => {
        const x = -s * 0.3 + i * s * 0.2;
        const h = s * 0.5 * ratio;
        ctx.fillRect(x, s * 0.28 - h, s * 0.1, h);
      });
    },
    function almond(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.34, 0);
      ctx.quadraticCurveTo(0, -s * 0.28, s * 0.34, 0);
      ctx.quadraticCurveTo(0, s * 0.28, -s * 0.34, 0);
      ctx.moveTo(s * 0.08, 0);
      ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    },
  ];

  function diamond(ctx, r) {
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
  }

  function drawGlyph(ctx, index, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawers[index % drawers.length](ctx, size);
    ctx.restore();
  }

  G.drawGlyph = drawGlyph;
  G.GLYPH_COUNT = drawers.length;
})(window.AlienGuessr = window.AlienGuessr || {});
