const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUTA_SCRIPT = path.join(__dirname, '..', 'JS', 'mensajes.js');
const FUENTE = fs.readFileSync(RUTA_SCRIPT, 'utf8');
const EXPORTS = `;globalThis.__test = {
  TIPOS_MENSAJE, CLAVE_MENSAJES, MENSAJES_POR_DEFECTO,
  cargarMensajes, guardarMensaje, cargarContactos, agregarContacto,
  actualizarContacto, eliminarContacto, claveConUsuario, resumirMensaje,
  emailDesdeToken, guardarDesdeEditor, inicializarEditorMensaje,
  inicializarListaMensajes, inicializarContactos, refrescarContactos,
  crearFilaContacto, manejarAltaContacto, abrirEdicionContacto,
  actualizarContador, marcarSesionExpirada, enviarMensajeDePrueba,
  inicializarBotonPrueba, nombreDesdeToken, leerUltimaSesionPreview,
  actividadPreview, formatearHoraPreview, horaPreview, contactoPreview,
  interpolarPlantilla, renderizarPreview, observarCambiosSesion,
  PLANTILLAS_PREVIEW, VALORES_PREVIEW_RESPALDO, CLAVE_ULTIMA_SESION,
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

function crearToken(payload) {
  const base64 = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${base64}.signature`;
}

const ZONA_HORARIA_TEST = 'America/Argentina/Buenos_Aires';

function diaAbreviado(fecha) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA_TEST,
    weekday: 'short',
  })
    .format(fecha)
    .replace(/\./g, '')
    .trim()
    .toLowerCase();
}

function horaFormateada(epochMs) {
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA_TEST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(epochMs));
  const buscar = (tipo) => {
    const parte = partes.find((item) => item.type === tipo);
    return parte ? parte.value : '';
  };
  let hora = buscar('hour');
  if (hora === '24') hora = '00';
  return `${diaAbreviado(new Date(epochMs))} ${hora}:${buscar('minute')}`;
}

// Congela `Date` dentro del contexto VM para que la hora calculada sea
// determinista sin tocar el reloj real del test.
function conFechaFija(ctx, epochMs) {
  const DateReal = Date;
  ctx.Date = class extends DateReal {
    constructor(...args) {
      super(...(args.length ? args : [epochMs]));
    }
    static now() {
      return epochMs;
    }
  };
}

function respuestaOk(json) {
  return { ok: true, status: 200, json: async () => json };
}

function respuestaFail(status = 500) {
  return { ok: false, status, json: async () => ({}) };
}

function plano(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function crearEstadoStub() {
  const clases = new Set();
  return {
    textContent: '',
    classList: {
      add: (...cs) => cs.forEach((c) => clases.add(c)),
      remove: (...cs) => cs.forEach((c) => clases.delete(c)),
      contains: (c) => clases.has(c),
    },
  };
}

function crearNodo(extra = {}) {
  const clases = new Set();
  const nodo = {
    value: '',
    checked: false,
    textContent: '',
    disabled: false,
    type: '',
    className: '',
    href: '',
    tagName: 'DIV',
    style: {},
    listeners: {},
    hijos: [],
    atributos: {},
    _html: '',
    addEventListener(tipo, fn) {
      (this.listeners[tipo] ||= []).push(fn);
    },
    appendChild(hijo) {
      this.hijos.push(hijo);
      return hijo;
    },
    disparar(tipo, evento) {
      const resultados = (this.listeners[tipo] || []).map((fn) => fn(evento));
      if (resultados.length === 0) return Promise.resolve(undefined);
      return Promise.all(resultados);
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
  return Object.assign(nodo, extra);
}

function crearNodosBase() {
  return {
    mensaje: crearNodo({ tagName: 'TEXTAREA' }),
    mensajeFijoAntes: crearNodo({ tagName: 'P' }),
    mensajeFijoDespues: crearNodo({ tagName: 'P' }),
    botonGrabar: crearNodo({ tagName: 'BUTTON' }),
    botonEnviarPrueba: crearNodo({ tagName: 'BUTTON', textContent: 'Enviar prueba' }),
    estadoMensaje: crearNodo(),
    contadorMensaje: crearNodo({ textContent: '0/1000' }),
    seccionContactos: crearNodo(),
    listaContactos: crearNodo({ tagName: 'UL' }),
    contadorContactos: crearNodo({ textContent: '0 de 3' }),
    mensajeLimiteContactos: crearNodo(),
    formAgregarContacto: crearNodo({ tagName: 'FORM' }),
    contactoNombre: crearNodo({ tagName: 'INPUT' }),
    contactoTelefono: crearNodo({ tagName: 'INPUT' }),
    contactoMensajes: crearNodo({ tagName: 'INPUT', checked: true }),
    botonAgregarContacto: crearNodo({ tagName: 'BUTTON' }),
    estadoContactos: crearNodo(),
    listaMensajes: crearNodo({ tagName: 'NAV' }),
    previewInicio: crearNodo({ tagName: 'SPAN', textContent: 'Sin mensaje' }),
    previewFin: crearNodo({ tagName: 'SPAN', textContent: 'Sin mensaje' }),
    previewAlarma: crearNodo({ tagName: 'SPAN', textContent: 'Sin mensaje' }),
    previewCancelacion: crearNodo({ tagName: 'SPAN', textContent: 'Sin mensaje' }),
    previewPrueba: crearNodo({ tagName: 'SPAN', textContent: 'Sin mensaje' }),
    estadoListaMensajes: crearNodo(),
  };
}

function buscarPorTexto(nodo, texto) {
  if (!nodo) return null;
  if (nodo.textContent === texto) return nodo;
  for (const hijo of nodo.hijos || []) {
    const encontrado = buscarPorTexto(hijo, texto);
    if (encontrado) return encontrado;
  }
  return null;
}

function buscarTodos(nodo, predicado, encontrados = []) {
  if (!nodo) return encontrados;
  if (predicado(nodo)) encontrados.push(nodo);
  for (const hijo of nodo.hijos || []) buscarTodos(hijo, predicado, encontrados);
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

function crearContexto(opciones = {}) {
  const store = opciones.store || new Map();
  const localStorage = {
    getItem: (clave) => (store.has(clave) ? store.get(clave) : null),
    setItem: (clave, valor) => {
      store.set(String(clave), String(valor));
    },
    removeItem: (clave) => {
      store.delete(clave);
    },
    get length() {
      return store.size;
    },
    key: (indice) => [...store.keys()][indice] ?? null,
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

  const timeoutsPendientes = new Map();
  let proximoTimeoutId = 0;

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

  const window = {
    location: { href: '' },
    confirm: opciones.confirm || (() => true),
    listeners: {},
    addEventListener(tipo, fn) {
      (this.listeners[tipo] ||= []).push(fn);
    },
  };

  const nodos = crearNodosBase();
  if (opciones.nodos) {
    for (const [id, valor] of Object.entries(opciones.nodos)) {
      nodos[id] = valor === null ? null : crearNodo(valor);
    }
  }
  if (opciones.sinNodos) {
    for (const id of opciones.sinNodos) delete nodos[id];
  }

  const document = {
    body: opciones.body || { dataset: opciones.dataset || {} },
    getElementById: (id) => nodos[id] || null,
    createElement: (tag) => crearNodo({ tagName: String(tag).toUpperCase() }),
    addEventListener() {},
  };

  const ctx = {
    ROOT_URL: 'http://back.test',
    window,
    document,
    localStorage,
    fetch,
    atob: (base64) => Buffer.from(base64, 'base64').toString('binary'),
    setTimeout: (fn, ms) => {
      proximoTimeoutId += 1;
      timeoutsPendientes.set(proximoTimeoutId, { fn, ms });
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
    console: {
      error: registrar(consola.errores),
      warn: registrar(consola.avisos),
      info: registrar(consola.infos),
      log: registrar(consola.logs),
    },
  };

  vm.createContext(ctx);
  vm.runInContext(FUENTE + EXPORTS, ctx, { filename: 'mensajes.js' });

  return {
    ctx,
    ctxTest: ctx.__test,
    nodos,
    store,
    fetchLog,
    consola,
    timeoutsPendientes,
  };
}

console.log('# mensajes.js — plantillas y contactos');

test('resumirMensaje recorta a ~70 caracteres y usa "Sin mensaje"', () => {
  const t = crearContexto();
  assert.equal(t.ctxTest.resumirMensaje(''), 'Sin mensaje');
  assert.equal(t.ctxTest.resumirMensaje('   '), 'Sin mensaje');
  assert.equal(t.ctxTest.resumirMensaje('  hola   mundo  '), 'hola mundo');
  const resumen = t.ctxTest.resumirMensaje('a'.repeat(100));
  assert.equal(resumen.length, 71);
  assert.ok(resumen.endsWith('…'));
});

test('claveConUsuario usa el email del JWT o la clave simple', () => {
  const t = crearContexto({ store: new Map([['token', crearToken({ email: 'ana@test.com' })]]) });
  assert.equal(t.ctxTest.claveConUsuario('beepsafe_mensajes'), 'beepsafe_mensajes:ana@test.com');

  const t2 = crearContexto({ store: new Map([['token', 'basura']]) });
  assert.equal(t2.ctxTest.claveConUsuario('beepsafe_mensajes'), 'beepsafe_mensajes');
});

test('JS/mensajes.js no construye HTML dinámico con innerHTML', () => {
  const conInnerHtml = FUENTE.split(/\r?\n/).filter(
    (linea) => linea.includes('innerHTML') && !linea.includes("innerHTML = ''")
  );
  assert.deepEqual(conInnerHtml, [], 'innerHTML solo se usa para vaciar con una cadena vacía');
});

test('las cinco páginas de mensaje cumplen el contrato de HTML', () => {
  const paginas = [
    ['mensajeDeInicio.html', 'inicio', 'mensajeDeInicio.PNG', 'Mensaje de inicio'],
    ['mensajeDeFin.html', 'fin', 'mensajeDeFin.PNG', 'Mensaje de fin'],
    ['mensajeDeAlarma.html', 'alarma', 'mensajeDeAlarma.PNG', 'Mensaje de alarma'],
    [
      'mensajeDeCancelacion.html',
      'cancelacion',
      'mensajeDeAlarma.PNG',
      'Mensaje de cancelación de alarma',
    ],
    ['mensajeDePrueba.html', 'prueba', 'MensajeDePrueba.jpeg', 'Mensaje de prueba'],
  ];
  const ids = [
    'mensaje',
    'botonGrabar',
    'estadoMensaje',
    'contadorMensaje',
    'seccionContactos',
    'listaContactos',
    'formAgregarContacto',
    'contactoNombre',
    'contactoTelefono',
    'contactoMensajes',
    'botonAgregarContacto',
    'estadoContactos',
  ];
  const prohibidos = [
    'Grupos',
    'Agregar destinatario',
    'El Ombu',
    'Treking el Chalten',
    'Juan',
    'Pedro',
    'Luis',
    'Kayak Rio Manso',
  ];

  for (const [archivo, tipo, icono, titulo] of paginas) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'pages', archivo), 'utf8');
    for (const id of ids) {
      assert.ok(html.includes(`id="${id}"`), `${archivo}: falta #${id}`);
    }
    assert.ok(html.includes(`data-tipo="${tipo}"`), `${archivo}: data-tipo incorrecto`);
    assert.ok(html.includes('data-page="editor"'), `${archivo}: falta data-page="editor"`);
    assert.ok(html.includes('../imagenes/volver.PNG'), `${archivo}: falta el botón volver`);
    assert.ok(
      html.includes(`<img src="../imagenes/${icono}" alt="" class="encabezado">`),
      `${archivo}: falta el icono ${icono} con class="encabezado"`
    );
    assert.ok(
      html.includes(`<div class="opciones">${titulo}</div>`),
      `${archivo}: falta el título "${titulo}" en class="opciones"`
    );
    assert.ok(html.includes('class="encabezadoBajada"'), `${archivo}: falta encabezadoBajada`);
    assert.ok(
      html.includes('href="../pages/misContactos.html"'),
      `${archivo}: falta el enlace a misContactos.html`
    );
    assert.ok(
      html.includes('Gestionar todos mis contactos'),
      `${archivo}: falta el texto del enlace a misContactos.html`
    );
    assert.ok(html.includes('maxlength="1000"'), `${archivo}: falta maxlength=1000`);
    assert.ok(html.includes('id="botonGrabar" type="button"'), `${archivo}: el botón debe ser type=button`);
    assert.ok(
      !html.includes('Quiero que reciba mis mensajes'),
      `${archivo}: no debe quedar el texto viejo del checkbox`
    );
    assert.ok(
      html.includes('id="contactoMensajes" name="mensajes" checked hidden'),
      `${archivo}: #contactoMensajes debe seguir existiendo, oculto`
    );
    assert.ok(html.includes('>0 de 3</span>'), `${archivo}: el contador arranca en 0 de 3`);
    assert.ok(html.includes('../JS/config.js'), `${archivo}: falta config.js`);
    assert.ok(html.includes('../JS/mensajes.js'), `${archivo}: falta mensajes.js`);
    if (tipo === 'cancelacion') {
      assert.ok(
        html.includes('Este mensaje se envía desde tu WhatsApp cuando avisás que estás bien.'),
        `${archivo}: falta la nota gris exacta`
      );
      assert.ok(html.includes('class="msj-nota"'), `${archivo}: la nota debe usar msj-nota`);
      assert.ok(!html.includes('mensajeFijoAntes'), `${archivo}: no lleva marco fijo`);
      assert.ok(!html.includes('mensajeFijoDespues'), `${archivo}: no lleva marco fijo`);
    }
    for (const prohibido of prohibidos) {
      assert.ok(!html.includes(prohibido), `${archivo}: no debe contener "${prohibido}"`);
    }
  }
});

test('las tres páginas declaran el preview fijo antes y después del textarea (REL-004)', () => {
  const paginas = [
    [
      'mensajeDeInicio.html',
      'Aviso de BeepSafe para María: Marcelo comenzó una sesión de windsurf.',
      /^Tiene previsto finalizarla el .+ - Enviado desde BeepSafe\.$/,
    ],
    [
      'mensajeDeFin.html',
      'Aviso de BeepSafe para María: Marcelo finalizó su sesión de windsurf.',
      /^- Enviado desde BeepSafe\.$/,
    ],
    [
      'mensajeDeAlarma.html',
      'Aviso de BeepSafe para María: Marcelo no detuvo su sesión de windsurf en el tiempo previsto.',
      /^- Enviado desde BeepSafe\.$/,
    ],
  ];

  const contenidoFijo = (html, id) => {
    const coincidencia = html.match(new RegExp(`<p[^>]*id="${id}"[^>]*>([^<]*)</p>`));
    return coincidencia ? coincidencia[1].trim() : null;
  };

  for (const [archivo, antes, despuesPatron] of paginas) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'pages', archivo), 'utf8');
    assert.equal(
      contenidoFijo(html, 'mensajeFijoAntes'),
      antes,
      `${archivo}: copy fijo de #mensajeFijoAntes`
    );
    const despues = contenidoFijo(html, 'mensajeFijoDespues');
    assert.ok(despues !== null, `${archivo}: falta #mensajeFijoDespues`);
    assert.match(despues, despuesPatron, `${archivo}: copy fijo de #mensajeFijoDespues`);
  }
});

test('misMensajes.html lista los cinco tipos y el enlace a invitación', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pages', 'misMensajes.html'), 'utf8');
  assert.ok(html.includes('id="listaMensajes"'), 'falta la lista de mensajes');
  for (const [archivo, preview] of [
    ['mensajeDeInicio.html', 'previewInicio'],
    ['mensajeDeFin.html', 'previewFin'],
    ['mensajeDeAlarma.html', 'previewAlarma'],
    ['mensajeDeCancelacion.html', 'previewCancelacion'],
    ['mensajeDePrueba.html', 'previewPrueba'],
  ]) {
    assert.ok(html.includes(`href="../pages/${archivo}"`), `falta el enlace a ${archivo}`);
    assert.ok(html.includes(`id="${preview}"`), `falta el preview #${preview}`);
  }
  assert.ok(html.includes('href="../pages/invitacion.html"'), 'falta el enlace a invitación');
  assert.ok(html.includes('../JS/config.js'), 'falta config.js');
  assert.ok(html.includes('../JS/mensajes.js'), 'falta mensajes.js');
});

async function testsAsync() {
  await testAsync('cargarMensajes devuelve los valores del backend y los espeja en localStorage', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      store,
      fetch: async (url) => {
        assert.equal(url, 'http://back.test/api/message-templates');
        return respuestaOk({
          mensajes: {
            inicio: 'Hola',
            fin: 'Chau',
            alarma: 'Alerta',
            cancelacion: '',
            prueba: 'Prueba',
          },
        });
      },
    });

    const resultado = await t.ctxTest.cargarMensajes();
    assert.deepEqual(plano(resultado), {
      ok: true,
      sesionExpirada: false,
      mensajes: {
        inicio: 'Hola',
        fin: 'Chau',
        alarma: 'Alerta',
        cancelacion: '',
        prueba: 'Prueba',
      },
      pendientes: [],
      degradado: false,
    });
    assert.equal(t.fetchLog[0].init.headers.Authorization, `Bearer ${token}`);

    const espejo = JSON.parse(store.get('beepsafe_mensajes:ana@test.com'));
    assert.deepEqual(espejo.mensajes, plano(resultado.mensajes));
    assert.deepEqual(espejo.pendientes, {});
  });

  await testAsync('cargarMensajes cae a la copia local con degradado:true si falla la red', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([
      ['token', token],
      [
        'beepsafe_mensajes:ana@test.com',
        JSON.stringify({
          mensajes: { inicio: 'Local', fin: '', alarma: '', prueba: '' },
          degradado: false,
        }),
      ],
    ]);
    const t = crearContexto({
      store,
      fetch: async () => {
        throw new Error('red caída');
      },
    });

    const resultado = await t.ctxTest.cargarMensajes();
    assert.equal(resultado.degradado, true);
    assert.equal(resultado.mensajes.inicio, 'Local');
    assert.ok(
      t.consola.errores.some(
        (mensaje) => mensaje.includes('[mensajes]') && mensaje.includes('message-templates')
      ),
      'el fallo se loguea con el prefijo [mensajes]'
    );
  });

  await testAsync('cargarMensajes usa la clave simple y los defaults si no hay JWT decodificable', async () => {
    const store = new Map([
      ['token', 'no-es-un-jwt'],
      ['beepsafe_mensajes', JSON.stringify({ mensajes: { inicio: 'Simple' } })],
    ]);
    const t = crearContexto({ store, fetch: async () => respuestaFail(503) });

    const resultado = await t.ctxTest.cargarMensajes();
    assert.equal(resultado.degradado, true);
    assert.equal(resultado.mensajes.inicio, 'Simple');
    assert.equal(resultado.mensajes.fin, '');
  });

  await testAsync('cargarMensajes degrada si el JSON del backend es ilegible', async () => {
    const store = new Map([
      ['beepsafe_mensajes', JSON.stringify({ mensajes: { inicio: 'Local' } })],
    ]);
    const t = crearContexto({
      store,
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('json roto');
        },
      }),
    });

    const resultado = await t.ctxTest.cargarMensajes();
    assert.equal(resultado.degradado, true);
    assert.equal(resultado.mensajes.inicio, 'Local');
  });

  await testAsync('guardarMensaje hace PUT parcial con Bearer y limpia el marcador degradado', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([
      ['token', token],
      [
        'beepsafe_mensajes:ana@test.com',
        JSON.stringify({
          mensajes: { inicio: '', fin: '', alarma: '', prueba: '' },
          degradado: true,
        }),
      ],
    ]);
    const t = crearContexto({
      store,
      fetch: async () => respuestaOk({ mensajes: { inicio: 'Nuevo' } }),
    });

    const resultado = await t.ctxTest.guardarMensaje('inicio', 'Nuevo');
    assert.deepEqual(plano(resultado), { ok: true });

    const [llamada] = t.fetchLog;
    assert.equal(llamada.url, 'http://back.test/api/message-templates');
    assert.equal(llamada.init.method, 'PUT');
    assert.equal(llamada.init.headers.Authorization, `Bearer ${token}`);
    assert.equal(llamada.init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(llamada.init.body), { mensajes: { inicio: 'Nuevo' } });

    const espejo = JSON.parse(store.get('beepsafe_mensajes:ana@test.com'));
    assert.equal(espejo.mensajes.inicio, 'Nuevo');
    assert.deepEqual(espejo.pendientes, {});
  });

  await testAsync('guardarMensaje en fallo persiste localmente y devuelve degradado:true', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([
      ['token', token],
      [
        'beepsafe_mensajes:ana@test.com',
        JSON.stringify({
          mensajes: { inicio: 'Viejo', fin: '', alarma: '', prueba: '' },
          degradado: false,
        }),
      ],
    ]);
    const t = crearContexto({
      store,
      fetch: async () => {
        throw new Error('sin red');
      },
    });

    const resultado = await t.ctxTest.guardarMensaje('fin', 'Guardado local');
    assert.deepEqual(plano(resultado), { ok: false, degradado: true });

    const espejo = JSON.parse(store.get('beepsafe_mensajes:ana@test.com'));
    assert.equal(espejo.mensajes.fin, 'Guardado local');
    assert.equal(espejo.mensajes.inicio, 'Viejo');
    assert.equal(espejo.pendientes.fin, true);
    assert.ok(
      t.consola.errores.some(
        (mensaje) => mensaje.includes('[mensajes]') && mensaje.includes('PUT message-templates')
      )
    );
  });

  await testAsync('cargarContactos hace GET /api/contacts con Bearer y normaliza la lista', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      store,
      fetch: async () =>
        respuestaOk({
          contactos: [
            { nombre: 'Ana', telefono: '123', mensajes: true, visibilidad: false },
            { nombre: 42 },
          ],
        }),
    });

    const resultado = await t.ctxTest.cargarContactos();
    assert.equal(resultado.ok, true);
    assert.deepEqual(plano(resultado.contactos), [
      {
        nombre: 'Ana',
        telefono: '123',
        mensajes: true,
        mensajesPorTipo: {
          inicio: true,
          fin: true,
          alarma: true,
          cancelacion: true,
          prueba: true,
        },
        visibilidad: false,
      },
    ]);
    assert.equal(t.fetchLog[0].url, 'http://back.test/api/contacts');
    assert.equal(t.fetchLog[0].init.method, 'GET');
    assert.equal(t.fetchLog[0].init.headers.Authorization, `Bearer ${token}`);
  });

  await testAsync('agregarContacto hace POST /api/contacts con el cuerpo esperado', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({ store, fetch: async () => respuestaOk({}) });

    const resultado = await t.ctxTest.agregarContacto({
      nombre: 'Ana',
      telefono: '123',
      mensajes: true,
      visibilidad: false,
    });
    assert.deepEqual(plano(resultado), { ok: true });

    const [llamada] = t.fetchLog;
    assert.equal(llamada.url, 'http://back.test/api/contacts');
    assert.equal(llamada.init.method, 'POST');
    assert.equal(llamada.init.headers.Authorization, `Bearer ${token}`);
    assert.deepEqual(JSON.parse(llamada.init.body), {
      nombre: 'Ana',
      telefono: '123',
      mensajes: true,
      visibilidad: false,
    });
  });

  await testAsync('actualizarContacto hace PUT /api/contacts keyed por nombre', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({ store, fetch: async () => respuestaOk({}) });

    const resultado = await t.ctxTest.actualizarContacto({
      nombre: 'Ana',
      mensajes: false,
      visibilidad: true,
    });
    assert.deepEqual(plano(resultado), { ok: true });

    const [llamada] = t.fetchLog;
    assert.equal(llamada.url, 'http://back.test/api/contacts');
    assert.equal(llamada.init.method, 'PUT');
    assert.equal(llamada.init.headers.Authorization, `Bearer ${token}`);
    assert.deepEqual(JSON.parse(llamada.init.body), {
      nombre: 'Ana',
      mensajes: false,
      visibilidad: true,
    });
  });

  await testAsync('eliminarContacto hace DELETE /api/contacts?nombre=... codificado', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({ store, fetch: async () => respuestaOk({}) });
    const nombre = 'Ana Pérez & Cía';

    const resultado = await t.ctxTest.eliminarContacto(nombre);
    assert.deepEqual(plano(resultado), { ok: true });

    const [llamada] = t.fetchLog;
    assert.equal(
      llamada.url,
      `http://back.test/api/contacts?nombre=${encodeURIComponent(nombre)}`
    );
    assert.equal(llamada.init.method, 'DELETE');
    assert.equal(llamada.init.headers.Authorization, `Bearer ${token}`);
  });

  await testAsync('los wrappers de contactos nunca lanzan y devuelven ok:false', async () => {
    const t = crearContexto({
      fetch: async () => {
        throw new Error('sin red');
      },
    });

    assert.equal((await t.ctxTest.cargarContactos()).ok, false);
    assert.equal(
      (await t.ctxTest.agregarContacto({ nombre: 'A', telefono: '1' })).ok,
      false
    );
    assert.equal(
      (await t.ctxTest.actualizarContacto({ nombre: 'A', mensajes: true, visibilidad: true })).ok,
      false
    );
    assert.equal((await t.ctxTest.eliminarContacto('A')).ok, false);
    assert.ok(
      t.consola.errores.every((mensaje) => mensaje.includes('[mensajes]')),
      'todos los fallos llevan el prefijo [mensajes]'
    );
  });

  await testAsync('guardarDesdeEditor conserva el texto y confirma "Mensaje guardado"', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({ store, fetch: async () => respuestaOk({}) });
    const textarea = { value: 'Hola a todos' };
    const boton = { disabled: false };
    const estado = crearEstadoStub();

    await t.ctxTest.guardarDesdeEditor('inicio', textarea, boton, estado);

    assert.equal(textarea.value, 'Hola a todos', 'el textarea no se vacía al guardar');
    assert.equal(estado.textContent, 'Mensaje guardado');
    assert.ok(estado.classList.contains('mensajes-estado-ok'));
    assert.equal(boton.disabled, false);
    assert.deepEqual(JSON.parse(t.fetchLog[0].init.body), {
      mensajes: { inicio: 'Hola a todos' },
    });
  });

  await testAsync('guardarDesdeEditor avisa la degradación y conserva el texto', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      store: new Map([['token', token]]),
      fetch: async () => {
        throw new Error('sin red');
      },
    });
    const textarea = { value: 'Hola' };
    const boton = { disabled: false };
    const estado = crearEstadoStub();

    await t.ctxTest.guardarDesdeEditor('fin', textarea, boton, estado);

    assert.equal(textarea.value, 'Hola', 'el textarea no se vacía en modo degradado');
    assert.equal(estado.textContent, 'Guardado en este dispositivo, pendiente de sincronizar');
    assert.ok(estado.classList.contains('mensajes-estado-aviso'));
  });

  await testAsync('guardarDesdeEditor no envía un mensaje vacío', async () => {
    const t = crearContexto({ fetch: async () => respuestaOk({}) });
    const textarea = { value: '   ' };
    const boton = { disabled: false };
    const estado = crearEstadoStub();

    await t.ctxTest.guardarDesdeEditor('inicio', textarea, boton, estado);

    assert.equal(t.fetchLog.length, 0, 'no se hace PUT con texto vacío');
    assert.equal(estado.textContent, 'Escribí un mensaje antes de grabar.');
  });

  await testAsync('el editor precarga el textarea desde un GET exitoso y actualiza el contador', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      store,
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.endsWith('/api/message-templates') && metodo === 'GET') {
          return respuestaOk({
            mensajes: { inicio: 'Hola equipo', fin: '', alarma: '', prueba: '' },
          });
        }
        if (url.includes('/api/contacts') && metodo === 'GET') {
          return respuestaOk({ contactos: [] });
        }
        throw new Error(`URL inesperada: ${url} ${metodo}`);
      },
    });

    await t.ctxTest.inicializarEditorMensaje('inicio');

    assert.equal(t.nodos.mensaje.value, 'Hola equipo');
    assert.equal(t.nodos.contadorMensaje.textContent, '11/1000');
    assert.equal(t.nodos.botonGrabar.disabled, false);
  });

  await testAsync('el editor de cancelación precarga el texto por defecto y lo guarda', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      dataset: { tipo: 'cancelacion' },
      store,
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.endsWith('/api/message-templates') && metodo === 'GET') {
          return respuestaOk({ mensajes: {} });
        }
        if (url.endsWith('/api/message-templates') && metodo === 'PUT') return respuestaOk({});
        if (url.includes('/api/contacts') && metodo === 'GET') {
          return respuestaOk({ contactos: [] });
        }
        throw new Error(`URL inesperada: ${url} ${metodo}`);
      },
    });

    await t.ctxTest.inicializarEditorMensaje('cancelacion');

    const texto = t.ctxTest.MENSAJES_POR_DEFECTO.cancelacion;
    assert.equal(
      texto,
      'Estoy bien! Solo no llegué a cancelar la alarma a tiempo.',
      'texto por defecto exacto'
    );
    assert.equal(t.nodos.mensaje.value, texto, 'el textarea arranca con el texto por defecto');
    assert.equal(t.nodos.contadorMensaje.textContent, `${texto.length}/1000`);

    await t.nodos.botonGrabar.disparar('click');
    const put = t.fetchLog.find((llamada) => llamada.init && llamada.init.method === 'PUT');
    assert.ok(put, 'se guarda la cancelación');
    assert.deepEqual(JSON.parse(put.init.body), { mensajes: { cancelacion: texto } });
  });

  await testAsync('la lista renderiza un preview por tipo con el texto guardado', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      store,
      fetch: async () =>
        respuestaOk({
          mensajes: {
            inicio: 'Arranco la actividad',
            fin: 'Terminé la actividad',
            alarma: 'Necesito ayuda',
            cancelacion: 'Estoy bien, fue una falsa alarma',
            prueba: 'Este es un mensaje de prueba',
          },
        }),
    });

    await t.ctxTest.inicializarListaMensajes();

    assert.equal(t.nodos.previewInicio.textContent, 'Arranco la actividad');
    assert.equal(t.nodos.previewFin.textContent, 'Terminé la actividad');
    assert.equal(t.nodos.previewAlarma.textContent, 'Necesito ayuda');
    assert.equal(t.nodos.previewCancelacion.textContent, 'Estoy bien, fue una falsa alarma');
    assert.equal(t.nodos.previewPrueba.textContent, 'Este es un mensaje de prueba');
  });

  await testAsync('los contactos renderizan fila y los clicks disparan POST/PUT/DELETE', async () => {
    let contactos = [
      { nombre: 'Ana', telefono: '+54911 1234 5678', mensajes: true, visibilidad: true },
    ];
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      store,
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (!url.includes('/api/contacts')) throw new Error(`URL inesperada: ${url}`);
        if (metodo === 'GET') return respuestaOk({ contactos });
        if (metodo === 'POST') {
          contactos = [...contactos, JSON.parse(init.body)];
          return respuestaOk({});
        }
        if (metodo === 'PUT') return respuestaOk({});
        if (metodo === 'DELETE') {
          contactos = [];
          return respuestaOk({});
        }
        throw new Error(`método inesperado: ${metodo}`);
      },
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 1);
    const fila = t.nodos.listaContactos.hijos[0];
    const textos = textosDe(fila);
    assert.ok(textos.includes('Ana'), 'la fila muestra el nombre');
    assert.ok(textos.includes('+54911 1234 5678'), 'la fila muestra el teléfono');
    assert.ok(textos.includes('Recibe mensajes'), 'la fila muestra el marcador de mensajes');

    t.nodos.contactoNombre.value = 'Beto';
    t.nodos.contactoTelefono.value = '555';
    t.nodos.contactoMensajes.checked = true;
    await t.nodos.formAgregarContacto.disparar('submit', { preventDefault() {} });

    const post = t.fetchLog.find((llamada) => llamada.init && llamada.init.method === 'POST');
    assert.ok(post, 'se hizo POST al agregar');
    assert.equal(post.url, 'http://back.test/api/contacts');
    assert.deepEqual(JSON.parse(post.init.body), {
      nombre: 'Beto',
      telefono: '555',
      mensajes: true,
      visibilidad: true,
    });

    const filaBeto = t.nodos.listaContactos.hijos.find((nodo) => textosDe(nodo).includes('Beto'));
    assert.ok(filaBeto, 'la fila nueva aparece tras el refresh');
    await buscarPorTexto(filaBeto, 'Editar').disparar('click');
    await buscarPorTexto(filaBeto, 'Guardar').disparar('click');

    const put = t.fetchLog.find((llamada) => llamada.init && llamada.init.method === 'PUT');
    assert.ok(put, 'se hizo PUT al editar');
    assert.equal(put.url, 'http://back.test/api/contacts');
    assert.deepEqual(JSON.parse(put.init.body), {
      nombre: 'Beto',
      mensajes: true,
      visibilidad: true,
    });

    const filaActual = t.nodos.listaContactos.hijos.find((nodo) => textosDe(nodo).includes('Beto'));
    await buscarPorTexto(filaActual, 'Eliminar').disparar('click');

    const borrado = t.fetchLog.find((llamada) => llamada.init && llamada.init.method === 'DELETE');
    assert.ok(borrado, 'se hizo DELETE al eliminar');
    assert.equal(borrado.url, 'http://back.test/api/contacts?nombre=Beto');
    assert.equal(t.nodos.listaContactos.hijos.length, 0);
    assert.equal(t.nodos.estadoContactos.textContent, 'Contacto eliminado.');
  });

  await testAsync('la lista de contactos muestra solo a quienes reciben mensajes', async () => {
    let contactos = [
      { nombre: 'Ana', telefono: '111', mensajes: true, visibilidad: true },
      { nombre: 'Beto', telefono: '222', mensajes: false, visibilidad: true },
      { nombre: 'Carla', telefono: '333', mensajes: true, visibilidad: true },
    ];
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      store: new Map([['token', token]]),
      fetch: async () => respuestaOk({ contactos }),
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 2, 'solo se renderizan los receptores');
    const textos = t.nodos.listaContactos.hijos.map((nodo) => textosDe(nodo)).flat();
    assert.ok(textos.includes('Ana'), 'la receptora Ana se muestra');
    assert.ok(textos.includes('Carla'), 'la receptora Carla se muestra');
    assert.ok(!textos.includes('Beto'), 'Beto no recibe mensajes y no se muestra');

    contactos = contactos.map((contacto) => ({ ...contacto, mensajes: false }));
    await t.ctxTest.refrescarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 0, 'sin receptores no hay filas');
    assert.ok(
      t.nodos.estadoContactos.textContent.includes('que reciban mensajes'),
      'el estado vacío aclara que no hay contactos que reciban mensajes'
    );
  });

  await testAsync('desmarcar "Recibe mis mensajes" oculta la fila y conserva el aviso', async () => {
    let contactos = [
      { nombre: 'Ana', telefono: '111', mensajes: true, visibilidad: true },
    ];
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      store: new Map([['token', token]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (metodo === 'GET') return respuestaOk({ contactos });
        if (metodo === 'PUT') {
          const cuerpo = JSON.parse(init.body);
          contactos = contactos.map((contacto) =>
            contacto.nombre === cuerpo.nombre ? { ...contacto, ...cuerpo } : contacto
          );
          return respuestaOk({});
        }
        throw new Error(`método inesperado: ${metodo}`);
      },
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 1, 'Ana arranca listada');
    const fila = t.nodos.listaContactos.hijos[0];
    await buscarPorTexto(fila, 'Editar').disparar('click');

    const ayuda = buscarPorTexto(fila, 'Si lo desactivás, dejará de aparecer en esta lista.');
    assert.ok(ayuda, 'el editor muestra el aviso de consecuencias');
    const checks = buscarTodos(fila, (nodo) => nodo.type === 'checkbox');
    assert.equal(checks.length, 2, 'el editor tiene los dos checks');
    checks[0].checked = false;

    await buscarPorTexto(fila, 'Guardar').disparar('click');
    assert.equal(t.nodos.listaContactos.hijos.length, 0, 'la fila desaparece al dejar de recibir');
    assert.equal(t.nodos.estadoContactos.textContent, 'Contacto actualizado.');
    assert.ok(t.nodos.estadoContactos.classList.contains('mensajes-estado-ok'));
  });

  await testAsync('agregar un contacto sin el check no lo agrega a la lista visible', async () => {
    let contactos = [
      { nombre: 'Ana', telefono: '111', mensajes: true, visibilidad: true },
    ];
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      store: new Map([['token', token]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (metodo === 'GET') return respuestaOk({ contactos });
        if (metodo === 'POST') {
          contactos = [...contactos, JSON.parse(init.body)];
          return respuestaOk({});
        }
        throw new Error(`método inesperado: ${metodo}`);
      },
    });

    await t.ctxTest.inicializarContactos();
    t.nodos.contactoNombre.value = 'Beto';
    t.nodos.contactoTelefono.value = '222';
    t.nodos.contactoMensajes.checked = false;
    await t.nodos.formAgregarContacto.disparar('submit', { preventDefault() {} });

    const post = t.fetchLog.find((llamada) => llamada.init && llamada.init.method === 'POST');
    assert.ok(post, 'se hizo POST al agregar');
    assert.deepEqual(JSON.parse(post.init.body), {
      nombre: 'Beto',
      telefono: '222',
      mensajes: false,
      visibilidad: true,
    });
    assert.equal(t.nodos.listaContactos.hijos.length, 1, 'solo sigue visible Ana');
    assert.ok(
      !textosDe(t.nodos.listaContactos).includes('Beto'),
      'Beto no aparece porque no recibe mensajes'
    );
  });

  await testAsync('la lista filtra por mensajesPorTipo del tipo de la página', async () => {
    const contactos = [
      {
        nombre: 'Ana',
        telefono: '111',
        mensajes: true,
        mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
        visibilidad: true,
      },
      {
        nombre: 'Beto',
        telefono: '222',
        mensajes: true,
        mensajesPorTipo: { inicio: false, fin: true, alarma: false, prueba: false },
        visibilidad: true,
      },
      {
        nombre: 'Carla',
        telefono: '333',
        mensajes: false,
        mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
        visibilidad: true,
      },
    ];
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async () => respuestaOk({ contactos }),
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 2, 'solo se listan Ana y Carla');
    const textos = t.nodos.listaContactos.hijos.map((nodo) => textosDe(nodo)).flat();
    assert.ok(textos.includes('Ana'), 'Ana recibe inicio y se lista');
    assert.ok(textos.includes('Carla'), 'Carla recibe inicio y se lista');
    assert.ok(!textos.includes('Beto'), 'Beto recibe fin y no se lista en inicio');
    assert.equal(t.nodos.contadorContactos.textContent, '2 de 3');
  });

  await testAsync('un contacto asignado solo a otro tipo no se lista', async () => {
    const contactos = [
      {
        nombre: 'Beto',
        telefono: '222',
        mensajes: true,
        mensajesPorTipo: { inicio: false, fin: true, alarma: false, prueba: false },
        visibilidad: true,
      },
    ];
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async () => respuestaOk({ contactos }),
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 0, 'el contacto de fin no aparece en inicio');
    assert.ok(
      t.nodos.estadoContactos.textContent.includes('para este mensaje'),
      'el estado vacío habla del mensaje de la página'
    );
    assert.equal(t.nodos.contadorContactos.textContent, '0 de 3');
  });

  await testAsync('el alta envía mensajesPorTipo solo con el tipo de la página', async () => {
    let contactos = [];
    const t = crearContexto({
      dataset: { tipo: 'alarma' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (metodo === 'GET') return respuestaOk({ contactos });
        if (metodo === 'POST') {
          contactos = [...contactos, JSON.parse(init.body)];
          return respuestaOk({});
        }
        throw new Error(`método inesperado: ${metodo}`);
      },
    });

    await t.ctxTest.inicializarContactos();
    t.nodos.contactoNombre.value = 'Beto';
    t.nodos.contactoTelefono.value = '555';
    t.nodos.contactoMensajes.checked = true;
    await t.nodos.formAgregarContacto.disparar('submit', { preventDefault() {} });

    const post = t.fetchLog.find((llamada) => llamada.init && llamada.init.method === 'POST');
    assert.ok(post, 'se hizo POST al agregar');
    assert.deepEqual(JSON.parse(post.init.body), {
      nombre: 'Beto',
      telefono: '555',
      visibilidad: true,
      mensajesPorTipo: { alarma: true },
    });
    const cuerpo = JSON.parse(post.init.body);
    assert.equal('mensajes' in cuerpo, false, 'el alta no envía el booleano legacy');
    assert.deepEqual(Object.keys(cuerpo.mensajesPorTipo), ['alarma']);
    assert.equal(t.nodos.listaContactos.hijos.length, 1, 'el contacto nuevo aparece en la lista');
  });

  await testAsync('la edición hace PUT con mensajesPorTipo solo del tipo de la página', async () => {
    const contactos = [
      {
        nombre: 'Ana',
        telefono: '111',
        mensajes: true,
        mensajesPorTipo: { inicio: true, fin: true, alarma: false, prueba: false },
        visibilidad: true,
      },
    ];
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (metodo === 'GET') return respuestaOk({ contactos });
        if (metodo === 'PUT') return respuestaOk({});
        throw new Error(`método inesperado: ${metodo}`);
      },
    });

    await t.ctxTest.inicializarContactos();
    const fila = t.nodos.listaContactos.hijos[0];
    await buscarPorTexto(fila, 'Editar').disparar('click');
    const checks = buscarTodos(fila, (nodo) => nodo.type === 'checkbox');
    assert.equal(checks.length, 2, 'el editor tiene los dos checks');
    assert.equal(checks[0].checked, true, 'el check refleja el tipo de la página');
    checks[0].checked = false;

    await buscarPorTexto(fila, 'Guardar').disparar('click');
    const put = t.fetchLog.find((llamada) => llamada.init && llamada.init.method === 'PUT');
    assert.ok(put, 'se hizo PUT al editar');
    assert.deepEqual(JSON.parse(put.init.body), {
      nombre: 'Ana',
      visibilidad: true,
      mensajesPorTipo: { inicio: false },
    });
    const cuerpo = JSON.parse(put.init.body);
    assert.equal('mensajes' in cuerpo, false, 'la edición no envía el booleano legacy');
    assert.deepEqual(Object.keys(cuerpo.mensajesPorTipo), ['inicio']);
  });

  await testAsync('con 3 contactos el alta se deshabilita y el contador marca 3 de 3', async () => {
    const contactos = Array.from({ length: 3 }, (_, indice) => ({
      nombre: `Contacto ${indice}`,
      telefono: `555${indice}`,
      mensajes: true,
      mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
      visibilidad: true,
    }));
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async () => respuestaOk({ contactos }),
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 3, 'se listan los 3 contactos');
    assert.equal(t.nodos.contadorContactos.textContent, '3 de 3');
    assert.equal(t.nodos.mensajeLimiteContactos.textContent, 'Máximo 3 contactos por mensaje.');
    assert.equal(t.nodos.contactoNombre.disabled, true);
    assert.equal(t.nodos.contactoTelefono.disabled, true);
    assert.equal(t.nodos.contactoMensajes.disabled, true);
    assert.equal(t.nodos.botonAgregarContacto.disabled, true);

    t.nodos.contactoNombre.value = 'Beto';
    t.nodos.contactoTelefono.value = '999';
    await t.nodos.formAgregarContacto.disparar('submit', { preventDefault() {} });
    assert.equal(
      t.fetchLog.filter((llamada) => llamada.init && llamada.init.method === 'POST').length,
      0,
      'no se puede agregar un cuarto contacto'
    );
  });

  await testAsync('un 400 del backend muestra el mensaje del servidor', async () => {
    const contactos = [
      {
        nombre: 'Ana',
        telefono: '111',
        mensajes: true,
        mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
        visibilidad: true,
      },
    ];
    const mensajeServidor = 'Ya hay 3 contactos para este mensaje.';
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (metodo === 'GET') return respuestaOk({ contactos });
        if (metodo === 'POST') {
          return { ok: false, status: 400, json: async () => ({ error: mensajeServidor }) };
        }
        throw new Error(`método inesperado: ${metodo}`);
      },
    });

    await t.ctxTest.inicializarContactos();
    t.nodos.contactoNombre.value = 'Beto';
    t.nodos.contactoTelefono.value = '555';
    await t.nodos.formAgregarContacto.disparar('submit', { preventDefault() {} });

    assert.equal(t.nodos.estadoContactos.textContent, mensajeServidor);
    assert.ok(t.nodos.estadoContactos.classList.contains('mensajes-estado-error'));
  });

  await testAsync('un GET fallido conserva las filas y el contador ya renderizados', async () => {
    const contactos = [
      {
        nombre: 'Ana',
        telefono: '111',
        mensajes: true,
        mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
        visibilidad: true,
      },
      {
        nombre: 'Carla',
        telefono: '333',
        mensajes: true,
        mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
        visibilidad: true,
      },
    ];
    let intentos = 0;
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async () => {
        intentos += 1;
        if (intentos === 1) return respuestaOk({ contactos });
        throw new Error('red caída');
      },
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 2, 'arranca con dos filas');
    assert.equal(t.nodos.contadorContactos.textContent, '2 de 3');

    const ok = await t.ctxTest.refrescarContactos();
    assert.equal(ok, false, 'el refresh falla');
    assert.equal(t.nodos.listaContactos.hijos.length, 2, 'las filas siguen en pantalla');
    assert.equal(t.nodos.contadorContactos.textContent, '2 de 3', 'el contador no se toca');
    assert.equal(t.nodos.contactoNombre.disabled, false, 'el formulario sigue habilitado con filas');
    assert.ok(
      t.nodos.estadoContactos.textContent.includes('No se pudieron cargar los contactos'),
      'el error se informa en el estado'
    );
  });

  await testAsync('un 400 por límite reconcilia contador y formulario con el servidor', async () => {
    const crearContacto = (indice) => ({
      nombre: `Contacto ${indice}`,
      telefono: `555${indice}`,
      mensajes: true,
      mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
      visibilidad: true,
    });
    const dos = Array.from({ length: 2 }, (_, indice) => crearContacto(indice));
    const tres = Array.from({ length: 3 }, (_, indice) => crearContacto(indice));
    const mensajeServidor = 'Ya hay 3 contactos para este mensaje.';
    let contactos = dos;
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (metodo === 'GET') return respuestaOk({ contactos });
        if (metodo === 'POST') {
          contactos = tres;
          return { ok: false, status: 400, json: async () => ({ error: mensajeServidor }) };
        }
        throw new Error(`método inesperado: ${metodo}`);
      },
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.contadorContactos.textContent, '2 de 3');
    assert.equal(t.nodos.botonAgregarContacto.disabled, false);

    t.nodos.contactoNombre.value = 'Beto';
    t.nodos.contactoTelefono.value = '999';
    await t.nodos.formAgregarContacto.disparar('submit', { preventDefault() {} });

    assert.equal(t.nodos.listaContactos.hijos.length, 3, 'la lista converge a los 3 del servidor');
    assert.equal(t.nodos.contadorContactos.textContent, '3 de 3');
    assert.equal(t.nodos.botonAgregarContacto.disabled, true);
    assert.equal(t.nodos.contactoNombre.disabled, true);
    assert.equal(t.nodos.contactoTelefono.disabled, true);
    assert.equal(t.nodos.estadoContactos.textContent, mensajeServidor);
  });

  await testAsync('un alta exitosa con refresh fallido reintenta y no contradice filas y contador', async () => {
    const inicial = [
      {
        nombre: 'Ana',
        telefono: '111',
        mensajes: true,
        mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
        visibilidad: true,
      },
    ];
    let contactos = inicial;
    let gets = 0;
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store: new Map([['token', crearToken({ email: 'ana@test.com' })]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (metodo === 'POST') {
          contactos = [...contactos, JSON.parse(init.body)];
          return respuestaOk({});
        }
        gets += 1;
        if (gets === 1) return respuestaOk({ contactos });
        if (gets === 2) throw new Error('red caída');
        return respuestaOk({ contactos });
      },
    });

    await t.ctxTest.inicializarContactos();
    assert.equal(t.nodos.listaContactos.hijos.length, 1);
    assert.equal(t.nodos.contadorContactos.textContent, '1 de 3');

    t.nodos.contactoNombre.value = 'Beto';
    t.nodos.contactoTelefono.value = '555';
    await t.nodos.formAgregarContacto.disparar('submit', { preventDefault() {} });

    assert.equal(gets, 3, 'el refresh falla una vez y hay un único reintento');
    assert.equal(t.nodos.listaContactos.hijos.length, 2, 'las filas reflejan el alta exitosa');
    assert.equal(t.nodos.contadorContactos.textContent, '2 de 3');
    assert.equal(t.nodos.estadoContactos.textContent, 'Contacto agregado.');
    assert.ok(t.nodos.estadoContactos.classList.contains('mensajes-estado-ok'));
  });

  await testAsync('RES-001/REL-002: un guardado degradado sobrevive a un GET exitoso', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    let online = false;
    const t = crearContexto({
      store,
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (!url.endsWith('/api/message-templates')) throw new Error(`URL inesperada: ${url}`);
        if (metodo === 'PUT') return respuestaFail(500);
        if (!online) throw new Error('red caída');
        return respuestaOk({
          mensajes: { inicio: 'Servidor viejo', fin: 'Fin servidor', alarma: '', prueba: '' },
        });
      },
    });

    const guardado = await t.ctxTest.guardarMensaje('inicio', 'Texto escrito sin red');
    assert.deepEqual(plano(guardado), { ok: false, degradado: true });

    online = true;
    const resultado = await t.ctxTest.cargarMensajes();
    assert.equal(resultado.mensajes.inicio, 'Texto escrito sin red', 'no se pisa el texto local');
    assert.equal(resultado.mensajes.fin, 'Fin servidor', 'los tipos no pendientes sí se actualizan');
    assert.deepEqual(plano(resultado.pendientes), ['inicio']);
    assert.equal(resultado.degradado, true);

    const espejo = JSON.parse(store.get('beepsafe_mensajes:ana@test.com'));
    assert.equal(espejo.mensajes.inicio, 'Texto escrito sin red');
    assert.equal(espejo.pendientes.inicio, true);
  });

  await testAsync('un pendiente se limpia solo cuando el replay PUT tiene éxito', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    let online = false;
    const t = crearContexto({
      store,
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (!url.endsWith('/api/message-templates')) throw new Error(`URL inesperada: ${url}`);
        if (metodo === 'PUT') {
          if (!online) throw new Error('red caída');
          return respuestaOk({});
        }
        return respuestaOk({ mensajes: { inicio: 'Servidor viejo', fin: '', alarma: '', prueba: '' } });
      },
    });

    await t.ctxTest.guardarMensaje('inicio', 'Texto pendiente');
    let espejo = JSON.parse(store.get('beepsafe_mensajes:ana@test.com'));
    assert.equal(espejo.pendientes.inicio, true);

    online = true;
    const resultado = await t.ctxTest.cargarMensajes();
    assert.equal(resultado.mensajes.inicio, 'Texto pendiente');
    assert.deepEqual(plano(resultado.pendientes), []);
    assert.equal(resultado.degradado, false);

    espejo = JSON.parse(store.get('beepsafe_mensajes:ana@test.com'));
    assert.deepEqual(espejo.pendientes, {});
    const replay = t.fetchLog.filter(
      (llamada) => llamada.init && llamada.init.method === 'PUT'
    );
    assert.equal(replay.length, 2, 'un PUT del guardado fallido y uno del replay');
    assert.deepEqual(JSON.parse(replay[1].init.body), { mensajes: { inicio: 'Texto pendiente' } });
  });

  await testAsync('RES-002: 401 no escribe el espejo y un token ausente no envía "Bearer null"', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({ store, fetch: async () => respuestaFail(401) });

    const resultado = await t.ctxTest.guardarMensaje('inicio', 'No debe guardarse');
    assert.deepEqual(plano(resultado), { ok: false, sesionExpirada: true });
    assert.equal(store.has('beepsafe_mensajes:ana@test.com'), false, '401 no toca el espejo');
    assert.equal(t.fetchLog.length, 1);
    assert.equal(t.fetchLog[0].init.headers.Authorization, `Bearer ${token}`);

    const sinToken = crearContexto({ store: new Map() });
    const guardadoSinToken = await sinToken.ctxTest.guardarMensaje('inicio', 'Texto');
    assert.deepEqual(plano(guardadoSinToken), { ok: false, sesionExpirada: true });
    assert.equal(sinToken.fetchLog.length, 0, 'sin token no hay fetch');
    const cargaSinToken = await sinToken.ctxTest.cargarMensajes();
    assert.equal(cargaSinToken.sesionExpirada, true);
    assert.equal(cargaSinToken.ok, false);
    assert.equal(sinToken.fetchLog.length, 0, 'la carga tampoco manda Bearer null');
    assert.ok(
      sinToken.consola.errores.every((mensaje) => !mensaje.includes('Bearer null')),
      'nunca se construye un Bearer null'
    );
  });

  await testAsync('el estado pendiente y el de sesión expirada se renderizan en el nodo de estado', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      store,
      fetch: async () => {
        throw new Error('sin red');
      },
    });
    t.nodos.mensaje.value = 'Hola';
    await t.ctxTest.guardarDesdeEditor(
      'inicio',
      t.nodos.mensaje,
      t.nodos.botonGrabar,
      t.nodos.estadoMensaje
    );
    assert.equal(
      t.nodos.estadoMensaje.textContent,
      'Guardado en este dispositivo, pendiente de sincronizar'
    );
    assert.ok(t.nodos.estadoMensaje.classList.contains('mensajes-estado-aviso'));

    const t401 = crearContexto({
      store: new Map([['token', token]]),
      fetch: async () => respuestaFail(401),
    });
    t401.nodos.mensaje.value = 'Hola';
    await t401.ctxTest.guardarDesdeEditor(
      'inicio',
      t401.nodos.mensaje,
      t401.nodos.botonGrabar,
      t401.nodos.estadoMensaje
    );
    assert.ok(t401.nodos.estadoMensaje.textContent.startsWith('Tu sesión expiró.'));
    const enlace = buscarPorTexto(t401.nodos.estadoMensaje, 'Iniciá sesión de nuevo');
    assert.ok(enlace, 'el estado de sesión expirada incluye el enlace');
    assert.equal(enlace.href, 'iniciarSesion.html');

    const tLista = crearContexto({
      store: new Map([['token', token]]),
      fetch: async () => respuestaFail(401),
    });
    await tLista.ctxTest.inicializarListaMensajes();
    assert.ok(tLista.nodos.estadoListaMensajes.textContent.startsWith('Tu sesión expiró.'));
    assert.equal(
      buscarPorTexto(tLista.nodos.estadoListaMensajes, 'Iniciá sesión de nuevo').href,
      'iniciarSesion.html'
    );
  });

  await testAsync('los cuatro wrappers de contactos sin token no hacen fetch y reportan sesionExpirada', async () => {
    const t = crearContexto({ store: new Map() });

    assert.deepEqual(plano(await t.ctxTest.cargarContactos()), {
      ok: false,
      sesionExpirada: true,
      contactos: [],
    });
    assert.deepEqual(
      plano(await t.ctxTest.agregarContacto({ nombre: 'Ana', telefono: '123' })),
      { ok: false, sesionExpirada: true }
    );
    assert.deepEqual(
      plano(
        await t.ctxTest.actualizarContacto({
          nombre: 'Ana',
          mensajes: true,
          visibilidad: true,
        })
      ),
      { ok: false, sesionExpirada: true }
    );
    assert.deepEqual(plano(await t.ctxTest.eliminarContacto('Ana')), {
      ok: false,
      sesionExpirada: true,
    });

    assert.equal(t.fetchLog.length, 0, 'sin token no se envía Bearer null');
    assert.ok(t.consola.errores.length >= 4, 'cada intento queda logueado');
    assert.ok(t.consola.errores.every((mensaje) => mensaje.includes('[mensajes]')));
    assert.ok(t.consola.errores.every((mensaje) => !mensaje.includes('Bearer null')));
  });

  await testAsync('un 401 al cargar contactos reporta sesionExpirada y muestra el mensaje de sesión', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      store: new Map([['token', token]]),
      fetch: async () => respuestaFail(401),
    });

    const resultado = await t.ctxTest.cargarContactos();
    assert.deepEqual(plano(resultado), {
      ok: false,
      sesionExpirada: true,
      contactos: [],
    });

    await t.ctxTest.inicializarContactos();
    assert.ok(t.nodos.estadoContactos.textContent.startsWith('Tu sesión expiró.'));
    const enlace = buscarPorTexto(t.nodos.estadoContactos, 'Iniciá sesión de nuevo');
    assert.ok(enlace, 'el estado de contactos incluye el enlace');
    assert.equal(enlace.href, 'iniciarSesion.html');
    assert.equal(t.nodos.listaContactos.hijos.length, 0);
  });

  await testAsync('Enviar prueba hace POST /api/message-events con {tipo:"prueba"} y muestra el total', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      dataset: { tipo: 'prueba' },
      store: new Map([['token', token]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.endsWith('/api/message-templates') && metodo === 'GET') {
          return respuestaOk({ mensajes: {} });
        }
        if (url.includes('/api/contacts') && metodo === 'GET') {
          return respuestaOk({ contactos: [] });
        }
        if (url.endsWith('/api/message-events') && metodo === 'POST') {
          return respuestaOk({
            total: 4,
            enviados: [
              { telefono: '1', ok: true },
              { telefono: '2', ok: true },
              { telefono: '3', ok: true },
              { telefono: '4', ok: true },
            ],
            driver: 'whatsapp',
          });
        }
        throw new Error(`URL inesperada: ${url} ${metodo}`);
      },
    });

    await t.ctxTest.inicializarEditorMensaje('prueba');
    await t.nodos.botonEnviarPrueba.disparar('click');

    const post = t.fetchLog.find(
      (llamada) => llamada.url === 'http://back.test/api/message-events'
    );
    assert.ok(post, 'se hizo POST de prueba');
    assert.equal(post.init.method, 'POST');
    assert.equal(post.init.headers.Authorization, `Bearer ${token}`);
    assert.equal(post.init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(post.init.body), { tipo: 'prueba' });
    assert.equal(t.nodos.estadoMensaje.textContent, 'Mensaje de prueba enviado a 4 contactos.');
    assert.ok(t.nodos.estadoMensaje.classList.contains('mensajes-estado-ok'));
    assert.equal(t.nodos.botonEnviarPrueba.disabled, false, 'el botón vuelve a habilitarse');
  });

  await testAsync('Enviar prueba con total 0 avisa que no hay contactos receptores', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      dataset: { tipo: 'prueba' },
      store: new Map([['token', token]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.endsWith('/api/message-templates') && metodo === 'GET') {
          return respuestaOk({ mensajes: {} });
        }
        if (url.includes('/api/contacts') && metodo === 'GET') {
          return respuestaOk({ contactos: [] });
        }
        if (url.endsWith('/api/message-events') && metodo === 'POST') {
          return respuestaOk({ total: 0, enviados: [] });
        }
        throw new Error(`URL inesperada: ${url} ${metodo}`);
      },
    });

    await t.ctxTest.inicializarEditorMensaje('prueba');
    await t.nodos.botonEnviarPrueba.disparar('click');

    assert.equal(
      t.nodos.estadoMensaje.textContent,
      'No tenés contactos que reciban el mensaje de prueba.'
    );
    assert.ok(t.nodos.estadoMensaje.classList.contains('mensajes-estado-aviso'));
  });

  await testAsync('un 401 al enviar la prueba muestra la sesión expirada y no escribe nada local', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      dataset: { tipo: 'prueba' },
      store,
      fetch: async () => respuestaFail(401),
    });
    const clavesAntes = [...store.keys()].sort();

    const resultado = await t.ctxTest.enviarMensajeDePrueba();

    assert.deepEqual(plano(resultado), { ok: false, sesionExpirada: true });
    assert.ok(t.nodos.estadoMensaje.textContent.startsWith('Tu sesión expiró.'));
    const enlace = buscarPorTexto(t.nodos.estadoMensaje, 'Iniciá sesión de nuevo');
    assert.ok(enlace, 'el estado incluye el enlace de login');
    assert.equal(enlace.href, 'iniciarSesion.html');
    assert.deepEqual([...store.keys()].sort(), clavesAntes, 'no se escribe nada local');

    assert.equal(t.fetchLog.length, 1, 'un solo POST');
    assert.equal(t.fetchLog[0].url, 'http://back.test/api/message-events');
    assert.equal(t.fetchLog[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(t.fetchLog[0].init.body), { tipo: 'prueba' });
    assert.ok(
      t.consola.errores.some((mensaje) => mensaje.includes('[mensajes]') && mensaje.includes('message-events')),
      'el fallo se loguea con el prefijo [mensajes]'
    );
  });

  await testAsync('el botón de prueba queda deshabilitado mientras el request está en vuelo', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    let liberar;
    const espera = new Promise((resolver) => {
      liberar = resolver;
    });
    const t = crearContexto({
      store: new Map([['token', token]]),
      fetch: async () => {
        await espera;
        return respuestaOk({
          total: 2,
          enviados: [
            { telefono: '1', ok: true },
            { telefono: '2', ok: true },
          ],
        });
      },
    });

    const promesa = t.ctxTest.enviarMensajeDePrueba();
    assert.equal(t.nodos.botonEnviarPrueba.disabled, true, 'deshabilitado durante el envío');

    liberar();
    const resultado = await promesa;

    assert.deepEqual(plano(resultado), { ok: true, total: 2 });
    assert.equal(t.nodos.botonEnviarPrueba.disabled, false, 'rehabilitado al terminar');
    assert.equal(t.nodos.estadoMensaje.textContent, 'Mensaje de prueba enviado a 2 contactos.');
  });

  await testAsync('Enviar prueba con resultados mixtos muestra "X de N" y el primer error', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      dataset: { tipo: 'prueba' },
      store: new Map([['token', token]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.endsWith('/api/message-templates') && metodo === 'GET') {
          return respuestaOk({ mensajes: {} });
        }
        if (url.includes('/api/contacts') && metodo === 'GET') {
          return respuestaOk({ contactos: [] });
        }
        if (url.endsWith('/api/message-events') && metodo === 'POST') {
          return respuestaOk({
            total: 4,
            enviados: [
              { telefono: '1', ok: true },
              { telefono: '2', ok: false, error: 'HTTP 400' },
              { telefono: '3', ok: true },
              { telefono: '4', ok: false, error: 'HTTP 500' },
            ],
            driver: 'whatsapp',
          });
        }
        throw new Error(`URL inesperada: ${url} ${metodo}`);
      },
    });

    await t.ctxTest.inicializarEditorMensaje('prueba');
    const resultado = await t.ctxTest.enviarMensajeDePrueba();

    assert.deepEqual(plano(resultado), { ok: true, total: 2 });
    assert.equal(
      t.nodos.estadoMensaje.textContent,
      'Mensaje enviado a 2 de 4. Falló en 2: HTTP 400'
    );
    assert.ok(t.nodos.estadoMensaje.classList.contains('mensajes-estado-aviso'));
    assert.equal(t.nodos.botonEnviarPrueba.disabled, false, 'rehabilitado al terminar');
  });

  await testAsync('Enviar prueba con todos los envíos fallidos muestra el error', async () => {
    const token = crearToken({ email: 'ana@test.com' });
    const t = crearContexto({
      dataset: { tipo: 'prueba' },
      store: new Map([['token', token]]),
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.endsWith('/api/message-templates') && metodo === 'GET') {
          return respuestaOk({ mensajes: {} });
        }
        if (url.includes('/api/contacts') && metodo === 'GET') {
          return respuestaOk({ contactos: [] });
        }
        if (url.endsWith('/api/message-events') && metodo === 'POST') {
          return respuestaOk({
            total: 2,
            enviados: [
              { telefono: '1', ok: false, error: 'HTTP 400' },
              { telefono: '2', ok: false, error: 'HTTP 500' },
            ],
            driver: 'whatsapp',
          });
        }
        throw new Error(`URL inesperada: ${url} ${metodo}`);
      },
    });

    await t.ctxTest.inicializarEditorMensaje('prueba');
    const resultado = await t.ctxTest.enviarMensajeDePrueba();

    assert.deepEqual(plano(resultado), { ok: false, total: 0 });
    assert.equal(
      t.nodos.estadoMensaje.textContent,
      'No se pudo enviar el mensaje de prueba: HTTP 400'
    );
    assert.ok(t.nodos.estadoMensaje.classList.contains('mensajes-estado-error'));
  });

  await testAsync('el preview interpola contacto, usuario, actividad y hora reales y guarda solo el mensaje personal', async () => {
    const token = crearToken({ email: 'ana@test.com', name: 'Ana' });
    const store = new Map([
      ['token', token],
      [
        'beepsafe_ultima_sesion:ana@test.com',
        JSON.stringify({ actividad: 'Kayak', tiempoSegundos: 3600 }),
      ],
    ]);
    const contactos = [
      {
        nombre: 'Beto',
        telefono: '1',
        mensajes: true,
        mensajesPorTipo: { inicio: false, fin: false, alarma: false, prueba: false },
        visibilidad: true,
      },
      {
        nombre: 'Carla',
        telefono: '2',
        mensajes: true,
        mensajesPorTipo: { inicio: true, fin: false, alarma: false, prueba: false },
        visibilidad: true,
      },
    ];
    const t = crearContexto({
      dataset: { tipo: 'inicio' },
      store,
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.endsWith('/api/message-templates') && metodo === 'GET') {
          return respuestaOk({ mensajes: { inicio: 'Llevo casco', fin: '', alarma: '', prueba: '' } });
        }
        if (url.endsWith('/api/message-templates') && metodo === 'PUT') return respuestaOk({});
        if (url.includes('/api/contacts') && metodo === 'GET') return respuestaOk({ contactos });
        throw new Error(`URL inesperada: ${url} ${metodo}`);
      },
    });

    const epochFijo = Date.UTC(2026, 4, 18, 20, 30);
    conFechaFija(t.ctx, epochFijo);
    await t.ctxTest.inicializarEditorMensaje('inicio');

    assert.equal(
      t.nodos.mensajeFijoAntes.textContent,
      'Aviso de BeepSafe para Carla: Ana comenzó una sesión de Kayak.',
      'usa el primer contacto asignado al tipo y el nombre real del JWT'
    );
    const horaEsperada = horaFormateada(epochFijo + 3600 * 1000);
    assert.equal(horaEsperada, 'lun 18:30', 'la hora calculada del ejemplo es lun 18:30');
    assert.equal(
      t.nodos.mensajeFijoDespues.textContent,
      `Tiene previsto finalizarla el ${horaEsperada}. - Enviado desde BeepSafe.`,
      'la hora calculada usa el mismo formato que el fallback'
    );
    assert.ok(
      !t.nodos.mensajeFijoDespues.textContent.includes('hs'),
      'la hora calculada no lleva el sufijo "hs"'
    );
    assert.equal(t.nodos.mensaje.value, 'Llevo casco', 'el textarea solo muestra el mensaje personal');
    assert.equal(t.nodos.contadorMensaje.textContent, '11/1000');

    await t.nodos.botonGrabar.disparar('click');
    const put = t.fetchLog.find((llamada) => llamada.init && llamada.init.method === 'PUT');
    assert.ok(put, 'se guarda el mensaje personal');
    assert.deepEqual(JSON.parse(put.init.body), { mensajes: { inicio: 'Llevo casco' } });
  });

  await testAsync('el preview cae a María/Marcelo/windsurf y al día de hoy 19:00, y la hora solo aparece en inicio', async () => {
    const horaFallback = `${diaAbreviado(new Date())} 19:00`;
    const inicio = crearContexto({ dataset: { tipo: 'inicio' } });
    inicio.ctxTest.renderizarPreview('inicio');
    assert.equal(
      inicio.nodos.mensajeFijoAntes.textContent,
      'Aviso de BeepSafe para María: Marcelo comenzó una sesión de windsurf.'
    );
    assert.equal(
      inicio.nodos.mensajeFijoDespues.textContent,
      `Tiene previsto finalizarla el ${horaFallback}. - Enviado desde BeepSafe.`,
      'el fallback usa la abreviatura del día de hoy + HH:mm'
    );
    assert.ok(
      !inicio.nodos.mensajeFijoDespues.textContent.includes('hs'),
      'el fallback tampoco lleva el sufijo "hs"'
    );

    const fin = crearContexto({ dataset: { tipo: 'fin' } });
    fin.ctxTest.renderizarPreview('fin');
    assert.equal(
      fin.nodos.mensajeFijoAntes.textContent,
      'Aviso de BeepSafe para María: Marcelo finalizó su sesión de windsurf.'
    );
    assert.equal(fin.nodos.mensajeFijoDespues.textContent, '- Enviado desde BeepSafe.');
    assert.ok(!fin.nodos.mensajeFijoDespues.textContent.includes('Tiene previsto'));

    const alarma = crearContexto({ dataset: { tipo: 'alarma' } });
    alarma.ctxTest.renderizarPreview('alarma');
    assert.equal(
      alarma.nodos.mensajeFijoAntes.textContent,
      'Aviso de BeepSafe para María: Marcelo no detuvo su sesión de windsurf en el tiempo previsto.'
    );
    assert.equal(alarma.nodos.mensajeFijoDespues.textContent, '- Enviado desde BeepSafe.');

    const roto = crearContexto({
      dataset: { tipo: 'alarma' },
      store: new Map([['beepsafe_ultima_sesion', 'no-es-json']]),
    });
    roto.ctxTest.renderizarPreview('alarma');
    assert.ok(roto.nodos.mensajeFijoAntes.textContent.includes('windsurf'));
    assert.ok(
      roto.consola.errores.some(
        (mensaje) => mensaje.includes('[mensajes]') && mensaje.includes('última sesión')
      ),
      'una sesión ilegible se loguea y cae al fallback'
    );
  });

  await testAsync('el preview se refresca cuando cambia la sesión guardada', async () => {
    const token = crearToken({ email: 'ana@test.com', name: 'Ana' });
    const store = new Map([['token', token]]);
    const t = crearContexto({
      dataset: { tipo: 'fin' },
      store,
      fetch: async (url, init) => {
        const metodo = (init && init.method) || 'GET';
        if (url.endsWith('/api/message-templates') && metodo === 'GET') {
          return respuestaOk({ mensajes: {} });
        }
        if (url.includes('/api/contacts') && metodo === 'GET') {
          return respuestaOk({ contactos: [] });
        }
        throw new Error(`URL inesperada: ${url} ${metodo}`);
      },
    });

    await t.ctxTest.inicializarEditorMensaje('fin');
    assert.equal(
      t.nodos.mensajeFijoAntes.textContent,
      'Aviso de BeepSafe para María: Ana finalizó su sesión de windsurf.'
    );

    store.set(
      'beepsafe_ultima_sesion:ana@test.com',
      JSON.stringify({ actividad: 'Escalada', tiempoSegundos: 600 })
    );
    const oyentes = t.ctx.window.listeners.storage || [];
    assert.equal(oyentes.length, 1, 'se registra un único oyente de storage');
    oyentes[0]({ key: 'beepsafe_ultima_sesion:ana@test.com' });

    assert.equal(
      t.nodos.mensajeFijoAntes.textContent,
      'Aviso de BeepSafe para María: Ana finalizó su sesión de Escalada.'
    );
  });
}

testsAsync().finally(() => {
  console.log(`\n${pasados}/${total} tests OK`);
  if (pasados !== total) process.exitCode = 1;
});
