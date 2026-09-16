// =====================================================================
// اپلیکیشن وب مدیریت انرژی ساختمان - مبحث ۱۹ و ۲۲ (نسخه موبایل/iOS - PWA)
// طراحی و توسعه: Mehdi.R
// =====================================================================

const STORAGE_KEY = "energy_app_state_v1";

function defaultState() {
  const firstCity = CLIMATE_DATA.شهرها[0];
  return {
    project: {
      name: "", address: "", usage: "مسکونی", city: firstCity.نام,
      tier: firstCity.رده_نیاز_انرژی, area: 200,
      bridgePercent: CLIMATE_DATA.فیزیک_ساختمان_19_6_3.ضریب_پیش_فرض_پل_حرارتی_درصد,
      inertiaGroup: "متوسط", permits: [], designers: [],
    },
    envelope: [],
    equipment: { cooling: [], heating: [], fuelHeating: [], lighting: [], appliances: [], mechChecked: {} },
    checklist: {},
    phases: {},
    ibms: { url: "", token: "", healthPath: "/health", pushPath: "/api/projects", pullPath: "/api/meters/live", autoConnect: false },
    lastResults: { compliance: [], equipmentEnergy: null, euiResult: null, labelInfo: null, lightingCompliance: null, mechScore: null },
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    }
  } catch (e) { console.warn("state load failed", e); }
  return defaultState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.warn("state save failed", e); }
}

// ---------------------------------------------------------------------
// ناوبری بین تب‌ها
// ---------------------------------------------------------------------
const TABS = ["project", "envelope", "equipment", "energy", "checklist", "ibms", "report"];

function showTab(tab) {
  TABS.forEach(t => {
    document.getElementById("page-" + t).classList.toggle("active", t === tab);
    document.getElementById("tabbtn-" + t).classList.toggle("active", t === tab);
  });
  window.scrollTo(0, 0);
}

function initTabbar() {
  TABS.forEach(t => {
    document.getElementById("tabbtn-" + t).addEventListener("click", () => showTab(t));
  });
}

// ---------------------------------------------------------------------
// تب ۱: پروژه
// ---------------------------------------------------------------------
function renderProjectTab() {
  const el = document.getElementById("page-project");
  const cities = CLIMATE_DATA.شهرها.map(c => c.نام);
  const usageTypes = Object.keys(CLIMATE_DATA.رده_بندی_انرژی_ساختمان.مرجع_شدت_انرژی_kWh_m2_year);
  const tiers = Object.keys(CLIMATE_DATA.رده_های_نیاز_انرژی);
  const inertiaGroups = Object.keys(CLIMATE_DATA.فیزیک_ساختمان_19_6_3.گروه_اینرسی_حرارتی);
  const p = state.project;
  const cityInfo = getCityInfo(p.city) || CLIMATE_DATA.شهرها[0];

  el.innerHTML = `
    <div class="page-title">مشخصات پروژه</div>
    <div class="page-subtitle">اطلاعات کلی، شهر/اقلیم، فیزیک ساختمان (۱۹-۶-۳)، مجوزهای قانونی و تیم طراحان را وارد کنید.</div>

    <div class="card">
      <h3>اطلاعات کلی</h3>
      <div class="field"><label>نام پروژه</label><input id="f-name" value="${p.name}"></div>
      <div class="field"><label>آدرس</label><input id="f-address" value="${p.address}"></div>
      <div class="field"><label>کاربری ساختمان</label>
        <select id="f-usage">${usageTypes.map(u => `<option ${u===p.usage?"selected":""}>${u}</option>`).join("")}</select>
      </div>
      <div class="field"><label>متراژ زیربنا (m2)</label><input id="f-area" type="number" value="${p.area}"></div>
    </div>

    <div class="card">
      <h3>اقلیم و شهر (مطابق پیوست‌های مبحث ۱۹)</h3>
      <div class="field"><label>شهر</label>
        <select id="f-city">${cities.map(c => `<option ${c===p.city?"selected":""}>${c}</option>`).join("")}</select>
      </div>
      <div class="field"><label>رده نیاز انرژی (قابل اصلاح دستی)</label>
        <select id="f-tier">${tiers.map(t => `<option ${t===p.tier?"selected":""}>${t}</option>`).join("")}</select>
      </div>
      <div class="result-row"><span>درجه‌روز گرمایش</span><b>${cityInfo.درجه_روز_گرمایش_HDD}</b></div>
      <div class="result-row"><span>درجه‌روز سرمایش</span><b>${cityInfo.درجه_روز_سرمایش_CDD}</b></div>
      <div class="result-row"><span>کد تقریبی ASHRAE (غیررسمی)</span><b>${cityInfo.کد_تقریبی_ASHRAE}</b></div>
    </div>

    <div class="card">
      <h3>فیزیک ساختمان — بند ۱۹-۶-۳</h3>
      <div class="row2">
        <div class="field"><label>ضریب پل حرارتی (٪)</label><input id="f-bridge" type="number" value="${p.bridgePercent}"></div>
        <div class="field"><label>گروه اینرسی حرارتی</label>
          <select id="f-inertia">${inertiaGroups.map(g => `<option ${g===p.inertiaGroup?"selected":""}>${g}</option>`).join("")}</select>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>مجوزهای قانونی ساختمان</h3>
      <div id="permits-list"></div>
      <button class="btn secondary small" id="add-permit">+ افزودن مجوز</button>
    </div>

    <div class="card">
      <h3>تیم طراحان پروژه</h3>
      <div id="designers-list"></div>
      <button class="btn secondary small" id="add-designer">+ افزودن طراح</button>
    </div>

    <div class="notice info">تغییرات به‌صورت خودکار روی همین دستگاه ذخیره می‌شوند (بدون نیاز به اینترنت).</div>
  `;

  renderPermits();
  renderDesigners();

  document.getElementById("f-name").oninput = e => { state.project.name = e.target.value; saveState(); };
  document.getElementById("f-address").oninput = e => { state.project.address = e.target.value; saveState(); };
  document.getElementById("f-usage").onchange = e => { state.project.usage = e.target.value; saveState(); };
  document.getElementById("f-area").oninput = e => { state.project.area = parseFloat(e.target.value) || 0; saveState(); };
  document.getElementById("f-city").onchange = e => {
    state.project.city = e.target.value;
    const info = getCityInfo(e.target.value);
    if (info) state.project.tier = info.رده_نیاز_انرژی;
    saveState();
    renderProjectTab();
  };
  document.getElementById("f-tier").onchange = e => { state.project.tier = e.target.value; saveState(); };
  document.getElementById("f-bridge").oninput = e => { state.project.bridgePercent = parseFloat(e.target.value) || 0; saveState(); };
  document.getElementById("f-inertia").onchange = e => { state.project.inertiaGroup = e.target.value; saveState(); };
  document.getElementById("add-permit").onclick = () => {
    state.project.permits.push({ type: "", number: "", date: "", authority: "" });
    saveState(); renderPermits();
  };
  document.getElementById("add-designer").onclick = () => {
    state.project.designers.push({ role: "معمار", name: "", license: "" });
    saveState(); renderDesigners();
  };
}

function renderPermits() {
  const list = document.getElementById("permits-list");
  const permits = state.project.permits;
  list.innerHTML = permits.map((p, i) => `
    <div class="item-card">
      <div class="item-head"><span class="idx">مجوز ${i + 1}</span>
        <button class="btn danger small" data-del-permit="${i}">حذف</button></div>
      <div class="row2">
        <div class="field"><label>نوع مجوز</label><input data-permit="${i}" data-field="type" value="${p.type}"></div>
        <div class="field"><label>شماره</label><input data-permit="${i}" data-field="number" value="${p.number}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>تاریخ صدور</label><input data-permit="${i}" data-field="date" value="${p.date}"></div>
        <div class="field"><label>مرجع صادرکننده</label><input data-permit="${i}" data-field="authority" value="${p.authority}"></div>
      </div>
    </div>
  `).join("") || `<div class="page-subtitle">هنوز مجوزی ثبت نشده.</div>`;

  list.querySelectorAll("input[data-permit]").forEach(inp => {
    inp.oninput = e => {
      const i = +e.target.dataset.permit, f = e.target.dataset.field;
      state.project.permits[i][f] = e.target.value; saveState();
    };
  });
  list.querySelectorAll("[data-del-permit]").forEach(btn => {
    btn.onclick = () => { state.project.permits.splice(+btn.dataset.delPermit, 1); saveState(); renderPermits(); };
  });
}

function renderDesigners() {
  const list = document.getElementById("designers-list");
  const roles = ["معمار", "سازه", "مکانیک", "برق", "شهرسازی", "سایر"];
  const designers = state.project.designers;
  list.innerHTML = designers.map((d, i) => `
    <div class="item-card">
      <div class="item-head"><span class="idx">طراح ${i + 1}</span>
        <button class="btn danger small" data-del-designer="${i}">حذف</button></div>
      <div class="row2">
        <div class="field"><label>نقش</label>
          <select data-designer="${i}" data-field="role">${roles.map(r => `<option ${r===d.role?"selected":""}>${r}</option>`).join("")}</select>
        </div>
        <div class="field"><label>نام مهندس</label><input data-designer="${i}" data-field="name" value="${d.name}"></div>
      </div>
      <div class="field"><label>شماره نظام مهندسی</label><input data-designer="${i}" data-field="license" value="${d.license}"></div>
    </div>
  `).join("") || `<div class="page-subtitle">هنوز طراحی ثبت نشده.</div>`;

  list.querySelectorAll("[data-designer]").forEach(inp => {
    const handler = e => {
      const i = +e.target.dataset.designer, f = e.target.dataset.field;
      state.project.designers[i][f] = e.target.value; saveState();
    };
    inp.oninput = handler; inp.onchange = handler;
  });
  list.querySelectorAll("[data-del-designer]").forEach(btn => {
    btn.onclick = () => { state.project.designers.splice(+btn.dataset.delDesigner, 1); saveState(); renderDesigners(); };
  });
}

// ---------------------------------------------------------------------
// تب ۲: پوسته ساختمان
// ---------------------------------------------------------------------
function materialThicknessOptions() {
  const set = new Set();
  CLIMATE_DATA.کتابخانه_مواد_ساختمانی.forEach(m => m.ضخامت_های_رایج_m.forEach(t => set.add(t)));
  return Array.from(set).sort((a, b) => a - b);
}

function renderEnvelopeTab() {
  const el = document.getElementById("page-envelope");
  const componentTypes = ["دیوار_خارجی", "سقف", "کف", "پنجره"];
  const thicknessOptions = materialThicknessOptions();
  const materials = CLIMATE_DATA.کتابخانه_مواد_ساختمانی;

  el.innerHTML = `
    <div class="page-title">پوسته ساختمان — روش تجویزی مبحث ۱۹</div>
    <div class="page-subtitle">هر جزء را اضافه کنید؛ ضخامت و ضریب هدایت حرارتی از مصالح رایج قابل انتخاب یا مقدار دلخواه قابل تایپ است.</div>
    <div id="envelope-list"></div>
    <button class="btn secondary" id="add-envelope">+ افزودن جزء پوسته</button>
    <button class="btn" id="calc-envelope" style="margin-top:10px">محاسبه انطباق U-value</button>
    <div class="card" id="envelope-results" style="margin-top:14px; display:none;">
      <h3>نتایج انطباق</h3>
      <div id="envelope-results-body"></div>
    </div>
  `;

  function renderList() {
    const list = document.getElementById("envelope-list");
    list.innerHTML = state.envelope.map((c, i) => `
      <div class="item-card">
        <div class="item-head"><span class="idx">${c.name || "جزء " + (i + 1)}</span>
          <button class="btn danger small" data-del-env="${i}">حذف</button></div>
        <div class="row2">
          <div class="field"><label>نام جزء</label><input data-env="${i}" data-field="name" value="${c.name}"></div>
          <div class="field"><label>نوع</label>
            <select data-env="${i}" data-field="نوع">${componentTypes.map(t => `<option ${t===c.نوع?"selected":""}>${t}</option>`).join("")}</select>
          </div>
        </div>
        <div class="row2">
          <div class="field"><label>مساحت (m2)</label><input type="number" data-env="${i}" data-field="area" value="${c.area}"></div>
          <div class="field"><label>U مستقیم پنجره (اختیاری)</label><input type="number" step="0.01" data-env="${i}" data-field="direct_u" value="${c.direct_u || ""}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>ضخامت لایه (m)</label>
            <input list="thickness-list" data-env="${i}" data-field="thickness" value="${c.thickness || ""}">
          </div>
          <div class="field"><label>ضریب هدایت k (W/mK)</label>
            <input list="material-list" data-env="${i}" data-field="k" value="${c.k || ""}">
          </div>
        </div>
      </div>
    `).join("") || `<div class="page-subtitle">هنوز جزئی اضافه نشده.</div>`;

    list.querySelectorAll("[data-env]").forEach(inp => {
      const handler = e => {
        const i = +e.target.dataset.env, f = e.target.dataset.field;
        let v = e.target.value;
        if (["area", "direct_u", "thickness", "k"].includes(f)) v = v === "" ? "" : parseFloat(v);
        state.envelope[i][f] = v; saveState();
        if (f === "نوع" || f === "name") renderList();
      };
      inp.oninput = handler; inp.onchange = handler;
    });
    list.querySelectorAll("[data-del-env]").forEach(btn => {
      btn.onclick = () => { state.envelope.splice(+btn.dataset.delEnv, 1); saveState(); renderList(); };
    });
  }

  // دیتالیست‌های پیشنهادی (منوی کشویی قابل‌ویرایش، معادل combo باز در نسخه دسکتاپ)
  if (!document.getElementById("thickness-list")) {
    const dl1 = document.createElement("datalist");
    dl1.id = "thickness-list";
    dl1.innerHTML = thicknessOptions.map(t => `<option value="${t}">`).join("");
    document.body.appendChild(dl1);
    const dl2 = document.createElement("datalist");
    dl2.id = "material-list";
    dl2.innerHTML = materials.map(m => `<option value="${m.k}">${m.نام}</option>`).join("");
    document.body.appendChild(dl2);
  }

  renderList();

  document.getElementById("add-envelope").onclick = () => {
    state.envelope.push({ name: "جزء " + (state.envelope.length + 1), نوع: "دیوار_خارجی", area: 0, thickness: "", k: "", direct_u: "" });
    saveState(); renderList();
  };

  document.getElementById("calc-envelope").onclick = () => {
    const zoneLimits = getZoneLimits(state.project.tier);
    const comps = state.envelope.map(c => ({
      name: c.name, نوع: c.نوع, area: parseFloat(c.area) || 0,
      thickness: parseFloat(c.thickness) || 0, k: parseFloat(c.k) || 0,
      direct_u: c.direct_u ? parseFloat(c.direct_u) : null,
    }));
    const results = checkCompliance(comps, zoneLimits);
    state.lastResults.compliance = results;
    state.lastResults.envelopeComponents = comps;
    saveState();

    const box = document.getElementById("envelope-results");
    box.style.display = "block";
    document.getElementById("envelope-results-body").innerHTML = results.map(r => `
      <div class="result-row">
        <span>${r.نام} (${r.نوع})</span>
        <span>U=${r.U} | مجاز=${r.حداکثر_مجاز}
          <span class="badge ${r.وضعیت === "قبول" ? "pass" : "fail"}">${r.وضعیت}</span>
        </span>
      </div>
    `).join("");
  };
}

// ---------------------------------------------------------------------
// تب ۳: تجهیزات
// ---------------------------------------------------------------------
function renderEquipmentTab() {
  const el = document.getElementById("page-equipment");
  const brands = CLIMATE_DATA.کتابخانه_برندها;
  const lightTypes = CLIMATE_DATA.تجهیزات_مرجع.انواع_منبع_نور;
  const fuelFactors = CLIMATE_DATA.ضرایب_تبدیل_سوخت;
  const fuelNames = Object.keys(fuelFactors).filter(k => k !== "برق" && typeof fuelFactors[k] === "object");
  const mechItems = CLIMATE_DATA.تاسیسات_مکانیکی_19_6_5_چک_لیست;

  el.innerHTML = `
    <div class="page-title">تجهیزات و شدت مصرف انرژی</div>
    <div class="page-subtitle">برند از کتابخانه بازار ایران قابل انتخاب یا برای مدل خاص قابل تایپ دستی است.</div>

    <div class="card"><h3>سرمایش</h3><div id="cooling-list"></div>
      <button class="btn secondary small" id="add-cooling">+ افزودن سرمایش</button></div>

    <div class="card"><h3>گرمایش — ظرفیت و بازده (مرحله طراحی)</h3><div id="heating-list"></div>
      <button class="btn secondary small" id="add-heating">+ افزودن گرمایش</button></div>

    <div class="card"><h3>گرمایش — مصرف سوخت واقعی (مرحله بهره‌برداری)</h3>
      <div class="page-subtitle">نوع سوخت را انتخاب و مقدار مصرف را وارد کنید؛ تبدیل به kWh زنده انجام می‌شود.</div>
      <div id="fuel-list"></div>
      <button class="btn secondary small" id="add-fuel">+ افزودن مصرف سوخت</button></div>

    <div class="card"><h3>روشنایی</h3><div id="lighting-list"></div>
      <button class="btn secondary small" id="add-lighting">+ افزودن روشنایی</button></div>

    <div class="card"><h3>لوازم برقی / لوازم منزل</h3><div id="appliance-list"></div>
      <button class="btn secondary small" id="add-appliance">+ افزودن وسیله</button></div>

    <div class="card"><h3>الزامات تأسیسات مکانیکی و کنترل — بند ۱۹-۶-۵</h3>
      <div id="mech-list"></div></div>

    <button class="btn" id="calc-equipment">محاسبه شدت مصرف انرژی تجهیزات</button>
    <div class="card" id="equipment-results" style="margin-top:14px; display:none;">
      <h3>نتیجه</h3><div id="equipment-results-body"></div>
    </div>
  `;

  const brandOptionsHtml = (list) => list.map(b => `<option value="${b.برند}">`).join("");
  if (!document.getElementById("dl-brand-cooling")) {
    ["سرمایش", "گرمایش", "روشنایی", "لوازم_برقی"].forEach(cat => {
      const dl = document.createElement("datalist");
      dl.id = "dl-brand-" + (cat === "لوازم_برقی" ? "appliance" : cat === "سرمایش" ? "cooling" : cat === "گرمایش" ? "heating" : "lighting");
      dl.innerHTML = brandOptionsHtml(brands[cat] || []);
      document.body.appendChild(dl);
    });
  }

  function renderCooling() {
    const list = document.getElementById("cooling-list");
    list.innerHTML = state.equipment.cooling.map((c, i) => `
      <div class="item-card">
        <div class="item-head"><span class="idx">${c.name || "سرمایش " + (i+1)}</span><button class="btn danger small" data-del="${i}">حذف</button></div>
        <div class="field"><label>نام/محل</label><input data-c="${i}" data-f="name" value="${c.name}"></div>
        <div class="row2">
          <div class="field"><label>برند</label><input list="dl-brand-cooling" data-c="${i}" data-f="brand" value="${c.brand||""}"></div>
          <div class="field"><label>ظرفیت (kW)</label><input type="number" data-c="${i}" data-f="capacity" value="${c.capacity}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>EER/COP</label><input type="number" step="0.1" data-c="${i}" data-f="eer" value="${c.eer}"></div>
          <div class="field"><label>ساعت کارکرد سالانه</label><input type="number" data-c="${i}" data-f="hours" value="${c.hours}"></div>
        </div>
      </div>`).join("") || `<div class="page-subtitle">موردی ثبت نشده.</div>`;
    wireRows(list, state.equipment.cooling, renderCooling);
  }

  function renderHeating() {
    const list = document.getElementById("heating-list");
    list.innerHTML = state.equipment.heating.map((c, i) => `
      <div class="item-card">
        <div class="item-head"><span class="idx">${c.name || "گرمایش " + (i+1)}</span><button class="btn danger small" data-del="${i}">حذف</button></div>
        <div class="field"><label>نام/محل</label><input data-c="${i}" data-f="name" value="${c.name}"></div>
        <div class="row2">
          <div class="field"><label>برند</label><input list="dl-brand-heating" data-c="${i}" data-f="brand" value="${c.brand||""}"></div>
          <div class="field"><label>ظرفیت (kW)</label><input type="number" data-c="${i}" data-f="capacity" value="${c.capacity}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>بازده (0-1)</label><input type="number" step="0.01" data-c="${i}" data-f="efficiency" value="${c.efficiency}"></div>
          <div class="field"><label>ساعت کارکرد سالانه</label><input type="number" data-c="${i}" data-f="hours" value="${c.hours}"></div>
        </div>
      </div>`).join("") || `<div class="page-subtitle">موردی ثبت نشده.</div>`;
    wireRows(list, state.equipment.heating, renderHeating);
  }

  function renderFuel() {
    const list = document.getElementById("fuel-list");
    list.innerHTML = state.equipment.fuelHeating.map((c, i) => {
      const unit = fuelFactors[c.fuelType] ? fuelFactors[c.fuelType].واحد : "";
      const factor = fuelFactors[c.fuelType] ? fuelFactors[c.fuelType].ضریب_kWh_به_ازای_واحد : 0;
      const kwh = Math.round((c.quantity || 0) * factor * 10) / 10;
      return `
      <div class="item-card">
        <div class="item-head"><span class="idx">${c.name || "سوخت " + (i+1)}</span><button class="btn danger small" data-del="${i}">حذف</button></div>
        <div class="field"><label>نام/محل</label><input data-c="${i}" data-f="name" value="${c.name}"></div>
        <div class="row2">
          <div class="field"><label>نوع سوخت</label>
            <select data-c="${i}" data-f="fuelType">${fuelNames.map(n => `<option ${n===c.fuelType?"selected":""}>${n}</option>`).join("")}</select>
          </div>
          <div class="field"><label>مقدار مصرف (${unit})</label><input type="number" data-c="${i}" data-f="quantity" value="${c.quantity}"></div>
        </div>
        <div class="result-row"><span>مصرف تبدیل‌شده</span><b>${kwh} kWh</b></div>
      </div>`;
    }).join("") || `<div class="page-subtitle">موردی ثبت نشده.</div>`;
    wireRows(list, state.equipment.fuelHeating, renderFuel);
  }

  function renderLighting() {
    const list = document.getElementById("lighting-list");
    list.innerHTML = state.equipment.lighting.map((c, i) => `
      <div class="item-card">
        <div class="item-head"><span class="idx">${c.name || "فضا " + (i+1)}</span><button class="btn danger small" data-del="${i}">حذف</button></div>
        <div class="field"><label>نام فضا</label><input data-c="${i}" data-f="name" value="${c.name}"></div>
        <div class="row2">
          <div class="field"><label>برند تجهیز</label><input list="dl-brand-lighting" data-c="${i}" data-f="brand" value="${c.brand||""}"></div>
          <div class="field"><label>نوع منبع نور</label>
            <select data-c="${i}" data-f="lightType">${lightTypes.map(lt => `<option ${lt.نوع===c.lightType?"selected":""}>${lt.نوع}</option>`).join("")}</select>
          </div>
        </div>
        <div class="row2">
          <div class="field"><label>مساحت (m2)</label><input type="number" data-c="${i}" data-f="area" value="${c.area}"></div>
          <div class="field"><label>توان نصب‌شده (W/m2)</label><input type="number" step="0.1" data-c="${i}" data-f="powerDensity" value="${c.powerDensity}"></div>
        </div>
        <div class="field"><label>برنامه کارکرد (ساعت در سال)</label><input type="number" data-c="${i}" data-f="hours" value="${c.hours}"></div>
      </div>`).join("") || `<div class="page-subtitle">موردی ثبت نشده.</div>`;
    wireRows(list, state.equipment.lighting, renderLighting);
  }

  function renderAppliance() {
    const list = document.getElementById("appliance-list");
    list.innerHTML = state.equipment.appliances.map((c, i) => `
      <div class="item-card">
        <div class="item-head"><span class="idx">${c.name || "وسیله " + (i+1)}</span><button class="btn danger small" data-del="${i}">حذف</button></div>
        <div class="row2">
          <div class="field"><label>نام</label><input data-c="${i}" data-f="name" value="${c.name}"></div>
          <div class="field"><label>برند</label><input list="dl-brand-appliance" data-c="${i}" data-f="brand" value="${c.brand||""}"></div>
        </div>
        <div class="row3">
          <div class="field"><label>تعداد</label><input type="number" data-c="${i}" data-f="quantity" value="${c.quantity}"></div>
          <div class="field"><label>توان (W)</label><input type="number" data-c="${i}" data-f="power" value="${c.power}"></div>
          <div class="field"><label>ساعت/روز</label><input type="number" data-c="${i}" data-f="hoursPerDay" value="${c.hoursPerDay}"></div>
        </div>
      </div>`).join("") || `<div class="page-subtitle">موردی ثبت نشده.</div>`;
    wireRows(list, state.equipment.appliances, renderAppliance);
  }

  function wireRows(list, arr, rerender) {
    list.querySelectorAll("[data-c]").forEach(inp => {
      const handler = e => {
        const i = +e.target.dataset.c, f = e.target.dataset.f;
        let v = e.target.value;
        if (["capacity", "eer", "hours", "efficiency", "quantity", "area", "powerDensity", "power", "hoursPerDay"].includes(f)) v = parseFloat(v) || 0;
        arr[i][f] = v; saveState();
        if (f === "name" || f === "fuelType" || f === "lightType") rerender();
      };
      inp.oninput = handler; inp.onchange = handler;
    });
    list.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = () => { arr.splice(+btn.dataset.del, 1); saveState(); rerender(); };
    });
  }

  function renderMech() {
    const list = document.getElementById("mech-list");
    list.innerHTML = mechItems.map((item, i) => `
      <label style="display:flex; align-items:flex-start; gap:8px; margin-bottom:8px; font-size:13px;">
        <input type="checkbox" data-mech="${i}" ${state.equipment.mechChecked[item] ? "checked" : ""} style="margin-top:3px;">
        <span>${item}</span>
      </label>`).join("");
    list.querySelectorAll("[data-mech]").forEach(cb => {
      cb.onchange = e => {
        const item = mechItems[+e.target.dataset.mech];
        state.equipment.mechChecked[item] = e.target.checked; saveState();
      };
    });
  }

  renderCooling(); renderHeating(); renderFuel(); renderLighting(); renderAppliance(); renderMech();

  document.getElementById("add-cooling").onclick = () => { state.equipment.cooling.push({name:"",brand:"",capacity:0,eer:2.6,hours:0}); saveState(); renderCooling(); };
  document.getElementById("add-heating").onclick = () => { state.equipment.heating.push({name:"",brand:"",capacity:0,efficiency:0.85,hours:0}); saveState(); renderHeating(); };
  document.getElementById("add-fuel").onclick = () => { state.equipment.fuelHeating.push({name:"",fuelType:fuelNames[0],quantity:0}); saveState(); renderFuel(); };
  document.getElementById("add-lighting").onclick = () => { state.equipment.lighting.push({name:"",brand:"",lightType:"LED",area:0,powerDensity:0,hours:0}); saveState(); renderLighting(); };
  document.getElementById("add-appliance").onclick = () => { state.equipment.appliances.push({name:"",brand:"",quantity:1,power:0,hoursPerDay:0}); saveState(); renderAppliance(); };

  document.getElementById("calc-equipment").onclick = () => {
    const cooling = state.equipment.cooling.filter(c => c.capacity > 0);
    const heating = state.equipment.heating.filter(c => c.capacity > 0).map(c => ({...c}));
    state.equipment.fuelHeating.forEach(f => {
      const factor = fuelFactors[f.fuelType] ? fuelFactors[f.fuelType].ضریب_kWh_به_ازای_واحد : 0;
      if (f.quantity > 0 && factor) heating.push({ capacity:0, hours:0, efficiency:1, fuelType: f.fuelType, fuelQuantity: f.quantity, fuelFactor: factor });
    });
    const lighting = state.equipment.lighting.filter(c => c.area > 0).map(c => {
      const lt = lightTypes.find(l => l.نوع === c.lightType) || lightTypes[0];
      return { ...c, heatFraction: lt.ضریب_تبدیل_به_گرما };
    });
    const appliances = state.equipment.appliances.filter(c => c.power > 0);

    const result = computeEquipmentEnergy(cooling, heating, lighting, appliances);
    state.lastResults.equipmentEnergy = result;
    state.lastResults.equipmentLighting = lighting;

    const mechScore = scoreMechanicalChecklist(state.equipment.mechChecked, mechItems);
    state.lastResults.mechScore = mechScore;
    saveState();

    const box = document.getElementById("equipment-results");
    box.style.display = "block";
    document.getElementById("equipment-results-body").innerHTML = `
      <div class="result-row"><span>گرمایش</span><b>${result.heating} kWh</b></div>
      <div class="result-row"><span>سرمایش</span><b>${result.cooling} kWh</b></div>
      <div class="result-row"><span>روشنایی</span><b>${result.lighting} kWh (گرما: ${result.lightingHeat} kWh)</b></div>
      <div class="result-row"><span>لوازم برقی</span><b>${result.appliances} kWh</b></div>
      <div class="result-row"><span>جمع کل</span><b>${result.total} kWh</b></div>
      <div class="result-row"><span>انطباق تأسیسات مکانیکی (۱۹-۶-۵)</span><b>${mechScore.checked}/${mechScore.total} (${mechScore.percent}٪)</b></div>
    `;
  };
}

// ---------------------------------------------------------------------
// تب ۴: شاخص انرژی + ردیابی سه‌مرحله‌ای
// ---------------------------------------------------------------------
function renderEnergyTab() {
  const el = document.getElementById("page-energy");
  const r = state.lastResults;

  el.innerHTML = `
    <div class="page-title">شاخص شدت مصرف انرژی (EUI) و رده‌بندی A-D</div>
    <div class="page-subtitle">ابتدا تب‌های پوسته و تجهیزات را محاسبه کنید، سپس اینجا EUI و رده انرژی به‌دست می‌آید.</div>

    <div class="kpi-row">
      <div class="kpi-card"><div class="val" id="kpi-eui">--</div><div class="lbl">EUI (kWh/m2.سال)</div></div>
      <div class="kpi-card"><div class="val" id="kpi-total">--</div><div class="lbl">مصرف سالانه کل (kWh)</div></div>
      <div class="kpi-card" id="kpi-label-card"><div class="val" id="kpi-label">--</div><div class="lbl">رده انرژی</div></div>
    </div>

    <button class="btn" id="calc-energy">محاسبه EUI و رده انرژی</button>
    <div class="card" id="energy-detail" style="margin-top:12px; display:none;"></div>

    <div class="card" style="margin-top:14px;">
      <h3>ردیابی سه‌مرحله‌ای انرژی — طراحی ← ساخت ← بهره‌برداری (بند ۱۹-۷)</h3>
      <div class="field"><label>مرحله فعلی</label>
        <select id="phase-select">
          <option>طراحی</option><option>ساخت</option><option>بهره‌برداری</option>
        </select>
      </div>
      <button class="btn secondary" id="register-phase">ثبت نتیجه این مرحله</button>
      <div id="phase-table" style="margin-top:10px;"></div>
    </div>
  `;

  if (r.euiResult) {
    updateEnergyKpis(r.euiResult, r.labelInfo);
    renderEnergyDetail();
  }
  renderPhaseTable();

  document.getElementById("calc-energy").onclick = () => {
    if (!r.equipmentEnergy) { alert("ابتدا در تب تجهیزات محاسبه را انجام دهید."); return; }
    const comps = r.envelopeComponents || [];
    const cityInfo = getCityInfo(state.project.city);
    const envelope = estimateEnvelopeLoad(comps, cityInfo.درجه_روز_گرمایش_HDD, cityInfo.درجه_روز_سرمایش_CDD,
      CLIMATE_DATA.ضریب_کارایی_سیستم_پیش_فرض, state.project.bridgePercent, state.project.inertiaGroup);
    const euiResult = estimateTotalEUI(r.equipmentEnergy, state.project.area, envelope);

    const refData = CLIMATE_DATA.رده_بندی_انرژی_ساختمان;
    const refEui = (refData.مرجع_شدت_انرژی_kWh_m2_year[state.project.usage] || {})[state.project.tier] || 150;
    const labelInfo = classifyEnergyLabel(euiResult.eui, refEui, refData.آستانه_رده);

    let totalLightingW = 0;
    (r.equipmentLighting || []).forEach(l => totalLightingW += (l.area || 0) * (l.powerDensity || 0));
    const lightingCompliance = checkLightingCompliance(totalLightingW, state.project.area, state.project.usage);

    state.lastResults.envelopeResult = envelope;
    state.lastResults.euiResult = euiResult;
    state.lastResults.labelInfo = labelInfo;
    state.lastResults.lightingCompliance = lightingCompliance;
    state.lastResults.refEui = refEui;
    saveState();

    updateEnergyKpis(euiResult, labelInfo);
    renderEnergyDetail();
  };

  document.getElementById("register-phase").onclick = () => {
    if (!r.euiResult) { alert("ابتدا EUI را محاسبه کنید."); return; }
    const phase = document.getElementById("phase-select").value;
    state.phases[phase] = {
      eui: r.euiResult.eui, total: r.euiResult.totalKwh,
      label: r.labelInfo ? r.labelInfo.label : "-",
      date: new Date().toLocaleDateString("fa-IR"),
    };
    saveState();
    renderPhaseTable();
  };
}

function updateEnergyKpis(euiResult, labelInfo) {
  document.getElementById("kpi-eui").textContent = euiResult.eui;
  document.getElementById("kpi-total").textContent = euiResult.totalKwh;
  const labelEl = document.getElementById("kpi-label");
  const card = document.getElementById("kpi-label-card");
  const label = labelInfo ? labelInfo.label : "--";
  labelEl.textContent = label;
  card.className = "kpi-card label-" + label;
}

function renderEnergyDetail() {
  const r = state.lastResults;
  const box = document.getElementById("energy-detail");
  if (!r.euiResult) return;
  box.style.display = "block";
  box.innerHTML = `
    <div class="result-row"><span>مصرف گرمایش</span><b>${r.euiResult.heating} kWh</b></div>
    <div class="result-row"><span>مصرف سرمایش</span><b>${r.euiResult.cooling} kWh</b></div>
    <div class="result-row"><span>مصرف روشنایی</span><b>${r.euiResult.lighting} kWh</b></div>
    <div class="result-row"><span>مصرف لوازم برقی</span><b>${r.euiResult.appliances} kWh</b></div>
    ${r.lightingCompliance ? `<div class="result-row"><span>توان روشنایی (LPD)</span><b>${r.lightingCompliance.lpd} W/m2 (حداکثر ${r.lightingCompliance.maxLpd})
      <span class="badge ${r.lightingCompliance.وضعیت==="قبول"?"pass":"fail"}">${r.lightingCompliance.وضعیت}</span></b></div>` : ""}
    ${r.envelopeResult ? `<div class="notice">مرجع کنترلی (جمع نمی‌شود): بار گرمایشی پوسته ${r.envelopeResult.heatingKwh} kWh، بار سرمایشی پوسته ${r.envelopeResult.coolingKwh} kWh</div>` : ""}
  `;
}

function renderPhaseTable() {
  const box = document.getElementById("phase-table");
  const phases = ["طراحی", "ساخت", "بهره‌برداری"];
  const savings = computePhaseSavings(
    Object.fromEntries(Object.entries(state.phases).map(([k, v]) => [k, { eui: v.eui, total: v.total }]))
  );
  const rows = phases.filter(p => state.phases[p]).map(p => {
    const snap = state.phases[p];
    const sv = savings[p] || {};
    const savingTxt = sv.savingVsPrev != null ? sv.savingVsPrev + "%" : "-";
    return `<tr><td>${p}</td><td>${snap.eui}</td><td>${snap.label}</td><td>${snap.total}</td><td>${savingTxt}</td></tr>`;
  }).join("");
  box.innerHTML = rows ? `
    <table class="compact">
      <thead><tr><th>مرحله</th><th>EUI</th><th>رده</th><th>مصرف کل</th><th>صرفه‌جویی</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : `<div class="page-subtitle">هنوز مرحله‌ای ثبت نشده.</div>`;
}

// ---------------------------------------------------------------------
// تب ۵: بازرسی مبحث ۲۲
// ---------------------------------------------------------------------
function renderChecklistTab() {
  const el = document.getElementById("page-checklist");
  const statusOptions = CHECKLIST_DATA.وضعیت_ممکن;

  let html = `
    <div class="page-title">بازرسی نگهداری ساختمان — مبحث ۲۲</div>
    <div class="page-subtitle">وضعیت هر آیتم را انتخاب و توضیحات را ثبت کنید.</div>
  `;

  CHECKLIST_DATA.دسته_بندی.forEach((cat, ci) => {
    html += `<div class="card"><h3>${cat.عنوان}</h3>`;
    cat.آیتم‌ها.forEach((item, ii) => {
      const key = ci + "_" + ii;
      const saved = state.checklist[key] || { status: statusOptions[0], note: "" };
      html += `
        <div class="item-card">
          <div style="font-size:13px; margin-bottom:6px;">${item}</div>
          <div class="row2">
            <div class="field"><label>وضعیت</label>
              <select class="status-select" data-checklist="${key}" data-field="status">
                ${statusOptions.map(s => `<option ${s===saved.status?"selected":""}>${s}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>توضیحات</label><input data-checklist="${key}" data-field="note" value="${saved.note}"></div>
          </div>
        </div>`;
    });
    html += `</div>`;
  });

  el.innerHTML = html;

  el.querySelectorAll("[data-checklist]").forEach(inp => {
    const handler = e => {
      const key = e.target.dataset.checklist, f = e.target.dataset.field;
      if (!state.checklist[key]) state.checklist[key] = { status: statusOptions[0], note: "" };
      state.checklist[key][f] = e.target.value;
      saveState();
    };
    inp.oninput = handler; inp.onchange = handler;
  });
}

// ---------------------------------------------------------------------
// تب ۶: اتصال IBMS
// ---------------------------------------------------------------------
function renderIbmsTab() {
  const el = document.getElementById("page-ibms");
  const ib = state.ibms;
  el.innerHTML = `
    <div class="page-title">اتصال به سامانه مدیریت یکپارچه ساختمان (IBMS)</div>
    <div class="notice">کلاینت REST/JSON عمومی. تنظیمات روی همین دستگاه ذخیره می‌شود. توجه: به‌دلیل سیاست‌های CORS مرورگر، ممکن است سرور IBMS شما نیاز به تنظیم CORS برای این آدرس داشته باشد.</div>
    <div class="card">
      <div class="field"><label>آدرس سرور (Base URL)</label><input id="ibms-url" value="${ib.url}" placeholder="https://ibms.example.com"></div>
      <div class="field"><label>توکن API</label><input id="ibms-token" type="password" value="${ib.token}"></div>
      <div class="row2">
        <div class="field"><label>مسیر تست اتصال</label><input id="ibms-health" value="${ib.healthPath}"></div>
        <div class="field"><label>مسیر ارسال پروژه</label><input id="ibms-push" value="${ib.pushPath}"></div>
      </div>
      <div class="field"><label>مسیر دریافت داده لحظه‌ای</label><input id="ibms-pull" value="${ib.pullPath}"></div>
      <label style="display:flex; align-items:center; gap:6px; font-size:12.5px; margin-top:6px;">
        <input type="checkbox" id="ibms-auto" ${ib.autoConnect ? "checked" : ""}> اتصال خودکار هنگام باز شدن برنامه
      </label>
    </div>
    <button class="btn secondary" id="ibms-save">ذخیره تنظیمات</button>
    <button class="btn" id="ibms-test" style="margin-top:8px;">تست اتصال</button>
    <button class="btn secondary" id="ibms-push-btn" style="margin-top:8px;">ارسال داده پروژه</button>
    <button class="btn secondary" id="ibms-pull-btn" style="margin-top:8px;">دریافت داده لحظه‌ای</button>
    <div class="log-box" id="ibms-log" style="margin-top:12px;">آماده.</div>
  `;

  const log = (msg) => {
    const box = document.getElementById("ibms-log");
    box.textContent += "\n" + msg;
    box.scrollTop = box.scrollHeight;
  };

  const readForm = () => {
    ib.url = document.getElementById("ibms-url").value.trim();
    ib.token = document.getElementById("ibms-token").value.trim();
    ib.healthPath = document.getElementById("ibms-health").value.trim() || "/health";
    ib.pushPath = document.getElementById("ibms-push").value.trim() || "/api/projects";
    ib.pullPath = document.getElementById("ibms-pull").value.trim() || "/api/meters/live";
    ib.autoConnect = document.getElementById("ibms-auto").checked;
  };

  document.getElementById("ibms-save").onclick = () => { readForm(); saveState(); log("💾 تنظیمات ذخیره شد."); };

  async function ibmsFetch(path, options = {}) {
    readForm();
    const headers = { "Content-Type": "application/json" };
    if (ib.token) headers["Authorization"] = "Bearer " + ib.token;
    const res = await fetch(ib.url.replace(/\/$/, "") + path, { ...options, headers });
    if (!res.ok) throw new Error("HTTP " + res.status);
    try { return await res.json(); } catch { return { raw: await res.text() }; }
  }

  document.getElementById("ibms-test").onclick = async () => {
    if (!ib.url) { log("❌ ابتدا آدرس سرور را وارد کنید."); return; }
    try { const r = await ibmsFetch(ib.healthPath); log("✅ اتصال موفق:\n" + JSON.stringify(r, null, 2)); }
    catch (e) { log("❌ خطا در اتصال: " + e.message); }
  };

  document.getElementById("ibms-push-btn").onclick = async () => {
    const payload = buildReportPayload();
    try { const r = await ibmsFetch(ib.pushPath, { method: "POST", body: JSON.stringify(payload) });
      log("📤 ارسال موفق:\n" + JSON.stringify(r, null, 2)); }
    catch (e) { log("❌ خطا در ارسال: " + e.message); }
  };

  document.getElementById("ibms-pull-btn").onclick = async () => {
    try { const r = await ibmsFetch(ib.pullPath); log("📥 دریافت شد:\n" + JSON.stringify(r, null, 2)); }
    catch (e) { log("❌ خطا در دریافت: " + e.message); }
  };
}

function buildReportPayload() {
  return {
    project: state.project,
    equipmentEnergy: state.lastResults.equipmentEnergy,
    euiResult: state.lastResults.euiResult,
    label: state.lastResults.labelInfo ? state.lastResults.labelInfo.label : null,
    phases: state.phases,
    timestamp: new Date().toISOString(),
  };
}

function tryAutoConnectIbms() {
  if (state.ibms.autoConnect && state.ibms.url) {
    fetch(state.ibms.url.replace(/\/$/, "") + state.ibms.healthPath).catch(() => {});
  }
}

// ---------------------------------------------------------------------
// تبدیل میلادی به شمسی (همان الگوریتم نسخه پایتون)
// ---------------------------------------------------------------------
const PERSIAN_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

function gregorianToJalali(gy, gm, gd) {
  const gDaysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  const jDaysInMonth = [31,31,31,31,31,31,30,30,30,30,30,29];
  const gy2 = gy - 1600, gm2 = gm - 1, gd2 = gd - 1;
  let gDayNo = 365*gy2 + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400);
  for (let i = 0; i < gm2; i++) gDayNo += gDaysInMonth[i];
  if (gm2 > 1 && ((gy%4===0 && gy%100!==0) || gy%400===0)) gDayNo += 1;
  gDayNo += gd2;
  let jDayNo = gDayNo - 79;
  const jNp = Math.floor(jDayNo / 12053);
  jDayNo %= 12053;
  let jy = 979 + 33*jNp + 4*Math.floor(jDayNo/1461);
  jDayNo %= 1461;
  if (jDayNo >= 366) { jy += Math.floor((jDayNo-1)/365); jDayNo = (jDayNo-1) % 365; }
  let jm, jd;
  for (let i = 0; i < 11; i++) {
    if (jDayNo < jDaysInMonth[i]) { jm = i+1; jd = jDayNo+1; break; }
    jDayNo -= jDaysInMonth[i];
  }
  if (jm === undefined) { jm = 12; jd = jDayNo + 1; }
  return [jy, jm, jd];
}

function nowJalaliString() {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth()+1, now.getDate());
  const time = now.toTimeString().slice(0,5);
  return `${jd} ${PERSIAN_MONTHS[jm-1]} ${jy} - ${time}`;
}

// ---------------------------------------------------------------------
// تب ۷: گزارش خروجی (چاپ / ذخیره به‌عنوان PDF)
// ---------------------------------------------------------------------
function renderReportTab() {
  const el = document.getElementById("page-report");
  el.innerHTML = `
    <div class="page-title">گزارش خروجی</div>
    <div class="page-subtitle">پس از تکمیل تب‌های قبلی، گزارش را بسازید و با گزینه «اشتراک‌گذاری ▸ ذخیره در Files به‌عنوان PDF» یا چاپ Safari، آن را به PDF تبدیل کنید.</div>
    <button class="btn" id="build-report">ساخت و نمایش گزارش</button>
    <button class="btn secondary" id="print-report" style="margin-top:8px;">چاپ / ذخیره به‌عنوان PDF</button>
    <div class="card" id="report-preview" style="margin-top:14px;"></div>
  `;

  document.getElementById("build-report").onclick = () => {
    document.getElementById("report-preview").innerHTML = buildReportHtml();
    document.getElementById("printArea").innerHTML = buildReportHtml();
  };

  document.getElementById("print-report").onclick = () => {
    document.getElementById("printArea").innerHTML = buildReportHtml();
    window.print();
  };
}

function buildReportHtml() {
  const p = state.project;
  const r = state.lastResults;
  const cityInfo = getCityInfo(p.city) || {};
  let html = `
    <h1>گزارش مدیریت انرژی ساختمان (مبحث ۱۹ و ۲۲)</h1>
    <p style="color:#6b7688; font-size:12px;">تاریخ تهیه گزارش: ${nowJalaliString()} &nbsp;|&nbsp; طراحی و توسعه: Mehdi.R</p>
    <h2>مشخصات پروژه</h2>
    <table>
      <tr><td>نام پروژه</td><td>${p.name || "-"}</td></tr>
      <tr><td>آدرس</td><td>${p.address || "-"}</td></tr>
      <tr><td>کاربری</td><td>${p.usage}</td></tr>
      <tr><td>شهر / رده نیاز انرژی</td><td>${p.city} / ${p.tier}</td></tr>
      <tr><td>متراژ زیربنا</td><td>${p.area} m2</td></tr>
      <tr><td>ضریب پل حرارتی / اینرسی</td><td>${p.bridgePercent}% / ${p.inertiaGroup}</td></tr>
    </table>`;

  if (p.permits.length) {
    html += `<h2>مجوزهای قانونی</h2><table><tr><th>نوع</th><th>شماره</th><th>تاریخ</th><th>مرجع</th></tr>`;
    p.permits.forEach(pm => html += `<tr><td>${pm.type}</td><td>${pm.number}</td><td>${pm.date}</td><td>${pm.authority}</td></tr>`);
    html += `</table>`;
  }
  if (p.designers.length) {
    html += `<h2>تیم طراحان</h2><table><tr><th>نقش</th><th>نام</th><th>شماره نظام مهندسی</th></tr>`;
    p.designers.forEach(d => html += `<tr><td>${d.role}</td><td>${d.name}</td><td>${d.license}</td></tr>`);
    html += `</table>`;
  }

  if (r.compliance && r.compliance.length) {
    html += `<h2>پوسته ساختمان — روش تجویزی</h2><table><tr><th>نام</th><th>نوع</th><th>مساحت</th><th>R</th><th>U</th><th>مجاز</th><th>وضعیت</th></tr>`;
    r.compliance.forEach(c => html += `<tr><td>${c.نام}</td><td>${c.نوع}</td><td>${c.مساحت}</td><td>${c.R}</td><td>${c.U}</td><td>${c.حداکثر_مجاز}</td><td>${c.وضعیت}</td></tr>`);
    html += `</table>`;
  }

  if (r.equipmentEnergy) {
    html += `<h2>تجهیزات و شدت مصرف انرژی</h2><table>
      <tr><td>گرمایش</td><td>${r.equipmentEnergy.heating} kWh</td></tr>
      <tr><td>سرمایش</td><td>${r.equipmentEnergy.cooling} kWh</td></tr>
      <tr><td>روشنایی (گرمای تولیدی)</td><td>${r.equipmentEnergy.lighting} kWh (${r.equipmentEnergy.lightingHeat} kWh)</td></tr>
      <tr><td>لوازم برقی</td><td>${r.equipmentEnergy.appliances} kWh</td></tr>
      <tr><td>جمع کل</td><td>${r.equipmentEnergy.total} kWh</td></tr>
    </table>`;
    if (r.mechScore) html += `<p>انطباق تأسیسات مکانیکی (۱۹-۶-۵): ${r.mechScore.checked}/${r.mechScore.total} (${r.mechScore.percent}٪)</p>`;
  }

  if (r.euiResult) {
    html += `<h2>شاخص شدت مصرف انرژی (EUI) و رده‌بندی</h2><table>
      <tr><td>مصرف سالانه کل</td><td>${r.euiResult.totalKwh} kWh</td></tr>
      <tr><td>EUI</td><td>${r.euiResult.eui} kWh/m2.year</td></tr>
      <tr><td>رده انرژی</td><td>${r.labelInfo ? r.labelInfo.label : "-"} (نسبت: ${r.labelInfo ? r.labelInfo.ratio : "-"})</td></tr>
    </table>`;
  }

  if (Object.keys(state.phases).length) {
    html += `<h2>ردیابی سه‌مرحله‌ای انرژی (۱۹-۷)</h2><table><tr><th>مرحله</th><th>EUI</th><th>رده</th><th>مصرف کل</th></tr>`;
    ["طراحی","ساخت","بهره‌برداری"].forEach(ph => {
      if (state.phases[ph]) { const s = state.phases[ph]; html += `<tr><td>${ph}</td><td>${s.eui}</td><td>${s.label}</td><td>${s.total}</td></tr>`; }
    });
    html += `</table>`;
  }

  const checklistKeys = Object.keys(state.checklist);
  if (checklistKeys.length) {
    html += `<h2>خلاصه بازرسی مبحث ۲۲</h2><table><tr><th>آیتم</th><th>وضعیت</th><th>توضیحات</th></tr>`;
    CHECKLIST_DATA.دسته_بندی.forEach((cat, ci) => {
      cat.آیتم‌ها.forEach((item, ii) => {
        const s = state.checklist[ci+"_"+ii];
        if (s) html += `<tr><td>${item}</td><td>${s.status}</td><td>${s.note||"-"}</td></tr>`;
      });
    });
    html += `</table>`;
  }

  html += `<p style="color:#888; font-size:10.5px; margin-top:20px;">این گزارش صرفاً ابزار کمک‌مهندسی برای برآورد اولیه (روش تجویزی) است و جایگزین تاییدیه رسمی مبحث ۱۹ و ۲۲ نیست. نرم‌افزار توسط Mehdi.R طراحی و توسعه داده شده است.</p>`;
  return html;
}

// ---------------------------------------------------------------------
// راه‌اندازی برنامه
// ---------------------------------------------------------------------
function renderAll() {
  renderProjectTab();
  renderEnvelopeTab();
  renderEquipmentTab();
  renderEnergyTab();
  renderChecklistTab();
  renderIbmsTab();
  renderReportTab();
}

function initApp() {
  initTabbar();
  renderAll();
  showTab("project");
  tryAutoConnectIbms();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", initApp);
