/**
 * Simulador de Titulación Química - Motor Analítico Universitario
 * Incluye:
 * - Ácidos y bases fuertes y débiles con Henderson-Hasselbalch riguroso.
 * - Ácidos polipróticos (Ácido Fosfórico H₃PO₄ con 3 puntos de equivalencia y Ácido Cítrico).
 * - Muestras problema reales del laboratorio: Vinagre comercial, Jugo de limón natural,
 *   Aspirina disuelta, Ácido fosfórico y HCl patrón.
 * - Dinámica de homogeneización de disolución y detección de falta de agitación.
 * - Registro continuo punto a punto para la curva de titulación en vivo (pH vs mL).
 */

export const REAL_SAMPLES = {
  vinagre: {
    id: 'vinagre',
    name: 'Vinagre Comercial (Ácido Acético)',
    commonName: 'Vinagre de Cocina',
    formula: 'CH₃COOH',
    substanceName: 'Ácido Acético',
    type: 'weak_acid_mono',
    pKa: 4.76,
    molarMass: 60.05, // g/mol
    defaultAliquotMl: 25.0,
    trueConcentrationM: 0.835, // ~5.0% m/v
    displayConcentrationHint: 'Aprox. 0.70 - 0.95 M (~4% - 6% m/v)',
    // Para titular en laboratorio con bureta de 50 mL y NaOH 0.1 M,
    // se prepara una alícuota diluida o se usa titulación con NaOH 0.5 M / o alícuota analítica:
    // Ajustamos la concentración de trabajo directa a 0.0835 M (dilución 1:10 clásica de laboratorio)
    aliquotVolumeMl: 20.0,
    concentrationM: 0.0835, // Alícuota diluida 1:10 para consumir ~16.7 mL de NaOH 0.1 M
    dilutionFactor: 10,
    equivalentWeightH: 1,
    titrantKey: 'naoh',
    titrantConcentrationM: 0.100,
    recommendedIndicators: ['phenolphthalein', 'phenol_red'],
    description: 'Muestra problema de vinagre blanco de mesa. El objetivo analítico es determinar el % de acidez expresado como ácido acético (% m/v).',
    pedagogicalNotes: 'Viraje ideal con Fenolftaleína al primer rosa tenue persistente por 30 segundos.'
  },
  limon: {
    id: 'limon',
    name: 'Jugo de Limón Natural (Ácido Cítrico)',
    commonName: 'Jugo de Limón',
    formula: 'H₃C₆H₅O₇',
    substanceName: 'Ácido Cítrico',
    type: 'polyprotic_tri',
    pKas: [3.13, 4.76, 6.40],
    pKa: 4.76,
    molarMass: 192.12, // g/mol
    aliquotVolumeMl: 15.0,
    concentrationM: 0.045, // Consume ~20.25 mL de NaOH 0.1 M (3 protones titulables)
    dilutionFactor: 5,
    equivalentWeightH: 3,
    trueConcentrationM: 0.225, // En jugo puro (~5% a 7% m/v)
    displayConcentrationHint: 'Triprótico: 1 mol ácido cítrico neutraliza 3 moles de NaOH',
    titrantKey: 'naoh',
    titrantConcentrationM: 0.100,
    recommendedIndicators: ['phenolphthalein', 'bromothymol_blue'],
    description: 'Zumo fresco de limón filtrado. Ácido triprótico con 3 equilibrios consecutivos que viran con fenolftaleína en el tercer protón.',
    pedagogicalNotes: 'La fenolftaleína detecta la neutralización total de los 3 protones (H₃Cit + 3 NaOH → Na₃Cit + 3 H₂O).'
  },
  aspirina: {
    id: 'aspirina',
    name: 'Aspirina Disuelta (Ác. Acetilsalicílico)',
    commonName: 'Tableta de Aspirina',
    formula: 'C₉H₈O₄',
    substanceName: 'Ácido Acetilsalicílico',
    type: 'weak_acid_mono',
    pKa: 3.50,
    molarMass: 180.16, // g/mol
    aliquotVolumeMl: 25.0,
    concentrationM: 0.0278, // 500 mg tableta disuelta en 100 mL de agua-etanol = 0.02775 M
    dilutionFactor: 1,
    equivalentWeightH: 1,
    trueConcentrationM: 0.0278,
    displayConcentrationHint: 'Tableta farmacéutica de 500 mg disuelta en 100 mL (0.0278 M)',
    titrantKey: 'naoh',
    titrantConcentrationM: 0.100,
    recommendedIndicators: ['phenolphthalein', 'phenol_red'],
    description: 'Control de calidad farmacéutico para cuantificar el principio activo (ácido acetilsalicílico) de una tableta comercial.',
    pedagogicalNotes: 'Titulación de un ácido débil con base fuerte. El punto de equivalencia básico (~8.6) coincide con el viraje de la fenolftaleína.'
  },
  fosforico: {
    id: 'fosforico',
    name: 'Ácido Fosfórico Analítico (H₃PO₄)',
    commonName: 'Ácido Fosfórico Técnico',
    formula: 'H₃PO₄',
    substanceName: 'Ácido Fosfórico',
    type: 'polyprotic_phosphoric',
    pKas: [2.15, 7.20, 12.35],
    pKa: 2.15,
    molarMass: 97.99,
    aliquotVolumeMl: 20.0,
    concentrationM: 0.050, // Puntos de equivalencia a 10.0 mL, 20.0 mL y 30.0 mL con NaOH 0.1 M
    dilutionFactor: 1,
    equivalentWeightH: 3,
    trueConcentrationM: 0.050,
    displayConcentrationHint: 'Ácido poliprótico con 3 saltos potenciómetricos marcados',
    titrantKey: 'naoh',
    titrantConcentrationM: 0.100,
    recommendedIndicators: ['bromothymol_blue', 'phenolphthalein', 'methyl_orange'],
    description: 'Patrón de ácido poliprótico por excelencia. Presenta dos puntos de equivalencia cuantificables experimentalmente.',
    pedagogicalNotes: 'El 1er punto vira con naranja de metilo (pH ~4.7); el 2do punto con fenolftaleína (pH ~9.8).'
  },
  hcl_control: {
    id: 'hcl_control',
    name: 'Ácido Clorhídrico Patrón (HCl)',
    commonName: 'HCl Control Analítico',
    formula: 'HCl',
    substanceName: 'Ácido Clorhídrico',
    type: 'strong_acid',
    pKa: null,
    molarMass: 36.46,
    aliquotVolumeMl: 25.0,
    concentrationM: 0.100,
    dilutionFactor: 1,
    equivalentWeightH: 1,
    trueConcentrationM: 0.100,
    displayConcentrationHint: 'Ácido fuerte monoprótico estándar (0.100 M)',
    titrantKey: 'naoh',
    titrantConcentrationM: 0.100,
    recommendedIndicators: ['phenolphthalein', 'bromothymol_blue', 'methyl_red'],
    description: 'Estándar analítico primario para calibración de pH y verificación de la técnica de titulación manual.',
    pedagogicalNotes: 'Salto abrupto de pH de 3 a 11 en las inmediaciones del punto de equivalencia (pH neutro 7.00).'
  }
};

export const REAGENTS = {
  analytes: { ...REAL_SAMPLES },
  titrants: {
    naoh: {
      id: 'naoh',
      name: 'Hidróxido de Sodio',
      formula: 'NaOH',
      type: 'strong_base',
      class: 'base',
      defaultConc: 0.100
    },
    koh: {
      id: 'koh',
      name: 'Hidróxido de Potasio',
      formula: 'KOH',
      type: 'strong_base',
      class: 'base',
      defaultConc: 0.100
    },
    hcl: {
      id: 'hcl',
      name: 'Ácido Clorhídrico',
      formula: 'HCl',
      type: 'strong_acid',
      class: 'acid',
      defaultConc: 0.100
    }
  }
};

export const INDICATORS = {
  phenolphthalein: {
    id: 'phenolphthalein',
    name: 'Fenolftaleína',
    rangeText: 'pH 8.2 – 10.0',
    minPh: 8.2,
    maxPh: 10.0,
    description: 'Incoloro en medio ácido/neutro → Rosa tenue etéreo al viraje (pH 8.2–8.5) → Fucsia intenso solo con sobretitulación.',
    stops: [
      { ph: 6.8, r: 244, g: 247, b: 251, alpha: 0.12, hex: '#f4f7fb' },
      { ph: 7.2, r: 254, g: 240, b: 248, alpha: 0.22, hex: '#fef0f8' },
      { ph: 7.6, r: 252, g: 220, b: 238, alpha: 0.35, hex: '#fcdcee' },
      { ph: 8.2, r: 250, g: 190, b: 222, alpha: 0.48, hex: '#fabece' },
      { ph: 8.8, r: 244, g: 140, b: 195, alpha: 0.65, hex: '#f48cc3' },
      { ph: 9.6, r: 236, g: 72, b: 153, alpha: 0.80, hex: '#ec4899' },
      { ph: 10.4, r: 190, g: 18, b: 60, alpha: 0.90, hex: '#be123c' }
    ],
    basePlume: { r: 250, g: 180, b: 218, hex: '#fab4da' },
    acidPlume: { r: 244, g: 247, b: 251, hex: '#f4f7fb' }
  },
  bromothymol_blue: {
    id: 'bromothymol_blue',
    name: 'Azul de Bromotimol',
    rangeText: 'pH 6.0 – 7.6',
    minPh: 6.0,
    maxPh: 7.6,
    description: 'Amarillo vivo en ácido → Verde esmeralda a pH 7.0 neutro → Azul intenso en básico.',
    stops: [
      { ph: 6.0, r: 250, g: 204, b: 21, alpha: 0.78, hex: '#facc15' },
      { ph: 6.8, r: 34, g: 197, b: 94, alpha: 0.82, hex: '#22c55e' },
      { ph: 7.6, r: 37, g: 99, b: 235, alpha: 0.88, hex: '#2563eb' }
    ],
    basePlume: { r: 37, g: 99, b: 235, hex: '#2563eb' },
    acidPlume: { r: 250, g: 204, b: 21, hex: '#facc15' }
  },
  methyl_orange: {
    id: 'methyl_orange',
    name: 'Naranja de Metilo',
    rangeText: 'pH 3.1 – 4.4',
    minPh: 3.1,
    maxPh: 4.4,
    description: 'Rojo vivo en pH < 3.1 → Naranja en viraje → Amarillo a pH > 4.4. Excelente para el 1er punto del H₃PO₄.',
    stops: [
      { ph: 3.1, r: 239, g: 68, b: 68, alpha: 0.85, hex: '#ef4444' },
      { ph: 3.8, r: 249, g: 115, b: 22, alpha: 0.82, hex: '#f97316' },
      { ph: 4.4, r: 234, g: 179, b: 8, alpha: 0.80, hex: '#eab308' }
    ],
    basePlume: { r: 234, g: 179, b: 8, hex: '#eab308' },
    acidPlume: { r: 239, g: 68, b: 68, hex: '#ef4444' }
  },
  phenol_red: {
    id: 'phenol_red',
    name: 'Rojo Fenol',
    rangeText: 'pH 6.8 – 8.4',
    minPh: 6.8,
    maxPh: 8.4,
    description: 'Amarillo en ácido → Ámbar en viraje → Rojo violáceo en básico.',
    stops: [
      { ph: 6.8, r: 234, g: 179, b: 8, alpha: 0.78, hex: '#eab308' },
      { ph: 7.6, r: 249, g: 115, b: 22, alpha: 0.82, hex: '#f97316' },
      { ph: 8.4, r: 190, g: 18, b: 60, alpha: 0.88, hex: '#be123c' }
    ],
    basePlume: { r: 190, g: 18, b: 60, hex: '#be123c' },
    acidPlume: { r: 234, g: 179, b: 8, hex: '#eab308' }
  }
};

export class TitrationEngine {
  constructor(config = {}) {
    const sampleKey = typeof config === 'string' ? config : (config.sampleKey || 'vinagre');
    const sampleData = REAL_SAMPLES[sampleKey] || REAL_SAMPLES.vinagre;

    this.sampleKey = sampleKey;
    this.sample = { ...sampleData };

    this.analyte = {
      key: sampleKey,
      name: sampleData.name,
      substanceName: sampleData.substanceName,
      formula: sampleData.formula,
      type: sampleData.type,
      volumeInitialMl: Number(config.aliquotVolumeMl) || sampleData.aliquotVolumeMl || 20.0,
      concentrationM: Number(config.analyteMolarity) || sampleData.concentrationM,
      pKa: sampleData.pKa,
      pKas: sampleData.pKas || (sampleData.pKa ? [sampleData.pKa] : null),
      molarMass: sampleData.molarMass,
      equivalentWeightH: sampleData.equivalentWeightH || 1,
      dilutionFactor: sampleData.dilutionFactor || 1
    };

    const titrantKey = sampleData.titrantKey || 'naoh';
    const titrantData = REAGENTS.titrants[titrantKey] || REAGENTS.titrants.naoh;

    this.titrant = {
      key: titrantKey,
      name: titrantData.name,
      formula: titrantData.formula,
      type: titrantData.type,
      concentrationM: Number(config.titrantMolarity) || sampleData.titrantConcentrationM || 0.100,
      buretteCapacityMl: 50.0
    };

    this.indicator = sampleData.recommendedIndicators[0] || 'phenolphthalein';

    // Dinámica física de adición y homogeneización
    this.titrantAddedMl = 0.0;
    this.dropVolumeMl = 0.05; // 20 gotas/mL
    this.unmixedTitrantMl = 0.0; // Reactivo sin disolver/estancado por falta de agitación
    this.homogeneity = 1.0; // 1.0 = completamente homogéneo, 0.0 = totalmente estancado
    this.hasHomogenizationError = false;
    this.isSampleRuined = false;
    this.ruinedReason = '';

    // Historial para la curva de titulación en tiempo real (pH vs mL)
    this.curveHistory = [];
    this.listeners = [];

    // Registrar punto inicial
    this.recordHistoryPoint();
  }

  setSample(sampleKey) {
    const data = REAL_SAMPLES[sampleKey];
    if (!data) return;

    this.sampleKey = sampleKey;
    this.sample = { ...data };

    this.analyte = {
      key: sampleKey,
      name: data.name,
      substanceName: data.substanceName,
      formula: data.formula,
      type: data.type,
      volumeInitialMl: data.aliquotVolumeMl,
      concentrationM: data.concentrationM,
      pKa: data.pKa,
      pKas: data.pKas || (data.pKa ? [data.pKa] : null),
      molarMass: data.molarMass,
      equivalentWeightH: data.equivalentWeightH || 1,
      dilutionFactor: data.dilutionFactor || 1
    };

    const titrantKey = data.titrantKey || 'naoh';
    const titrantData = REAGENTS.titrants[titrantKey] || REAGENTS.titrants.naoh;
    this.titrant.key = titrantKey;
    this.titrant.name = titrantData.name;
    this.titrant.formula = titrantData.formula;
    this.titrant.concentrationM = data.titrantConcentrationM || 0.100;

    this.indicator = data.recommendedIndicators[0] || 'phenolphthalein';

    return this.reset();
  }

  setIndicator(indicatorKey) {
    if (INDICATORS[indicatorKey]) {
      this.indicator = indicatorKey;
      const state = this.calculateState();
      this.notify(state);
      return state;
    }
  }

  /**
   * Procesa la adición de titulante teniendo en cuenta la agitación física actual.
   * Si agitationLevel < 15, el reactivo se acumula en la superficie sin mezclarse,
   * reduciendo la homogeneidad y falseando el sensor de pH hasta arrojar error.
   */
  addVolume(volumeMl, agitationLevel = 0) {
    if (this.isSampleRuined) {
      const state = this.calculateState();
      this.notify(state);
      return state;
    }

    const prevAdded = this.titrantAddedMl;
    this.titrantAddedMl = Math.min(
      this.titrant.buretteCapacityMl,
      this.titrantAddedMl + Math.max(0, volumeMl)
    );
    const actualAdded = this.titrantAddedMl - prevAdded;

    // Dinámica de homogeneización:
    if (agitationLevel > 18) {
      // Agitación activa: mezcla instantánea de lo acumulado
      const mixSpeed = 0.4 + (agitationLevel / 100) * 1.6;
      this.unmixedTitrantMl = Math.max(0, this.unmixedTitrantMl - actualAdded * 2 - mixSpeed * 0.05);
      this.homogeneity = Math.min(1.0, this.homogeneity + 0.15);
      if (this.unmixedTitrantMl <= 0.08) {
        this.hasHomogenizationError = false;
      }
    } else {
      // Sin agitación suficiente: el volumen agregado queda sin mezclar
      this.unmixedTitrantMl += actualAdded;
      this.homogeneity = Math.max(0.1, 1.0 - (this.unmixedTitrantMl / 0.45));

      // Si se acumula más de 0.35 mL sin agitar, detonar ERROR DE LABORATORIO
      if (this.unmixedTitrantMl >= 0.35) {
        this.hasHomogenizationError = true;
      }
    }

    const state = this.calculateState();
    this.recordHistoryPoint(state);
    this.notify(state);
    return state;
  }

  addDrops(dropsCount = 1, agitationLevel = 0) {
    return this.addVolume(dropsCount * this.dropVolumeMl, agitationLevel);
  }

  addDrop(dropsCount = 1, agitationLevel = 0) {
    return this.addDrops(dropsCount, agitationLevel);
  }

  /**
   * Mezclador manual o por gestos (cuando el usuario mueve activamente la mano del matraz)
   */
  applyAgitation(agitationLevel) {
    if (agitationLevel > 18) {
      const dissipation = (agitationLevel / 100) * 0.12;
      this.unmixedTitrantMl = Math.max(0, this.unmixedTitrantMl - dissipation);
      this.homogeneity = Math.min(1.0, this.homogeneity + 0.08);

      if (this.unmixedTitrantMl <= 0.08) {
        this.hasHomogenizationError = false;
      }
    }
  }

  /**
   * Marca la muestra como arruinada debido a una apertura brusca de llave o salpicadura violenta.
   */
  ruinSampleBySplatter(reason = 'Salpicadura violenta por apertura brusca de la llave') {
    this.isSampleRuined = true;
    this.ruinedReason = reason;
    const state = this.calculateState();
    this.notify(state);
    return state;
  }

  /**
   * Cálculo riguroso del pH analítico con Henderson-Hasselbalch, constantes Ka y equilibrios sucesivos.
   */
  calculateState() {
    const Va_L = this.analyte.volumeInitialMl / 1000.0;
    const Ca = this.analyte.concentrationM;
    const molesAnalyte = Va_L * Ca;

    // Volumen efectivo mezclado para el cálculo de equilibrio químico
    // Si hay reactivo sin mezclar, la disolución de fondo reacciona solo con el volumen mezclado
    const effectiveTitrantMl = Math.max(0, this.titrantAddedMl - this.unmixedTitrantMl);
    const Vb_L = effectiveTitrantMl / 1000.0;
    const Cb = this.titrant.concentrationM;
    const molesTitrant = Vb_L * Cb;

    const totalVolumeL = Va_L + (this.titrantAddedMl / 1000.0);
    const Kw = 1.0e-14;

    let theoreticalPh = 7.0;
    let primaryEquivalenceMl = 0.0;
    let equivalencePh = 7.0;
    let secondaryEquivalenceMl = null;
    let tertiaryEquivalenceMl = null;
    let activeBufferZone = '';

    const type = this.analyte.type;

    // --- CASO A: Ácido Fuerte (HCl con NaOH) ---
    // En el laboratorio real, la curva de titulación experimental de un ácido fuerte
    // muestra una transición continua en torno al punto de equivalencia debida al equilibrio del agua,
    // a la presencia del propio indicador débil y al efecto de mezcla de microgotas (0.05 mL).
    if (type === 'strong_acid') {
      primaryEquivalenceMl = (molesAnalyte / Cb) * 1000.0;
      equivalencePh = 7.0;

      const deltaV = effectiveTitrantMl - primaryEquivalenceMl; // diferencia en mL respecto al punto de equivalencia

      if (Math.abs(deltaV) <= 0.20) {
        // Zona crítica de viraje sutil (a menos de 4 gotas del punto de equivalencia):
        // Sigmoide analítica continua calibrada para que el viraje pase por el rosa tenue
        // exactamente en torno a Veq (+0.00 a +0.06 mL)
        const progress = deltaV / 0.20; // de -1 a +1
        theoreticalPh = 7.0 + (3.2 * progress) + (0.8 * Math.pow(progress, 3));
      } else if (molesAnalyte > molesTitrant) {
        const excessH = molesAnalyte - molesTitrant;
        const concH = excessH / totalVolumeL;
        theoreticalPh = -Math.log10(Math.max(1e-14, concH));
      } else {
        const excessOH = molesTitrant - molesAnalyte;
        const concOH = excessOH / totalVolumeL;
        const pOH = -Math.log10(Math.max(1e-14, concOH));
        theoreticalPh = 14.0 - pOH;
      }
    }

    // --- CASO B: Ácido Débil Monoprótico (Vinagre / Ác. Acético y Aspirina) ---
    // Aplica Henderson-Hasselbalch riguroso y resolución cuadrática para amortiguadores
    else if (type === 'weak_acid_mono') {
      const Ka = Math.pow(10, -this.analyte.pKa);
      const Kb = Kw / Ka;
      primaryEquivalenceMl = (molesAnalyte / Cb) * 1000.0;

      // Concentración de sal A- en el punto de equivalencia
      const Veq_total_L = Va_L + (primaryEquivalenceMl / 1000.0);
      const concSaltEq = molesAnalyte / Veq_total_L;
      // Hidrólisis: A- + H2O <=> HA + OH-  =>  [OH-]^2 + Kb[OH-] - Kb*C_sal = 0
      const concOHEq = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * concSaltEq)) / 2;
      equivalencePh = Number((14.0 - (-Math.log10(Math.max(1e-14, concOHEq)))).toFixed(2));

      if (Vb_L === 0) {
        // Inicial: disociación parcial HA <=> H+ + A-  =>  [H+]^2 + Ka[H+] - Ka*Ca = 0
        const concH = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * Ca)) / 2;
        theoreticalPh = -Math.log10(Math.max(1e-14, concH));
      } else if (molesTitrant < molesAnalyte - 1e-7) {
        // Región Buffer (Ecuación de Henderson-Hasselbalch con corrección analítica exacta)
        activeBufferZone = `${this.analyte.formula} / ${this.analyte.formula.replace('H', '')}⁻ (pKₐ = ${this.analyte.pKa})`;
        const molesHA = molesAnalyte - molesTitrant;
        const molesA = molesTitrant;
        const concHA = molesHA / totalVolumeL;
        const concA = molesA / totalVolumeL;

        // [H+]^2 + (Ka + [A-])[H+] - Ka[HA] = 0
        const b = Ka + concA;
        const c = -Ka * concHA;
        const concH = (-b + Math.sqrt(b * b - 4 * c)) / 2;
        theoreticalPh = -Math.log10(Math.max(1e-14, concH));
      } else if (Math.abs(molesTitrant - molesAnalyte) <= 1e-7) {
        theoreticalPh = equivalencePh;
      } else {
        // Exceso de base fuerte valorante
        const excessOH = molesTitrant - molesAnalyte;
        const concOH = excessOH / totalVolumeL;
        const pOH = -Math.log10(Math.max(1e-14, concOH));
        theoreticalPh = 14.0 - pOH;
      }
    }

    // --- CASO C: Ácido Poliprótico Triprótico (Ácido Fosfórico H₃PO₄) ---
    // Tres equilibrios y puntos de equivalencia:
    // H₃PO₄ + OH- -> H₂PO₄⁻  (Veq1, pKa1 = 2.15)
    // H₂PO₄⁻ + OH- -> HPO₄²⁻ (Veq2 = 2*Veq1, pKa2 = 7.20)
    // HPO₄²⁻ + OH- -> PO₄³⁻  (Veq3 = 3*Veq1, pKa3 = 12.35)
    else if (type === 'polyprotic_phosphoric') {
      const pKa1 = this.analyte.pKas[0]; // 2.15
      const pKa2 = this.analyte.pKas[1]; // 7.20
      const pKa3 = this.analyte.pKas[2]; // 12.35

      const Ka1 = Math.pow(10, -pKa1);
      const Ka2 = Math.pow(10, -pKa2);
      const Ka3 = Math.pow(10, -pKa3);

      primaryEquivalenceMl = (molesAnalyte / Cb) * 1000.0; // Veq1
      secondaryEquivalenceMl = primaryEquivalenceMl * 2.0; // Veq2
      tertiaryEquivalenceMl = primaryEquivalenceMl * 3.0; // Veq3

      const Veq1_mL = primaryEquivalenceMl;
      const Veq2_mL = secondaryEquivalenceMl;
      const Veq3_mL = tertiaryEquivalenceMl;

      const currentV_mL = effectiveTitrantMl;

      if (currentV_mL <= 0) {
        // pH inicial dominado por Ka1
        const concH = (-Ka1 + Math.sqrt(Ka1 * Ka1 + 4 * Ka1 * Ca)) / 2;
        theoreticalPh = -Math.log10(Math.max(1e-14, concH));
      } else if (currentV_mL < Veq1_mL - 0.05) {
        // 1ª Región Buffer: H₃PO₄ / H₂PO₄⁻ (Henderson-Hasselbalch con pKa1)
        activeBufferZone = `H₃PO₄ / H₂PO₄⁻ (pKₐ₁ = ${pKa1})`;
        const ratio = currentV_mL / (Veq1_mL - currentV_mL);
        theoreticalPh = pKa1 + Math.log10(Math.max(0.001, ratio));
      } else if (Math.abs(currentV_mL - Veq1_mL) <= 0.05) {
        // 1er Punto de Equivalencia: Sal anfifrótica NaH₂PO₄
        // pH = (pKa1 + pKa2) / 2 = (2.15 + 7.20)/2 = 4.68
        theoreticalPh = (pKa1 + pKa2) / 2.0;
        equivalencePh = Number(theoreticalPh.toFixed(2));
      } else if (currentV_mL < Veq2_mL - 0.05) {
        // 2ª Región Buffer: H₂PO₄⁻ / HPO₄²⁻ (Henderson-Hasselbalch con pKa2)
        activeBufferZone = `H₂PO₄⁻ / HPO₄²⁻ (pKₐ₂ = ${pKa2})`;
        const vInStage = currentV_mL - Veq1_mL;
        const vStageTotal = Veq2_mL - Veq1_mL;
        const ratio = vInStage / Math.max(0.001, (vStageTotal - vInStage));
        theoreticalPh = pKa2 + Math.log10(Math.max(0.001, ratio));
      } else if (Math.abs(currentV_mL - Veq2_mL) <= 0.05) {
        // 2º Punto de Equivalencia: Na₂HPO₄
        // pH = (pKa2 + pKa3) / 2 = (7.20 + 12.35)/2 = 9.78
        theoreticalPh = (pKa2 + pKa3) / 2.0;
        equivalencePh = Number(theoreticalPh.toFixed(2));
      } else if (currentV_mL < Veq3_mL - 0.05) {
        // 3ª Región Buffer: HPO₄²⁻ / PO₄³⁻ (Henderson-Hasselbalch con pKa3)
        activeBufferZone = `HPO₄²⁻ / PO₄³⁻ (pKₐ₃ = ${pKa3})`;
        const vInStage = currentV_mL - Veq2_mL;
        const vStageTotal = Veq3_mL - Veq2_mL;
        const ratio = vInStage / Math.max(0.001, (vStageTotal - vInStage));
        theoreticalPh = pKa3 + Math.log10(Math.max(0.001, ratio));
      } else {
        // Exceso de NaOH sobre el 3er punto
        const excessV_L = (currentV_mL - Veq3_mL) / 1000.0;
        const concOH = (excessV_L * Cb) / totalVolumeL;
        const pOH = -Math.log10(Math.max(1e-14, concOH));
        theoreticalPh = 14.0 - pOH;
      }
    }

    // --- CASO D: Ácido Cítrico en Jugo de Limón (Triprótico con pKas cercanos) ---
    else if (type === 'polyprotic_tri') {
      const pKas = this.analyte.pKas; // [3.13, 4.76, 6.40]
      // 1 mol de ácido cítrico consume 3 moles de base en el punto final de fenolftaleína
      primaryEquivalenceMl = ((molesAnalyte * 3) / Cb) * 1000.0;
      equivalencePh = 8.55;

      const progress = effectiveTitrantMl / primaryEquivalenceMl; // 0.0 a 1.0 al viraje
      if (effectiveTitrantMl === 0) {
        const Ka1 = Math.pow(10, -pKas[0]);
        const concH = (-Ka1 + Math.sqrt(Ka1 * Ka1 + 4 * Ka1 * Ca)) / 2;
        theoreticalPh = -Math.log10(Math.max(1e-14, concH));
      } else if (progress < 1.0) {
        activeBufferZone = `Sistema Cítrico H₃Cit / Cit³⁻ (pKₐ = 3.13 – 6.40)`;
        // Región buffer multicomponente continua modelada con transición Henderson-Hasselbalch extendida
        const midPka = pKas[1];
        const logFactor = Math.log10(Math.max(0.001, progress / (1.001 - progress)));
        theoreticalPh = midPka + 1.25 * logFactor;
      } else if (Math.abs(progress - 1.0) < 0.01) {
        theoreticalPh = 8.55;
      } else {
        const excessMoles = (effectiveTitrantMl - primaryEquivalenceMl) * (Cb / 1000.0);
        const concOH = excessMoles / totalVolumeL;
        const pOH = -Math.log10(Math.max(1e-14, concOH));
        theoreticalPh = 14.0 - pOH;
      }
    }

    // Delimitar pH teórico entre 0.0 y 14.0
    theoreticalPh = Math.max(0.0, Math.min(14.0, theoreticalPh));

    // ========================================================
    // EFECTO DE FALTA DE HOMOGENEIZACIÓN (Sensor de pH vs Real)
    // ========================================================
    // Si no se agita, la parte superior acumula exceso básico local,
    // falseando la lectura del sensor de pH e inmovilizando la difusión del color.
    let measuredPh = theoreticalPh;
    if (this.unmixedTitrantMl > 0.05) {
      // El sensor de pH en una disolución estancada con gotas de NaOH encima
      // lee un pH artificialmente erróneo/elevado en la superficie y desfasado
      const distortion = Math.min(4.5, (this.unmixedTitrantMl / 0.15) * 1.8);
      measuredPh = Math.min(13.8, theoreticalPh + distortion);
    }

    const isEquivalenceReached = this.titrantAddedMl >= (primaryEquivalenceMl - 0.05);
    const isOverTitrated = this.titrantAddedMl > (primaryEquivalenceMl + 0.35);

    const indicatorInfo = INDICATORS[this.indicator] || INDICATORS.phenolphthalein;
    // El color general del matraz depende de la mezcla homogénea, pero si está sin mezclar se estanca
    const colorRGB = this.getIndicatorColor(theoreticalPh, this.indicator);
    const plumeColor = indicatorInfo.basePlume;

    return {
      // Lecturas analíticas
      pH: Number(measuredPh.toFixed(2)),
      ph: Number(measuredPh.toFixed(2)),
      theoreticalPh: Number(theoreticalPh.toFixed(2)),
      titrantAddedMl: Number(this.titrantAddedMl.toFixed(2)),
      vBaseAdded: Number(this.titrantAddedMl.toFixed(2)),
      remainingBuretteMl: Number((this.titrant.buretteCapacityMl - this.titrantAddedMl).toFixed(2)),
      totalVolumeFlaskMl: Number((this.analyte.volumeInitialMl + this.titrantAddedMl).toFixed(2)),
      equivalenceVolumeMl: Number(primaryEquivalenceMl.toFixed(2)),
      equivalencePh: Number(equivalencePh.toFixed(2)),
      secondaryEquivalenceMl: secondaryEquivalenceMl ? Number(secondaryEquivalenceMl.toFixed(2)) : null,
      tertiaryEquivalenceMl: tertiaryEquivalenceMl ? Number(tertiaryEquivalenceMl.toFixed(2)) : null,
      activeBufferZone,
      isEquivalenceReached,
      isEquivalence: isEquivalenceReached,
      isOverTitrated,
      // Estados de laboratorio y física
      homogeneity: Number(this.homogeneity.toFixed(2)),
      unmixedTitrantMl: Number(this.unmixedTitrantMl.toFixed(3)),
      hasHomogenizationError: this.hasHomogenizationError,
      isSampleRuined: this.isSampleRuined,
      ruinedReason: this.ruinedReason,
      // Colores y presentación
      colorRGB,
      color: colorRGB,
      plumeColor,
      sample: { ...this.sample },
      analyte: { ...this.analyte },
      titrant: { ...this.titrant },
      indicator: {
        id: this.indicator,
        name: indicatorInfo.name,
        rangeText: indicatorInfo.rangeText,
        description: indicatorInfo.description
      }
    };
  }

  recordHistoryPoint(state = null) {
    const s = state || this.calculateState();
    // Guardar si es el primer punto o si avanzó volumen significativo
    const last = this.curveHistory[this.curveHistory.length - 1];
    if (!last || Math.abs(last.v - s.titrantAddedMl) >= 0.04 || Math.abs(last.ph - s.pH) >= 0.08) {
      this.curveHistory.push({
        v: s.titrantAddedMl,
        ph: s.pH,
        theoreticalPh: s.theoreticalPh,
        isEquivalence: s.isEquivalenceReached
      });
    }
  }

  getCurveHistory() {
    return this.curveHistory;
  }

  getIndicatorColor(pH, indicatorKey = this.indicator) {
    const ind = INDICATORS[indicatorKey] || INDICATORS.phenolphthalein;
    const stops = ind.stops;

    if (!stops || stops.length === 0) {
      return { r: 88, g: 163, b: 121, alpha: 0.6, hex: '#58a379' };
    }

    if (pH <= stops[0].ph) {
      const s = stops[0];
      return { r: s.r, g: s.g, b: s.b, alpha: s.alpha, hex: s.hex };
    }

    const lastIdx = stops.length - 1;
    if (pH >= stops[lastIdx].ph) {
      const s = stops[lastIdx];
      return { r: s.r, g: s.g, b: s.b, alpha: s.alpha, hex: s.hex };
    }

    for (let i = 0; i < lastIdx; i++) {
      const s1 = stops[i];
      const s2 = stops[i + 1];
      if (pH >= s1.ph && pH <= s2.ph) {
        const factor = (pH - s1.ph) / (s2.ph - s1.ph);
        const r = Math.round(s1.r + (s2.r - s1.r) * factor);
        const g = Math.round(s1.g + (s2.g - s1.g) * factor);
        const b = Math.round(s1.b + (s2.b - s1.b) * factor);
        const alpha = Number((s1.alpha + (s2.alpha - s1.alpha) * factor).toFixed(3));
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        return { r, g, b, alpha, hex };
      }
    }

    return stops[0];
  }

  reset() {
    this.titrantAddedMl = 0.0;
    this.unmixedTitrantMl = 0.0;
    this.homogeneity = 1.0;
    this.hasHomogenizationError = false;
    this.isSampleRuined = false;
    this.ruinedReason = '';
    this.curveHistory = [];
    const state = this.calculateState();
    this.recordHistoryPoint(state);
    this.notify(state);
    return state;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    listener(this.calculateState());
  }

  notify(state) {
    this.listeners.forEach(fn => fn(state));
  }
}
