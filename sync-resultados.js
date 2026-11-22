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

function normalizeAnimalNum(numStr) {
  const raw = String(numStr ?? '0').trim();
  if (raw === '00') return '00';
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? '0' : String(parsed);
}

function getNextHourLabel(currentHour) {
  const idx = DRAW_HOURS.indexOf(currentHour);
  if (idx === -1 || idx >= DRAW_HOURS.length - 1) return DRAW_HOURS[0];
  return DRAW_HOURS[idx + 1];
}

function getVenezuelaDateStamp() {
  const now = new Date();
  const veTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  const y = veTime.getFullYear();
  const m = String(veTime.getMonth() + 1).padStart(2, '0');
  const d = String(veTime.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

  // Bloque Lotto Activo: desde 'resultados lotto activo' (o inicio de tabla) hasta justo antes de 'resultados la granjita'
  let laSlice = '';
  const laStart = lowerText.indexOf('resultados lotto activo');
  if (laStart !== -1) {
    laSlice = lgIdx > laStart ? cleanText.slice(laStart, lgIdx) : cleanText.slice(laStart, laStart + 2500);
  } else if (lgIdx !== -1) {
    laSlice = cleanText.slice(Math.max(0, lgIdx - 2500), lgIdx);
  }

  // Bloque La Granjita: desde 'resultados la granjita' hasta el siguiente título 'Resultados ...'
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
  if (!laPairs.length && !lgPairs.length) {
    console.log('No se detectaron bloques horarios disponibles aún.');
    return;
  }

  const docRef = db.doc('ojo_horus_radar/live_draws');
  const snap = await docRef.get();
  const todayStamp = getVenezuelaDateStamp();

  const currentData = snap.exists ? snap.data() : {
    lotto_activo: {
      key: 'lotto_activo',
      title: 'LOTTO ACTIVO',
      icon: '🦁',
      accent: 'amber',
      lastHour: '',
      nextHour: DRAW_HOURS[0],
      lastNum: '0',
      drawId: `${todayStamp}_${DRAW_HOURS[0]}`,
      history: [],
      hits: []
    },
    la_granjita: {
      key: 'la_granjita',
      title: 'LA GRANJITA',
      icon: '🐔',
      accent: 'emerald',
      lastHour: '',
      nextHour: DRAW_HOURS[0],
      lastNum: '0',
      drawId: `${todayStamp}_${DRAW_HOURS[0]}`,
      history: [],
      hits: []
    }
  };

  let changed = false;

  if (laPairs.length > 0) {
    const latest = laPairs[laPairs.length - 1];
    if (latest.hour !== currentData.lotto_activo.lastHour || latest.num !== currentData.lotto_activo.lastNum) {
      const nextHour = getNextHourLabel(latest.hour);
      currentData.lotto_activo = {
        ...currentData.lotto_activo,
        lastHour: latest.hour,
        nextHour,
        lastNum: latest.num,
        drawId: `${todayStamp}_${nextHour}`,
        history: laPairs.slice(-6)
      };
      changed = true;
      console.log(`Actualizado Lotto Activo: ${latest.hour} -> #${latest.num}`);
    }
  }

  if (lgPairs.length > 0) {
    const latest = lgPairs[lgPairs.length - 1];
    if (latest.hour !== currentData.la_granjita.lastHour || latest.num !== currentData.la_granjita.lastNum) {
      const nextHour = getNextHourLabel(latest.hour);
      currentData.la_granjita = {
        ...currentData.la_granjita,
        lastHour: latest.hour,
        nextHour,
        lastNum: latest.num,
        drawId: `${todayStamp}_${nextHour}`,
        history: lgPairs.slice(-6)
      };
      changed = true;
      console.log(`Actualizado La Granjita: ${latest.hour} -> #${latest.num}`);
    }
  }

  if (changed) {
    await docRef.set({
      ...currentData,
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
