/*
 * ISPAT হালচাল : the app (screens, navigation, settings, chat)
 * Data comes from Supabase (live) or from demo-data.js (demo mode).
 */
import { CONFIG } from './config.js';
import { OCHA, svg, oi, hydrateIcons } from './icons.js';
import { demoData } from './demo-data.js';
import { parseWorkbook } from './parse.js';
import * as backend from './backend.js';
const { LIVE, AI_ON } = backend;

const MALE = oi('male'), FEMALE = oi('female');
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------- data state ---------- */
let DATA = null;                 // current dashboard data (null while loading)
let YEARS = [];
let CURRENT_YEAR = String(TODAY.getFullYear());
let META = { updatedAt: null, source: '' };
let loadState = 'loading';       // loading | ready | empty | error

function setData(d, meta) {
  DATA = d;
  YEARS = (d && (d.yearList || Object.keys(d.years || {}).sort())) || [];
  if (!YEARS.includes(CURRENT_YEAR)) CURRENT_YEAR = [...YEARS].reverse().find(y => d.years[y]) || YEARS[0] || CURRENT_YEAR;
  if (state.year !== 'all' && !YEARS.includes(state.year)) state.year = 'all';
  META = meta || META;
  loadState = d ? 'ready' : 'empty';
  backend.resetAI();
}
function lastUpdatedText() {
  if (DATA && DATA.lastUpdated) return `Data last updated on ${fmtDate(DATA.lastUpdated)}`;
  if (META.updatedAt) return `Synced ${META.updatedAt.toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}`;
  return LIVE ? 'Waiting for data' : 'Demo data';
}

/* ================= HELPERS ================= */
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
const num = (n) => Math.round(n).toLocaleString('en-US');
const pct = (a,b) => b ? Math.round(a / b * 100) : 0;
const level = (p) => p >= 70 ? 'good' : p >= 30 ? 'warn' : 'bad';
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toDate = (d) => d instanceof Date ? d : new Date(d + 'T00:00:00');
const fmtDate = (d) => toDate(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
const reduceMotion = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };

function ring(p, small) {
  const r = 52, c = +(2 * Math.PI * r).toFixed(1);
  return `<div class="ring-wrap${small ? ' sm' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}">
    <svg class="ring" viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="${r}"/><circle class="bar" cx="60" cy="60" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-ring="${p}" data-c="${c}"/></svg>
    <div class="ring-label"><span data-count="${p}" data-suffix="%">0%</span></div></div>`;
}
const bar = (p, lvl, extra='') => `<div class="bar-track ${lvl||''} ${extra}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i data-w="${Math.min(p,100)}"></i></div>`;
const countSpan = (n, fmt='num') => `<span data-count="${n}" data-fmt="${fmt}">${fmt==='usd' ? usd(n) : num(n)}</span>`;
const tileIcon = (k, c) => `<span class="emo ${c}">${oi(k)}</span>`;

function genderBlock(m, f, onHero) {
  const t = m + f, mp = pct(m, t), fp = 100 - mp;
  return `<div class="gender${onHero ? ' on-hero' : ''}">
      <div class="g-box male">${MALE}<div><div class="g-val">${countSpan(m)}</div><div class="g-lbl">Male</div></div></div>
      <div class="g-box female">${FEMALE}<div><div class="g-val">${countSpan(f)}</div><div class="g-lbl">Female</div></div></div>
    </div>` + (onHero ? '' : `
    <div class="split" aria-hidden="true"><div class="m" style="width:0" data-w="${mp}"></div><div class="f" style="width:0" data-w="${fp}"></div></div>
    <div class="split-legend"><span>${mp}% male</span><span>${fp}% female</span></div>`);
}

function animate(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('[data-ring]').forEach(el => { const c = +el.dataset.c; el.style.strokeDashoffset = c * (1 - (+el.dataset.ring) / 100); });
    root.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
  }));
  root.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count, fmt = el.dataset.fmt, suf = el.dataset.suffix || '';
    const show = (v) => el.textContent = (fmt === 'usd' ? usd(v) : num(v)) + suf;
    if (reduceMotion()) { show(target); return; }
    const t0 = performance.now(), dur = 1100;
    const step = (t) => { const k = Math.min((t - t0) / dur, 1); show(target * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

function activeYear(includeAll) {
  if (state.year === 'all' && !includeAll) return YEARS.includes(CURRENT_YEAR) ? CURRENT_YEAR : '2025';
  return state.year;
}
function yearChips(includeAll) {
  const sel = activeYear(includeAll);
  let h = `<div class="chips" role="tablist" aria-label="Select year">`;
  if (includeAll) h += `<button class="chip ${sel==='all'?'active':''}" role="tab" aria-selected="${sel==='all'}" data-year="all">All Years</button>`;
  YEARS.forEach(y => {
    const soon = !DATA.years[y];
    h += `<button class="chip ${sel===y?'active':''}" role="tab" aria-selected="${sel===y}" data-year="${y}">${y}${soon ? '<span class="soon">soon</span>' : ''}</button>`;
  });
  return h + '</div>';
}
const emptyYear = (y) => `<div class="card empty"><div class="emo">${oi('time')}</div><h3>${y} is on its way</h3></div>`;

/* activity flag logic */
function flagOf(a) {
  if (a.status === 'Completed') return { cls:'f-done', key:'done', icon:'check', label:'Completed', color:'var(--good)' };
  if (a.status === 'Ongoing') return { cls:'f-ongoing', key:'ongoing', icon:'cycle', label:'Ongoing', color:'var(--info)' };
  const diff = Math.round((toDate(a.date) - TODAY) / 86400000);
  if (diff < 0) return { cls:'f-over', key:'over', icon:'warning', label:`${-diff} day${diff===-1?'':'s'} overdue`, color:'var(--bad)', diff };
  if (diff === 0) return { cls:'f-soon', key:'soon', icon:'alert', label:'Today!', color:'var(--warn)', diff };
  if (diff <= 5) return { cls:'f-soon', key:'soon', icon:'alert', label:`${diff} day${diff===1?'':'s'} left`, color:'var(--warn)', diff };
  return { cls:'f-idle', key:'later', icon:'time', label:`In ${diff} days`, color:'var(--border)', diff };
}



/* ================= STATE / NAV ================= */
const state = { page:'dashboard', year:'all', trainTab:'ngo', eventTab:'policy', actFilter:'all', actCat:'all' };
const NAV = [
  { id:'dashboard', label:'Home', icon:'home' },
  { id:'finance', label:'Finance', icon:'finance' },
  { id:'training', label:'Training', icon:'training' },
  { id:'events', label:'Events', icon:'events' },
  { id:'activities', label:'Planner', icon:'activities' }
];
const SIDE = [...NAV, { id:'achievements', icon:'achievements' }, { id:'settings', icon:'settings' }];
const SIDE_LABEL = { dashboard:'Dashboard', finance:'Finance', training:'Training', events:'Workshop & Policy Dialogue', activities:'Activity Planner', achievements:'Achievements', settings:'Settings' };

document.getElementById('bottom-nav').innerHTML = NAV.map(n => `<button class="nav-btn" data-go="${n.id}">${svg(n.icon)}<span>${n.label}</span></button>`).join('');
document.getElementById('side-nav').innerHTML = SIDE.map(n => `<button class="side-btn" data-go="${n.id}">${svg(n.icon)}<span>${SIDE_LABEL[n.id]}</span></button>`).join('');

const RENDER = { dashboard:renderDashboard, finance:renderFinance, training:renderTraining, events:renderEvents, activities:renderActivities, achievements:renderAchievements, settings:renderSettings };

function statusView() {
  if (loadState === 'loading') return `<div class="card empty"><div class="spinner" aria-hidden="true"></div><h3>Loading data</h3></div>`;
  if (loadState === 'error') return `<div class="card empty"><div class="emo">${oi('warning')}</div><h3>Could not load the data</h3><p>Please check your internet connection and try again.</p></div>`;
  return `<div class="card empty"><div class="emo">${oi('search')}</div><h3>No data yet</h3><p>Upload the Excel file from Settings, or wait for the automatic sync.</p><button class="btn-soft" data-go="settings">Open Settings</button></div>`;
}

function go(page, opts) {
  Object.assign(state, opts || {});
  state.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  el.innerHTML = (loadState !== 'ready' && page !== 'settings') ? statusView() : RENDER[page]();
  el.classList.add('active');
  animate(el);
  document.querySelectorAll('[data-go]').forEach(b => {
    const on = b.dataset.go === page;
    if (b.classList.contains('nav-btn') || b.classList.contains('side-btn')) { b.classList.toggle('active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); }
  });
}
function rerender(scrollTop) { const y = window.scrollY; go(state.page); if (!scrollTop) window.scrollTo(0, y); }

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-a11y]')) { openA11y(e.target.closest('[data-a11y]')); return; }
  const g = e.target.closest('[data-go]');
  if (g) { const extra = g.dataset.opts ? JSON.parse(g.dataset.opts) : null; go(g.dataset.go, extra); window.scrollTo({ top:0, behavior: reduceMotion() ? 'auto' : 'smooth' }); closeChat(); return; }
  const y = e.target.closest('[data-year]');
  if (y) { state.year = y.dataset.year; rerender(); return; }
  const a = e.target.closest('[data-action]');
  if (a) ACTIONS[a.dataset.action](a.dataset.val, a);
});
document.addEventListener('change', (e) => { const c = e.target.closest('[data-change]'); if (c) ACTIONS[c.dataset.change](c.value, c); });

/* ================= PAGES ================= */
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function yearTotals(y) {
  const d = DATA.years[y]; if (!d) return null;
  const trainings = d.ngo.length + d.ngoab.length;
  const trained = [...d.ngo, ...d.ngoab].reduce((s, t) => s + t.male + t.female, 0);
  return { ben: d.beneficiaries.male + d.beneficiaries.female, male:d.beneficiaries.male, female:d.beneficiaries.female, trainings, trained, policy:d.policy.length, workshop:d.workshop.length, planned:d.trainingPlanned };
}
function allTotals() {
  const t = YEARS.map(yearTotals).filter(Boolean);
  const sum = (k) => t.reduce((s, x) => s + x[k], 0);
  return { male:sum('male'), female:sum('female'), ben:sum('ben'), trainings:sum('trainings'), trained:sum('trained'), policy:sum('policy'), workshop:sum('workshop') };
}

function renderDashboard() {
  const y = state.year;
  let h = `<div class="page-head"><div class="greet">${greeting()}</div><div class="page-sub">Here is how ISPAT is doing today</div></div>${yearChips(true)}`;

  if (y === 'all') {
    const t = allTotals(), p = DATA.ngoabOnline;
    h += `<div class="grid md2">
      <div class="hero">
        <div class="card-title">${oi('reached')} Total beneficiaries reached</div>
        <div class="big" style="margin-top:.5rem">${countSpan(t.ben)}</div>
        ${genderBlock(t.male, t.female, true)}
      </div>
      <div class="card">
        <div class="card-title">${oi('computer')} NGOAB Online Solution</div>
        ${p === null || p === undefined ? `<div class="hero-row"><div class="hero-meta"><div style="font-weight:800;font-size:1.1rem">Development progress</div><div class="muted" style="margin-top:.3rem">Not set yet</div></div></div>`
          : `<div class="hero-row">${ring(p)}<div class="hero-meta"><div style="font-weight:800;font-size:1.1rem">Development progress</div></div></div>`}
      </div>
    </div>
    <div class="section-label">Big numbers so far</div>
    <div class="grid g2 md4">
      <button class="tile" data-go="training">${tileIcon('training','c1')}<span class="val">${countSpan(t.trainings)}</span><span class="lbl">Trainings completed</span></button>
      <button class="tile" data-go="training">${tileIcon('users','c2')}<span class="val">${countSpan(t.trained)}</span><span class="lbl">People trained</span></button>
      <button class="tile" data-go="events" data-opts='{"eventTab":"policy"}'>${tileIcon('policy','c5')}<span class="val">${countSpan(t.policy)}</span><span class="lbl">Policy dialogues</span></button>
      <button class="tile" data-go="events" data-opts='{"eventTab":"workshop"}'>${tileIcon('meeting','c3')}<span class="val">${countSpan(t.workshop)}</span><span class="lbl">Workshops</span></button>
    </div>`;
    return h;
  }

  const d = DATA.years[y];
  if (!d) return h + emptyYear(y);
  const t = yearTotals(y), ep = pct(d.spent, d.budget);
  const attention = DATA.activities.map(flagOf).filter(f => f.key === 'over' || f.key === 'soon').length;
  h += `<div class="grid md2">
    <div class="hero">
      <div class="card-title">${oi('financing')} Overall expenditure ${y}</div>
      <div class="hero-row">${ring(ep)}<div class="hero-meta"><div class="amount">${countSpan(d.spent,'usd')}</div><div class="of">spent of ${usd(d.budget)}</div><div class="pill-light">${oi('fund')} ${usd(d.budget - d.spent)} remaining</div></div></div>
    </div>
    <div class="card">
      <div class="card-title">${oi('reached')} Beneficiaries reached ${y}</div>
      <div class="big" style="margin-top:.5rem">${countSpan(t.ben)}</div>
      ${genderBlock(t.male, t.female)}
    </div>
  </div>
  <div class="section-label">Quick look</div>
  <div class="grid g2 md4">
    <button class="tile" data-go="training">${tileIcon('training','c1')}<span class="val">${t.trainings}<span class="muted" style="font-size:1rem"> / ${d.trainingPlanned}</span></span><span class="lbl">Trainings done</span><span class="go">See details →</span></button>
    <button class="tile" data-go="events" data-opts='{"eventTab":"workshop"}'>${tileIcon('meeting','c3')}<span class="val">${t.workshop}</span><span class="lbl">Workshops</span><span class="go">See details →</span></button>
    <button class="tile" data-go="events" data-opts='{"eventTab":"policy"}'>${tileIcon('policy','c5')}<span class="val">${t.policy}</span><span class="lbl">Policy dialogues</span><span class="go">See details →</span></button>
    <button class="tile" data-go="activities" data-opts='{"actFilter":"attention","actCat":"all"}'>${tileIcon('bell','c4')}<span class="val" style="color:var(--bad)">${attention}</span><span class="lbl">Need attention</span><span class="go">Open planner →</span></button>
  </div>`;
  return h;
}

function renderFinance() {
  const y = activeYear(false), d = DATA.years[y];
  let h = `<div class="page-head"><div class="page-title">Finance</div><div class="page-sub">Budget and spending, all in USD</div></div>${yearChips(false)}`;
  if (!d) return h + emptyYear(y);
  const ep = pct(d.spent, d.budget);
  h += `<div class="hero fin-overall">
    <div class="card-title">${oi('report')} Overall ${y}</div>
    <div class="kv"><span>Total budget</span><b>${countSpan(d.budget,'usd')}</b></div>
    <div class="kv"><span>Total expenditure</span><b>${countSpan(d.spent,'usd')}</b></div>
    <div class="kv"><span>Overall expenditure</span><b style="font-size:1.7rem">${countSpan(ep)}%</b></div>
    <div class="hero-bar"><i data-w="${ep}"></i></div>
  </div>`;
  if (d.components && d.components.length) {
    h += `<div class="section-label">By component</div><div class="grid md3">`;
    d.components.forEach((c, i) => {
      const p = pct(c.spent, c.budget), l = level(p);
      h += `<div class="card" style="margin-top:0">
        <div class="comp-head"><span class="comp-badge c${(i % 6) + 1}">C${i + 1}</span><div><div class="comp-sub">Component ${i + 1}</div><div class="comp-name">${esc(c.name)}</div></div></div>
        <div class="kv-row"><span>Total budget</span><b>${usd(c.budget)}</b></div>
        <div class="kv-row"><span>Total expenditure</span><b>${usd(c.spent)}</b></div>
        <div class="pct-row"><span class="muted">Overall expenditure</span><b class="t-${l}">${p}%</b></div>
        ${bar(p, l)}
      </div>`;
    });
    h += `</div><div class="legend"><span><i style="background:var(--good)"></i>70% and above</span><span><i style="background:var(--warn)"></i>30 to 69%</span><span><i style="background:var(--bad)"></i>below 30%</span></div>`;
  }
  return h + `<p class="note">${oi('time')} ${lastUpdatedText()}</p>`;
}

function personRow(m, f) {
  return `<div class="people"><span class="p m" title="Male">${MALE}<span class="sr-only">Male</span>${m}</span><span class="p f" title="Female">${FEMALE}<span class="sr-only">Female</span>${f}</span><span class="tot">${oi('users')} ${m + f} people</span></div>`;
}
const metaRow = (t) => `<div class="item-meta"><span>${oi('location')} ${esc(t.venue)}</span><span>${oi('calendar')} ${fmtDate(t.date)}</span></div>`;

function renderTraining() {
  const y = activeYear(false), d = DATA.years[y];
  let h = `<div class="page-head"><div class="page-title">Training</div><div class="page-sub">Learning journeys for NGOs and NGOAB</div></div>${yearChips(false)}`;
  if (!d) return h + emptyYear(y);
  const done = d.ngo.length + d.ngoab.length, rem = Math.max(d.trainingPlanned - done, 0);
  h += `<div class="grid g3">
    <div class="tile">${tileIcon('report','c1')}<span class="val">${countSpan(d.trainingPlanned)}</span><span class="lbl">Planned</span></div>
    <div class="tile">${tileIcon('check','c2')}<span class="val" style="color:var(--good)">${countSpan(done)}</span><span class="lbl">Completed</span></div>
    <button class="tile" data-go="activities" data-opts='{"actFilter":"open","actCat":"Training"}' aria-label="${rem} trainings remaining. Open the planner">${tileIcon('time','c3')}<span class="val" style="color:var(--warn)">${countSpan(rem)}</span><span class="lbl">Remaining</span><span class="go">View list →</span></button>
  </div>
  <div class="card mt"><div class="pct-row" style="margin-top:0"><span class="muted">Yearly progress</span><b>${pct(done, d.trainingPlanned)}%</b></div>${bar(pct(done, d.trainingPlanned), 'good')}</div>
  <div class="seg" role="tablist">
    <button role="tab" aria-selected="${state.trainTab==='ngo'}" class="${state.trainTab==='ngo'?'active':''}" data-action="trainTab" data-val="ngo">For NGO<span class="count">${d.ngo.length}</span></button>
    <button role="tab" aria-selected="${state.trainTab==='ngoab'}" class="${state.trainTab==='ngoab'?'active':''}" data-action="trainTab" data-val="ngoab">For NGOAB<span class="count">${d.ngoab.length}</span></button>
  </div>`;
  const list = d[state.trainTab];
  if (!list.length) return h + `<div class="card empty"><div class="emo">${oi('search')}</div><h3>No trainings yet</h3></div>`;
  h += `<div class="items">` + list.map((t, i) => `<article class="item">
      <div class="item-top"><span class="sl">${i + 1}</span><div><div class="item-name">${esc(t.name)}</div>${metaRow(t)}</div></div>
      ${personRow(t.male, t.female)}
      ${t.pre === null || t.pre === undefined || t.post === null || t.post === undefined ? '' : `<div class="assess"><span>Pre</span>${bar(t.pre, '', 'pre')}<span>${t.pre}%</span><span>Post</span>${bar(t.post, 'good')}<span>${t.post}%</span></div>
      <span class="gain">${oi('trending')} ${t.post - t.pre >= 0 ? '+' : ''}${t.post - t.pre} points learning gain</span>`}
    </article>`).join('') + `</div>`;
  return h;
}

function renderEvents() {
  const y = activeYear(false), d = DATA.years[y];
  let h = `<div class="page-head"><div class="page-title">Workshop & Policy Dialogue</div></div>${yearChips(false)}`;
  if (!d) return h + emptyYear(y);
  h += `<div class="grid g2">
    <button class="tile" data-action="eventTab" data-val="policy">${tileIcon('policy','c5')}<span class="val">${countSpan(d.policy.length)}</span><span class="lbl">Policy dialogues completed</span></button>
    <button class="tile" data-action="eventTab" data-val="workshop">${tileIcon('meeting','c3')}<span class="val">${countSpan(d.workshop.length)}</span><span class="lbl">Workshops completed</span></button>
  </div>
  <div class="seg" role="tablist">
    <button role="tab" aria-selected="${state.eventTab==='policy'}" class="${state.eventTab==='policy'?'active':''}" data-action="eventTab" data-val="policy">Policy Dialogue<span class="count">${d.policy.length}</span></button>
    <button role="tab" aria-selected="${state.eventTab==='workshop'}" class="${state.eventTab==='workshop'?'active':''}" data-action="eventTab" data-val="workshop">Workshop<span class="count">${d.workshop.length}</span></button>
  </div>`;
  h += `<div class="items">` + d[state.eventTab].map((t, i) => `<article class="item">
      <div class="item-top"><span class="sl">${i + 1}</span><div><div class="item-name">${esc(t.name)}</div>${metaRow(t)}</div></div>
      ${personRow(t.male, t.female)}
    </article>`).join('') + `</div>`;
  return h;
}

function renderActivities() {
  const all = DATA.activities.map(a => ({ ...a, f: flagOf(a) })).sort((a, b) => toDate(a.date) - toDate(b.date));
  const count = (k) => all.filter(a => a.f.key === k).length;
  const FILTERS = [['all','All'],['open','Not done'],['attention','Needs attention'],['soon','Due soon'],['over','Overdue'],['ongoing','Ongoing'],['done','Completed']];
  const CATS = ['all','Training','Workshop','Policy Dialogue','Other'];
  const list = all.filter(a => {
    const k = a.f.key, f = state.actFilter;
    const okF = f === 'all' || (f === 'open' && k !== 'done') || (f === 'attention' && (k === 'over' || k === 'soon')) || f === k;
    return okF && (state.actCat === 'all' || a.cat === state.actCat);
  });
  let h = `<div class="page-head"><div class="page-title">Activity Planner</div></div>
  <div class="summary-pills">
    <span class="spill f-over">${oi('warning')} ${count('over')} overdue</span><span class="spill f-soon">${oi('alert')} ${count('soon')} due soon</span>
    <span class="spill f-ongoing">${oi('cycle')} ${count('ongoing')} ongoing</span><span class="spill f-done">${oi('check')} ${count('done')} done</span>
  </div>
  <div class="chips" role="tablist" aria-label="Filter by status">${FILTERS.map(([k, l]) => `<button class="chip small ${state.actFilter===k?'active':''}" role="tab" aria-selected="${state.actFilter===k}" data-action="actFilter" data-val="${k}">${l}</button>`).join('')}</div>
  <div class="filters"><label for="catSel" class="muted" style="font-size:.82rem;font-weight:600">Category</label>
    <select id="catSel" class="select" data-change="actCat">${CATS.map(c => `<option value="${c}" ${state.actCat===c?'selected':''}>${c === 'all' ? 'All categories' : c}</option>`).join('')}</select></div>`;
  if (!list.length) return h + `<div class="card empty"><div class="emo">${oi('check')}</div><h3>Nothing here</h3><p>No activities match this filter. Nice and tidy!</p></div>`;
  h += list.map(a => { const d = toDate(a.date);
    return `<div class="act ${a.f.key === 'over' ? 'over' : ''}" style="--flag:${a.f.color}">
      <div class="date-block"><div class="d">${d.getDate()}</div><div class="mo">${d.toLocaleDateString('en-GB',{month:'short'})} ${String(d.getFullYear()).slice(2)}</div></div>
      <div class="act-body"><div class="act-name">${esc(a.name)}</div><div class="act-cat">${esc(a.cat)} · ${fmtDate(d)}</div><span class="flag ${a.f.cls}">${oi(a.f.icon)} ${a.f.label}</span></div>
    </div>`; }).join('');
  return h;
}

function renderAchievements() {
  if (!DATA.achievements.length) return `<div class="hero ach-hero"><span class="trophy">${oi('trophy')}</span><div class="page-title" style="color:#fff;margin-top:.5rem">Achievements at a Glance</div></div><div class="card empty mt"><div class="emo">${oi('trophy')}</div><h3>No achievements added yet</h3></div>`;
  return `<div class="hero ach-hero"><span class="trophy">${oi('trophy')}</span><div class="page-title" style="color:#fff;margin-top:.5rem">Achievements at a Glance</div></div>
  <div class="ach-grid">${DATA.achievements.map((a, i) => `<div class="ach" style="animation-delay:${i * 80}ms"><span class="emo c${(i % 6) + 1}">${oi(a.icon)}</span><div><div class="ach-text">${esc(a.text)}</div><div class="ach-tag">${esc(a.tag)}</div></div></div>`).join('')}</div>`;
}

const THEMES = [
  { id:'classic', name:'Classic', mode:'Light', bg:'#F3F6FA', head:'#0468B1', line:'#0F1B2D' },
  { id:'soft', name:'Sky Soft', mode:'Light', bg:'#EEF3F8', head:'linear-gradient(90deg,#0468B1,#5BC2E7)', line:'#003F7D' },
  { id:'ocean', name:'Ocean', mode:'Dark', bg:'#0A1520', head:'#5BC2E7', line:'#E8F1FA' },
  { id:'midnight', name:'Midnight', mode:'Dark', bg:'#0A1124', head:'linear-gradient(90deg,#1B3D8A,#0468B1)', line:'#EEF2FF' }
];
const FONTS = [
  { id:'poppins', name:'Poppins', desc:'Friendly and round (default)', fam:"'Poppins'" },
  { id:'inter', name:'Inter', desc:'Crisp and modern', fam:"'Inter'" },
  { id:'nunito', name:'Nunito', desc:'Soft and playful', fam:"'Nunito'" }
];
const SIZES = [['14','A-'],['16','A'],['18','A+'],['20','A++']];

function a11yRows() {
  return `<div class="opt-row"><div><div class="ol">Text size</div><div class="os">Make everything easier to read</div></div>
      <div class="sizes" role="radiogroup" aria-label="Text size">${SIZES.map(([v, l]) => `<button role="radio" aria-checked="${prefs.size===v}" aria-label="Text size ${l}" class="${prefs.size===v?'active':''}" data-action="size" data-val="${v}">${l}</button>`).join('')}</div></div>
    <div class="opt-row"><div><div class="ol">High contrast</div><div class="os">Stronger text and borders</div></div>
      <button class="switch" role="switch" aria-checked="${prefs.contrast==='on'}" aria-label="High contrast" data-action="contrast"></button></div>
    <div class="opt-row"><div><div class="ol">Reduce motion</div><div class="os">Turn off animations</div></div>
      <button class="switch" role="switch" aria-checked="${prefs.motion==='off'}" aria-label="Reduce motion" data-action="motion"></button></div>`;
}

function renderSettings() {
  return `<div class="page-head"><div class="page-title">Settings</div></div>
  <div class="set-group"><div class="set-title">Theme</div><div class="themes">${THEMES.map(t => `
    <button class="theme-opt ${prefs.theme===t.id?'active':''}" data-action="theme" data-val="${t.id}" aria-pressed="${prefs.theme===t.id}">
      <div class="mini" style="background:${t.bg}"><div class="mh" style="background:${t.head}"></div><div class="ml" style="background:${t.line}"></div><div class="ml s" style="background:${t.line}"></div></div>
      <div class="theme-name">${t.name}<small>${t.mode}</small></div></button>`).join('')}</div></div>
  <div class="set-group"><div class="set-title">Font</div><div class="fonts">${FONTS.map(f => `
    <button class="font-opt ${prefs.font===f.id?'active':''}" data-action="font" data-val="${f.id}" aria-pressed="${prefs.font===f.id}" style="font-family:${f.fam},'Hind Siliguri',sans-serif">
      <div class="fn">${f.name} · Aa</div><div class="fs">${f.desc}</div></button>`).join('')}</div></div>
  <div class="set-group"><div class="set-title">Accessibility</div><div class="card" style="padding:0">${a11yRows()}</div></div>
  ${dataSection()}
  <div class="set-group"><div class="set-title">About developer</div><div class="card about">
    <div class="dev-line">Developed by: <b>Fatema Jinia</b></div>
    <div class="love">Built with <span class="heart">❤️</span> for UNDP ISPAT Project</div>
  </div></div>
  <button class="btn-out" data-action="logout">Sign out</button>
  <p class="note" style="justify-content:center;margin-top:1rem">Version ${CONFIG.appVersion}${LIVE ? '' : ' · Demo mode'}</p>`;
}



/* ================= DATA SECTION (Settings) ================= */
function dataSection() {
  const src = LIVE ? (META.source ? ` · ${esc(META.source)}` : '') : '';
  return `<div class="set-group"><div class="set-title">Data</div><div class="card" style="padding:0">
    <div class="opt-row"><div><div class="ol">${LIVE ? 'Live data from Excel' : 'Demo mode'}</div>
      <div class="os">${LIVE ? esc(lastUpdatedText()) + src : 'Showing sample data. Add your Supabase settings in docs/js/config.js to go live.'}</div></div></div>
    <div class="opt-row"><div><div class="ol">Update from an Excel file</div><div class="os">Pick the latest ISPAT Halchal Excel file (.xlsx)${LIVE ? '. Everyone sees the new data right away.' : ' to preview it here.'}</div></div>
      <button class="btn-soft" data-action="pickFile">${svg('upload')} Upload</button></div>
  </div><input type="file" id="xlsx-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></div>`;
}

/* ================= PREFS & ACTIONS ================= */
const prefs = { theme: store.get('ispat-theme') || 'classic', font: store.get('ispat-font') || 'poppins', size: store.get('ispat-size') || '16', motion: store.get('ispat-motion') || 'on', contrast: store.get('ispat-contrast') || 'off' };
function applyPrefs() {
  document.body.className = `theme-${prefs.theme} font-${prefs.font}${prefs.motion === 'off' ? ' reduce-motion' : ''}${prefs.contrast === 'on' ? ' high-contrast' : ''}`;
  document.documentElement.style.fontSize = prefs.size + 'px';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = { classic:'#F3F6FA', soft:'#EEF3F8', ocean:'#0A1520', midnight:'#0A1124' }[prefs.theme];
}
function setPref(k, v) {
  prefs[k] = v; store.set('ispat-' + k, v); applyPrefs();
  if (state.page === 'settings' && document.getElementById('app').classList.contains('active')) document.getElementById('page-settings').innerHTML = renderSettings();
  if (!document.getElementById('a11y-back').hidden) {
    const f = document.activeElement && document.activeElement.dataset.action;
    document.getElementById('a11y-body').innerHTML = a11yRows();
    const again = document.querySelector(`#a11y-body [data-action="${f}"]${k === 'size' ? `[data-val="${v}"]` : ''}`); if (again) again.focus();
  }
}

const ACTIONS = {
  trainTab: (v) => { state.trainTab = v; rerender(); },
  eventTab: (v) => { state.eventTab = v; rerender(); },
  actFilter: (v) => { state.actFilter = v; rerender(); },
  actCat: (v) => { state.actCat = v; rerender(); },
  theme: (v) => setPref('theme', v),
  font: (v) => setPref('font', v),
  size: (v) => setPref('size', v),
  motion: () => setPref('motion', prefs.motion === 'off' ? 'on' : 'off'),
  contrast: () => setPref('contrast', prefs.contrast === 'on' ? 'off' : 'on'),
  pickFile: () => { const inp = document.getElementById('xlsx-file'); inp.value = ''; inp.onchange = () => inp.files[0] && handleUpload(inp.files[0]); inp.click(); },
  logout: async () => {
    closeChat(); backend.stopWatching();
    try { await backend.logout(); } catch (e) {}
    try { sessionStorage.removeItem('ispat-demo-in'); } catch (e) {}
    showLogin();
  }
};

/* ================= TOAST & DIALOG ================= */
function toast(msg, kind) {
  const t = document.getElementById('toast');
  t.className = 'toast show ' + (kind || '');
  t.innerHTML = msg;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast', 4200);
}
function dialog(title, bodyHtml, buttons) {
  return new Promise((resolve) => {
    const back = document.getElementById('dlg-back');
    document.getElementById('toast').className = 'toast';
    document.getElementById('dlg-title').textContent = title;
    document.getElementById('dlg-body').innerHTML = bodyHtml;
    const acts = document.getElementById('dlg-actions');
    acts.innerHTML = buttons.map((b, i) => `<button class="${b.primary ? 'btn-solid' : 'btn-soft'}" data-i="${i}">${b.label}</button>`).join('');
    const prev = document.activeElement;
    const close = (val) => { back.hidden = true; acts.onclick = null; document.removeEventListener('keydown', onKey); if (prev) prev.focus(); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    acts.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) close(buttons[+b.dataset.i].value); };
    document.addEventListener('keydown', onKey);
    back.hidden = false;
    acts.querySelector('button').focus();
  });
}

/* ================= EXCEL UPLOAD ================= */
let XLSXlib = null;
async function handleUpload(file) {
  try {
    toast('Reading the Excel file...');
    if (!XLSXlib) XLSXlib = await import(CONFIG.sheetjsUrl);
    const wb = XLSXlib.read(await file.arrayBuffer(), { type:'array' });
    const parsed = parseWorkbook(XLSXlib, wb);
    const yrs = parsed.yearList.map(y => `${y}: ${parsed.years[y] ? 'has data' : 'empty (coming soon)'}`);
    const count = (k) => parsed.yearList.reduce((s, y) => s + (parsed.years[y] ? parsed.years[y][k].length : 0), 0);
    const body = `<p><b>${esc(file.name)}</b></p><ul>${yrs.map(x => `<li>${x}</li>`).join('')}
      <li>${count('ngo') + count('ngoab')} trainings, ${count('policy')} policy dialogues, ${count('workshop')} workshops</li>
      <li>${parsed.activities.length} planned activities, ${parsed.achievements.length} achievements</li></ul>
      ${parsed.warnings.length ? `<div class="warn-box"><b>${parsed.warnings.length} ${parsed.warnings.length > 1 ? 'rows need' : 'row needs'} fixing in Excel:</b><ul>${parsed.warnings.slice(0, 8).map(w => `<li>${esc(w)}</li>`).join('')}</ul>${parsed.warnings.length > 8 ? `<p>and ${parsed.warnings.length - 8} more.</p>` : ''}</div>` : '<p class="ok-line">Everything looks good.</p>'}`;
    const ok = await dialog(LIVE ? 'Update the app with this file?' : 'Preview this file?', body, [{ label:'Cancel', value:false }, { label: LIVE ? 'Update for everyone' : 'Preview', value:true, primary:true }]);
    if (!ok) return;
    if (LIVE) { await backend.saveData(parsed); toast('Done! Everyone now sees the new data.', 'good'); }
    else { setData(parsed, { updatedAt: new Date(), source:'Preview' }); toast('Showing your Excel data (preview only).', 'good'); rerender(); }
  } catch (e) {
    console.error(e);
    toast(esc(e.message && e.message.length < 160 ? e.message : 'Could not read that file. Is it the ISPAT Halchal Excel template?'), 'bad');
  }
}

/* ================= ACCESSIBILITY DIALOG ================= */
let a11yReturn = null;
function openA11y(from) {
  a11yReturn = from;
  document.getElementById('a11y-body').innerHTML = a11yRows();
  document.getElementById('a11y-back').hidden = false;
  document.getElementById('a11y-close').focus();
}
function closeA11y() { document.getElementById('a11y-back').hidden = true; if (a11yReturn) a11yReturn.focus(); }
document.getElementById('a11y-close').addEventListener('click', closeA11y);
document.getElementById('a11y-back').addEventListener('click', (e) => { if (e.target.id === 'a11y-back') closeA11y(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('a11y-back').hidden) closeA11y();
  else if (!document.getElementById('chat-panel').hidden) { closeChat(); document.getElementById('chat-fab').focus(); }
});

/* ================= CHAT ASSISTANT ================= */
const chatLog = document.getElementById('chat-log');
let chatStarted = false, chatBusy = false;
const SUGS = ['Total beneficiaries', 'Budget this year', 'Overdue activities', 'Trainings this year', 'NGOAB Online progress', 'What is coming up?'];
function openChat() {
  const p = document.getElementById('chat-panel'), f = document.getElementById('chat-fab');
  p.hidden = false; f.setAttribute('aria-expanded', 'true');
  if (!chatStarted) {
    chatStarted = true;
    document.getElementById('chat-sub').textContent = AI_ON ? 'Powered by Gemini AI · answers from project data' : 'Answers from the project data';
    document.getElementById('chat-sugs').innerHTML = SUGS.map(s => `<button type="button" data-sug="${s}">${s}</button>`).join('');
    addMsg(`Hi! I am the ISPAT Assistant. Ask me anything about the project data: budget, expenditure, beneficiaries, trainings, workshops, policy dialogues or planned activities. ${AI_ON ? 'You can ask in English or বাংলা.' : ''}`, 'bot');
  }
  document.getElementById('chat-in').focus();
}
function closeChat() { const p = document.getElementById('chat-panel'); if (!p) return; p.hidden = true; document.getElementById('chat-fab').setAttribute('aria-expanded', 'false'); }
document.getElementById('chat-fab').addEventListener('click', openChat);
document.getElementById('chat-close').addEventListener('click', () => { closeChat(); document.getElementById('chat-fab').focus(); });
document.getElementById('chat-sugs').addEventListener('click', (e) => { const b = e.target.closest('[data-sug]'); if (b) ask(b.dataset.sug); });
document.getElementById('chat-form').addEventListener('submit', (e) => { e.preventDefault(); const i = document.getElementById('chat-in'); if (i.value.trim() && !chatBusy) { ask(i.value.trim()); i.value = ''; } });

function addMsg(html, who) { const m = document.createElement('div'); m.className = 'msg ' + who; m.innerHTML = html; chatLog.appendChild(m); chatLog.scrollTop = chatLog.scrollHeight; return m; }
async function ask(q) {
  if (chatBusy) return;
  chatBusy = true;
  addMsg(esc(q), 'me');
  const t = addMsg('<span class="typing" aria-label="Typing"><span></span><span></span><span></span></span>', 'bot');
  let html;
  if (loadState !== 'ready') html = 'The data is not loaded yet. Please try again in a moment.';
  else if (AI_ON) {
    try { html = md(await backend.askAI(q, aiContext(), todayISO())); }
    catch (e) { console.warn('AI unavailable, using built-in answers:', e); html = ruleAnswer(q.replace(/this year/i, CURRENT_YEAR)); }
  } else {
    await new Promise(r => setTimeout(r, reduceMotion() ? 0 : 450));
    html = ruleAnswer(q.replace(/this year/i, CURRENT_YEAR));
  }
  t.innerHTML = html; chatLog.scrollTop = chatLog.scrollHeight;
  chatBusy = false;
}

/** Very small, safe markdown: **bold**, bullet lists, paragraphs */
function md(text) {
  const lines = esc(text).split('\n'); let out = '', list = false;
  for (let l of lines) {
    l = l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (m) { if (!list) { out += '<ul>'; list = true; } out += `<li>${m[1]}</li>`; }
    else { if (list) { out += '</ul>'; list = false; } if (l.trim()) out += `<p>${l}</p>`; }
  }
  return out + (list ? '</ul>' : '');
}

/** Compact JSON of the current data for Gemini */
function aiContext() {
  const years = {};
  YEARS.forEach(y => {
    const d = DATA.years[y];
    if (!d) { years[y] = 'No data yet (coming soon)'; return; }
    years[y] = {
      totalBudgetUSD: d.budget, totalExpenditureUSD: d.spent, overallExpenditurePct: pct(d.spent, d.budget),
      beneficiaries: { male: d.beneficiaries.male, female: d.beneficiaries.female, total: d.beneficiaries.male + d.beneficiaries.female },
      trainingsPlanned: d.trainingPlanned, trainingsCompleted: d.ngo.length + d.ngoab.length,
      components: d.components.map((c, i) => ({ no: c.no || i + 1, name: c.name, budgetUSD: c.budget, expenditureUSD: c.spent, expenditurePct: pct(c.spent, c.budget) })),
      trainingsForNGO: d.ngo, trainingsForNGOAB: d.ngoab, policyDialogues: d.policy, workshops: d.workshop
    };
  });
  const a = allTotals();
  return JSON.stringify({
    years, allYears: { beneficiariesMale: a.male, beneficiariesFemale: a.female, beneficiariesTotal: a.ben, trainingsCompleted: a.trainings, peopleTrained: a.trained, policyDialogues: a.policy, workshops: a.workshop },
    ngoabOnlineSolutionProgressPct: DATA.ngoabOnline,
    activityPlan: DATA.activities.map(x => ({ name: x.name, category: x.cat, plannedDate: typeof x.date === 'string' ? x.date : todayISO(), status: x.status, flag: flagOf(x).label })),
    achievements: DATA.achievements.map(x => x.text)
  });
}

const has = (t, re) => re.test(t);
function yearsAsked(t) {
  const ys = [...new Set((t.match(/20(25|26|27)/g) || []))];
  if (ys.length) return ys;
  if (has(t, /this year|current year|এই বছর/)) return [CURRENT_YEAR];
  if (has(t, /last year|previous year|গত বছর/)) return [String(+CURRENT_YEAR - 1)];
  return null;
}
const list = (items) => '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
const noData = (y) => `${y} has no data yet. It will show up once it is added to the Excel sheet.`;

function ruleAnswer(q) {
  const t = q.toLowerCase();
  const asked = yearsAsked(t);
  const years = asked || YEARS.filter(y => DATA.years[y]);
  const scope = asked ? asked.join(' and ') : 'all years';

  if (has(t, /^(hi|hello|hey|salam|assalam|good (morning|afternoon|evening))|হাই|হ্যালো|সালাম/)) return `Hello! How can I help? Try asking about trainings, budget or upcoming activities.`;
  if (has(t, /help|what can you|how to use/)) return `I can answer questions like:${list(['How many female beneficiaries in 2025?', 'What is the overall expenditure for 2026?', 'Show component budgets for 2025', 'Which activities are overdue?', 'How many NGOAB trainings in 2026?', 'Average post assessment score'])}`;
  if (has(t, /online|solution|portal|software/)) return `NGOAB Online Solution is at <b>${DATA.ngoabOnline}%</b> development progress.`;
  if (has(t, /achiev|highlight|success|অর্জন/)) return `Achievements at a glance:${list(DATA.achievements.map(a => esc(a.text)))}`;

  const acts = DATA.activities.map(a => ({ ...a, f: flagOf(a) })).sort((a, b) => toDate(a.date) - toDate(b.date));
  const actLine = (a) => `<b>${esc(a.name)}</b> (${fmtDate(a.date)}, ${a.f.label.toLowerCase()})`;
  if (has(t, /overdue|late|delay|missed|behind|বিলম্ব/)) { const o = acts.filter(a => a.f.key === 'over'); return o.length ? `There ${o.length === 1 ? 'is 1 overdue activity' : `are ${o.length} overdue activities`}:${list(o.map(actLine))}` : `Great news, nothing is overdue right now!`; }
  if (has(t, /ongoing|in progress|running|চলমান/)) { const o = acts.filter(a => a.f.key === 'ongoing'); return o.length ? `Ongoing now:${list(o.map(actLine))}` : `Nothing is marked ongoing right now.`; }
  if (has(t, /upcoming|coming up|next|soon|due|this week|schedule|plan(ned)? (activit|event)|আসন্ন/)) { const o = acts.filter(a => a.f.key === 'soon' || a.f.key === 'later').slice(0, 5); return o.length ? `Coming up next:${list(o.map(actLine))}` : `No upcoming activities in the plan.`; }

  const isTraining = has(t, /train|course|প্রশিক্ষণ/);
  if (isTraining && has(t, /remain|left|yet|pending|not done|বাকি/)) {
    const o = acts.filter(a => a.cat === 'Training' && a.f.key !== 'done');
    const nums = years.map(y => { const x = yearTotals(y); return x ? `${y}: <b>${Math.max(x.planned - x.trainings, 0)}</b> of ${x.planned} remaining` : noData(y); });
    return `${list(nums)}` + (o.length ? `Upcoming or pending trainings in the planner:${list(o.map(actLine))}` : '');
  }
  if (has(t, /pre|post|assess|score|improv|learning gain|test/)) {
    const rows = years.flatMap(y => DATA.years[y] ? [...DATA.years[y].ngo, ...DATA.years[y].ngoab] : []);
    if (!rows.length) return noData(scope);
    const avg = (k) => Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length);
    return `Across ${rows.length} trainings (${scope}), the average pre assessment score is <b>${avg('pre')}%</b> and post assessment is <b>${avg('post')}%</b>. That is a gain of <b>+${avg('post') - avg('pre')} points</b>.`;
  }

  const wantsF = has(t, /female|women|woman|girl|নারী|মহিলা/), wantsM = has(t, /\bmale\b|\bmen\b|\bman\b|boy|পুরুষ/);
  if (has(t, /beneficiar|reach|people|gender|উপকারভোগী/) || ((wantsF || wantsM) && !isTraining && !has(t, /workshop|policy|dialogue/))) {
    const rows = years.map(y => { const x = yearTotals(y); if (!x) return noData(y);
      const parts = wantsF && !wantsM ? `<b>${num(x.female)}</b> female` : wantsM && !wantsF ? `<b>${num(x.male)}</b> male` : `<b>${num(x.ben)}</b> total (${num(x.male)} male, ${num(x.female)} female)`;
      return `${y}: ${parts}`; });
    if (!asked) { const a = allTotals(); rows.push(`All years: <b>${num(wantsF && !wantsM ? a.female : wantsM && !wantsF ? a.male : a.ben)}</b>`); }
    return `Beneficiaries reached:${list(rows)}`;
  }

  if (has(t, /component/)) {
    return years.map(y => { const d = DATA.years[y]; if (!d) return noData(y);
      return `<b>${y}</b>${list(d.components.map((c, i) => `C${i + 1} ${esc(c.name)}: ${usd(c.spent)} of ${usd(c.budget)} (<b>${pct(c.spent, c.budget)}%</b>)`))}`; }).join('');
  }
  if (has(t, /budget|expend|spent|spend|money|fund|financ|cost|usd|dollar|বাজেট|খরচ|ব্যয়/)) {
    return `Finance (${scope}):` + list(years.map(y => { const d = DATA.years[y]; if (!d) return noData(y);
      return `${y}: budget <b>${usd(d.budget)}</b>, expenditure <b>${usd(d.spent)}</b>, overall expenditure <b>${pct(d.spent, d.budget)}%</b>`; }));
  }

  if (isTraining) {
    const grp = has(t, /ngoab/) ? 'ngoab' : has(t, /\bngo\b|ngos/) ? 'ngo' : null;
    const rows = years.map(y => { const d = DATA.years[y]; if (!d) return noData(y);
      if (grp) { const l = d[grp]; return `${y}: <b>${l.length}</b> ${grp.toUpperCase()} trainings completed, ${num(l.reduce((s, r) => s + r.male + r.female, 0))} participants`; }
      const x = yearTotals(y); return `${y}: <b>${x.trainings}</b> of ${x.planned} planned trainings completed (${d.ngo.length} NGO, ${d.ngoab.length} NGOAB), ${num(x.trained)} people trained`; });
    return `Trainings:${list(rows)}`;
  }
  if (has(t, /workshop|কর্মশালা/)) {
    return `Workshops completed:${list(years.map(y => { const d = DATA.years[y]; return d ? `${y}: <b>${d.workshop.length}</b>${d.workshop.length ? ', latest was ' + esc(d.workshop[d.workshop.length - 1].name) : ''}` : noData(y); }))}`;
  }
  if (has(t, /policy|dialogue|সংলাপ|নীতি/)) {
    return `Policy dialogues completed:${list(years.map(y => { const d = DATA.years[y]; return d ? `${y}: <b>${d.policy.length}</b>${d.policy.length ? ', latest was ' + esc(d.policy[d.policy.length - 1].name) : ''}` : noData(y); }))}`;
  }
  if (has(t, /thank|thanks|ধন্যবাদ/)) return `You are welcome! 😊`;
  return `Sorry, I did not catch that. I can help with budget, expenditure, beneficiaries, trainings, workshops, policy dialogues, planned activities and achievements. Try one of the suggestions below.`;
}



/* ================= LOGIN & START ================= */
function showLogin() {
  document.getElementById('app').classList.remove('active');
  document.getElementById('login').classList.add('active');
  document.getElementById('login').classList.remove('checking');
  document.getElementById('login-form').reset();
}
function enterApp() {
  document.getElementById('login').classList.remove('active');
  document.getElementById('app').classList.add('active');
  go(state.page || 'dashboard');
}
function startData() {
  if (!LIVE) { setData(demoData(), { updatedAt: null, source: 'Demo' }); return; }
  loadState = 'loading';
  backend.watchData((res) => {
    if (res) setData(res.data, { updatedAt: res.updatedAt, source: res.source }); else { DATA = null; loadState = 'empty'; }
    if (document.getElementById('app').classList.contains('active')) rerender();
  }, (err) => { console.error(err); loadState = 'error'; rerender(); });
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('login-error'), btn = e.target.querySelector('.btn-primary');
  err.classList.remove('show');
  btn.disabled = true; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = 'Signing in...';
  try {
    await backend.login(document.getElementById('uid').value, document.getElementById('upw').value);
    if (!LIVE) { try { sessionStorage.setItem('ispat-demo-in', '1'); } catch (x) {} startData(); enterApp(); }
    // LIVE: onAuth below opens the app
  } catch (x) {
    err.textContent = x.message; void err.offsetWidth; err.classList.add('show');
  } finally { btn.disabled = false; btn.textContent = btn.dataset.label; }
});
document.getElementById('eye').addEventListener('click', (e) => {
  const inp = document.getElementById('upw'), b = e.currentTarget, show = inp.type === 'password';
  inp.type = show ? 'text' : 'password'; b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

async function boot() {
  hydrateIcons(); applyPrefs();
  if (!LIVE) {
    document.getElementById('login').classList.remove('checking');
    try { if (sessionStorage.getItem('ispat-demo-in') === '1') { startData(); enterApp(); } } catch (e) {}
    return;
  }
  try { await backend.initBackend(); }
  catch (e) {
    console.error(e);
    document.getElementById('login').classList.remove('checking');
    const err = document.getElementById('login-error'); err.textContent = 'Could not connect. Please check your internet connection and reload.'; err.classList.add('show');
    return;
  }
  backend.onAuth((user) => {
    if (user) { startData(); enterApp(); }
    else { backend.stopWatching(); showLogin(); }
  });
}
boot();
window.ispat = { go, state, get data() { return DATA; } };   // handy for debugging in the browser console
