const TIPOS_MENSAJE = ['inicio', 'fin', 'alarma', 'prueba'];

const CLAVE_MENSAJES = 'beepsafe_mensajes';

const MENSAJES_POR_DEFECTO = {
  inicio: '',
  fin: '',
  alarma: '',
  prueba: '',
};

const TIMEOUT_PETICION_MS = 8000;

const LARGO_MAXIMO_MENSAJE = 1000;

const LARGO_PREVIEW = 70;

const MAX_CONTACTOS_POR_TIPO = 5;

const TEXTO_LIMITE_CONTACTOS = 'Llegaste al máximo de 5 contactos para este mensaje.';

function mensajeDeError(err) {
  if (!err) return 'error desconocido';
  if (err.name === 'AbortError') return 'timeout (abort)';
  if (err.name && err.message) return `${err.name}: ${err.message}`;
  if (err.message) return err.message;
  return String(err);
}

function leerToken() {
  try {
    return localStorage.getItem('token');
  } catch (err) {
    console.error(`[mensajes] localStorage ilegible al leer el token: ${mensajeDeError(err)}`);
    return null;
  }
}

function emailDesdeToken() {
  const token = leerToken();
  if (!token || typeof token !== 'string') return '';
  const partes = token.split('.');
  if (partes.length < 2 || !partes[1]) return '';
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = (4 - (base64.length % 4)) % 4;
    const payload = JSON.parse(atob(base64.padEnd(base64.length + relleno, '=')));
    if (payload && typeof payload.email === 'string' && payload.email.trim()) {
      return payload.email.trim();
    }
  } catch (err) {
    console.error(`[mensajes] no se pudo decodificar el JWT: ${mensajeDeError(err)}`);
  }
  return '';
}

function claveConUsuario(base) {
  const email = emailDesdeToken();
  return email ? `${base}:${email}` : base;
}

function normalizarMensajes(origen) {
  const datos =
    origen && typeof origen === 'object' && origen.mensajes && typeof origen.mensajes === 'object'
      ? origen.mensajes
      : origen && typeof origen === 'object'
        ? origen
        : {};
  const mensajes = {};
  for (const tipo of TIPOS_MENSAJE) {
    mensajes[tipo] = typeof datos[tipo] === 'string' ? datos[tipo] : '';
  }
  return mensajes;
}

function normalizarPendientes(origen) {
  const datos =
    origen && typeof origen === 'object' && origen.pendientes && typeof origen.pendientes === 'object'
      ? origen.pendientes
      : {};
  const pendientes = {};
  for (const tipo of TIPOS_MENSAJE) {
    if (datos[tipo] === true) pendientes[tipo] = true;
  }
  return pendientes;
}

function tiposPendientes(pendientes) {
  return TIPOS_MENSAJE.filter((tipo) => pendientes && pendientes[tipo] === true);
}

function leerEspejoLocal() {
  const clave = claveConUsuario(CLAVE_MENSAJES);
  let crudo;
  try {
    crudo = localStorage.getItem(clave);
  } catch (err) {
    console.error(`[mensajes] localStorage ilegible en ${clave}: ${mensajeDeError(err)}`);
    return null;
  }
  if (!crudo) return null;
  try {
    const parsed = JSON.parse(crudo);
    if (!parsed || typeof parsed !== 'object') {
      console.error(`[mensajes] copia local inválida en ${clave}: no es un objeto JSON`);
      return null;
    }
    const tieneMensajes = parsed.mensajes && typeof parsed.mensajes === 'object';
    return {
      mensajes: normalizarMensajes(tieneMensajes ? parsed.mensajes : parsed),
      pendientes: normalizarPendientes(parsed),
    };
  } catch (err) {
    console.error(`[mensajes] copia local ilegible en ${clave}: ${mensajeDeError(err)}`);
    return null;
  }
}

function escribirEspejoLocal(mensajes, pendientes) {
  const clave = claveConUsuario(CLAVE_MENSAJES);
  try {
    localStorage.setItem(
      clave,
      JSON.stringify({
        mensajes: normalizarMensajes(mensajes),
        pendientes: normalizarPendientes({ pendientes }),
      })
    );
  } catch (err) {
    console.error(`[mensajes] no se pudo escribir ${clave}: ${mensajeDeError(err)}`);
  }
}

function hayToken() {
  const token = leerToken();
  return typeof token === 'string' && token.trim() !== '';
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${leerToken()}`,
  };
}

function fetchConTimeout(url, init = {}) {
  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIMEOUT_PETICION_MS);
  return fetch(url, { ...init, signal: controlador.signal }).finally(() => {
    clearTimeout(reloj);
  });
}

function estadoLocal(sesionExpirada) {
  const espejo = leerEspejoLocal();
  const pendientes = espejo ? espejo.pendientes : {};
  return {
    ok: sesionExpirada !== true,
    sesionExpirada: sesionExpirada === true,
    mensajes: espejo ? espejo.mensajes : normalizarMensajes(MENSAJES_POR_DEFECTO),
    pendientes: tiposPendientes(pendientes),
    degradado: true,
  };
}

function esSesionExpirada(respuesta) {
  return respuesta.status === 401 || respuesta.status === 403;
}

async function reenviarMensaje(tipo, texto) {
  const url = `${ROOT_URL}/api/message-templates`;
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mensajes: { [tipo]: texto } }),
    });
    if (!respuesta.ok) {
      console.error(
        `[mensajes] replay PUT message-templates falló: ${url} status=${respuesta.status} tipo=${tipo}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `[mensajes] replay PUT message-templates falló: ${url} tipo=${tipo} — ${mensajeDeError(err)}`
    );
    return false;
  }
}

async function cargarMensajes() {
  const url = `${ROOT_URL}/api/message-templates`;
  if (!hayToken()) {
    console.error(`[mensajes] GET message-templates sin token: ${url}`);
    return estadoLocal(true);
  }
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'GET',
      headers: authHeaders(),
    });
    if (esSesionExpirada(respuesta)) {
      console.error(`[mensajes] GET message-templates sesión expirada: ${url} status=${respuesta.status}`);
      return estadoLocal(true);
    }
    if (!respuesta.ok) {
      console.error(`[mensajes] GET message-templates falló: ${url} status=${respuesta.status}`);
      return estadoLocal(false);
    }
    let datos;
    try {
      datos = await respuesta.json();
    } catch (err) {
      console.error(`[mensajes] message-templates devolvió JSON ilegible: ${url} — ${mensajeDeError(err)}`);
      return estadoLocal(false);
    }
    const espejo = leerEspejoLocal();
    const locales = espejo ? espejo.mensajes : normalizarMensajes(MENSAJES_POR_DEFECTO);
    const pendientes = espejo ? { ...espejo.pendientes } : {};
    const mensajes = normalizarMensajes(datos);
    for (const tipo of TIPOS_MENSAJE) {
      if (pendientes[tipo]) mensajes[tipo] = locales[tipo];
    }
    for (const tipo of TIPOS_MENSAJE) {
      if (!pendientes[tipo]) continue;
      const reenviado = await reenviarMensaje(tipo, mensajes[tipo]);
      if (reenviado) delete pendientes[tipo];
    }
    escribirEspejoLocal(mensajes, pendientes);
    const restantes = tiposPendientes(pendientes);
    return {
      ok: true,
      sesionExpirada: false,
      mensajes,
      pendientes: restantes,
      degradado: restantes.length > 0,
    };
  } catch (err) {
    console.error(`[mensajes] GET message-templates falló: ${url} — ${mensajeDeError(err)}`);
    return estadoLocal(false);
  }
}

function guardarMensajeLocal(tipo, texto, pendiente) {
  const espejo = leerEspejoLocal();
  const mensajes = espejo ? espejo.mensajes : normalizarMensajes(MENSAJES_POR_DEFECTO);
  const pendientes = espejo ? { ...espejo.pendientes } : {};
  mensajes[tipo] = texto;
  if (pendiente) pendientes[tipo] = true;
  else delete pendientes[tipo];
  escribirEspejoLocal(mensajes, pendientes);
}

async function guardarMensaje(tipo, texto) {
  if (!TIPOS_MENSAJE.includes(tipo)) {
    console.error(`[mensajes] tipo de mensaje inválido: ${tipo}`);
    return { ok: false, degradado: true };
  }
  const limpio = typeof texto === 'string' ? texto : String(texto ?? '');
  const url = `${ROOT_URL}/api/message-templates`;
  if (!hayToken()) {
    console.error(`[mensajes] PUT message-templates sin token: ${url}`);
    return { ok: false, sesionExpirada: true };
  }
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mensajes: { [tipo]: limpio } }),
    });
    if (esSesionExpirada(respuesta)) {
      console.error(`[mensajes] PUT message-templates sesión expirada: ${url} status=${respuesta.status}`);
      return { ok: false, sesionExpirada: true };
    }
    if (!respuesta.ok) {
      console.error(`[mensajes] PUT message-templates falló: ${url} status=${respuesta.status}`);
      guardarMensajeLocal(tipo, limpio, true);
      return { ok: false, degradado: true };
    }
    guardarMensajeLocal(tipo, limpio, false);
    return { ok: true };
  } catch (err) {
    console.error(`[mensajes] PUT message-templates falló: ${url} — ${mensajeDeError(err)}`);
    guardarMensajeLocal(tipo, limpio, true);
    return { ok: false, degradado: true };
  }
}

function normalizarContactoCargado(contacto) {
  const origen = contacto && typeof contacto === 'object' ? contacto : {};
  return {
    nombre: typeof origen.nombre === 'string' ? origen.nombre : String(origen.nombre ?? ''),
    telefono: typeof origen.telefono === 'string' ? origen.telefono : String(origen.telefono ?? ''),
    mensajes: origen.mensajes === true,
    mensajesPorTipo: normalizarMensajesPorTipo(origen),
    visibilidad: origen.visibilidad === true,
  };
}

async function cargarContactos() {
  const url = `${ROOT_URL}/api/contacts`;
  if (!hayToken()) {
    console.error(`[mensajes] GET contacts sin token: ${url}`);
    return { ok: false, sesionExpirada: true, contactos: [] };
  }
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'GET',
      headers: authHeaders(),
    });
    if (esSesionExpirada(respuesta)) {
      console.error(`[mensajes] GET contacts sesión expirada: ${url} status=${respuesta.status}`);
      return { ok: false, sesionExpirada: true, contactos: [] };
    }
    if (!respuesta.ok) {
      console.error(`[mensajes] GET contacts falló: ${url} status=${respuesta.status}`);
      return { ok: false, contactos: [], error: `status ${respuesta.status}` };
    }
    let datos;
    try {
      datos = await respuesta.json();
    } catch (err) {
      console.error(`[mensajes] contacts devolvió JSON ilegible: ${url} — ${mensajeDeError(err)}`);
      return { ok: false, contactos: [], error: 'respuesta ilegible' };
    }
    const lista = datos && Array.isArray(datos.contactos) ? datos.contactos : [];
    const contactos = lista
      .filter((contacto) => contacto && typeof contacto === 'object' && typeof contacto.nombre === 'string')
      .map(normalizarContactoCargado);
    return { ok: true, contactos };
  } catch (err) {
    console.error(`[mensajes] GET contacts falló: ${url} — ${mensajeDeError(err)}`);
    return { ok: false, contactos: [], error: mensajeDeError(err) };
  }
}

async function agregarContacto(contacto) {
  const origen = contacto && typeof contacto === 'object' ? contacto : {};
  const tipo = tipoValido(origen.tipo) || tipoValido(tipoDesdePagina());
  const cuerpo = {
    nombre: String(origen.nombre ?? ''),
    telefono: String(origen.telefono ?? ''),
    visibilidad: origen.visibilidad !== false,
  };
  if (tipo) cuerpo.mensajesPorTipo = { [tipo]: origen.mensajes !== false };
  else cuerpo.mensajes = origen.mensajes !== false;
  const url = `${ROOT_URL}/api/contacts`;
  if (!hayToken()) {
    console.error(`[mensajes] POST contacts sin token: ${url}`);
    return { ok: false, sesionExpirada: true };
  }
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(cuerpo),
    });
    if (esSesionExpirada(respuesta)) {
      console.error(`[mensajes] POST contacts sesión expirada: ${url} status=${respuesta.status}`);
      return { ok: false, sesionExpirada: true };
    }
    if (!respuesta.ok) {
      const error = await leerErrorRespuesta(respuesta, '');
      console.error(`[mensajes] POST contacts falló: ${url} status=${respuesta.status} — ${error}`);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[mensajes] POST contacts falló: ${url} — ${mensajeDeError(err)}`);
    return { ok: false, error: mensajeDeError(err) };
  }
}

async function actualizarContacto(contacto) {
  const origen = contacto && typeof contacto === 'object' ? contacto : {};
  const tipo = tipoValido(origen.tipo) || tipoValido(tipoDesdePagina());
  const cuerpo = {
    nombre: String(origen.nombre ?? ''),
    visibilidad: origen.visibilidad === true,
  };
  if (tipo) cuerpo.mensajesPorTipo = { [tipo]: origen.mensajes === true };
  else cuerpo.mensajes = origen.mensajes === true;
  const url = `${ROOT_URL}/api/contacts`;
  if (!hayToken()) {
    console.error(`[mensajes] PUT contacts sin token: ${url}`);
    return { ok: false, sesionExpirada: true };
  }
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(cuerpo),
    });
    if (esSesionExpirada(respuesta)) {
      console.error(`[mensajes] PUT contacts sesión expirada: ${url} status=${respuesta.status}`);
      return { ok: false, sesionExpirada: true };
    }
    if (!respuesta.ok) {
      const error = await leerErrorRespuesta(respuesta, '');
      console.error(`[mensajes] PUT contacts falló: ${url} status=${respuesta.status} — ${error}`);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[mensajes] PUT contacts falló: ${url} — ${mensajeDeError(err)}`);
    return { ok: false, error: mensajeDeError(err) };
  }
}

async function eliminarContacto(nombre) {
  const url = `${ROOT_URL}/api/contacts?nombre=${encodeURIComponent(String(nombre ?? ''))}`;
  if (!hayToken()) {
    console.error(`[mensajes] DELETE contacts sin token: ${url}`);
    return { ok: false, sesionExpirada: true };
  }
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (esSesionExpirada(respuesta)) {
      console.error(`[mensajes] DELETE contacts sesión expirada: ${url} status=${respuesta.status}`);
      return { ok: false, sesionExpirada: true };
    }
    if (!respuesta.ok) {
      console.error(`[mensajes] DELETE contacts falló: ${url} status=${respuesta.status}`);
      return { ok: false, error: `status ${respuesta.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[mensajes] DELETE contacts falló: ${url} — ${mensajeDeError(err)}`);
    return { ok: false, error: mensajeDeError(err) };
  }
}

function resumirMensaje(texto, maximo = LARGO_PREVIEW) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return 'Sin mensaje';
  if (limpio.length <= maximo) return limpio;
  return `${limpio.slice(0, maximo).trimEnd()}…`;
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function marcarEstado(nodo, texto, variante) {
  if (!nodo) return;
  nodo.textContent = texto;
  nodo.classList.remove('mensajes-estado-ok', 'mensajes-estado-aviso', 'mensajes-estado-error');
  if (variante === 'ok') nodo.classList.add('mensajes-estado-ok');
  else if (variante === 'aviso') nodo.classList.add('mensajes-estado-aviso');
  else if (variante === 'error') nodo.classList.add('mensajes-estado-error');
}

function marcarSesionExpirada(nodo) {
  if (!nodo) return;
  nodo.innerHTML = '';
  nodo.classList.remove('mensajes-estado-ok', 'mensajes-estado-aviso', 'mensajes-estado-error');
  nodo.classList.add('mensajes-estado-error');
  nodo.textContent = 'Tu sesión expiró. ';
  const enlace = document.createElement('a');
  enlace.className = 'mensajes-enlace-sesion';
  enlace.href = 'iniciarSesion.html';
  enlace.textContent = 'Iniciá sesión de nuevo';
  nodo.appendChild(enlace);
}

function actualizarContador(textarea, contador) {
  if (!textarea || !contador) return;
  const largo = typeof textarea.value === 'string' ? textarea.value.length : 0;
  contador.textContent = `${largo}/${LARGO_MAXIMO_MENSAJE}`;
}

function tipoDesdePagina() {
  const cuerpo = document.body;
  if (!cuerpo || !cuerpo.dataset) return '';
  return typeof cuerpo.dataset.tipo === 'string' ? cuerpo.dataset.tipo : '';
}

function tipoValido(valor) {
  return TIPOS_MENSAJE.includes(valor) ? valor : '';
}

function normalizarMensajesPorTipo(origen) {
  const datos = origen && typeof origen === 'object' ? origen : {};
  const fuente =
    datos.mensajesPorTipo && typeof datos.mensajesPorTipo === 'object' ? datos.mensajesPorTipo : null;
  const porTipo = {};
  for (const tipo of TIPOS_MENSAJE) {
    porTipo[tipo] = fuente ? fuente[tipo] === true : datos.mensajes === true;
  }
  return porTipo;
}

function contactoAsignadoAlTipo(contacto, tipo) {
  const porTipo = contacto && contacto.mensajesPorTipo;
  if (tipoValido(tipo)) {
    return !!(porTipo && porTipo[tipo] === true);
  }
  return !!(contacto && contacto.mensajes === true);
}

function contactosAsignados(contactos, tipo) {
  const lista = Array.isArray(contactos) ? contactos : [];
  return lista.filter((contacto) => contactoAsignadoAlTipo(contacto, tipo));
}

async function leerErrorRespuesta(respuesta, respaldo) {
  try {
    const datos = await respuesta.json();
    if (datos && typeof datos.error === 'string' && datos.error.trim()) {
      return datos.error.trim();
    }
  } catch (err) {
    console.error(`[mensajes] no se pudo leer el error de la respuesta: ${mensajeDeError(err)}`);
  }
  return respaldo;
}

async function guardarDesdeEditor(tipo, textarea, boton, estado) {
  const texto = typeof textarea.value === 'string' ? textarea.value : '';
  if (!texto.trim()) {
    marcarEstado(estado, 'Escribí un mensaje antes de grabar.', 'aviso');
    return;
  }
  if (texto.length > LARGO_MAXIMO_MENSAJE) {
    marcarEstado(estado, `El mensaje no puede superar los ${LARGO_MAXIMO_MENSAJE} caracteres.`, 'error');
    return;
  }
  boton.disabled = true;
  marcarEstado(estado, 'Guardando...', '');
  const resultado = await guardarMensaje(tipo, texto);
  boton.disabled = false;
  if (resultado.ok) {
    marcarEstado(estado, 'Mensaje guardado', 'ok');
  } else if (resultado.sesionExpirada) {
    marcarSesionExpirada(estado);
  } else {
    marcarEstado(estado, 'Guardado en este dispositivo, pendiente de sincronizar', 'aviso');
  }
}

function crearCheck(texto, marcado) {
  const label = document.createElement('label');
  label.className = 'mensajes-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = marcado === true;
  label.appendChild(input);
  const span = document.createElement('span');
  span.textContent = texto;
  label.appendChild(span);
  return { label, input };
}

function abrirEdicionContacto(fila, contacto) {
  fila.innerHTML = '';
  const tipo = tipoDesdePagina();
  const editor = document.createElement('div');
  editor.className = 'mensajes-edicion';

  const titulo = document.createElement('div');
  titulo.className = 'mensajes-contacto-nombre';
  titulo.textContent = contacto.nombre;
  editor.appendChild(titulo);

  const telefono = document.createElement('div');
  telefono.className = 'mensajes-contacto-telefono';
  telefono.textContent = contacto.telefono || 'Sin teléfono';
  editor.appendChild(telefono);

  const checkMensajes = crearCheck('Recibe mis mensajes', contactoAsignadoAlTipo(contacto, tipo));
  const checkVisibilidad = crearCheck('Quiero que me vea', contacto.visibilidad);
  editor.appendChild(checkMensajes.label);

  const ayudaMensajes = document.createElement('p');
  ayudaMensajes.className = 'msj-ayuda msj-edicion-ayuda';
  ayudaMensajes.textContent = 'Si lo desactivás, dejará de aparecer en esta lista.';
  editor.appendChild(ayudaMensajes);

  editor.appendChild(checkVisibilidad.label);

  const acciones = document.createElement('div');
  acciones.className = 'mensajes-edicion-acciones';

  const guardar = document.createElement('button');
  guardar.type = 'button';
  guardar.className = 'mensajes-boton-mini';
  guardar.textContent = 'Guardar';
  guardar.addEventListener('click', async () => {
    guardar.disabled = true;
    const resultado = await actualizarContacto({
      nombre: contacto.nombre,
      mensajes: checkMensajes.input.checked,
      visibilidad: checkVisibilidad.input.checked,
      tipo,
    });
    guardar.disabled = false;
    const estado = document.getElementById('estadoContactos');
    if (!resultado.ok) {
      if (resultado.sesionExpirada) {
        marcarSesionExpirada(estado);
        return;
      }
      marcarEstado(estado, resultado.error || 'No se pudo actualizar el contacto.', 'error');
      return;
    }
    await refrescarContactos('Contacto actualizado.');
  });
  acciones.appendChild(guardar);

  const cancelar = document.createElement('button');
  cancelar.type = 'button';
  cancelar.className = 'mensajes-boton-mini';
  cancelar.textContent = 'Cancelar';
  cancelar.addEventListener('click', () => {
    refrescarContactos();
  });
  acciones.appendChild(cancelar);

  editor.appendChild(acciones);
  fila.appendChild(editor);
}

function crearFilaContacto(contacto) {
  const fila = document.createElement('li');
  fila.className = 'mensajes-contacto';

  const datos = document.createElement('div');
  datos.className = 'mensajes-contacto-datos';

  const nombre = document.createElement('div');
  nombre.className = 'mensajes-contacto-nombre';
  nombre.textContent = contacto.nombre;
  datos.appendChild(nombre);

  const telefono = document.createElement('div');
  telefono.className = 'mensajes-contacto-telefono';
  telefono.textContent = contacto.telefono || 'Sin teléfono';
  datos.appendChild(telefono);

  if (contactoAsignadoAlTipo(contacto, tipoDesdePagina())) {
    const marca = document.createElement('span');
    marca.className = 'mensajes-contacto-marca';
    marca.textContent = 'Recibe mensajes';
    datos.appendChild(marca);
  }
  fila.appendChild(datos);

  const acciones = document.createElement('div');
  acciones.className = 'mensajes-contacto-acciones';

  const editar = document.createElement('button');
  editar.type = 'button';
  editar.className = 'mensajes-boton-mini';
  editar.textContent = 'Editar';
  editar.addEventListener('click', () => {
    abrirEdicionContacto(fila, contacto);
  });
  acciones.appendChild(editar);

  const eliminar = document.createElement('button');
  eliminar.type = 'button';
  eliminar.className = 'mensajes-boton-mini mensajes-boton-peligro';
  eliminar.textContent = 'Eliminar';
  eliminar.addEventListener('click', async () => {
    const confirmado =
      typeof window.confirm === 'function' ? window.confirm(`¿Eliminar a ${contacto.nombre}?`) : true;
    if (!confirmado) return;
    const estado = document.getElementById('estadoContactos');
    const resultado = await eliminarContacto(contacto.nombre);
    if (!resultado.ok) {
      if (resultado.sesionExpirada) {
        marcarSesionExpirada(estado);
        return;
      }
      marcarEstado(estado, 'No se pudo eliminar el contacto.', 'error');
      return;
    }
    await refrescarContactos('Contacto eliminado.');
  });
  acciones.appendChild(eliminar);

  fila.appendChild(acciones);
  return fila;
}

let contactosDelTipoActuales = 0;

let contactosConocidos = [];

function limiteDeContactosAlcanzado() {
  return contactosDelTipoActuales >= MAX_CONTACTOS_POR_TIPO;
}

function actualizarLimiteContactos(cantidad) {
  contactosDelTipoActuales = Number.isFinite(cantidad) ? cantidad : 0;
  const alcanzado = limiteDeContactosAlcanzado();
  const contador = document.getElementById('contadorContactos');
  if (contador) contador.textContent = `${contactosDelTipoActuales} de ${MAX_CONTACTOS_POR_TIPO}`;
  const limite = document.getElementById('mensajeLimiteContactos');
  if (limite) limite.textContent = alcanzado ? TEXTO_LIMITE_CONTACTOS : '';
  for (const id of [
    'contactoNombre',
    'contactoTelefono',
    'contactoMensajes',
    'botonAgregarContacto',
  ]) {
    const control = document.getElementById(id);
    if (control) control.disabled = alcanzado;
  }
  return alcanzado;
}

function aplicarContactos(contactos) {
  contactosConocidos = Array.isArray(contactos) ? contactos.slice() : [];
  const lista = document.getElementById('listaContactos');
  const tipo = tipoDesdePagina();
  const receptores = contactosAsignados(contactosConocidos, tipo);
  if (lista) {
    lista.innerHTML = '';
    for (const contacto of receptores) {
      lista.appendChild(crearFilaContacto(contacto));
    }
  }
  actualizarLimiteContactos(receptores.length);
  return receptores;
}

async function reconciliarContactos() {
  const resultado = await cargarContactos();
  if (resultado.sesionExpirada) return { ok: false, sesionExpirada: true };
  if (!resultado.ok) return { ok: false };
  aplicarContactos(resultado.contactos);
  return { ok: true };
}

async function refrescarContactos(mensajeExito) {
  const lista = document.getElementById('listaContactos');
  const estado = document.getElementById('estadoContactos');
  if (!lista) return false;
  marcarEstado(estado, 'Cargando contactos...', '');
  const resultado = await cargarContactos();
  if (resultado.sesionExpirada) {
    marcarSesionExpirada(estado);
    return false;
  }
  if (!resultado.ok) {
    marcarEstado(estado, 'No se pudieron cargar los contactos. Podés seguir escribiendo tu mensaje.', 'error');
    return false;
  }
  const receptores = aplicarContactos(resultado.contactos);
  if (resultado.contactos.length === 0 || receptores.length === 0) {
    if (mensajeExito) {
      marcarEstado(estado, mensajeExito, 'ok');
    } else if (resultado.contactos.length === 0) {
      marcarEstado(estado, 'Todavía no tenés contactos.', '');
    } else if (tipoValido(tipoDesdePagina())) {
      marcarEstado(estado, 'Todavía no tenés contactos para este mensaje.', '');
    } else {
      marcarEstado(estado, 'Todavía no tenés contactos que reciban mensajes.', '');
    }
    return true;
  }
  marcarEstado(estado, mensajeExito || '', mensajeExito ? 'ok' : '');
  return true;
}

async function manejarAltaContacto(evento) {
  if (evento && typeof evento.preventDefault === 'function') evento.preventDefault();
  const estado = document.getElementById('estadoContactos');
  const nombreInput = document.getElementById('contactoNombre');
  const telefonoInput = document.getElementById('contactoTelefono');
  const mensajesInput = document.getElementById('contactoMensajes');
  const boton = document.getElementById('botonAgregarContacto');
  if (limiteDeContactosAlcanzado()) {
    actualizarLimiteContactos(contactosDelTipoActuales);
    marcarEstado(estado, TEXTO_LIMITE_CONTACTOS, 'aviso');
    return;
  }
  const nombre = nombreInput ? String(nombreInput.value || '').trim() : '';
  const telefono = telefonoInput ? String(telefonoInput.value || '').trim() : '';
  if (!nombre || !telefono) {
    marcarEstado(estado, 'Completá nombre y teléfono.', 'error');
    return;
  }
  if (boton) boton.disabled = true;
  const resultado = await agregarContacto({
    nombre,
    telefono,
    mensajes: mensajesInput ? mensajesInput.checked !== false : true,
    visibilidad: true,
    tipo: tipoDesdePagina(),
  });
  if (boton) boton.disabled = false;
  if (!resultado.ok) {
    if (resultado.sesionExpirada) {
      marcarSesionExpirada(estado);
      return;
    }
    const mensaje = resultado.error || 'No se pudo agregar el contacto. Intentá de nuevo.';
    marcarEstado(estado, mensaje, 'error');
    const reconciliado = await reconciliarContactos();
    if (reconciliado.sesionExpirada) {
      marcarSesionExpirada(estado);
      return;
    }
    if (!reconciliado.ok) {
      aplicarContactos(contactosConocidos);
      marcarEstado(
        estado,
        `${mensaje} No pudimos actualizar la lista; mostrando la última información disponible.`,
        'error'
      );
    }
    return;
  }
  if (nombreInput) nombreInput.value = '';
  if (telefonoInput) telefonoInput.value = '';
  if (mensajesInput) mensajesInput.checked = true;
  const refrescado = await refrescarContactos('Contacto agregado.');
  if (refrescado) return;
  const reconciliado = await reconciliarContactos();
  if (reconciliado.sesionExpirada) {
    marcarSesionExpirada(estado);
    return;
  }
  if (reconciliado.ok) {
    marcarEstado(estado, 'Contacto agregado.', 'ok');
    return;
  }
  aplicarContactos(contactosConocidos);
  marcarEstado(
    estado,
    'Contacto agregado, pero no pudimos actualizar la lista; mostrando la última información disponible.',
    'aviso'
  );
}

async function inicializarContactos() {
  const lista = document.getElementById('listaContactos');
  const formulario = document.getElementById('formAgregarContacto');
  if (!lista || !formulario) return;
  formulario.addEventListener('submit', manejarAltaContacto);
  await refrescarContactos();
}

async function inicializarListaMensajes() {
  const resultado = await cargarMensajes();
  const pendientes = resultado.pendientes || [];
  for (const tipo of TIPOS_MENSAJE) {
    const preview = document.getElementById(`preview${capitalizar(tipo)}`);
    if (!preview) continue;
    const resumen = resumirMensaje(resultado.mensajes[tipo]);
    const pendiente = pendientes.includes(tipo);
    preview.textContent = pendiente ? `${resumen} · Pendiente de sincronizar` : resumen;
    preview.classList.remove('mensajes-previa-pendiente');
    if (pendiente) preview.classList.add('mensajes-previa-pendiente');
  }
  const estado = document.getElementById('estadoListaMensajes');
  if (!estado) return resultado;
  if (resultado.sesionExpirada) {
    marcarSesionExpirada(estado);
  } else if (pendientes.length > 0) {
    marcarEstado(
      estado,
      'Hay mensajes guardados en este dispositivo pendientes de sincronizar.',
      'aviso'
    );
  } else if (resultado.degradado) {
    marcarEstado(estado, 'Mostrando la copia guardada en este dispositivo.', 'aviso');
  } else {
    marcarEstado(estado, '', '');
  }
  return resultado;
}

async function inicializarEditorMensaje(tipo) {
  const textarea = document.getElementById('mensaje');
  const boton = document.getElementById('botonGrabar');
  const estado = document.getElementById('estadoMensaje');
  const contador = document.getElementById('contadorMensaje');
  if (!textarea || !boton) {
    console.error('[mensajes] faltan nodos del editor de mensajes');
    return;
  }

  actualizarContador(textarea, contador);
  textarea.addEventListener('input', () => {
    actualizarContador(textarea, contador);
  });
  boton.addEventListener('click', () => {
    guardarDesdeEditor(tipo, textarea, boton, estado);
  });

  boton.disabled = true;
  marcarEstado(estado, 'Cargando mensaje...', '');
  const cargaMensajes = cargarMensajes();
  const cargaContactos = inicializarContactos();
  const resultado = await cargaMensajes;
  const valorActual = typeof textarea.value === 'string' ? textarea.value : '';
  if (valorActual === '') {
    textarea.value = resultado.mensajes[tipo] || '';
    actualizarContador(textarea, contador);
  }
  boton.disabled = false;
  if (resultado.sesionExpirada) {
    marcarSesionExpirada(estado);
  } else if ((resultado.pendientes || []).includes(tipo)) {
    marcarEstado(estado, 'Guardado en este dispositivo, pendiente de sincronizar', 'aviso');
  } else if (resultado.degradado) {
    marcarEstado(estado, 'Mostrando la copia guardada en este dispositivo.', 'aviso');
  } else {
    marcarEstado(estado, '', '');
  }
  await cargaContactos;
  return resultado;
}

function iniciarPaginaMensajes() {
  const tipo = tipoDesdePagina();
  if (TIPOS_MENSAJE.includes(tipo)) {
    inicializarEditorMensaje(tipo);
    return;
  }
  if (document.getElementById('listaMensajes')) {
    inicializarListaMensajes();
  }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('DOMContentLoaded', iniciarPaginaMensajes);
}
