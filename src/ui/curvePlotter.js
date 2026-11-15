/**
 * CurvePlotter - Graficador en Tiempo Real de la Curva de Titulación (pH vs mL)
 * Modos analíticos:
 * 1. Curva Directa (pH vs mL): Curva sigmoidea, banda de viraje del indicador y puntos de equivalencia.
 * 2. 1ª Derivada (dpH / dV): Detección del pico máximo en el punto de inflexión estequiométrico.
 * 3. 2ª Derivada (d²pH / dV²): Cruce por cero exacto para identificación instrumental del viraje.
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
    this.mode = 'normal'; // 'normal' | 'deriv1' | 'deriv2'

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

  setMode(mode) {
    if (['normal', 'deriv1', 'deriv2'].includes(mode)) {
      this.mode = mode;
      this.render();
    }
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

  /**
   * Calcula numéricamente la 1ª derivada (dpH / dV) mediante diferencias finitas
   */
  computeFirstDerivative() {
    const pts = this.points;
    if (pts.length < 2) return [];

    const d1 = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dv = p2.v - p1.v;
      if (dv > 0.005) {
        const dph = p2.ph - p1.ph;
        const vMid = (p1.v + p2.v) / 2.0;
        const val = dph / dv;
        d1.push({ v: vMid, val: Math.max(0, val) });
      }
    }
    return d1;
  }

  /**
   * Calcula numéricamente la 2ª derivada (d²pH / dV²) a partir de la 1ª derivada
   */
  computeSecondDerivative() {
    const d1 = this.computeFirstDerivative();
    if (d1.length < 2) return [];

    const d2 = [];
    for (let i = 0; i < d1.length - 1; i++) {
      const p1 = d1[i];
      const p2 = d1[i + 1];
      const dv = p2.v - p1.v;
      if (dv > 0.005) {
        const dVal = p2.val - p1.val;
        const vMid = (p1.v + p2.v) / 2.0;
        const val = dVal / dv;
        // Limitar valores extremos para estabilidad gráfica
        d2.push({ v: vMid, val: Math.max(-250, Math.min(250, val)) });
      }
    }
    return d2;
  }

  render() {
    if (!this.ctx || !this.canvas) return;

    if (this.mode === 'deriv1') {
      this.renderFirstDerivative();
    } else if (this.mode === 'deriv2') {
      this.renderSecondDerivative();
    } else {
      this.renderNormalCurve();
    }
  }

  /**
   * 1. Render de la Curva Normal de Titulación (pH vs mL)
   */
  renderNormalCurve() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const padL = 34;
    const padR = 14;
    const padT = 12;
    const padB = 24;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const mapX = (v) => padL + (Math.max(0, Math.min(50, v)) / 50.0) * plotW;
    const mapY = (ph) => padT + (1.0 - (Math.max(0, Math.min(14, ph)) / 14.0)) * plotH;

    // Fondo
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(padL, padT, plotW, plotH, 4);
    ctx.fill();

    // Banda del Indicador
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

    // Cuadrícula Horizontal (pH 0 a 14)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '600 8.5px "Plus Jakarta Sans", sans-serif';

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
        ctx.fillStyle = val === 7 ? '#475569' : '#64748b';
        ctx.fillText(val.toString(), padL - 5, y);
      }
    });

    // Cuadrícula Vertical (mL 0 a 50)
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
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${val}`, x, padT + plotH + 5);
      }
    });

    // Ejes
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Etiquetas de ejes
    ctx.font = '700 8px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText('pH', padL - 8, padT);
    ctx.fillText('mL', padL + plotW, padT + plotH + 5);

    // Puntos de equivalencia teóricos
    this.equivalencePoints.forEach((pt, idx) => {
      if (pt.v > 0 && pt.v <= 50) {
        const x = mapX(pt.v);
        ctx.save();
        ctx.strokeStyle = '#58a379';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tag Veq
        ctx.fillStyle = '#eaf4ee';
        ctx.strokeStyle = '#58a379';
        ctx.lineWidth = 0.8;
        const tagText = `Veq${idx > 0 ? idx + 1 : ''}: ${pt.v.toFixed(1)}`;
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

    // Trazo de la curva de titulación
    if (this.points.length > 0) {
      ctx.save();
      ctx.beginPath();
      const firstX = mapX(this.points[0].v);
      const firstY = mapY(this.points[0].ph);
      ctx.moveTo(firstX, firstY);

      for (let i = 1; i < this.points.length; i++) {
        const pt = this.points[i];
        ctx.lineTo(mapX(pt.v), mapY(pt.ph));
      }

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Relleno degradado
      ctx.lineTo(mapX(this.points[this.points.length - 1].v), mapY(0));
      ctx.lineTo(firstX, mapY(0));
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      areaGrad.addColorStop(0, 'rgba(2, 132, 199, 0.16)');
      areaGrad.addColorStop(1, 'rgba(2, 132, 199, 0.01)');
      ctx.fillStyle = areaGrad;
      ctx.fill();
      ctx.restore();
    }

    // Cursor actual
    const curX = mapX(this.currentPoint.v);
    const curY = mapY(this.currentPoint.ph);
    ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(curX, curY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(curX, curY, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 2. Render de la 1ª Derivada: dpH / dV vs mL
   * El pico máximo identifica el punto de equivalencia estequiométrico exacto
   */
  renderFirstDerivative() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const padL = 36;
    const padR = 14;
    const padT = 12;
    const padB = 24;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const d1Data = this.computeFirstDerivative();

    // Determinar escala máxima Y de la 1ª derivada
    let maxVal = 10;
    let peakPoint = null;
    d1Data.forEach(p => {
      if (p.val > maxVal) maxVal = p.val;
      if (!peakPoint || p.val > peakPoint.val) {
        peakPoint = p;
      }
    });
    maxVal = Math.ceil(maxVal * 1.18);

    const mapX = (v) => padL + (Math.max(0, Math.min(50, v)) / 50.0) * plotW;
    const mapY = (val) => padT + (1.0 - (Math.max(0, Math.min(maxVal, val)) / maxVal)) * plotH;

    // Fondo
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(padL, padT, plotW, plotH, 4);
    ctx.fill();

    // Cuadrícula Horizontal
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '600 8px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#64748b';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const val = Math.round((maxVal / yTicks) * i);
      const y = mapY(val);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillText(val.toString(), padL - 5, y);
    }

    // Cuadrícula Vertical (mL)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const vSteps = [0, 10, 20, 30, 40, 50];
    vSteps.forEach(val => {
      const x = mapX(val);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillText(`${val}`, x, padT + plotH + 5);
    });

    // Ejes
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#8b5cf6';
    ctx.textAlign = 'left';
    ctx.fillText('dpH/dV', padL + 3, padT + 7);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText('mL', padL + plotW, padT + plotH + 5);

    // Trazo de la 1ª Derivada
    if (d1Data.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(mapX(d1Data[0].v), mapY(d1Data[0].val));

      for (let i = 1; i < d1Data.length; i++) {
        ctx.lineTo(mapX(d1Data[i].v), mapY(d1Data[i].val));
      }

      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Relleno degradado púrpura
      ctx.lineTo(mapX(d1Data[d1Data.length - 1].v), mapY(0));
      ctx.lineTo(mapX(d1Data[0].v), mapY(0));
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      areaGrad.addColorStop(0, 'rgba(139, 92, 246, 0.22)');
      areaGrad.addColorStop(1, 'rgba(139, 92, 246, 0.01)');
      ctx.fillStyle = areaGrad;
      ctx.fill();
      ctx.restore();
    }

    // Resaltar Pico Máximo
    if (peakPoint && peakPoint.val > 2.0) {
      const px = mapX(peakPoint.v);
      const py = mapY(peakPoint.val);

      ctx.save();
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Línea vertical punteada al eje X
      ctx.strokeStyle = '#8b5cf6';
      ctx.setLineDash([3, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Badge informativo del pico
      const badgeText = `Pico Veq: ${peakPoint.v.toFixed(1)} mL`;
      ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
      const bW = ctx.measureText(badgeText).width + 8;
      const bX = Math.min(padL + plotW - bW, Math.max(padL, px - bW / 2));
      const bY = Math.max(padT + 4, py - 16);

      ctx.fillStyle = '#ede9fe';
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(bX, bY, bW, 12, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6d28d9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bX + bW / 2, bY + 6);
      ctx.restore();
    } else {
      // Mensaje de estado inicial
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 8px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Añade volumen para generar la curva diferencial', padL + plotW / 2, padT + plotH / 2);
    }
  }

  /**
   * 3. Render de la 2ª Derivada: d²pH / dV² vs mL
   * El punto de cruce por cero (y = 0) indica el punto exacto de viraje
   */
  renderSecondDerivative() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const padL = 36;
    const padR = 14;
    const padT = 12;
    const padB = 24;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const d2Data = this.computeSecondDerivative();

    // Rango simétrico en Y
    let maxAbs = 25;
    d2Data.forEach(p => {
      const a = Math.abs(p.val);
      if (a > maxAbs) maxAbs = a;
    });
    maxAbs = Math.ceil(maxAbs * 1.15);

    const mapX = (v) => padL + (Math.max(0, Math.min(50, v)) / 50.0) * plotW;
    const mapY = (val) => padT + (0.5 - (val / (maxAbs * 2.0))) * plotH;

    // Fondo
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(padL, padT, plotW, plotH, 4);
    ctx.fill();

    // Línea de Cero Central (Eje Neutro de Inflexión)
    const zeroY = mapY(0);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(padL, zeroY);
    ctx.lineTo(padL + plotW, zeroY);
    ctx.stroke();

    // Cuadrícula Horizontal
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '600 7.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#64748b';

    [maxAbs, Math.round(maxAbs / 2), 0, -Math.round(maxAbs / 2), -maxAbs].forEach(val => {
      const y = mapY(val);
      if (val !== 0) {
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + plotW, y);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.fillText(val > 0 ? `+${val}` : `${val}`, padL - 5, y);
    });

    // Cuadrícula Vertical (mL)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const vSteps = [0, 10, 20, 30, 40, 50];
    vSteps.forEach(val => {
      const x = mapX(val);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillText(`${val}`, x, padT + plotH + 5);
    });

    // Ejes
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'left';
    ctx.fillText('d²pH/dV²', padL + 3, padT + 7);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText('mL', padL + plotW, padT + plotH + 5);

    // Trazo de la 2ª Derivada
    if (d2Data.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(mapX(d2Data[0].v), mapY(d2Data[0].val));

      for (let i = 1; i < d2Data.length; i++) {
        ctx.lineTo(mapX(d2Data[i].v), mapY(d2Data[i].val));
      }

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      // Detectar y resaltar el cruce por cero
      let zeroCrossing = null;
      for (let i = 0; i < d2Data.length - 1; i++) {
        if (d2Data[i].val > 0 && d2Data[i + 1].val <= 0) {
          const frac = d2Data[i].val / (d2Data[i].val - d2Data[i + 1].val);
          zeroCrossing = d2Data[i].v + frac * (d2Data[i + 1].v - d2Data[i].v);
          break;
        }
      }

      if (zeroCrossing !== null) {
        const zX = mapX(zeroCrossing);
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(zX, zeroY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(zX, padT);
        ctx.lineTo(zX, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        const badgeText = `Inflexión: ${zeroCrossing.toFixed(2)} mL`;
        ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
        const bW = ctx.measureText(badgeText).width + 8;
        const bX = Math.min(padL + plotW - bW, Math.max(padL, zX - bW / 2));
        const bY = zeroY - 18;

        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(bX, bY, bW, 12, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#b45309';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bX + bW / 2, bY + 6);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 8px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Añade volumen para visualizar el punto de inflexión', padL + plotW / 2, padT + plotH / 2);
    }
  }
}
