import './styles/main.css';
import { TitrationEngine, REAL_SAMPLES, INDICATORS } from './chemistry/engine.js';
import { LabScene } from './graphics/scene.js';
import { HandTracker } from './tracking/hands.js';
import { CurvePlotter } from './ui/curvePlotter.js';

// Instancias principales
const chemistry = new TitrationEngine({ sampleKey: 'vinagre' });
const labScene = new LabScene('canvas-container');
const curvePlotter = new CurvePlotter('titration-curve-canvas');

// Elementos del DOM - Estadísticas y Lecturas de Sensor
const phValueEl = document.getElementById('ph-value');
const phBadgeEl = document.getElementById('ph-badge');
const volValueEl = document.getElementById('vol-value');
const buretteValueEl = document.getElementById('burette-value');
const flaskValueEl = document.getElementById('flask-value');
const agitationValueEl = document.getElementById('agitation-value');
const phBarEl = document.getElementById('ph-bar');
const titrantLabel = document.getElementById('titrant-label');
const eqPointInfo = document.getElementById('eq-point-info');
const curveStatusNote = document.getElementById('curve-status-note');

// Elementos del DOM - Configuración de Reactivos y Muestras Problema
const selectSample = document.getElementById('select-sample');
const selectIndicator = document.getElementById('select-indicator');
const sampleBadgeType = document.getElementById('sample-badge-type');
const sampleFormula = document.getElementById('sample-formula');
const sampleDesc = document.getElementById('sample-desc');
const indicatorColorDot = document.getElementById('indicator-color-dot');
const indicatorNameBadge = document.getElementById('indicator-name-badge');

// Elementos del DOM - Controles Físicos
const valvePercentEl = document.getElementById('valve-percent');
const valveSlider = document.getElementById('valve-slider');
const btnDrop = document.getElementById('btn-drop');
const btnSwirl = document.getElementById('btn-swirl');
const btnReset = document.getElementById('btn-reset');
const btnCamera = document.getElementById('btn-camera');
const gestureStatusEl = document.getElementById('gesture-status');

// Banners de Alerta
const homogeneityAlertBanner = document.getElementById('homogeneity-alert-banner');
const splatterAlertBanner = document.getElementById('splatter-alert-banner');
const btnRecoverSplatter = document.getElementById('btn-recover-splatter');
const alertBanner = document.getElementById('alert-banner');
const alertText = document.getElementById('alert-text');

// Elementos del Reporte Analítico Cuantitativo
const btnOpenReport = document.getElementById('btn-open-report');
const reportModal = document.getElementById('report-modal');
const btnCloseReport = document.getElementById('btn-close-report');
const repSampleName = document.getElementById('rep-sample-name');
const repAliquotVol = document.getElementById('rep-aliquot-vol');
const repTitrantInfo = document.getElementById('rep-titrant-info');
const repFormulaText = document.getElementById('rep-formula-text');
const inputExpVolume = document.getElementById('input-exp-volume');
const btnUseCurrentVol = document.getElementById('btn-use-current-vol');
const currentReadingPreview = document.getElementById('current-reading-preview');
const inputCalcConc = document.getElementById('input-calc-conc');
const btnEvaluateReport = document.getElementById('btn-evaluate-report');
const reportResultBox = document.getElementById('report-result-box');
const resultGradeBadge = document.getElementById('result-grade-badge');
const resultErrorPercent = document.getElementById('result-error-percent');
const resTrueData = document.getElementById('res-true-data');
const resFeedbackText = document.getElementById('res-feedback-text');

let currentAgitation = 0;
let isCircularAgitating = false;

// Sincronización completa entre el motor analítico, el lienzo 2D y la interfaz
function syncAll() {
  const state = chemistry.calculateState();

  // 1. Lecturas del Sensor de pH
  if (phValueEl) phValueEl.textContent = state.pH.toFixed(2);
  if (volValueEl) volValueEl.textContent = state.titrantAddedMl.toFixed(2);
  if (buretteValueEl) buretteValueEl.textContent = state.remainingBuretteMl.toFixed(2);
  if (flaskValueEl) flaskValueEl.textContent = state.totalVolumeFlaskMl.toFixed(2);
  if (currentReadingPreview) currentReadingPreview.textContent = state.titrantAddedMl.toFixed(2);

  if (titrantLabel) {
    titrantLabel.textContent = `Vol. ${state.titrant.formula} (Bureta)`;
  }

  // Puntos de equivalencia
  if (eqPointInfo) {
    if (state.secondaryEquivalenceMl) {
      eqPointInfo.textContent = `V₁=${state.equivalenceVolumeMl.toFixed(1)} / V₂=${state.secondaryEquivalenceMl.toFixed(1)} mL`;
    } else {
      eqPointInfo.textContent = `${state.equivalenceVolumeMl.toFixed(2)} mL (pH ${state.equivalencePh.toFixed(2)})`;
    }
  }

  // 2. Barra de Sensor de pH
  const barPercent = Math.min(Math.max((state.pH / 14) * 100, 0), 100);
  if (phBarEl) {
    phBarEl.style.width = `${barPercent}%`;
    phBarEl.style.backgroundColor = state.color.hex;
  }

  // 3. Badge con contraste inteligente
  if (phBadgeEl) {
    phBadgeEl.style.backgroundColor = state.color.hex;
    const lum = 0.299 * state.color.r + 0.587 * state.color.g + 0.114 * state.color.b;
    phBadgeEl.style.color = lum > 165 ? '#1e293b' : '#ffffff';
  }

  // 4. Actualizar Curva en Vivo (pH vs mL)
  if (curvePlotter) {
    const indicatorInfo = INDICATORS[chemistry.indicator] || INDICATORS.phenolphthalein;
    curvePlotter.setIndicatorRange(indicatorInfo.minPh, indicatorInfo.maxPh);

    const eqPoints = [{ v: state.equivalenceVolumeMl, ph: state.equivalencePh }];
    if (state.secondaryEquivalenceMl) {
      eqPoints.push({ v: state.secondaryEquivalenceMl, ph: 9.78 });
    }
    curvePlotter.setEquivalencePoints(eqPoints);
    curvePlotter.update(chemistry.getCurveHistory(), state.titrantAddedMl, state.pH);
  }

  // Nota de zona buffer en el pie de la curva
  if (curveStatusNote) {
    if (state.activeBufferZone) {
      curveStatusNote.textContent = `Buffer: ${state.activeBufferZone}`;
      curveStatusNote.style.color = 'var(--pastel-green-hover)';
    } else if (state.isEquivalenceReached) {
      curveStatusNote.textContent = `Punto de viraje analítico alcanzado`;
      curveStatusNote.style.color = '#0284c7';
    } else {
      curveStatusNote.textContent = `Monitoreo potenciométrico en tiempo real`;
      curveStatusNote.style.color = 'var(--text-muted)';
    }
  }

  // 5. Muestra problema e indicador
  if (sampleBadgeType) {
    sampleBadgeType.textContent = state.analyte.type.includes('poly') ? 'Ácido Poliprótico' : 'Ácido Débil';
  }
  if (sampleFormula) {
    sampleFormula.textContent = state.analyte.formula;
  }
  if (sampleDesc) {
    sampleDesc.textContent = state.sample.description;
  }
  if (indicatorColorDot) {
    indicatorColorDot.style.backgroundColor = state.color.hex;
  }
  if (indicatorNameBadge) {
    indicatorNameBadge.textContent = `${state.indicator.name} (${state.indicator.rangeText})`;
  }

  // 6. Actualizar motor gráfico 2D con la física de fluidos y homogeneidad
  labScene.updateLiquidState(
    state.color,
    state.totalVolumeFlaskMl,
    state.remainingBuretteMl,
    state.plumeColor,
    state.unmixedTitrantMl,
    state.hasHomogenizationError
  );

  // 7. Manejo de Banners de Alerta
  // Alerta A: Falta de homogeneización (Reto 1)
  if (homogeneityAlertBanner) {
    if (state.hasHomogenizationError && !state.isSampleRuined) {
      homogeneityAlertBanner.classList.remove('hidden');
    } else {
      homogeneityAlertBanner.classList.add('hidden');
    }
  }

  // Alerta B: Salpicadura violenta (Reto 1)
  if (splatterAlertBanner) {
    if (state.isSampleRuined) {
      splatterAlertBanner.classList.remove('hidden');
    } else {
      splatterAlertBanner.classList.add('hidden');
    }
  }

  // Alerta C: Punto de equivalencia alcanzado
  if (alertBanner && alertText && !state.hasHomogenizationError && !state.isSampleRuined) {
    if (state.isEquivalence && !state.isOverTitrated) {
      alertText.textContent = `Punto de equivalencia alcanzado (pH ${state.ph.toFixed(2)} • V = ${state.vBaseAdded.toFixed(2)} mL)`;
      alertBanner.classList.remove('hidden');
    } else if (state.isOverTitrated) {
      alertText.textContent = 'Sobretitulación: Exceso de titulante en la disolución';
      alertBanner.classList.remove('hidden');
    } else {
      alertBanner.classList.add('hidden');
    }
  }
}

// Reset completo de controles
function resetControls() {
  if (valveSlider) valveSlider.value = 0;
  if (valvePercentEl) valvePercentEl.textContent = '0%';
  labScene.setValveRotation(0);
  labScene.reset();
  curvePlotter.reset();
  updateAgitation(0, false);
}

// Control de Agitación
function updateAgitation(level, isCircular = false) {
  currentAgitation = level;
  isCircularAgitating = isCircular;
  labScene.setAgitation(level, isCircular);
  chemistry.applyAgitation(level);

  if (agitationValueEl) {
    if (isCircular && level > 20) {
      agitationValueEl.textContent = `${level}% (Círculos Óptimos)`;
      agitationValueEl.style.color = '#22c55e';
    } else if (level > 15) {
      agitationValueEl.textContent = `${level}% (Agitando)`;
      agitationValueEl.style.color = 'var(--pastel-green-hover)';
    } else {
      agitationValueEl.textContent = `${level}% (Estático)`;
      agitationValueEl.style.color = 'var(--text-muted)';
    }
  }
}

// Inicializar Visión Artificial con MediaPipe
const handTracker = new HandTracker(
  // 1. Callback de cambio de pinza y agitación
  (valvePercent, hasPinchHand, agitationLevel, isCircular) => {
    if (chemistry.isSampleRuined) return;

    if (hasPinchHand) {
      if (valveSlider) valveSlider.value = valvePercent;
      if (valvePercentEl) valvePercentEl.textContent = `${valvePercent}% [PINZA BURETA]`;
      labScene.setValveRotation(valvePercent);
    }

    updateAgitation(agitationLevel, isCircular);

    if (gestureStatusEl) {
      if (hasPinchHand && isCircular) {
        gestureStatusEl.textContent = `2 MANOS: LLAVE ${valvePercent}% // AGITANDO EN CÍRCULOS (${agitationLevel}%)`;
      } else if (hasPinchHand && agitationLevel > 15) {
        gestureStatusEl.textContent = `2 MANOS: LLAVE ${valvePercent}% // AGITANDO (${agitationLevel}%)`;
      } else if (hasPinchHand) {
        gestureStatusEl.textContent = `MANO BURETA: APERTURA ${valvePercent}%`;
      } else if (isCircular) {
        gestureStatusEl.textContent = `MANO MATRAZ: CÍRCULOS PERFECTOS (${agitationLevel}%)`;
      } else if (agitationLevel > 15) {
        gestureStatusEl.textContent = `MANO MATRAZ: AGITANDO (${agitationLevel}%)`;
      } else {
        gestureStatusEl.textContent = 'DETECTANDO MANOS (PINZA EN LLAVE O CÍRCULOS EN MATRAZ)...';
      }
    }
  },
  // 2. Callback de Salpicadura Violenta por Apertura Brusca
  ({ openingRate, percent, reason }) => {
    if (!chemistry.isSampleRuined) {
      console.warn('Salpicadura violenta detonada:', reason, `Tasa: ${openingRate}%/s`);
      chemistry.ruinSampleBySplatter(reason);
      labScene.triggerScreenSplatter();
      syncAll();
    }
  }
);

// Bucle físico conectado a los fotogramas del lienzo 2D
labScene.animate((volumeAdded) => {
  if (chemistry.isSampleRuined) return;

  if (volumeAdded && volumeAdded > 0) {
    chemistry.addVolume(volumeAdded, currentAgitation);
  } else {
    chemistry.addDrop(1, currentAgitation);
  }
  syncAll();
});

// Event Listeners de Reactivos y Muestras Problema
if (selectSample) {
  selectSample.addEventListener('change', (e) => {
    chemistry.setSample(e.target.value);
    // Ajustar indicador recomendado para la muestra
    const sample = REAL_SAMPLES[e.target.value];
    if (sample && selectIndicator) {
      selectIndicator.value = sample.recommendedIndicators[0];
    }
    resetControls();
    syncAll();
  });
}

if (selectIndicator) {
  selectIndicator.addEventListener('change', (e) => {
    chemistry.setIndicator(e.target.value);
    syncAll();
  });
}

// Botones de Válvula
if (btnDrop) {
  btnDrop.addEventListener('click', () => {
    if (!chemistry.isSampleRuined) {
      labScene.spawnDrop();
    }
  });
}

// Botón de Agitación Manual
let swirlInterval = null;
if (btnSwirl) {
  const startManualSwirl = () => {
    if (swirlInterval) clearInterval(swirlInterval);
    updateAgitation(85, true);
    swirlInterval = setInterval(() => {
      updateAgitation(Math.min(100, currentAgitation + 5), true);
    }, 80);
  };

  const stopManualSwirl = () => {
    if (swirlInterval) {
      clearInterval(swirlInterval);
      swirlInterval = null;
    }
    const decay = setInterval(() => {
      if (currentAgitation <= 6) {
        updateAgitation(0, false);
        clearInterval(decay);
      } else {
        updateAgitation(Math.max(0, currentAgitation - 14), false);
      }
    }, 50);
  };

  btnSwirl.addEventListener('mousedown', startManualSwirl);
  btnSwirl.addEventListener('mouseup', stopManualSwirl);
  btnSwirl.addEventListener('mouseleave', stopManualSwirl);
  btnSwirl.addEventListener('touchstart', (e) => { e.preventDefault(); startManualSwirl(); });
  btnSwirl.addEventListener('touchend', stopManualSwirl);
}

if (btnReset) {
  btnReset.addEventListener('click', () => {
    chemistry.reset();
    resetControls();
    syncAll();
  });
}

if (btnRecoverSplatter) {
  btnRecoverSplatter.addEventListener('click', () => {
    chemistry.reset();
    resetControls();
    syncAll();
  });
}

if (valveSlider) {
  valveSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10) || 0;
    if (valvePercentEl) valvePercentEl.textContent = `${val}%`;
    labScene.setValveRotation(val);
  });
}

if (btnCamera) {
  btnCamera.addEventListener('click', () => {
    if (handTracker.isTracking) {
      handTracker.stop();
      if (gestureStatusEl) gestureStatusEl.textContent = 'CÁMARA PAUSADA';
    } else {
      handTracker.start();
      if (gestureStatusEl) gestureStatusEl.textContent = 'INICIANDO CÁMARA...';
    }
  });
}

const btnCalibrate = document.getElementById('btn-calibrate');
if (btnCalibrate) {
  btnCalibrate.addEventListener('click', () => {
    if (!handTracker.isTracking) {
      handTracker.start();
    }
    handTracker.startCalibration(3.0);
  });
}

// ========================================================
// RETO 3: MODAL DE REPORTE ANALÍTICO CUANTITATIVO
// ========================================================
function updateReportModalData() {
  const sample = chemistry.sample;
  if (repSampleName) repSampleName.textContent = sample.name;
  if (repAliquotVol) repAliquotVol.textContent = `${sample.aliquotVolumeMl.toFixed(2)} mL`;
  if (repTitrantInfo) repTitrantInfo.textContent = `${chemistry.titrant.formula} ${chemistry.titrant.concentrationM.toFixed(3)} M`;

  if (repFormulaText) {
    if (sample.type === 'polyprotic_tri') {
      repFormulaText.textContent = 'C_ácido = (C_NaOH × V_NaOH) / (3 × V_alícuota)';
    } else {
      repFormulaText.textContent = 'C_muestra = (C_NaOH × V_NaOH) / V_alícuota';
    }
  }

  if (currentReadingPreview) {
    currentReadingPreview.textContent = chemistry.titrantAddedMl.toFixed(2);
  }
}

if (btnOpenReport) {
  btnOpenReport.addEventListener('click', () => {
    updateReportModalData();
    if (reportResultBox) reportResultBox.classList.add('hidden');
    if (reportModal) reportModal.classList.remove('hidden');
  });
}

if (btnCloseReport) {
  btnCloseReport.addEventListener('click', () => {
    if (reportModal) reportModal.classList.add('hidden');
  });
}

if (btnUseCurrentVol) {
  btnUseCurrentVol.addEventListener('click', () => {
    if (inputExpVolume) {
      inputExpVolume.value = chemistry.titrantAddedMl.toFixed(2);
    }
  });
}

if (btnEvaluateReport) {
  btnEvaluateReport.addEventListener('click', () => {
    const expVol = parseFloat(inputExpVolume?.value);
    const expConc = parseFloat(inputCalcConc?.value);

    if (isNaN(expVol) || expVol <= 0) {
      alert('Por favor ingresa un volumen de viraje válido (mL).');
      return;
    }

    const sample = chemistry.sample;
    const trueVeq = (sample.concentrationM * sample.aliquotVolumeMl * sample.equivalentWeightH) / chemistry.titrant.concentrationM;
    const trueConc = sample.concentrationM;

    // Calcular error porcentual en el volumen de viraje
    const volError = Math.abs((expVol - trueVeq) / trueVeq) * 100;

    let grade = 'EXCELENTE';
    let gradeClass = 'result-grade';
    let feedback = '';

    if (volError <= 1.0) {
      grade = 'EXCELENTE (GRADO A)';
      gradeClass = 'result-grade';
      feedback = `¡Precisión analítica excepcional! El volumen gastado (${expVol.toFixed(2)} mL) concuerda casi exactamente con el punto de equivalencia teórico (${trueVeq.toFixed(2)} mL).`;
    } else if (volError <= 4.0) {
      grade = 'ACEPTABLE (GRADO B)';
      gradeClass = 'result-grade warning';
      feedback = `Buena técnica de titulación. Hubo una ligera diferencia de ${volError.toFixed(1)}% respecto al punto teórico de equivalencia (${trueVeq.toFixed(2)} mL).`;
    } else {
      grade = 'SOBRETITULACIÓN (GRADO C)';
      gradeClass = 'result-grade danger';
      feedback = `Sobrepasaste el punto estequiométrico por ${(expVol - trueVeq).toFixed(2)} mL. La fenolftaleína viró con exceso de base. En el próximo intento, dosifica gota a gota cerca del punto final.`;
    }

    if (resultGradeBadge) {
      resultGradeBadge.textContent = grade;
      resultGradeBadge.className = gradeClass;
    }

    if (resultErrorPercent) {
      resultErrorPercent.textContent = `Error experimental: ${volError.toFixed(2)}%`;
    }

    if (resTrueData) {
      const originalConcMsg = sample.dilutionFactor > 1
        ? ` (${(sample.concentrationM * sample.dilutionFactor).toFixed(3)} M en producto original concentrado)`
        : '';
      resTrueData.textContent = `V_eq teórico = ${trueVeq.toFixed(2)} mL • C_alícuota = ${trueConc.toFixed(4)} M${originalConcMsg}`;
    }

    if (resFeedbackText) {
      resFeedbackText.textContent = feedback;
    }

    if (reportResultBox) {
      reportResultBox.classList.remove('hidden');
    }
  });
}

// Sincronización inicial
syncAll();

// Exponer en window para depuración interactiva
window.chemistry = chemistry;
window.labScene = labScene;
window.handTracker = handTracker;
window.curvePlotter = curvePlotter;
