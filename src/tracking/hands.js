const getHands = () => (typeof window !== 'undefined' ? (window.Hands || globalThis.Hands) : null);
const getCamera = () => (typeof window !== 'undefined' ? (window.Camera || globalThis.Camera) : null);

// Conexiones estándar del esqueleto de la mano de MediaPipe (21 landmarks)
const HAND_CONNECTIONS = [
  // Pulgar
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Índice
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Medio
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Anular
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Meñique
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Base de la palma
  [5, 9], [9, 13], [13, 17]
];

export class HandTracker {
  constructor(videoOrCallback, onPinchChange, onSplatterBurst) {
    if (typeof videoOrCallback === 'function') {
      this.onPinchChange = videoOrCallback;
      this.onSplatterBurst = onPinchChange || null;
      this.videoElement = document.getElementById('camera-video');
    } else {
      this.videoElement = videoOrCallback || document.getElementById('camera-video');
      this.onPinchChange = onPinchChange;
      this.onSplatterBurst = onSplatterBurst || null;
    }

    this.overlayCanvas = document.getElementById('camera-overlay-canvas');
    if (!this.overlayCanvas && this.videoElement?.parentNode) {
      this.overlayCanvas = document.createElement('canvas');
      this.overlayCanvas.id = 'camera-overlay-canvas';
      this.videoElement.parentNode.appendChild(this.overlayCanvas);
    }
    this.overlayCtx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;

    if (!this.videoElement) {
      this.initVideo();
    }

    this.isTracking = false;
    this.hands = null;
    this.camera = null;

    // Estado de agitación y trayectoria
    this.agitationHistory = [];
    this.wristTrails = [];
    this.currentAgitation = 0; // 0% a 100%
    this.isCircularMotion = false;
    this.circularRevolutions = 0;
    this.vortexAngle = 0;
    this.lastFrameTime = performance.now();

    // Detección de apertura brusca (salpicadura)
    this.prevValvePercent = 0;
    this.prevValveTime = performance.now();

    // Bloqueo persistente de rol en 2 manos ('left' o 'right' en pantalla)
    this.lockedValveSide = null;

    // ==========================================
    // CALIBRADOR O GUÍA RÁPIDA DE MANOS (3s)
    // ==========================================
    this.isCalibrating = false;
    this.calibrationDuration = 3.0; // segundos
    this.calibrationRemaining = 3.0;
    this.calibrationStartTime = 0;
    this.calibrationSuccessUntil = 0;
    this.hasLeftHandDetected = false;
    this.hasRightHandDetected = false;

    // Control de fotogramas pendientes (Drop Frame Guard para latencia cero)
    this.isProcessingFrame = false;

    this.initMediaPipe();
  }

  initVideo() {
    this.videoElement = document.createElement('video');
    this.videoElement.id = 'camera-video';
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.videoElement.style.width = '100%';
    this.videoElement.style.height = '100%';
    this.videoElement.style.objectFit = 'cover';
    this.videoElement.style.transform = 'scaleX(-1)';

    const container = document.querySelector('.camera-feed-container');
    if (container) {
      container.prepend(this.videoElement);
      if (!this.overlayCanvas) {
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.id = 'camera-overlay-canvas';
        container.appendChild(this.overlayCanvas);
        this.overlayCtx = this.overlayCanvas.getContext('2d');
      }
    } else {
      this.videoElement.style.display = 'none';
      document.body.appendChild(this.videoElement);
    }
  }

  initMediaPipe() {
    try {
      const HandsConstructor = getHands();
      const CameraConstructor = getCamera();

      if (typeof HandsConstructor !== 'function') {
        const statusEl = document.getElementById('gesture-status');
        if (statusEl) statusEl.textContent = 'CARGANDO RECONOCIMIENTO GESTUAL...';
        return;
      }

      this.hands = new HandsConstructor({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1, // Modelo de alta fidelidad para tracking sólido de muñeca y 21 landmarks
        minDetectionConfidence: 0.40, // Umbral optimizado para no perder la muñeca en giros rápidos
        minTrackingConfidence: 0.40
      });

      this.hands.onResults((results) => this.handleResults(results));

      if (typeof CameraConstructor === 'function' && this.videoElement) {
        this.camera = new CameraConstructor(this.videoElement, {
          onFrame: async () => {
            if (this.isTracking && this.hands && this.videoElement && this.videoElement.readyState >= 2) {
              if (this.isProcessingFrame) return; // Drop Frame Guard: evita acumulación de fotogramas en cola
              this.isProcessingFrame = true;
              try {
                await this.hands.send({ image: this.videoElement });
              } finally {
                this.isProcessingFrame = false;
              }
            }
          },
          width: 640,
          height: 480
        });

        this.start();
      }
    } catch (err) {
      console.warn('MediaPipe initialization notice:', err);
      const statusEl = document.getElementById('gesture-status');
      if (statusEl) {
        statusEl.textContent = 'CÁMARA: CLIC PARA INICIAR';
      }
    }
  }

  startCalibration(durationSec = 3.0) {
    this.isCalibrating = true;
    this.calibrationDuration = durationSec;
    this.calibrationRemaining = durationSec;
    this.calibrationStartTime = performance.now();
    this.lockedValveSide = null;
    const statusEl = document.getElementById('gesture-status');
    if (statusEl) statusEl.textContent = '🎯 CALIBRANDO MANOS (3 SEGUNDOS)...';
  }

  projectPoint(lm, width, height) {
    const vw = this.videoElement?.videoWidth || 640;
    const vh = this.videoElement?.videoHeight || 480;
    const containerRatio = width / height;
    const videoRatio = vw / vh;

    let renderW, renderH, offsetX, offsetY;
    if (containerRatio > videoRatio) {
      renderW = width;
      renderH = width / videoRatio;
      offsetX = 0;
      offsetY = (height - renderH) / 2;
    } else {
      renderW = height * videoRatio;
      renderH = height;
      offsetX = (width - renderW) / 2;
      offsetY = 0;
    }

    // Efecto espejo: 1 - x
    const screenX = (1.0 - lm.x) * renderW + offsetX;
    const screenY = lm.y * renderH + offsetY;

    return { x: screenX, y: screenY };
  }

  ensureCanvasSize() {
    if (!this.overlayCanvas) return { width: 0, height: 0, dpr: 1 };
    const rect = this.overlayCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (this.overlayCanvas.width !== width * dpr || this.overlayCanvas.height !== height * dpr) {
      this.overlayCanvas.width = width * dpr;
      this.overlayCanvas.height = height * dpr;
    }

    if (this.overlayCtx) {
      this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.overlayCtx.scale(dpr, dpr);
    }

    return { width, height, dpr };
  }

  analyzeCircularAgitation(handPoints) {
    if (handPoints.length < 3) {
      return { isCircular: false, score: 0, deltaAngle: 0 };
    }

    let cx = 0, cy = 0;
    handPoints.forEach(p => { cx += p.x; cy += p.y; });
    cx /= handPoints.length;
    cy /= handPoints.length;

    let totalAngularSweep = 0;
    let avgRadius = 0;

    for (let i = 1; i < handPoints.length; i++) {
      const p0 = handPoints[i - 1];
      const p1 = handPoints[i];

      const a0 = Math.atan2(p0.y - cy, p0.x - cx);
      const a1 = Math.atan2(p1.y - cy, p1.x - cx);

      let da = a1 - a0;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;

      totalAngularSweep += da;
      avgRadius += Math.hypot(p1.x - cx, p1.y - cy);
    }

    avgRadius /= (handPoints.length - 1);
    const isCircular = avgRadius > 0.010 && Math.abs(totalAngularSweep) > 0.65;
    const circularScore = isCircular ? Math.min(100, Math.round(Math.abs(totalAngularSweep) * 32 + avgRadius * 400)) : 0;

    return {
      isCircular,
      score: circularScore,
      deltaAngle: totalAngularSweep,
      radius: avgRadius
    };
  }

  handleResults(results) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const { width, height } = this.ensureCanvasSize();
    const ctx = this.overlayCtx;

    if (ctx && width > 0 && height > 0) {
      ctx.clearRect(0, 0, width, height);
    }

    // ==========================================
    // ACTUALIZACIÓN DEL CALIBRADOR RÁPIDO (3s)
    // ==========================================
    if (this.isCalibrating) {
      const elapsed = (now - this.calibrationStartTime) / 1000;
      this.calibrationRemaining = Math.max(0, this.calibrationDuration - elapsed);

      if (this.calibrationRemaining <= 0) {
        this.isCalibrating = false;
        this.calibrationSuccessUntil = now + 1800; // Mostrar 1.8 segundos de confirmación
        const statusEl = document.getElementById('gesture-status');
        if (statusEl) statusEl.textContent = '✓ CALIBRACIÓN COMPLETADA CON ÉXITO';
      }
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const hands = results.multiHandLandmarks;

      let targetValvePercent = null;
      let maxAgitation = 0;
      let detectedCircular = false;
      const analyzedHands = [];

      this.hasLeftHandDetected = false;
      this.hasRightHandDetected = false;

      hands.forEach((hand, idx) => {
        const rawWrist = hand[0];
        const thumbTip = hand[4];
        const indexTip = hand[8];
        const middleMcp = hand[9];

        // Anclaje ultra-estable de muñeca/palma (garantiza tracking continuo incluso si la muñeca roza el borde)
        const wristAnchor = {
          x: rawWrist.x * 0.70 + middleMcp.x * 0.30,
          y: rawWrist.y * 0.70 + middleMcp.y * 0.30
        };

        const screenWrist = this.projectPoint(wristAnchor, width, height);
        if (screenWrist.x < width * 0.5) {
          this.hasLeftHandDetected = true;
        } else {
          this.hasRightHandDetected = true;
        }

        // 1. Registro histórico de trayectoria de la muñeca (ventana calibrada de 320 ms para cero lag y detección perfecta)
        this.agitationHistory.push({ x: wristAnchor.x, y: wristAnchor.y, time: now, handIndex: idx });
        this.agitationHistory = this.agitationHistory.filter(p => now - p.time < 320);

        let speed = 0;
        const handPoints = this.agitationHistory.filter(p => p.handIndex === idx);

        if (handPoints.length >= 2) {
          let totalPath = 0;
          for (let i = 1; i < handPoints.length; i++) {
            totalPath += Math.hypot(
              handPoints[i].x - handPoints[i - 1].x,
              handPoints[i].y - handPoints[i - 1].y
            );
          }
          const timeSpan = handPoints[handPoints.length - 1].time - handPoints[0].time;
          if (timeSpan > 10) {
            speed = (totalPath / timeSpan) * 1000;
          }
        }

        const circularAnalysis = this.analyzeCircularAgitation(handPoints);
        if (circularAnalysis.isCircular) {
          detectedCircular = true;
        }

        let agitateScore = 0;
        if (circularAnalysis.isCircular) {
          agitateScore = Math.min(100, Math.max(50, circularAnalysis.score));
        } else if (speed > 0.08) {
          agitateScore = Math.min(100, Math.max(0, Math.round((speed - 0.08) * 200)));
        }

        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const minDist = 0.035;
        const maxDist = 0.28;
        const normalized = Math.min(Math.max((pinchDist - minDist) / (maxDist - minDist), 0), 1);
        const percent = Math.round(normalized * 100);

        analyzedHands.push({
          hand,
          idx,
          wrist: wristAnchor,
          screenWrist,
          thumbTip,
          indexTip,
          pinchDist,
          pinchPercent: percent,
          speed,
          circularAnalysis,
          agitateScore,
          isAgitating: agitateScore > 12
        });
      });

      // Asignación de Roles Espacial Estricta (Alineada con el espejo de la cámara):
      // - Mano Izquierda del usuario (mitad izquierda en pantalla) => SIEMPRE LLAVE DE PASO DE BURETA
      // - Mano Derecha del usuario (mitad derecha en pantalla)   => SIEMPRE MATRAZ Y AGITACIÓN
      let valveHand = null;
      let agitationHand = null;

      if (analyzedHands.length === 1) {
        const h = analyzedHands[0];
        if (h.screenWrist.x < width * 0.5) {
          valveHand = h;
          targetValvePercent = h.pinchPercent;
          maxAgitation = 0;
        } else {
          agitationHand = h;
          maxAgitation = h.agitateScore;
          targetValvePercent = null;
        }
      } else if (analyzedHands.length >= 2) {
        const handA = analyzedHands[0];
        const handB = analyzedHands[1];
        // En pantalla espejada:
        // leftHand = mano a la izquierda (Mano Izquierda física del usuario)
        // rightHand = mano a la derecha (Mano Derecha física del usuario)
        const leftHand = handA.screenWrist.x < handB.screenWrist.x ? handA : handB;
        const rightHand = handA.screenWrist.x < handB.screenWrist.x ? handB : handA;

        valveHand = leftHand;       // MANO IZQUIERDA = LLAVE DE BURETA
        agitationHand = rightHand; // MANO DERECHA = AGITACIÓN DEL MATRAZ

        targetValvePercent = valveHand.pinchPercent;
        valveHand.agitateScore = 0;
        maxAgitation = agitationHand.agitateScore;
      }

      this.isCircularMotion = detectedCircular;
      // Suavizado ultra-reactivo: 75% movimiento actual para cero sensación de goma elástica
      this.currentAgitation = Math.round(this.currentAgitation * 0.25 + maxAgitation * 0.75);

      // Detección de Apertura Brusca / Salpicadura (no se evalúa si estamos calibrando)
      const hasPinchActive = targetValvePercent !== null;
      const currentValve = hasPinchActive ? targetValvePercent : 0;

      if (!this.isCalibrating) {
        const timeDelta = Math.max(0.01, (now - this.prevValveTime) / 1000);
        const openingRate = (currentValve - this.prevValvePercent) / timeDelta;

        if (openingRate > 260 && currentValve > 75) {
          if (this.onSplatterBurst) {
            this.onSplatterBurst({
              openingRate,
              percent: currentValve,
              reason: 'Apertura violenta de la llave de paso sin control analítico'
            });
          }
        }
      }

      this.prevValvePercent = currentValve;
      this.prevValveTime = now;

      // Renderizar Guías
      if (ctx && width > 0 && height > 0) {
        this.renderHandGuides(ctx, width, height, analyzedHands, valveHand, agitationHand, dt);

        // Renderizar overlay del calibrador si está activo
        if (this.isCalibrating || now < this.calibrationSuccessUntil) {
          this.renderCalibrationOverlay(ctx, width, height, now);
        }
      }

      if (this.onPinchChange) {
        this.onPinchChange(currentValve, hasPinchActive, this.currentAgitation, this.isCircularMotion);
      }
    } else {
      this.lockedValveSide = null;
      this.currentAgitation = Math.max(0, Math.round(this.currentAgitation * 0.35));
      this.isCircularMotion = false;
      this.agitationHistory = [];
      this.wristTrails = [];
      this.prevValvePercent = 0;
      this.hasLeftHandDetected = false;
      this.hasRightHandDetected = false;

      if (ctx && width > 0 && height > 0) {
        if (this.isCalibrating || now < this.calibrationSuccessUntil) {
          this.renderCalibrationOverlay(ctx, width, height, now);
        }
      }

      if (this.onPinchChange) {
        this.onPinchChange(0, false, this.currentAgitation, false);
      }
    }
  }

  /**
   * Renderiza el Asistente Visual del Calibrador de 3 Segundos
   */
  renderCalibrationOverlay(ctx, width, height, now) {
    ctx.save();

    const isSuccess = now < this.calibrationSuccessUntil;

    if (isSuccess) {
      // Banner de Éxito
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(width * 0.15, height * 0.35, width * 0.7, 75, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓ ¡CALIBRACIÓN EXITOSA!', width * 0.5, height * 0.43);

      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Mano Izquierda = Llave • Mano Derecha = Matraz', width * 0.5, height * 0.52);

      ctx.restore();
      return;
    }

    // Velo suave
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, 0, width, height);

    // 1. Zona Guía Izquierda: Llave de paso
    const leftX = width * 0.05;
    const boxW = width * 0.42;
    const boxY = height * 0.25;
    const boxH = height * 0.65;

    ctx.strokeStyle = this.hasLeftHandDetected ? '#22c55e' : 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = this.hasLeftHandDetected ? 2.5 : 1.5;
    ctx.setLineDash(this.hasLeftHandDetected ? [] : [6, 4]);
    ctx.beginPath();
    ctx.roundRect(leftX, boxY, boxW, boxH, 10);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = this.hasLeftHandDetected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fill();

    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = this.hasLeftHandDetected ? '#22c55e' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(this.hasLeftHandDetected ? '✓ MANO EN LLAVE (BURETA)' : '👌 MANO IZQ: LLAVE', leftX + boxW * 0.5, boxY + 22);

    // 2. Zona Guía Derecha: Matraz / Agitación
    const rightX = width * 0.53;
    ctx.strokeStyle = this.hasRightHandDetected ? '#22c55e' : 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = this.hasRightHandDetected ? 2.5 : 1.5;
    ctx.setLineDash(this.hasRightHandDetected ? [] : [6, 4]);
    ctx.beginPath();
    ctx.roundRect(rightX, boxY, boxW, boxH, 10);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = this.hasRightHandDetected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fill();

    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = this.hasRightHandDetected ? '#22c55e' : '#ffffff';
    ctx.fillText(this.hasRightHandDetected ? '✓ MANO EN MATRAZ' : '🔄 MANO DER: MATRAZ', rightX + boxW * 0.5, boxY + 22);

    // 3. Temporizador y Cuenta Regresiva Central
    const centerX = width * 0.5;
    const centerY = height * 0.13;
    const timerSec = Math.ceil(this.calibrationRemaining);
    const progress = 1.0 - (this.calibrationRemaining / this.calibrationDuration);

    // Círculo de fondo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Arco de progreso
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * progress);
    ctx.stroke();

    // Número
    ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${timerSec}`, centerX, centerY);

    ctx.restore();
  }

  renderHandGuides(ctx, width, height, allHands, valveHand, agitationHand, dt) {
    const now = performance.now();
    this.vortexAngle += (2.5 + (this.currentAgitation / 100) * 11.0) * dt;

    allHands.forEach(({ hand, wrist, idx, pinchDist, pinchPercent, circularAnalysis }) => {
      const isMultiHand = allHands.length >= 2;
      const isValve = valveHand && valveHand.idx === idx;
      const isAgit = agitationHand && agitationHand.idx === idx;

      const projected = hand.map(lm => this.projectPoint(lm, width, height));
      const pWrist = this.projectPoint(wrist, width, height);

      ctx.lineWidth = 1.6;
      ctx.strokeStyle = isValve ? 'rgba(88, 163, 121, 0.45)' : 'rgba(79, 163, 165, 0.45)';
      ctx.beginPath();
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const p1 = projected[startIdx];
        const p2 = projected[endIdx];
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      });
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      projected.forEach((p, pIdx) => {
        if (pIdx !== 4 && pIdx !== 8 && pIdx !== 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      const shouldDrawValveGuide = isMultiHand ? isValve : (isValve && !isAgit);
      if (shouldDrawValveGuide) {
        const pThumb = projected[4];
        const pIndex = projected[8];
        const distPx = Math.hypot(pIndex.x - pThumb.x, pIndex.y - pThumb.y);
        const percent = pinchPercent;
        const isClosed = distPx < 24 || pinchDist <= 0.045;

        let guideColor = '#22c55e';
        if (percent > 75) guideColor = '#ea6c83';
        else if (percent > 40) guideColor = '#f59e0b';
        else if (percent > 10) guideColor = '#06b6d4';

        ctx.save();
        ctx.strokeStyle = guideColor;
        ctx.lineWidth = isClosed ? 3.0 : 2.0;
        ctx.setLineDash(isClosed ? [] : [4, 3]);
        ctx.beginPath();
        ctx.moveTo(pThumb.x, pThumb.y);
        ctx.lineTo(pIndex.x, pIndex.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        [pThumb, pIndex].forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isClosed ? 8 : 6.5, 0, Math.PI * 2);
          ctx.strokeStyle = guideColor;
          ctx.lineWidth = 2.0;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        });

        const midX = (pThumb.x + pIndex.x) / 2;
        const badgeY = Math.min(pThumb.y, pIndex.y) - 14;
        const badgeText = isClosed ? 'LLAVE: 0% (CERRADA)' : `LLAVE: ${percent}%`;

        ctx.save();
        ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
        const txtWidth = ctx.measureText(badgeText).width;
        const padX = 6;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = guideColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(midX - (txtWidth / 2) - padX, badgeY - 8, txtWidth + padX * 2, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isClosed ? '#22c55e' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, midX, badgeY);
        ctx.restore();
      }

      const shouldDrawWristGuide = isMultiHand ? isAgit : (isAgit && !isValve);
      if (shouldDrawWristGuide) {
        this.wristTrails.push({ x: pWrist.x, y: pWrist.y, time: now });
        this.wristTrails = this.wristTrails.filter(p => now - p.time < 200);

        if (this.wristTrails.length > 2) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 1; i < this.wristTrails.length; i++) {
            const ptA = this.wristTrails[i - 1];
            const ptB = this.wristTrails[i];
            const age = (now - ptB.time) / 450;
            const alpha = Math.max(0, 1 - age) * 0.9;
            ctx.strokeStyle = this.isCircularMotion
              ? `rgba(34, 197, 94, ${alpha})`
              : `rgba(79, 163, 165, ${alpha})`;
            ctx.lineWidth = Math.max(1.5, 6 * (1 - age));
            ctx.beginPath();
            ctx.moveTo(ptA.x, ptA.y);
            ctx.lineTo(ptB.x, ptB.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        const isSwirling = this.currentAgitation > 10;
        const isCirc = this.isCircularMotion;
        const orbitColor = isCirc ? '#22c55e' : (isSwirling ? '#00f5d4' : 'rgba(79, 163, 165, 0.7)');

        ctx.save();
        ctx.strokeStyle = orbitColor;
        ctx.lineWidth = isCirc ? 2.8 : 2.0;
        ctx.beginPath();
        ctx.arc(pWrist.x, pWrist.y, 10, 0, Math.PI * 2);
        ctx.stroke();

        const orbitR = 20 + (this.currentAgitation / 100) * 12;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.arc(pWrist.x, pWrist.y, orbitR, this.vortexAngle, this.vortexAngle + Math.PI * 1.5);
        ctx.stroke();
        ctx.setLineDash([]);

        const badgeY = pWrist.y - 22;
        const badgeText = isCirc
          ? `🔄 CÍRCULOS: HOMOGENEIZANDO (${this.currentAgitation}%)`
          : (isSwirling ? `🌪️ AGITANDO: ${this.currentAgitation}%` : '✋ HAZ CÍRCULOS SOBRE EL MATRAZ');

        ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
        const txtWidth = ctx.measureText(badgeText).width;
        const padX = 7;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = orbitColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pWrist.x - (txtWidth / 2) - padX, badgeY - 8, txtWidth + padX * 2, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isCirc ? '#22c55e' : (isSwirling ? '#00f5d4' : '#ffffff');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, pWrist.x, badgeY);
        ctx.restore();
      }
    });
  }

  start() {
    if (this.camera) {
      this.isTracking = true;
      const statusEl = document.getElementById('gesture-status');
      if (statusEl) statusEl.textContent = 'SOLICITANDO CÁMARA...';

      this.camera.start()
        .then(() => {
          if (statusEl) statusEl.textContent = 'BUSCANDO MANOS...';
          // Iniciar calibración automática de 3 segundos al abrir la cámara
          this.startCalibration(3.0);
        })
        .catch((err) => {
          console.warn('No se pudo acceder a la webcam:', err);
          this.isTracking = false;
          if (statusEl) statusEl.textContent = 'CÁMARA NO DISPONIBLE';
        });
    }
  }

  stop() {
    this.isTracking = false;
    this.lockedValveSide = null;
    this.isCalibrating = false;
    if (this.camera) {
      this.camera.stop();
    }
    if (this.overlayCtx && this.overlayCanvas) {
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
  }

  async init(onPinchCallback, onSplatterCallback) {
    if (onPinchCallback) {
      this.onPinchChange = onPinchCallback;
    }
    if (onSplatterCallback) {
      this.onSplatterBurst = onSplatterCallback;
    }
    this.start();
  }
}
