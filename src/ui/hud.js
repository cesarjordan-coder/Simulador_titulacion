/**
 * HUDManager
 * Control y actualización en tiempo real de la interfaz Persona Acid Green.
 */
export class HUDManager {
  constructor(appContainer) {
    this.container = appContainer || document.body;
    this.elements = {};
    this.dripInterval = null;
  }

  mount(onManualDrop, onReset, onToggleCamera) {
    // Cache de referencias del DOM presente en index.html
    this.elements = {
      viewport: document.getElementById('canvas-container'),
      phValue: document.getElementById('ph-value'),
      phBadge: document.getElementById('ph-badge'),
      phBar: document.getElementById('ph-bar'),
      volValue: document.getElementById('vol-value'),
      buretteValue: document.getElementById('burette-value'),
      flaskValue: document.getElementById('flask-value'),
      valvePercent: document.getElementById('valve-percent'),
      valveSlider: document.getElementById('valve-slider'),
      btnDrop: document.getElementById('btn-drop'),
      btnReset: document.getElementById('btn-reset'),
      btnCamera: document.getElementById('btn-camera'),
      alertBanner: document.getElementById('alert-banner'),
      cameraVideo: document.getElementById('camera-video'),
      gestureStatus: document.getElementById('gesture-status')
    };

    // Listeners de botones
    if (this.elements.btnDrop) {
      this.elements.btnDrop.addEventListener('click', onManualDrop);
    }

    if (this.elements.btnReset) {
      this.elements.btnReset.addEventListener('click', () => {
        if (this.elements.valveSlider) {
          this.elements.valveSlider.value = 0;
          this.updateValveOpening(0, onManualDrop);
        }
        onReset();
      });
    }

    if (this.elements.btnCamera) {
      this.elements.btnCamera.addEventListener('click', onToggleCamera);
    }

    // Control del slider de la válvula (simulación de apertura continua)
    if (this.elements.valveSlider) {
      this.elements.valveSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) || 0;
        this.updateValveOpening(val, onManualDrop);
      });
    }

    return this.elements;
  }

  updateValveOpening(percent, onManualDrop) {
    if (this.elements.valvePercent) {
      this.elements.valvePercent.textContent = `${percent}%`;
    }

    // Si la válvula está abierta (>0), gotear periódicamente según el % de apertura
    if (this.dripInterval) {
      clearInterval(this.dripInterval);
      this.dripInterval = null;
    }

    if (percent > 0 && typeof onManualDrop === 'function') {
      // Entre 1000ms (1%) y 120ms (100%)
      const intervalMs = Math.max(120, Math.round(1000 - (percent * 8.8)));
      this.dripInterval = setInterval(() => {
        onManualDrop();
      }, intervalMs);
    }
  }

  updateChemistry(state) {
    if (this.elements.phValue) {
      this.elements.phValue.textContent = state.pH.toFixed(2);
    }

    if (this.elements.volValue) {
      this.elements.volValue.textContent = state.titrantAddedMl.toFixed(2);
    }

    if (this.elements.buretteValue) {
      this.elements.buretteValue.textContent = state.remainingBuretteMl.toFixed(2);
    }

    if (this.elements.flaskValue) {
      this.elements.flaskValue.textContent = state.totalVolumeFlaskMl.toFixed(2);
    }

    // Actualizar barra de pH (rango 0 a 14)
    if (this.elements.phBar) {
      const percent = Math.min(100, Math.max(0, (state.pH / 14) * 100));
      this.elements.phBar.style.width = `${percent}%`;

      // Cambio de color según la zona de pH
      if (state.pH < 7.0) {
        this.elements.phBar.style.background = 'linear-gradient(90deg, #39ff14, #a3e635)';
      } else if (state.pH === 7.0) {
        this.elements.phBar.style.background = 'linear-gradient(90deg, #00f5d4, #39ff14)';
      } else {
        this.elements.phBar.style.background = 'linear-gradient(90deg, #ec4899, #ff0055)';
      }
    }

    // Banner de punto de equivalencia
    if (this.elements.alertBanner) {
      if (state.isEquivalenceReached) {
        this.elements.alertBanner.classList.remove('hidden');
      } else {
        this.elements.alertBanner.classList.add('hidden');
      }
    }
  }

  updateGestureStatus(text) {
    if (this.elements.gestureStatus) {
      this.elements.gestureStatus.textContent = text;
    }
  }
}
