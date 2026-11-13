(() => {
  const canvas = document.getElementById("universe");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkColors = ["#f0e891", "#c9c5ff"];
  const lightColors = ["#aa8734", "#8781bd"];
  const stars = [];
  let width, height, frame, previousTime;
  let elapsed = 0;
  let meteor = null;
  let nextMeteor = 3;

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const count = Math.min(520, Math.ceil(width * height / 4000));
    stars.length = 0;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1.25 + Math.random() * 1.65,
        speed: 13 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.12 ? 1 : 0,
      });
    }
  }

  function draw(time) {
    const delta = Math.min((time - previousTime) / 1000, 0.06);
    previousTime = time;
    elapsed += delta;
    const dark = document.documentElement.dataset.theme === "dark";
    const colors = dark ? darkColors : lightColors;
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      star.x += star.speed * delta;
      star.y -= star.speed * delta * 0.55;
      if (star.x > width) star.x = -star.size;
      if (star.y < -star.size) star.y = height;
      ctx.globalAlpha = 0.63 + 0.32 * Math.sin(elapsed + star.phase);
      ctx.fillStyle = colors[star.color];
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    if (elapsed >= nextMeteor) {
      meteor = { x: width * Math.random() * 0.8, y: height * (0.25 + Math.random() * 0.7), age: 0 };
      nextMeteor = elapsed + 5 + Math.random() * 3;
    }
    if (meteor) {
      meteor.age += delta;
      meteor.x += 230 * delta;
      meteor.y -= 133 * delta;
      const tailX = meteor.x - 38;
      const tailY = meteor.y + 22;
      const tail = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
      tail.addColorStop(0, "transparent");
      tail.addColorStop(1, dark ? "#fff5d4" : "#ac873a");
      ctx.globalAlpha = Math.max(0, Math.sin(Math.PI * meteor.age / 1.4));
      ctx.strokeStyle = tail;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(meteor.x, meteor.y);
      ctx.stroke();
      if (meteor.age >= 1.4) meteor = null;
    }
    frame = requestAnimationFrame(draw);
  }

  function updateAnimation() {
    cancelAnimationFrame(frame);
    if (reducedMotion.matches || document.hidden) return;
    resize();
    previousTime = performance.now();
    frame = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", updateAnimation);
  document.addEventListener("visibilitychange", updateAnimation);
  reducedMotion.addEventListener("change", updateAnimation);
  updateAnimation();
})();
