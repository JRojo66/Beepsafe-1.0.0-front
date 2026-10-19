// Tests del front estático para pages/iniciarDetener.html + JS/iniciarDetener.js
//
// El repo no tiene build ni runner de tests (REL-005): este script corre con
// Node puro, sin dependencias:
//
//     node tests/iniciarDetener.test.cjs
//
// Carga el script clásico en un contexto vm con stubs de DOM/fetch/localStorage
// y reloj controlable, y ejerce funciones puras + comportamiento de la UI.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUTA_SCRIPT = path.join(__dirname, '..', 'JS', 'iniciarDetener.js');
const FUENTE = fs.readFileSync(RUTA_SCRIPT, 'utf8');
const EXPORTS = `;globalThis.__test = {
  formatearTiempo, minutosValidos, imagenParaActividad, normalizarNombre,
  DURACIONES_MINUTOS, IMAGENES_POR_DEFECTO, IMAGEN_POR_ACTIVIDAD, CLAVE_ULTIMA_SESION,
  CLAVE_SESION_EN_CURSO,
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

function crearSelect() {
  const select = {
    _options: [],
    _value: '',
    disabled: false,
    listeners: {},
    style: {},
    get length() {
      return this._options.length;
    },
    set length(n) {
      this._options.length = n;
      if (n === 0) this._value = '';
    },
    get options() {
      return this._options;
    },
    get selectedOptions() {
      return this._options.filter((opt) => opt.value === this._value);
    },
    get value() {
      return this._value;
    },
    set value(v) {
      this._value = String(v);
    },
    add(opt) {
      this._options.push(opt);
      if (opt.selected || this._options.length === 1) {
        this._value = opt.value;
      }
    },
    addEventListener(tipo, fn) {
      (this.listeners[tipo] ||= []).push(fn);
    },
    disparar(tipo) {
      for (const fn of this.listeners[tipo] || []) fn();
    },
  };
  return select;
}

function crearNodo(extra = {}) {
  return {
    textContent: '',
    style: {},
    listeners: {},
    hijos: [],
    addEventListener(tipo, fn) {
      (this.listeners[tipo] ||= []).push(fn);
    },
    appendChild(hijo) {
      this.hijos.push(hijo);
      return hijo;
    },
    disparar(tipo) {
      for (const fn of this.listeners[tipo] || []) fn();
    },
    ...extra,
  };
}

function Option(texto, valor, _defaultSelected, seleccionada) {
  this.text = String(texto);
  this.value = valor == null ? '' : String(valor);
  this.selected = Boolean(seleccionada);
  this.disabled = false;
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
  };

  const nodos = {
    selectActividad: crearSelect(),
    selectEquipo: crearSelect(),
    selectTiempo: crearSelect(),
    botonIniciar: crearNodo(),
    etiquetaBoton: crearNodo({ textContent: 'INICIAR' }), // como en el HTML inicial
    iconoActividad: crearNodo({ src: '', alt: '' }),
    anilloProgreso: crearNodo({ getAttribute: () => '145' }),
    nombre: crearNodo(),
    'elegidoActividad': crearNodo(),
    'elegidoEquipo': crearNodo(),
    'elegidoTiempo': crearNodo(),
  };
  if (opciones.sinNodos) {
    for (const clave of opciones.sinNodos) delete nodos[clave];
  }

  const document = {
    getElementById: (id) => nodos[id] || null,
    createElement: (tag) => crearNodo({ tagName: String(tag).toUpperCase() }),
    querySelector: (sel) => {
      const mapa = {
        '.botonIniciar .tiempo': nodos.etiquetaTiempo,
        '.item1 .elegidos': nodos.elegidoActividad,
        '.item2 .elegidos': nodos.elegidoEquipo,
        '.item3 .elegidos': nodos.elegidoTiempo,
      };
      const nodo = mapa[sel];
      return nodo === undefined ? null : nodo;
    },
  };
  nodos.etiquetaTiempo = crearNodo();

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

  const ctx = {
    ROOT_URL: 'http://back.test',
    window,
    document,
    localStorage,
    fetch,
    Option,
    Date: FechaFalsa,
    // Los timers del auth (timeout de 8000 ms) nunca se disparan en el test:
    // el reloj es falso y probar el abort quedaría cubierto aparte.
    setTimeout: () => 0,
    clearTimeout: () => {},
    AbortController: class {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
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
    console,
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
  };
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

test('minutosValidos acepta solo duraciones de la lista', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.minutosValidos(15 * 60), true);
  assert.equal(t.ctxTest.minutosValidos(180 * 60), true);
  assert.equal(t.ctxTest.minutosValidos(0), false, 'cero no es válido (REL-007)');
  assert.equal(t.ctxTest.minutosValidos(-15 * 60), false);
  assert.equal(t.ctxTest.minutosValidos(NaN), false);
  assert.equal(t.ctxTest.minutosValidos(100), false, '100 s no es múltiplo de la lista');
  assert.equal(t.ctxTest.minutosValidos(90 * 60 + 30), false, 'minutos no enteros');
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

console.log('# iniciarDetener.js — UI');

async function testsUI() {
await testAsync('init ok: selects poblados, tiempo default 180, ícono con src', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  if (process.env.DEBUG_TEST) {
    console.log('    [dbg] fetchLog:', t.fetchLog.map((l) => l.url));
    console.log('    [dbg] options:', t.nodos.selectActividad.options.map((o) => o.text));
    console.log('    [dbg] etiquetaTiempo:', JSON.stringify(t.nodos.etiquetaTiempo && t.nodos.etiquetaTiempo.textContent));
  }

  assert.equal(t.nodos.selectActividad.options.length, 2);
  assert.equal(t.nodos.selectActividad.value, 'Windsurf');
  assert.equal(t.nodos.selectTiempo.value, '180');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '03:00:00');
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR');
  assert.equal(t.nodos.elegidoActividad.textContent, 'Windsurf');
  assert.equal(t.nodos.elegidoEquipo.textContent, 'Goya verde 5.0', 'primer equipo por defecto');
  assert.ok(t.nodos.iconoActividad.src.endsWith('IlustracionWindsurf.png'));
  assert.ok(t.nodos.iconoActividad.src.startsWith('../imagenes/'));
});

await testAsync('restaura la última sesión guardada desde localStorage', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Surf', equipo: '', tiempoSegundos: 30 * 60 })
  );
  await t.domListo();

  assert.equal(t.nodos.selectActividad.value, 'Surf');
  assert.equal(t.nodos.selectTiempo.value, '30');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:30:00');
  assert.ok(t.nodos.iconoActividad.src.endsWith('Surf.png'));
});

await testAsync('actividad guardada ya eliminada -> primera actividad (REL-007 contexto)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Wing foil', equipo: 'Ala X', tiempoSegundos: 0 })
  );
  await t.domListo();

  assert.equal(t.nodos.selectActividad.value, 'Windsurf', 'primera de la lista');
  assert.equal(t.nodos.selectTiempo.value, '180', 'tiempo inválido (0) -> default');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '03:00:00');
});

await testAsync('tiempo guardado no válido (0 o basura) -> default 180 (REL-007)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set('beepsafe_ultima_sesion', JSON.stringify({ actividad: 'Windsurf', equipo: '', tiempoSegundos: 0 }));
  await t.domListo();
  assert.equal(t.nodos.selectTiempo.value, '180');

  const t2 = crearContexto({ fetch: fetchNormal() });
  t2.store.set('beepsafe_ultima_sesion', 'no-es-json{"actividad"');
  await t2.domListo();
  assert.equal(t2.nodos.selectTiempo.value, '180', 'JSON corrupto no rompe');
});

await testAsync('fetch de actividades falla -> degradado "Sin actividades", sin throw', async () => {
  const t = crearContexto({
    fetch: async (url) => {
      if (url.includes('/api/sessions/current')) return respuestaOk(USUARIO);
      throw new Error('red caída');
    },
  });
  await t.domListo();
  assert.equal(t.nodos.selectActividad.options.length, 1);
  assert.equal(t.nodos.selectActividad.options[0].text, 'Sin actividades');
  // sin actividad, Equipo muestra su placeholder (REL-109)
  assert.equal(t.nodos.selectEquipo.options.length, 1);
  assert.equal(t.nodos.selectEquipo.options[0].text, 'Sin actividad');
  assert.equal(t.nodos.selectEquipo.options[0].disabled, true);
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR');
});

await testAsync('actividad sin equipo -> opción "Sin equipo" deshabilitada', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  t.nodos.selectActividad.value = 'Surf';
  t.nodos.selectActividad.disparar('change');
  assert.equal(t.nodos.selectEquipo.options.length, 1);
  assert.equal(t.nodos.selectEquipo.options[0].text, 'Sin equipo');
  assert.equal(t.nodos.selectEquipo.options[0].disabled, true);
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

await testAsync('sin token / current falla -> redirect a iniciarSesion.html', async () => {
  const t = crearContexto({ fetch: async () => respuestaFail() });
  await t.domListo();
  const href = vm.runInContext('window.location.href', t.ctx);
  assert.equal(href, 'iniciarSesion.html');
});

await testAsync('INICIAR corre con wall-clock; DETENER resetea (REL-002)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.nodos.selectTiempo.value = '15';
  t.nodos.selectTiempo.disparar('change');
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

await testAsync('al llegar a 0 -> FINALIZADO; cambiar select lo reinicia (REL-001)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();

  t.nodos.selectTiempo.value = '15';
  t.nodos.selectTiempo.disparar('change');
  t.nodos.botonIniciar.disparar('click');

  t.reloj.ahora += 15 * 60 * 1000;
  t.tick();
  assert.equal(t.nodos.etiquetaBoton.textContent, 'FINALIZADO');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:00:00');

  // REL-001: cambiar el tiempo estando FINALIZADO vuelve a INICIAR con el nuevo tiempo
  t.nodos.selectTiempo.value = '30';
  t.nodos.selectTiempo.disparar('change');
  assert.equal(t.nodos.etiquetaBoton.textContent, 'INICIAR');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:30:00');
});

await testAsync('duración 0 no inicia ni persiste basura (REL-007)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  // Fuerza estado con duración 0 vía el estado interno del select (no está en la lista,
  // pero el guard de iniciarContador debe cubrirlo)
  t.nodos.selectTiempo.value = '0';
  t.nodos.selectTiempo.disparar('change');
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
  assert.equal(guardada.equipo, 'Goya verde 5.0');
  assert.equal(guardada.tiempoSegundos, 180 * 60);
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
  t.nodos.selectTiempo.value = '15';
  t.nodos.selectTiempo.disparar('change');
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
  t.nodos.selectTiempo.value = '15';
  t.nodos.selectTiempo.disparar('change');
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

await testAsync('selects deshabilitados mientras corre; se reactivan al DETENER y al FINALIZADO', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  t.nodos.selectTiempo.value = '15';
  t.nodos.selectTiempo.disparar('change');

  t.nodos.botonIniciar.disparar('click');
  assert.equal(t.nodos.selectActividad.disabled, true, 'bloqueados al INICIAR (REL-103)');
  assert.equal(t.nodos.selectEquipo.disabled, true);
  assert.equal(t.nodos.selectTiempo.disabled, true);

  t.nodos.botonIniciar.disparar('click'); // DETENER
  assert.equal(t.nodos.selectActividad.disabled, false, 'libres al DETENER');
  assert.equal(t.nodos.selectEquipo.disabled, false);
  assert.equal(t.nodos.selectTiempo.disabled, false);

  t.nodos.botonIniciar.disparar('click');
  t.reloj.ahora += 15 * 60 * 1000;
  t.tick();
  assert.equal(t.nodos.etiquetaBoton.textContent, 'FINALIZADO');
  assert.equal(t.nodos.selectActividad.disabled, false, 'libres al FINALIZADO (REL-001)');
  assert.equal(t.nodos.selectEquipo.disabled, false);
  assert.equal(t.nodos.selectTiempo.disabled, false);
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

await testAsync('current lanza (red caída) -> sin redirect y carga degradada (REL-104)', async () => {
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
  assert.equal(t.nodos.selectActividad.options[0].text, 'Sin actividades', 'carga degradada sin email');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '03:00:00', 'la carga llegó hasta el final');
});

await testAsync('reiniciar tras FINALIZADO sin tocar selects -> DETENER con el tiempo completo', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  await t.domListo();
  t.nodos.selectTiempo.value = '15';
  t.nodos.selectTiempo.disparar('change');
  t.nodos.botonIniciar.disparar('click');
  t.reloj.ahora += 15 * 60 * 1000;
  t.tick();
  assert.equal(t.nodos.etiquetaBoton.textContent, 'FINALIZADO');

  t.nodos.botonIniciar.disparar('click'); // sin cambiar ningún select
  assert.equal(t.nodos.etiquetaBoton.textContent, 'DETENER');
  assert.equal(t.nodos.etiquetaTiempo.textContent, '00:15:00', 'vuelve el tiempo completo');
});

await testAsync('la última sesión está namespaceada por email (REL-106)', async () => {
  const payload = JSON.stringify({ actividad: 'Surf', equipo: '', tiempoSegundos: 30 * 60 });

  const t1 = crearContexto({ fetch: fetchNormal() });
  t1.store.set('beepsafe_ultima_sesion:marcelo@test.com', payload);
  await t1.domListo();
  assert.equal(t1.nodos.selectActividad.value, 'Surf', 'la clave del usuario sí restaura');
  assert.equal(t1.nodos.selectTiempo.value, '30');

  const t2 = crearContexto({ fetch: fetchNormal() });
  t2.store.set('beepsafe_ultima_sesion:otro@test.com', payload);
  await t2.domListo();
  assert.equal(t2.nodos.selectActividad.value, 'Windsurf', 'la clave de otro usuario no restaura');
  assert.equal(t2.nodos.selectTiempo.value, '180');
});

await testAsync('clave legada se migra al namespace del usuario (REL-106)', async () => {
  const t = crearContexto({ fetch: fetchNormal() });
  t.store.set(
    'beepsafe_ultima_sesion',
    JSON.stringify({ actividad: 'Surf', equipo: '', tiempoSegundos: 45 * 60 })
  );
  await t.domListo();
  assert.equal(t.nodos.selectActividad.value, 'Surf', 'se restaura desde la clave legada');
  assert.equal(t.nodos.selectTiempo.value, '45');
  assert.ok(t.store.has('beepsafe_ultima_sesion:marcelo@test.com'), 'migrada al namespace');
  assert.equal(t.store.has('beepsafe_ultima_sesion'), false, 'clave legada eliminada');
});

await testAsync('sesión en curso se reanuda al recargar (REL-105)', async () => {
  const store = new Map();
  const base = 1_700_000_000_000;

  const t1 = crearContexto({ fetch: fetchNormal(), store, ahora: base });
  const clave = `${t1.ctxTest.CLAVE_SESION_EN_CURSO}:marcelo@test.com`;
  await t1.domListo();
  t1.nodos.selectTiempo.value = '15';
  t1.nodos.selectTiempo.disparar('change');
  t1.nodos.botonIniciar.disparar('click');
  assert.equal(t1.nodos.etiquetaBoton.textContent, 'DETENER');
  assert.ok(store.has(clave), 'se persiste al INICIAR');

  // "recarga" 5 minutos después: sigue corriendo con el tiempo restante
  const t2 = crearContexto({ fetch: fetchNormal(), store, ahora: base + 5 * 60 * 1000 });
  await t2.domListo();
  assert.equal(t2.nodos.etiquetaBoton.textContent, 'DETENER');
  assert.equal(t2.nodos.etiquetaTiempo.textContent, '00:10:00');
  assert.equal(t2.nodos.selectActividad.disabled, true);
  assert.equal(t2.nodos.selectEquipo.disabled, true);
  assert.equal(t2.nodos.selectTiempo.disabled, true);
  assert.ok(store.has(clave), 'sigue guardada mientras corre');

  // "recarga" 20 minutos después: la ventana venció -> detenido y sin clave
  const t3 = crearContexto({ fetch: fetchNormal(), store, ahora: base + 20 * 60 * 1000 });
  await t3.domListo();
  assert.equal(t3.nodos.etiquetaBoton.textContent, 'INICIAR', 'no salta a FINALIZADO');
  assert.equal(t3.nodos.etiquetaTiempo.textContent, '00:15:00');
  assert.equal(store.has(clave), false, 'clave vencida eliminada');
});
}

// ------------------------------------------------------------------ cierre

testsUI().finally(() => {
  console.log(`\n${pasados}/${total} tests OK`);
  if (pasados !== total) process.exitCode = 1;
});
