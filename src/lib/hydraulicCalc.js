/**
 * Гидравлический расчёт тройниковой системы отопления
 */

// Плотность воды при разных температурах (кг/м³)
const WATER_DENSITY = {
  40: 992.2, 50: 988.1, 60: 983.2, 70: 977.8, 80: 971.8, 90: 965.3, 95: 961.9
};

// Кинематическая вязкость воды (м²/с × 10⁶)
const WATER_VISCOSITY = {
  40: 0.659, 50: 0.556, 60: 0.478, 70: 0.415, 80: 0.365, 90: 0.326, 95: 0.310
};

// Шероховатость труб (мм)
const PIPE_ROUGHNESS = {
  steel: 0.2,
  copper: 0.0063,
  polypropylene: 0.01,
  metal_plastic: 0.004
};

// Стандартные диаметры (внутренний, мм)
const STANDARD_DIAMETERS = {
  steel: [10, 15, 20, 25, 32, 40, 50],
  copper: [10, 12, 15, 18, 22, 28, 35],
  polypropylene: [13.2, 16.6, 21.2, 26.6, 33.2, 42],
  metal_plastic: [12, 16, 20, 26, 32]
};

// Наружные диаметры
const OUTER_DIAMETERS = {
  steel: [15, 20, 25, 32, 40, 50, 65],
  copper: [12, 14, 18, 22, 28, 35, 42],
  polypropylene: [20, 25, 32, 40, 50, 63],
  metal_plastic: [16, 20, 26, 32, 40]
};

// Получить плотность воды при температуре
function getDensity(temp) {
  const temps = Object.keys(WATER_DENSITY).map(Number).sort((a, b) => a - b);
  if (temp <= temps[0]) return WATER_DENSITY[temps[0]];
  if (temp >= temps[temps.length - 1]) return WATER_DENSITY[temps[temps.length - 1]];
  for (let i = 0; i < temps.length - 1; i++) {
    if (temp >= temps[i] && temp <= temps[i + 1]) {
      const ratio = (temp - temps[i]) / (temps[i + 1] - temps[i]);
      return WATER_DENSITY[temps[i]] + ratio * (WATER_DENSITY[temps[i + 1]] - WATER_DENSITY[temps[i]]);
    }
  }
  return 980;
}

// Получить вязкость воды при температуре
function getViscosity(temp) {
  const temps = Object.keys(WATER_VISCOSITY).map(Number).sort((a, b) => a - b);
  if (temp <= temps[0]) return WATER_VISCOSITY[temps[0]] * 1e-6;
  if (temp >= temps[temps.length - 1]) return WATER_VISCOSITY[temps[temps.length - 1]] * 1e-6;
  for (let i = 0; i < temps.length - 1; i++) {
    if (temp >= temps[i] && temp <= temps[i + 1]) {
      const ratio = (temp - temps[i]) / (temps[i + 1] - temps[i]);
      return (WATER_VISCOSITY[temps[i]] + ratio * (WATER_VISCOSITY[temps[i + 1]] - WATER_VISCOSITY[temps[i]])) * 1e-6;
    }
  }
  return 0.478e-6;
}

// Расчёт расхода теплоносителя (кг/ч)
export function calcFlowRate(powerW, tSupply, tReturn) {
  const dt = tSupply - tReturn;
  if (dt <= 0) return 0;
  const avgTemp = (tSupply + tReturn) / 2;
  const cp = 4187; // Дж/(кг·°C) — теплоёмкость воды
  const G = powerW / (cp * dt) * 3600; // кг/ч
  return G;
}

// Расчёт расхода в л/ч
export function calcFlowRateLiters(powerW, tSupply, tReturn) {
  const G = calcFlowRate(powerW, tSupply, tReturn);
  const avgTemp = (tSupply + tReturn) / 2;
  const density = getDensity(avgTemp);
  return (G / density) * 1000; // л/ч
}

// Подбор диаметра трубы
export function selectPipeDiameter(flowRateKgH, material, tSupply, tReturn, maxVelocity = 0.8) {
  const avgTemp = (tSupply + tReturn) / 2;
  const density = getDensity(avgTemp);
  const volumeFlowM3s = (flowRateKgH / density) / 3600;
  
  // Минимальное сечение: A = Q / V
  const minArea = volumeFlowM3s / maxVelocity;
  const minDiameter = Math.sqrt(4 * minArea / Math.PI) * 1000; // мм
  
  const diameters = STANDARD_DIAMETERS[material] || STANDARD_DIAMETERS.steel;
  const outerDiameters = OUTER_DIAMETERS[material] || OUTER_DIAMETERS.steel;
  
  for (let i = 0; i < diameters.length; i++) {
    if (diameters[i] >= minDiameter) {
      const area = Math.PI * Math.pow(diameters[i] / 1000 / 2, 2);
      const velocity = volumeFlowM3s / area;
      return {
        innerDiameter: diameters[i],
        outerDiameter: outerDiameters[i],
        velocity: velocity,
        area: area
      };
    }
  }
  
  // Если ни один диаметр не подошёл, берём максимальный
  const lastIdx = diameters.length - 1;
  const area = Math.PI * Math.pow(diameters[lastIdx] / 1000 / 2, 2);
  return {
    innerDiameter: diameters[lastIdx],
    outerDiameter: outerDiameters[lastIdx],
    velocity: volumeFlowM3s / area,
    area: area
  };
}

// Число Рейнольдса
function reynolds(velocity, diameter_m, viscosity) {
  return (velocity * diameter_m) / viscosity;
}

// Коэффициент трения (формула Альтшуля)
function frictionFactor(Re, roughness_mm, diameter_mm) {
  if (Re < 2300) {
    return 64 / Re; // ламинарный режим
  }
  const relRoughness = roughness_mm / diameter_mm;
  // Формула Альтшуля
  return 0.11 * Math.pow(relRoughness + 68 / Re, 0.25);
}

// Потери давления на трение (Па)
export function calcFrictionLoss(flowRateKgH, innerDiameter_mm, length_m, material, tSupply, tReturn) {
  const avgTemp = (tSupply + tReturn) / 2;
  const density = getDensity(avgTemp);
  const viscosity = getViscosity(avgTemp);
  const roughness = PIPE_ROUGHNESS[material] || 0.2;
  
  const volumeFlowM3s = (flowRateKgH / density) / 3600;
  const area = Math.PI * Math.pow(innerDiameter_mm / 1000 / 2, 2);
  const velocity = volumeFlowM3s / area;
  
  const d_m = innerDiameter_mm / 1000;
  const Re = reynolds(velocity, d_m, viscosity);
  const lambda = frictionFactor(Re, roughness, innerDiameter_mm);
  
  // ΔP = λ × (L/d) × (ρ × v²/2)
  const dP = lambda * (length_m / d_m) * (density * velocity * velocity / 2);
  
  return {
    pressureLoss: dP, // Па
    velocity: velocity,
    reynolds: Re,
    frictionFactor: lambda,
    specificLoss: dP / length_m // Па/м
  };
}

// Потери давления на местные сопротивления (Па)
export function calcLocalLoss(flowRateKgH, innerDiameter_mm, zetaSum, tSupply, tReturn) {
  const avgTemp = (tSupply + tReturn) / 2;
  const density = getDensity(avgTemp);
  
  const volumeFlowM3s = (flowRateKgH / density) / 3600;
  const area = Math.PI * Math.pow(innerDiameter_mm / 1000 / 2, 2);
  const velocity = volumeFlowM3s / area;
  
  // ΔP = Σζ × (ρ × v²/2)
  return zetaSum * (density * velocity * velocity / 2);
}

// Полный расчёт участка
export function calcSection(powerW, length_m, zetaSum, material, tSupply, tReturn, maxVelocity = 0.8) {
  const flowRateKgH = calcFlowRate(powerW, tSupply, tReturn);
  const flowRateLH = calcFlowRateLiters(powerW, tSupply, tReturn);
  const pipe = selectPipeDiameter(flowRateKgH, material, tSupply, tReturn, maxVelocity);
  
  const friction = calcFrictionLoss(flowRateKgH, pipe.innerDiameter, length_m, material, tSupply, tReturn);
  const localLoss = calcLocalLoss(flowRateKgH, pipe.innerDiameter, zetaSum, tSupply, tReturn);
  
  const totalLoss = friction.pressureLoss + localLoss;
  
  return {
    flowRateKgH: Math.round(flowRateKgH * 100) / 100,
    flowRateLH: Math.round(flowRateLH * 100) / 100,
    innerDiameter: pipe.innerDiameter,
    outerDiameter: pipe.outerDiameter,
    velocity: Math.round(friction.velocity * 1000) / 1000,
    reynolds: Math.round(friction.reynolds),
    frictionLoss: Math.round(friction.pressureLoss),
    localLoss: Math.round(localLoss),
    totalLoss: Math.round(totalLoss),
    specificLoss: Math.round(friction.specificLoss * 100) / 100,
    powerW
  };
}

// Полный расчёт тройниковой системы
export function calcFullSystem(systemParams, radiators, pipeMaterial) {
  const { tSupply, tReturn } = systemParams;
  const maxVelocity = systemParams.maxVelocity || 0.8;
  
  if (!radiators || radiators.length === 0) return { sections: [], totalLoss: 0, mainCircuit: [] };
  
  // Сортировка радиаторов по расстоянию (дальний → ближний)
  const sorted = [...radiators].sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));
  
  // Расчёт участков: от котла до каждого тройника
  // Кумулятивная мощность от самого дальнего радиатора
  const sections = [];
  let cumulativePower = 0;
  
  for (let i = 0; i < sorted.length; i++) {
    const rad = sorted[i];
    cumulativePower += rad.power_w || 0;
    
    // Длина участка — разница расстояний (подача + обратка = ×2)
    const prevDist = i > 0 ? (sorted[i - 1].distance_m || 0) : (sorted[0].distance_m || 0);
    const currDist = rad.distance_m || 0;
    const sectionLength = i === 0 
      ? currDist * 2  // от котла до первого (дальнего) радиатора, подача+обратка
      : (prevDist - currDist) * 2;
    
    const zetaSum = rad.local_resistances || 5;
    
    // Расчёт подводки к радиатору
    const radSection = calcSection(
      rad.power_w || 0, 
      2, // длина подводки к радиатору (м)
      3, // местные сопротивления подводки
      pipeMaterial, 
      tSupply, 
      tReturn, 
      maxVelocity
    );
    
    // Расчёт магистрального участка
    const mainSection = calcSection(
      cumulativePower,
      Math.max(sectionLength, 0.5),
      zetaSum,
      pipeMaterial,
      tSupply,
      tReturn,
      maxVelocity
    );
    
    sections.push({
      radiatorId: rad.id,
      radiatorName: rad.name || `Радиатор ${i + 1}`,
      room: rad.room || '',
      floor: rad.floor || 1,
      radiatorPower: rad.power_w || 0,
      cumulativePower,
      distance: currDist,
      sectionLength: Math.max(sectionLength, 0.5),
      mainSection,
      radSection
    });
  }
  
  // Главное циркуляционное кольцо — путь до самого дальнего радиатора
  const mainCircuitLoss = sections.reduce((sum, s) => sum + s.mainSection.totalLoss, 0);
  const farthestRadLoss = sections[0]?.radSection?.totalLoss || 0;
  const totalSystemLoss = mainCircuitLoss + farthestRadLoss;
  
  // Требуемый напор насоса (с запасом 10%)
  const requiredPumpHead = totalSystemLoss * 1.1;
  const requiredPumpHeadM = requiredPumpHead / 9810; // перевод в м.вод.ст.
  
  // Общий расход
  const totalPower = radiators.reduce((sum, r) => sum + (r.power_w || 0), 0);
  const totalFlowKgH = calcFlowRate(totalPower, tSupply, tReturn);
  const totalFlowLH = calcFlowRateLiters(totalPower, tSupply, tReturn);
  const totalFlowM3H = totalFlowLH / 1000;
  
  return {
    sections: sections.reverse(), // от ближнего к дальнему
    totalLoss: Math.round(totalSystemLoss),
    totalLossPa: Math.round(totalSystemLoss),
    totalLossKPa: Math.round(totalSystemLoss / 100) / 10,
    totalLossMH2O: Math.round(requiredPumpHeadM * 100) / 100,
    requiredPumpHead: Math.round(requiredPumpHead),
    requiredPumpHeadM: Math.round(requiredPumpHeadM * 100) / 100,
    totalPower,
    totalFlowKgH: Math.round(totalFlowKgH * 10) / 10,
    totalFlowLH: Math.round(totalFlowLH * 10) / 10,
    totalFlowM3H: Math.round(totalFlowM3H * 100) / 100
  };
}

export const PIPE_MATERIALS = {
  steel: 'Сталь',
  copper: 'Медь',
  polypropylene: 'Полипропилен',
  metal_plastic: 'Металлопластик'
};

export { STANDARD_DIAMETERS, OUTER_DIAMETERS };