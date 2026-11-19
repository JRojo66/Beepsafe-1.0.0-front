const TIPOS_MENSAJE = ['inicio', 'fin', 'alarma', 'cancelacion', 'prueba'];

const CLAVE_MENSAJES = 'beepsafe_mensajes';

const TEXTO_ALARMA_POR_DEFECTO =
  'Por favor, confirmá que haya terminado mi sesión. Puede ser que esté necesitando ayuda. Gracias!';

const TEXTO_CANCELACION_POR_DEFECTO =
  'Estoy bien! Solo no llegué a cancelar la alarma a tiempo.';

const MENSAJES_POR_DEFECTO = {
  inicio: '',
  fin: '',
  alarma: TEXTO_ALARMA_POR_DEFECTO,
  cancelacion: TEXTO_CANCELACION_POR_DEFECTO,
  prueba: '',
};

const TIMEOUT_PETICION_MS = 8000;

const LARGO_MAXIMO_MENSAJE = 1000;

const LARGO_PREVIEW = 70;

const CLAVE_ULTIMA_SESION = 'beepsafe_ultima_sesion';

const ZONA_HORARIA_PREVIEW = 'America/Argentina/Buenos_Aires';

const PLANTILLAS_PREVIEW = {
  inicio: {
    antes: 'Aviso de BeepSafe para {contacto}: {usuario} comenzó una sesión de {actividad}.',
    despues: 'Tiene previsto finalizarla el {hora}. - Enviado desde BeepSafe.',
  },
  fin: {
    antes: 'Aviso de BeepSafe para {contacto}: {usuario} finalizó su sesión de {actividad}.',
    despues: '- Enviado desde BeepSafe.',
  },
  alarma: {
    antes:
      'Aviso de BeepSafe para {contacto}: {usuario} no detuvo su sesión de {actividad} en el tiempo previsto.',
    despues: '- Enviado desde BeepSafe.',
  },
  cancelacion: {
    antes:
      'Aviso de Beepsafe para {contacto}. {usuario} avisa que está bien, y que el mensaje de alarma ya no es válido.',
    despues: 'Enviado desde Beepsafe.',
  },
};

const VALORES_PREVIEW_RESPALDO = {
  contacto: '<tu contacto>',
  usuario: 'Marcelo',
  actividad: 'windsurf',
  hora: '19:00',
};

const MAX_CONTACTOS_COMPARTIDOS = 3;
const MAX_CONTACTOS_PRUEBA = 1;

const TEXTO_LIMITE_COMPARTIDOS = 'Máximo 3 contactos para los mensajes.';
const TEXTO_LIMITE_PRUEBA = 'Máximo 1 contacto para el mensaje de prueba.';
const TEXTO_SIN_CONTACTOS_DISPONIBLES = 'No hay contactos disponibles para agregar.';

const TEXTO_ERROR_ENVIO_GENERICO = 'error desconocido';

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

function nombreDesdeToken() {
  const token = leerToken();
  if (!token || typeof token !== 'string') return '';
  const partes = token.split('.');
  if (partes.length < 2 || !partes[1]) return '';
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = (4 - (base64.length % 4)) % 4;
    const payload = JSON.parse(atob(base64.padEnd(base64.length + relleno, '=')));
    if (payload && typeof payload.name === 'string' && payload.name.trim()) {
      return payload.name.trim();
    }
  } catch (err) {
    console.error(`[mensajes] no se pudo decodificar el JWT para el nombre: ${mensajeDeError(err)}`);
  }
  return '';
}

function claveConUsuario(base) {
  const email = emailDesdeToken();
  return email ? `${base}:${email}` : base;
}

function leerCrudoLocal(clave) {
  try {
    return localStorage.getItem(clave);
  } catch (err) {
    console.error(`[mensajes] localStorage ilegible en ${clave}: ${mensajeDeError(err)}`);
    return null;
  }
}

function leerUltimaSesionPreview() {
  const claves = [claveConUsuario(CLAVE_ULTIMA_SESION), CLAVE_ULTIMA_SESION];
  for (const clave of claves) {
    if (!clave) continue;
    const crudo = leerCrudoLocal(clave);
    if (!crudo) continue;
    try {
      const datos = JSON.parse(crudo);
      if (datos && typeof datos === 'object') return datos;
      console.error(`[mensajes] última sesión inválida en ${clave}: no es un objeto JSON`);
    } catch (err) {
      console.error(`[mensajes] última sesión ilegible en ${clave}: ${mensajeDeError(err)}`);
    }
  }
  return null;
}

function actividadPreview() {
  const sesion = leerUltimaSesionPreview();
  if (sesion && typeof sesion.actividad === 'string' && sesion.actividad.trim()) {
    return sesion.actividad.trim();
  }
  return VALORES_PREVIEW_RESPALDO.actividad;
}

function diaAbreviadoPreview(fecha) {
  const formato = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA_PREVIEW,
    weekday: 'short',
  });
  return formato.format(fecha).replace(/\./g, '').trim().toLowerCase();
}

// Fallback de la hora prevista: día de HOY en Buenos Aires a las 19:00, con
// el mismo formato que la hora calculada (abreviatura + HH:mm, sin "hs").
function formatearHoraFallbackPreview() {
  try {
    const dia = diaAbreviadoPreview(new Date());
    if (dia) return `${dia} 19:00`;
  } catch (err) {
    console.error(
      `[mensajes] no se pudo calcular el día de la hora prevista: ${mensajeDeError(err)}`
    );
  }
  return VALORES_PREVIEW_RESPALDO.hora;
}

function formatearHoraPreview(fecha) {
  try {
    const formato = new Intl.DateTimeFormat('es-AR', {
      timeZone: ZONA_HORARIA_PREVIEW,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const partes = formato.formatToParts(fecha);
    const buscar = (tipo) => {
      const parte = partes.find((item) => item.type === tipo);
      return parte ? parte.value : '';
    };
    const dia = diaAbreviadoPreview(fecha);
    let hora = buscar('hour');
    const minuto = buscar('minute');
    if (hora === '24') hora = '00';
    if (dia && hora && minuto) return `${dia} ${hora}:${minuto}`;
  } catch (err) {
    console.error(`[mensajes] no se pudo formatear la hora prevista: ${mensajeDeError(err)}`);
  }
  return formatearHoraFallbackPreview();
}

function horaPreview() {
  const sesion = leerUltimaSesionPreview();
  const duracion =
    sesion && Number.isFinite(sesion.tiempoSegundos) && sesion.tiempoSegundos > 0
      ? sesion.tiempoSegundos
      : 0;
  if (!duracion) return formatearHoraFallbackPreview();
  return formatearHoraPreview(new Date(Date.now() + duracion * 1000));
}

function contactoPreview(tipo) {
  const receptores = contactosAsignados(contactosConocidos, tipo);
  const primero = receptores.find(
    (contacto) => contacto && typeof contacto.nombre === 'string' && contacto.nombre.trim()
  );
  return primero ? primero.nombre.trim() : VALORES_PREVIEW_RESPALDO.contacto;
}

function interpolarPlantilla(plantilla, valores) {
  return String(plantilla ?? '').replace(/\{(\w+)\}/g, (coincidencia, clave) =>
    Object.prototype.hasOwnProperty.call(valores, clave) ? String(valores[clave]) : coincidencia
  );
}

function renderizarPreview(tipo) {
  const plantilla = PLANTILLAS_PREVIEW[tipo];
  if (!plantilla) return false;
  const valores = {
    // La cancelación la reciben los contactos de alarma (no existe un tipo
    // "cancelacion" en la asignación de contactos).
    contacto: contactoPreview(tipo === 'cancelacion' ? 'alarma' : tipo),
    usuario: nombreDesdeToken() || VALORES_PREVIEW_RESPALDO.usuario,
    actividad: actividadPreview(),
    hora: horaPreview(),
  };
  const antes = document.getElementById('mensajeFijoAntes');
  const despues = document.getElementById('mensajeFijoDespues');
  if (antes) antes.textContent = interpolarPlantilla(plantilla.antes, valores);
  if (despues) despues.textContent = interpolarPlantilla(plantilla.despues, valores);
  return true;
}

function observarCambiosSesion(tipo) {
  if (typeof window === 'undefined' || !window || typeof window.addEventListener !== 'function') {
    return;
  }
  window.addEventListener('storage', (evento) => {
    const clave = evento && typeof evento.key === 'string' ? evento.key : '';
    if (!clave || clave === CLAVE_ULTIMA_SESION || clave.startsWith(`${CLAVE_ULTIMA_SESION}:`)) {
      renderizarPreview(tipo);
    }
  });
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

// Dispara ahora el mensaje de prueba desde el backend. Solo se usa en la
// pantalla de prueba (`data-tipo="prueba"`); no escribe nada en localStorage.
async function enviarMensajeDePrueba() {
  const url = `${ROOT_URL}/api/message-events`;
  const estado = document.getElementById('estadoMensaje');
  const boton = document.getElementById('botonEnviarPrueba');
  if (!hayToken()) {
    console.error(`[mensajes] POST message-events sin token: ${url}`);
    marcarSesionExpirada(estado);
    return { ok: false, sesionExpirada: true };
  }
  if (boton) boton.disabled = true;
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tipo: 'prueba' }),
    });
    if (esSesionExpirada(respuesta)) {
      console.error(`[mensajes] POST message-events sesión expirada: ${url} status=${respuesta.status}`);
      marcarSesionExpirada(estado);
      return { ok: false, sesionExpirada: true };
    }
    if (!respuesta.ok) {
      console.error(`[mensajes] POST message-events falló: ${url} status=${respuesta.status}`);
      marcarEstado(estado, 'No se pudo enviar el mensaje de prueba. Intentá de nuevo.', 'aviso');
      return { ok: false };
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      console.error(
        `[mensajes] message-events devolvió JSON ilegible: ${url} — ${mensajeDeError(err)}`
      );
      marcarEstado(estado, 'No se pudo enviar el mensaje de prueba. Intentá de nuevo.', 'aviso');
      return { ok: false };
    }
    const total = datos && Number.isFinite(datos.total) ? datos.total : 0;
    if (total === 0) {
      marcarEstado(estado, 'No tenés contactos que reciban el mensaje de prueba.', 'aviso');
      return { ok: false, total: 0 };
    }
    // `total` es la cantidad INTENTADA; el resultado real está en `enviados`
    const enviados = datos && Array.isArray(datos.enviados) ? datos.enviados : [];
    const exitosos = enviados.filter((envio) => envio && envio.ok === true).length;
    const fallidos = enviados.filter((envio) => !envio || envio.ok !== true);
    const primerError =
      fallidos.length > 0 &&
      typeof (fallidos[0] && fallidos[0].error) === 'string' &&
      (fallidos[0] && fallidos[0].error).trim()
        ? (fallidos[0] && fallidos[0].error).trim()
        : TEXTO_ERROR_ENVIO_GENERICO;

    if (fallidos.length === 0 && exitosos > 0) {
      marcarEstado(estado, `Mensaje de prueba enviado a ${exitosos} contactos.`, 'ok');
      return { ok: true, total: exitosos };
    }
    if (exitosos === 0) {
      marcarEstado(estado, `No se pudo enviar el mensaje de prueba: ${primerError}`, 'error');
      return { ok: false, total: 0 };
    }
    marcarEstado(
      estado,
      `Mensaje enviado a ${exitosos} de ${total}. Falló en ${fallidos.length}: ${primerError}`,
      'aviso'
    );
    return { ok: exitosos > 0, total: exitosos };
  } catch (err) {
    console.error(`[mensajes] POST message-events falló: ${url} — ${mensajeDeError(err)}`);
    marcarEstado(estado, 'No se pudo enviar el mensaje de prueba. Intentá de nuevo.', 'aviso');
    return { ok: false };
  } finally {
    if (boton) boton.disabled = false;
  }
}

// Cablea el botón "Enviar prueba" solo en la pantalla de prueba. Devuelve la
// promesa del envío para que se pueda esperar (y testear el estado en vuelo).
function inicializarBotonPrueba(tipo) {
  if (tipo !== 'prueba') return false;
  const boton = document.getElementById('botonEnviarPrueba');
  if (!boton) return false;
  boton.addEventListener('click', () => enviarMensajeDePrueba());
  return true;
}

function normalizarContactoCargado(contacto) {
  const origen = contacto && typeof contacto === 'object' ? contacto : {};
  return {
    nombre: typeof origen.nombre === 'string' ? origen.nombre : String(origen.nombre ?? ''),
    telefono: typeof origen.telefono === 'string' ? origen.telefono : String(origen.telefono ?? ''),
    mensajesCompartidos: origen.mensajesCompartidos === true,
    mensajePrueba: origen.mensajePrueba === true,
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
  const cuerpo = {
    nombre: String(origen.nombre ?? ''),
    telefono: String(origen.telefono ?? ''),
  };
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
  const cuerpo = {
    nombre: String(origen.nombre ?? ''),
  };
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

function campoAsignacion(tipo) {
  return tipo === 'prueba' ? 'mensajePrueba' : 'mensajesCompartidos';
}

function limiteContactos(tipo) {
  return tipo === 'prueba' ? MAX_CONTACTOS_PRUEBA : MAX_CONTACTOS_COMPARTIDOS;
}

function textoLimiteContactos(tipo) {
  return tipo === 'prueba' ? TEXTO_LIMITE_PRUEBA : TEXTO_LIMITE_COMPARTIDOS;
}

function contactoAsignado(contacto, tipo) {
  if (!contacto || typeof contacto !== 'object') return false;
  if (tipo === 'prueba') return contacto.mensajePrueba === true;
  return contacto.mensajesCompartidos === true;
}

function contactosAsignados(contactos, tipo) {
  const lista = Array.isArray(contactos) ? contactos : [];
  return lista.filter((contacto) => contactoAsignado(contacto, tipo));
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

  const marca = document.createElement('span');
  marca.className = 'mensajes-contacto-marca';
  marca.textContent = 'Asignado';
  datos.appendChild(marca);
  fila.appendChild(datos);

  const acciones = document.createElement('div');
  acciones.className = 'mensajes-contacto-acciones';

  const quitar = document.createElement('button');
  quitar.type = 'button';
  quitar.className = 'mensajes-boton-mini';
  quitar.textContent = 'Quitar';
  quitar.addEventListener('click', () => quitarContactoDeLista(contacto));
  acciones.appendChild(quitar);


  fila.appendChild(acciones);
  return fila;
}

let contactosDelTipoActuales = 0;

let contactosConocidos = [];

function limiteDeContactosAlcanzado() {
  return contactosDelTipoActuales >= limiteContactos(tipoDesdePagina());
}

function actualizarSelectDisponibles(tipo, disponibles, bloquear) {
  const select = document.getElementById('contactoDisponible');
  if (!select) return;
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent =
    disponibles.length === 0 ? 'Sin contactos disponibles' : 'Eleg? un contacto';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);
  for (const contacto of disponibles) {
    const opcion = document.createElement('option');
    opcion.value = contacto.nombre;
    opcion.textContent = `${contacto.nombre} - ${contacto.telefono || "sin teléfono"}`;
    select.appendChild(opcion);
  }
  select.disabled = bloquear;
}

function actualizarLimiteContactos(cantidad) {
  contactosDelTipoActuales = Number.isFinite(cantidad) ? cantidad : 0;
  const tipo = tipoDesdePagina();
  const limite = limiteContactos(tipo);
  const alcanzado = contactosDelTipoActuales >= limite;
  const disponibles = contactosConocidos.filter((contacto) => !contactoAsignado(contacto, tipo));
  const sinDisponibles = disponibles.length === 0;
  const bloquear = alcanzado || sinDisponibles;
  const contador = document.getElementById('contadorContactos');
  if (contador) contador.textContent = `${contactosDelTipoActuales} de ${limite}`;
  const aviso = document.getElementById('mensajeLimiteContactos');
  if (aviso) {
    aviso.textContent = alcanzado
      ? textoLimiteContactos(tipo)
      : sinDisponibles
        ? TEXTO_SIN_CONTACTOS_DISPONIBLES
        : '';
  }
  actualizarSelectDisponibles(tipo, disponibles, bloquear);
  const boton = document.getElementById('botonAgregarContacto');
  if (boton) boton.disabled = bloquear;
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
  renderizarPreview(tipo);
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
  const select = document.getElementById('contactoDisponible');
  const boton = document.getElementById('botonAgregarContacto');
  const tipo = tipoDesdePagina();
  const limite = limiteContactos(tipo);
  if (contactosDelTipoActuales >= limite) {
    actualizarLimiteContactos(contactosDelTipoActuales);
    marcarEstado(estado, textoLimiteContactos(tipo), 'aviso');
    return;
  }
  const nombre = select ? String(select.value || '').trim() : '';
  if (!nombre) {
    marcarEstado(estado, 'Eleg? un contacto de Mis contactos.', 'error');
    return;
  }
  const contacto = contactosConocidos.find((item) => item.nombre === nombre);
  if (!contacto) {
    marcarEstado(estado, 'El contacto elegido ya no est? disponible.', 'error');
    return;
  }
  if (contactoAsignado(contacto, tipo)) {
    marcarEstado(estado, 'Ese contacto ya est? en la lista.', 'aviso');
    return;
  }
  if (boton) boton.disabled = true;
  const resultado = await actualizarAsignacionContacto(nombre, tipo, true);
  if (boton) boton.disabled = false;
  if (!resultado.ok) {
    if (resultado.sesionExpirada) {
      marcarSesionExpirada(estado);
      return;
    }
    const mensaje = resultado.error || 'No se pudo agregar el contacto. Intent� de nuevo.';
    marcarEstado(estado, mensaje, 'error');
    await reconciliarContactos();
    return;
  }
  if (select) select.value = '';
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

async function actualizarAsignacionContacto(nombre, tipo, valor) {
  const url = `${ROOT_URL}/api/contacts`;
  if (!hayToken()) {
    console.error(`[mensajes] PUT contacts sin token: ${url}`);
    return { ok: false, sesionExpirada: true };
  }
  const campo = campoAsignacion(tipo);
  const cuerpo = { nombre: String(nombre ?? ''), [campo]: valor === true };
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(cuerpo),
    });
    if (esSesionExpirada(respuesta)) {
      console.error(`[mensajes] PUT contacts sesi�n expirada: ${url} status=${respuesta.status}`);
      return { ok: false, sesionExpirada: true };
    }
    if (!respuesta.ok) {
      const error = await leerErrorRespuesta(respuesta, '');
      console.error(`[mensajes] PUT contacts fall�: ${url} status=${respuesta.status} - ${error}`);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[mensajes] PUT contacts fall�: ${url} - ${mensajeDeError(err)}`);
    return { ok: false, error: mensajeDeError(err) };
  }
}

async function quitarContactoDeLista(contacto) {
  const tipo = tipoDesdePagina();
  const estado = document.getElementById('estadoContactos');
  const resultado = await actualizarAsignacionContacto(contacto.nombre, tipo, false);
  if (!resultado.ok) {
    if (resultado.sesionExpirada) {
      marcarSesionExpirada(estado);
      return;
    }
    marcarEstado(estado, resultado.error || 'No se pudo quitar el contacto.', 'error');
    return;
  }
  await refrescarContactos('Contacto quitado.');
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

  renderizarPreview(tipo);
  observarCambiosSesion(tipo);

  actualizarContador(textarea, contador);
  textarea.addEventListener('input', () => {
    actualizarContador(textarea, contador);
  });
  boton.addEventListener('click', () => {
    guardarDesdeEditor(tipo, textarea, boton, estado);
  });
  inicializarBotonPrueba(tipo);

  boton.disabled = true;
  marcarEstado(estado, 'Cargando mensaje...', '');
  const cargaMensajes = cargarMensajes();
  const cargaContactos = inicializarContactos();
  const resultado = await cargaMensajes;
  const valorActual = typeof textarea.value === 'string' ? textarea.value : '';
  if (valorActual === '') {
    const valorGuardado = resultado.mensajes[tipo];
    // cancelacion arranca con su texto por defecto cuando no hay nada guardado
    textarea.value = valorGuardado || MENSAJES_POR_DEFECTO[tipo] || '';
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
