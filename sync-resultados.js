const admin = require('firebase-admin');

// 1. Inicializar Firebase Admin desde el Secret FIREBASE_SERVICE_ACCOUNT en GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. Catálogo Oficial (0 al 36)
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

  const hourRegex = /\b(0?[8-9]|1[0-2]):00\s*(AM|PM)\b/gi;

  function extractPairs(sectionName) {
    const idx = cleanText.toLowerCase().indexOf(sectionName.toLowerCase());
    if (idx === -1) return [];
    const slice = cleanText.slice(idx, idx + 1500);
    const matches = [...slice.matchAll(hourRegex)];
    const pairs = [];

    for (const m of matches) {
      const rawHour = m[0].toUpperCase().replace(/\s+/g, ' ').trim();
      const normalizedHour = rawHour.length === 7 ? `0${rawHour}` : rawHour;
      const pos = m.index || 0;
      const windowBefore = slice.slice(Math.max(0, pos - 30), pos);
      const numMatch = windowBefore.match(/\b(00|[0-9]|1[0-9]|2[0-9]|3[0-6])\b(?=\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s*$)/);
      if (numMatch && VALID_NUMS.has(numMatch[1])) {
        pairs.push({ hour: normalizedHour, num: numMatch[1] });
      }
    }
    return pairs;
  }

  return {
    laPairs: extractPairs('Lotto Activo'),
    lgPairs: extractPairs('La Granjita')
  };
}

async function run() {
  const url = 'https://www.loteriadehoy.com/animalitos/resultados/';
  console.log('Consultando resultados oficiales...');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OjoDeHorusBot/1.0)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const { laPairs, lgPairs } = parseResultsFromHtml(html);
  if (!laPairs.length && !lgPairs.length) {
    console.log('No se detectaron nuevos bloques horarios aún.');
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
      lastHour: '08:00 AM',
      nextHour: '09:00 AM',
      lastNum: '12',
      drawId: `${todayStamp}_09:00 AM`,
      history: []
    },
    la_granjita: {
      key: 'la_granjita',
      title: 'LA GRANJITA',
      icon: '🐔',
      accent: 'emerald',
      lastHour: '08:00 AM',
      nextHour: '09:00 AM',
      lastNum: '35',
      drawId: `${todayStamp}_09:00 AM`,
      history: []
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
