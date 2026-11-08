/**
 * Simulador de Titulación Química - Motor Gráfico 2D Analítico de Alta Precisión
 * Incluye:
 * - Soporte universal, bureta graduada (0-50 mL) y llave teflón.
 * - Matraz Erlenmeyer con física de fluidos homogéneos y heterogéneos (falta de agitación).
 * - Efecto de salpicadura violenta sobre la pantalla/lente en apertura brusca.
 * - Pluma de reacción localizada y difusión por vórtice con agitación circular.
 */

export class LabScene {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container || document.getElementById('canvas-container') || document.body;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'lab-canvas-2d';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    // Estado físico y químico
    this.valveOpeningPercent = 0; // 0% a 100%
    this.agitationLevel = 0;      // 0% a 100%
    this.isCircularAgitation = false;
    this.remainingBuretteMl = 50.0;
    this.totalVolumeFlaskMl = 20.0;
    this.liquidColor = { r: 242, g: 246, b: 250, alpha: 0.2, hex: '#f2f6fa' };
    this.reactionPlumeColor = { r: 236, g: 72, b: 153 };
    this.unmixedTitrantMl = 0.0; // Reactivo sin disolver en la superficie
    this.hasHomogenizationError = false;

    // Partículas y dinámicas de fluidos
    this.drops = [];            // Gotas en caída libre
    this.splashes = [];         // Micro-salpicaduras en impacto de matraz
    this.ripples = [];          // Ondas en la superficie del matraz
    this.screenSplatters = [];  // Gotas salpicadas en la pantalla por apertura brusca
    this.reactionPlume = 0;     // Intensidad de la mancha de contacto

    this.isSplattered = false;
    this.lastDropSpawnTime = 0;
    this.onVolumeChange = null;

    // Dimensiones y escalado
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.resize();

    // Animación
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.simTime = 0;

    window.addEventListener('resize', () => this.resize());
    this.startAnimationLoop();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    this.updateLayout();
  }

  updateLayout() {
    const w = this.width;
    const h = this.height;

    // Área central libre entre el bloque izquierdo (Sensor + Muestra) y el bloque derecho (Cámara + Curva)
    let leftBoundary = Math.min(550, w * 0.40);
    let rightBoundary = w - Math.min(430, w * 0.31);

    if (w < 1180) {
      leftBoundary = 20;
      rightBoundary = w - 20;
    }

    const cx = leftBoundary + (rightBoundary - leftBoundary) * 0.5;
    const tableY = Math.min(h * 0.88, h - 65);

    const flaskH = Math.min(175, Math.max(135, h * 0.25));
    const flaskBaseW = Math.min(140, flaskH * 0.84);
    const flaskNeckW = 32;
    const flaskNeckH = flaskH * 0.30;
    const flaskBottomY = tableY - 14;
    const flaskRimY = flaskBottomY - flaskH;

    const tipLength = 34;
    const tipY = flaskRimY - 34;
    const valveY = tipY - tipLength;
    const buretteHeight = Math.min(350, Math.max(230, valveY - 50));
    const buretteTopY = valveY - buretteHeight;
    const buretteWidth = 26;

    this.layout = {
      cx,
      tableY,
      stand: {
        baseX: cx - 40,
        baseY: tableY - 14,
        baseW: flaskBaseW * 1.55,
        baseH: 14,
        rodX: cx - flaskBaseW * 0.72,
        rodTopY: Math.max(30, buretteTopY - 25),
        rodW: 10,
        clampY: valveY - buretteHeight * 0.45
      },
      burette: {
        cx,
        topY: buretteTopY,
        bottomY: valveY,
        height: buretteHeight,
        width: buretteWidth,
        innerRadius: 10,
        valveY,
        tipY,
        tipLength
      },
      flask: {
        cx,
        bottomY: flaskBottomY,
        rimY: flaskRimY,
        height: flaskH,
        baseW: flaskBaseW,
        neckW: flaskNeckW,
        neckH: flaskNeckH
      }
    };
  }

  setValveRotation(percent) {
    this.valveOpeningPercent = Math.max(0, Math.min(100, Number(percent) || 0));
  }

  setAgitation(level, isCircular = false) {
    this.agitationLevel = Math.max(0, Math.min(100, Number(level) || 0));
    this.isCircularAgitation = Boolean(isCircular);
  }

  updateLiquidState(colorObj, totalVolumeFlaskMl, remainingBuretteMl, plumeColor, unmixedMl = 0, hasError = false) {
    if (colorObj) this.liquidColor = colorObj;
    if (plumeColor) this.reactionPlumeColor = plumeColor;
    if (typeof totalVolumeFlaskMl === 'number') this.totalVolumeFlaskMl = Math.max(15.0, totalVolumeFlaskMl);
    if (typeof remainingBuretteMl === 'number') this.remainingBuretteMl = Math.max(0.0, Math.min(50.0, remainingBuretteMl));
    this.unmixedTitrantMl = Number(unmixedMl) || 0;
    this.hasHomogenizationError = Boolean(hasError);
  }

  spawnDrop(onLand) {
    if (this.remainingBuretteMl <= 0 || this.isSplattered) return;
    const { cx, tipY } = this.layout.burette;
    this.drops.push({
      x: cx,
      y: tipY,
      vy: 1.5,
      radius: 3.8,
      onLand: onLand || null
    });
  }

  triggerSurfaceImpact(intensity = 1.0) {
    const { cx } = this.layout.flask;
    const surfaceY = this.getFlaskSurfaceY();

    this.ripples.push({
      x: cx,
      y: surfaceY,
      radius: 3,
      maxRadius: 28 * intensity,
      opacity: 0.9,
      speed: 1.2
    });

    const count = Math.min(6, Math.floor(2 + intensity * 4));
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.4;
      const speed = (1.5 + Math.random() * 2.5) * intensity;
      this.splashes.push({
        x: cx + (Math.random() - 0.5) * 4,
        y: surfaceY - 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.2 + Math.random() * 1.5,
        opacity: 0.9,
        gravity: 0.25
      });
    }

    this.reactionPlume = Math.min(1.0, this.reactionPlume + 0.35 * intensity);
  }

  /**
   * Genera salpicaduras violentas directamente en la pantalla/pantalla de visualización
   * debido a apertura brusca o pellizco súbito.
   */
  triggerScreenSplatter() {
    this.isSplattered = true;
    const count = 35 + Math.floor(Math.random() * 20);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * (this.height * 0.85);
      const r = 5 + Math.random() * 22;
      this.screenSplatters.push({
        x,
        y,
        radius: r,
        opacity: 0.85 + Math.random() * 0.15,
        dripLength: 10 + Math.random() * 40,
        dripProgress: 0,
        color: Math.random() > 0.4 ? 'rgba(236, 72, 153, 0.75)' : 'rgba(186, 230, 253, 0.85)'
      });
    }
  }

  clearScreenSplatter() {
    this.isSplattered = false;
    this.screenSplatters = [];
  }

  animate(callback) {
    if (callback) {
      this.onVolumeChange = callback;
    }
  }

  reset() {
    this.drops = [];
    this.splashes = [];
    this.ripples = [];
    this.clearScreenSplatter();
    this.reactionPlume = 0;
    this.valveOpeningPercent = 0;
    this.agitationLevel = 0;
    this.isCircularAgitation = false;
    this.unmixedTitrantMl = 0;
    this.hasHomogenizationError = false;
  }

  destroy() {
    this.isRunning = false;
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  startAnimationLoop() {
    const loop = (timestamp) => {
      if (!this.isRunning) return;

      const dt = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;
      this.simTime += dt;

      this.updatePhysics(dt);
      this.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  updatePhysics(dt) {
    if (!this.layout) return;

    const surfaceY = this.getFlaskSurfaceY();
    const valve = this.valveOpeningPercent;
    const hasLiquid = this.remainingBuretteMl > 0.001 && !this.isSplattered;

    // --- 1. Chorro Continuo vs Goteo ---
    const isStreamMode = valve > 25 && hasLiquid;
    this.isStreamActive = isStreamMode;

    if (isStreamMode) {
      const flowRateMlPerSec = 0.35 + ((valve - 25) / 75) * 2.2;
      const volumeAdded = flowRateMlPerSec * dt;

      if (this.onVolumeChange) {
        this.onVolumeChange(volumeAdded);
      }

      if (Math.random() < 0.45) {
        this.triggerSurfaceImpact(valve / 100);
      }
    } else if (valve > 0 && hasLiquid) {
      const dropInterval = 1.3 - (valve / 25) * 1.0;
      if (this.simTime - this.lastDropSpawnTime > dropInterval) {
        this.spawnDrop();
        this.lastDropSpawnTime = this.simTime;
      }
    }

    // --- 2. Gotas en vuelo ---
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.vy += 22 * dt;
      drop.y += drop.vy * dt * 50;

      if (drop.y >= surfaceY) {
        this.triggerSurfaceImpact(0.8);
        if (drop.onLand) drop.onLand();
        if (this.onVolumeChange) this.onVolumeChange(null);
        this.drops.splice(i, 1);
      }
    }

    // --- 3. Salpicaduras de impacto ---
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const sp = this.splashes[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += sp.gravity;
      sp.opacity -= dt * 2.2;

      if (sp.opacity <= 0 || sp.y >= surfaceY + 8) {
        this.splashes.splice(i, 1);
      }
    }

    // --- 4. Ondas concéntricas ---
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.radius += rp.speed * 60 * dt;
      rp.opacity = Math.max(0, 1 - (rp.radius / rp.maxRadius));

      if (rp.radius >= rp.maxRadius || rp.opacity <= 0) {
        this.ripples.splice(i, 1);
      }
    }

    // --- 5. Difusión de la pluma según agitación ---
    if (this.agitationLevel > 18) {
      // Agitación activa: disipación rápida por convección forzada
      const circBoost = this.isCircularAgitation ? 1.8 : 1.0;
      this.reactionPlume = Math.max(0, this.reactionPlume - dt * (1.5 + this.agitationLevel * 0.05 * circBoost));
    } else {
      // Sin agitación: la mancha de reacción NO se disipa (se estanca)
      this.reactionPlume = Math.max(0.4, this.reactionPlume);
    }

    // --- 6. Animación del escurrimiento de salpicaduras en la pantalla ---
    if (this.isSplattered) {
      this.screenSplatters.forEach(sp => {
        if (sp.dripProgress < sp.dripLength) {
          sp.dripProgress += dt * 18;
        }
      });
    }
  }

  getFlaskSurfaceY() {
    if (!this.layout) return this.height * 0.8;
    const { bottomY, height } = this.layout.flask;
    const volumeFraction = Math.min(1.0, Math.max(0.0, (this.totalVolumeFlaskMl - 15.0) / 60.0));
    const baseLiquidHeight = height * 0.38;
    const maxExtraLiquidH = height * 0.35;
    return bottomY - (baseLiquidHeight + volumeFraction * maxExtraLiquidH);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
    if (!this.layout) return;

    this.drawLabTable(ctx);
    this.drawSupportStand(ctx);
    this.drawBurette(ctx);
    this.drawLiquidFlow(ctx);
    this.drawFlask(ctx);

    // Dibujar pantalla salpicada si hubo apertura brusca
    if (this.isSplattered) {
      this.drawScreenSplatterOverlay(ctx, w, h);
    }
  }

  drawLabTable(ctx) {
    const { tableY } = this.layout;
    const w = this.width;

    const tableGrad = ctx.createLinearGradient(0, tableY, 0, this.height);
    tableGrad.addColorStop(0, '#f1f5f9');
    tableGrad.addColorStop(0.12, '#e2e8f0');
    tableGrad.addColorStop(1, '#cbd5e1');

    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, tableY, w, this.height - tableY);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, tableY);
    ctx.lineTo(w, tableY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(0, tableY + 1, w, 2);
  }

  drawSupportStand(ctx) {
    const { stand } = this.layout;

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(stand.baseX, stand.baseY, stand.baseW, stand.baseH, 4);
    ctx.fill();
    ctx.stroke();

    const rodGrad = ctx.createLinearGradient(stand.rodX, 0, stand.rodX + stand.rodW, 0);
    rodGrad.addColorStop(0, '#94a3b8');
    rodGrad.addColorStop(0.4, '#f8fafc');
    rodGrad.addColorStop(1, '#64748b');

    ctx.fillStyle = rodGrad;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.fillRect(stand.rodX, stand.rodTopY, stand.rodW, stand.baseY - stand.rodTopY);
    ctx.strokeRect(stand.rodX, stand.rodTopY, stand.rodW, stand.baseY - stand.rodTopY);

    const clampY = stand.clampY;
    const buretteX = this.layout.burette.cx;

    ctx.fillStyle = '#334155';
    ctx.fillRect(stand.rodX - 3, clampY - 7, stand.rodW + 6, 14);

    ctx.fillStyle = '#64748b';
    ctx.fillRect(stand.rodX + stand.rodW, clampY - 4, (buretteX - stand.rodX - stand.rodW) - 14, 8);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.arc(buretteX, clampY, 18, -Math.PI * 0.7, Math.PI * 0.7, false);
    ctx.stroke();
  }

  drawBurette(ctx) {
    const { cx, topY, bottomY, height, width, valveY, tipY } = this.layout.burette;
    const halfW = width / 2;
    const leftX = cx - halfW;
    const rightX = cx + halfW;

    ctx.fillStyle = 'rgba(240, 249, 255, 0.35)';
    ctx.fillRect(leftX, topY, width, height);

    // Líquido interior de la bureta
    const fillFraction = Math.max(0, Math.min(1.0, this.remainingBuretteMl / 50.0));
    const liquidTopY = bottomY - (height * fillFraction);

    if (this.remainingBuretteMl > 0.05) {
      const liqGrad = ctx.createLinearGradient(leftX, 0, rightX, 0);
      liqGrad.addColorStop(0, 'rgba(186, 230, 253, 0.75)');
      liqGrad.addColorStop(0.35, 'rgba(224, 242, 254, 0.95)');
      liqGrad.addColorStop(0.7, 'rgba(186, 230, 253, 0.75)');
      liqGrad.addColorStop(1, 'rgba(125, 211, 252, 0.65)');

      ctx.fillStyle = liqGrad;
      ctx.fillRect(leftX + 1.5, liquidTopY, width - 3, bottomY - liquidTopY);

      // Menisco cóncavo superior
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(cx, liquidTopY, halfW - 2, 2.5, 0, 0, Math.PI);
      ctx.stroke();
    }

    // Paredes de vidrio de la bureta
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(leftX, bottomY);
    ctx.moveTo(rightX, topY);
    ctx.lineTo(rightX, bottomY);
    ctx.stroke();

    // Graduaciones milimétricas precisas (0 a 50 mL)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#0f172a';
    ctx.font = '600 7.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const numIntervals = 50;
    for (let i = 0; i <= numIntervals; i++) {
      const y = topY + (i / numIntervals) * height;
      const isMajor = i % 5 === 0;
      const isIntermediate = i % 1 === 0 && !isMajor;

      ctx.lineWidth = isMajor ? 1.5 : (isIntermediate ? 1.0 : 0.6);
      const markLength = isMajor ? 9 : (isIntermediate ? 5 : 3);

      ctx.beginPath();
      ctx.moveTo(rightX - 2, y);
      ctx.lineTo(rightX - 2 - markLength, y);
      ctx.stroke();

      if (isMajor) {
        ctx.fillText(`${i}`, leftX - 3, y);
      }
    }

    ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#0284c7';
    ctx.fillText('mL', leftX - 4, topY - 8);

    // Cono de transición a la llave
    ctx.beginPath();
    ctx.moveTo(leftX, bottomY);
    ctx.lineTo(cx - 5, bottomY + 10);
    ctx.lineTo(cx + 5, bottomY + 10);
    ctx.lineTo(rightX, bottomY);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.4)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.stroke();

    this.drawValve(ctx, cx, valveY);

    // Punta dispensadora capilar
    ctx.beginPath();
    ctx.moveTo(cx - 5, valveY + 12);
    ctx.lineTo(cx + 5, valveY + 12);
    ctx.lineTo(cx + 1.8, tipY);
    ctx.lineTo(cx - 1.8, tipY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(224, 242, 254, 0.4)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  drawValve(ctx, x, y) {
    const valveAngle = (this.valveOpeningPercent / 100) * (Math.PI / 2);

    ctx.fillStyle = 'rgba(203, 213, 225, 0.7)';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y + 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y + 2);
    ctx.rotate(valveAngle);

    const handleGrad = ctx.createLinearGradient(-18, -4, 18, 4);
    handleGrad.addColorStop(0, '#7ec49c');
    handleGrad.addColorStop(0.5, '#58a379');
    handleGrad.addColorStop(1, '#428560');

    ctx.fillStyle = handleGrad;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    ctx.roundRect(-20, -5, 40, 10, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }

  drawLiquidFlow(ctx) {
    const { cx, tipY } = this.layout.burette;
    const surfaceY = this.getFlaskSurfaceY();
    const valve = this.valveOpeningPercent;

    if (this.isStreamActive && this.remainingBuretteMl > 0) {
      const streamFactor = (valve - 25) / 75;
      const baseWidth = 2.2 + streamFactor * 6.5;
      const topWidth = baseWidth;
      const bottomWidth = Math.max(1.8, baseWidth * 0.82);

      const time = this.simTime;
      const wobble = Math.sin(time * 30) * 0.6 * streamFactor;

      const streamGrad = ctx.createLinearGradient(cx - topWidth, 0, cx + topWidth, 0);
      streamGrad.addColorStop(0, 'rgba(186, 230, 253, 0.65)');
      streamGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.95)');
      streamGrad.addColorStop(0.7, 'rgba(147, 197, 253, 0.75)');
      streamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.55)');

      ctx.fillStyle = streamGrad;
      ctx.beginPath();
      ctx.moveTo(cx - topWidth / 2, tipY);
      ctx.lineTo(cx + topWidth / 2, tipY);
      ctx.quadraticCurveTo(cx + bottomWidth / 2 + wobble, (tipY + surfaceY) * 0.5, cx + bottomWidth / 2, surfaceY);
      ctx.lineTo(cx - bottomWidth / 2, surfaceY);
      ctx.quadraticCurveTo(cx - bottomWidth / 2 + wobble, (tipY + surfaceY) * 0.5, cx - topWidth / 2, tipY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = Math.max(1, baseWidth * 0.25);
      ctx.beginPath();
      ctx.moveTo(cx - 0.5, tipY);
      ctx.quadraticCurveTo(cx - 0.5 + wobble, (tipY + surfaceY) * 0.5, cx - 0.5, surfaceY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(cx, surfaceY, bottomWidth * 1.6, bottomWidth * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let drop of this.drops) {
      const r = drop.radius;
      ctx.save();
      ctx.translate(drop.x, drop.y);

      const dropGrad = ctx.createRadialGradient(-1, -1, 1, 0, 0, r);
      dropGrad.addColorStop(0, '#ffffff');
      dropGrad.addColorStop(0.4, 'rgba(186, 230, 253, 0.95)');
      dropGrad.addColorStop(1, 'rgba(56, 189, 248, 0.75)');

      ctx.fillStyle = dropGrad;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.4);
      ctx.quadraticCurveTo(r * 1.1, -r * 0.4, r, r * 0.5);
      ctx.arc(0, r * 0.5, r, 0, Math.PI);
      ctx.quadraticCurveTo(-r * 1.1, -r * 0.4, 0, -r * 1.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (let sp of this.splashes) {
      ctx.fillStyle = `rgba(255, 255, 255, ${sp.opacity})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawFlask(ctx) {
    const { cx, bottomY, rimY, height, baseW, neckW, neckH } = this.layout.flask;
    const surfaceY = this.getFlaskSurfaceY();

    let tiltAngle = 0;
    let swirlOffset = 0;
    if (this.agitationLevel > 10) {
      const swirlFactor = this.agitationLevel / 100;
      const freq = this.isCircularAgitation ? 18 : 14;
      tiltAngle = Math.sin(this.simTime * freq) * 0.045 * swirlFactor;
      swirlOffset = Math.cos(this.simTime * freq) * 16 * swirlFactor;
    }

    ctx.save();
    ctx.translate(cx, bottomY);
    ctx.rotate(tiltAngle);
    ctx.translate(-cx, -bottomY);

    const halfBase = baseW / 2;
    const halfNeck = neckW / 2;
    const neckStartY = rimY + neckH;

    const pRimL = { x: cx - halfNeck, y: rimY };
    const pRimR = { x: cx + halfNeck, y: rimY };
    const pNeckL = { x: cx - halfNeck, y: neckStartY };
    const pNeckR = { x: cx + halfNeck, y: neckStartY };
    const pBaseL = { x: cx - halfBase, y: bottomY };
    const pBaseR = { x: cx + halfBase, y: bottomY };

    const liquidFraction = (bottomY - surfaceY) / (bottomY - neckStartY);
    const halfLiquidW = halfBase - (halfBase - halfNeck) * Math.min(1.0, liquidFraction);
    const liquidL = { x: cx - halfLiquidW, y: surfaceY };
    const liquidR = { x: cx + halfLiquidW, y: surfaceY };

    const { r, g, b, alpha } = this.liquidColor;
    const liquidBaseColor = `rgba(${r}, ${g}, ${b}, ${Math.max(0.45, alpha || 0.6)})`;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pBaseL.x, pBaseL.y);
    ctx.lineTo(pBaseR.x, pBaseR.y);
    ctx.lineTo(liquidR.x, liquidR.y);
    const vortexDepth = (this.agitationLevel / 100) * (this.isCircularAgitation ? 16 : 10);
    ctx.quadraticCurveTo(cx + swirlOffset * 0.5, surfaceY + vortexDepth, liquidL.x, liquidL.y);
    ctx.closePath();
    ctx.clip();

    // Fondo del líquido general
    const liquidGrad = ctx.createLinearGradient(0, bottomY, 0, surfaceY);
    liquidGrad.addColorStop(0, liquidBaseColor);
    const topLuminance = Math.min(255, Math.round(r * 1.1 + 10));
    liquidGrad.addColorStop(1, `rgba(${topLuminance}, ${Math.min(255, Math.round(g * 1.1 + 10))}, ${Math.min(255, Math.round(b * 1.1 + 10))}, ${Math.max(0.25, (alpha || 0.6) * 0.85)})`);
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(cx - halfBase - 10, surfaceY - 10, baseW + 20, height);

    // ========================================================
    // EFECTO DE HETEROGENEIDAD / FALTA DE AGITACIÓN
    // ========================================================
    // Si hay reactivo sin mezclar, se dibuja una capa densa flotante estancada en la parte superior
    if (this.unmixedTitrantMl > 0.02 || this.reactionPlume > 0.05) {
      const pr = this.reactionPlumeColor?.r ?? 236;
      const pg = this.reactionPlumeColor?.g ?? 72;
      const pb = this.reactionPlumeColor?.b ?? 153;

      // Tapón o mancha estancada superior
      const unmixedAlpha = Math.min(0.95, 0.45 + (this.unmixedTitrantMl / 0.35) * 0.5);
      const layerHeight = 14 + Math.min(30, this.unmixedTitrantMl * 60);

      const unmixedGrad = ctx.createRadialGradient(
        cx + (swirlOffset * 0.3), surfaceY + 6, 2,
        cx + (swirlOffset * 0.3), surfaceY + layerHeight * 0.7, halfLiquidW * 0.85
      );
      unmixedGrad.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${unmixedAlpha})`);
      unmixedGrad.addColorStop(0.65, `rgba(${pr}, ${pg}, ${pb}, ${unmixedAlpha * 0.7})`);
      unmixedGrad.addColorStop(1, `rgba(${pr}, ${pg}, ${pb}, 0.05)`);

      ctx.fillStyle = unmixedGrad;
      ctx.beginPath();
      ctx.ellipse(cx + (swirlOffset * 0.3), surfaceY + 8, halfLiquidW * 0.9, layerHeight, 0, 0, Math.PI * 2);
      ctx.fill();

      // Indicador visual de capa no homogénea
      if (this.hasHomogenizationError) {
        ctx.strokeStyle = 'rgba(234, 108, 131, 0.8)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(cx, surfaceY + layerHeight, halfLiquidW * 0.8, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();

    // Ondas concéntricas en la superficie
    for (let rp of this.ripples) {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${rp.opacity * 0.8})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rp.radius, rp.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Menisco
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(cx, surfaceY, halfLiquidW, 4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Graduaciones técnicas
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#64748b';
    ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const marks = [
      { ml: 25, y: bottomY - (height * 0.42) },
      { ml: 50, y: bottomY - (height * 0.58) },
      { ml: 75, y: bottomY - (height * 0.72) }
    ];

    marks.forEach(m => {
      const frac = (bottomY - m.y) / (bottomY - neckStartY);
      const wAtY = halfBase - (halfBase - halfNeck) * frac;
      const markX = cx - wAtY + 4;

      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(markX, m.y);
      ctx.lineTo(markX + 16, m.y);
      ctx.stroke();

      ctx.fillText(`${m.ml} mL`, markX + 20, m.y);
    });

    // Vidrio exterior del matraz
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pRimL.x, pRimL.y);
    ctx.lineTo(pNeckL.x, pNeckL.y);
    ctx.lineTo(pBaseL.x, pBaseL.y);
    ctx.quadraticCurveTo(cx, bottomY + 3, pBaseR.x, pBaseR.y);
    ctx.lineTo(pNeckR.x, pNeckR.y);
    ctx.lineTo(pRimR.x, pRimR.y);
    ctx.stroke();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - halfNeck - 2, rimY - 3, neckW + 4, 4);

    // Brillo blanco specular
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - halfNeck + 4, neckStartY + 5);
    ctx.lineTo(cx - halfBase + 8, bottomY - 6);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Dibuja el efecto de salpicadura violenta sobre la lente/pantalla completa
   */
  drawScreenSplatterOverlay(ctx, w, h) {
    ctx.save();

    // Velo translúcido con desenfoque de choque
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(0, 0, w, h);

    // Dibujar gotas salpicadas en la pantalla
    this.screenSplatters.forEach(sp => {
      // Gota central
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rastro de escurrimiento hacia abajo
      if (sp.dripProgress > 0) {
        ctx.strokeStyle = sp.color;
        ctx.lineWidth = sp.radius * 0.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x, sp.y + sp.dripProgress);
        ctx.stroke();

        // Pequeña gota terminal que escurre
        ctx.beginPath();
        ctx.arc(sp.x, sp.y + sp.dripProgress, sp.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      // Brillo blanco en la gota del vidrio
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(sp.x - sp.radius * 0.3, sp.y - sp.radius * 0.3, sp.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Letrero técnico de vidrio comprometido
    ctx.restore();
  }
}

export { LabScene as TitrationScene };
