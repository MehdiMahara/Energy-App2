// موتور محاسباتی - معادل جاوااسکریپتی calculations.py

function getCityInfo(cityName) {
  return CLIMATE_DATA.شهرها.find(c => c.نام === cityName) || null;
}

function getZoneLimits(tier) {
  return CLIMATE_DATA.رده_های_نیاز_انرژی[tier] || {};
}

function envelopeRValue(component) {
  const sr = CLIMATE_DATA.مقاومت_حرارتی_سطحی[component.نوع] || { Rsi: 0.13, Rse: 0.04 };
  if (component.direct_u) {
    return component.direct_u > 0 ? 1 / component.direct_u : Infinity;
  }
  let r = 0;
  if (component.thickness > 0 && component.k > 0) {
    r += component.thickness / component.k;
  }
  r += (sr.Rsi || 0.13) + (sr.Rse || 0.04);
  return r;
}

function envelopeUValue(component) {
  const r = envelopeRValue(component);
  return r > 0 ? 1 / r : Infinity;
}

function areaWeightedU(components) {
  const totalArea = components.reduce((s, c) => s + (c.area || 0), 0);
  if (totalArea <= 0) return { uAvg: 0, totalArea: 0 };
  const weighted = components.reduce((s, c) => s + envelopeUValue(c) * (c.area || 0), 0);
  return { uAvg: weighted / totalArea, totalArea };
}

function checkCompliance(components, zoneLimits) {
  const limits = {
    "دیوار_خارجی": zoneLimits.حداکثر_U_دیوار_خارجی,
    "سقف": zoneLimits.حداکثر_U_سقف,
    "کف": zoneLimits.حداکثر_U_کف,
    "پنجره": zoneLimits.حداکثر_U_پنجره,
  };
  return components.map(c => {
    const u = envelopeUValue(c);
    const r = envelopeRValue(c);
    const limit = limits[c.نوع];
    const passed = limit !== undefined && u <= limit;
    return {
      نام: c.name, نوع: c.نوع, مساحت: c.area,
      R: Math.round(r * 1000) / 1000, U: Math.round(u * 1000) / 1000,
      حداکثر_مجاز: limit, وضعیت: passed ? "قبول" : "مردود",
    };
  });
}

function estimateEnvelopeLoad(components, hdd, cdd, systemEff, bridgePercent, inertiaGroup) {
  const etaHeating = (systemEff && systemEff.گرمایش_متوسط) || 0.85;
  const copCooling = (systemEff && systemEff.سرمایش_متوسط) || 2.8;
  const { uAvg, totalArea } = areaWeightedU(components);

  let qHeat = uAvg * totalArea * hdd * 24 / 1000;
  let qCool = uAvg * totalArea * cdd * 24 / 1000;

  const bridgeFactor = 1 + (bridgePercent || 0) / 100;
  qHeat *= bridgeFactor;
  qCool *= bridgeFactor;

  if (inertiaGroup) {
    const groups = CLIMATE_DATA.فیزیک_ساختمان_19_6_3.گروه_اینرسی_حرارتی;
    const factor = (groups[inertiaGroup] && groups[inertiaGroup].ضریب_اصلاح_بار_سرمایش) || 1.0;
    qCool *= factor;
  }

  return {
    uAvg: Math.round(uAvg * 1000) / 1000,
    totalArea: Math.round(totalArea * 10) / 10,
    heatingKwh: Math.round((qHeat / etaHeating) * 10) / 10,
    coolingKwh: Math.round((qCool / copCooling) * 10) / 10,
  };
}

function coolingEquipmentEnergy(eq) {
  const eer = eq.eer > 0 ? eq.eer : 2.6;
  return (eq.capacity * eq.hours) / eer;
}

function heatingEquipmentEnergy(eq) {
  if (eq.fuelType && eq.fuelQuantity && eq.fuelFactor) {
    return eq.fuelQuantity * eq.fuelFactor;
  }
  const eff = eq.efficiency > 0 ? eq.efficiency : 0.85;
  return (eq.capacity * eq.hours) / eff;
}

function lightingEnergy(z) {
  return (z.powerDensity * z.area * z.hours) / 1000;
}

function lightingHeat(z) {
  return lightingEnergy(z) * (z.heatFraction != null ? z.heatFraction : 0.2);
}

function applianceEnergy(a) {
  return (a.quantity * a.power * a.hoursPerDay * 365) / 1000;
}

function computeEquipmentEnergy(cooling, heating, lighting, appliances) {
  const eCooling = cooling.reduce((s, e) => s + coolingEquipmentEnergy(e), 0);
  const eHeating = heating.reduce((s, e) => s + heatingEquipmentEnergy(e), 0);
  const eLighting = lighting.reduce((s, e) => s + lightingEnergy(e), 0);
  const eAppliances = appliances.reduce((s, e) => s + applianceEnergy(e), 0);
  const eLightHeat = lighting.reduce((s, e) => s + lightingHeat(e), 0);
  const round1 = x => Math.round(x * 10) / 10;
  return {
    heating: round1(eHeating), cooling: round1(eCooling),
    lighting: round1(eLighting), appliances: round1(eAppliances),
    lightingHeat: round1(eLightHeat),
    total: round1(eHeating + eCooling + eLighting + eAppliances),
  };
}

function checkLightingCompliance(totalLightingPowerW, floorArea, usageType) {
  if (floorArea <= 0) return null;
  const lpd = totalLightingPowerW / floorArea;
  const maxLpd = CLIMATE_DATA.تجهیزات_مرجع.روشنایی_حداکثر_توان_مجاز_W_m2[usageType] || 12;
  return {
    lpd: Math.round(lpd * 100) / 100, maxLpd,
    وضعیت: lpd <= maxLpd ? "قبول" : "مردود",
  };
}

function scoreMechanicalChecklist(checkedMap, allItems) {
  const checked = allItems.filter(i => checkedMap[i]).length;
  const total = allItems.length;
  return { checked, total, percent: total > 0 ? Math.round((checked / total) * 1000) / 10 : 0 };
}

function estimateTotalEUI(equipmentResult, floorArea, envelopeResult) {
  const total = equipmentResult.total;
  const eui = floorArea > 0 ? total / floorArea : 0;
  const result = {
    totalKwh: Math.round(total * 10) / 10,
    eui: Math.round(eui * 100) / 100,
    heating: equipmentResult.heating, cooling: equipmentResult.cooling,
    lighting: equipmentResult.lighting, appliances: equipmentResult.appliances,
  };
  if (envelopeResult) {
    result.envelopeHeating = envelopeResult.heatingKwh;
    result.envelopeCooling = envelopeResult.coolingKwh;
  }
  return result;
}

function classifyEnergyLabel(eui, referenceEui, thresholds) {
  if (referenceEui <= 0) return { label: "نامشخص", ratio: null };
  const ratio = eui / referenceEui;
  const order = ["A", "B", "C", "D"];
  for (const label of order) {
    if (ratio <= (thresholds[label] != null ? thresholds[label] : 999)) {
      return { label, ratio: Math.round(ratio * 100) / 100 };
    }
  }
  return { label: "زیر رده D", ratio: Math.round(ratio * 100) / 100 };
}

function computePhaseSavings(snapshots) {
  const phases = ["طراحی", "ساخت", "بهره‌برداری"];
  const results = {};
  const baseline = snapshots["طراحی"];
  let prevPhase = null;
  for (const phase of phases) {
    const snap = snapshots[phase];
    if (!snap) continue;
    const entry = { eui: snap.eui, total: snap.total };
    if (baseline && phase !== "طراحی" && baseline.eui > 0) {
      entry.savingVsBaseline = Math.round((1 - snap.eui / baseline.eui) * 1000) / 10;
    }
    if (prevPhase && snapshots[prevPhase] && snapshots[prevPhase].eui > 0) {
      entry.savingVsPrev = Math.round((1 - snap.eui / snapshots[prevPhase].eui) * 1000) / 10;
    }
    results[phase] = entry;
    prevPhase = phase;
  }
  return results;
}
