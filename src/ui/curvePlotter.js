/**
 * CurvePlotter - Graficador en Tiempo Real de la Curva de Titulación (pH vs mL)
 * Representación analítica continua con eje X (Volumen mL), eje Y (Sensor de pH 0-14),
 * zona de viraje del indicador, puntos de equivalencia y cursor dinámico en vivo.
 */

export class CurvePlotter {
  constructor(canvasId) {
    this.canvas = typeof canvasId === 'string'
      ? document.getElementById(canvasId)
      : canvasId;

    if (!this.canvas) {
      console.warn('CurvePlotter: Canvas no encontrado');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.points = [];
    this.equivalencePoints = [];
    this.indicatorRange = { min: 8.2, max: 10.0, color: 'rgba(236, 72, 153, 0.15)' };
    this.currentPoint = { v: 0, ph: 7.0 };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 280;
    this.height = rect.height || 160;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.render();
  }

  setIndicatorRange(minPh, maxPh, hexColor = '#ec4899') {
    this.indicatorRange = {
      min: minPh,
      max: maxPh,
      color: hexColor
    };
    this.render();
  }

  setEquivalencePoints(points = []) {
    this.equivalencePoints = points;
    this.render();
  }

  update(curveHistory, currentV, currentPh) {
    this.points = curveHistory || [];
    this.currentPoint = { v: currentV, ph: currentPh };
    this.render();
  }

  reset() {
    this.points = [];
    this.currentPoint = { v: 0, ph: 7.0 };
    this.render();
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Márgenes técnicos del gráfico
    const padL = 34;
    const padR = 14;
    const padT = 12;
    const padB = 24;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const mapX = (v) => padL + (Math.max(0, Math.min(50, v)) / 50.0) * plotW;
    const mapY = (ph) => padT + (1.0 - (Math.max(0, Math.min(14, ph)) / 14.0)) * plotH;

    // --- 1. Fondo y Cuadrícula ---
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(padL, padT, plotW, plotH, 4);
    ctx.fill();

    // Franja de Viraje del Indicador (Banda coloreada)
    if (this.indicatorRange) {
      const yMin = mapY(this.indicatorRange.max);
      const yMax = mapY(this.indicatorRange.min);
      const bandHeight = yMax - yMin;

      ctx.fillStyle = 'rgba(236, 72, 153, 0.12)';
      ctx.fillRect(padL, yMin, plotW, bandHeight);

      ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, yMin);
      ctx.lineTo(padL + plotW, yMin);
      ctx.moveTo(padL, yMax);
      ctx.lineTo(padL + plotW, yMax);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cuadrícula Horizontal (pH 0, 2, 4, 6, 7, 8, 10, 12, 14)
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '600 8.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const phLevels = [0, 2, 4, 6, 7, 8, 10, 12, 14];
    phLevels.forEach(val => {
      const y = mapY(val);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.strokeStyle = val === 7 ? '#cbd5e1' : (val % 4 === 0 ? '#e2e8f0' : '#f1f5f9');
      ctx.lineWidth = val === 7 ? 1.4 : 0.8;
      ctx.stroke();

      if (val % 2 === 0 || val === 7) {
        ctx.fillText(val.toString(), padL - 5, y);
      }
    });

    // Cuadrícula Vertical (mL 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const vSteps = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    vSteps.forEach(val => {
      const x = mapX(val);
      const isMajor = val % 10 === 0;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.strokeStyle = isMajor ? '#e2e8f0' : '#f8fafc';
      ctx.lineWidth = isMajor ? 1.0 : 0.6;
      ctx.stroke();

      if (isMajor) {
        ctx.fillText(`${val}`, x, padT + plotH + 5);
      }
    });

    // Ejes principales
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Etiquetas de los ejes
    ctx.font = '700 8px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText('pH', padL - 8, padT);
    ctx.textAlign = 'right';
    ctx.fillText('mL NaOH', padL + plotW, padT + plotH + 5);

    // --- 2. Puntos de Equivalencia Teóricos (Líneas verticales discontinuas) ---
    this.equivalencePoints.forEach((pt, idx) => {
      if (pt.v > 0 && pt.v <= 50) {
        const x = mapX(pt.v);
        ctx.save();
        ctx.strokeStyle = '#58a379';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Badge Veq
        ctx.fillStyle = '#eaf4ee';
        ctx.strokeStyle = '#58a379';
        ctx.lineWidth = 0.8;
        const tagText = `Veq${idx + 1 || ''}: ${pt.v.toFixed(1)}`;
        ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
        const tagW = ctx.measureText(tagText).width + 6;
        ctx.beginPath();
        ctx.roundRect(x - tagW / 2, padT + 2 + (idx * 13), tagW, 11, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#488f66';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, x, padT + 7.5 + (idx * 13));
        ctx.restore();
      }
    });

    // --- 3. Trazo en Vivo de la Curva (Puntos agregados) ---
    if (this.points.length > 0) {
      ctx.save();
      ctx.beginPath();
      const firstX = mapX(this.points[0].v);
      const firstY = mapY(this.points[0].ph);
      ctx.moveTo(firstX, firstY);

      for (let i = 1; i < this.points.length; i++) {
        const pt = this.points[i];
        const px = mapX(pt.v);
        const py = mapY(pt.ph);
        ctx.lineTo(px, py);
      }

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      // Gradiente suave bajo la curva
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(firstX, mapY(0));
      ctx.lineTo(firstX, firstY);
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(mapX(this.points[i].v), mapY(this.points[i].ph));
      }
      const lastPt = this.points[this.points.length - 1];
      ctx.lineTo(mapX(lastPt.v), mapY(0));
      ctx.closePath();

      const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      areaGrad.addColorStop(0, 'rgba(2, 132, 199, 0.18)');
      areaGrad.addColorStop(1, 'rgba(2, 132, 199, 0.01)');
      ctx.fillStyle = areaGrad;
      ctx.fill();
      ctx.restore();
    }

    // --- 4. Marcador Actual (Cursor en Tiempo Real) ---
    const curX = mapX(this.currentPoint.v);
    const curY = mapY(this.currentPoint.ph);

    // Halo animado
    ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Punto central
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(curX, curY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(curX, curY, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

