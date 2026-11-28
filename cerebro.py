import os
import json
import datetime
from collections import Counter
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred_env = os.environ.get("FIREBASE_CREDENTIALS") or os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if cred_env:
        cred = credentials.Certificate(json.loads(cred_env))
    elif os.path.exists("firebase-credentials.json"):
        cred = credentials.Certificate("firebase-credentials.json")
    else:
        raise RuntimeError("No se encontraron credenciales de Firebase.")
    firebase_admin.initialize_app(cred)

db = firestore.client()

VZLA_TZ = datetime.timezone(datetime.timedelta(hours=-4))
COLECCION_RESULTADOS = "resultados_diarios"
DOC_RADAR_VIVO = "ojo_horus_radar/live_draws"

HORAS_ORDENADAS = [
    "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
    "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
    "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"
]

CATALOGO_COMPLETO = {
    "00": {"code": "00", "name": "BALLENA",   "emoji": "🐳", "sector": "Agua"},
    "0":  {"code": "0",  "name": "DELFÍN",    "emoji": "🐬", "sector": "Agua"},
    "1":  {"code": "01", "name": "CARNERO",   "emoji": "🐏", "sector": "Tierra"},
    "2":  {"code": "02", "name": "TORO",      "emoji": "🐃", "sector": "Tierra"},
    "3":  {"code": "03", "name": "CIEMPIÉS",  "emoji": "🐛", "sector": "Tierra"},
    "4":  {"code": "04", "name": "ALACRÁN",   "emoji": "🦂", "sector": "Tierra"},
    "5":  {"code": "05", "name": "LEÓN",      "emoji": "🦁", "sector": "Selva"},
    "6":  {"code": "06", "name": "RANA",      "emoji": "🐸", "sector": "Agua"},
    "7":  {"code": "07", "name": "PERICO",    "emoji": "🦜", "sector": "Aire"},
    "8":  {"code": "08", "name": "RATÓN",     "emoji": "🐭", "sector": "Tierra"},
    "9":  {"code": "09", "name": "ÁGUILA",    "emoji": "🦅", "sector": "Aire"},
    "10": {"code": "10", "name": "TIGRE",     "emoji": "🐯", "sector": "Selva"},
    "11": {"code": "11", "name": "GATO",      "emoji": "🐱", "sector": "Doméstico"},
    "12": {"code": "12", "name": "CABALLO",   "emoji": "🐎", "sector": "Granja"},
    "13": {"code": "13", "name": "MONO",      "emoji": "🐵", "sector": "Selva"},
    "14": {"code": "14", "name": "PALOMA",    "emoji": "🕊", "sector": "Aire"},
    "15": {"code": "15", "name": "ZORRO",     "emoji": "🦊", "sector": "Selva"},
    "16": {"code": "16", "name": "OSO",       "emoji": "🐻", "sector": "Selva"},
    "17": {"code": "17", "name": "PAVO",      "emoji": "🦃", "sector": "Granja"},
    "18": {"code": "18", "name": "BURRO",     "emoji": "🐴", "sector": "Granja"},
    "19": {"code": "19", "name": "CHIVO",     "emoji": "🐐", "sector": "Granja"},
    "20": {"code": "20", "name": "COCHINO",   "emoji": "🐷", "sector": "Granja"},
    "21": {"code": "21", "name": "GALLO",     "emoji": "🐓", "sector": "Granja"},
    "22": {"code": "22", "name": "CAMELLO",   "emoji": "🐪", "sector": "Tierra"},
    "23": {"code": "23", "name": "CEBRA",     "emoji": "🦓", "sector": "Selva"},
    "24": {"code": "24", "name": "IGUANA",    "emoji": "🦎", "sector": "Tierra"},
    "25": {"code": "25", "name": "GALLINA",   "emoji": "🐔", "sector": "Granja"},
    "26": {"code": "26", "name": "VACA",      "emoji": "🐮", "sector": "Granja"},
    "27": {"code": "27", "name": "PERRO",     "emoji": "🐶", "sector": "Doméstico"},
    "28": {"code": "28", "name": "ZAMURO",    "emoji": "⬛️", "sector": "Aire"},
    "29": {"code": "29", "name": "ELEFANTE",  "emoji": "🐘", "sector": "Selva"},
    "30": {"code": "30", "name": "CAIMÁN",    "emoji": "🐊", "sector": "Agua"},
    "31": {"code": "31", "name": "LAPA",      "emoji": "🦦", "sector": "Selva"},
    "32": {"code": "32", "name": "ARDILLA",   "emoji": "🐿", "sector": "Selva"},
    "33": {"code": "33", "name": "PESCADO",   "emoji": "🐟", "sector": "Agua"},
    "34": {"code": "34", "name": "VENADO",    "emoji": "🦌", "sector": "Selva"},
    "35": {"code": "35", "name": "JIRAFA",    "emoji": "🦒", "sector": "Selva"},
    "36": {"code": "36", "name": "CULEBRA",   "emoji": "🐍", "sector": "Tierra"},
}

TABLA_JALE = {
    "0":  {"jala": ["00", "33", "30"], "familia": "Trinidad del Agua"},
    "00": {"jala": ["0", "33", "29"],  "familia": "Los Gigantes del Agua"},
    "1":  {"jala": ["2", "26", "19"],  "familia": "Familia de Cuernos"},
    "2":  {"jala": ["1", "26", "5"],   "familia": "Ganadería y Fuerza"},
    "3":  {"jala": ["4", "36", "24"],  "familia": "Rastreros y Reptiles"},
    "4":  {"jala": ["3", "36", "1"],   "familia": "Suelo y Venenosos"},
    "5":  {"jala": ["10", "11", "13"], "familia": "Jerarquía de Felinos"},
    "6":  {"jala": ["35", "7", "33"],  "familia": "Humedales y Salto"},
    "7":  {"jala": ["9", "35", "25"],  "familia": "Aves y Colores"},
    "8":  {"jala": ["13", "32", "11"], "familia": "Roedores y Agilidad"},
    "9":  {"jala": ["7", "35", "28"],  "familia": "Las Rapaces"},
    "10": {"jala": ["5", "11", "20"],  "familia": "Felinos Salvajes"},
    "11": {"jala": ["5", "10", "27"],  "familia": "Felinos Domésticos"},
    "12": {"jala": ["18", "22", "23"], "familia": "Animales de Casco"},
    "13": {"jala": ["8", "32", "5"],   "familia": "Agilidad y Monte"},
    "14": {"jala": ["15", "17", "35"], "familia": "Aves de Tierra"},
    "15": {"jala": ["31", "34", "16"], "familia": "Astucia y Monte"},
    "16": {"jala": ["29", "15", "22"], "familia": "Pelaje y Fuerza"},
    "17": {"jala": ["14", "25", "35"], "familia": "Aves Grandes"},
    "18": {"jala": ["12", "22", "19"], "familia": "Animales de Carga"},
    "19": {"jala": ["1", "18", "34"],  "familia": "Animales de Pezuña"},
    "20": {"jala": ["26", "21", "00"], "familia": "Granja y Pesados"},
    "21": {"jala": ["25", "17", "7"],  "familia": "Aves de Corral"},
    "22": {"jala": ["18", "29", "12"], "familia": "Animales de Sabana"},
    "23": {"jala": ["12", "10", "22"], "familia": "Rayados y Casco"},
    "24": {"jala": ["36", "3", "4"],   "familia": "Reptiles de Sangre Fría"},
    "25": {"jala": ["21", "17", "14"], "familia": "Aves de Corral"},
    "26": {"jala": ["2", "20", "1"],   "familia": "Ganadería"},
    "27": {"jala": ["11", "15", "8"],  "familia": "Domésticos"},
    "28": {"jala": ["9", "35", "33"],  "familia": "Carroñeros y Aire"},
    "29": {"jala": ["16", "22", "00"], "familia": "Pesados y Sabana"},
    "30": {"jala": ["36", "0", "33"],  "familia": "Depredadores de Agua"},
    "31": {"jala": ["34", "15", "32"], "familia": "Animales de Cueva"},
    "32": {"jala": ["13", "31", "8"],  "familia": "Trepadores y Salto"},
    "33": {"jala": ["0", "00", "30"],  "familia": "El Cardumen"},
    "34": {"jala": ["31", "15", "1"],  "familia": "Monte y Salto"},
    "35": {"jala": ["7", "9", "14"],   "familia": "Aves en general"},
    "36": {"jala": ["30", "3", "24"],  "familia": "Rastreros Largos"},
}

ORDEN_CLAVES_ANIMALITOS = [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
    "31", "32", "33", "34", "35", "36", "0", "00"
]


def fecha_vzla() -> datetime.date:
    return datetime.datetime.now(VZLA_TZ).date()


def normalizar_clave_animal(num_raw) -> str:
    s = str(num_raw if num_raw is not None else "0").strip()
    if s == "00":
        return "00"
    if s.isdigit():
        val = int(s)
        if 0 <= val <= 36:
            return str(val)
    return "0"


def normalizar_hora(hora_raw: str) -> str:
    if not hora_raw:
        return ""
    limpia = " ".join(str(hora_raw).upper().split())
    partes = limpia.split(" ")
    if len(partes) == 2 and ":" in partes[0]:
        hh, mm = partes[0].split(":", 1)
        return f"{hh.zfill(2)}:{mm} {partes[1]}"
    return limpia


def indice_hora(hora_raw: str) -> int:
    norm = normalizar_hora(hora_raw)
    return HORAS_ORDENADAS.index(norm) if norm in HORAS_ORDENADAS else 999


def siguiente_hora(hora_actual: str) -> str:
    norm = normalizar_hora(hora_actual)
    if norm not in HORAS_ORDENADAS:
        return HORAS_ORDENADAS[0]
    idx = HORAS_ORDENADAS.index(norm)
    return HORAS_ORDENADAS[0] if idx >= len(HORAS_ORDENADAS) - 1 else HORAS_ORDENADAS[idx + 1]


def obtener_ficha_animal(num_raw) -> dict:
    clave = normalizar_clave_animal(num_raw)
    base = CATALOGO_COMPLETO.get(clave, CATALOGO_COMPLETO["0"])
    familia = TABLA_JALE.get(clave, {}).get("familia", base["sector"])
    return {
        "num": clave,
        "code": base["code"],
        "name": base["name"],
        "emoji": base["emoji"],
        "sector": base["sector"],
        "familia": familia,
    }


def ordenar_historial(historial: list) -> list:
    por_hora = {}
    for entry in (historial or []):
        if not isinstance(entry, dict) or not entry.get("hour") or entry.get("num") is None:
            continue
        h_norm = normalizar_hora(entry["hour"])
        por_hora[h_norm] = {
            "hour": h_norm,
            "num": normalizar_clave_animal(entry["num"]),
            "isHit": bool(entry.get("isHit", False)),
            "hitType": entry.get("hitType"),
        }
    return sorted(por_hora.values(), key=lambda x: indice_hora(x["hour"]))


def calcular_piramide(fecha: datetime.date):
    fila = [int(c) for c in fecha.strftime("%d%m%Y")]
    bases = (0, 0)
    while len(fila) > 1:
        fila = [(fila[i] + fila[i + 1]) % 10 for i in range(len(fila) - 1)]
        if len(fila) == 2:
            bases = (fila[0], fila[1])
    return fila[0], bases


def obtener_historico_reciente(fecha_base: datetime.date, dias: int = 7) -> Counter:
    apariciones = Counter()
    for i in range(1, dias + 1):
        fecha_str = (fecha_base - datetime.timedelta(days=i)).isoformat()
        doc = db.collection(COLECCION_RESULTADOS).document(fecha_str).get()
        if doc.exists:
            data = doc.to_dict() or {}
            for op in ("lotto_activo", "la_granjita"):
                bloque = data.get(op)
                if isinstance(bloque, dict):
                    for _, entry in bloque.items():
                        if isinstance(entry, dict) and entry.get("numero") is not None:
                            apariciones[normalizar_clave_animal(entry["numero"])] += 1
    return apariciones


def guardar_resultados_diarios(hoy_str: str, hist_la: list, hist_lg: list):
    def mapear_bloque(lista):
        salida = {}
        for item in lista:
            ficha = obtener_ficha_animal(item["num"])
            salida[item["hour"]] = {
                "numero": ficha["num"],
                "animal": ficha["name"],
                "familia": ficha["familia"],
            }
        return salida

    db.collection(COLECCION_RESULTADOS).document(hoy_str).set({
        "fecha": hoy_str,
        "lotto_activo": mapear_bloque(hist_la),
        "la_granjita": mapear_bloque(hist_lg),
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }, merge=True)


def analizar_cinta_cruzada(hist_la: list, hist_lg: list):
    todos = []
    for item in hist_la:
        todos.append(normalizar_clave_animal(item["num"]))
    for item in hist_lg:
        todos.append(normalizar_clave_animal(item["num"]))

    conteo_term = Counter([int(n[-1]) for n in todos if n and n[-1].isdigit()])
    saturadas = [t for t, c in conteo_term.items() if c >= 3]

    jale_impulso = Counter()
    total_len = max(1, len(todos))
    for idx, clave in enumerate(todos):
        factor_reciente = 1.0 + (idx / total_len) * 0.8
        info_jale = TABLA_JALE.get(clave)
        if info_jale:
            for idx_j, jalado in enumerate(info_jale["jala"]):
                clave_j = normalizar_clave_animal(jalado)
                if clave_j in CATALOGO_COMPLETO:
                    jale_impulso[clave_j] += (3.2 - idx_j * 0.65) * factor_reciente

    triangulaciones = []
    if "12" in todos and "18" in todos:
        triangulaciones.append("23")
    if "0" in todos and "33" in todos:
        triangulaciones.append("00")
    if "11" in todos and "27" in todos:
        triangulaciones.append("5")
    if "5" in todos and "10" in todos:
        triangulaciones.append("25")
    if "2" in todos and "26" in todos:
        triangulaciones.append("12")

    jales_ordenados = [c for c, _ in jale_impulso.most_common()]
    for cand_j in jales_ordenados[:4]:
        if cand_j not in triangulaciones:
            triangulaciones.append(cand_j)

    return saturadas, triangulaciones, jales_ordenados, jale_impulso, conteo_term


def calcular_top_3_hora(
    sorteo_key: str,
    next_hour: str,
    own_history: list,
    other_history: list,
    historico_7d: Counter,
    fecha_hoy: datetime.date,
) -> dict:
    sorted_own = ordenar_historial(own_history)
    last_entry = sorted_own[-1] if sorted_own else None
    last_num = last_entry["num"] if last_entry else "0"
    last_animal = obtener_ficha_animal(last_num)

    hist_la = sorted_own if sorteo_key == "lotto_activo" else ordenar_historial(other_history)
    hist_lg = sorted_own if sorteo_key == "la_granjita" else ordenar_historial(other_history)

    vertice, bases = calcular_piramide(fecha_hoy)
    saturadas, triangulaciones, jales_ordenados, jale_impulso, conteo_term = analizar_cinta_cruzada(hist_la, hist_lg)

    jale_directo_ultimo = TABLA_JALE.get(last_num, {}).get("jala", []) if last_entry else []
    terminales_opuestos = {(t + 5) % 10 for t in saturadas}
    if not terminales_opuestos:
        terminales_opuestos.add((vertice + 5) % 10)

    recientes_propios = {h["num"] for h in sorted_own[-2:]} if last_entry else set()
    hour_idx = HORAS_ORDENADAS.index(normalizar_hora(next_hour)) if normalizar_hora(next_hour) in HORAS_ORDENADAS else 0
    sorteo_bias = 0.15 if sorteo_key == "lotto_activo" else -0.15

    candidatos = []
    for clave in ORDEN_CLAVES_ANIMALITOS:
        if last_entry and clave in recientes_propios:
            continue

        term = int(clave[-1])
        puntaje = 0.0

        if clave in jale_directo_ultimo:
            idx_dir = jale_directo_ultimo.index(clave)
            puntaje += (4.2 - idx_dir * 0.8)

        puntaje += min(4.5, jale_impulso.get(clave, 0.0) * 0.55)

        if clave in triangulaciones:
            puntaje += 3.0

        if term == vertice:
            puntaje += 3.2
        if term in bases:
            puntaje += 2.2

        if term in terminales_opuestos:
            puntaje += 2.1

        salidas_hoy = sum(1 for h in sorted_own if h["num"] == clave)
        puntaje -= salidas_hoy * 2.4
        puntaje -= conteo_term.get(term, 0) * 0.35
        puntaje -= historico_7d.get(clave, 0) * 0.45

        val_num = 37 if clave == "00" else int(clave)
        puntaje += ((val_num + hour_idx) % 7) * 0.04 + sorteo_bias

        candidatos.append((puntaje, clave))

    candidatos.sort(key=lambda item: (-item[0], ORDEN_CLAVES_ANIMALITOS.index(item[1])))

    top_3 = [obtener_ficha_animal(clave) for _, clave in candidatos[:3]]
    while len(top_3) < 3:
        top_3.append(obtener_ficha_animal(ORDEN_CLAVES_ANIMALITOS[len(top_3)]))

    primary, backup1, backup2 = top_3[0], top_3[1], top_3[2]

    nombre_ruleta = "Lotto Activo" if sorteo_key == "lotto_activo" else "La Granjita"
    if saturadas:
        sat_txt = f"saturación en terminal {', '.join(map(str, saturadas))} con ruptura hacia opuesto ({', '.join(map(str, sorted(terminales_opuestos)))})"
    else:
        sat_txt = f"eje matricial activo (vértice {vertice} / bases {bases[0]}-{bases[1]})"

    if last_entry:
        reason = (
            f"Tras salir {last_animal['num']} {last_animal['name']} ({last_animal['familia']}) en {nombre_ruleta}, "
            f"el cerebro detecta {sat_txt} e impulso de jale hacia {primary['num']} {primary['name']} ({primary['familia']}) para las {next_hour}."
        )
    else:
        reason = (
            f"Apertura de jornada ({next_hour}): convergencia matricial en vértice {vertice} y memoria histórica de 7 días "
            f"proyectan a {primary['num']} {primary['name']} ({primary['familia']})."
        )

    return {
        "primary": primary,
        "backups": [backup1, backup2],
        "reason": reason,
        "metrics": {
            "vertice": vertice,
            "bases": list(bases),
            "saturatedTerminals": saturadas,
            "oppositeTerminals": sorted(terminales_opuestos),
            "topJales": jales_ordenados[:5],
        },
    }


def evaluar_jornada_con_cerebro(
    sorteo_key: str,
    today_stamp: str,
    own_history: list,
    other_history: list,
    historico_7d: Counter,
    fecha_hoy: datetime.date,
) -> dict:
    sorted_own = ordenar_historial(own_history)
    sorted_other = ordenar_historial(other_history)
    hits = []

    for i in range(1, len(sorted_own)):
        curr = sorted_own[i]
        own_before = sorted_own[:i]
        curr_idx = indice_hora(curr["hour"])
        other_before = [o for o in sorted_other if indice_hora(o["hour"]) <= curr_idx]

        proj = calcular_top_3_hora(
            sorteo_key=sorteo_key,
            next_hour=curr["hour"],
            own_history=own_before,
            other_history=other_before,
            historico_7d=historico_7d,
            fecha_hoy=fecha_hoy,
        )

        hit_type = None
        if proj["primary"]["num"] == curr["num"]:
            hit_type = "PRINCIPAL"
        else:
            for b_idx, b in enumerate(proj["backups"]):
                if b["num"] == curr["num"]:
                    hit_type = f"RESPALDO #{b_idx + 1}"
                    break

        if hit_type:
            curr["isHit"] = True
            curr["hitType"] = hit_type
            ficha = obtener_ficha_animal(curr["num"])
            hits.append({
                "id": f"{today_stamp}_{curr['hour']}_{curr['num']}",
                "hour": curr["hour"],
                "num": ficha["num"],
                "name": ficha["name"],
                "emoji": ficha["emoji"],
                "type": hit_type,
            })
        else:
            curr["isHit"] = False
            curr["hitType"] = None

    latest = sorted_own[-1] if sorted_own else None
    next_hour = siguiente_hora(latest["hour"]) if latest else HORAS_ORDENADAS[0]

    active_projection = calcular_top_3_hora(
        sorteo_key=sorteo_key,
        next_hour=next_hour,
        own_history=sorted_own,
        other_history=sorted_other,
        historico_7d=historico_7d,
        fecha_hoy=fecha_hoy,
    )

    return {
        "history": sorted_own,
        "hits": list(reversed(hits))[:12],
        "lastHour": latest["hour"] if latest else "",
        "lastNum": latest["num"] if latest else "0",
        "nextHour": next_hour,
        "drawId": f"{today_stamp}_{next_hour}",
        "projection": active_projection,
    }


def ejecutar_cerebro_horario():
    hoy = fecha_vzla()
    hoy_str = hoy.isoformat()

    doc_ref = db.document(DOC_RADAR_VIVO)
    snap = doc_ref.get()
    data = snap.to_dict() if snap.exists else {}

    la_raw = data.get("lotto_activo", {}) if data.get("lotto_activo", {}).get("dateStamp") == hoy_str else {}
    lg_raw = data.get("la_granjita", {}) if data.get("la_granjita", {}).get("dateStamp") == hoy_str else {}

    hist_la = ordenar_historial(la_raw.get("history", []))
    hist_lg = ordenar_historial(lg_raw.get("history", []))

    historico_7d = obtener_historico_reciente(hoy, dias=7)

    eval_la = evaluar_jornada_con_cerebro(
        sorteo_key="lotto_activo",
        today_stamp=hoy_str,
        own_history=hist_la,
        other_history=hist_lg,
        historico_7d=historico_7d,
        fecha_hoy=hoy,
    )

    eval_lg = evaluar_jornada_con_cerebro(
        sorteo_key="la_granjita",
        today_stamp=hoy_str,
        own_history=hist_lg,
        other_history=hist_la,
        historico_7d=historico_7d,
        fecha_hoy=hoy,
    )

    guardar_resultados_diarios(hoy_str, eval_la["history"], eval_lg["history"])

    doc_ref.set({
        "lotto_activo": {
            "key": "lotto_activo",
            "title": "LOTTO ACTIVO",
            "icon": "🦁",
            "accent": "amber",
            "dateStamp": hoy_str,
            **eval_la,
        },
        "la_granjita": {
            "key": "la_granjita",
            "title": "LA GRANJITA",
            "icon": "🐔",
            "accent": "emerald",
            "dateStamp": hoy_str,
            **eval_lg,
        },
        "dateStamp": hoy_str,
        "brainEngine": "cerebro-python-v1",
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }, merge=True)

    p_la = eval_la["projection"]["primary"]
    p_lg = eval_lg["projection"]["primary"]
    print(f"Cerebro ejecutado ({hoy_str}): LA({eval_la['nextHour']}) #{p_la['num']} {p_la['name']} | LG({eval_lg['nextHour']}) #{p_lg['num']} {p_lg['name']}")


if __name__ == "__main__":
    ejecutar_cerebro_horario()
