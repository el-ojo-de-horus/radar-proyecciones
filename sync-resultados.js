const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const VALID_NUMS = new Set([
  '0', '00', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36'
]);

const DRAW_HOURS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM'
];

const ANIMALITOS_CATALOG = [
  { num: '00', name: 'BALLENA', emoji: '🐳' },
  { num: '0', name: 'DELFIN', emoji: '🐬' },
  { num: '1', name: 'CARNERO', emoji: '🐏' },
  { num: '2', name: 'TORO', emoji: '🐃' },
  { num: '3', name: 'CIEMPIÉS', emoji: '🐛' },
  { num: '4', name: 'ALACRÁN', emoji: '🦂' },
  { num: '5', name: 'LEÓN', emoji: '🦁' },
  { num: '6', name: 'RANA', emoji: '🐸' },
  { num: '7', name: 'PERICO', emoji: '🦜' },
  { num: '8', name: 'RATÓN', emoji: '🐭' },
  { num: '9', name: 'ÁGUILA', emoji: '🦅' },
  { num: '10', name: 'TIGRE', emoji: '🐯' },
  { num: '11', name: 'GATO', emoji: '🐱' },
  { num: '12', name: 'CABALLO', emoji: '🐎' },
  { num: '13', name: 'MONO', emoji: '🐵' },
  { num: '14', name: 'PALOMA', emoji: '🕊' },
  { num: '15', name: 'ZORRO', emoji: '🦊' },
  { num: '16', name: 'OSO', emoji: '🐻' },
  { num: '17', name: 'PAVO', emoji: '🦃' },
  { num: '18', name: 'BURRO', emoji: '🐴' },
  { num: '19', name: 'CHIVO', emoji: '🐐' },
  { num: '20', name: 'COCHINO', emoji: '🐷' },
  { num: '21', name: 'GALLO', emoji: '🐓' },
  { num: '22', name: 'CAMELLO', emoji: '🐪' },
  { num: '23', name: 'CEBRA', emoji: '🦓' },
  { num: '24', name: 'IGUANA', emoji: '🦎' },
  { num: '25', name: 'GALLINA', emoji: '🐔' },
  { num: '26', name: 'VACA', emoji: '🐮' },
  { num: '27', name: 'PERRO', emoji: '🐶' },
  { num: '28', name: 'ZAMURO', emoji: '⬛️' },
  { num: '29', name: 'ELEFANTE', emoji: '🐘' },
  { num: '30', name: 'CAIMÁN', emoji: '🐊' },
  { num: '31', name: 'LAPA', emoji: '🦦' },
  { num: '32', name: 'ARDILLA', emoji: '🐿' },
  { num: '33', name: 'PESCADO', emoji: '🐟' },
  { num: '34', name: 'VENADO', emoji: '🦌' },
  { num: '35', name: 'JIRAFA', emoji: '🦒' },
  { num: '36', name: 'CULEBRA', emoji: '🐍' }
];

const COMPLEMENT_TERMINAL = { 0: 5, 5: 0, 1: 6, 6: 1, 2: 7, 7: 2, 3: 8, 8: 3, 4: 9, 9: 4 };
const VISUAL_INVERSION = { '6': '9', '9': '6', '16': '19', '19': '16', '26': '29', '29': '26' };

const VIP_TRIANGULATIONS = [
  { pair: ['12', '18'], target: '23' },
  { pair: ['0', '33'], target: '00' },
  { pair: ['11', '27'], target: '5' },
  { pair: ['5', '10'], target: '25' },
  { pair: ['2', '26'], target: '12' },
  { pair: ['14', '21'], target: '9' },
  { pair: ['8', '20'], target: '32' },
  { pair: ['35', '15'], target: '10' }
];

function normalizeHourLabel(hourStr) {
  if (!hourStr) return '';
  const clean = String(hourStr).toUpperCase().replace(/\s+/g, ' ').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return clean;
  return `${match[1].padStart(2, '0')}:${match[2]} ${match[3]}`;
}

function getHourOrderIndex(hourStr) {
  const idx = DRAW_HOURS.indexOf(normalizeHourLabel(hourStr));
  return idx === -1 ? 999 : idx;
}

function normalizeAnimalNum(numStr) {
  const raw = String(numStr ?? '0').trim();
  if (raw === '00') return '00';
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? '0' : String(parsed);
}

function sortHistoryChronologically(historyList = []) {
  const mapByHour = new Map();
  (historyList || []).forEach(entry => {
    if (!entry || !entry.hour || entry.num === undefined) return;
    const normHour = normalizeHourLabel(entry.hour);
    mapByHour.set(normHour, {
      hour: normHour,
      num: normalizeAnimalNum(entry.num),
      isHit: Boolean(entry.isHit)
    });
  });
  return Array.from(mapByHour.values()).sort(
    (a, b) => getHourOrderIndex(a.hour) - getHourOrderIndex(b.hour)
  );
}

function getAnimalByNum(numStr) {
  const normalized = normalizeAnimalNum(numStr);
  return ANIMALITOS_CATALOG.find(a => a.num === normalized) || ANIMALITOS_CATALOG[1];
}

function getNextHourLabel(currentHour) {
  const norm = normalizeHourLabel(currentHour);
  const idx = DRAW_HOURS.indexOf(norm);
  if (idx === -1 || idx >= DRAW_HOURS.length - 1) return DRAW_HOURS[0];
  return DRAW_HOURS[idx + 1];
}

function getVenezuelaDateParts() {
  const now = new Date();
  const veTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  return {
    year: veTime.getFullYear(),
    month: veTime.getMonth() + 1,
    day: veTime.getDate(),
    dateObj: veTime
  };
}

function getVenezuelaDateStamp() {
  const { year, month, day } = getVenezuelaDateParts();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTerminalDigit(numStr) {
  if (numStr === '00') return 0;
  const n = parseInt(numStr, 10) || 0;
  return n % 10;
}

function computeDatePyramid(dateObj = getVenezuelaDateParts().dateObj) {
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = String(dateObj.getFullYear());
  let row = `${dd}${mm}${yyyy}`.split('').map(Number);

  while (row.length > 2) {
    const nextRow = [];
    for (let i = 0; i < row.length - 1; i++) {
      nextRow.push((row[i] + row[i + 1]) % 10);
    }
    row = nextRow;
  }
  const base = row[0] ?? 0;
  const vertex = ((row[0] ?? 0) + (row[1] ?? 0)) % 10;
  return { vertex, base };
}

function findCandidatesByTerminal(terminalDigit, excludeNums = new Set()) {
  return ANIMALITOS_CATALOG.filter(
    a => getTerminalDigit(a.num) === terminalDigit && !excludeNums.has(a.num)
  );
}

function computeStatisticalProjection(sorteoKey, lastNum, nextHour, history = []) {
  const lastItem = getAnimalByNum(lastNum);
  const recentNums = (history || []).map(h => normalizeAnimalNum(h.num));
  if (!recentNums.includes(lastItem.num)) recentNums.push(lastItem.num);
  const excludeSet = new Set(recentNums.slice(-3));

  const { vertex, base } = computeDatePyramid();
  const hourIdx = Math.max(0, DRAW_HOURS.indexOf(normalizeHourLabel(nextHour)));
  const sorteoOffset = sorteoKey === 'lotto_activo' ? 0 : 1;

  const terminalCounts = {};
  recentNums.forEach(n => {
    const t = getTerminalDigit(n);
    terminalCounts[t] = (terminalCounts[t] || 0) + 1;
  });
  const lastTerminal = getTerminalDigit(lastItem.num);
  const isTerminalSaturated = (terminalCounts[lastTerminal] || 0) >= 2;
  const ruptureTerminal = isTerminalSaturated
    ? COMPLEMENT_TERMINAL[lastTerminal]
    : (lastTerminal + 1) % 10;

  let vipTargetNum = null;
  const lastTwo = recentNums.slice(-2);
  if (lastTwo.length === 2) {
    const foundPattern = VIP_TRIANGULATIONS.find(
      p => (p.pair.includes(lastTwo[0]) && p.pair.includes(lastTwo[1]))
    );
    if (foundPattern && !excludeSet.has(foundPattern.target)) {
      vipTargetNum = foundPattern.target;
    }
  }

  const vertexPool = findCandidatesByTerminal(vertex, excludeSet);
  const primary = vertexPool.length
    ? vertexPool[(hourIdx + sorteoOffset) % vertexPool.length]
    : getAnimalByNum(String((vertex + 10) % 37));
  excludeSet.add(primary.num);

  let backup1 = null;
  if (vipTargetNum && !excludeSet.has(vipTargetNum)) {
    backup1 = getAnimalByNum(vipTargetNum);
  } else if (VISUAL_INVERSION[lastItem.num] && !excludeSet.has(VISUAL_INVERSION[lastItem.num])) {
    backup1 = getAnimalByNum(VISUAL_INVERSION[lastItem.num]);
  } else {
    const rupturePool = findCandidatesByTerminal(ruptureTerminal, excludeSet);
    backup1 = rupturePool.length
      ? rupturePool[(hourIdx + sorteoOffset) % rupturePool.length]
      : findCandidatesByTerminal(base, excludeSet)[0] || ANIMALITOS_CATALOG[2];
  }
  excludeSet.add(backup1.num);

  const presentNums = new Set(recentNums);
  const absentBaseCandidates = ANIMALITOS_CATALOG.filter(
    a => !presentNums.has(a.num) && !excludeSet.has(a.num) && getTerminalDigit(a.num) === base
  );
  const absentCandidates = ANIMALITOS_CATALOG.filter(
    a => !presentNums.has(a.num) && !excludeSet.has(a.num)
  );
  const fallbackPool = ANIMALITOS_CATALOG.filter(a => !excludeSet.has(a.num));

  let backup2 = null;
  if (absentBaseCandidates.length > 0) {
    backup2 = absentBaseCandidates[(hourIdx + sorteoOffset) % absentBaseCandidates.length];
  } else if (absentCandidates.length > 0) {
    backup2 = absentCandidates[(hourIdx * 3 + sorteoOffset) % absentCandidates.length];
  } else {
    backup2 = fallbackPool[(hourIdx + sorteoOffset) % fallbackPool.length] || ANIMALITOS_CATALOG[14];
  }

  return {
    primary,
    backups: [backup1, backup2]
  };
}

function recomputeAndSyncHits(draw, todayStamp) {
  const sorted = sortHistoryChronologically(draw.history || []);
  const hitsMap = new Map();

  (draw.hits || []).forEach(h => {
    if (h && h.hour) {
      hitsMap.set(normalizeHourLabel(h.hour), h);
    }
  });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const historyBeforeCurr = sorted.slice(0, i);
    const proj = computeStatisticalProjection(draw.key, prev.num, curr.hour, historyBeforeCurr);

    let hitType = null;
    if (proj.primary && proj.primary.num === curr.num) {
      hitType = 'PRINCIPAL';
    } else if (Array.isArray(proj.backups)) {
      const bIdx = proj.backups.findIndex(b => b && b.num === curr.num);
      if (bIdx !== -1) hitType = `RESPALDO #${bIdx + 1}`;
    }

    if (hitType) {
      curr.isHit = true;
      const animal = getAnimalByNum(curr.num);
      hitsMap.set(curr.hour, {
        id: `${todayStamp}_${curr.hour}_${curr.num}`,
        hour: curr.hour,
        num: animal.num,
        name: animal.name,
        emoji: animal.emoji,
        type: hitType
      });
    } else {
      curr.isHit = hitsMap.has(curr.hour);
    }
  }

  draw.history = sorted;
  draw.hits = Array.from(hitsMap.values()).sort(
    (a, b) => getHourOrderIndex(b.hour) - getHourOrderIndex(a.hour)
  ).slice(0, 12);
}

function parseResultsFromHtml(htmlText) {
  const cleanText = htmlText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const drawEntryRegex = /\b(00|[0-9]|1[0-9]|2[0-9]|3[0-6])\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+){0,2})\s+((?:0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM))\b/gi;

  function parseSliceMatches(sliceText) {
    const pairs = [];
    const seenHours = new Set();

    for (const match of sliceText.matchAll(drawEntryRegex)) {
      const rawNum = normalizeAnimalNum(match[1]);
      const rawHour = match[3].toUpperCase().replace(/\s+/g, ' ').trim();
      const normalizedHour = rawHour.length === 7 ? `0${rawHour}` : rawHour;

      if (VALID_NUMS.has(rawNum) && !seenHours.has(normalizedHour)) {
        seenHours.add(normalizedHour);
        pairs.push({ hour: normalizedHour, num: rawNum });
      }
    }

    return pairs;
  }

  const lowerText = cleanText.toLowerCase();
  const lgIdx = lowerText.indexOf('resultados la granjita');

  let laSlice = '';
  const laStart = lowerText.indexOf('resultados lotto activo');
  if (laStart !== -1) {
    laSlice = lgIdx > laStart ? cleanText.slice(laStart, lgIdx) : cleanText.slice(laStart, laStart + 2500);
  } else if (lgIdx !== -1) {
    laSlice = cleanText.slice(Math.max(0, lgIdx - 2500), lgIdx);
  }

  let lgSlice = '';
  if (lgIdx !== -1) {
    const afterLg = cleanText.slice(lgIdx);
    const nextSectionMatch = afterLg.slice('resultados la granjita'.length).search(/\bResultados\s+[A-Za-z]/i);
    lgSlice = nextSectionMatch !== -1
      ? afterLg.slice(0, 'resultados la granjita'.length + nextSectionMatch)
      : afterLg.slice(0, 2500);
  }

  return {
    laPairs: parseSliceMatches(laSlice),
    lgPairs: parseSliceMatches(lgSlice)
  };
}

async function run() {
  const docRef = db.doc('ojo_horus_radar/live_draws');
  const snap = await docRef.get();
  const todayStamp = getVenezuelaDateStamp();

  const emptyDrawState = (key, title, icon, accent) => ({
    key,
    title,
    icon,
    accent,
    dateStamp: todayStamp,
    lastHour: '',
    nextHour: DRAW_HOURS[0],
    lastNum: '0',
    drawId: `${todayStamp}_${DRAW_HOURS[0]}`,
    history: [],
    hits: []
  });

  const existingData = snap.exists ? snap.data() : {};
  const isNewDayLA = existingData.lotto_activo?.dateStamp !== todayStamp;
  const isNewDayLG = existingData.la_granjita?.dateStamp !== todayStamp;

  const currentData = {
    lotto_activo: isNewDayLA
      ? emptyDrawState('lotto_activo', 'LOTTO ACTIVO', '🦁', 'amber')
      : existingData.lotto_activo,
    la_granjita: isNewDayLG
      ? emptyDrawState('la_granjita', 'LA GRANJITA', '🐔', 'emerald')
      : existingData.la_granjita
  };

  let changed = Boolean(isNewDayLA || isNewDayLG);
  if (changed) {
    console.log(`Nuevo día detectado (${todayStamp}). Reiniciando sorteos y aciertos para la nueva jornada.`);
  }

  const url = 'https://lotoven.com/animalitos/';
  console.log('Consultando resultados oficiales en LotoVen...');
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const { laPairs, lgPairs } = parseResultsFromHtml(html);

  const veNow = getVenezuelaDateParts().dateObj;
  const isBeforeFirstDraw = veNow.getHours() < 8;

  if (!isBeforeFirstDraw && laPairs.length > 0) {
    const mergedLa = sortHistoryChronologically([...(currentData.lotto_activo.history || []), ...laPairs]);
    const latest = mergedLa[mergedLa.length - 1];
    if (latest.hour !== currentData.lotto_activo.lastHour || latest.num !== currentData.lotto_activo.lastNum) {
      const nextHour = getNextHourLabel(latest.hour);
      currentData.lotto_activo = {
        ...currentData.lotto_activo,
        dateStamp: todayStamp,
        lastHour: latest.hour,
        nextHour,
        lastNum: latest.num,
        drawId: `${todayStamp}_${nextHour}`,
        history: mergedLa
      };
      recomputeAndSyncHits(currentData.lotto_activo, todayStamp);
      changed = true;
      console.log(`Actualizado Lotto Activo: ${latest.hour} -> #${latest.num} (Aciertos: ${currentData.lotto_activo.hits.length})`);
    }
  }

  if (!isBeforeFirstDraw && lgPairs.length > 0) {
    const mergedLg = sortHistoryChronologically([...(currentData.la_granjita.history || []), ...lgPairs]);
    const latest = mergedLg[mergedLg.length - 1];
    if (latest.hour !== currentData.la_granjita.lastHour || latest.num !== currentData.la_granjita.lastNum) {
      const nextHour = getNextHourLabel(latest.hour);
      currentData.la_granjita = {
        ...currentData.la_granjita,
        dateStamp: todayStamp,
        lastHour: latest.hour,
        nextHour,
        lastNum: latest.num,
        drawId: `${todayStamp}_${nextHour}`,
        history: mergedLg
      };
      recomputeAndSyncHits(currentData.la_granjita, todayStamp);
      changed = true;
      console.log(`Actualizado La Granjita: ${latest.hour} -> #${latest.num} (Aciertos: ${currentData.la_granjita.hits.length})`);
    }
  }

  if (changed) {
    await docRef.set({
      ...currentData,
      dateStamp: todayStamp,
      updatedAt: new Date().toISOString()
    });
    console.log('Firestore actualizado correctamente.');
  } else {
    console.log('Sin cambios respecto a Firestore.');
  }
}

run().catch((err) => {
  console.error('Error en sincronización:', err);
  process.exit(1);
});
