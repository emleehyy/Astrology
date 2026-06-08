const https = require('https');
const fs = require('fs');

// ── Birth data ──
const BIRTH = {
  date: 'September 26, 1996',
  time: '14:52',
  location: 'Jinhua, Zhejiang, China',
  sun: 'Libra 3 degrees House 7',
  rising: 'Capricorn 13 degrees',
  moon: 'Pisces 18 degrees House 3',
  bazi: 'Bing-Zi year, Geng-Xu month, Ren-Wu day, Xin-Wei hour',
  dayPillar: 'Ren-Wu Water on Fire',
  zodiac: 'Rat',
  protector: 'Qian Shou Guan Yin',
  currentYear: 'Bing-Wu year 2026 visibility and destiny year',
  situation: 'New job since Jan 2026 not forever job. Building own business on the side. Transitioning from employee to builder. No serious relationship yet. Libra delay loop. Capricorn prep trap. Pisces dissolution absorbing others doubts.'
};

// ── Helpers ──
function getWeekRange() {
  const now = new Date();
  const dow = now.getDay();
  const sun = new Date(now); sun.setDate(now.getDate() - dow);
  const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const cnMonths = ['\u4e00\u6708','\u4e8c\u6708','\u4e09\u6708','\u56db\u6708','\u4e94\u6708','\u516d\u6708','\u4e03\u6708','\u516b\u6708','\u4e5d\u6708','\u5341\u6708','\u5341\u4e00\u6708','\u5341\u4e8c\u6708'];
  return {
    label: months[sun.getMonth()] + ' ' + sun.getDate() + '-' + sat.getDate() + ', ' + sun.getFullYear(),
    labelCn: sun.getFullYear() + '\u5e74' + cnMonths[sun.getMonth()] + '\u7b2c' + Math.ceil(sun.getDate()/7) + '\u5468',
    month: months[now.getMonth()],
    monthCn: cnMonths[now.getMonth()],
    year: now.getFullYear(),
    dateStr: now.toISOString().split('T')[0],
    startDate: sun.getDate(),
    days: [sun,
      new Date(sun.getTime()+86400000),
      new Date(sun.getTime()+172800000),
      new Date(sun.getTime()+259200000),
      new Date(sun.getTime()+345600000),
      new Date(sun.getTime()+432000000),
      new Date(sun.getTime()+518400000)
    ].map(d => d.getDate())
  };
}

function getMoonPhase(date) {
  const known = new Date(2000,0,6,18,14,0);
  const days = (date - known) / 86400000;
  const phase = ((days % 29.53058867) + 29.53058867) % 29.53058867;
  if (phase < 1.85)  return {name:'New Moon',cn:'\u65b0\u6708',glyph:'\ud83c\udf11',pct:2};
  if (phase < 7.38)  return {name:'Waxing Crescent',cn:'\u5ce8\u7709\u6708',glyph:'\ud83c\udf12',pct:Math.round(phase/14.77*100)};
  if (phase < 9.22)  return {name:'First Quarter',cn:'\u4e0a\u5f26\u6708',glyph:'\ud83c\udf13',pct:50};
  if (phase < 14.77) return {name:'Waxing Gibbous',cn:'\u76c8\u51f8\u6708',glyph:'\ud83c\udf14',pct:Math.round((0.5+(phase-9.22)/11.1)*100)};
  if (phase < 16.61) return {name:'Full Moon',cn:'\u6ee1\u6708',glyph:'\ud83c\udf15',pct:100};
  if (phase < 22.15) return {name:'Waning Gibbous',cn:'\u4e8f\u51f8\u6708',glyph:'\ud83c\udf16',pct:Math.round((1-(phase-16.61)/11.1)*100)};
  if (phase < 23.99) return {name:'Last Quarter',cn:'\u4e0b\u5f26\u6708',glyph:'\ud83c\udf17',pct:50};
  return {name:'Waning Crescent',cn:'\u6b8b\u6708',glyph:'\ud83c\udf18',pct:Math.round((29.53-phase)/14.77*100)};
}

// ── Call Claude API ──
function callClaude(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.astrology_key,
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

// ── Clean text for safe JSON embedding ──
function safe(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...');
}

// ── Parse JSON robustly ──
function parseJSON(raw) {
  // strip markdown fences
  let text = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  // extract first { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  return JSON.parse(text);
}

// ── Build prompt ──
function buildPrompt(week, moon) {
  const SYSTEM = `You are a JSON generator. You output ONLY raw valid JSON with no explanation, no markdown, no code fences. Every string value must use straight double quotes. Never use curly quotes, smart quotes, or apostrophes inside string values - rephrase instead. Never include newlines inside string values. All text must be on a single line per string.`;

  const USER = `Generate weekly astrology guidance as a single JSON object for this person.

Birth: ${BIRTH.date} ${BIRTH.time} ${BIRTH.location}
Sun: ${BIRTH.sun}
Rising: ${BIRTH.rising}  
Moon: ${BIRTH.moon}
BaZi: ${BIRTH.bazi}
Day Pillar: ${BIRTH.dayPillar}
Year: ${BIRTH.currentYear}
Situation: ${BIRTH.situation}

Current date: ${week.dateStr}
Week: ${week.label}
Moon phase: ${moon.name} ${moon.pct} percent

Return exactly this JSON structure with all fields filled in. All string values must be plain text only - no apostrophes, use "do not" instead of "don't", "you are" instead of "you're" etc:

{
  "weekTheme": "one powerful sentence about this week energy in English",
  "weekThemeCn": "Chinese version max 20 characters",
  "oracle": "specific oracle message referencing their actual chart no generic advice",
  "oracleCn": "Chinese oracle",
  "oracleGlyph": "one emoji",
  "aspects": {
    "career": {
      "insight": "2 to 3 sentences specific to employee to builder transition",
      "insightCn": "Chinese",
      "actions": [
        {"en": "specific action with exact language", "cn": "Chinese", "when": "date or day"},
        {"en": "second action", "cn": "Chinese", "when": "date"},
        {"en": "third action", "cn": "Chinese", "when": "date"}
      ]
    },
    "money": {
      "insight": "specific to building runway and Ren-Wu spending tendency",
      "insightCn": "Chinese",
      "actions": [
        {"en": "action", "cn": "Chinese", "when": "date"},
        {"en": "action", "cn": "Chinese", "when": "date"}
      ]
    },
    "love": {
      "insight": "specific to Libra Pisces bind and no serious relationship pattern",
      "insightCn": "Chinese",
      "actions": [
        {"en": "action", "cn": "Chinese", "when": "date"},
        {"en": "action", "cn": "Chinese", "when": "date"}
      ]
    },
    "family": {
      "insight": "ancestral patterns and family expectation around safe path",
      "insightCn": "Chinese",
      "actions": [
        {"en": "action", "cn": "Chinese", "when": "date"}
      ]
    },
    "purpose": {
      "insight": "North Node visibility year irreversible public step",
      "insightCn": "Chinese",
      "actions": [
        {"en": "action", "cn": "Chinese", "when": "date"},
        {"en": "action", "cn": "Chinese", "when": "date"},
        {"en": "action", "cn": "Chinese", "when": "date"}
      ]
    }
  },
  "days": [
    {"day": "SUN", "date": ${week.days[0]}, "hot": true, "warn": false, "energy": "short title", "action": "what to do specific", "cn": "Chinese"},
    {"day": "MON", "date": ${week.days[1]}, "hot": false, "warn": false, "energy": "title", "action": "action", "cn": "Chinese"},
    {"day": "TUE", "date": ${week.days[2]}, "hot": false, "warn": false, "energy": "title", "action": "action", "cn": "Chinese"},
    {"day": "WED", "date": ${week.days[3]}, "hot": false, "warn": false, "energy": "title", "action": "action", "cn": "Chinese"},
    {"day": "THU", "date": ${week.days[4]}, "hot": false, "warn": false, "energy": "title", "action": "action", "cn": "Chinese"},
    {"day": "FRI", "date": ${week.days[5]}, "hot": false, "warn": false, "energy": "title", "action": "action", "cn": "Chinese"},
    {"day": "SAT", "date": ${week.days[6]}, "hot": true, "warn": false, "energy": "title", "action": "action", "cn": "Chinese"}
  ],
  "priorities": [
    {"num": "1", "en": "top priority this week", "cn": "Chinese"},
    {"num": "2", "en": "second priority", "cn": "Chinese"},
    {"num": "3", "en": "third priority", "cn": "Chinese"},
    {"num": "4", "en": "fourth priority", "cn": "Chinese"}
  ],
  "writePrompts": [
    {"label": "Write 1", "prompt": "fill in blank prompt for this week", "cn": "Chinese"},
    {"label": "Write 2", "prompt": "prompt", "cn": "Chinese"},
    {"label": "Write 3", "prompt": "prompt", "cn": "Chinese"}
  ]
}`;

  return { system: SYSTEM, user: USER };
}

// ── Build HTML ──
function buildHTML(data, week, moon) {
  function aspectCard(icon, cls, titleEn, titleCn, asp) {
    const actions = asp.actions.map((a, i) => `
      <div class="action-row">
        <div class="action-num">0${i+1}</div>
        <div>
          <div class="action-en">${safe(a.en)}</div>
          <div class="action-cn">${safe(a.cn)}</div>
          <span class="when-chip">${safe(a.when)}</span>
        </div>
      </div>`).join('');
    return `
    <div class="section-card">
      <div class="card-header" onclick="toggleCard(this)">
        <div class="card-title-row">
          <div class="card-icon ${cls}">${icon}</div>
          <div><div class="card-title">${titleEn}</div><div class="card-title-cn">${titleCn}</div></div>
        </div>
        <div class="card-arrow">&#8250;</div>
      </div>
      <div class="card-body">
        <div class="insight-pill">
          <div class="insight-label">Your Code Decoded</div>
          <div class="insight-text">${safe(asp.insight)}</div>
          <div class="insight-cn">${safe(asp.insightCn)}</div>
        </div>
        <div class="actions-label">&#8627; Actions This Week</div>
        ${actions}
      </div>
    </div>`;
  }

  const dayRows = data.days.map(d => {
    const hc = d.hot ? 'hot' : (d.warn ? 'warn' : '');
    return `
    <div class="day-item">
      <div class="day-left ${hc}">
        <div class="day-name ${hc}">${d.day}</div>
        <div class="day-date-num ${hc}">${d.date}</div>
      </div>
      <div class="day-right">
        <div class="day-energy">${safe(d.energy)}</div>
        <div class="day-action">${safe(d.action)}</div>
        <div class="day-action-cn">${safe(d.cn)}</div>
      </div>
    </div>`;
  }).join('');

  const priorities = data.priorities.map(p => `
    <div class="priority-item">
      <div class="priority-num">${p.num}</div>
      <div>
        <div class="priority-text">${safe(p.en)}</div>
        <div class="priority-cn">${safe(p.cn)}</div>
      </div>
    </div>`).join('');

  const writePrompts = data.writePrompts.map(w => `
    <div class="write-card">
      <div class="write-label">${safe(w.label)}</div>
      <div class="write-prompt">"${safe(w.prompt)}"</div>
      <div class="write-cn">${safe(w.cn)}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="&#26143;&#30424;&#25351;&#24341;">
<meta name="theme-color" content="#0F0D0A">
<title>&#26143;&#30424;&#25351;&#24341; &middot; ${week.label}</title>
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='36' fill='%230F0D0A'/%3E%3Ccircle cx='90' cy='90' r='72' fill='none' stroke='%23B8860B' stroke-width='1.5'/%3E%3Ctext x='90' y='100' text-anchor='middle' font-size='52' fill='%23B8860B'%3E&#10022;%3C/text%3E%3C/svg%3E">
<style>
:root{--ink:#0F0D0A;--ink2:#1A1612;--paper:#F5F0E8;--gold:#B8860B;--gold2:#D4A843;--red:#8B2E2E;--teal:#2A6B62;--purple:#4A3470;--border:rgba(184,134,11,0.22);--border2:rgba(184,134,11,0.45);--safe-top:env(safe-area-inset-top,44px);--safe-bottom:env(safe-area-inset-bottom,20px)}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{height:100%}
body{height:100%;background:var(--ink);color:var(--paper);font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;font-size:15px;line-height:1.5;overflow:hidden}
#app{display:flex;flex-direction:column;height:100%;max-width:430px;margin:0 auto}
.status-bar{height:var(--safe-top);background:var(--ink);flex-shrink:0}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--ink);border-bottom:1px solid rgba(184,134,11,0.15);flex-shrink:0}
.topbar-left{display:flex;align-items:center;gap:9px}
.app-name{font-size:17px;font-weight:600;color:var(--paper);letter-spacing:-.3px}
.app-sub{font-size:11px;color:var(--gold2);letter-spacing:2px;display:block;margin-top:-1px}
.date-chip{font-size:11px;color:var(--gold2);background:rgba(184,134,11,0.12);border:1px solid var(--border);border-radius:20px;padding:4px 12px}
.nav-tabs{display:flex;background:var(--ink2);border-bottom:1px solid var(--border);flex-shrink:0}
.nav-tab{flex:1;padding:10px 4px 9px;font-size:11px;font-weight:500;color:rgba(245,240,232,0.45);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;text-align:center;line-height:1.4}
.nav-tab.active{color:var(--gold2);border-bottom-color:var(--gold2)}
.scroll-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.screen{display:none;padding:0 0 calc(20px + var(--safe-bottom))}
.screen.active{display:block}
.hero{background:linear-gradient(160deg,#1A1228 0%,var(--ink) 60%);padding:22px 20px 18px;border-bottom:1px solid var(--border);position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(184,134,11,0.12) 0%,transparent 70%);pointer-events:none}
.hero-week{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin-bottom:5px}
.hero-title{font-size:22px;font-weight:700;color:var(--paper);letter-spacing:-.3px;line-height:1.25;margin-bottom:3px}
.hero-cn{font-size:12px;color:rgba(245,240,232,0.45);letter-spacing:3px;margin-bottom:14px}
.triad{display:flex;gap:7px;flex-wrap:wrap}
.triad-chip{font-size:11px;background:rgba(184,134,11,0.14);border:1px solid var(--border);border-radius:20px;padding:3px 11px;color:var(--gold2)}
.moon-bar{margin:14px 16px 0;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.moon-bar-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
.moon-phase-name{font-size:12px;font-weight:600;color:var(--paper)}
.moon-phase-cn{font-size:10px;color:rgba(245,240,232,0.5);letter-spacing:1px}
.moon-phase-glyph{font-size:22px;line-height:1}
.moon-progress-track{height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden}
.moon-progress-fill{height:100%;background:linear-gradient(to right,var(--gold),var(--gold2));border-radius:2px}
.section-card{margin:12px 16px 0;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.card-header{display:flex;align-items:center;justify-content:space-between;padding:13px 16px 11px;border-bottom:1px solid var(--border);cursor:pointer}
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
.card-body{padding:0 16px;max-height:0;overflow:hidden;transition:max-height .4s ease,padding .25s ease}
.card-body.open{padding:13px 16px 15px;max-height:1200px}
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
.updated-chip{margin:14px 16px 4px;font-size:10px;color:rgba(245,240,232,0.25);text-align:center;letter-spacing:.5px}
.week-hero{background:linear-gradient(160deg,#1A1228 0%,var(--ink) 70%);padding:18px 20px 14px;border-bottom:1px solid var(--border)}
.week-hero-title{font-size:19px;font-weight:700;color:var(--paper);margin-bottom:2px;letter-spacing:-.3px}
.week-hero-cn{font-size:11px;color:rgba(245,240,232,0.45);letter-spacing:2px}
.week-hero-sub{font-size:11px;color:var(--gold2);margin-top:7px;line-height:1.5}
.day-list{padding:12px 16px 0}
.day-item{display:grid;grid-template-columns:50px 1fr;gap:10px;margin-bottom:9px}
.day-left{text-align:right;padding-top:3px;padding-right:10px;border-right:2px solid var(--border)}
.day-left.hot{border-right-color:var(--gold2)}
.day-left.warn{border-right-color:#8B2E2E}
.day-name{font-size:10px;font-weight:700;letter-spacing:1px;color:rgba(245,240,232,0.4);text-transform:uppercase}
.day-name.hot{color:var(--gold2)}
.day-name.warn{color:#C47070}
.day-date-num{font-size:17px;font-weight:700;color:rgba(245,240,232,0.5);line-height:1}
.day-date-num.hot{color:var(--gold2)}
.day-right{background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;padding:9px 12px}
.day-energy{font-size:13px;font-weight:600;color:var(--paper);margin-bottom:2px}
.day-action{font-size:12px;color:rgba(245,240,232,0.55);line-height:1.5}
.day-action-cn{font-size:10px;color:rgba(245,240,232,0.32);letter-spacing:.3px;margin-top:2px}
.priority-list{padding:12px 16px 0}
.priority-title{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin-bottom:9px}
.priority-item{display:flex;gap:10px;align-items:flex-start;margin-bottom:9px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
.priority-num{font-size:15px;font-weight:700;color:var(--gold2);line-height:1.2;flex-shrink:0}
.priority-text{font-size:13px;line-height:1.5;color:var(--paper)}
.priority-cn{font-size:11px;color:rgba(245,240,232,0.4);margin-top:2px;letter-spacing:.3px}
.write-prompts{margin:12px 16px 0}
.write-card{background:rgba(42,107,98,0.1);border:1px solid rgba(42,107,98,0.3);border-radius:10px;padding:11px 13px;margin-bottom:8px}
.write-label{font-size:9px;letter-spacing:2px;color:var(--teal);text-transform:uppercase;margin-bottom:4px}
.write-prompt{font-size:13px;color:var(--paper);line-height:1.5;font-style:italic}
.write-cn{font-size:10px;color:rgba(245,240,232,0.4);margin-top:3px;letter-spacing:.3px}
.chart-section{padding:14px 16px 0}
.chart-section-title{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin-bottom:11px}
.triad-cards{display:flex;flex-direction:column;gap:9px;margin-bottom:14px}
.triad-card{background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;padding:13px 15px;display:grid;grid-template-columns:38px 1fr;gap:11px}
.triad-icon{font-size:22px;line-height:1;padding-top:3px;text-align:center}
.triad-sign{font-size:15px;font-weight:700;color:var(--paper);margin-bottom:2px}
.triad-sign-cn{font-size:10px;color:var(--gold2);letter-spacing:2px;margin-bottom:5px}
.triad-wiring{font-size:12px;color:rgba(245,240,232,0.6);line-height:1.55}
.triad-shadow{font-size:11px;color:#C47070;font-style:italic;margin-top:4px;border-top:1px solid rgba(255,255,255,0.07);padding-top:4px}
.bazi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:13px}
.bazi-cell{background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;padding:9px 5px;text-align:center}
.bazi-cell.day{border-color:var(--gold2);background:rgba(184,134,11,0.1)}
.bazi-stem{font-size:19px;color:var(--paper);line-height:1}
.bazi-branch{font-size:19px;color:#A98ECC;line-height:1;margin-top:2px}
.bazi-cell.day .bazi-stem{color:var(--gold2)}
.bazi-cell-lbl{font-size:9px;color:rgba(245,240,232,0.4);letter-spacing:1px;margin-top:3px}
.block-list{display:flex;flex-direction:column;gap:7px;margin-bottom:13px}
.block-item{background:rgba(139,46,46,0.1);border-left:2px solid var(--red);border-radius:0 8px 8px 0;padding:9px 12px;font-size:12px;color:rgba(245,240,232,0.8);line-height:1.5}
.block-cn{font-size:10px;color:rgba(245,240,232,0.4);margin-top:2px;letter-spacing:.3px}
.chart-svg-wrap{background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:14px;padding:14px;display:flex;justify-content:center;margin-bottom:13px}
.oracle-hero{background:linear-gradient(160deg,#1A1228 0%,var(--ink) 70%);padding:26px 22px;border-bottom:1px solid var(--border);text-align:center}
.oracle-glyph{font-size:38px;margin-bottom:12px;display:block}
.oracle-quote{font-size:17px;font-style:italic;color:var(--paper);line-height:1.55;margin-bottom:9px;letter-spacing:-.2px}
.oracle-cn{font-size:13px;color:rgba(245,240,232,0.5);letter-spacing:2px;line-height:1.9}
.tara-section-header{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin:18px 16px 9px}
.tara-cards{display:flex;flex-direction:column;gap:8px;padding:0 16px}
.tara-card{background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;padding:13px 14px;display:grid;grid-template-columns:36px 1fr;gap:10px}
.tara-card.center{border-color:rgba(184,134,11,0.5);background:rgba(184,134,11,0.06)}
.tara-glyph{font-size:24px;line-height:1;padding-top:2px;text-align:center}
.tara-pos{font-size:9px;letter-spacing:2px;color:var(--gold2);text-transform:uppercase;margin-bottom:2px}
.tara-name{font-size:13px;font-weight:600;color:var(--paper);margin-bottom:3px}
.tara-action{font-size:12px;color:rgba(245,240,232,0.6);line-height:1.5}
.tara-cn{font-size:10px;color:rgba(245,240,232,0.35);margin-top:3px;letter-spacing:.3px}
.ruling-codes{margin:14px 16px 0;background:var(--ink2);border:1px solid var(--border);border-radius:12px;padding:14px}
.ruling-code-title{font-size:9px;letter-spacing:3px;color:var(--gold2);text-transform:uppercase;margin-bottom:11px}
.ruling-row{display:flex;gap:9px;align-items:flex-start;margin-bottom:9px}
.ruling-row:last-child{margin-bottom:0}
.ruling-glyph{font-size:17px;width:24px;text-align:center;flex-shrink:0}
.ruling-text{font-size:12px;color:rgba(245,240,232,0.7);line-height:1.5}
.ruling-cn{font-size:10px;color:rgba(245,240,232,0.35);margin-top:2px;letter-spacing:.3px}
.protector-box{margin:13px 16px 0;background:rgba(74,52,112,0.15);border:1px solid rgba(74,52,112,0.35);border-radius:12px;padding:14px;text-align:center}
.protector-glyph{font-size:30px;margin-bottom:7px;display:block}
.protector-name{font-size:17px;font-weight:600;color:var(--paper);letter-spacing:3px;margin-bottom:3px}
.protector-sub{font-size:11px;color:rgba(245,240,232,0.45);letter-spacing:1px;line-height:1.6}
.bottom-nav{display:flex;background:var(--ink2);border-top:1px solid var(--border);padding-bottom:var(--safe-bottom);flex-shrink:0}
.bottom-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px 6px;background:none;border:none;cursor:pointer}
.bottom-btn-icon{font-size:19px;line-height:1}
.bottom-btn-label{font-size:9px;letter-spacing:.5px;color:rgba(245,240,232,0.35);text-transform:uppercase}
.bottom-btn.active .bottom-btn-label{color:var(--gold2)}
</style>
</head>
<body>
<div id="app">
  <div class="status-bar"></div>
  <div class="topbar">
    <div class="topbar-left">
      <span style="font-size:20px">&#10022;</span>
      <div>
        <div class="app-name">Cosmic Guide</div>
        <span class="app-sub">&#26143;&#30424;&#25351;&#24341;</span>
      </div>
    </div>
    <div class="date-chip">${week.label}</div>
  </div>
  <div class="nav-tabs">
    <button class="nav-tab active" onclick="goScreen('home',this)">Week&#13;&#26412;&#21608;</button>
    <button class="nav-tab" onclick="goScreen('daily',this)">Daily&#13;&#36827;&#26085;</button>
    <button class="nav-tab" onclick="goScreen('chart',this)">Chart&#13;&#26143;&#30424;</button>
    <button class="nav-tab" onclick="goScreen('oracle',this)">Oracle&#13;&#31070;&#35889;</button>
  </div>
  <div class="scroll-area">

    <div class="screen active" id="screen-home">
      <div class="hero">
        <div class="hero-week">${week.label} &middot; ${week.labelCn}</div>
        <div class="hero-title">${safe(data.weekTheme)}</div>
        <div class="hero-cn">${safe(data.weekThemeCn)}</div>
        <div class="triad">
          <span class="triad-chip">&#9788; Libra &#22825;&#31192;</span>
          <span class="triad-chip">&#9790; Pisces &#21452;&#39770;</span>
          <span class="triad-chip">&#8679; Capricorn &#25098;&#29245;</span>
        </div>
      </div>
      <div class="moon-bar">
        <div class="moon-bar-top">
          <div>
            <div class="moon-phase-name">${moon.name}</div>
            <div class="moon-phase-cn">${moon.cn}</div>
          </div>
          <div class="moon-phase-glyph">${moon.glyph}</div>
        </div>
        <div class="moon-progress-track">
          <div class="moon-progress-fill" style="width:${moon.pct}%"></div>
        </div>
      </div>
      ${aspectCard('&#9889;','c','Career &amp; Transition','&#20107;&#19994; &middot; &#36716;&#22411;', data.aspects.career)}
      ${aspectCard('&#9672;','m','Money &amp; Runway','&#36130;&#36816; &middot; &#36807;&#28도;&#36164;&#37329;', data.aspects.money)}
      ${aspectCard('&#9825;','l','Love &amp; Connection','&#24773;&#24863; &middot; &#36830;&#25509;', data.aspects.love)}
      ${aspectCard('&#8962;','f','Family &amp; Roots','&#23478;&#24237; &middot; &#26681;&#28304;', data.aspects.family)}
      ${aspectCard('&#10022;','p','Soul Purpose','&#31049;&#39137;&#20351;&#21629;', data.aspects.purpose)}
      <div class="updated-chip">&#10022; Updated ${week.dateStr} &middot; &#27599;&#21608;&#26085;&#33258;&#21160;&#26356;&#26032; &#10022;</div>
    </div>

    <div class="screen" id="screen-daily">
      <div class="week-hero">
        <div class="week-hero-title">Week of ${week.label}</div>
        <div class="week-hero-cn">${week.labelCn}</div>
        <div class="week-hero-sub">${safe(data.weekTheme)}</div>
      </div>
      <div class="day-list">${dayRows}</div>
      <div class="priority-list" style="margin-top:12px">
        <div class="priority-title">Priority Order &middot; &#26412;&#21608;&#20248;&#20808;&#39034;&#24207;</div>
        ${priorities}
      </div>
      <div class="write-prompts">
        <div class="priority-title" style="margin-bottom:9px">Writing Prompts &middot; &#20070;&#20889;&#32451;&#20064;</div>
        ${writePrompts}
      </div>
    </div>

    <div class="screen" id="screen-chart">
      <div class="chart-section">
        <div class="chart-section-title">Your Source Code &middot; &#21629;&#36816;&#23494;&#30721;</div>
        <div class="chart-svg-wrap">
          <svg viewBox="0 0 300 300" width="250" height="250" xmlns="http://www.w3.org/2000/svg">
            <circle cx="150" cy="150" r="140" fill="none" stroke="rgba(184,134,11,0.2)" stroke-width="1"/>
            <circle cx="150" cy="150" r="112" fill="none" stroke="rgba(184,134,11,0.12)" stroke-width="0.5"/>
            <circle cx="150" cy="150" r="80" fill="none" stroke="rgba(169,142,204,0.25)" stroke-width="1"/>
            <circle cx="150" cy="150" r="50" fill="rgba(184,134,11,0.03)" stroke="rgba(184,134,11,0.18)" stroke-width="0.5"/>
            <circle cx="150" cy="150" r="18" fill="rgba(15,13,10,0.8)" stroke="rgba(184,134,11,0.3)" stroke-width="0.5"/>
            <line x1="150" y1="10" x2="150" y2="290" stroke="rgba(184,134,11,0.1)" stroke-width="0.5"/>
            <line x1="10" y1="150" x2="290" y2="150" stroke="rgba(184,134,11,0.1)" stroke-width="0.5"/>
            <line x1="41" y1="57" x2="259" y2="243" stroke="rgba(184,134,11,0.07)" stroke-width="0.5"/>
            <line x1="57" y1="41" x2="243" y2="259" stroke="rgba(184,134,11,0.07)" stroke-width="0.5"/>
            <line x1="41" y1="243" x2="259" y2="57" stroke="rgba(184,134,11,0.07)" stroke-width="0.5"/>
            <line x1="57" y1="259" x2="243" y2="41" stroke="rgba(184,134,11,0.07)" stroke-width="0.5"/>
            <text x="44" y="108" text-anchor="middle" font-size="12" fill="rgba(169,142,204,0.9)">&#9806;</text>
            <text x="77" y="236" text-anchor="middle" font-size="12" fill="rgba(74,155,142,0.7)">&#9809;</text>
            <text x="125" y="252" text-anchor="middle" font-size="12" fill="rgba(169,142,204,0.7)">&#9810;</text>
            <text x="175" y="252" text-anchor="middle" font-size="12" fill="rgba(74,155,142,0.7)">&#9811;</text>
            <text x="210" y="73" text-anchor="middle" font-size="12" fill="rgba(169,142,204,0.8)">&#9802;</text>
            <text x="163" y="57" text-anchor="middle" font-size="12" fill="rgba(74,155,142,0.7)">&#9803;</text>
            <line x1="150" y1="150" x2="213" y2="213" stroke="rgba(184,134,11,0.55)" stroke-width="1.2" stroke-dasharray="4 2"/>
            <text x="222" y="228" text-anchor="middle" font-size="9" fill="#D4A843">ASC</text>
            <circle cx="66" cy="156" r="7" fill="rgba(184,134,11,0.15)" stroke="#D4A843" stroke-width="1.5"/>
            <text x="66" y="161" text-anchor="middle" font-size="10" fill="#D4A843">&#9737;</text>
            <circle cx="158" cy="80" r="6" fill="rgba(169,142,204,0.15)" stroke="#A98ECC" stroke-width="1.5"/>
            <text x="158" y="85" text-anchor="middle" font-size="10" fill="#A98ECC">&#9789;</text>
            <circle cx="108" cy="195" r="5" fill="rgba(196,123,138,0.15)" stroke="#C47B8A" stroke-width="1"/>
            <text x="108" y="199" text-anchor="middle" font-size="9" fill="#C47B8A">&#9792;</text>
            <line x1="66" y1="156" x2="158" y2="80" stroke="rgba(74,155,142,0.25)" stroke-width="0.8" stroke-dasharray="3 2"/>
            <text x="150" y="155" text-anchor="middle" font-size="12" fill="rgba(184,134,11,0.5)">&#10022;</text>
            <text x="150" y="288" text-anchor="middle" font-size="7" fill="rgba(184,134,11,0.4)" letter-spacing="1">1996.09.26 &middot; 14:52 &middot; JINHUA</text>
          </svg>
        </div>
        <div class="triad-cards">
          <div class="triad-card"><div class="triad-icon">&#9728;&#65039;</div><div><div class="triad-sign">Libra H7</div><div class="triad-sign-cn">&#22825;&#31192;&#24231; &#31532;&#19971;&#23467;</div><div class="triad-wiring">Wired for co-creation. The delay on your business is Libra needing a collaborator before fully committing.</div><div class="triad-shadow">Shadow: Deciding by consensus leads to paralysis. Your number one block.</div></div></div>
          <div class="triad-card"><div class="triad-icon">&#127749;&#65039;</div><div><div class="triad-sign">Capricorn Rising</div><div class="triad-sign-cn">&#25098;&#29245;&#24231;&#19978;&#21319;</div><div class="triad-wiring">Composed, structured, reliable. But runs the program: I must earn the right to be seen before launching.</div><div class="triad-shadow">Shadow: Preparation becomes procrastination. You are already ready.</div></div></div>
          <div class="triad-card"><div class="triad-icon">&#127769;&#65039;</div><div><div class="triad-sign">Pisces Moon H3</div><div class="triad-sign-cn">&#21452;&#39770;&#24231;&#26376;&#20142; &#31532;&#19977;&#23467;</div><div class="triad-wiring">Extraordinary gut intelligence that speaks through writing and ideas. When something feels right it usually is.</div><div class="triad-shadow">Shadow: Absorbing others doubts as your own. Not every worry is yours.</div></div></div>
        </div>
        <div class="chart-section-title">&#20843;&#23383;&#22235;&#26609; &middot; Four Pillars</div>
        <div class="bazi-grid">
          <div class="bazi-cell"><div class="bazi-stem">&#20141;</div><div class="bazi-branch">&#23376;</div><div class="bazi-cell-lbl">&#24180; Year</div></div>
          <div class="bazi-cell"><div class="bazi-stem">&#24218;</div><div class="bazi-branch">&#25240;</div><div class="bazi-cell-lbl">&#26376; Month</div></div>
          <div class="bazi-cell day"><div class="bazi-stem">&#22764;</div><div class="bazi-branch">&#21320;</div><div class="bazi-cell-lbl">&#26085; Day &#10022;</div></div>
          <div class="bazi-cell"><div class="bazi-stem">&#36758;</div><div class="bazi-branch">&#26410;</div><div class="bazi-cell-lbl">&#26102; Hour</div></div>
        </div>
        <div class="chart-section-title">Three Blocks &middot; &#19977;&#20010;&#31243;&#24207;</div>
        <div class="block-list">
          <div class="block-item"><strong>Libra delay loop:</strong> Weighing then not deciding then waiting then weighing again.<div class="block-cn">&#22825;&#31192;&#25320;&#24310;&#24490;&#29615;&#65306;&#26435;&#34900;&#8594;&#19981;&#20915;&#23450;&#8594;&#31561;&#8594;&#20877;&#26435;&#34900;</div></div>
          <div class="block-item"><strong>Capricorn prep trap:</strong> Launch when ready means never. Readiness is a feeling not a state.<div class="block-cn">&#25098;&#29245;&#20ตมีbitstamp&#38450;&#38449;&#65306;&#12300;&#20ตมีbitstamp;&#22909;&#20877;&#21457;&#12301;=&#27704;&#36828;&#19981;&#21457;</div></div>
          <div class="block-item"><strong>Pisces dissolution:</strong> Absorbing others doubts as your own. Not every worry is yours.<div class="block-cn">&#21452;&#39770;&#21560;&#25910;&#65306;&#25226;&#21035;&#20154;&#30340;&#30097;&#34989;&#24403;&#25104;&#33258;&#24049;&#30340;</div></div>
        </div>
      </div>
    </div>

    <div class="screen" id="screen-oracle">
      <div class="oracle-hero">
        <span class="oracle-glyph">${safe(data.oracleGlyph)}</span>
        <div class="oracle-quote">${safe(data.oracle)}</div>
        <div class="oracle-cn">${safe(data.oracleCn)}</div>
      </div>
      <div class="tara-section-header">Tara Three Cards &middot; &#22338;&#32599;&#19977;&#29260;</div>
      <div class="tara-cards">
        <div class="tara-card"><div class="tara-glyph">&#127754;</div><div><div class="tara-pos">Past &middot; &#36807;&#21435;</div><div class="tara-name">The High Priestess</div><div class="tara-action">Stop consulting everyone. You already know. Sit with it.</div><div class="tara-cn">&#22899;&#31966;&#21496;&#65306;&#20320;&#26089;&#24050;&#30693;&#36947;&#31572;&#26696;&#12290;</div></div></div>
        <div class="tara-card center"><div class="tara-glyph">&#11088;</div><div><div class="tara-pos">Present &middot; &#24403;&#19979;</div><div class="tara-name">The Star</div><div class="tara-action">You are in your healing season. Let yourself be refilled before the next push.</div><div class="tara-cn">&#26143;&#26143;&#65306;&#20320;&#22312;&#30064;&#24179;&#31168;&#12290;&#20808;&#20860;&#28385;&#33258;&#24049;&#65292;&#20877;&#20914;&#20914;&#12290;</div></div></div>
        <div class="tara-card"><div class="tara-glyph">&#127749;</div><div><div class="tara-pos">Future &middot; &#26410;&#26469;</div><div class="tara-name">The World</div><div class="tara-action">What you seed this week becomes the harvest of late 2026.</div><div class="tara-cn">&#19990;&#30028;&#65306;&#26412;&#21608;&#25파;&#19979;&#30340;&#31278;&#23376;&#65292;2026&#24180;&#24180;&#24213;&#25910;&#33719;&#12290;</div></div></div>
      </div>
      <div class="ruling-codes">
        <div class="ruling-code-title">Your Three Codes &middot; &#19977;&#37325;&#23494;&#30721;</div>
        <div class="ruling-row"><div class="ruling-glyph">&#9806;</div><div><div class="ruling-text"><strong style="color:#F5F0E8;">Libra Sun:</strong> Built for co-creation. Find your person then build together.</div><div class="ruling-cn">&#22825;&#31192;&#65306;&#20026;&#20849;&#21516;&#21019;&#36896;&#32780;&#29983;&#12290;</div></div></div>
        <div class="ruling-row"><div class="ruling-glyph">&#9809;</div><div><div class="ruling-text"><strong style="color:#F5F0E8;">Cap Rising:</strong> Structures liberate you. Build the container then leap.</div><div class="ruling-cn">&#25098;&#29245;&#19978;&#21319;&#65306;&#32467;&#26500;&#35299;&#25918;&#20320;&#12290;&#20808;&#24314;&#23481;&#22120;&#65292;&#20877;&#36215;&#36339;&#12290;</div></div></div>
        <div class="ruling-row"><div class="ruling-glyph">&#9811;</div><div><div class="ruling-text"><strong style="color:#F5F0E8;">Pisces Moon:</strong> Your gut already knows. Stop asking. Start moving.</div><div class="ruling-cn">&#21452;&#40479;&#26376;&#20142;&#65306;&#20320;&#30340;&#30452;&#35273;&#26089;&#23601;&#30693;&#36947;&#20102;&#12290;</div></div></div>
      </div>
      <div class="protector-box">
        <span class="protector-glyph">&#128591;</span>
        <div class="protector-name">&#21315;&#25163;&#35266;&#38899;</div>
        <div class="protector-sub">&#29983;&#32635;&#40736;&#23432;&#25252;&#20315; &middot; Protector of the Rat<br>&#21021;&#19968;&#21313;&#20116;&#23�;&#31036;&#25308;</div>
      </div>
    </div>

  </div>
  <div class="bottom-nav">
    <button class="bottom-btn active" onclick="goScreen('home',this)"><span class="bottom-btn-icon">&#127769;</span><span class="bottom-btn-label">Week</span></button>
    <button class="bottom-btn" onclick="goScreen('daily',this)"><span class="bottom-btn-icon">&#128197;</span><span class="bottom-btn-label">Daily</span></button>
    <button class="bottom-btn" onclick="goScreen('chart',this)"><span class="bottom-btn-icon">&#10022;</span><span class="bottom-btn-label">Chart</span></button>
    <button class="bottom-btn" onclick="goScreen('oracle',this)"><span class="bottom-btn-icon">&#128302;</span><span class="bottom-btn-label">Oracle</span></button>
  </div>
</div>
<script>
function goScreen(id,btn){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('screen-'+id).classList.add('active');const map=['home','daily','chart','oracle'];document.querySelectorAll('.nav-tab').forEach((t,i)=>t.classList.toggle('active',map[i]===id));document.querySelector('.scroll-area').scrollTop=0;if(btn){document.querySelectorAll('.bottom-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}}
function toggleCard(h){const b=h.nextElementSibling;const o=b.classList.contains('open');document.querySelectorAll('.card-body').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.card-header').forEach(x=>x.classList.remove('open'));if(!o){b.classList.add('open');h.classList.add('open');}}
<\/script>
</body>
</html>`;
}

// ── MAIN ──
async function main() {
  console.log('Starting weekly cosmic guide generation...');
  const week = getWeekRange();
  const moon = getMoonPhase(new Date());
  console.log('Week:', week.label, '| Moon:', moon.name, moon.pct + '%');

  const { system, user } = buildPrompt(week, moon);
  console.log('Calling Claude API...');

  let rawText;
  try {
    rawText = await callClaude(system, user);
  } catch(e) {
    console.error('Claude API call failed:', e.message);
    process.exit(1);
  }

  console.log('Parsing JSON...');
  let data;
  try {
    data = parseJSON(rawText);
  } catch(e) {
    console.error('JSON parse failed:', e.message);
    console.log('Attempting auto-fix...');
    try {
      const fixSystem = 'You fix broken JSON. Return only the corrected valid JSON object, nothing else.';
      const fixUser = 'Fix this JSON and return only the corrected version:\n\n' + rawText.substring(0, 6000);
      const fixed = await callClaude(fixSystem, fixUser);
      data = parseJSON(fixed);
      console.log('Auto-fix succeeded.');
    } catch(e2) {
      console.error('Auto-fix also failed:', e2.message);
      process.exit(1);
    }
  }

  console.log('Building HTML...');
  const html = buildHTML(data, week, moon);
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('Done! index.html written for week of', week.label);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
