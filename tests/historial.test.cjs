const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUTA_SCRIPT = path.join(__dirname, '..', 'JS', 'historial.js');
const FUENTE = fs.readFileSync(RUTA_SCRIPT, 'utf8');
const EXPORTS = `;globalThis.__test = {
  normalizarRegistros, ordenarHistorial, formatearFechaHistorial,
  renderizarHistorial, crearFilaHistorial, cargarHistorial,
  confirmarEliminarActividad, restaurarActividad, inicializarModalesHistorial,
  TEXTO_VACIO_HISTORIAL,
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

function crearNodo(extra = {}) {
  const clases = new Set();
  const nodo = {
    textContent: '',
    hidden: false,
    value: '',
    checked: false,
    disabled: false,
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
  Object.defineProperty(nodo, 'childElementCount', {
    get: () => nodo.hijos.length,
  });
  nodo.classList = {
    add: (...cs) => cs.forEach((c) => clases.add(c)),
    remove: (...cs) => cs.forEach((c) => clases.delete(c)),
    contains: (c) => clases.has(c),
  };
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

function crearContextoHistorial(opciones = {}) {
  const nodos = {
    estadoHistorial: crearNodo(),
    estadoAccionHistorial: crearNodo(),
    botonReintentarHistorial: crearNodo({ hidden: true }),
    listaHistorial: crearNodo(),
    toggleEliminadas: crearNodo({ checked: false }),
    modalEliminarActividad: crearNodo({ className: 'modal hidden' }),
    continuarEliminarActividad: crearNodo({ textContent: 'Continuar' }),
    cancelarEliminarActividad: crearNodo({ textContent: 'Cancelar' }),
    cerrarModalEliminarActividad: crearNodo({ textContent: '×' }),
    modalConfirmarEliminarActividad: crearNodo({ className: 'modal hidden' }),
    eliminarActividad: crearNodo({ textContent: 'Eliminar' }),
    cancelarConfirmarEliminarActividad: crearNodo({ textContent: 'Cancelar' }),
    cerrarModalConfirmarEliminarActividad: crearNodo({ textContent: '×' }),
  };
  nodos.modalEliminarActividad.classList.add('hidden');
  nodos.modalConfirmarEliminarActividad.classList.add('hidden');

  const documentHandlers = {};
  const document = {
    getElementById: (id) => nodos[id] || null,
    createElement: (tag) => crearNodo({ tagName: String(tag).toUpperCase() }),
    addEventListener(tipo, fn) {
      (documentHandlers[tipo] ||= []).push(fn);
    },
  };

  const fetchLog = [];
  const fetchImpl = opciones.fetch || (async () => respuestaOk({ registros: [] }));
  const consola = { errores: [], avisos: [], infos: [], logs: [] };
  const registrar = (destino) => (...args) => destino.push(args.map(String).join(' '));

  const ctx = {
    ROOT_URL: 'http://back.test',
    window: { addEventListener() {} },
    document,
    localStorage: {
      getItem: (clave) => (clave === 'token' ? 'tok-hist' : null),
    },
    fetch: async (url, init) => {
      fetchLog.push({ url: String(url), init });
      return fetchImpl(String(url), init);
    },
    AbortController: class {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
      }
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    Intl,
    console: {
      error: registrar(consola.errores),
      warn: registrar(consola.avisos),
      info: registrar(consola.infos),
      log: registrar(consola.logs),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(FUENTE + EXPORTS, ctx, { filename: 'historial.js' });
  return {
    ctx,
    ctxTest: ctx.__test,
    nodos,
    fetchLog,
    consola,
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

async function esperar(condicion, intentos = 200) {
  for (let i = 0; i < intentos; i++) {
    if (condicion()) return;
    await new Promise((resolver) => setTimeout(resolver, 1));
  }
  assert.ok(condicion(), 'la condición esperada no se cumplió');
}

const REGISTRO = {
  _id: 'a1',
  usuario: 'Ana',
  actividad: 'Surf',
  equipos: ['Tabla'],
  inicio: '2026-05-18T10:00:00.000Z',
  fin: '2026-05-18T11:00:00.000Z',
  comentarios: '',
  eliminado: false,
};

function crearContextoConRegistros(registros) {
  return crearContextoHistorial({
    fetch: async (url, init) => {
      const metodo = (init && init.method) || 'GET';
      if (metodo === 'DELETE') return { ok: true, status: 204, json: async () => ({}) };
      if (metodo === 'PATCH') return respuestaOk({});
      return respuestaOk({ registros });
    },
  });
}

async function tests() {
  console.log('# historial.js — estados');

  await testAsync('el error muestra el status y el mensaje de la API y lo loguea', async () => {
    const t = crearContextoHistorial({
      fetch: async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'No autenticado' }),
      }),
    });
    await t.ctxTest.cargarHistorial();

    assert.equal(
      t.nodos.estadoHistorial.textContent,
      'No se pudo cargar (401): No autenticado'
    );
    assert.equal(t.nodos.botonReintentarHistorial.hidden, false);
    assert.ok(
      t.consola.errores.some((mensaje) =>
        mensaje.includes('[historial] GET http://back.test/api/activity-logs status=401')
      )
    );
  });

  await testAsync('un listado vacío muestra el estado vacío sin error', async () => {
    const t = crearContextoConRegistros([]);
    await t.ctxTest.cargarHistorial();

    assert.equal(t.nodos.estadoHistorial.textContent, 'Sin actividades registradas.');
    assert.equal(t.nodos.botonReintentarHistorial.hidden, true);
  });

  console.log('# historial.js — eliminar y restaurar');

  await testAsync('el primer diálogo no elimina; el segundo hace DELETE y quita la fila', async () => {
    const t = crearContextoConRegistros([REGISTRO]);
    await t.ctxTest.cargarHistorial();

    const fila = t.nodos.listaHistorial.hijos[0];
    const boton = buscarPorClase(fila, 'historial-eliminar-boton');
    assert.ok(boton, 'la fila tiene Eliminar');

    boton.disparar('click');
    assert.equal(t.nodos.modalEliminarActividad.classList.contains('hidden'), false);
    assert.equal(t.nodos.continuarEliminarActividad.focused, true);
    assert.equal(t.fetchLog.filter((l) => l.init && l.init.method === 'DELETE').length, 0);

    t.nodos.continuarEliminarActividad.disparar('click');
    assert.equal(t.nodos.modalConfirmarEliminarActividad.classList.contains('hidden'), false);
    assert.equal(t.nodos.eliminarActividad.focused, true);
    assert.equal(t.fetchLog.filter((l) => l.init && l.init.method === 'DELETE').length, 0);

    t.nodos.eliminarActividad.disparar('click');
    await esperar(() => !t.nodos.listaHistorial.hijos.includes(fila));

    const del = t.fetchLog.find((l) => l.init && l.init.method === 'DELETE');
    assert.equal(del.url, 'http://back.test/api/activity-logs/a1');
    assert.equal(del.init.headers.Authorization, 'Bearer tok-hist');
    assert.equal(t.nodos.estadoHistorial.textContent, 'Sin actividades registradas.');
  });

  await testAsync('si falla el DELETE se mantiene la fila y se muestra el error', async () => {
    const t = crearContextoHistorial({
      fetch: async (url, init) => {
        if ((init && init.method) === 'DELETE') {
          return { ok: false, status: 500, json: async () => ({ error: 'boom' }) };
        }
        return respuestaOk({ registros: [REGISTRO] });
      },
    });
    await t.ctxTest.cargarHistorial();
    const fila = t.nodos.listaHistorial.hijos[0];
    buscarPorClase(fila, 'historial-eliminar-boton').disparar('click');
    t.nodos.continuarEliminarActividad.disparar('click');
    t.nodos.eliminarActividad.disparar('click');

    await esperar(() => t.nodos.estadoAccionHistorial.textContent.includes('No se pudo eliminar'));
    assert.ok(t.nodos.listaHistorial.hijos.includes(fila));
    assert.equal(t.nodos.modalConfirmarEliminarActividad.classList.contains('hidden'), true);
  });

  await testAsync('Ver eliminadas pide incluirEliminados y Restaurar hace PATCH', async () => {
    let restaurado = false;
    const t = crearContextoHistorial({
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (metodo === 'PATCH') {
          restaurado = true;
          return respuestaOk({});
        }
        if (metodo === 'DELETE') return { ok: true, status: 204, json: async () => ({}) };
        const incluir = String(url).includes('incluirEliminados=1');
        const registro = restaurado ? REGISTRO : { ...REGISTRO, eliminado: true };
        return respuestaOk({ registros: incluir ? [registro] : [REGISTRO] });
      },
    });
    t.nodos.toggleEliminadas.checked = true;
    await t.ctxTest.cargarHistorial();

    const getConFiltro = t.fetchLog.find((l) => l.url.includes('incluirEliminados=1'));
    assert.ok(getConFiltro, 'usa el query incluirEliminados=1');
    const fila = t.nodos.listaHistorial.hijos[0];
    assert.ok(fila.classList.contains('historial-eliminada'));
    assert.ok(buscarPorClase(fila, 'historial-eliminada-label'));
    const restaurar = buscarPorClase(fila, 'historial-restaurar-boton');
    assert.ok(restaurar);
    assert.equal(restaurar.textContent, 'Restaurar');

    const getsAntes = t.fetchLog.filter((l) => !l.init || !l.init.method || l.init.method === 'GET').length;
    restaurar.disparar('click');
    await esperar(() => restaurado && t.fetchLog.some((l) => l.init && l.init.method === 'PATCH'));
    await esperar(
      () => t.fetchLog.filter((l) => !l.init || !l.init.method || l.init.method === 'GET').length > getsAntes
    );

    const patch = t.fetchLog.find((l) => l.init && l.init.method === 'PATCH');
    assert.equal(patch.url, 'http://back.test/api/activity-logs/a1/restaurar');
    const filaRestaurada = t.nodos.listaHistorial.hijos[0];
    assert.ok(!filaRestaurada.classList.contains('historial-eliminada'));
    assert.equal(buscarPorClase(filaRestaurada, 'historial-eliminada-label'), null);
    assert.ok(buscarPorClase(filaRestaurada, 'historial-eliminar-boton'));
  });

  await testAsync('Escape y Cancelar cierran los diálogos sin eliminar', async () => {
    const t = crearContextoConRegistros([REGISTRO]);
    await t.ctxTest.cargarHistorial();
    const fila = t.nodos.listaHistorial.hijos[0];
    const boton = buscarPorClase(fila, 'historial-eliminar-boton');

    boton.disparar('click');
    t.dispararDocumento('keydown', { key: 'Escape' });
    assert.equal(t.nodos.modalEliminarActividad.classList.contains('hidden'), true);

    boton.disparar('click');
    t.nodos.cancelarEliminarActividad.disparar('click');
    assert.equal(t.nodos.modalEliminarActividad.classList.contains('hidden'), true);

    boton.disparar('click');
    t.nodos.continuarEliminarActividad.disparar('click');
    t.dispararDocumento('keydown', { key: 'Escape' });
    assert.equal(t.nodos.modalConfirmarEliminarActividad.classList.contains('hidden'), true);

    boton.disparar('click');
    t.nodos.continuarEliminarActividad.disparar('click');
    t.nodos.cancelarConfirmarEliminarActividad.disparar('click');
    assert.equal(t.nodos.modalConfirmarEliminarActividad.classList.contains('hidden'), true);

    assert.equal(t.fetchLog.filter((l) => l.init && l.init.method === 'DELETE').length, 0);
    assert.ok(t.nodos.listaHistorial.hijos.includes(fila));
  });

  console.log('# historial.js — contrato y navegación');

  test('historial.html declara el toggle, los diálogos y no tiene nav inferior', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'pages', 'historial.html'), 'utf8');
    for (const fragmento of [
      'id="toggleEliminadas"',
      'id="modalEliminarActividad"',
      'id="modalConfirmarEliminarActividad"',
      '¿Eliminar esta actividad?',
      '¿Desea continuar?',
      'id="eliminarActividad"',
    ]) {
      assert.ok(html.includes(fragmento), `falta ${fragmento}`);
    }
    assert.ok(!html.includes('contenedor-padre2'), 'historial no lleva nav inferior');
    const actividad = fs.readFileSync(
      path.join(__dirname, '..', 'pages', 'actividadGrupos.html'),
      'utf8'
    );
    assert.ok(!actividad.includes('contenedor-padre2'), 'actividadGrupos no lleva nav inferior');
  });

  test('el nav Inicio/Perfil es fijo y comparte posición, alto y padding', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'styles.css'), 'utf8');
    const bloque = css.match(/\.contenedor-padre2,\s*\.contenedor-padre3\s*\{[\s\S]*?\}/);
    assert.ok(bloque, 'falta la regla compartida del nav');
    for (const regla of [
      'position: fixed;',
      'bottom: 24px;',
      'height: 76px;',
      'padding: 10px 20px;',
      'box-sizing: border-box;',
    ]) {
      assert.ok(bloque[0].includes(regla), `falta ${regla} en el nav compartido`);
    }
  });
}

tests().finally(() => {
  console.log(`\n${pasados}/${total} tests OK`);
  if (pasados !== total) process.exitCode = 1;
});
