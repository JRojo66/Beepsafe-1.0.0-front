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
  crearTarjetaMiembro,
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
    body: nodos.body,
  };

  const DateReal = Date;
  class FechaFalsa extends DateReal {
    constructor(...args) {
      super(...(args.length ? args : [AHORA]));
    }
    static now() {
      return AHORA;
    }
  }

  const fetchLog = [];
  const fetchImpl = opciones.fetch || (async () => respuestaOk({ groups: [] }));
  const ctx = {
    ROOT_URL: 'http://back.test',
    window: { addEventListener() {} },
    document,
    localStorage: {
      getItem: (clave) => (clave === 'token' ? 'tok-grupos' : null),
    },
    fetch: async (url, init) => {
      fetchLog.push({ url: String(url), init });
      return fetchImpl(String(url), init);
    },
    Date: FechaFalsa,
    Intl,
    console: { error: () => {} },
  };
  vm.createContext(ctx);
  vm.runInContext(FUENTE + EXPORTS, ctx, { filename: 'actividadGrupos.js' });
  return {
    ctx,
    ctxTest: ctx.__test,
    nodos,
    fetchLog,
    dispararDocumento(tipo, evento) {
      for (const fn of documentHandlers[tipo] || []) fn(evento);
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
