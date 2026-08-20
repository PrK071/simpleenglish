(function () {
  const introEl = document.getElementById("intro");
  if (!introEl) return;
  const canvas = document.getElementById("introCanvas");
  if (!canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || sessionStorage.getItem("se_intro_shown")) {
    introEl.style.display = "none";
    return;
  }

  const ctx = canvas.getContext("2d");
  const brand = document.getElementById("introBrand");

  const LOGO_W = 460;
  const LOGO_H = 385;
  const CELL = 10;
  const LOGO_GRID = [
    "0000000000000001111111111111000000000000000000",
    "0000000000001111111111111111111000000000000000",
    "0000000000111111111111111111111111000000000000",
    "0000000011111111111111111111111111100000000000",
    "0000001111111111111111111111111111111000000000",
    "0000011111111111111111111111111111111100000000",
    "0000111111111111111111111111111111111110000000",
    "0001111111111111111111111111111111111111000000",
    "0011111111111111111111111111111111111111144000",
    "0011111111111111111111111111111111111111144400",
    "0111111111111111111111111111111111111111114440",
    "0111111111111111111111111111111111111111114440",
    "1111111111111111111111111111111111111111110444",
    "1111111111333111111111111111111111111111111444",
    "1111111113333311111122221111112221111111111444",
    "1111111113333331111222221111122222111111111444",
    "1111111113333331111222221111122222111111111444",
    "1111111113333311111122221111122222111111111444",
    "1111111111333111111111111111111111111111114444",
    "1111111111111111111111111111111111111111114444",
    "0111111111111111111111111111111111111111114440",
    "0111111111111111111111111111111111111111144440",
    "0011111111111111111111111111111111111111144440",
    "0011111111111111111111111111111111111111444400",
    "0001111111111111111111111111111111111114444000",
    "0004111111111111111111111111111111111144440000",
    "0044401111111111111111111111111111111444400000",
    "0044440111111111111111111111111111114444000000",
    "0444444001111111111111111111111111444400000000",
    "0444444440011111111111111111111110440000000000",
    "0444444444400000111111111111111000000000000000",
    "0044444444444400000000011111110000000000000000",
    "0044444444444444444444401111000000000000000000",
    "0004444444444444444444011110000000000000000000",
    "0000444444444444444440011000000000000000000000",
    "0000044444444444444000000000000000000000000000",
    "0000000444444440000000000000000000000000000000",
    "0000000004444400000000000000000000000000000000",
    "0000000000004400000000000000000000000000000000"
  ];

  const FORM_MS = 1600;
  const HOLD_MS = 1400;
  const DISP_MS = 1100;
  const PARTICLE_SIZE = 3;
  const RADIUS = 80;
  const FORCE = 5;

  const palette = ["#0058b0", "#0058b0", "#0058b0", "#0a6ac4", "#004a94"];

  let particles = [];
  let W = 0;
  let H = 0;
  let phase = "form";
  let t0 = null;
  let phaseStart = 0;
  let smoothX = -99999;
  let smoothY = -99999;
  let prevMx = -99999;
  let prevMy = -99999;
  let mouseSpeed = 0;
  let pointerActive = false;
  let ptrX = -99999;
  let ptrY = -99999;

  document.body.style.overflow = "hidden";

  function sample() {
    particles = [];
    if (W <= 0 || H <= 0) return;

    const scale = Math.min((W * 0.7) / LOGO_W, (H * 0.52) / LOGO_H);
    const offsetX = (W - LOGO_W * scale) / 2;
    const offsetY = (H - LOGO_H * scale) / 2;

    for (let r = 0; r < LOGO_GRID.length; r++) {
      const row = LOGO_GRID[r];
      for (let c = 0; c < row.length; c++) {
        const cell = row.charAt(c);
        if (cell === "0") continue;
        let color;
        if (cell === "2") color = "#ffffff";
        else if (cell === "3") color = "#ffc020";
        else if (cell === "4") color = "#e01030";
        else color = palette[Math.floor(Math.random() * palette.length)];
        for (let j = 1; j <= 3; j += 2) {
          for (let k = 1; k <= 3; k += 2) {
            const ox = offsetX + (c * CELL + j * 2.5) * scale;
            const oy = offsetY + (r * CELL + k * 2.5) * scale;
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.max(W, H) * (0.55 + Math.random() * 0.5);
            particles.push({
              ox: ox,
              oy: oy,
              sx: W / 2 + Math.cos(ang) * rad,
              sy: H / 2 + Math.sin(ang) * rad,
              c: color,
              repX: 0,
              repY: 0
            });
          }
        }
      }
    }
    t0 = null;
    phase = "form";
  }

  function resize() {
    const dpr = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1));
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sample();
  }

  function finish() {
    sessionStorage.setItem("se_intro_shown", "1");
    document.body.style.overflow = "";
    introEl.classList.add("intro-hidden");
    setTimeout(function () {
      introEl.remove();
    }, 600);
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    if (t0 === null) {
      t0 = now;
      phaseStart = now;
    }

    let factor;
    let alpha;

    if (phase === "form") {
      const v = Math.min(1, (now - t0) / FORM_MS);
      factor = 1 - Math.pow(1 - v, 3);
      alpha = factor;
      if (v >= 1) {
        phase = "hold";
        phaseStart = now;
        brand.classList.add("visible");
      }
    } else if (phase === "hold") {
      factor = 1;
      alpha = 1;
      if (now - phaseStart >= HOLD_MS) {
        phase = "disperse";
        phaseStart = now;
        brand.classList.remove("visible");
      }
    } else {
      const v = Math.min(1, (now - phaseStart) / DISP_MS);
      factor = v * v;
      alpha = Math.max(0, 1 - v);
      if (v >= 1) {
        phase = "done";
        finish();
        return;
      }
    }

    if (pointerActive && phase === "hold") {
      if (smoothX < -9000) {
        smoothX = ptrX;
        smoothY = ptrY;
      } else {
        smoothX += (ptrX - smoothX) * 0.3;
        smoothY += (ptrY - smoothY) * 0.3;
      }
    } else {
      smoothX = -99999;
      smoothY = -99999;
    }

    const half = PARTICLE_SIZE / 2;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      let px;
      let py;

      if (phase === "form") {
        px = p.sx + (p.ox - p.sx) * factor;
        py = p.sy + (p.oy - p.sy) * factor;
      } else if (phase === "hold") {
        if (pointerActive) {
          const dx = p.ox - smoothX;
          const dy = p.oy - smoothY;
          const distSq = dx * dx + dy * dy;
          if (distSq > 0 && distSq < RADIUS * RADIUS) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            const falloff = 1 - dist / RADIUS;
            const push = falloff * mouseSpeed * FORCE * 0.05;
            p.repX += nx * push;
            p.repY += ny * push;
            p.repX += (nx * (RADIUS - dist) - p.repX) * 0.06;
            p.repY += (ny * (RADIUS - dist) - p.repY) * 0.06;
          } else {
            p.repX *= 0.97;
            p.repY *= 0.97;
          }
        } else {
          p.repX *= 0.97;
          p.repY *= 0.97;
        }
        px = p.ox + p.repX;
        py = p.oy + p.repY;
      } else {
        px = p.ox + (p.sx - p.ox) * factor;
        py = p.oy + (p.sy - p.oy) * factor;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.c;
      ctx.fillRect(px - half, py - half, PARTICLE_SIZE, PARTICLE_SIZE);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (phase === "done") return;
    draw(now);
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointermove", function (e) {
    const mx = e.clientX;
    const my = e.clientY;
    if (prevMx > -9000) {
      const ddx = mx - prevMx;
      const ddy = my - prevMy;
      mouseSpeed = Math.sqrt(ddx * ddx + ddy * ddy);
    }
    prevMx = mx;
    prevMy = my;
    ptrX = mx;
    ptrY = my;
    pointerActive = true;
  });

  canvas.addEventListener("pointerleave", function () {
    pointerActive = false;
    prevMx = -99999;
    prevMy = -99999;
    mouseSpeed = 0;
  });

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  resize();
  requestAnimationFrame(loop);
})();
