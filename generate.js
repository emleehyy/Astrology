// ─────────────────────────────────────────────
// COSMIC GUIDE — Weekly Generator
// Runs every Sunday via GitHub Actions
// Calls Claude API → writes index.html
// ─────────────────────────────────────────────

const https = require('https');
const fs = require('fs');

// ── Birth data (your personal constants) ──
const BIRTH = {
  date: 'September 26, 1996',
  time: '14:52',
  location: 'Jinhua, Zhejiang, China',
  sun: 'Libra 3° House 7',
  rising: 'Capricorn 13°',
  moon: 'Pisces 18° House 3',
  bazi: '丙子年 庚戌月 壬午日 辛未时',
  dayPillar: '壬午 (Water on Fire)',
  zodiac: 'Rat · 鼠',
  protector: '千手观音',
  currentYear: '丙午年 2026 — Visibility & Destiny Year',
  situation: 'Recently started new job (Jan 2026, not forever job). Building own business/project on the side. Transitioning from employee to builder. Relationship not serious yet. Tends to wait for clarity then act. Blocks: Libra delay loop, Capricorn prep trap, Pisces dissolution (absorbing others doubts).'
};

// ── Date helpers ──
function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const sun = new Date(now); sun.setDate(now.getDate() - day);
  const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const cnMonths = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  return {
    start: sun,
    end: sat,
    label: `${months[sun.getMonth()]} ${sun.getDate()}–${sat.getDate()}, ${sun.getFullYear()}`,
    labelCn: `${sun.getFullYear()}年${cnMonths[sun.getMonth()]}第${Math.ceil(sun.getDate()/7)}周`,
    monthName: months[now.getMonth()],
    monthCn: cnMonths[now.getMonth()],
    year: now.getFullYear(),
    dateStr: now.toISOString().split('T')[0]
  };
}

function getMoonPhase(date) {
  const known = new Date(2000, 0, 6, 18, 14, 0);
  const days = (date - known) / 86400000;
  const cycle = 29.53058867;
  const phase = ((days % cycle) + cycle) % cycle;
  if (phase < 1.85)  return { name: 'New Moon', cn: '新月', glyph: '🌑', pct: 2 };
  if (phase < 7.38)  return { name: 'Waxing Crescent', cn: '蛾眉月', glyph: '🌒', pct: Math.round(phase/14.77*100) };
  if (phase < 9.22)  return { name: 'First Quarter', cn: '上弦月', glyph: '🌓', pct: 50 };
  if (phase < 14.77) return { name: 'Waxing Gibbous', cn: '盈凸月', glyph: '🌔', pct: Math.round((0.5+(phase-9.22)/11.1)*100) };
  if (phase < 16.61) return { name: 'Full Moon', cn: '满月', glyph: '🌕', pct: 100 };
  if (phase < 22.15) return { name: 'Waning Gibbous', cn: '亏凸月', glyph: '🌖', pct: Math.round((1-(phase-16.61)/11.1)*100) };
  if (phase < 23.99) return { name: 'Last Quarter', cn: '下弦月', glyph: '🌗', pct: 50 };
  return { name: 'Waning Crescent', cn: '残月', glyph: '🌘', pct: Math.round((29.53-phase)/14.77*100) };
}

// ── Call Claude API ──
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content[0].text);
        } catch(e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Build prompt ──
function buildPrompt(week, moon) {
  return `You are a master astrologer combining Western astrology and Chinese Ba Zi (四柱命理). 

Generate a deeply personalized weekly cosmic guidance for this specific person. Respond ONLY with a valid JSON object — no markdown fences, no preamble, nothing else.

PERSON'S BIRTH DATA:
- Birth: ${BIRTH.date}, ${BIRTH.time}, ${BIRTH.location}
- Sun: ${BIRTH.sun} (identity: co-creation, needs partner before committing, delays decisions)
- Rising: ${BIRTH.rising} (outer self: disciplined, structured, "prep trap" — waits until perfect)
- Moon: ${BIRTH.moon} (inner world: powerful intuition, speaks through writing/ideas, absorbs others' doubts)
- Ba Zi: ${BIRTH.bazi}
- Day Pillar: ${BIRTH.dayPillar} (Water master on Fire — contains stability need AND creator fire, both real)
- Chinese Zodiac: ${BIRTH.zodiac}, Protector: ${BIRTH.protector}
- Current Year: ${BIRTH.currentYear}
- Life Situation: ${BIRTH.situation}

CURRENT DATE: ${week.dateStr}
WEEK: ${week.label}
MOON PHASE: ${moon.name} (${moon.cn}) ${moon.pct}% — ${moon.glyph}
MONTH: ${week.monthName} ${week.year}

Generate the JSON with this exact structure:
{
  "weekLabel": "Week of ${week.label}",
  "weekLabelCn": "${week.labelCn}",
  "monthLabel": "${week.monthName} ${week.year} · ${week.monthCn}",
  "moonPhase": "${moon.name}",
  "moonPhaseCn": "${moon.cn}",
  "moonGlyph": "${moon.glyph}",
  "moonPct": ${moon.pct},
  "weekTheme": "One powerful sentence about this week's energy in English",
  "weekThemeCn": "Same in Chinese, 20 chars max",
  "oracle": "A specific, non-generic oracle message for this person this week — reference their actual chart placements",
  "oracleCn": "Oracle in Chinese",
  "oracleGlyph": "one emoji",
  "aspects": {
    "career": {
      "insight": "2-3 sentences — specific to their employee→builder transition situation right now",
      "insightCn": "Chinese translation",
      "actions": [
        {"en": "Specific action with exact language or template they can use", "cn": "Chinese", "when": "day or date range"},
        {"en": "...", "cn": "...", "when": "..."},
        {"en": "...", "cn": "...", "when": "..."}
      ]
    },
    "money": {
      "insight": "Specific to their situation — building runway, pricing their project, 壬午 tendency to spend when emotional",
      "insightCn": "Chinese",
      "actions": [
        {"en": "...", "cn": "...", "when": "..."},
        {"en": "...", "cn": "...", "when": "..."}
      ]
    },
    "love": {
      "insight": "Specific to Libra-Pisces bind, no serious relationship yet, pattern of beautiful connections that don't land",
      "insightCn": "Chinese",
      "actions": [
        {"en": "...", "cn": "...", "when": "..."},
        {"en": "...", "cn": "...", "when": "..."}
      ]
    },
    "family": {
      "insight": "Specific to ancestral patterns, 丙子 year pillar, family expectation around safe path",
      "insightCn": "Chinese",
      "actions": [
        {"en": "...", "cn": "...", "when": "..."}
      ]
    },
    "purpose": {
      "insight": "Specific to North Node, 丙午 visibility year, their actual project/business, the irreversible public step",
      "insightCn": "Chinese",
      "actions": [
        {"en": "...", "cn": "...", "when": "..."},
        {"en": "...", "cn": "...", "when": "..."},
        {"en": "...", "cn": "...", "when": "..."}
      ]
    }
  },
  "days": [
    {"day": "SUN", "date": ${week.start.getDate()}, "hot": true/false, "warn": true/false, "energy": "Short energy title", "action": "What to do — specific", "cn": "Chinese"},
    {"day": "MON", "date": ${week.start.getDate()+1}, "hot": false, "warn": false, "energy": "...", "action": "...", "cn": "..."},
    {"day": "TUE", "date": ${week.start.getDate()+2}, "hot": false, "warn": false, "energy": "...", "action": "...", "cn": "..."},
    {"day": "WED", "date": ${week.start.getDate()+3}, "hot": false, "warn": false, "energy": "...", "action": "...", "cn": "..."},
    {"day": "THU", "date": ${week.start.getDate()+4}, "hot": false, "warn": false, "energy": "...", "action": "...", "cn": "..."},
    {"day": "FRI", "date": ${week.start.getDate()+5}, "hot": false, "warn": true, "energy": "...", "action": "...", "cn": "..."},
    {"day": "SAT", "date": ${week.start.getDate()+6}, "hot": true, "warn": false, "energy": "...", "action": "...", "cn": "..."}
  ],
  "priorities": [
    {"num": "①", "en": "Most important thing this week", "cn": "Chinese"},
    {"num": "②", "en": "...", "cn": "..."},
    {"num": "③", "en": "...", "cn": "..."},
    {"num": "④", "en": "...", "cn": "..."}
  ],
  "writePrompts": [
    {"label": "Write 1", "prompt": "Fill-in-the-blank prompt specific to this week", "cn": "Chinese"},
    {"label": "Write 2", "prompt": "...", "cn": "..."},
    {"label": "Write 3", "prompt": "...", "cn": "..."}
  ]
}

Rules:
- Every insight must reference their SPECIFIC situation (employee→builder, no serious relationship, Libra delay loop, etc)
- Actions must be concrete — include exact language, templates, or "do X by Y date"
- Nothing generic like "communicate more" or "trust your intuition" without specifics
- Chinese must be natural, not machine-translated
- JSON must be valid — escape all quotes properly`;
}

// ── Build HTML from data ──
function buildHTML(data, week, moon) {
  const aspects = data.aspects;

  function aspectCard(key, icon, iconClass, titleEn, titleCn, asp) {
    const actions = asp.actions.map((a, i) => `
      <div class="action-row">
        <div class="action-num">0${i+1}</div>
        <div class="action-body">
          <div class="action-en">${a.en}</div>
          <div class="action-cn">${a.cn}</div>
          <span class="when-chip">${a.when}</span>
        </div>
      </div>`).join('');

    return `
    <div class="section-card">
      <div class="card-header" onclick="toggleCard(this)">
        <div class="card-title-row">
          <div class="card-icon ${iconClass}">${icon}</div>
          <div>
            <div class="card-title">${titleEn}</div>
            <div class="card-title-cn">${titleCn}</div>
          </div>
        </div>
        <div class="card-arrow">›</div>
      </div>
      <div class="card-body">
        <div class="insight-pill">
          <div class="insight-label">Your Code Decoded</div>
          <div class="insight-text">${asp.insight}</div>
          <div class="insight-cn">${asp.insightCn}</div>
        </div>
        <div class="actions-label">↳ Actions This Week</div>
        ${actions}
      </div>
    </div>`;
  }

  const dayRows = data.days.map(d => {
    const hotClass = d.hot ? 'hot' : (d.warn ? 'warn' : '');
    return `
      <div class="day-item">
        <div class="day-left ${hotClass}">
          <div class="day-name ${hotClass}">${d.day}</div>
          <div class="day-date-num ${hotClass}">${d.date}</div>
        </div>
        <div class="day-right">
          <div class="day-energy">${d.energy}</div>
          <div class="day-action">${d.action}</div>
          <div class="day-action-cn">${d.cn}</div>
        </div>
      </div>`;
  }).join('');

  const priorities = data.priorities.map(p => `
    <div class="priority-item">
      <div class="priority-num">${p.num}</div>
      <div>
        <div class="priority-text">${p.en}</div>
        <div class="priority-cn">${p.cn}</div>
      </div>
    </div>`).join('');

  const writePrompts = data.writePrompts.map(w => `
    <div class="write-card">
      <div class="write-label">${w.label}</div>
      <div class="write-prompt">"${w.prompt}"</div>
      <div class="write-cn">${w.cn}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="星盘指引">
<meta name="theme-color" content="#0F0D0A">
<title>星盘指引 · ${data.weekLabel}</title>
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='36' fill='%230F0D0A'/%3E%3Ccircle cx='90' cy='90' r='72' fill='none' stroke='%23B8860B' stroke-width='1.5'/%3E%3Ctext x='90' y='100' text-anchor='middle' font-size='52' fill='%23B8860B'%3E✦%3C/text%3E%3C/svg%3E">
<style>
:root{--ink:#0F0D0A;--ink2:#1A1612;--paper:#F5F0E8;--paper2:#EDE7D6;--gold:#B8860B;--gold2:#D4A843;--gold-pale:#F0E4B8;--red:#8B2E2E;--teal:#2A6B62;--purple:#4A3470;--muted:#6B6355;--border:rgba(184,134,11,0.22);--border2:rgba(184,134,11,0.45);--safe-top:env(safe-area-inset-top,44px);--safe-bottom:env(safe-area-inset-bottom,20px)}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{height:100%}
body{height:100%;background:var(--ink);color:var(--paper);font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;font-size:15px;line-height:1.5;overflow:hidden}
#app{display:flex;flex-direction:column;height:100%;max-width:430px;margin:0 auto}
.status-bar{height:var(--safe-top);background:var(--ink);flex-shrink:0}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--ink);border-bottom:1px solid rgba(184,134,11,0.15);flex-shrink:0}
.topbar-left{display:flex;align-items:center;gap:9px}
.app-glyph{font-size:20px;line-height:1}
.app-name{font-size:17px;font-weight:600;color:var(--paper);letter-spacing:-.3px}
.app-name-cn{font-size:11px;color:var(--gold2);letter-spacing:2px;display:block;margin-top:-1px}
.date-chip{font-size:11px;color:var(--gold2);background:rgba(184,134,11,0.12);border:1px solid var(--border);border-radius:20px;padding:4px 12px;letter-spacing:.5px}
.nav-tabs{display:flex;background:var(--ink2);border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto;scrollbar-width:none}
.nav-tabs::-webkit-scrollbar{display:none}
.nav-tab{flex:1;min-width:70px;padding:10px 4px 9px;font-size:11px;font-weight:500;color:rgba(245,240,232,0.45);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all .2s;white-space:nowrap;text-align:center}
.nav-tab.active{color:var(--gold2);border-bottom-color:var(--gold2)}
.scroll-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.screen{display:none;padding:0 0 calc(20px + var(--safe-bottom))}
.screen.active{display:block}
.hero{background:linear-gradient(160deg,#1A1228 0%,var(--ink) 60%);padding:24px 20px 20px;border-bottom:1px solid var(--border);position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(184,134,11,0.12) 0%,transparent 70%);pointer-events:none}
.hero-week{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin-bottom:6px}
.hero-title{font-size:24px;font-weight:700;color:var(--paper);letter-spacing:-.5px;line-height:1.2;margin-bottom:3px}
.hero-cn{font-size:13px;color:rgba(245,240,232,0.5);letter-spacing:3px;margin-bottom:16px}
.triad{display:flex;gap:8px;flex-wrap:wrap}
.triad-chip{font-size:11px;background:rgba(184,134,11,0.14);border:1px solid var(--border);border-radius:20px;padding:4px 12px;color:var(--gold2)}
.moon-bar{margin:16px 20px 0;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.moon-bar-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.moon-phase-name{font-size:12px;font-weight:600;color:var(--paper)}
.moon-phase-cn{font-size:10px;color:rgba(245,240,232,0.5);letter-spacing:1px}
.moon-phase-glyph{font-size:24px;line-height:1}
.moon-progress-track{height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden}
.moon-progress-fill{height:100%;background:linear-gradient(to right,var(--gold),var(--gold2));border-radius:2px}
.section-card{margin:14px 16px 0;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.card-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid var(--border);cursor:pointer}
.card-title-row{display:flex;align-items:center;gap:10px}
.card-icon{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.card-icon.c{background:rgba(42,107,98,0.25);border:1px solid rgba(42,107,98,0.4)}
.card-icon.m{background:rgba(184,134,11,0.2);border:1px solid rgba(184,134,11,0.35)}
.card-icon.l{background:rgba(139,46,46,0.2);border:1px solid rgba(139,46,46,0.35)}
.card-icon.f{background:rgba(74,52,112,0.25);border:1px solid rgba(74,52,112,0.4)}
.card-icon.p{background:rgba(184,134,11,0.15);border:1px solid rgba(184,134,11,0.3)}
.card-title{font-size:14px;font-weight:600;color:var(--paper);line-height:1.2}
.card-title-cn{font-size:10px;color:rgba(245,240,232,0.45);letter-spacing:1.5px}
.card-arrow{color:rgba(245,240,232,0.3);font-size:16px;transition:transform .25s}
.card-body{padding:0 16px;max-height:0;overflow:hidden;transition:max-height .35s ease,padding .25s ease}
.card-body.open{padding:14px 16px 16px;max-height:1000px}
.card-header.open .card-arrow{transform:rotate(90deg)}
.insight-pill{background:rgba(184,134,11,0.1);border:1px solid rgba(184,134,11,0.25);border-radius:10px;padding:11px 13px;margin-bottom:12px}
.insight-label{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin-bottom:5px}
.insight-text{font-size:13px;line-height:1.6;color:rgba(245,240,232,0.9)}
.insight-cn{font-size:11px;color:rgba(245,240,232,0.45);letter-spacing:.5px;margin-top:5px;line-height:1.7;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px}
.actions-label{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--teal);margin-bottom:9px}
.action-row{display:grid;grid-template-columns:20px 1fr;gap:9px;margin-bottom:11px}
.action-row:last-child{margin-bottom:0}
.action-num{font-size:13px;font-weight:700;color:var(--gold2);padding-top:1px}
.action-en{font-size:13px;line-height:1.55;color:var(--paper)}
.action-cn{font-size:11px;color:rgba(245,240,232,0.45);letter-spacing:.3px;margin-top:3px;line-height:1.65}
.when-chip{display:inline-block;font-size:9px;letter-spacing:1px;background:rgba(184,134,11,0.15);color:var(--gold2);border-radius:4px;padding:2px 8px;margin-top:4px}
.week-hero{background:linear-gradient(160deg,#1A1228 0%,var(--ink) 70%);padding:20px 20px 16px;border-bottom:1px solid var(--border)}
.week-hero-title{font-size:20px;font-weight:700;color:var(--paper);margin-bottom:3px;letter-spacing:-.3px}
.week-hero-cn{font-size:11px;color:rgba(245,240,232,0.45);letter-spacing:2px}
.week-hero-sub{font-size:11px;color:var(--gold2);margin-top:8px}
.day-list{padding:14px 16px 0}
.day-item{display:grid;grid-template-columns:52px 1fr;gap:12px;margin-bottom:10px}
.day-left{text-align:right;padding-top:3px;padding-right:12px;border-right:2px solid var(--border)}
.day-left.hot{border-right-color:var(--gold2)}
.day-left.warn{border-right-color:#8B2E2E}
.day-name{font-size:10px;font-weight:700;letter-spacing:1px;color:rgba(245,240,232,0.4);text-transform:uppercase}
.day-name.hot{color:var(--gold2)}
.day-name.warn{color:#C47070}
.day-date-num{font-size:18px;font-weight:700;color:rgba(245,240,232,0.5);line-height:1}
.day-date-num.hot{color:var(--gold2)}
.day-right{background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;padding:10px 13px;margin-bottom:2px}
.day-energy{font-size:13px;font-weight:600;color:var(--paper);margin-bottom:3px}
.day-action{font-size:12px;color:rgba(245,240,232,0.55);line-height:1.5}
.day-action-cn{font-size:10px;color:rgba(245,240,232,0.35);letter-spacing:.5px;margin-top:3px}
.priority-list{padding:14px 16px 0}
.priority-title{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin-bottom:10px}
.priority-item{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;padding:11px 13px}
.priority-num{font-size:16px;font-weight:700;color:var(--gold2);line-height:1.2;flex-shrink:0}
.priority-text{font-size:13px;line-height:1.5;color:var(--paper)}
.priority-cn{font-size:11px;color:rgba(245,240,232,0.4);margin-top:3px;letter-spacing:.3px}
.write-prompts{margin:14px 16px 0}
.write-card{background:rgba(42,107,98,0.1);border:1px solid rgba(42,107,98,0.3);border-radius:10px;padding:12px 14px;margin-bottom:9px}
.write-label{font-size:9px;letter-spacing:2px;color:var(--teal);text-transform:uppercase;margin-bottom:5px}
.write-prompt{font-size:13px;color:var(--paper);line-height:1.5;font-style:italic}
.write-cn{font-size:10px;color:rgba(245,240,232,0.4);margin-top:4px;letter-spacing:.5px}
.chart-section{padding:16px 16px 0}
.chart-section-title{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin-bottom:12px}
.triad-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.triad-card{background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:grid;grid-template-columns:40px 1fr;gap:12px}
.triad-icon{font-size:24px;line-height:1;padding-top:4px;text-align:center}
.triad-sign{font-size:16px;font-weight:700;color:var(--paper);margin-bottom:2px}
.triad-sign-cn{font-size:10px;color:var(--gold2);letter-spacing:2px;margin-bottom:6px}
.triad-wiring{font-size:12px;color:rgba(245,240,232,0.6);line-height:1.55}
.triad-shadow{font-size:11px;color:#C47070;font-style:italic;margin-top:5px;border-top:1px solid rgba(255,255,255,0.07);padding-top:5px}
.bazi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
.bazi-cell{background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;padding:10px 6px;text-align:center}
.bazi-cell.day{border-color:var(--gold2);background:rgba(184,134,11,0.1)}
.bazi-stem{font-size:20px;color:var(--paper);line-height:1}
.bazi-branch{font-size:20px;color:#A98ECC;line-height:1;margin-top:2px}
.bazi-cell.day .bazi-stem{color:var(--gold2)}
.bazi-cell-lbl{font-size:9px;color:rgba(245,240,232,0.4);letter-spacing:1px;margin-top:4px}
.block-list{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.block-item{background:rgba(139,46,46,0.1);border-left:2px solid var(--red);border-radius:0 8px 8px 0;padding:10px 13px;font-size:12px;color:rgba(245,240,232,0.8);line-height:1.5}
.block-cn{font-size:10px;color:rgba(245,240,232,0.4);margin-top:3px;letter-spacing:.3px}
.chart-svg-wrap{background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;justify-content:center;margin-bottom:14px}
.oracle-hero{background:linear-gradient(160deg,#1A1228 0%,var(--ink) 70%);padding:28px 24px;border-bottom:1px solid var(--border);text-align:center}
.oracle-glyph{font-size:40px;margin-bottom:14px;display:block}
.oracle-quote{font-size:18px;font-style:italic;color:var(--paper);line-height:1.55;margin-bottom:10px;letter-spacing:-.2px}
.oracle-cn{font-size:13px;color:rgba(245,240,232,0.5);letter-spacing:2px;line-height:1.9}
.tara-section-header{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin:20px 16px 10px}
.tara-cards{display:flex;flex-direction:column;gap:9px;padding:0 16px}
.tara-card{background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;padding:14px 15px;display:grid;grid-template-columns:38px 1fr;gap:11px}
.tara-card.center{border-color:rgba(184,134,11,0.5);background:rgba(184,134,11,0.06)}
.tara-glyph{font-size:26px;line-height:1;padding-top:2px;text-align:center}
.tara-pos{font-size:9px;letter-spacing:2px;color:var(--gold2);text-transform:uppercase;margin-bottom:3px}
.tara-name{font-size:14px;font-weight:600;color:var(--paper);margin-bottom:4px}
.tara-action{font-size:12px;color:rgba(245,240,232,0.6);line-height:1.5}
.tara-cn{font-size:10px;color:rgba(245,240,232,0.35);margin-top:4px;letter-spacing:.3px}
.ruling-codes{margin:16px 16px 0;background:var(--ink2);border:1px solid var(--border);border-radius:12px;padding:16px}
.ruling-code-title{font-size:9px;letter-spacing:3px;color:var(--gold2);text-transform:uppercase;margin-bottom:12px}
.ruling-row{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
.ruling-row:last-child{margin-bottom:0}
.ruling-glyph{font-size:18px;width:26px;text-align:center;flex-shrink:0}
.ruling-text{font-size:12px;color:rgba(245,240,232,0.7);line-height:1.5}
.ruling-cn{font-size:10px;color:rgba(245,240,232,0.35);margin-top:2px;letter-spacing:.3px}
.protector-box{margin:14px 16px 0;background:rgba(74,52,112,0.15);border:1px solid rgba(74,52,112,0.35);border-radius:12px;padding:16px;text-align:center}
.protector-glyph{font-size:32px;margin-bottom:8px;display:block}
.protector-name{font-size:18px;font-weight:600;color:var(--paper);letter-spacing:3px;margin-bottom:4px}
.protector-sub{font-size:11px;color:rgba(245,240,232,0.45);letter-spacing:1px;line-height:1.6}
.bottom-nav{display:flex;background:var(--ink2);border-top:1px solid var(--border);padding-bottom:var(--safe-bottom);flex-shrink:0}
.bottom-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px 6px;background:none;border:none;cursor:pointer}
.bottom-btn-icon{font-size:20px;line-height:1}
.bottom-btn-label{font-size:9px;letter-spacing:.5px;color:rgba(245,240,232,0.35);text-transform:uppercase}
.bottom-btn.active .bottom-btn-label{color:var(--gold2)}
.updated-chip{margin:14px 16px 0;font-size:10px;color:rgba(245,240,232,0.3);text-align:center;letter-spacing:1px}
</style>
</head>
<body>
<div id="app">
  <div class="status-bar"></div>
  <div class="topbar">
    <div class="topbar-left">
      <span class="app-glyph">✦</span>
      <div>
        <div class="app-name">Cosmic Guide</div>
        <span class="app-name-cn">星盘指引</span>
      </div>
    </div>
    <div class="date-chip" id="topDateChip"></div>
  </div>
  <div class="nav-tabs">
    <button class="nav-tab active" onclick="goScreen('home',this)">This Week<br>本周</button>
    <button class="nav-tab" onclick="goScreen('week',this)">Daily<br>逐日</button>
    <button class="nav-tab" onclick="goScreen('chart',this)">Chart<br>星盘</button>
    <button class="nav-tab" onclick="goScreen('oracle',this)">Oracle<br>神谕</button>
  </div>
  <div class="scroll-area">

    <!-- HOME / MONTHLY -->
    <div class="screen active" id="screen-home">
      <div class="hero">
        <div class="hero-week">${data.weekLabel} · ${data.weekLabelCn}</div>
        <div class="hero-title">${data.weekTheme}</div>
        <div class="hero-cn">${data.weekThemeCn}</div>
        <div class="triad">
          <span class="triad-chip">☀ Libra 天秤</span>
          <span class="triad-chip">🌙 Pisces 双鱼</span>
          <span class="triad-chip">↑ Capricorn 摩羯</span>
        </div>
      </div>
      <div class="moon-bar">
        <div class="moon-bar-top">
          <div>
            <div class="moon-phase-name">${data.moonPhase}</div>
            <div class="moon-phase-cn">${data.moonPhaseCn}</div>
          </div>
          <div class="moon-phase-glyph">${data.moonGlyph}</div>
        </div>
        <div class="moon-progress-track">
          <div class="moon-progress-fill" style="width:${data.moonPct}%"></div>
        </div>
      </div>
      ${aspectCard('career','⚡','c','Career & Transition','事业 · 转型',aspects.career)}
      ${aspectCard('money','◈','m','Money & Runway','财运 · 过渡资金',aspects.money)}
      ${aspectCard('love','♡','l','Love & The Pattern','感情 · 打破旧模式',aspects.love)}
      ${aspectCard('family','⌂','f','Family & Roots','家庭 · 根源',aspects.family)}
      ${aspectCard('purpose','✦','p','Soul Purpose','灵魂使命',aspects.purpose)}
      <div class="updated-chip">✦ Auto-updated ${week.dateStr} · 每周日自动更新 ✦</div>
    </div>

    <!-- DAILY -->
    <div class="screen" id="screen-week">
      <div class="week-hero">
        <div class="week-hero-title">Week of ${data.weekLabel}</div>
        <div class="week-hero-cn">${data.weekLabelCn}</div>
        <div class="week-hero-sub">${data.weekTheme}</div>
      </div>
      <div class="day-list">${dayRows}</div>
      <div class="priority-list" style="margin-top:14px;">
        <div class="priority-title">This Week's Priority Order · 本周优先顺序</div>
        ${priorities}
      </div>
      <div class="write-prompts">
        <div class="priority-title" style="margin-bottom:10px;">Writing Prompts · 书写练习</div>
        ${writePrompts}
      </div>
    </div>

    <!-- CHART -->
    <div class="screen" id="screen-chart">
      <div class="chart-section">
        <div class="chart-section-title">Your Source Code · 命运密码</div>
        <div class="chart-svg-wrap">
          <svg viewBox="0 0 300 300" width="260" height="260" xmlns="http://www.w3.org/2000/svg">
            <circle cx="150" cy="150" r="140" fill="none" stroke="rgba(184,134,11,0.2)" stroke-width="1"/>
            <circle cx="150" cy="150" r="112" fill="none" stroke="rgba(184,134,11,0.12)" stroke-width="0.5"/>
            <circle cx="150" cy="150" r="80" fill="none" stroke="rgba(169,142,204,0.25)" stroke-width="1"/>
            <circle cx="150" cy="150" r="50" fill="rgba(184,134,11,0.03)" stroke="rgba(184,134,11,0.18)" stroke-width="0.5"/>
            <circle cx="150" cy="150" r="18" fill="rgba(15,13,10,0.7)" stroke="rgba(184,134,11,0.3)" stroke-width="0.5"/>
            <line x1="150" y1="10" x2="150" y2="290" stroke="rgba(184,134,11,0.1)" stroke-width="0.5"/>
            <line x1="10" y1="150" x2="290" y2="150" stroke="rgba(184,134,11,0.1)" stroke-width="0.5"/>
            <line x1="41" y1="57" x2="259" y2="243" stroke="rgba(184,134,11,0.07)" stroke-width="0.5"/>
            <line x1="57" y1="41" x2="243" y2="259" stroke="rgba(184,134,11,0.07)" stroke-width="0.5"/>
            <line x1="41" y1="243" x2="259" y2="57" stroke="rgba(184,134,11,0.07)" stroke-width="0.5"/>
            <line x1="57" y1="259" x2="243" y2="41" stroke="rgba(184,134,11,0.07)" stroke-width="0.5"/>
            <text x="262" y="155" text-anchor="middle" font-size="12" fill="rgba(196,123,138,0.7)">♈</text>
            <text x="245" y="108" text-anchor="middle" font-size="12" fill="rgba(74,155,142,0.7)">♉</text>
            <text x="210" y="73" text-anchor="middle" font-size="12" fill="rgba(169,142,204,0.8)">♊</text>
            <text x="163" y="57" text-anchor="middle" font-size="12" fill="rgba(74,155,142,0.7)">♋</text>
            <text x="115" y="57" text-anchor="middle" font-size="12" fill="rgba(201,168,76,0.85)">♌</text>
            <text x="77" y="73" text-anchor="middle" font-size="12" fill="rgba(74,155,142,0.7)">♍</text>
            <text x="44" y="108" text-anchor="middle" font-size="12" fill="rgba(169,142,204,0.9)">♎</text>
            <text x="30" y="155" text-anchor="middle" font-size="12" fill="rgba(196,123,138,0.7)">♏</text>
            <text x="44" y="200" text-anchor="middle" font-size="12" fill="rgba(169,142,204,0.7)">♐</text>
            <text x="77" y="236" text-anchor="middle" font-size="12" fill="rgba(74,155,142,0.7)">♑</text>
            <text x="125" y="252" text-anchor="middle" font-size="12" fill="rgba(169,142,204,0.7)">♒</text>
            <text x="175" y="252" text-anchor="middle" font-size="12" fill="rgba(74,155,142,0.7)">♓</text>
            <line x1="150" y1="150" x2="213" y2="213" stroke="rgba(184,134,11,0.55)" stroke-width="1.2" stroke-dasharray="4 2"/>
            <text x="222" y="228" text-anchor="middle" font-size="9" fill="#D4A843" letter-spacing="0.5">ASC</text>
            <circle cx="66" cy="156" r="7" fill="rgba(184,134,11,0.15)" stroke="#D4A843" stroke-width="1.5"/>
            <text x="66" y="161" text-anchor="middle" font-size="10" fill="#D4A843">☀</text>
            <circle cx="158" cy="80" r="6" fill="rgba(169,142,204,0.15)" stroke="#A98ECC" stroke-width="1.5"/>
            <text x="158" y="85" text-anchor="middle" font-size="10" fill="#A98ECC">☽</text>
            <circle cx="108" cy="195" r="5" fill="rgba(196,123,138,0.15)" stroke="#C47B8A" stroke-width="1"/>
            <text x="108" y="199" text-anchor="middle" font-size="9" fill="#C47B8A">♀</text>
            <circle cx="207" cy="207" r="5" fill="rgba(196,123,138,0.1)" stroke="#E05050" stroke-width="1"/>
            <text x="207" y="211" text-anchor="middle" font-size="9" fill="#E05050">♂</text>
            <circle cx="198" cy="100" r="5" fill="rgba(184,192,204,0.1)" stroke="#B8C0CC" stroke-width="1"/>
            <text x="198" y="104" text-anchor="middle" font-size="9" fill="#B8C0CC">♄</text>
            <line x1="66" y1="156" x2="158" y2="80" stroke="rgba(74,155,142,0.25)" stroke-width="0.8" stroke-dasharray="3 2"/>
            <text x="150" y="155" text-anchor="middle" font-size="12" fill="rgba(184,134,11,0.5)">✦</text>
            <text x="150" y="288" text-anchor="middle" font-size="7" fill="rgba(184,134,11,0.4)" letter-spacing="1">1996.09.26 · 14:52 · JINHUA</text>
          </svg>
        </div>
        <div class="triad-cards">
          <div class="triad-card"><div class="triad-icon">☀️</div><div><div class="triad-sign">Libra · H7</div><div class="triad-sign-cn">天秤座 · 第七宫</div><div class="triad-wiring">Wired for co-creation. The delay on your business isn't laziness — it's Libra needing a collaborator before fully committing.</div><div class="triad-shadow">Shadow: Deciding by consensus → paralysis. Your #1 block.</div></div></div>
          <div class="triad-card"><div class="triad-icon">🌅</div><div><div class="triad-sign">Capricorn Rising</div><div class="triad-sign-cn">摩羯座上升</div><div class="triad-wiring">Composed, structured, reliable. But also runs "I must earn the right to be seen before launching."</div><div class="triad-shadow">Shadow: Preparation as procrastination. You're already ready.</div></div></div>
          <div class="triad-card"><div class="triad-icon">🌙</div><div><div class="triad-sign">Pisces Moon · H3</div><div class="triad-sign-cn">双鱼座月亮 · 第三宫</div><div class="triad-wiring">Extraordinary gut intelligence. Speaks through writing and ideas. When something feels right, it usually is.</div><div class="triad-shadow">Shadow: Absorbing others' doubts as your own. Not every worry is yours.</div></div></div>
        </div>
        <div class="chart-section-title">八字四柱 · Four Pillars</div>
        <div class="bazi-grid">
          <div class="bazi-cell"><div class="bazi-stem">丙</div><div class="bazi-branch">子</div><div class="bazi-cell-lbl">年 Year</div></div>
          <div class="bazi-cell"><div class="bazi-stem">庚</div><div class="bazi-branch">戌</div><div class="bazi-cell-lbl">月 Month</div></div>
          <div class="bazi-cell day"><div class="bazi-stem">壬</div><div class="bazi-branch">午</div><div class="bazi-cell-lbl">日 Day ✦</div></div>
          <div class="bazi-cell"><div class="bazi-stem">辛</div><div class="bazi-branch">未</div><div class="bazi-cell-lbl">时 Hour</div></div>
        </div>
        <div class="chart-section-title">Your Three Blocks · 三个需破解的程序</div>
        <div class="block-list">
          <div class="block-item"><strong>Libra delay loop:</strong> Weighing → not deciding → waiting for more info → weighing again.<div class="block-cn">天秤拖延循环：权衡→不决定→等更多信息→再权衡。</div></div>
          <div class="block-item"><strong>Capricorn prep trap:</strong> "I'll launch when ready" = never. Readiness is a feeling, not a state.<div class="block-cn">摩羯准备陷阱：「准备好了再发」=永远不发。</div></div>
          <div class="block-item"><strong>Pisces dissolution:</strong> Absorbing others' doubts as your own. Not every worry in the room is yours.<div class="block-cn">双鱼吸收：把别人的疑虑当成自己的。那不属于你。</div></div>
        </div>
      </div>
    </div>

    <!-- ORACLE -->
    <div class="screen" id="screen-oracle">
      <div class="oracle-hero">
        <span class="oracle-glyph">${data.oracleGlyph}</span>
        <div class="oracle-quote">${data.oracle}</div>
        <div class="oracle-cn">${data.oracleCn}</div>
      </div>
      <div class="tara-section-header">Tara Three Cards · 塔罗三牌</div>
      <div class="tara-cards">
        <div class="tara-card"><div class="tara-glyph">🌊</div><div><div class="tara-pos">Past · 过去</div><div class="tara-name">The High Priestess</div><div class="tara-action">Stop consulting everyone. You already know. Sit with it.</div><div class="tara-cn">女祭司：停止问别人。你早已知道答案。</div></div></div>
        <div class="tara-card center"><div class="tara-glyph">⭐</div><div><div class="tara-pos">Present · 当下</div><div class="tara-name">The Star</div><div class="tara-action">You're in your healing season. Let yourself be refilled before the next push.</div><div class="tara-cn">星星：你在疗愈季。在下一次冲刺前先充满自己。</div></div></div>
        <div class="tara-card"><div class="tara-glyph">🌅</div><div><div class="tara-pos">Future · 未来</div><div class="tara-name">The World</div><div class="tara-action">What you seed this week is what you harvest in 2027.</div><div class="tara-cn">世界：本周播下的种子，2027年收获。</div></div></div>
      </div>
      <div class="ruling-codes">
        <div class="ruling-code-title">Your Three Codes · 三重命运密码</div>
        <div class="ruling-row"><div class="ruling-glyph">♎</div><div><div class="ruling-text"><strong style="color:#F5F0E8;">Libra Sun:</strong> Built for co-creation. Find your person, then build.</div><div class="ruling-cn">天秤：为共同创造而生。先找到同行者，再一起建造。</div></div></div>
        <div class="ruling-row"><div class="ruling-glyph">♑</div><div><div class="ruling-text"><strong style="color:#F5F0E8;">Cap Rising:</strong> Structures liberate you. Build the container, then leap.</div><div class="ruling-cn">摩羯上升：结构解放你。先建容器，再起跳。</div></div></div>
        <div class="ruling-row"><div class="ruling-glyph">♓</div><div><div class="ruling-text"><strong style="color:#F5F0E8;">Pisces Moon:</strong> Your gut already knows. Stop asking. Start moving.</div><div class="ruling-cn">双鱼月亮：你的直觉早就知道了。停止询问，开始行动。</div></div></div>
      </div>
      <div class="protector-box">
        <span class="protector-glyph">🙏</span>
        <div class="protector-name">千手观音</div>
        <div class="protector-sub">生肖鼠守护佛 · Protector of the Rat<br>Ask for: clarity of voice and direction<br>声音的清晰与方向 · 初一十五宜礼拜</div>
      </div>
    </div>

  </div><!-- scroll area -->

  <div class="bottom-nav">
    <button class="bottom-btn active" onclick="goScreen('home',this);setB(this)"><span class="bottom-btn-icon">🌙</span><span class="bottom-btn-label">Week</span></button>
    <button class="bottom-btn" onclick="goScreen('week',this);setB(this)"><span class="bottom-btn-icon">📅</span><span class="bottom-btn-label">Daily</span></button>
    <button class="bottom-btn" onclick="goScreen('chart',this);setB(this)"><span class="bottom-btn-icon">✦</span><span class="bottom-btn-label">Chart</span></button>
    <button class="bottom-btn" onclick="goScreen('oracle',this);setB(this)"><span class="bottom-btn-icon">🔮</span><span class="bottom-btn-label">Oracle</span></button>
  </div>
</div>

<script>
function goScreen(id,btn){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('screen-'+id).classList.add('active');const map=['home','week','chart','oracle'];document.querySelectorAll('.nav-tab').forEach((t,i)=>t.classList.toggle('active',map[i]===id));document.querySelector('.scroll-area').scrollTop=0;}
function setB(btn){document.querySelectorAll('.bottom-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
function toggleCard(h){const b=h.nextElementSibling;const o=b.classList.contains('open');document.querySelectorAll('.card-body').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.card-header').forEach(x=>x.classList.remove('open'));if(!o){b.classList.add('open');h.classList.add('open');}}
const now=new Date();const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];document.getElementById('topDateChip').textContent=months[now.getMonth()]+' '+now.getDate();
<\/script>
</body>
</html>`;
}

// ── MAIN ──
async function main() {
  console.log('🌙 Starting weekly cosmic guide generation...');

  const week = getWeekRange();
  const moon = getMoonPhase(week.start);

  console.log(`📅 Week: ${week.label}`);
  console.log(`🌙 Moon: ${moon.name} (${moon.pct}%)`);

  const prompt = buildPrompt(week, moon);
  console.log('🤖 Calling Claude API...');

  let rawText;
  try {
    rawText = await callClaude(prompt);
  } catch(e) {
    console.error('❌ Claude API call failed:', e.message);
    process.exit(1);
  }

  console.log('✅ Got response, parsing JSON...');

  let data;
  try {
    // Strip any accidental markdown fences
    const clean = rawText.replace(/```json|```/g, '').trim();
    data = JSON.parse(clean);
  } catch(e) {
    console.error('❌ JSON parse failed:', e.message);
    console.error('Raw:', rawText.substring(0, 500));
    process.exit(1);
  }

  console.log('🎨 Building HTML...');
  const html = buildHTML(data, week, moon);

  fs.writeFileSync('index.html', html, 'utf8');
  console.log('✅ index.html written successfully!');
  console.log(`🌙 Week of ${week.label} — ready.`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
