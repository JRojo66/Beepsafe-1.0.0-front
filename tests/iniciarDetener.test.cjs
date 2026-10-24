// Tests del front estático para pages/iniciarDetener.html + JS/iniciarDetener.js
//
// El repo no tiene build ni runner de tests (REL-005): este script corre con
// Node puro, sin dependencias:
//
//     node tests/iniciarDetener.test.cjs
//
// Carga el script clásico en un contexto vm con stubs de DOM/fetch/localStorage
// y reloj controlable, y ejerce funciones puras + comportamiento de la UI de
// los desplegables custom (triggers, paneles y stepper de Tiempo).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUTA_SCRIPT = path.join(__dirname, '..', 'JS', 'iniciarDetener.js');
const FUENTE = fs.readFileSync(RUTA_SCRIPT, 'utf8');
const EXPORTS = `;globalThis.__test = {
  formatearTiempo, tiempoValido, imagenParaActividad, normalizarNombre,
  resumenTiempoCorto, IMAGENES_POR_DEFECTO, IMAGEN_POR_ACTIVIDAD,
  CLAVE_ULTIMA_SESION, CLAVE_SESION_EN_CURSO,
  cerrarPaneles, manejarPasoTiempo,
  manejarSeleccionActividad, manejarSeleccionEquipo1, manejarSeleccionEquipo2,
  manejarClickTriggerActividad, manejarClickTriggerEquipo1,
  manejarClickTriggerEquipo2, manejarClickTriggerTiempo,
  TEXTO_SIN_ACTIVIDADES, TEXTO_ERROR_ACTIVIDADES,
  get cargaCompleta() { return cargaCompleta; },
  get cargaActividadesFallida() { return cargaActividadesFallida; },
};`;

let pasados = 0;
let total = 0;

function test(nombre, fn) {
  total += 1;
  try {
    fn();
    pasados += 1;
    console.log(`  ok ${total} - ${nombre}`);
  } catch (err) {
    console.error(`  FAIL ${total} - ${nombre}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function testAsync(nombre, fn) {
  total += 1;
  try {
    await fn();
    pasados += 1;
    console.log(`  ok ${total} - ${nombre}`);
  } catch (err) {
    console.error(`  FAIL ${total} - ${nombre}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------- DOM stubs

function crearNodo(extra = {}) {
  const nodo = {
    textContent: '',
    disabled: false,
    type: '',
    className: '',
    tagName: 'DIV',
    style: {},
    listeners: {},
    hijos: [],
    atributos: { 'aria-expanded': 'false' },
    _html: '',
    addEventListener(tipo, fn) {
      (this.listeners[tipo] ||= []).push(fn);
    },
    appendChild(hijo) {
      this.hijos.push(hijo);
      return hijo;
    },
    disparar(tipo, evento) {
      for (const fn of this.listeners[tipo] || []) fn(evento);
    },
    setAttribute(nombre, valor) {
      this.atributos[nombre] = String(valor);
    },
    getAttribute(nombre) {
      return Object.prototype.hasOwnProperty.call(this.atributos, nombre)
        ? this.atributos[nombre]
        : null;
    },
    get innerHTML() {
      return this._html;
    },
    set innerHTML(valor) {
      this._html = String(valor);
      if (this._html === '') this.hijos = [];
    },
  };
  const clases = new Set();
  nodo.classList = {
    add: (...cs) => cs.forEach((c) => clases.add(c)),
    remove: (...cs) => cs.forEach((c) => clases.delete(c)),
    contains: (c) => clases.has(c),
  };
  return Object.assign(nodo, extra);
}

// ------------------------------------------------------------- construcción

function crearContexto(opciones = {}) {
  const reloj = { ahora: opciones.ahora ?? 1_700_000_000_000 };
  function FechaFalsa() {}
  FechaFalsa.now = () => reloj.ahora;

  const timers = new Map();
  let proximoTimerId = 0;

  // store compartible: `opciones.store` permite que dos contextos simulen
  // "recargar la página" sobre el mismo localStorage (REL-105 / test 11)
  const store = opciones.store || new Map();
  const localStorage = {
    getItem: (clave) => (store.has(clave) ? store.get(clave) : null),
    setItem: (clave, valor) => {
      store.set(String(clave), String(valor));
    },
    removeItem: (clave) => {
      store.delete(clave);
    },
    // length/key reales: los requiere la reconciliación de variantes de clave
    // cuando no hay email conocido (RES-004)
    get length() {
      return store.size;
    },
    key: (indice) => [...store.keys()][indice] ?? null,
  };

  const nodos = {
    triggerActividad: crearNodo({ textContent: 'Actividad' }),
    filaValorActividad: crearNodo({ textContent: 'Sin actividad' }),
    panelActividad: crearNodo(),
    listaActividad: crearNodo({ tagName: 'UL' }),
    triggerEquipo1: crearNodo({ textContent: 'Equipo 1' }),
    filaValorEquipo1: crearNodo({ textContent: 'Sin equipo' }),
    panelEquipo1: crearNodo(),
    listaEquipo1: crearNodo({ tagName: 'UL' }),
    triggerEquipo2: crearNodo({ textContent: 'Equipo 2' }),
    filaValorEquipo2: crearNodo({ textContent: 'Ninguno' }),
    panelEquipo2: crearNodo(),
    listaEquipo2: crearNodo({ tagName: 'UL' }),
    triggerTiempo: crearNodo({ textContent: 'Tiempo' }),
    filaValorTiempo: crearNodo({ textContent: '3h' }),
    panelTiempo: crearNodo(),
    valorDias: crearNodo({ textContent: '0' }),
    valorHoras: crearNodo({ textContent: '3' }),
    valorMinutos: crearNodo({ textContent: '0' }),
    btnDiasMas: crearNodo(),
    btnDiasMenos: crearNodo(),
    btnHorasMas: crearNodo(),
    btnHorasMenos: crearNodo(),
    btnMinutosMas: crearNodo(),
    btnMinutosMenos: crearNodo(),
    botonIniciar: crearNodo(),
    etiquetaBoton: crearNodo({ textContent: 'INICIAR' }), // como en el HTML inicial
    etiquetaTiempo: crearNodo(),
    iconoActividad: crearNodo({ src: '', alt: '' }),
    anilloProgreso: crearNodo({ getAttribute: () => '145' }),
    nombre: crearNodo(),
  };
  if (opciones.sinNodos) {
    for (const clave of opciones.sinNodos) delete nodos[clave];
  }

  const documentHandlers = {};
  const document = {
    getElementById: (id) => nodos[id] || null,
    createElement: (tag) => crearNodo({ tagName: String(tag).toUpperCase() }),
    querySelector: (sel) => {
      const mapa = {
        '.botonIniciar .tiempo': nodos.etiquetaTiempo,
      };
      const nodo = mapa[sel];
      return nodo === undefined ? null : nodo;
    },
    addEventListener(tipo, fn) {
      (documentHandlers[tipo] ||= []).push(fn);
    },
  };

  const fetchLog = [];
  let fetchImpl =
    opciones.fetch ||
    (async () => {
      throw new Error('fetch no configurado en el test');
    });
  const fetch = async (url, init) => {
    fetchLog.push({ url: String(url), init });
    return fetchImpl(String(url), init);
  };

  const windowHandlers = {};
  const window = {
    location: { href: '' },
    addEventListener(tipo, fn) {
      (windowHandlers[tipo] ||= []).push(fn);
    },
  };

  // Timeouts del contexto: se agendan y se pueden disparar a mano para probar
  // el abort por timeout (RES-002). El reloj sigue siendo falso: no hay ticks
  // automáticos, solo el disparo explícito del test.
  const timeoutsPendientes = new Map();
  const timeoutsAgendados = []; // historial { id, ms } de todos los agendados
  let proximoTimeoutId = 0;

  // Captura de la consola del script: silencia la salida (TAP limpio) y deja
  // los mensajes assertables en t.consola.errores / .infos / .avisos / .logs
  const consola = { errores: [], avisos: [], infos: [], logs: [] };
  function textoArg(arg) {
    if (typeof arg === 'string') return arg;
    if (arg && typeof arg.message === 'string') {
      return `${arg.name || 'Error'}: ${arg.message}`;
    }
    return String(arg);
  }
  function registrar(destino) {
    return (...args) => destino.push(args.map(textoArg).join(' '));
  }

  const ctx = {
    ROOT_URL: 'http://back.test',
    window,
    document,
    localStorage,
    fetch,
    Date: FechaFalsa,
    setTimeout: (fn, ms) => {
      proximoTimeoutId += 1;
      timeoutsPendientes.set(proximoTimeoutId, fn);
      timeoutsAgendados.push({ id: proximoTimeoutId, ms });
      return proximoTimeoutId;
    },
    clearTimeout: (id) => {
      timeoutsPendientes.delete(id);
    },
    AbortController: class {
      constructor() {
        this._oyentesAbort = [];
        this.signal = {
          aborted: false,
          addEventListener: (tipo, fn) => {
            if (tipo === 'abort') this._oyentesAbort.push(fn);
          },
          removeEventListener: (tipo, fn) => {
            this._oyentesAbort = this._oyentesAbort.filter((f) => f !== fn);
          },
        };
      }
      abort() {
        if (this.signal.aborted) return;
        this.signal.aborted = true;
        for (const fn of this._oyentesAbort) fn();
      }
    },
    setInterval: (fn) => {
      proximoTimerId += 1;
      timers.set(proximoTimerId, fn);
      return proximoTimerId;
    },
    clearInterval: (id) => {
      timers.delete(id);
    },
    console: {
      error: registrar(consola.errores),
      warn: registrar(consola.avisos),
      info: registrar(consola.infos),
      log: registrar(consola.logs),
    },
  };

  vm.createContext(ctx);
  vm.runInContext(FUENTE + EXPORTS, ctx, { filename: 'iniciarDetener.js' });

  let promesaCarga = null;

  return {
    ctx,
    ctxTest: ctx.__test,
    nodos,
    store,
    fetchLog,
    reloj,
    timers,
    consola,
    timeoutsAgendados,
    // dispara todos los setTimeout pendientes del contexto (el abort de los
    // fetch con timeout, RES-002); los callbacks agendan los próximos después
    dispararTimeouts() {
      const pendientes = [...timeoutsPendientes.values()];
      timeoutsPendientes.clear();
      for (const fn of pendientes) fn();
    },
    setFetch: (fn) => {
      fetchImpl = fn;
    },
    async domListo() {
      const handlers = windowHandlers.DOMContentLoaded || [];
      for (const fn of handlers) await fn();
    },
    // Dispara el handler SIN esperarlo: la carga queda a mitad de camino y la
    // UI ya está inicializada (para probar clics antes de terminar la carga)
    cargarEnBackground() {
      const handlers = windowHandlers.DOMContentLoaded || [];
      promesaCarga = Promise.all(handlers.map((fn) => fn()));
      return promesaCarga;
    },
    async esperarCarga() {
      if (promesaCarga) await promesaCarga;
    },
    tick() {
      for (const fn of [...timers.values()]) fn();
    },
    // Simula un click en el documento (para el cierre por click afuera)
    dispararDocumento(tipo, evento) {
      for (const fn of documentHandlers[tipo] || []) fn(evento);
    },
  };
}

// ------------------------------------------------------------- helpers UI

// Campos del stepper de Tiempo -> nodos del DOM
const STEPPER = {
  dias: { mas: 'btnDiasMas', menos: 'btnDiasMenos', valor: 'valorDias' },
  horas: { mas: 'btnHorasMas', menos: 'btnHorasMenos', valor: 'valorHoras' },
  minutos: { mas: 'btnMinutosMas', menos: 'btnMinutosMenos', valor: 'valorMinutos' },
};

const TRIGGERS = ['triggerActividad', 'triggerEquipo1', 'triggerEquipo2', 'triggerTiempo'];

// Cabecera (título estático) -> su fila de valor dentro de la misma caja
const FILAS_VALOR = {
  triggerActividad: 'filaValorActividad',
  triggerEquipo1: 'filaValorEquipo1',
  triggerEquipo2: 'filaValorEquipo2',
  triggerTiempo: 'filaValorTiempo',
};

const PANELES = {
  actividad: 'panelActividad',
  equipo1: 'panelEquipo1',
  equipo2: 'panelEquipo2',
  tiempo: 'panelTiempo',
};

// Fija el tiempo con los steppers (mismo camino que un usuario: sube o baja
// desde el valor visible hasta el destino)
function fijarTiempo(t, esperado = {}) {
  for (const campo of ['dias', 'horas', 'minutos']) {
    const hasta = esperado[campo] ?? 0;
    const desde = Number(t.nodos[STEPPER[campo].valor].textContent);
    const boton = t.nodos[hasta >= desde ? STEPPER[campo].mas : STEPPER[campo].menos];
    for (let i = 0; i < Math.abs(hasta - desde); i++) boton.disparar('click');
  }
}

function assertTiempoValores(t, esperado, mensaje = '') {
  assert.equal(t.nodos.valorDias.textContent, String(esperado.dias), `días ${mensaje}`.trim());
  assert.equal(t.nodos.valorHoras.textContent, String(esperado.horas), `horas ${mensaje}`.trim());
  assert.equal(t.nodos.valorMinutos.textContent, String(esperado.minutos), `minutos ${mensaje}`.trim());
}

function assertTriggersDeshabilitados(t, esperado, mensaje = '') {
  for (const nombre of TRIGGERS) {
    assert.equal(
      t.nodos[nombre].disabled,
      esperado,
      `${nombre} debe estar ${esperado ? 'deshabilitado' : 'habilitado'} ${mensaje}`.trim()
    );
    // la caja completa: la fila de valor se bloquea junto con su cabecera
    assert.equal(
      t.nodos[FILAS_VALOR[nombre]].disabled,
      esperado,
      `${FILAS_VALOR[nombre]} debe estar ${esperado ? 'deshabilitada' : 'habilitada'} ${mensaje}`.trim()
    );
  }
}

// Las cabeceras son estáticas: siempre muestran su título, nunca el valor
function assertCabecerasEstaticas(t, mensaje = '') {
  const sufijo = mensaje ? ` ${mensaje}` : '';
  assert.equal(t.nodos.triggerActividad.textContent, 'Actividad', `cabecera Actividad${sufijo}`);
  assert.equal(t.nodos.triggerEquipo1.textContent, 'Equipo 1', `cabecera Equipo 1${sufijo}`);
  assert.equal(t.nodos.triggerEquipo2.textContent, 'Equipo 2', `cabecera Equipo 2${sufijo}`);
  assert.equal(t.nodos.triggerTiempo.textContent, 'Tiempo', `cabecera Tiempo${sufijo}`);
}

// Evento de click cuyo target está dentro de un .panelDesplegable abierto
function eventoClickEnPanel() {
  return {
    target: {
      closest: (selector) => (selector === '.panelDesplegable' ? {} : null),
    },
  };
}

function assertSoloPanelAbierto(t, nombre, mensaje = '') {
  for (const [clave, nodo] of Object.entries(PANELES)) {
    assert.equal(
      t.nodos[nodo].classList.contains('abierto'),
      clave === nombre,
      `el panel ${clave} debe estar ${clave === nombre ? 'abierto' : 'cerrado'} ${mensaje}`.trim()
    );
  }
}

function assertNingunPanelAbierto(t, mensaje = '') {
  for (const nodo of Object.values(PANELES)) {
    assert.ok(!t.nodos[nodo].classList.contains('abierto'), `el panel ${nodo} debe estar cerrado ${mensaje}`.trim());
  }
}

// Opción de una lista por su texto (los stubs guardan los <button> como hijos)
function opcionEnLista(t, lista, texto) {
  const nodo = t.nodos[lista].hijos.find((hijo) => hijo.textContent === texto);
  assert.ok(nodo, `la opción "${texto}" debe existir en ${lista}`);
  return nodo;
}

function textosLista(t, lista) {
  return t.nodos[lista].hijos.map((hijo) => hijo.textContent);
}

function respuestaOk(json) {
  return { ok: true, status: 200, json: async () => json };
}

function respuestaFail() {
  return { ok: false, status: 401, json: async () => ({}) };
}

const USUARIO = { userJWT: { name: 'Marcelo', email: 'marcelo@test.com' } };
const ACTIVIDADES = [
  { name: 'Windsurf', equipment: [{ name: 'Goya verde 5.0' }, { name: 'Naish 5.8' }] },
  { name: 'Surf' }, // sin equipo
];

function fetchNormal(rutas = {}) {
  return async (url) => {
    if (url.includes('/api/sessions/current')) return respuestaOk(USUARIO);
    if (url.includes('/api/activities/')) return respuestaOk(rutas.actividades ?? ACTIVIDADES);
    throw new Error(`URL inesperada: ${url}`);
  };
}

function contarFetch(fetchLog, fragmento) {
  return fetchLog.filter((entrada) => entrada.url.includes(fragmento)).length;
}

// Espera con timers REALES del runner (los del contexto son falsos) a que se
// cumpla una condición de las tareas del contexto vm: los fetch con timeout
// pendientes se resuelven por micro/macro-tasks fuera del control directo
async function esperar(condicion, intentos = 500) {
  for (let i = 0; i < intentos; i++) {
    if (condicion()) return;
    await new Promise((resolver) => setTimeout(resolver, 1));
  }
  assert.ok(condicion(), 'la condición esperada no se cumplió a tiempo');
}

// ------------------------------------------------------------------ tests

console.log('# iniciarDetener.js — funciones puras');

test('formatearTiempo formatea HH:MM:SS', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.formatearTiempo(0), '00:00:00');
  assert.equal(t.ctxTest.formatearTiempo(5400), '01:30:00');
  assert.equal(t.ctxTest.formatearTiempo(180 * 60), '03:00:00');
});

test('formatearTiempo con NaN/undefined/null/negativo da 00:00:00 (REL-006)', () => {
  const t = crearContexto();
  for (const valor of [NaN, undefined, null, -10, Infinity, 'hola']) {
    assert.equal(t.ctxTest.formatearTiempo(valor), '00:00:00', `valor=${String(valor)}`);
  }
});

test('formatearTiempo agrega prefijo de días con 24 h o más', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.formatearTiempo(86400), '1d 00:00:00', '24 h exactas');
  // 93600 s = 26 h = 1 d + 2 h: la fórmula acordada (Nd + resto HH:MM:SS)
  // da "1d 02:00:00". Ojo: 86400 (no 93600) es el valor que produce
  // "1d 00:00:00"; 93600 + 10800 = 104400 (29 h) da "1d 05:00:00".
  assert.equal(t.ctxTest.formatearTiempo(93600), '1d 02:00:00', '26 h = 1d + 2h');
  assert.equal(t.ctxTest.formatearTiempo(97200), '1d 03:00:00', '86400 + 10800');
  assert.equal(t.ctxTest.formatearTiempo(93780), '1d 02:03:00', '1d 2h 3m');
  assert.equal(t.ctxTest.formatearTiempo(7 * 86400), '7d 00:00:00', 'siete días');
  assert.equal(t.ctxTest.formatearTiempo(23 * 3600 + 59 * 60 + 59), '23:59:59', 'sin prefijo bajo 24 h');
});

test('tiempoValido: solo enteros de segundos mayores que cero', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.tiempoValido(15 * 60), true);
  assert.equal(t.ctxTest.tiempoValido(180 * 60), true);
  assert.equal(t.ctxTest.tiempoValido(100), true, 'cualquier entero > 0 es válido');
  assert.equal(t.ctxTest.tiempoValido(0), false, 'cero no es válido (REL-007)');
  assert.equal(t.ctxTest.tiempoValido(-15 * 60), false);
  assert.equal(t.ctxTest.tiempoValido(NaN), false);
  assert.equal(t.ctxTest.tiempoValido(Infinity), false);
  assert.equal(t.ctxTest.tiempoValido(5430.5), false, 'no entero');
});

test('normalizarNombre quita acentos y pasa a minúsculas', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.normalizarNombre('  Natación  '), 'natacion');
  assert.equal(t.ctxTest.normalizarNombre('PÁDEL'), 'padel');
});

test('imagenParaActividad: match exacto y por token', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.imagenParaActividad('Windsurf'), 'IlustracionWindsurf.png');
  assert.equal(t.ctxTest.imagenParaActividad(' windsurf '), 'IlustracionWindsurf.png');
  assert.equal(t.ctxTest.imagenParaActividad('SUP'), 'SUP.png');
  assert.equal(t.ctxTest.imagenParaActividad('Surf de olas'), 'Surf.png', 'match por token');
  assert.equal(t.ctxTest.imagenParaActividad('Kitesurf'), 'Jetski.png');
});

test('imagenParaActividad: prefijo y clave más larga ganan', () => {
  const t = crearContexto();
  assert.equal(
    t.ctxTest.imagenParaActividad('Windsurfing'),
    'IlustracionWindsurf.png',
    'prefijo: "Windsurfing" empieza con "windsurf"'
  );
  assert.equal(
    t.ctxTest.imagenParaActividad('Surf & Windsurf'),
    'IlustracionWindsurf.png',
    'clave más larga gana: "windsurf" (8) sobre "surf" (4)'
  );
  assert.equal(t.ctxTest.imagenParaActividad('Paddleboard'), 'SUP.png');
});

test('imagenParaActividad: fallback estable para actividades sin imagen', () => {
  const t = crearContexto();
  const primera = t.ctxTest.imagenParaActividad('Maratón de montaña');
  assert.ok(t.ctxTest.IMAGENES_POR_DEFECTO.includes(primera));
  assert.equal(
    t.ctxTest.imagenParaActividad('Maratón de montaña'),
    primera,
    'mismo nombre -> misma imagen (no cambia en cada carga)'
  );
  assert.notEqual(t.ctxTest.imagenParaActividad(''), t.ctxTest.imagenParaActividad('Gym crossfit'), 'hash distinto para nombres distintos');
});

test('imagenParaActividad: cadena vacía -> primera imagen por defecto', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.imagenParaActividad(''), t.ctxTest.IMAGENES_POR_DEFECTO[0]);
});

test('los assets de ícono existen en imagenes/ (REL-102)', () => {
  const t = crearContexto();
  const archivos = new Set([
    ...Object.values(t.ctxTest.IMAGEN_POR_ACTIVIDAD),
    ...t.ctxTest.IMAGENES_POR_DEFECTO,
  ]);
  assert.ok(archivos.size >= 4, 'mapa + defectos cubren los 4 PNGs');
  for (const archivo of archivos) {
    const ruta = path.join(__dirname, '..', 'imagenes', archivo);
    assert.ok(fs.existsSync(ruta), `falta el asset imagenes/${archivo}`);
  }
});

test('resumenTiempoCorto omite unidades en cero y usa "Tiempo" si todo es 0', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.resumenTiempoCorto(0, 3, 0), '3h');
  assert.equal(t.ctxTest.resumenTiempoCorto(0, 2, 30), '2h 30m');
  assert.equal(t.ctxTest.resumenTiempoCorto(1, 3, 15), '1d 3h 15m');
  assert.equal(t.ctxTest.resumenTiempoCorto(0, 0, 45), '45m');
  assert.equal(t.ctxTest.resumenTiempoCorto(2, 0, 5), '2d 5m', 'las horas en cero se omiten');
  assert.equal(t.ctxTest.resumenTiempoCorto(1, 0, 0), '1d');
  assert.equal(t.ctxTest.resumenTiempoCorto(0, 0, 0), 'Tiempo', 'todo en cero -> el título');
});

test('el HTML tiene los cuatro triggers con su título, paneles y stepper; sin selects', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pages', 'iniciarDetener.html'), 'utf8');
  for (const id of [
    'triggerActividad',
    'triggerEquipo1',
    'triggerEquipo2',
    'triggerTiempo',
    'panelActividad',
    'panelEquipo1',
    'panelEquipo2',
    'panelTiempo',
    'listaActividad',
    'listaEquipo1',
    'listaEquipo2',
    'btnDiasMas',
    'btnDiasMenos',
    'btnHorasMas',
    'btnHorasMenos',
    'btnMinutosMas',
    'btnMinutosMenos',
    'valorDias',
    'valorHoras',
    'valorMinutos',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `falta el nodo #${id}`);
  }
  assert.ok(!html.includes('<select'), 'ya no hay <select> nativos en la pantalla');
  assert.ok(!html.includes('class="tituloSelect"'), 'los títulos sueltos fueron eliminados');
  assert.ok(!html.includes('class="elegidos"'), 'la repetición .elegidos fue eliminada');
  assert.ok(!html.includes('id="selectEquipo"'), 'el viejo #selectEquipo fue reemplazado');
  assert.ok(!html.includes('id="selectTiempo"'), 'el viejo #selectTiempo fue reemplazado');
  let posicion = -1;
  for (const titulo of ['Actividad', 'Equipo 1', 'Equipo 2', 'Tiempo']) {
    const marca = `id="trigger${titulo === 'Actividad' ? 'Actividad' : titulo.replace(' ', '')}"`;
    const indice = html.indexOf(marca);
    assert.ok(indice > -1, `falta el trigger "${titulo}"`);
    assert.ok(indice > posicion, `el trigger "${titulo}" debe ir en orden`);
    posicion = indice;
    assert.ok(html.includes(`${marca} aria-haspopup="true" aria-expanded="false">${titulo}</button>`), `el trigger "${titulo}" muestra solo su título`);
  }
  // cada caja tiene su fila de valor con el placeholder inicial
  for (const [id, placeholder] of [
    ['filaValorActividad', 'Sin actividad'],
    ['filaValorEquipo1', 'Sin equipo'],
    ['filaValorEquipo2', 'Ninguno'],
    ['filaValorTiempo', '3h'],
  ]) {
    assert.ok(html.includes(`id="${id}"`), `falta la fila de valor #${id}`);
    assert.ok(html.includes(`>${placeholder}</button>`), `#${id} arranca con "${placeholder}"`);
  }
});

console.log('# iniciarDetener.js — UI');

async function testsUI() {
await testAsync('init ok: triggers poblados, tiempo default 0d/3h/0m, ícono con src', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  if (process.env.DEBUG_TEST) {
    console.log('    [dbg] fetchLog:', t.fetchLog.map((l) => l.url));
    console.log('    [dbg] listaActividad:', textosLista(t, 'listaActividad'));
    console.log('    [dbg] etiquetaTiempo:', JSON.stringify(t.nodos.etiquetaTiempo.textContent));
  }

  assert.equal(textosLista(t, 'listaActividad').length, 2);
  assertCabecerasEstaticas(t, 'tras el init');
  assert.equal(t.nodos.filaValorActividad.textContent, 'Windsurf');
  assertTiempoValores(t, { dias: 0, horas: 3, minutos: 0 }, '(default 180 min)');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '03:00:00');
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR');
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Goya verde 5.0', 'primer equipo por defecto');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno', 'Equipo 2 arranca sin elegir');
  assert.equal(t.nodos.filaValorTiempo.textContent, '3h', 'resumen compacto del default');
  assert.ok(t.nodos.iconoActividad.src.endsWith('IlustracionWindsurf.png'));
  assert.ok(t.nodos.iconoActividad.src.startsWith('../imagenes/'));
  assertNingunPanelAbierto(t, 'tras el init');
});

await testAsync('las filas de valor arrancan con sus placeholders antes de elegir', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.cargarEnBackground(); // init corre sincrónico hasta el primer await

  assertCabecerasEstaticas(t, 'antes de terminar la carga');
  assert.equal(t.nodos.filaValorActividad.textContent, 'Sin actividad');
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Sin equipo');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno');
  assert.equal(t.nodos.filaValorTiempo.textContent, '3h', 'default 0d 3h 0m');

  await t.esperarCarga();
});

await testAsync('Equipo 1 y Equipo 2 se poblan con la misma lista (sin dedupe)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  assert.deepEqual(textosLista(t, 'listaEquipo1'), ['Goya verde 5.0', 'Naish 5.8']);
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Goya verde 5.0');

  assert.deepEqual(
    textosLista(t, 'listaEquipo2'),
    ['Ninguno', 'Goya verde 5.0', 'Naish 5.8'],
    'Ninguno + los mismos equipos'
  );
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno', 'Ninguno = sin elegir');
});

await testAsync('restaura la última sesión guardada desde localStorage', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Surf', equipo: '', tiempoSegundos: 30 * 60 })
  );
  await t.domListo();

  assert.equal(t.nodos.filaValorActividad.textContent, 'Surf');
  assertCabecerasEstaticas(t, 'tras restaurar');
  assertTiempoValores(t, { dias: 0, horas: 0, minutos: 30 });
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:30:00');
  assert.equal(t.nodos.filaValorTiempo.textContent, '30m');
  assert.ok(t.nodos.iconoActividad.src.endsWith('Surf.png'));
});

await testAsync('restaura tiempo mayor a 24 h derivando días/horas/minutos', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Windsurf', equipo: [], tiempoSegundos: 93780 })
  );
  await t.domListo();

  assertTiempoValores(t, { dias: 1, horas: 2, minutos: 3 }, '(1d 2h 3m)');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '1d 02:03:00');
  assert.equal(t.nodos.filaValorTiempo.textContent, '1d 2h 3m');
});

await testAsync('actividad guardada ya eliminada -> primera actividad (REL-007 contexto)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Wing foil', equipo: 'Ala X', tiempoSegundos: 0 })
  );
  await t.domListo();

  assert.equal(t.nodos.filaValorActividad.textContent, 'Windsurf', 'primera de la lista');
  assertTiempoValores(t, { dias: 0, horas: 3, minutos: 0 }, 'tiempo inválido (0) -> default');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '03:00:00');
});

await testAsync('tiempo guardado no válido (0 o basura) -> default 0d/3h/0m (REL-007)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set('beepsafe_ultima_sesion', JSON.stringify({ actividad: 'Windsurf', equipo: [], tiempoSegundos: 0 }));
  await t.domListo();
  assertTiempoValores(t, { dias: 0, horas: 3, minutos: 0 });

  const t2 = crearContexto({ fetch: fetchNormal() });
  t2.store.set('beepsafe_ultima_sesion', 'no-es-json{"actividad"');
  await t2.domListo();
  assertTiempoValores(t2, { dias: 0, horas: 3, minutos: 0 }, 'JSON corrupto no rompe');
});

await testAsync('migra equipo string legado a array en la restauración', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Windsurf', equipo: 'Naish 5.8', tiempoSegundos: 10800 })
  );
  await t.domListo();

  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Naish 5.8', 'string legado -> Equipo 1');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno', 'Equipo 2 queda en Ninguno');
});

await testAsync('restaura equipo array filtrando nombres que ya no existen', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({
      actividad: 'Windsurf',
      equipo: ['Goya verde 5.0', 'Equipo Borrado'],
      tiempoSegundos: 10800,
    })
  );
  await t.domListo();

  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Goya verde 5.0');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno', 'nombre inexistente descartado -> Ninguno');

  t.nodos.botonIniciar.disparar('click');
  const guardada = JSON.parse(t.store.get('beepsafe_ultima_sesion:marcelo@test.com'));
  assert.deepEqual(guardada.equipo, ['Goya verde 5.0'], 'el payload re-persistido queda filtrado');
});

await testAsync('equipo string legado inexistente cae al primer equipo sin romper', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Windsurf', equipo: 'Equipo Borrado', tiempoSegundos: 10800 })
  );
  await t.domListo();

  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Goya verde 5.0', 'vuelve al default, sin crash');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno');
});

await testAsync('RES-001: fetch de actividades falla -> loguea el error y muestra el mensaje de fallo (no "Sin actividades")', async () => {
  const t = crearContexto({
    fetch: async (url) => {
      if (url.includes('/api/sessions/current')) return respuestaOk(USUARIO);
      throw new Error('red caída');
    },
  });
  await t.domListo();
  // contrato nuevo (RES-001): un fetch fallido es distinguible de una cuenta vacía
  assert.equal(
    t.nodos.filaValorActividad.textContent,
    'No se pudieron cargar las actividades'
  );
  assert.ok(
    t.nodos.filaValorActividad.classList.contains('cargaFallida'),
    'la fila lleva la clase de apoyo para el wrap del mensaje'
  );
  // ...y además queda logueado con prefijo, URL y motivo (greppable)
  assert.ok(t.consola.errores.length > 0, 'el fallo de activities se loguea');
  assert.ok(
    t.consola.errores.every((mensaje) => mensaje.includes('[iniciarDetener]')),
    'todo el log lleva el prefijo estable'
  );
  const intentos = t.consola.errores.filter((mensaje) =>
    mensaje.includes('/api/activities/')
  );
  assert.equal(intentos.length, 2, 'un reintento: dos intentos fallidos logueados');
  assert.ok(intentos[0].includes('intento 1/2') && intentos[1].includes('intento 2/2'));
  assert.ok(intentos[0].includes('red caída'), 'el motivo del fallo queda en el log');
  assertCabecerasEstaticas(t, 'en modo degradado');
  assert.equal(t.nodos.triggerActividad.disabled, true, 'la caja degradada no es interactiva');
  assert.equal(t.nodos.filaValorActividad.disabled, true);
  assert.deepEqual(textosLista(t, 'listaActividad'), [], 'sin opciones que ofrecer');
  // sin actividad, las filas de equipo muestran sus placeholders (REL-109)
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Sin equipo');
  assert.equal(t.nodos.triggerEquipo1.disabled, true);
  assert.equal(t.nodos.filaValorEquipo1.disabled, true);
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno');
  assert.equal(t.nodos.triggerEquipo2.disabled, true);
  assert.equal(t.nodos.filaValorEquipo2.disabled, true);
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR');
});

await testAsync('RES-001: cuenta vacía real sigue mostrando "Sin actividades" (sin log de error)', async () => {
  const t = crearContexto({ fetch: fetchNormal({ actividades: [] }) });
  await t.domListo();

  assert.equal(t.nodos.filaValorActividad.textContent, 'Sin actividades');
  assert.ok(
    !t.nodos.filaValorActividad.classList.contains('cargaFallida'),
    'sin clase de fallo cuando la lista vino vacía y ok'
  );
  assert.equal(
    t.consola.errores.filter((mensaje) => mensaje.includes('/api/activities/')).length,
    0,
    'una lista vacía en 200 no es un error'
  );
  assert.equal(t.ctxTest.cargaActividadesFallida, false, 'el flag de fallo queda en false');
  assert.equal(t.ctxTest.cargaCompleta, true, 'la carga terminó igual');
});

await testAsync('actividad sin equipo -> Equipo 1 no interactivo, Equipo 2 solo Ninguno', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  t.ctxTest.manejarSeleccionActividad('Surf');
  assert.deepEqual(textosLista(t, 'listaEquipo1'), [], 'Sin equipo: sin opciones');
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Sin equipo', 'placeholder de la fila de valor');
  assert.equal(t.nodos.triggerEquipo1.disabled, true, 'el trigger no debe abrir panel vacío');
  assert.deepEqual(textosLista(t, 'listaEquipo2'), ['Ninguno'], 'Equipo 2 siempre ofrece "Ninguno"');
  assert.equal(t.nodos.triggerEquipo2.disabled, false, 'aunque solo tenga "Ninguno"');
});

await testAsync('nodo faltante -> no fetch de actividades y sin throw (REL-003)', async () => {
  const t = crearContexto({ fetch: fetchNormal(), sinNodos: ['anilloProgreso'] });
  const errores = [];
  t.ctx.console = { error: (...args) => errores.push(args) }; // silencia y captura (REL-110)
  await t.domListo(); // no debe lanzar
  const huboFetchActividades = t.fetchLog.some((l) => l.url.includes('/api/activities/'));
  assert.equal(huboFetchActividades, false);
  assert.ok(errores.length > 0, 'el fallo de init ahora se loguea (REL-110)');
  assert.match(String(errores[0][0]), /nodos faltantes/);
  assert.match(String(errores[0][1]), /anilloProgreso/);
});

await testAsync('#nombre faltante -> sin redirect y sin TypeError (REL-004)', async () => {
  const t = crearContexto({ fetch: fetchNormal(), sinNodos: ['nombre'] });
  await t.domListo();
  // window.location.href solo cambia en el catch (no logeado); no debe haber saltado
  // (si lanzara TypeError, domListo rechazaría y este test fallaría igual)
  assert.ok(t.fetchLog.some((l) => l.url.includes('/api/activities/')), 'siguió hasta cargar actividades');
});

await testAsync('sin token / current falla -> redirect a iniciarSesion.html (sin reintento de auth)', async () => {
  const t = crearContexto({ fetch: async () => respuestaFail() });
  await t.domListo();
  const href = vm.runInContext('window.location.href', t.ctx);
  assert.equal(href, 'iniciarSesion.html');
  // RES-003: el rechazo explícito de auth (401/403) NO se reintenta...
  assert.equal(contarFetch(t.fetchLog, '/api/sessions/current'), 1, 'un solo intento');
  // ...y el redirect queda igual logueado con URL y status (RES-001)
  assert.ok(
    t.consola.errores.some(
      (mensaje) => mensaje.includes('sesión rechazada') && mensaje.includes('status=401')
    )
  );
});

await testAsync('INICIAR corre con wall-clock; DETENER resetea (REL-002)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  fijarTiempo(t, { minutos: 15 });
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:15:00');

  t.nodos.botonIniciar.disparar('click');
  assert.equal(t.nodos.etiquetaBoton.textContent, 'DETENER');

  // pestaña en background: salto de 10 minutos sin ticks intermedios
  t.reloj.ahora += 10 * 60 * 1000;
  t.tick();
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:05:00', 'wall-clock, no cuenta de ticks');

  t.nodos.botonIniciar.disparar('click'); // DETENER
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:15:00', 'vuelve al total');
});

await testAsync('al llegar a 0 -> FINALIZADO; cambiar el tiempo lo reinicia (REL-001)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  fijarTiempo(t, { minutos: 15 });
  t.nodos.botonIniciar.disparar('click');

  t.reloj.ahora += 15 * 60 * 1000;
  t.tick();
  assert.equal(t.nodos.etiquetaBoton.textContent, 'FINALIZADO');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:00:00');

  // REL-001: cambiar el tiempo estando FINALIZADO vuelve a INICIAR con el nuevo tiempo
  fijarTiempo(t, { minutos: 30 });
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:30:00');
});

await testAsync('duración 0 (días/horas/minutos en 0) no inicia ni persiste basura (REL-007)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  fijarTiempo(t, { dias: 0, horas: 0, minutos: 0 });
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:00:00');
  t.nodos.botonIniciar.disparar('click');
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR', 'no pasa a DETENER');
  assert.equal(t.store.has('beepsafe_ultima_sesion'), false, 'no persistió');
});

await testAsync('la última sesión se persiste al INICIAR, no al cargar', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  const clave = `${t.ctxTest.CLAVE_ULTIMA_SESION}:marcelo@test.com`; // namespace REL-106
  assert.equal(t.store.has('beepsafe_ultima_sesion'), false, 'nada al cargar');
  assert.equal(t.store.has(clave), false, 'nada al cargar');

  t.nodos.botonIniciar.disparar('click');
  const guardada = JSON.parse(t.store.get(clave));
  assert.equal(guardada.actividad, 'Windsurf');
  assert.deepEqual(guardada.equipo, ['Goya verde 5.0'], 'equipo es un array con Equipo 1');
  assert.equal(guardada.tiempoSegundos, 180 * 60);
});

await testAsync('payload equipo: array de los dos nombres elegidos (sin dedupe)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.ctxTest.manejarSeleccionEquipo2('Naish 5.8');
  t.nodos.botonIniciar.disparar('click');

  const guardada = JSON.parse(t.store.get('beepsafe_ultima_sesion:marcelo@test.com'));
  assert.deepEqual(guardada.equipo, ['Goya verde 5.0', 'Naish 5.8']);
});

await testAsync('payload equipo: repetir el mismo equipo en ambas ranuras está permitido', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.ctxTest.manejarSeleccionEquipo1('Naish 5.8');
  t.ctxTest.manejarSeleccionEquipo2('Naish 5.8');
  t.nodos.botonIniciar.disparar('click');

  const guardada = JSON.parse(t.store.get('beepsafe_ultima_sesion:marcelo@test.com'));
  assert.deepEqual(guardada.equipo, ['Naish 5.8', 'Naish 5.8'], 'no hay dedupe');
});

await testAsync('tiempoSegundos = días*86400 + horas*3600 + minutos*60 (1d 2h 3m = 93780)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  fijarTiempo(t, { dias: 1, horas: 2, minutos: 3 });
  assert.equal(t.nodos.filaValorTiempo.textContent, '1d 2h 3m', 'la fila de valor muestra el resumen');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '1d 02:03:00');

  t.nodos.botonIniciar.disparar('click');
  const guardada = JSON.parse(t.store.get('beepsafe_ultima_sesion:marcelo@test.com'));
  assert.equal(guardada.tiempoSegundos, 93780);
  assert.equal(t.nodos.etiquetaTiempo.textContent, '1d 02:03:00', 'el botón también');
});

// ------------------------------------------------- nueva cobertura (REL-108)

await testAsync('anillo en reposo tras init: dasharray y offset = circunferencia', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  const circunferencia = String(2 * Math.PI * 145);
  assert.equal(t.nodos.anilloProgreso.style.strokeDasharray, circunferencia);
  assert.equal(t.nodos.anilloProgreso.style.strokeDashoffset, circunferencia);
});

await testAsync('anillo a mitad de cuenta: offset proporcional al transcurrido', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  fijarTiempo(t, { minutos: 15 });
  t.nodos.botonIniciar.disparar('click');
  t.reloj.ahora += 5 * 60 * 1000; // 5 de 15 minutos
  t.tick();
  assert.equal(
    t.nodos.anilloProgreso.style.strokeDashoffset,
    String(2 * Math.PI * 145 * (1 - (900 - 600) / 900))
  );
});

await testAsync('anillo al finalizar: offset 0 (anillo completo)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  fijarTiempo(t, { minutos: 15 });
  t.nodos.botonIniciar.disparar('click');
  t.reloj.ahora += 15 * 60 * 1000;
  t.tick();
  assert.equal(t.nodos.etiquetaBoton.textContent, 'FINALIZADO');
  assert.equal(t.nodos.anilloProgreso.style.strokeDashoffset, '0');
});

await testAsync('saludo con el nombre del usuario en mayúsculas', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  assert.equal(t.nodos.nombre.hijos.length, 1);
  assert.equal(t.nodos.nombre.hijos[0].textContent, 'MARCELO!');
});

await testAsync('los cuatro triggers deshabilitados mientras corre; se reactivan al DETENER y al FINALIZADO', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  fijarTiempo(t, { minutos: 15 });

  t.nodos.botonIniciar.disparar('click');
  assertTriggersDeshabilitados(t, true, 'al INICIAR (REL-103)');

  t.nodos.botonIniciar.disparar('click'); // DETENER
  assertTriggersDeshabilitados(t, false, 'al DETENER');

  t.nodos.botonIniciar.disparar('click');
  t.reloj.ahora += 15 * 60 * 1000;
  t.tick();
  assert.equal(t.nodos.etiquetaBoton.textContent, 'FINALIZADO');
  assertTriggersDeshabilitados(t, false, 'al FINALIZADO (REL-001)');
});

await testAsync('INICIAR antes de terminar de cargar no destruye la última sesión (REL-101)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.cargarEnBackground(); // arranca la carga sin esperarla

  // clic síncrono: la UI ya existe pero la carga no terminó
  t.nodos.botonIniciar.disparar('click');
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR', 'no arranca a medias');
  assert.equal(t.store.has('beepsafe_ultima_sesion'), false);
  assert.equal(t.store.has('beepsafe_ultima_sesion:marcelo@test.com'), false);
  assert.equal(t.store.has('beepsafe_sesion_en_curso:marcelo@test.com'), false);

  await t.esperarCarga();
  t.nodos.botonIniciar.disparar('click');
  assert.equal(t.nodos.etiquetaBoton.textContent, 'DETENER', 'con la carga lista sí arranca');
  const guardada = JSON.parse(t.store.get('beepsafe_ultima_sesion:marcelo@test.com'));
  assert.equal(guardada.actividad, 'Windsurf');
  assert.ok(t.store.has('beepsafe_sesion_en_curso:marcelo@test.com'));
});

await testAsync('RES-003/REL-104: current lanza (red caída) -> reintenta una vez, sin redirect y degradado ruidoso', async () => {
  const t = crearContexto({
    fetch: async (url) => {
      if (url.includes('/api/sessions/current')) throw new Error('red caída');
      return respuestaOk(ACTIVIDADES);
    },
  });
  await t.domListo(); // no debe lanzar ni redirigir
  const href = vm.runInContext('window.location.href', t.ctx);
  assert.equal(href, '', 'sin redirect en error de red/timeout');
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR');
  // contrato nuevo (RES-001): sin email no hay actividades y eso se muestra
  // como fallo de carga, no como una cuenta vacía silenciosa
  assert.equal(
    t.nodos.filaValorActividad.textContent,
    'No se pudieron cargar las actividades'
  );
  assert.equal(t.nodos.etiquetaTiempo.textContent, '03:00:00', 'la carga llegó hasta el final');
  assert.equal(t.ctxTest.cargaCompleta, true, 'cargaCompleta se asienta aunque falle el auth');
  // RES-003: se reintenta una vez el fallo de red y queda logueado (ruidoso)
  assert.equal(contarFetch(t.fetchLog, '/api/sessions/current'), 2, 'un reintento');
  assert.ok(
    t.consola.errores.some((mensaje) =>
      mensaje.includes('/api/sessions/current') && mensaje.includes('intento 2/2')
    ),
    'el fallo agotado queda logueado con URL y motivo'
  );
  assert.ok(
    t.consola.errores.some((mensaje) => mensaje.includes('/api/activities')),
    'el motivo por el que no hubo activities también se loguea'
  );
});

await testAsync('reiniciar tras FINALIZADO sin tocar los triggers -> DETENER con el tiempo completo', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  fijarTiempo(t, { minutos: 15 });
  t.nodos.botonIniciar.disparar('click');
  t.reloj.ahora += 15 * 60 * 1000;
  t.tick();
  assert.equal(t.nodos.etiquetaBoton.textContent, 'FINALIZADO');

  t.nodos.botonIniciar.disparar('click'); // sin cambiar ningún trigger
  assert.equal(t.nodos.etiquetaBoton.textContent, 'DETENER');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:15:00', 'vuelve el tiempo completo');
});

await testAsync('la última sesión está namespaceada por email (REL-106)', async () => {
  const payload = JSON.stringify({ actividad: 'Surf', equipo: '', tiempoSegundos: 30 * 60 });

  const t1 = crearContexto({ fetch: fetchNormal() });
  t1.store.set('beepsafe_ultima_sesion:marcelo@test.com', payload);
  await t1.domListo();
  assert.equal(t1.nodos.filaValorActividad.textContent, 'Surf', 'la clave del usuario sí restaura');
  assertTiempoValores(t1, { dias: 0, horas: 0, minutos: 30 });

  const t2 = crearContexto({ fetch: fetchNormal() });
  t2.store.set('beepsafe_ultima_sesion:otro@test.com', payload);
  await t2.domListo();
  assert.equal(t2.nodos.filaValorActividad.textContent, 'Windsurf', 'la clave de otro usuario no restaura');
  assertTiempoValores(t2, { dias: 0, horas: 3, minutos: 0 });
});

await testAsync('clave legada se migra al namespace del usuario (REL-106)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Surf', equipo: '', tiempoSegundos: 45 * 60 })
  );
  await t.domListo();
  assert.equal(t.nodos.filaValorActividad.textContent, 'Surf', 'se restaura desde la clave legada');
  assertTiempoValores(t, { dias: 0, horas: 0, minutos: 45 });
  assert.ok(t.store.has('beepsafe_ultima_sesion:marcelo@test.com'), 'migrada al namespace');
  assert.equal(t.store.has('beepsafe_ultima_sesion'), false, 'clave legada eliminada');
});

await testAsync('sesión en curso se reanuda al recargar (REL-105)', async () => {
  const store = new Map();
  const base = 1_700_000_000_000;

  const t1 = crearContexto({ fetch: fetchNormal(), store, ahora: base });
  const clave = `${t1.ctxTest.CLAVE_SESION_EN_CURSO}:marcelo@test.com`;
  await t1.domListo();
  fijarTiempo(t1, { minutos: 15 });
  t1.nodos.botonIniciar.disparar('click');
  assert.equal(t1.nodos.etiquetaBoton.textContent, 'DETENER');
  assert.ok(store.has(clave), 'se persiste al INICIAR');

  // "recarga" 5 minutos después: sigue corriendo con el tiempo restante
  const t2 = crearContexto({ fetch: fetchNormal(), store, ahora: base + 5 * 60 * 1000 });
  await t2.domListo();
  assert.equal(t2.nodos.etiquetaBoton.textContent, 'DETENER');
  assert.equal(t2.nodos.etiquetaTiempo.textContent, '00:10:00');
  assertTriggersDeshabilitados(t2, true, 'mientras la sesión reanudada corre');

  // "recarga" 20 minutos después: la ventana venció -> detenido y sin clave
  const t3 = crearContexto({ fetch: fetchNormal(), store, ahora: base + 20 * 60 * 1000 });
  await t3.domListo();
  assert.equal(t3.nodos.etiquetaBoton.textContent, 'INICIAR', 'no salta a FINALIZADO');
  assert.equal(t3.nodos.etiquetaTiempo.textContent, '00:15:00');
  assert.ok(store.has(clave) === false, 'clave vencida eliminada');
});

// ------------------------------------- desplegables custom (nueva UI)

await testAsync('las cabeceras mantienen el título y las filas de valor muestran la selección', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  assertCabecerasEstaticas(t, 'con la sesión por defecto');
  assert.equal(t.nodos.filaValorActividad.textContent, 'Windsurf', 'actividad por defecto');
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Goya verde 5.0', 'primer equipo por defecto');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno', 'sin elegir -> placeholder');

  t.ctxTest.manejarSeleccionActividad('Surf');
  assertCabecerasEstaticas(t, 'tras elegir actividad');
  assert.equal(t.nodos.filaValorActividad.textContent, 'Surf');
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Sin equipo', 'Surf no tiene equipo');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno');

  t.ctxTest.manejarSeleccionActividad('Windsurf');
  t.ctxTest.manejarSeleccionEquipo1('Naish 5.8');
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Naish 5.8');
  t.ctxTest.manejarSeleccionEquipo2('Naish 5.8');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Naish 5.8');
  assertCabecerasEstaticas(t, 'tras elegir equipos');
  assert.equal(t.nodos.iconoActividad.src.endsWith('IlustracionWindsurf.png'), true, 'el ícono sigue a la actividad');
});

await testAsync('los steppers de Tiempo clampean a 7d / 23h / 59m y tienen piso en 0', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  for (let i = 0; i < 50; i++) t.nodos.btnHorasMas.disparar('click');
  assertTiempoValores(t, { dias: 0, horas: 23, minutos: 0 }, 'tope de horas');

  for (let i = 0; i < 10; i++) t.nodos.btnDiasMas.disparar('click');
  assertTiempoValores(t, { dias: 7, horas: 23, minutos: 0 }, 'tope de días');

  for (let i = 0; i < 80; i++) t.nodos.btnMinutosMas.disparar('click');
  assertTiempoValores(t, { dias: 7, horas: 23, minutos: 59 }, 'tope de minutos');
  assert.equal(t.nodos.filaValorTiempo.textContent, '7d 23h 59m');

  for (let i = 0; i < 200; i++) {
    t.nodos.btnDiasMenos.disparar('click');
    t.nodos.btnHorasMenos.disparar('click');
    t.nodos.btnMinutosMenos.disparar('click');
  }
  assertTiempoValores(t, { dias: 0, horas: 0, minutos: 0 }, 'piso en 0');
  assert.equal(t.nodos.filaValorTiempo.textContent, '0h', 'todo en cero muestra 0h en la fila de valor');
});

await testAsync('la fila de valor de Tiempo muestra un resumen compacto que omite unidades en cero', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  assertCabecerasEstaticas(t, 'el título "Tiempo" nunca lo pisa el resumen');
  assert.equal(t.nodos.filaValorTiempo.textContent, '3h', 'default 0d 3h 0m');

  fijarTiempo(t, { horas: 2, minutos: 30 });
  assert.equal(t.nodos.filaValorTiempo.textContent, '2h 30m');

  fijarTiempo(t, { dias: 1, horas: 3, minutos: 15 });
  assert.equal(t.nodos.filaValorTiempo.textContent, '1d 3h 15m');

  fijarTiempo(t, { dias: 0, horas: 0, minutos: 0 });
  assert.equal(t.nodos.filaValorTiempo.textContent, '0h', 'todo en cero -> 0h (la función pura sigue devolviendo "Tiempo")');
});

await testAsync('el click fuera cierra el panel abierto; un click "adentro" lo deja (cerrarPaneles)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.nodos.triggerActividad.disparar('click');
  assertSoloPanelAbierto(t, 'actividad');

  // click fuera: el handler de document cierra todo
  t.dispararDocumento('click', { target: { closest: () => null } });
  assertNingunPanelAbierto(t, 'tras click fuera');

  // click "adentro" (sobre el desplegable): no debe cerrar antes del toggle
  t.nodos.triggerTiempo.disparar('click');
  assertSoloPanelAbierto(t, 'tiempo');
  t.dispararDocumento('click', { target: { closest: () => ({}) } });
  assertSoloPanelAbierto(t, 'tiempo', 'un click dentro del desplegable no cierra');

  // la función nombrada también cierra (camino directo)
  t.ctxTest.cerrarPaneles();
  assertNingunPanelAbierto(t, 'tras cerrarPaneles()');
});

await testAsync('la fila de valor alterna el panel igual que la cabecera', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.nodos.filaValorActividad.disparar('click');
  assertSoloPanelAbierto(t, 'actividad', 'click en la fila de valor');

  t.nodos.filaValorActividad.disparar('click');
  assertNingunPanelAbierto(t, 'segundo click en la fila de valor cierra');

  t.nodos.filaValorTiempo.disparar('click');
  assertSoloPanelAbierto(t, 'tiempo', 'cada caja usa su propia fila de valor');

  t.nodos.triggerTiempo.disparar('click');
  assertNingunPanelAbierto(t, 'cabecera y fila de valor alternan el mismo panel');
});

await testAsync('un click originado dentro del panel no alterna el desplegable', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.nodos.triggerActividad.disparar('click');
  assertSoloPanelAbierto(t, 'actividad');

  // el handler nombrado ignora el evento cuando el target está en el panel
  t.ctxTest.manejarClickTriggerActividad(eventoClickEnPanel());
  assertSoloPanelAbierto(t, 'actividad', 'el guard de panel evita el toggle');

  t.ctxTest.manejarClickTriggerEquipo2(eventoClickEnPanel());
  assertSoloPanelAbierto(t, 'actividad', 'ninguna cabecera reacciona a clicks del panel');

  t.ctxTest.manejarClickTriggerTiempo(eventoClickEnPanel());
  assertSoloPanelAbierto(t, 'actividad');

  t.ctxTest.cerrarPaneles();
  t.ctxTest.manejarClickTriggerTiempo(eventoClickEnPanel());
  assertNingunPanelAbierto(t, 'el guard también aplica con el panel cerrado');
});

await testAsync('solo un panel a la vez: abrir otro cierra el anterior; el segundo click cierra', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.nodos.triggerActividad.disparar('click');
  assertSoloPanelAbierto(t, 'actividad', 'el primero en abrirse');

  t.nodos.triggerTiempo.disparar('click');
  assertSoloPanelAbierto(t, 'tiempo', 'abrir el segundo cierra el primero');

  t.nodos.triggerTiempo.disparar('click');
  assertNingunPanelAbierto(t, 'segundo click en el mismo trigger cierra');

  t.nodos.triggerEquipo2.disparar('click');
  assertSoloPanelAbierto(t, 'equipo2');

  t.nodos.triggerEquipo1.disparar('click');
  assertSoloPanelAbierto(t, 'equipo1', 'cambiar de columna también cierra el anterior');
});

await testAsync('las opciones de los paneles están cableadas: el click elige y cierra el panel', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.nodos.triggerActividad.disparar('click');
  opcionEnLista(t, 'listaActividad', 'Surf').disparar('click');
  assert.equal(t.nodos.filaValorActividad.textContent, 'Surf');
  assertCabecerasEstaticas(t, 'elegir no toca las cabeceras');
  assertNingunPanelAbierto(t, 'elegir una opción cierra el panel');

  t.nodos.triggerEquipo2.disparar('click');
  assertSoloPanelAbierto(t, 'equipo2');
  // Surf no tiene equipos: la única opción es "Ninguno"
  opcionEnLista(t, 'listaEquipo2', 'Ninguno').disparar('click');
  assert.equal(t.nodos.filaValorEquipo2.textContent, 'Ninguno', 'Ninguno -> la fila de valor muestra el placeholder');
  assertNingunPanelAbierto(t);
});

await testAsync('el panel de Tiempo permanece abierto mientras se usa el stepper', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.nodos.triggerTiempo.disparar('click');
  t.nodos.btnHorasMas.disparar('click');
  t.nodos.btnHorasMas.disparar('click');
  assert.equal(t.nodos.valorHoras.textContent, '5');
  assertSoloPanelAbierto(t, 'tiempo', 'sigue abierto al stepppear');
  assert.equal(t.nodos.filaValorTiempo.textContent, '5h', 'la fila de valor se actualiza en vivo');
  assert.equal(t.nodos.triggerTiempo.textContent, 'Tiempo', 'la cabecera sigue estática');

  t.nodos.btnDiasMas.disparar('click');
  assert.equal(t.nodos.filaValorTiempo.textContent, '1d 5h');
  assertSoloPanelAbierto(t, 'tiempo');
});

await testAsync('los triggers de Equipo no son interactivos hasta elegir una actividad', async () => {
  const t = crearContexto({
    fetch: async (url) => {
      if (url.includes('/api/sessions/current')) return respuestaOk(USUARIO);
      throw new Error('red caída');
    },
  });
  await t.domListo();

  assert.equal(t.nodos.triggerActividad.disabled, true, 'Sin actividades -> no interactivo');
  assert.equal(t.nodos.triggerEquipo1.disabled, true);
  assert.equal(t.nodos.triggerEquipo2.disabled, true);

  t.nodos.triggerActividad.disparar('click');
  assertNingunPanelAbierto(t, 'el trigger degradado no abre panel');
  t.nodos.triggerEquipo1.disparar('click');
  t.nodos.triggerEquipo2.disparar('click');
  assertNingunPanelAbierto(t, 'los triggers de equipo no abren sin actividad');
});

await testAsync('con la sesión corriendo los triggers ignoran clicks, steppers y selecciones', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  fijarTiempo(t, { minutos: 15 });

  t.nodos.triggerActividad.disparar('click'); // panel abierto antes de arrancar
  assertSoloPanelAbierto(t, 'actividad');
  t.nodos.botonIniciar.disparar('click');
  assertTriggersDeshabilitados(t, true, 'al INICIAR (REL-103)');
  assertNingunPanelAbierto(t, 'INICIAR cierra los paneles abiertos');

  t.nodos.triggerActividad.disparar('click');
  t.nodos.triggerTiempo.disparar('click');
  assertNingunPanelAbierto(t, 'ningún panel abre estando bloqueado');

  t.nodos.btnHorasMas.disparar('click');
  assertTiempoValores(t, { dias: 0, horas: 0, minutos: 15 }, 'los steppers no cambian valores');
  t.ctxTest.manejarSeleccionActividad('Surf');
  assert.equal(t.nodos.filaValorActividad.textContent, 'Windsurf', 'la selección se ignora');
  assert.equal(t.nodos.filaValorEquipo1.textContent, 'Goya verde 5.0', 'el equipo no cambia');

  t.nodos.botonIniciar.disparar('click'); // DETENER
  assertTriggersDeshabilitados(t, false, 'al DETENER');
  t.nodos.triggerTiempo.disparar('click');
  assertSoloPanelAbierto(t, 'tiempo', 'tras DETENER vuelve a abrir');
});

// --------------------------------- regresiones de la revisión 4R (RES-001..004)

await testAsync('RES-002: activities aborta a los 8000 ms, reintenta una vez y asienta cargaCompleta en el fallo', async () => {
  const abortos = [];
  const t = crearContexto({
    fetch: async (url, init) => {
      if (url.includes('/api/sessions/current')) return respuestaOk(USUARIO);
      // cuelga indefinidamente: solo lo fina el abort por timeout
      return new Promise((resolver, rechazar) => {
        init.signal.addEventListener('abort', () => {
          abortos.push(init.signal.aborted);
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          rechazar(error);
        });
      });
    },
  });

  const carga = t.cargarEnBackground();
  await esperar(() => contarFetch(t.fetchLog, '/api/activities/') === 1);
  assert.equal(t.ctxTest.cargaCompleta, false, 'pendiente mientras el fetch cuelga');
  assert.ok(
    t.timeoutsAgendados.some((registro) => registro.ms === 8000),
    'timeout de 8000 ms agendado (mismo patrón que el auth)'
  );

  t.dispararTimeouts(); // intento 1 -> abort
  await esperar(() => contarFetch(t.fetchLog, '/api/activities/') === 2);
  assert.equal(t.ctxTest.cargaCompleta, false, 'pendiente durante el reintento');

  t.dispararTimeouts(); // intento 2 -> abort: se acabaron los reintentos
  await carga;

  assert.equal(contarFetch(t.fetchLog, '/api/activities/'), 2, 'exactamente 1 reintento');
  assert.deepEqual(abortos, [true, true], 'los dos intentos murieron por abort del timeout');
  assert.equal(t.ctxTest.cargaCompleta, true, 'cargaCompleta se asienta en el fallo (RES-002)');
  assert.equal(t.ctxTest.cargaActividadesFallida, true);
  assert.equal(t.nodos.filaValorActividad.textContent, 'No se pudieron cargar las actividades');
  assert.equal(
    t.consola.errores.filter((mensaje) => mensaje.includes('timeout (abort)')).length,
    2,
    'cada intento abortado se loguea con motivo'
  );
});

await testAsync('auth gap: el fetch de activities lleva Authorization con el token de localStorage', async () => {
  const TOKEN = 'token-de-prueba-123';
  const store = new Map([['token', TOKEN]]);
  const t = crearContexto({ fetch: fetchNormal(), store });
  await t.domListo();

  const llamadas = t.fetchLog.filter((l) => l.url.includes('/api/activities/'));
  assert.equal(llamadas.length, 1, 'un solo fetch de activities en la carga sana');
  const init = llamadas[0].init;
  assert.ok(init && init.headers, 'el init del fetch de activities lleva headers');
  assert.equal(
    init.headers.Authorization,
    `Bearer ${TOKEN}`,
    'el GET /api/activities/<email> se autentica con el token (GET /:email exige JWT)'
  );
});

await testAsync('RES-003: sessions/current reintenta una vez ante un 500 y la segunda sana carga activities normal', async () => {
  let llamadasCurrent = 0;
  const t = crearContexto({
    fetch: async (url) => {
      if (url.includes('/api/sessions/current')) {
        llamadasCurrent += 1;
        if (llamadasCurrent === 1) return { ok: false, status: 500, json: async () => ({}) };
        return respuestaOk(USUARIO);
      }
      if (url.includes('/api/activities/')) return respuestaOk(ACTIVIDADES);
      throw new Error(`URL inesperada: ${url}`);
    },
  });
  await t.domListo();

  assert.equal(contarFetch(t.fetchLog, '/api/sessions/current'), 2, 'un reintento en el fallo no-auth');
  assert.equal(
    contarFetch(t.fetchLog, '/api/activities/'),
    1,
    'con el reintento que trae email, activities no se queda sin consultar'
  );
  assert.equal(t.nodos.filaValorActividad.textContent, 'Windsurf', 'carga completa tras recuperar');
  assert.equal(t.ctxTest.cargaActividadesFallida, false, 'hubo datos: no es modo de fallo');
  assert.ok(
    t.consola.errores.some(
      (mensaje) => mensaje.includes('status=500') && mensaje.includes('intento 1/2')
    ),
    'el intento fallido quedó logueado con URL y status'
  );
});

await testAsync('RES-003: sessions/current siempre en 500 -> agota el reintento y degrada ruidoso, pero un reload recupera', async () => {
  const t = crearContexto({
    fetch: async (url) => {
      if (url.includes('/api/sessions/current')) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (url.includes('/api/activities/')) return respuestaOk(ACTIVIDADES);
      throw new Error(`URL inesperada: ${url}`);
    },
  });
  await t.domListo();

  assert.equal(contarFetch(t.fetchLog, '/api/sessions/current'), 2, 'exactamente 1 reintento');
  assert.equal(contarFetch(t.fetchLog, '/api/activities/'), 0, 'sin email no se arma la URL');
  assert.equal(t.nodos.filaValorActividad.textContent, 'No se pudieron cargar las actividades');
  assert.equal(t.ctxTest.cargaCompleta, true, 'la carga termina igual, en modo fallo');
  assert.ok(
    t.consola.errores.some(
      (mensaje) =>
        mensaje.includes('[iniciarDetener]') &&
        mensaje.includes('/api/sessions/current') &&
        mensaje.includes('status=500')
    ),
    'la degradación es ruidosa: log con prefijo, URL y status'
  );
  assert.ok(
    t.consola.errores.some((mensaje) => mensaje.includes('sin email de usuario')),
    'el motivo de no poder consultar activities también se loguea'
  );

  // recuperable por reload: con el backend sano, la siguiente carga arranca normal
  const t2 = crearContexto({ fetch: fetchNormal(), store: t.store, ahora: t.reloj.ahora });
  await t2.domListo();
  assert.equal(
    t2.nodos.filaValorActividad.textContent,
    'Windsurf',
    'recargar con el auth sano restaura el estado normal'
  );
});

await testAsync('RES-004: sesión en curso escrita en la variante simple se migra a la clave del usuario y se reanuda', async () => {
  const store = new Map();
  const base = 1_700_000_000_000;
  store.set(
    'beepsafe_sesion_en_curso',
    JSON.stringify({
      actividad: 'Windsurf',
      equipo: ['Goya verde 5.0'],
      tiempoSegundos: 900,
      inicioContadorMs: base - 5 * 60 * 1000,
    })
  );

  const t = crearContexto({ fetch: fetchNormal(), store, ahora: base });
  await t.domListo();

  assert.equal(t.nodos.etiquetaBoton.textContent, 'DETENER', 'la sesión escrita en la otra variante se reanuda');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:10:00');

  const claveNamespaceada = 'beepsafe_sesion_en_curso:marcelo@test.com';
  assert.ok(store.has(claveNamespaceada), 'migrada a la variante actual (namespaceada)');
  assert.equal(store.has('beepsafe_sesion_en_curso'), false, 'clave origen eliminada');
  assert.ok(
    t.consola.infos.some(
      (mensaje) => mensaje.includes('reconciliado') && mensaje.includes('beepsafe_sesion_en_curso')
    ),
    'la reconciliación queda logueada'
  );
  // el payload migrado sigue limitado a actividad/equipo/tiempo/inicio: sin tokens
  const migrado = JSON.parse(store.get(claveNamespaceada));
  assert.deepEqual(
    Object.keys(migrado).sort(),
    ['actividad', 'equipo', 'inicioContadorMs', 'tiempoSegundos'],
    'payload sin credenciales'
  );
});

await testAsync('RES-004: con la auth caída, las claves namespaceadas se reconcilian a la variante simple', async () => {
  const store = new Map();
  const base = 1_700_000_000_000;
  store.set(
    'beepsafe_ultima_sesion:marcelo@test.com',
    JSON.stringify({ actividad: 'Surf', equipo: '', tiempoSegundos: 1800 })
  );
  store.set(
    'beepsafe_sesion_en_curso:marcelo@test.com',
    JSON.stringify({
      actividad: 'Surf',
      equipo: [],
      tiempoSegundos: 900,
      inicioContadorMs: base - 5 * 60 * 1000,
    })
  );

  const t = crearContexto({
    fetch: async (url) => {
      if (url.includes('/api/sessions/current')) throw new Error('red caída');
      return respuestaOk(ACTIVIDADES);
    },
    store,
    ahora: base,
  });
  await t.domListo();

  // sin email la variante actual es la simple: ambas claves se reconcilian
  assert.equal(t.ctxTest.cargaCompleta, true);
  assert.ok(store.has('beepsafe_ultima_sesion'), 'ultima sesión migrada a la variante simple');
  assert.equal(store.has('beepsafe_ultima_sesion:marcelo@test.com'), false, 'origen eliminada');
  assert.ok(store.has('beepsafe_sesion_en_curso'), 'sesión en curso migrada a la variante simple');
  assert.equal(store.has('beepsafe_sesion_en_curso:marcelo@test.com'), false, 'origen eliminada');
  assert.equal(
    t.consola.infos.filter((mensaje) => mensaje.includes('reconciliado')).length,
    2,
    'ambas reconciliaciones logueadas'
  );

  // la sesión escrita bajo la otra variante se reanuda igual (no se pierde)
  assert.equal(t.nodos.etiquetaBoton.textContent, 'DETENER');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:10:00');

  // y el fallo de auth que originó el split-brain queda ruidoso (RES-001/003)
  assert.equal(t.nodos.filaValorActividad.textContent, 'No se pudieron cargar las actividades');
  assert.ok(
    t.consola.errores.some(
      (mensaje) => mensaje.includes('/api/sessions/current') && mensaje.includes('intento 2/2')
    )
  );
});
}

// ------------------------------------------------------------------ cierre

testsUI().finally(() => {
  console.log(`\n${pasados}/${total} tests OK`);
  if (pasados !== total) process.exitCode = 1;
});
