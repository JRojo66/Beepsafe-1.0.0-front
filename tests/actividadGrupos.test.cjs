const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUTA_SCRIPT = path.join(__dirname, '..', 'JS', 'actividadGrupos.js');
const FUENTE = fs.readFileSync(RUTA_SCRIPT, 'utf8');
const EXPORTS = `;globalThis.__test = {
  normalizarGrupos, normalizarEstadoActividad, calcularProgreso,
  formatearHoraActividad, formatearFechaInteraccion, secundarioGrupo,
  renderizarGrupos, renderizarDetalleActividad, abrirDetalleGrupo,
  cargarGrupos, cargarDetalleGrupo, volverListaActividadGrupos,
  crearTarjetaMiembro, construirListasActividad, crearBurbujaMensaje,
  agregarMensajeActividad, alternarChatActividad, enviarMensajeActividad,
};`;

const AHORA = Date.UTC(2026, 4, 18, 12, 0); // lunes 09:00 en Buenos Aires

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

function crearNodo(extra = {}) {
  const clases = new Set();
  const nodo = {
    textContent: '',
    hidden: false,
    value: '',
    src: '',
    alt: '',
    style: {},
    hijos: [],
    atributos: {},
    listeners: {},
    _html: '',
    addEventListener(tipo, fn) {
      (this.listeners[tipo] ||= []).push(fn);
    },
    appendChild(hijo) {
      hijo._parent = this;
      this.hijos.push(hijo);
      return hijo;
    },
    removeChild(hijo) {
      const indice = this.hijos.indexOf(hijo);
      if (indice >= 0) this.hijos.splice(indice, 1);
      hijo._parent = null;
      return hijo;
    },
    remove() {
      if (this._parent && typeof this._parent.removeChild === 'function') {
        this._parent.removeChild(this);
      }
    },
    focus() {
      this.focused = true;
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
  nodo.classList = {
    add: (...cs) => cs.forEach((c) => clases.add(c)),
    remove: (...cs) => cs.forEach((c) => clases.delete(c)),
    contains: (c) => clases.has(c),
    toggle: (c, fuerza) => {
      const debeEstar = fuerza === undefined ? !clases.has(c) : Boolean(fuerza);
      if (debeEstar) clases.add(c);
      else clases.delete(c);
      return debeEstar;
    },
  };
  Object.defineProperty(nodo, 'childElementCount', {
    get: () => nodo.hijos.length,
  });
  let nombreClase = '';
  Object.defineProperty(nodo, 'className', {
    get: () => nombreClase,
    set: (valor) => {
      nombreClase = String(valor);
      clases.clear();
      nombreClase
        .split(/\s+/)
        .filter(Boolean)
        .forEach((clase) => clases.add(clase));
    },
  });
  return Object.assign(nodo, extra);
}

function respuestaOk(json) {
  return { ok: true, status: 200, json: async () => json };
}

function crearContextoActividadGrupos(opciones = {}) {
  const nodos = {
    vistaListaActividadGrupos: crearNodo(),
    vistaDetalleActividadGrupos: crearNodo({ hidden: true }),
    estadoListaGrupos: crearNodo(),
    botonReintentarGrupos: crearNodo({ hidden: true }),
    listaGrupos: crearNodo(),
    volverListaGrupos: crearNodo(),
    tituloDetalleGrupo: crearNodo(),
    toggleEliminadosGrupo: crearNodo({ tagName: 'INPUT', checked: false }),
    estadoDetalleActividad: crearNodo(),
    botonReintentarDetalle: crearNodo({ hidden: true }),
    listaVencidos: crearNodo(),
    listaEnCurso: crearNodo(),
    listaTerminados: crearNodo(),
    estadoEliminarSesion: crearNodo(),
    modalEliminarSesion: crearNodo({ className: 'modal hidden' }),
    continuarEliminarSesion: crearNodo({ textContent: 'Continuar' }),
    cancelarEliminarSesion: crearNodo({ textContent: 'Cancelar' }),
    cerrarModalEliminarSesion: crearNodo({ textContent: '×' }),
    modalConfirmarEliminarSesion: crearNodo({ className: 'modal hidden' }),
    eliminarSesion: crearNodo({ textContent: 'Eliminar' }),
    cancelarConfirmarEliminar: crearNodo({ textContent: 'Cancelar' }),
    cerrarModalConfirmarEliminar: crearNodo({ textContent: '×' }),
    visorFotoEquipo: crearNodo({ className: 'visor-foto hidden' }),
    imagenVisorFotoEquipo: crearNodo({ tagName: 'IMG', src: '', alt: '' }),
    cerrarVisorFotoEquipo: crearNodo({ textContent: '×' }),
    toggleChatGrupo: crearNodo({ textContent: 'Ocultar chat' }),
    formMensajeGrupo: crearNodo({ tagName: 'FORM' }),
    entradaMensajeGrupo: crearNodo({ tagName: 'INPUT', value: '' }),
    enviarMensajeGrupo: crearNodo({ tagName: 'BUTTON', disabled: false }),
    errorMensajeGrupo: crearNodo(),
    body: crearNodo({ style: {} }),
  };
  nodos.modalEliminarSesion.classList.add('hidden');
  nodos.modalConfirmarEliminarSesion.classList.add('hidden');
  nodos.visorFotoEquipo.classList.add('hidden');

  const documentHandlers = {};
  const document = {
    getElementById: (id) => nodos[id] || null,
    createElement: (tag) => crearNodo({ tagName: String(tag).toUpperCase() }),
    addEventListener(tipo, fn) {
      (documentHandlers[tipo] ||= []).push(fn);
    },
    visibilityState: opciones.visibilityState || 'visible',
    body: nodos.body,
  };

  let reloj = Number.isFinite(opciones.ahora) ? opciones.ahora : AHORA;
  const DateReal = Date;
  class FechaFalsa extends DateReal {
    constructor(...args) {
      super(...(args.length ? args : [reloj]));
    }
    static now() {
      return reloj;
    }
  }

  const windowHandlers = {};
  const ventana = {
    addEventListener(tipo, fn) {
      (windowHandlers[tipo] ||= []).push(fn);
    },
  };

  const intervalos = new Map();
  let siguienteIntervalo = 1;
  const debugLog = [];
  const eventSources = [];
  const token = opciones.token === undefined ? 'tok-grupos' : opciones.token;

  class EventSourceFalso {
    constructor(url) {
      this.url = String(url);
      this.cerrado = false;
      this.listeners = {};
      eventSources.push(this);
    }
    addEventListener(tipo, fn) {
      (this.listeners[tipo] ||= []).push(fn);
    }
    close() {
      this.cerrado = true;
    }
    emitir(tipo, datos) {
      const evento = { data: JSON.stringify(datos) };
      for (const fn of this.listeners[tipo] || []) fn(evento);
    }
  }

  const fetchLog = [];
  const fetchImpl = opciones.fetch || (async () => respuestaOk({ groups: [] }));
  const ctx = {
    ROOT_URL: 'http://back.test',
    window: ventana,
    document,
    setInterval(fn, ms) {
      const id = siguienteIntervalo++;
      intervalos.set(id, { fn, ms });
      return id;
    },
    clearInterval(id) {
      intervalos.delete(id);
    },
    localStorage: {
      getItem: (clave) => (clave === 'token' ? token : null),
    },
    fetch: async (url, init) => {
      fetchLog.push({ url: String(url), init });
      return fetchImpl(String(url), init);
    },
    EventSource: EventSourceFalso,
    atob: (valor) => Buffer.from(String(valor), 'base64').toString('binary'),
    Date: FechaFalsa,
    Intl,
    console: {
      error: () => {},
      debug: (mensaje) => debugLog.push(String(mensaje)),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(FUENTE + EXPORTS, ctx, { filename: 'actividadGrupos.js' });
  return {
    ctx,
    ctxTest: ctx.__test,
    nodos,
    fetchLog,
    intervalos,
    debugLog,
    eventSources,
    token,
    avanzarReloj(ms) {
      reloj += ms;
    },
    dispararDocumento(tipo, evento) {
      for (const fn of documentHandlers[tipo] || []) fn(evento);
    },
    dispararWindow(tipo, evento) {
      for (const fn of windowHandlers[tipo] || []) fn(evento);
    },
  };
}

function buscarPorClase(nodo, clase) {
  if (!nodo) return null;
  if (nodo.classList && nodo.classList.contains(clase)) return nodo;
  for (const hijo of nodo.hijos || []) {
    const encontrado = buscarPorClase(hijo, clase);
    if (encontrado) return encontrado;
  }
  return null;
}

function buscarTodosPorClase(nodo, clase, encontrados = []) {
  if (!nodo) return encontrados;
  if (nodo.classList && nodo.classList.contains(clase)) encontrados.push(nodo);
  for (const hijo of nodo.hijos || []) buscarTodosPorClase(hijo, clase, encontrados);
  return encontrados;
}

function textosDe(nodo) {
  const textos = [];
  (function recorrer(actual) {
    if (!actual) return;
    if (typeof actual.textContent === 'string' && actual.textContent !== '') {
      textos.push(actual.textContent);
    }
    for (const hijo of actual.hijos || []) recorrer(hijo);
  })(nodo);
  return textos;
}

async function esperar(condicion, intentos = 200) {
  for (let i = 0; i < intentos; i++) {
    if (condicion()) return;
    await new Promise((resolver) => setTimeout(resolver, 1));
  }
  assert.ok(condicion(), 'la condición esperada no se cumplió');
}

function intervalosDe(contexto, ms) {
  return [...contexto.intervalos.values()].filter((intervalo) => intervalo.ms === ms);
}

function crearTokenActividad(payload) {
  const base64 = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `x.${base64}.y`;
}

const GRUPO = { _id: 'g1', name: 'Surf', members: [1, 2, 3] };

const MIEMBRO_VENCIDO = {
  id: 'v1',
  tipo: 'sesion',
  puedeEliminar: true,
  usuario: 'Ana',
  actividad: 'Surf',
  inicio: new Date(AHORA - 60 * 60 * 1000).toISOString(),
  finPrevisto: new Date(AHORA - 30 * 60 * 1000).toISOString(),
  estadoAlarma: 'enviada',
  telefono: '+54 9 11 1234-5678',
  equipos: [
    { nombre: 'Tabla', foto: 'tabla.png' },
    { nombre: 'Quilla', foto: null },
  ],
};

const MIEMBRO_EN_CURSO = {
  id: 'c1',
  tipo: 'sesion',
  usuario: 'Beto',
  actividad: 'Kayak',
  inicio: new Date(AHORA - 30 * 60 * 1000).toISOString(),
  finPrevisto: new Date(AHORA + 30 * 60 * 1000).toISOString(),
  telefono: '+54 11 0000-0000',
  equipos: [],
};

const MIEMBRO_EN_CURSO_2 = {
  id: 'c2',
  tipo: 'sesion',
  usuario: 'Carla',
  actividad: 'Windsurf',
  inicio: new Date(AHORA).toISOString(),
  finPrevisto: new Date(AHORA + 60 * 60 * 1000).toISOString(),
  telefono: '+54 11 1111-1111',
  equipos: [],
};

const MENSAJE_ANTES = {
  id: 'm1',
  userId: 'u2',
  usuario: 'Ana',
  texto: 'Antes de la actividad',
  enviadoEn: new Date(AHORA - 60 * 60 * 1000).toISOString(),
};

const MENSAJE_MEDIO = {
  id: 'm2',
  userId: 'u2',
  usuario: 'Ana',
  texto: 'Entre actividades',
  enviadoEn: new Date(AHORA - 10 * 60 * 1000).toISOString(),
};

const MENSAJE_DESPUES = {
  id: 'm3',
  userId: 'u2',
  usuario: 'Ana',
  texto: 'Después de la última',
  enviadoEn: new Date(AHORA + 10 * 60 * 1000).toISOString(),
};

const MENSAJE_PROPIO = {
  id: 'm-propio',
  userId: 'u1',
  usuario: 'Marcelo',
  texto: 'Mensaje propio',
  enviadoEn: new Date(AHORA - 5 * 60 * 1000).toISOString(),
};

const MENSAJE_AJENO = {
  id: 'm-ajeno',
  userId: 'u2',
  usuario: 'Ana',
  texto: 'Mensaje ajeno',
  enviadoEn: new Date(AHORA - 10 * 60 * 1000).toISOString(),
};

const MIEMBRO_TERMINADO = {
  id: 'r1',
  tipo: 'registro',
  puedeEliminar: true,
  usuario: 'Carla',
  actividad: 'Windsurf',
  inicio: new Date(AHORA - 120 * 60 * 1000).toISOString(),
  finPrevisto: new Date(AHORA - 60 * 60 * 1000).toISOString(),
  fin: new Date(AHORA - 90 * 60 * 1000).toISOString(),
  telefono: '+54 11 2222-3333',
  equipos: [{ nombre: 'Vela', foto: 'vela.png' }],
};

const SESION_ELIMINADA = {
  id: 'e1',
  tipo: 'sesion',
  eliminado: true,
  puedeEliminar: true,
  usuario: 'Dani',
  actividad: 'Surf',
  inicio: new Date(AHORA - 60 * 60 * 1000).toISOString(),
  finPrevisto: new Date(AHORA - 30 * 60 * 1000).toISOString(),
  fin: new Date(AHORA - 45 * 60 * 1000).toISOString(),
  estadoAlarma: 'enviada',
  telefono: '+54 9 11 5555-1111',
  equipos: [{ nombre: 'Tabla', foto: 'tabla.png' }],
};

const REGISTRO_ELIMINADO = {
  id: 'e2',
  tipo: 'registro',
  eliminado: true,
  puedeEliminar: true,
  usuario: 'Eva',
  actividad: 'Windsurf',
  inicio: new Date(AHORA - 120 * 60 * 1000).toISOString(),
  finPrevisto: new Date(AHORA - 60 * 60 * 1000).toISOString(),
  fin: new Date(AHORA - 90 * 60 * 1000).toISOString(),
  telefono: '+54 9 11 6666-2222',
  equipos: [{ nombre: 'Vela', foto: 'vela.png' }],
};

function estadoCompleto() {
  return {
    vencidos: [MIEMBRO_VENCIDO],
    enCurso: [MIEMBRO_EN_CURSO],
    terminados: [MIEMBRO_TERMINADO],
  };
}

async function tests() {
console.log('# actividadGrupos.js — lista');

test('la lista respeta el orden de la API y arma la línea secundaria', () => {
  const t = crearContextoActividadGrupos();
  t.ctxTest.renderizarGrupos([
    { _id: 'g2', name: 'Kayak', members: [1, 2] },
    { _id: 'g1', name: 'Surf', ultimaInteraccion: '2026-05-18T10:30:00.000Z' },
  ]);

  assert.equal(t.nodos.listaGrupos.hijos.length, 2);
  const primera = textosDe(t.nodos.listaGrupos.hijos[0]);
  const segunda = textosDe(t.nodos.listaGrupos.hijos[1]);
  assert.ok(primera.includes('Kayak'));
  assert.ok(primera.includes('2 integrantes'));
  assert.ok(segunda.includes('Surf'));
  assert.ok(segunda.some((texto) => texto.includes('18/05 07:30')));
});

test('la lista vacía muestra el estado vacío', () => {
  const t = crearContextoActividadGrupos();
  t.ctxTest.renderizarGrupos([]);
  assert.equal(t.nodos.listaGrupos.hijos.length, 0);
  assert.ok(t.nodos.estadoListaGrupos.textContent.includes('No tenés grupos'));
});

await testAsync('la lista muestra error y reintento si falla el GET', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => {
      throw new Error('sin red');
    },
  });
  await t.ctxTest.cargarGrupos();
  assert.ok(t.nodos.estadoListaGrupos.textContent.includes('No se pudieron cargar los grupos'));
  assert.equal(t.nodos.botonReintentarGrupos.hidden, false);
});

console.log('# actividadGrupos.js — detalle');

await testAsync('una tarjeta abre el detalle y muestra el título del grupo', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  t.ctxTest.renderizarGrupos([GRUPO]);

  t.nodos.listaGrupos.hijos[0].disparar('click');
  await esperar(() => t.nodos.vistaDetalleActividadGrupos.hidden === false);

  assert.equal(t.nodos.vistaListaActividadGrupos.hidden, true);
  assert.equal(t.nodos.vistaDetalleActividadGrupos.hidden, false);
  assert.equal(t.nodos.tituloDetalleGrupo.textContent, 'Surf');
  assert.equal(t.fetchLog[0].url, 'http://back.test/api/groups/g1/activity-state');
  assert.equal(t.fetchLog[0].init.headers.Authorization, 'Bearer tok-grupos');
});

await testAsync('las tres secciones reciben los arrays correctos del activity-state', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  assert.equal(t.nodos.listaVencidos.hijos.length, 1);
  assert.equal(t.nodos.listaEnCurso.hijos.length, 1);
  assert.equal(t.nodos.listaTerminados.hijos.length, 1);
  assert.ok(textosDe(t.nodos.listaVencidos.hijos[0]).includes('Ana'));
  assert.ok(textosDe(t.nodos.listaEnCurso.hijos[0]).includes('Beto'));
  assert.ok(textosDe(t.nodos.listaTerminados.hijos[0]).includes('Carla'));
});

test('las secciones están en el orden vencidos, en curso y finalizadas', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'actividadGrupos.html'),
    'utf8'
  );
  const posVencidos = html.indexOf('id="seccionVencidos"');
  const posEnCurso = html.indexOf('id="seccionEnCurso"');
  const posTerminados = html.indexOf('id="seccionTerminados"');
  assert.ok(posVencidos > -1 && posVencidos < posEnCurso);
  assert.ok(posEnCurso < posTerminados);
  const titulos = [...html.matchAll(/grupo-actividad-seccion-titulo">([^<]+)</g)].map(
    (coincidencia) => coincidencia[1]
  );
  assert.deepEqual(titulos, ['Alarmas vencidas', 'En actividad', 'Finalizadas']);
});

await testAsync('un vencido se marca en rojo y muestra el estado de la alarma', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const card = t.nodos.listaVencidos.hijos[0];
  assert.ok(card.classList.contains('grupo-miembro-card-vencido'));
  const etiqueta = buscarPorClase(card, 'grupo-alarma-estado');
  assert.ok(etiqueta);
  assert.equal(etiqueta.textContent, 'Alarma: enviada');
});

await testAsync('un registro muestra el Fin real y nunca "Fin previsto"', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const registro = t.nodos.listaTerminados.hijos[0];
  const horas = buscarPorClase(registro, 'grupo-miembro-horas');
  assert.ok(horas.textContent.includes('Fin: 07:30'), horas.textContent);
  assert.ok(!horas.textContent.includes('Fin previsto'), horas.textContent);
});

await testAsync('una sesión sigue mostrando "Fin previsto"', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const sesion = t.nodos.listaEnCurso.hijos[0];
  const horas = buscarPorClase(sesion, 'grupo-miembro-horas');
  assert.ok(horas.textContent.includes('Fin previsto: 09:30'), horas.textContent);
  assert.ok(!horas.textContent.includes('Fin: 09:30'), horas.textContent);
});

await testAsync('un registro sin fin muestra el guion', async () => {
  const sinFin = { ...MIEMBRO_TERMINADO, fin: null };
  const t = crearContextoActividadGrupos({
    fetch: async () =>
      respuestaOk({ activityState: { vencidos: [], enCurso: [], terminados: [sinFin] } }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const registro = t.nodos.listaTerminados.hijos[0];
  const horas = buscarPorClase(registro, 'grupo-miembro-horas');
  assert.ok(horas.textContent.includes('Fin: —'), horas.textContent);
  assert.ok(!horas.textContent.includes('Fin previsto'), horas.textContent);
});

await testAsync('la barra de progreso usa la proporción y los vencidos quedan al 100%', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });

  const inicio = new Date(AHORA - 30 * 60 * 1000).toISOString();
  const finPrevisto = new Date(AHORA + 30 * 60 * 1000).toISOString();
  assert.equal(t.ctxTest.calcularProgreso(inicio, finPrevisto, null, false), 50);
  assert.equal(
    t.ctxTest.calcularProgreso(
      new Date(AHORA - 120 * 60 * 1000).toISOString(),
      new Date(AHORA - 60 * 60 * 1000).toISOString(),
      new Date(AHORA - 90 * 60 * 1000).toISOString(),
      false
    ),
    50
  );
  assert.equal(t.ctxTest.calcularProgreso(inicio, finPrevisto, null, true), 100);

  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  const barraEnCurso = buscarPorClase(
    t.nodos.listaEnCurso.hijos[0],
    'grupo-progreso-barra'
  );
  const barraVencido = buscarPorClase(
    t.nodos.listaVencidos.hijos[0],
    'grupo-progreso-barra'
  );
  assert.equal(barraEnCurso.style.width, '50%');
  assert.equal(barraVencido.style.width, '100%');
  assert.equal(
    buscarPorClase(t.nodos.listaTerminados.hijos[0], 'grupo-progreso'),
    null,
    'finalizadas no muestran barra'
  );
});

await testAsync('el intervalo de progreso solo se crea con tarjetas en curso', async () => {
  const conEnCurso = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await conEnCurso.ctxTest.abrirDetalleGrupo(GRUPO);

  const intervalosProgreso = intervalosDe(conEnCurso, 10000);
  assert.equal(intervalosProgreso.length, 1, 'hay un único intervalo de progreso');
  assert.equal(intervalosProgreso[0].ms, 10000);
  const barra = buscarPorClase(
    conEnCurso.nodos.listaEnCurso.hijos[0],
    'grupo-progreso-en-curso'
  );
  assert.ok(barra, 'la barra en curso queda marcada para actualizarse');
  assert.equal(barra.getAttribute('data-inicio'), MIEMBRO_EN_CURSO.inicio);
  assert.equal(barra.getAttribute('data-fin-previsto'), MIEMBRO_EN_CURSO.finPrevisto);

  const sinEnCurso = crearContextoActividadGrupos({
    fetch: async () =>
      respuestaOk({
        activityState: {
          vencidos: [MIEMBRO_VENCIDO],
          enCurso: [],
          terminados: [MIEMBRO_TERMINADO],
        },
      }),
  });
  await sinEnCurso.ctxTest.abrirDetalleGrupo(GRUPO);
  assert.equal(
    intervalosDe(sinEnCurso, 10000).length,
    0,
    'sin en curso no hay intervalo de progreso'
  );
});

await testAsync('el progreso en curso avanza con el reloj sin volver a renderizar', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const tarjeta = t.nodos.listaEnCurso.hijos[0];
  const barra = buscarPorClase(tarjeta, 'grupo-progreso-barra');
  assert.equal(barra.style.width, '50%');
  const [intervalo] = intervalosDe(t, 10000);

  t.avanzarReloj(15 * 60 * 1000);
  intervalo.fn();

  assert.equal(barra.style.width, '75%');
  assert.equal(t.nodos.listaEnCurso.hijos[0], tarjeta, 'no se re-renderiza la tarjeta');
  assert.equal(
    buscarPorClase(t.nodos.listaVencidos.hijos[0], 'grupo-progreso-barra').style.width,
    '100%'
  );
  assert.equal(
    buscarPorClase(t.nodos.listaTerminados.hijos[0], 'grupo-progreso'),
    null,
    'las finalizadas siguen sin barra'
  );
});

await testAsync('volver y pagehide detienen el intervalo de progreso', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  assert.equal(intervalosDe(t, 10000).length, 1);

  t.nodos.volverListaGrupos.disparar('click');
  assert.equal(intervalosDe(t, 10000).length, 0, 'volver a la lista detiene el intervalo');

  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  assert.equal(intervalosDe(t, 10000).length, 1);

  t.dispararWindow('pagehide', {});
  assert.equal(intervalosDe(t, 10000).length, 0, 'pagehide detiene el intervalo');
});

await testAsync('el progreso se pausa con la pestaña oculta y se actualiza al volver', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const barra = buscarPorClase(t.nodos.listaEnCurso.hijos[0], 'grupo-progreso-barra');
  const [intervalo] = intervalosDe(t, 10000);
  const consultasIniciales = t.fetchLog.length;

  t.ctx.document.visibilityState = 'hidden';
  t.avanzarReloj(15 * 60 * 1000);
  intervalo.fn();
  assert.equal(barra.style.width, '50%', 'oculta no recalcula');
  assert.equal(t.fetchLog.length, consultasIniciales, 'oculta no consulta al servidor');

  t.ctx.document.visibilityState = 'visible';
  t.dispararDocumento('visibilitychange', {});
  assert.equal(barra.style.width, '75%', 'al volver visible actualiza');
});

await testAsync('el detalle programa un refresco completo cada 60 segundos', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const refrescos = intervalosDe(t, 60000);
  assert.equal(refrescos.length, 1, 'hay un único refresco de detalle');
  assert.equal(refrescos[0].ms, 60000);
  assert.equal(intervalosDe(t, 10000).length, 1, 'el progreso sigue independiente');

  const sinEnCurso = crearContextoActividadGrupos({
    fetch: async () =>
      respuestaOk({
        activityState: {
          vencidos: [MIEMBRO_VENCIDO],
          enCurso: [],
          terminados: [MIEMBRO_TERMINADO],
        },
      }),
  });
  await sinEnCurso.ctxTest.abrirDetalleGrupo(GRUPO);
  assert.equal(intervalosDe(sinEnCurso, 60000).length, 1, 'el refresco no depende de en curso');
});

await testAsync('el refresco conserva incluirEliminados y vuelve a renderizar', async () => {
  let activityState = estadoCompleto();
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  t.nodos.toggleEliminadosGrupo.checked = true;
  activityState = {
    vencidos: [{ ...MIEMBRO_VENCIDO, usuario: 'Nuevo' }],
    enCurso: [],
    terminados: [],
  };
  const consultasIniciales = t.fetchLog.length;
  const [refresco] = intervalosDe(t, 60000);
  refresco.fn();

  await esperar(() => textosDe(t.nodos.listaVencidos).includes('Nuevo'));
  const solicitud = t.fetchLog[consultasIniciales];
  assert.equal(
    solicitud.url,
    'http://back.test/api/groups/g1/activity-state?incluirEliminados=1'
  );
  assert.equal(solicitud.init.headers.Authorization, 'Bearer tok-grupos');
  assert.ok(buscarPorClase(t.nodos.listaVencidos, 'grupo-miembro-card'));
});

await testAsync('un refresco fallido conserva el contenido y no muestra error', async () => {
  let fallar = false;
  const t = crearContextoActividadGrupos({
    fetch: async () => {
      if (fallar) return { ok: false, status: 500, json: async () => ({}) };
      return respuestaOk({ activityState: estadoCompleto() });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const tarjeta = t.nodos.listaVencidos.hijos[0];
  const mensaje = t.nodos.estadoDetalleActividad.textContent;
  const reintentarOculto = t.nodos.botonReintentarDetalle.hidden;
  fallar = true;
  const consultasIniciales = t.fetchLog.length;
  const [refresco] = intervalosDe(t, 60000);
  refresco.fn();

  await esperar(() => t.debugLog.length > 0);
  assert.equal(t.nodos.listaVencidos.hijos[0], tarjeta, 'mantiene la última tarjeta');
  assert.equal(t.nodos.estadoDetalleActividad.textContent, mensaje, 'no muestra error');
  assert.equal(t.nodos.botonReintentarDetalle.hidden, reintentarOculto);
  assert.equal(t.fetchLog.length, consultasIniciales + 1);
  assert.equal(intervalosDe(t, 60000).length, 1, 'el refresco sigue programado');
});

await testAsync('el refresco se omite oculto y corre al volver visible', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const consultasIniciales = t.fetchLog.length;
  const [refresco] = intervalosDe(t, 60000);
  t.ctx.document.visibilityState = 'hidden';
  refresco.fn();
  await new Promise((resolver) => setTimeout(resolver, 5));
  assert.equal(t.fetchLog.length, consultasIniciales, 'oculto no consulta');

  t.ctx.document.visibilityState = 'visible';
  t.dispararDocumento('visibilitychange', {});
  await esperar(() => t.fetchLog.length > consultasIniciales);
  assert.equal(
    t.fetchLog[consultasIniciales].url,
    'http://back.test/api/groups/g1/activity-state'
  );
});

await testAsync('el refresco se detiene al volver, cambiar de grupo y pagehide', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  assert.equal(intervalosDe(t, 60000).length, 1);

  t.nodos.volverListaGrupos.disparar('click');
  assert.equal(intervalosDe(t, 60000).length, 0, 'volver detiene el refresco');

  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  assert.equal(intervalosDe(t, 60000).length, 1);

  const pendiente = t.ctxTest.abrirDetalleGrupo({ _id: 'g2', name: 'Montaña' });
  assert.equal(intervalosDe(t, 60000).length, 0, 'abrir otro grupo lo detiene');
  await pendiente;
  assert.equal(intervalosDe(t, 60000).length, 1, 'el render del otro grupo lo reprograma');

  t.dispararWindow('pagehide', {});
  assert.equal(intervalosDe(t, 60000).length, 0, 'pagehide detiene el refresco');
  assert.equal(intervalosDe(t, 10000).length, 0);
});

await testAsync('el refresco no solapa requests en vuelo', async () => {
  let refrescando = false;
  let resolverRefresco = null;
  const t = crearContextoActividadGrupos({
    fetch: async () => {
      if (!refrescando) return respuestaOk({ activityState: estadoCompleto() });
      return new Promise((resolver) => {
        resolverRefresco = resolver;
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  refrescando = true;
  const consultasIniciales = t.fetchLog.length;
  const [refresco] = intervalosDe(t, 60000);
  refresco.fn();
  refresco.fn();
  refresco.fn();
  assert.equal(t.fetchLog.length, consultasIniciales + 1, 'solo hay un request en vuelo');
  assert.equal(typeof resolverRefresco, 'function');

  resolverRefresco(respuestaOk({ activityState: estadoCompleto() }));
  await new Promise((resolver) => setTimeout(resolver, 10));
  assert.equal(t.fetchLog.length, consultasIniciales + 1, 'no dispara otro request');
  assert.equal(intervalosDe(t, 60000).length, 1);
});

await testAsync('el teléfono arranca oculto y el icono lo muestra', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const card = t.nodos.listaVencidos.hijos[0];
  const numero = buscarPorClase(card, 'grupo-telefono-numero');
  const boton = buscarPorClase(card, 'grupo-telefono-boton');
  assert.ok(numero);
  assert.ok(boton);
  assert.equal(numero.hidden, true);
  assert.equal(boton.getAttribute('aria-label'), 'Mostrar teléfono');

  boton.disparar('click');
  assert.equal(numero.hidden, false);
  assert.equal(boton.getAttribute('aria-label'), 'Ocultar teléfono');
});

await testAsync('los equipos muestran foto o placeholder según foto', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const card = t.nodos.listaVencidos.hijos[0];
  const fotos = buscarTodosPorClase(card, 'grupo-equipo-foto');
  const placeholders = buscarTodosPorClase(card, 'grupo-equipo-placeholder');
  assert.equal(fotos.length, 1);
  assert.equal(fotos[0].src, 'tabla.png');
  assert.equal(placeholders.length, 1);
});

await testAsync('la foto del equipo abre el visor y Escape/×/backdrop lo cierran', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const card = t.nodos.listaVencidos.hijos[0];
  const botonFoto = buscarPorClase(card, 'grupo-equipo-foto-boton');
  assert.ok(botonFoto, 'la foto real se envuelve en un botón');
  assert.equal(botonFoto.getAttribute('aria-label'), 'Ver foto de Tabla');
  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);

  botonFoto.disparar('click');
  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), false);
  assert.equal(t.nodos.imagenVisorFotoEquipo.src, 'tabla.png');
  assert.equal(t.nodos.imagenVisorFotoEquipo.alt, 'Foto de Tabla');
  assert.equal(t.nodos.visorFotoEquipo.getAttribute('aria-label'), 'Foto de Tabla');
  assert.equal(t.nodos.cerrarVisorFotoEquipo.focused, true);
  assert.equal(t.ctx.document.body.style.overflow, 'hidden');

  t.dispararDocumento('keydown', { key: 'Escape' });
  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);
  assert.equal(t.ctx.document.body.style.overflow, '');
  assert.equal(t.nodos.imagenVisorFotoEquipo.src, '');

  botonFoto.disparar('click');
  t.nodos.cerrarVisorFotoEquipo.disparar('click');
  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);
  assert.equal(t.ctx.document.body.style.overflow, '');

  botonFoto.disparar('click');
  t.nodos.visorFotoEquipo.disparar('click', { target: t.nodos.visorFotoEquipo });
  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);

  const placeholder = buscarPorClase(card, 'grupo-equipo-placeholder');
  assert.ok(placeholder);
  assert.equal(buscarTodosPorClase(card, 'grupo-equipo-foto-boton').length, 1);
  placeholder.disparar('click');
  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);
  assert.equal(t.ctx.document.body.style.overflow, '');
});

test('la flecha volver y los diálogos comparten clases entre páginas', () => {
  const actividad = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'actividadGrupos.html'),
    'utf8'
  );
  const historial = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'historial.html'),
    'utf8'
  );
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'styles.css'), 'utf8');

  assert.equal((actividad.match(/class="volver-arrow"/g) || []).length, 2);
  assert.ok(actividad.includes('class="perfil actividad-grupos-volver"'));
  assert.ok(actividad.includes('aria-label="Volver a mis grupos"'));
  for (const clase of [
    'modal-content',
    'modal-confirmacion',
    'modal-titulo',
    'modal-buttons',
    'modal-btn',
    'modal-cerrar',
  ]) {
    assert.ok(actividad.includes(clase), `falta ${clase} en actividadGrupos.html`);
    assert.ok(historial.includes(clase), `falta ${clase} en historial.html`);
  }
  assert.ok(actividad.includes('class="modal-content modal-confirmacion"'));
  assert.ok(historial.includes('class="modal-content modal-confirmacion"'));
  assert.ok(css.includes('.modal-content.modal-confirmacion'));
  assert.ok(css.includes('.volver-arrow'));

  for (const fragmento of [
    'id="visorFotoEquipo"',
    'role="dialog"',
    'aria-modal="true"',
    'id="cerrarVisorFotoEquipo"',
    'id="imagenVisorFotoEquipo"',
  ]) {
    assert.ok(actividad.includes(fragmento), `falta ${fragmento}`);
  }
});

test('la cabecera del detalle comparte fila entre la flecha y el nombre', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'actividadGrupos.html'),
    'utf8'
  );
  const fila = html.match(/<div class="actividad-grupos-detalle-fila">([\s\S]*?)<\/div>/);
  assert.ok(fila, 'falta la fila de la cabecera del detalle');
  assert.ok(fila[1].includes('id="volverListaGrupos"'), 'falta la flecha en la fila');
  assert.ok(fila[1].includes('id="tituloDetalleGrupo"'), 'falta el nombre en la fila');
  assert.ok(html.includes('aria-label="Volver a mis grupos"'));
});

test('el toggle de eliminadas se renderiza antes de Alarmas vencidas', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'actividadGrupos.html'),
    'utf8'
  );
  const contenido = html.indexOf('class="actividad-grupos-detalle-contenido"');
  const toggle = html.indexOf('id="toggleEliminadosGrupo"');
  const seccion = html.indexOf('id="seccionVencidos"');
  const heading = html.indexOf('>Alarmas vencidas</h3>');

  assert.ok(contenido > -1, 'falta el bloque de contenido');
  assert.ok(toggle > contenido, 'el toggle debe ir dentro del bloque de contenido');
  assert.ok(toggle < seccion && seccion < heading, 'el toggle debe ir antes de Alarmas vencidas');
  assert.ok(
    !html.slice(contenido, toggle).includes('<section'),
    'el toggle debe ser el primer elemento del bloque'
  );
});

await testAsync('el teléfono comparte fila con los equipos y el número aparece debajo', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const card = t.nodos.listaVencidos.hijos[0];
  const filaEquipos = buscarPorClase(card, 'grupo-equipos-fila');
  const bloqueEquipos = buscarPorClase(card, 'grupo-equipos');
  const boton = buscarPorClase(card, 'grupo-telefono-boton');
  const numero = buscarPorClase(card, 'grupo-telefono-numero');
  const filaNumero = buscarPorClase(card, 'grupo-telefono');

  assert.ok(filaEquipos, 'falta la fila de equipos y teléfono');
  assert.ok(filaEquipos.hijos.includes(bloqueEquipos), 'los equipos deben estar en la fila');
  assert.ok(filaEquipos.hijos.includes(boton), 'el teléfono debe estar en la fila de equipos');
  assert.ok(filaNumero && filaNumero.hijos.includes(numero), 'el número debe tener su línea');
  assert.ok(!filaNumero.hijos.includes(boton), 'el icono no debe compartir línea con el número');
  assert.ok(
    card.hijos.indexOf(filaNumero) > card.hijos.indexOf(filaEquipos),
    'el número debe ir debajo de la fila'
  );
  assert.equal(numero.hidden, true);

  boton.disparar('click');
  assert.equal(numero.hidden, false);
  assert.equal(boton.getAttribute('aria-label'), 'Ocultar teléfono');

  boton.disparar('click');
  assert.equal(numero.hidden, true);
  assert.equal(boton.getAttribute('aria-label'), 'Mostrar teléfono');

  const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'styles.css'), 'utf8');
  assert.ok(css.includes('.grupo-equipos-fila'));
  assert.ok(/\.grupo-telefono\s*\{[^}]*display:\s*block;/.test(css));
});

await testAsync('un activity-state vacío muestra el mensaje y las secciones vacías', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () =>
      respuestaOk({ activityState: { vencidos: [], enCurso: [], terminados: [] } }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  assert.ok(
    t.nodos.estadoDetalleActividad.textContent.includes('No hay actividad registrada')
  );
  assert.equal(t.nodos.listaVencidos.hijos.length, 1);
  assert.equal(t.nodos.listaEnCurso.hijos.length, 1);
  assert.equal(t.nodos.listaTerminados.hijos.length, 1);
  for (const lista of [
    t.nodos.listaVencidos,
    t.nodos.listaEnCurso,
    t.nodos.listaTerminados,
  ]) {
    assert.equal(lista.hijos[0].textContent, 'Sin registros.');
  }
});

console.log('# actividadGrupos.js — chat');

test('un mensaje anterior a la actividad queda debajo en orden descendente', () => {
  const t = crearContextoActividadGrupos();
  const listas = t.ctxTest.construirListasActividad(
    { vencidos: [], enCurso: [MIEMBRO_EN_CURSO], terminados: [] },
    [MENSAJE_ANTES]
  );
  assert.equal(listas.enCurso.map((item) => item.tipo).join(','), 'actividad,mensaje');
  assert.equal(listas.enCurso[0].actividad.id, 'c1');
  assert.equal(listas.enCurso[1].mensaje.id, 'm1');
});

test('un mensaje entre dos actividades en curso queda entre ellas', () => {
  const t = crearContextoActividadGrupos();
  const listas = t.ctxTest.construirListasActividad(
    {
      vencidos: [],
      enCurso: [MIEMBRO_EN_CURSO_2, MIEMBRO_EN_CURSO],
      terminados: [],
    },
    [MENSAJE_MEDIO]
  );
  assert.equal(
    listas.enCurso.map((item) => item.tipo).join(','),
    'actividad,mensaje,actividad'
  );
  assert.equal(listas.enCurso[0].actividad.id, 'c2');
  assert.equal(listas.enCurso[1].mensaje.id, 'm2');
  assert.equal(listas.enCurso[2].actividad.id, 'c1');
});

test('un mensaje más nuevo que toda actividad en curso va a Finalizadas', () => {
  const t = crearContextoActividadGrupos();
  const listas = t.ctxTest.construirListasActividad(
    {
      vencidos: [],
      enCurso: [MIEMBRO_EN_CURSO],
      terminados: [MIEMBRO_TERMINADO],
    },
    [MENSAJE_DESPUES]
  );
  assert.equal(
    listas.terminados.map((item) => item.tipo).join(','),
    'mensaje,actividad'
  );
  assert.equal(listas.terminados[0].mensaje.id, 'm3');
});

test('sin actividades en curso todos los mensajes van a Finalizadas', () => {
  const t = crearContextoActividadGrupos();
  const listas = t.ctxTest.construirListasActividad(
    { vencidos: [], enCurso: [], terminados: [] },
    [MENSAJE_DESPUES, MENSAJE_ANTES]
  );
  assert.equal(
    listas.terminados.map((item) => item.mensaje.id).join(','),
    'm3,m1'
  );
});

await testAsync('las tres listas de actividades renderizan lo más reciente primero', async () => {
  const vencidoViejo = {
    ...MIEMBRO_VENCIDO,
    id: 'v-viejo',
    usuario: 'Viejo',
    inicio: new Date(AHORA - 180 * 60 * 1000).toISOString(),
    finPrevisto: new Date(AHORA - 120 * 60 * 1000).toISOString(),
  };
  const terminadoNuevo = {
    ...MIEMBRO_TERMINADO,
    id: 'r-nuevo',
    usuario: 'Nueva',
    inicio: new Date(AHORA - 90 * 60 * 1000).toISOString(),
    finPrevisto: new Date(AHORA - 60 * 60 * 1000).toISOString(),
    fin: new Date(AHORA - 45 * 60 * 1000).toISOString(),
  };
  const t = crearContextoActividadGrupos({
    fetch: async (url) => {
      if (String(url).endsWith('/messages')) return respuestaOk({ mensajes: [] });
      return respuestaOk({
        activityState: {
          vencidos: [vencidoViejo, MIEMBRO_VENCIDO],
          enCurso: [MIEMBRO_EN_CURSO, MIEMBRO_EN_CURSO_2],
          terminados: [MIEMBRO_TERMINADO, terminadoNuevo],
        },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  assert.ok(textosDe(t.nodos.listaVencidos.hijos[0]).includes('Ana'));
  assert.ok(textosDe(t.nodos.listaVencidos.hijos[1]).includes('Viejo'));
  assert.ok(textosDe(t.nodos.listaEnCurso.hijos[0]).includes('Carla'));
  assert.ok(textosDe(t.nodos.listaEnCurso.hijos[1]).includes('Beto'));
  assert.ok(textosDe(t.nodos.listaTerminados.hijos[0]).includes('Nueva'));
  assert.ok(textosDe(t.nodos.listaTerminados.hijos[1]).includes('Carla'));
});

await testAsync('las burbujas propias van a la derecha y las ajenas muestran nombre', async () => {
  const token = crearTokenActividad({ userId: 'u1', email: 'ana@test.com' });
  const t = crearContextoActividadGrupos({
    token,
    fetch: async (url) => {
      if (String(url).endsWith('/messages')) {
        return respuestaOk({ mensajes: [MENSAJE_AJENO, MENSAJE_PROPIO] });
      }
      return respuestaOk({
        activityState: { vencidos: [], enCurso: [], terminados: [] },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  assert.ok(
    t.fetchLog.some(
      (llamada) => llamada.url.endsWith('/messages') && llamada.init.method === 'GET'
    ),
    'la historia se carga al abrir'
  );
  const burbujas = buscarTodosPorClase(
    t.nodos.listaTerminados,
    'grupo-mensaje'
  );
  assert.equal(burbujas.length, 2);
  const [propia, ajena] = burbujas;
  assert.equal(ajena.classList.contains('grupo-mensaje-propio'), false);
  assert.equal(propia.classList.contains('grupo-mensaje-propio'), true);
  assert.equal(
    buscarPorClase(ajena, 'grupo-mensaje-usuario').textContent,
    'Ana'
  );
  assert.equal(buscarPorClase(propia, 'grupo-mensaje-usuario'), null);
  assert.equal(buscarPorClase(ajena, 'grupo-mensaje-texto').textContent, 'Mensaje ajeno');
  assert.equal(buscarPorClase(propia, 'grupo-mensaje-texto').textContent, 'Mensaje propio');
  assert.equal(
    buscarPorClase(ajena, 'grupo-mensaje-hora').textContent,
    t.ctxTest.formatearHoraActividad(MENSAJE_AJENO.enviadoEn)
  );
  assert.equal(
    buscarPorClase(propia, 'grupo-mensaje-hora').textContent,
    t.ctxTest.formatearHoraActividad(MENSAJE_PROPIO.enviadoEn)
  );

  const css = fs.readFileSync(
    path.join(__dirname, '..', 'styles', 'styles.css'),
    'utf8'
  );
  const regla = css.match(/\.grupo-mensaje-propio\s*\{([\s\S]*?)\}/);
  assert.ok(regla, 'falta el estilo de la burbuja propia');
  assert.match(regla[1], /background-color:\s*var\(--color-principal\);/);
  assert.match(regla[1], /color:\s*var\(--color-principal\);/);
  assert.match(
    css.match(/^\.grupo-mensaje\s*\{([\s\S]*?)\}/m)[1],
    /color:\s*#ffffff;/
  );
});

await testAsync('Ver chat oculta solo las burbujas y no las actividades', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async (url) => {
      if (String(url).endsWith('/messages')) {
        return respuestaOk({ mensajes: [MENSAJE_DESPUES] });
      }
      return respuestaOk({ activityState: estadoCompleto() });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const mensajesAntes = buscarTodosPorClase(
    t.nodos.listaTerminados,
    'grupo-mensaje'
  ).length;
  const actividadesAntes =
    t.nodos.listaVencidos.hijos.length +
    t.nodos.listaEnCurso.hijos.length +
    t.nodos.listaTerminados.hijos.length;
  assert.equal(mensajesAntes, 1);

  t.nodos.toggleChatGrupo.disparar('click');
  assert.equal(
    t.nodos.vistaDetalleActividadGrupos.classList.contains(
      'actividad-grupos-chat-oculto'
    ),
    true
  );
  assert.equal(t.nodos.toggleChatGrupo.textContent, 'Ver chat');
  assert.equal(
    buscarTodosPorClase(t.nodos.listaTerminados, 'grupo-mensaje').length,
    mensajesAntes,
    'las burbujas siguen en el DOM'
  );
  assert.equal(
    t.nodos.listaVencidos.hijos.length +
      t.nodos.listaEnCurso.hijos.length +
      t.nodos.listaTerminados.hijos.length,
    actividadesAntes,
    'las actividades no se tocan'
  );

  t.nodos.toggleChatGrupo.disparar('click');
  assert.equal(
    t.nodos.vistaDetalleActividadGrupos.classList.contains(
      'actividad-grupos-chat-oculto'
    ),
    false
  );
  assert.equal(t.nodos.toggleChatGrupo.textContent, 'Ocultar chat');
});

await testAsync('un evento SSE agrega el mensaje en su sección sin duplicar id', async () => {
  const token = crearTokenActividad({ userId: 'u1' });
  const t = crearContextoActividadGrupos({
    token,
    fetch: async (url) => {
      if (String(url).endsWith('/messages')) return respuestaOk({ mensajes: [] });
      return respuestaOk({
        activityState: {
          vencidos: [],
          enCurso: [MIEMBRO_EN_CURSO],
          terminados: [],
        },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const fuente = t.eventSources[t.eventSources.length - 1];
  assert.ok(fuente, 'se abre el EventSource');
  assert.ok(fuente.url.includes('/messages/stream?token='));
  fuente.emitir('mensaje', MENSAJE_ANTES);

  assert.equal(
    t.nodos.listaEnCurso.hijos[0].classList.contains('grupo-miembro-card'),
    true
  );
  assert.equal(
    t.nodos.listaEnCurso.hijos[1].classList.contains('grupo-mensaje'),
    true
  );
  assert.equal(
    buscarTodosPorClase(t.nodos.listaEnCurso, 'grupo-mensaje').length,
    1
  );

  fuente.emitir('mensaje', MENSAJE_ANTES);
  assert.equal(
    buscarTodosPorClase(t.nodos.listaEnCurso, 'grupo-mensaje').length,
    1,
    'no duplica el mismo id'
  );

  fuente.emitir('mensaje', MENSAJE_DESPUES);
  assert.equal(
    buscarTodosPorClase(t.nodos.listaTerminados, 'grupo-mensaje').length,
    1
  );
});

await testAsync('el EventSource se cierra al volver y en pagehide', async () => {
  const token = crearTokenActividad({ userId: 'u1' });
  const t = crearContextoActividadGrupos({
    token,
    fetch: async (url) => {
      if (String(url).endsWith('/messages')) return respuestaOk({ mensajes: [] });
      return respuestaOk({
        activityState: {
          vencidos: [],
          enCurso: [MIEMBRO_EN_CURSO],
          terminados: [],
        },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  const primera = t.eventSources[t.eventSources.length - 1];
  assert.equal(primera.cerrado, false);

  t.nodos.volverListaGrupos.disparar('click');
  assert.equal(primera.cerrado, true);

  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  const segunda = t.eventSources[t.eventSources.length - 1];
  t.dispararWindow('pagehide', {});
  assert.equal(segunda.cerrado, true);
});

await testAsync('Enviar publica el mensaje y limpia el input', async () => {
  const token = crearTokenActividad({ userId: 'u1' });
  let post = null;
  const t = crearContextoActividadGrupos({
    token,
    fetch: async (url, init) => {
      if (init && init.method === 'POST') {
        post = { url: String(url), init };
        return {
          ok: true,
          status: 201,
          json: async () => ({
            mensaje: {
              ...MENSAJE_PROPIO,
              id: 'm-post',
              texto: 'Hola grupo',
            },
          }),
        };
      }
      if (String(url).endsWith('/messages')) return respuestaOk({ mensajes: [] });
      return respuestaOk({
        activityState: { vencidos: [], enCurso: [], terminados: [] },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  t.nodos.entradaMensajeGrupo.value = 'Hola grupo';
  t.nodos.formMensajeGrupo.disparar('submit', { preventDefault: () => {} });
  await esperar(() => t.nodos.entradaMensajeGrupo.value === '');

  assert.equal(post.url, 'http://back.test/api/groups/g1/messages');
  assert.equal(post.init.method, 'POST');
  assert.equal(post.init.headers.Authorization, `Bearer ${token}`);
  assert.deepEqual(JSON.parse(post.init.body), { texto: 'Hola grupo' });
  assert.equal(
    buscarTodosPorClase(t.nodos.listaTerminados, 'grupo-mensaje').length,
    1
  );
});

console.log('# actividadGrupos.js — eliminación');

await testAsync('solo los miembros con puedeEliminar muestran el botón Eliminar', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  assert.ok(buscarPorClase(t.nodos.listaVencidos.hijos[0], 'grupo-eliminar-boton'));
  assert.ok(buscarPorClase(t.nodos.listaTerminados.hijos[0], 'grupo-eliminar-boton'));
  assert.equal(
    buscarPorClase(t.nodos.listaEnCurso.hijos[0], 'grupo-eliminar-boton'),
    null,
    'sin puedeEliminar no hay botón'
  );
});

await testAsync('el primer diálogo no elimina y Escape/Cancelar/× abortan', async () => {
  let deletes = 0;
  const t = crearContextoActividadGrupos({
    fetch: async (url, init) => {
      if ((init && init.method) === 'DELETE') {
        deletes += 1;
        return { ok: true, status: 204, json: async () => ({}) };
      }
      return respuestaOk({ activityState: estadoCompleto() });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  const card = t.nodos.listaVencidos.hijos[0];
  const boton = buscarPorClase(card, 'grupo-eliminar-boton');

  boton.disparar('click');
  assert.equal(t.nodos.modalEliminarSesion.classList.contains('hidden'), false);
  assert.equal(t.nodos.continuarEliminarSesion.focused, true, 'foco en Continuar');
  assert.equal(deletes, 0, 'el primer diálogo no elimina');

  t.nodos.continuarEliminarSesion.disparar('click');
  assert.equal(t.nodos.modalEliminarSesion.classList.contains('hidden'), true);
  assert.equal(t.nodos.modalConfirmarEliminarSesion.classList.contains('hidden'), false);
  assert.equal(t.nodos.eliminarSesion.focused, true, 'foco en Eliminar');
  assert.equal(deletes, 0, 'el segundo diálogo todavía no elimina');

  t.dispararDocumento('keydown', { key: 'Escape' });
  assert.equal(t.nodos.modalConfirmarEliminarSesion.classList.contains('hidden'), true);

  boton.disparar('click');
  t.nodos.cancelarEliminarSesion.disparar('click');
  assert.equal(t.nodos.modalEliminarSesion.classList.contains('hidden'), true);

  boton.disparar('click');
  t.nodos.cerrarModalEliminarSesion.disparar('click');
  assert.equal(t.nodos.modalEliminarSesion.classList.contains('hidden'), true);

  boton.disparar('click');
  t.nodos.continuarEliminarSesion.disparar('click');
  t.nodos.cancelarConfirmarEliminar.disparar('click');
  assert.equal(t.nodos.modalConfirmarEliminarSesion.classList.contains('hidden'), true);

  boton.disparar('click');
  t.nodos.continuarEliminarSesion.disparar('click');
  t.nodos.cerrarModalConfirmarEliminar.disparar('click');
  assert.equal(t.nodos.modalConfirmarEliminarSesion.classList.contains('hidden'), true);

  assert.equal(deletes, 0, 'ninguna ruta abortada eliminó');
  assert.ok(t.nodos.listaVencidos.hijos.includes(card), 'la tarjeta sigue');
});

await testAsync('el segundo Eliminar usa la URL por tipo y el 204 quita la tarjeta', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async (url, init) => {
      if ((init && init.method) === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({}) };
      }
      return respuestaOk({ activityState: estadoCompleto() });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const cardVencido = t.nodos.listaVencidos.hijos[0];
  buscarPorClase(cardVencido, 'grupo-eliminar-boton').disparar('click');
  t.nodos.continuarEliminarSesion.disparar('click');
  t.nodos.eliminarSesion.disparar('click');
  await esperar(() => !t.nodos.listaVencidos.hijos.includes(cardVencido));

  const primerDelete = t.fetchLog.find((l) => l.init && l.init.method === 'DELETE');
  assert.equal(primerDelete.url, 'http://back.test/api/message-events/session/v1');
  assert.equal(primerDelete.init.headers.Authorization, 'Bearer tok-grupos');
  const vacioVencidos = buscarPorClase(t.nodos.listaVencidos, 'grupo-actividad-vacio');
  assert.ok(vacioVencidos, 'la sección muestra su estado vacío');
  assert.equal(vacioVencidos.textContent, 'Sin registros.');

  const cardTerminado = t.nodos.listaTerminados.hijos[0];
  buscarPorClase(cardTerminado, 'grupo-eliminar-boton').disparar('click');
  t.nodos.continuarEliminarSesion.disparar('click');
  t.nodos.eliminarSesion.disparar('click');
  await esperar(() => !t.nodos.listaTerminados.hijos.includes(cardTerminado));

  const deletes = t.fetchLog.filter((l) => l.init && l.init.method === 'DELETE');
  assert.equal(deletes.length, 2);
  assert.equal(deletes[1].url, 'http://back.test/api/activity-logs/r1');
});

await testAsync('si falla el DELETE se mantiene la tarjeta y se muestra el error', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async (url, init) => {
      if ((init && init.method) === 'DELETE') {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return respuestaOk({ activityState: estadoCompleto() });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);

  const card = t.nodos.listaVencidos.hijos[0];
  buscarPorClase(card, 'grupo-eliminar-boton').disparar('click');
  t.nodos.continuarEliminarSesion.disparar('click');
  t.nodos.eliminarSesion.disparar('click');

  await esperar(() => t.nodos.estadoEliminarSesion.textContent.includes('No se pudo eliminar'));
  assert.ok(t.nodos.listaVencidos.hijos.includes(card), 'la tarjeta se mantiene');
  assert.equal(t.nodos.modalConfirmarEliminarSesion.classList.contains('hidden'), true);
});

console.log('# actividadGrupos.js — eliminadas');

await testAsync('el toggle pide incluirEliminados y muestra la tarjeta eliminada', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async (url) => {
      if (url.includes('incluirEliminados=1')) {
        return respuestaOk({
          activityState: { vencidos: [SESION_ELIMINADA], enCurso: [], terminados: [] },
        });
      }
      return respuestaOk({
        activityState: { vencidos: [MIEMBRO_VENCIDO], enCurso: [], terminados: [] },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  assert.equal(t.fetchLog[0].url, 'http://back.test/api/groups/g1/activity-state');
  const normal = t.nodos.listaVencidos.hijos[0];
  assert.equal(buscarPorClase(normal, 'grupo-eliminada-label'), null);
  assert.ok(buscarPorClase(normal, 'grupo-eliminar-boton'));

  t.nodos.toggleEliminadosGrupo.checked = true;
  t.nodos.toggleEliminadosGrupo.disparar('change');
  await esperar(() => buscarPorClase(t.nodos.listaVencidos, 'grupo-eliminada-label'));

  const solicitud = t.fetchLog.find((l) => l.url.includes('incluirEliminados=1'));
  assert.equal(
    solicitud.url,
    'http://back.test/api/groups/g1/activity-state?incluirEliminados=1'
  );
  assert.equal(solicitud.init.headers.Authorization, 'Bearer tok-grupos');
  assert.equal(t.nodos.toggleEliminadosGrupo.checked, true);

  const card = t.nodos.listaVencidos.hijos[0];
  assert.ok(card.classList.contains('grupo-miembro-card-eliminada'));
  const label = buscarPorClase(card, 'grupo-eliminada-label');
  assert.equal(label.textContent, 'Eliminada');
  const restaurar = buscarPorClase(card, 'grupo-restaurar-boton');
  assert.equal(restaurar.textContent, 'Restaurar');
  assert.equal(buscarPorClase(card, 'grupo-eliminar-boton'), null);
  assert.ok(textosDe(card).includes('Dani'));
  assert.ok(textosDe(card).includes('Surf'));
  assert.ok(textosDe(card).includes('Tabla'));
  assert.ok(textosDe(card).some((texto) => texto.includes('Inicio:')));
});

await testAsync('Restaurar una sesión usa message-events y refresca el detalle', async () => {
  let restaurado = false;
  const t = crearContextoActividadGrupos({
    fetch: async (url, init) => {
      const metodo = (init && init.method) || 'GET';
      if (metodo === 'PATCH') {
        restaurado = true;
        return respuestaOk({});
      }
      return respuestaOk({
        activityState: {
          vencidos: [{ ...SESION_ELIMINADA, eliminado: !restaurado }],
          enCurso: [],
          terminados: [],
        },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  t.nodos.toggleEliminadosGrupo.checked = true;
  t.nodos.toggleEliminadosGrupo.disparar('change');
  await esperar(() => buscarPorClase(t.nodos.listaVencidos, 'grupo-restaurar-boton'));

  const card = t.nodos.listaVencidos.hijos[0];
  buscarPorClase(card, 'grupo-restaurar-boton').disparar('click');
  await esperar(() => t.fetchLog.some((l) => l.init && l.init.method === 'PATCH'));

  const patch = t.fetchLog.find((l) => l.init && l.init.method === 'PATCH');
  assert.equal(
    patch.url,
    'http://back.test/api/message-events/session/e1/restaurar'
  );
  assert.equal(patch.init.headers.Authorization, 'Bearer tok-grupos');
  await esperar(() => !buscarPorClase(t.nodos.listaVencidos, 'grupo-eliminada-label'));
  assert.equal(t.nodos.toggleEliminadosGrupo.checked, true);
  assert.equal(t.nodos.estadoEliminarSesion.textContent, '');
  assert.ok(buscarPorClase(t.nodos.listaVencidos, 'grupo-eliminar-boton'));
});

await testAsync('Restaurar un registro usa activity-logs y refresca el detalle', async () => {
  let restaurado = false;
  const t = crearContextoActividadGrupos({
    fetch: async (url, init) => {
      const metodo = (init && init.method) || 'GET';
      if (metodo === 'PATCH') {
        restaurado = true;
        return respuestaOk({});
      }
      return respuestaOk({
        activityState: {
          vencidos: [],
          enCurso: [],
          terminados: [{ ...REGISTRO_ELIMINADO, eliminado: !restaurado }],
        },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  t.nodos.toggleEliminadosGrupo.checked = true;
  t.nodos.toggleEliminadosGrupo.disparar('change');
  await esperar(() => buscarPorClase(t.nodos.listaTerminados, 'grupo-restaurar-boton'));

  const card = t.nodos.listaTerminados.hijos[0];
  buscarPorClase(card, 'grupo-restaurar-boton').disparar('click');
  await esperar(() => t.fetchLog.some((l) => l.init && l.init.method === 'PATCH'));

  const patch = t.fetchLog.find((l) => l.init && l.init.method === 'PATCH');
  assert.equal(patch.url, 'http://back.test/api/activity-logs/e2/restaurar');
  await esperar(() => !buscarPorClase(t.nodos.listaTerminados, 'grupo-eliminada-label'));
  assert.ok(buscarPorClase(t.nodos.listaTerminados, 'grupo-eliminar-boton'));
});

await testAsync('si falla Restaurar muestra el mensaje y mantiene la tarjeta', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async (url, init) => {
      const metodo = (init && init.method) || 'GET';
      if (metodo === 'PATCH') {
        return { ok: false, status: 500, json: async () => ({ error: 'No autorizado' }) };
      }
      return respuestaOk({
        activityState: { vencidos: [SESION_ELIMINADA], enCurso: [], terminados: [] },
      });
    },
  });
  await t.ctxTest.abrirDetalleGrupo(GRUPO);
  t.nodos.toggleEliminadosGrupo.checked = true;
  t.nodos.toggleEliminadosGrupo.disparar('change');
  await esperar(() => buscarPorClase(t.nodos.listaVencidos, 'grupo-restaurar-boton'));

  const card = t.nodos.listaVencidos.hijos[0];
  const boton = buscarPorClase(card, 'grupo-restaurar-boton');
  boton.disparar('click');
  await esperar(() => t.nodos.estadoEliminarSesion.textContent === 'No autorizado');
  assert.ok(buscarPorClase(t.nodos.listaVencidos, 'grupo-eliminada-label'));
  assert.equal(boton.disabled, false);
});

test('el toggle de eliminadas se apaga al volver a la lista', () => {
  const t = crearContextoActividadGrupos();
  t.nodos.toggleEliminadosGrupo.checked = true;
  t.nodos.volverListaGrupos.disparar('click');
  assert.equal(t.nodos.toggleEliminadosGrupo.checked, false);
  assert.equal(t.nodos.vistaDetalleActividadGrupos.hidden, true);
  assert.equal(t.nodos.vistaListaActividadGrupos.hidden, false);
});

test('la página declara los diálogos de eliminación y corrección', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'actividadGrupos.html'),
    'utf8'
  );
  for (const texto of [
    'id="modalEliminarSesion"',
    'id="modalConfirmarEliminarSesion"',
    '¿Eliminar esta sesión?',
    '¿Desea continuar?',
    'id="continuarEliminarSesion"',
    'id="eliminarSesion"',
    'id="cancelarEliminarSesion"',
    'id="cancelarConfirmarEliminar"',
    'id="toggleEliminadosGrupo"',
    'Ver eliminadas',
  ]) {
    assert.ok(html.includes(texto), `falta ${texto}`);
  }
});

test('la hora incluye la fecha cuando no es hoy', () => {
  const t = crearContextoActividadGrupos();
  assert.equal(
    t.ctxTest.formatearHoraActividad(new Date(AHORA - 60 * 60 * 1000).toISOString()),
    '08:00'
  );
  assert.equal(
    t.ctxTest.formatearHoraActividad(new Date(AHORA - 24 * 60 * 60 * 1000).toISOString()),
    '17/05 09:00'
  );
});

test('las filas de grupo usan el ancho completo y muestran el chevron', () => {
  const t = crearContextoActividadGrupos();
  t.ctxTest.renderizarGrupos([GRUPO]);
  const card = t.nodos.listaGrupos.hijos[0];
  assert.ok(card.classList.contains('grupo-actividad-card'));
  assert.ok(card.classList.contains('grupo-actividad-card-full'));
  assert.ok(buscarPorClase(card, 'grupo-actividad-chevron'));
});

await testAsync('cada grupo usa la tarjeta de Perfil y sigue abriendo el detalle', async () => {
  const t = crearContextoActividadGrupos({
    fetch: async () => respuestaOk({ activityState: estadoCompleto() }),
  });
  t.ctxTest.renderizarGrupos([GRUPO]);
  const card = t.nodos.listaGrupos.hijos[0];

  assert.ok(card.classList.contains('perfil'), 'la tarjeta reutiliza la superficie de Perfil');
  assert.ok(card.classList.contains('grupo-actividad-card'), 'falta la clase de tarjeta');
  assert.ok(card.classList.contains('grupo-actividad-card-full'), 'la tarjeta debe ser full-width');
  const contenido = buscarPorClase(card, 'containerPerfil');
  assert.ok(contenido, 'falta el contenedor interno de Perfil');
  assert.ok(buscarPorClase(card, 'opciones'), 'falta el texto con el estilo de opciones');
  assert.ok(textosDe(card).includes('Surf'));
  const chevron = buscarPorClase(card, 'grupo-actividad-chevron');
  assert.ok(chevron, 'falta el chevron');
  assert.equal(contenido.hijos[contenido.hijos.length - 1], chevron, 'el chevron debe ir a la derecha');

  card.disparar('click');
  await esperar(() => t.nodos.vistaDetalleActividadGrupos.hidden === false);
  assert.equal(t.nodos.tituloDetalleGrupo.textContent, 'Surf');
});

test('las cabeceras sticky existen en el markup y el CSS', () => {
  const actividad = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'actividadGrupos.html'),
    'utf8'
  );
  assert.ok(actividad.includes('actividad-grupos-cabecera-sticky'));
  assert.ok(actividad.includes('actividad-grupos-detalle-sticky'));
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'styles.css'), 'utf8');
  for (const clase of [
    'historial-cabecera-sticky',
    'actividad-grupos-cabecera-sticky',
    'actividad-grupos-detalle-sticky',
    'grupo-actividad-seccion-titulo',
  ]) {
    assert.ok(css.includes(clase), `falta ${clase} en el CSS`);
  }
  assert.ok(css.includes('position: sticky'));
  assert.ok(css.includes('top: 55px'));
  assert.ok(css.includes('prefers-reduced-motion'));
});

test('la página y el menú de perfil enlazan Actividad Grupos', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'actividadGrupos.html'),
    'utf8'
  );
  for (const id of [
    'vistaListaActividadGrupos',
    'vistaDetalleActividadGrupos',
    'listaGrupos',
    'estadoListaGrupos',
    'botonReintentarGrupos',
    'listaVencidos',
    'listaEnCurso',
    'listaTerminados',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `falta #${id}`);
  }
  assert.ok(html.includes('../JS/actividadGrupos.js'));

  const perfil = fs.readFileSync(path.join(__dirname, '..', 'pages', 'perfil.html'), 'utf8');
  const historial = perfil.indexOf('href="../pages/historial.html"');
  const actividad = perfil.indexOf('href="../pages/actividadGrupos.html"');
  assert.ok(historial > -1 && actividad > historial, 'Actividad Grupos va debajo de Historial');
});
}

tests().finally(() => {
  console.log(`\n${pasados}/${total} tests OK`);
  if (pasados !== total) process.exitCode = 1;
});
