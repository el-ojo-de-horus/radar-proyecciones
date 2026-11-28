const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const DRAW_HOURS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM'
];

const VALID_NUMS = new Set([
  '00', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36'
]);

function normalizeAnimalNum(numRaw) {
  const s = String(numRaw ?? '0').trim();
  if (s === '00') return '00';
  const val = parseInt(s, 10);
  if (!Number.isNaN(val) && val >= 0 && val <= 36) return String(val);
  return '0';
}

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

function getNextHourLabel(currentHour) {
  const norm = normalizeHourLabel(currentHour);
  const idx = DRAW_HOURS.indexOf(norm);
  if (idx === -1 || idx >= DRAW_HOURS.length - 1) return DRAW_HOURS[0];
  return DRAW_HOURS[idx + 1];
}

function sortHistoryChronologically(historyList = []) {
  const mapByHour = new Map();
  (historyList || []).forEach(entry => {
    if (!entry || !entry.hour || entry.num === undefined) return;
    const normHour = normalizeHourLabel(entry.hour);
    mapByHour.set(normHour, {
      hour: normHour,
      num: normalizeAnimalNum(entry.num),
      isHit: Boolean(entry.isHit),
      hitType: entry.hitType || null
    });
  });
  return Array.from(mapByHour.values()).sort(
    (a, b) => getHourOrderIndex(a.hour) - getHourOrderIndex(b.hour)
  );
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
      const normalizedHour = normalizeHourLabel(match[3]);

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

const SCHEDULED_NOTIFICATIONS = [
  {
    id: 'pre_1000',
    hour: 9,
    minute: 50,
    label: '10:00 AM',
    text: '⚠️ El resultado de las 10:00 AM está por salir. Las proyecciones de las 11:00 AM ya están listas en la App. Entra ahora y desbloquéala antes de que cambie el patrón.'
  },
  {
    id: 'pre_1300',
    hour: 12,
    minute: 50,
    label: '01:00 PM',
    text: '⚠️ El resultado de las 01:00 PM está por salir. Las proyecciones de las 02:00 PM ya están listas en la App. Entra ahora y desbloquéala antes de que cambie el patrón.'
  },
  {
    id: 'pre_1600',
    hour: 15,
    minute: 50,
    label: '04:00 PM',
    text: '⚠️ El resultado de las 04:00 PM está por salir. Las proyecciones de las 05:00 PM ya están listas en la App. Entra ahora y desbloquéala antes de que cambie el patrón.'
  },
  {
    id: 'pre_1900',
    hour: 18,
    minute: 50,
    label: '07:00 PM',
    text: '⚠️ El resultado de las 07:00 PM está por salir. Las proyecciones de cierre ya están listas en la App. Entra ahora y desbloquéala antes de que cambie el patrón.'
  }
];

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
  return await resp.json();
}

async function processScheduledTelegramAlerts(todayStamp, veNow) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log('TELEGRAM_BOT_TOKEN no configurado; omitiendo avisos a usuarios.');
    return;
  }

  const nowMinutes = veNow.getHours() * 60 + veNow.getMinutes();
  const notifStateRef = db.doc('ojo_horus_radar/telegram_notifications');
  const notifSnap = await notifStateRef.get();
  const sentToday = (notifSnap.exists && notifSnap.data()?.dateStamp === todayStamp)
    ? (notifSnap.data()?.sentIds || [])
    : [];

  const dueSlot = SCHEDULED_NOTIFICATIONS.find(slot => {
    if (sentToday.includes(slot.id)) return false;
    const slotMinutes = slot.hour * 60 + slot.minute;
    return nowMinutes >= slotMinutes && nowMinutes <= slotMinutes + 10;
  });

  if (!dueSlot) return;

  const subsSnap = await db.collection('ojo_horus_subscribers').where('active', '==', true).get();
  if (subsSnap.empty) {
    console.log('No hay usuarios suscritos activos todavía.');
    return;
  }

  const miniAppUrl = process.env.MINI_APP_URL || '';
  const fullMessage = miniAppUrl
    ? `👑 <b>EL OJO DE HORUS</b> 🔥\n\n${dueSlot.text}\n\n👉 <a href="${miniAppUrl}">Abrir Radar en Vivo</a>`
    : `👑 <b>EL OJO DE HORUS</b> 🔥\n\n${dueSlot.text}`;

  let delivered = 0;
  for (const userDoc of subsSnap.docs) {
    const sub = userDoc.data();
    if (!sub?.chatId) continue;
    try {
      const result = await sendTelegramMessage(botToken, sub.chatId, fullMessage);
      if (result.ok) {
        delivered += 1;
      } else if (result.error_code === 403) {
        await userDoc.ref.set({ active: false }, { merge: true });
      }
    } catch (e) {}
  }

  await notifStateRef.set({
    dateStamp: todayStamp,
    sentIds: [...sentToday, dueSlot.id],
    lastSentAt: new Date().toISOString(),
    lastDeliveredCount: delivered
  });
  console.log(`Aviso programado (${dueSlot.id}) enviado a ${delivered} usuarios.`);
}

async function run() {
  const docRef = db.doc('ojo_horus_radar/live_draws');
  const snap = await docRef.get();
  const { dateObj: veNow } = getVenezuelaDateParts();
  const todayStamp = getVenezuelaDateStamp();

  const existingData = snap.exists ? snap.data() : {};
  const isNewDayLA = existingData.lotto_activo?.dateStamp !== todayStamp;
  const isNewDayLG = existingData.la_granjita?.dateStamp !== todayStamp;

  let laHistory = isNewDayLA ? [] : sortHistoryChronologically(existingData.lotto_activo?.history || []);
  let lgHistory = isNewDayLG ? [] : sortHistoryChronologically(existingData.la_granjita?.history || []);

  let changed = Boolean(isNewDayLA || isNewDayLG);
  if (isNewDayLA || isNewDayLG) {
    console.log(`Nuevo día detectado (${todayStamp}). Reiniciando sorteos.`);
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
  const isBeforeFirstDraw = veNow.getHours() < 8;

  if (!isBeforeFirstDraw && laPairs.length > 0) {
    const mergedLa = sortHistoryChronologically([...laHistory, ...laPairs]);
    if (JSON.stringify(mergedLa.map(x => `${x.hour}:${x.num}`)) !== JSON.stringify(laHistory.map(x => `${x.hour}:${x.num}`))) {
      laHistory = mergedLa;
      changed = true;
    }
  }

  if (!isBeforeFirstDraw && lgPairs.length > 0) {
    const mergedLg = sortHistoryChronologically([...lgHistory, ...lgPairs]);
    if (JSON.stringify(mergedLg.map(x => `${x.hour}:${x.num}`)) !== JSON.stringify(lgHistory.map(x => `${x.hour}:${x.num}`))) {
      lgHistory = mergedLg;
      changed = true;
    }
  }

  if (changed) {
    const latestLA = laHistory.length > 0 ? laHistory[laHistory.length - 1] : null;
    const latestLG = lgHistory.length > 0 ? lgHistory[lgHistory.length - 1] : null;
    const nextHourLA = latestLA ? getNextHourLabel(latestLA.hour) : DRAW_HOURS[0];
    const nextHourLG = latestLG ? getNextHourLabel(latestLG.hour) : DRAW_HOURS[0];

    await docRef.set({
      lotto_activo: {
        key: 'lotto_activo',
        title: 'LOTTO ACTIVO',
        icon: '🦁',
        accent: 'amber',
        dateStamp: todayStamp,
        history: laHistory,
        lastHour: latestLA ? latestLA.hour : '',
        lastNum: latestLA ? latestLA.num : '0',
        nextHour: nextHourLA,
        drawId: `${todayStamp}_${nextHourLA}`
      },
      la_granjita: {
        key: 'la_granjita',
        title: 'LA GRANJITA',
        icon: '🐔',
        accent: 'emerald',
        dateStamp: todayStamp,
        history: lgHistory,
        lastHour: latestLG ? latestLG.hour : '',
        lastNum: latestLG ? latestLG.num : '0',
        nextHour: nextHourLG,
        drawId: `${todayStamp}_${nextHourLG}`
      },
      dateStamp: todayStamp,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`Resultados oficiales sincronizados -> LA: ${laHistory.length} | LG: ${lgHistory.length}`);
  } else {
    console.log('Sin cambios nuevos en resultados.');
  }

  await processScheduledTelegramAlerts(todayStamp, veNow);
}

run().catch((err) => {
  console.error('Error en sincronización:', err);
  process.exit(1);
});
