const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUTA_SCRIPT = path.join(
  __dirname,
  '..',
  'JS',
  'misEquiposActividades.js'
);
const FUENTE = fs.readFileSync(RUTA_SCRIPT, 'utf8').replace(
  /^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/utils\.js["'];?\s*/m,
  ''
);
const EXPORTS = `;globalThis.__test = {
  showConfirm, eliminarEquipoConConfirmacion, eliminarActividadConConfirmacion,
  abrirVisorFotoEquipo, cerrarVisorFotoEquipo, conectarBotonFotoEquipo,
  crearHTMLFotoEquipo, conectarToggleEquipo,
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
  const listeners = {};
  const nodo = {
    textContent: '',
    hidden: false,
    focused: false,
    style: {},
    dataset: {},
    listeners,
    addEventListener(tipo, fn) {
      (listeners[tipo] ||= []).push(fn);
    },
    removeEventListener(tipo, fn) {
      const lista = listeners[tipo];
      if (!lista) return;
      const indice = lista.indexOf(fn);
      if (indice >= 0) lista.splice(indice, 1);
    },
    focus() {
      this.focused = true;
    },
    disparar(tipo, evento) {
      for (const fn of [...(listeners[tipo] || [])]) fn(evento);
    },
    setAttribute(nombre, valor) {
      this[nombre] = String(valor);
    },
    getAttribute(nombre) {
      return this[nombre] == null ? null : String(this[nombre]);
    },
    classList: {
      add: (...valores) => valores.forEach((valor) => clases.add(valor)),
      remove: (...valores) => valores.forEach((valor) => clases.delete(valor)),
      contains: (valor) => clases.has(valor),
      toggle: (valor, fuerza) => {
        const debeEstar =
          fuerza === undefined ? !clases.has(valor) : Boolean(fuerza);
        if (debeEstar) clases.add(valor);
        else clases.delete(valor);
        return debeEstar;
      },
    },
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

function crearContexto(opciones = {}) {
  const nodos = {
    'confirm-modal': crearNodo({ className: 'modal hidden' }),
    'confirm-title': crearNodo(),
    'confirm-message': crearNodo(),
    'confirm-delete': crearNodo(),
    'confirm-cancel': crearNodo(),
    'confirm-close': crearNodo(),
    visorFotoEquipo: crearNodo({ className: 'visor-foto hidden' }),
    imagenVisorFotoEquipo: crearNodo({ src: '', alt: '' }),
    cerrarVisorFotoEquipo: crearNodo({ textContent: '×' }),
  };
  const generico = crearNodo();
  const documentHandlers = {};
  const document = {
    getElementById: (id) => nodos[id] || generico,
    querySelector: () => generico,
    createElement: () => crearNodo(),
    addEventListener(tipo, fn) {
      (documentHandlers[tipo] ||= []).push(fn);
    },
    removeEventListener(tipo, fn) {
      const lista = documentHandlers[tipo];
      if (!lista) return;
      const indice = lista.indexOf(fn);
      if (indice >= 0) lista.splice(indice, 1);
    },
    body: crearNodo(),
  };

  const windowHandlers = {};
  const window = {
    scrollY: 0,
    location: { href: '' },
    addEventListener(tipo, fn) {
      (windowHandlers[tipo] ||= []).push(fn);
    },
  };

  const fetchLog = [];
  const toastLog = [];
  const fetchImpl =
    opciones.fetch ||
    (async () => ({ ok: false, status: 500, json: async () => ({}) }));

  const ctx = {
    ROOT_URL: 'http://back.test',
    window,
    document,
    localStorage: {
      getItem: (clave) => (clave === 'token' ? 'tok-equipos' : null),
    },
    fetch: async (url, init) => {
      fetchLog.push({ url: String(url), init });
      return fetchImpl(String(url), init);
    },
    showToast: (mensaje, tipo) => toastLog.push({ mensaje, tipo }),
    console: { log: () => {}, error: () => {} },
  };
  vm.createContext(ctx);
  vm.runInContext(FUENTE + EXPORTS, ctx, { filename: 'misEquiposActividades.js' });

  return {
    ctx,
    ctxTest: ctx.__test,
    nodos,
    fetchLog,
    toastLog,
    dispararDocumento(tipo, evento) {
      for (const fn of [...(documentHandlers[tipo] || [])]) fn(evento);
    },
  };
}

function abrirConfirmacionEquipo(t) {
  const pendiente = t.ctxTest.eliminarEquipoConConfirmacion(
    'ana@test.com',
    'Surf',
    'Tabla'
  );
  assert.equal(
    t.nodos['confirm-modal'].classList.contains('hidden'),
    false,
    'el modal queda visible'
  );
  assert.equal(t.nodos['confirm-delete'].focused, true, 'foco en el botón primario');
  return pendiente;
}

function reglaCss(css, selector) {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const encontrado = css.match(new RegExp(`${escapado}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(encontrado, `falta la regla ${selector}`);
  return encontrado[1];
}

async function tests() {
test('el modal usa las clases compartidas de Beepsafe', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'misEquiposActividades.html'),
    'utf8'
  );
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'styles', 'styles.css'),
    'utf8'
  );

  assert.ok(html.includes('id="confirm-modal"'));
  assert.ok(html.includes('class="modal hidden"'));
  assert.ok(html.includes('class="modal-content modal-confirmacion"'));
  assert.ok(html.includes('class="modal-titulo"'));
  assert.ok(html.includes('class="modal-cerrar"'));
  assert.ok(html.includes('class="modal-buttons"'));
  assert.ok(html.includes('class="modal-btn cancelar"'));
  assert.ok(html.includes('class="modal-btn confirmar"'));
  assert.ok(html.includes('id="confirm-title"'));
  assert.ok(html.includes('id="confirm-close"'));
  assert.ok(html.includes('id="confirm-message" class="modal-texto"'));
  assert.ok(/class="modal-btn cancelar"[\s\S]*?Cancelar/.test(html));
  assert.ok(/class="modal-btn confirmar"[\s\S]*?Eliminar/.test(html));
  assert.ok(css.includes('.modal-content.modal-confirmacion'));
  assert.ok(css.includes('.modal-confirmacion .modal-texto'));
});

await testAsync('confirmar elimina el equipo con el mismo backend', async () => {
  const t = crearContexto({
    fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }),
  });
  const pendiente = abrirConfirmacionEquipo(t);

  assert.equal(t.nodos['confirm-title'].textContent, 'Eliminar equipo');
  assert.equal(t.nodos['confirm-message'].textContent, '¿Eliminar este equipo?');
  assert.equal(t.fetchLog.length, 0, 'todavía no llama al backend');

  t.nodos['confirm-delete'].disparar('click');
  const resultado = await pendiente;

  assert.equal(resultado, false, 'el fallo del backend se propaga');
  assert.equal(t.nodos['confirm-modal'].classList.contains('hidden'), true);
  assert.equal(t.fetchLog.length, 1);
  assert.equal(t.fetchLog[0].url, 'http://back.test/api/activities/equipment');
  assert.equal(t.fetchLog[0].init.method, 'DELETE');
  assert.equal(t.fetchLog[0].init.headers.Authorization, 'Bearer tok-equipos');
  assert.deepEqual(JSON.parse(t.fetchLog[0].init.body), {
    email: 'ana@test.com',
    activity: 'Surf',
    equipmentName: 'Tabla',
  });
});

await testAsync('Cancelar aborta la eliminación del equipo', async () => {
  const t = crearContexto();
  const pendiente = abrirConfirmacionEquipo(t);

  t.nodos['confirm-cancel'].disparar('click');
  const resultado = await pendiente;

  assert.equal(resultado, false);
  assert.equal(t.nodos['confirm-modal'].classList.contains('hidden'), true);
  assert.equal(t.fetchLog.length, 0);
});

await testAsync('el botón × aborta la eliminación del equipo', async () => {
  const t = crearContexto();
  const pendiente = abrirConfirmacionEquipo(t);

  t.nodos['confirm-close'].disparar('click');
  const resultado = await pendiente;

  assert.equal(resultado, false);
  assert.equal(t.nodos['confirm-modal'].classList.contains('hidden'), true);
  assert.equal(t.fetchLog.length, 0);
});

await testAsync('Escape aborta la eliminación del equipo', async () => {
  const t = crearContexto();
  const pendiente = abrirConfirmacionEquipo(t);

  t.dispararDocumento('keydown', { key: 'Escape' });
  const resultado = await pendiente;

  assert.equal(resultado, false);
  assert.equal(t.nodos['confirm-modal'].classList.contains('hidden'), true);
  assert.equal(t.fetchLog.length, 0);
});

await testAsync('la actividad usa el mismo modal y confirma su DELETE', async () => {
  const t = crearContexto({
    fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }),
  });
  const pendiente = t.ctxTest.eliminarActividadConConfirmacion(
    'ana@test.com',
    'Surf'
  );

  assert.equal(t.nodos['confirm-modal'].classList.contains('hidden'), false);
  assert.equal(t.nodos['confirm-title'].textContent, 'Eliminar actividad');
  assert.ok(
    t.nodos['confirm-message'].textContent.includes('Se borrarán los equipos')
  );
  assert.equal(t.nodos['confirm-delete'].focused, true);

  t.nodos['confirm-delete'].disparar('click');
  const resultado = await pendiente;

  assert.equal(resultado, false);
  assert.equal(t.fetchLog[0].url, 'http://back.test/api/activities');
  assert.equal(t.fetchLog[0].init.method, 'DELETE');
  assert.deepEqual(JSON.parse(t.fetchLog[0].init.body), {
    email: 'ana@test.com',
    activity: 'Surf',
  });
});

test('Agregar equipo queda centrado, full width y con borde sólido', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'styles', 'styles.css'),
    'utf8'
  );
  const agregar = reglaCss(css, '.toggle-add-equipment');
  const fila = reglaCss(css, '.accordion-header-activity');

  assert.match(agregar, /display:\s*flex;/);
  assert.match(agregar, /align-items:\s*center;/);
  assert.match(agregar, /justify-content:\s*center;/);
  assert.match(agregar, /box-sizing:\s*border-box;/);
  assert.match(agregar, /width:\s*100%;/);
  assert.match(agregar, /height:\s*88px;/);
  assert.match(agregar, /min-height:\s*88px;/);
  assert.match(agregar, /margin:\s*0;/);
  assert.match(agregar, /border:\s*1px solid var\(--color-principal\);/);
  assert.match(agregar, /color:\s*#ffffff;/);
  assert.match(agregar, /text-align:\s*center;/);
  assert.doesNotMatch(agregar, /border:\s*1px dashed/);
  assert.match(fila, /height:\s*88px;/);
  assert.match(fila, /min-height:\s*88px;/);

  const esquinas = reglaCss(
    css,
    '.accordion > .toggle-add-equipment:last-child'
  );
  assert.match(esquinas, /border-radius:\s*0 0 20px 20px;/);
  assert.ok(!css.includes('.actividades-wrapper .toggle-add-equipment'));
});

test('el overlay del visor reutiliza el markup y clases de Actividad Grupos', () => {
  const t = crearContexto();
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'misEquiposActividades.html'),
    'utf8'
  );

  assert.ok(html.includes('id="visorFotoEquipo"'));
  assert.ok(html.includes('class="visor-foto hidden"'));
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));
  assert.ok(html.includes('id="cerrarVisorFotoEquipo"'));
  assert.ok(html.includes('class="visor-foto-cerrar"'));
  assert.ok(html.includes('id="imagenVisorFotoEquipo"'));
  assert.ok(html.includes('class="visor-foto-imagen"'));

  const conFoto = t.ctxTest.crearHTMLFotoEquipo({
    name: 'Tabla',
    photo: 'https://cdn.test/tabla.png',
  });
  assert.ok(conFoto.includes('class="equipment-photo-boton"'));
  assert.ok(conFoto.includes('aria-label="Ver foto de Tabla"'));
  assert.ok(conFoto.includes('class="equipment-photo"'));
  assert.ok(conFoto.includes('src="https://cdn.test/tabla.png"'));
  assert.equal(
    t.ctxTest.crearHTMLFotoEquipo({ name: 'Tabla', photo: '   ' }),
    '',
    'sin foto no se genera botón'
  );
});

test('tocar la foto abre el visor y Escape lo cierra restaurando el scroll', () => {
  const t = crearContexto();
  const imagen = crearNodo({ src: 'tabla.png', alt: 'Tabla' });
  const boton = crearNodo();
  boton.querySelector = () => imagen;
  t.ctxTest.conectarBotonFotoEquipo(boton);

  boton.disparar('click', { stopPropagation: () => {} });

  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), false);
  assert.equal(t.nodos.imagenVisorFotoEquipo.src, 'tabla.png');
  assert.equal(t.nodos.imagenVisorFotoEquipo.alt, 'Foto de Tabla');
  assert.equal(t.nodos.visorFotoEquipo['aria-label'], 'Foto de Tabla');
  assert.equal(t.ctx.document.body.style.overflow, 'hidden');
  assert.equal(t.nodos.cerrarVisorFotoEquipo.focused, true);

  t.dispararDocumento('keydown', { key: 'Escape' });

  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);
  assert.equal(t.ctx.document.body.style.overflow, '');
  assert.equal(t.nodos.imagenVisorFotoEquipo.src, '');
  assert.equal(boton.focused, true, 'el foco vuelve al disparador');
});

test('× y el backdrop cierran el visor', () => {
  const t = crearContexto();

  t.ctxTest.abrirVisorFotoEquipo('tabla.png', 'Tabla', null);
  t.nodos.cerrarVisorFotoEquipo.disparar('click');
  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);

  t.ctxTest.abrirVisorFotoEquipo('tabla.png', 'Tabla', null);
  t.nodos.visorFotoEquipo.disparar('click', { target: t.nodos.visorFotoEquipo });
  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);
});

test('sin foto no hay botón y el visor permanece cerrado', () => {
  const t = crearContexto();
  const boton = crearNodo();
  boton.querySelector = () => null;
  t.ctxTest.conectarBotonFotoEquipo(boton);

  boton.disparar('click', { stopPropagation: () => {} });
  t.ctxTest.abrirVisorFotoEquipo('', 'Tabla', null);

  assert.equal(t.nodos.visorFotoEquipo.classList.contains('hidden'), true);
  assert.ok(!t.ctx.document.body.style.overflow);
});

test('el toggle se genera fuera del body y conserva las clases de ancho', () => {
  const js = fs.readFileSync(
    path.join(__dirname, '..', 'JS', 'misEquiposActividades.js'),
    'utf8'
  );

  assert.match(
    js,
    /<div class="add-equipment-form hidden">[\s\S]*?<\/div>\s*<\/div>\s*<span class="toggle-add-equipment botonActividad fila-ancho-completo">/
  );
  assert.ok(
    js.includes(
      '<span class="toggle-add-equipment botonActividad fila-ancho-completo">'
    )
  );
  assert.ok(js.includes('conectarToggleEquipo(accordion)'));
});

test('el click del toggle abre y cierra el formulario dentro del body', () => {
  const t = crearContexto();
  const form = crearNodo({ style: { display: 'none' } });
  const icono = crearNodo();
  const toggle = crearNodo();
  const accordion = {
    querySelector(selector) {
      if (selector === '.toggle-add-equipment') return toggle;
      if (selector === '.add-equipment-form') return form;
      if (selector === '.toggle-add-equipment .toggle-icon') return icono;
      return null;
    },
  };
  t.ctxTest.conectarToggleEquipo(accordion);

  toggle.disparar('click');
  assert.equal(form.style.display, 'block');
  assert.equal(icono.classList.contains('rotate'), true);

  toggle.disparar('click');
  assert.equal(form.style.display, 'none');
  assert.equal(icono.classList.contains('rotate'), false);
});

}

tests().finally(() => {
  console.log(`\n${pasados}/${total} tests OK`);
  if (pasados !== total) process.exitCode = 1;
});
