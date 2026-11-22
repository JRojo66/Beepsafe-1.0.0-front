const ZONA_ACTIVIDAD_GRUPOS = 'America/Argentina/Buenos_Aires';
const INTERVALO_PROGRESO_ACTIVIDAD_MS = 10000;
const INTERVALO_REFRESCO_DETALLE_ACTIVIDAD_MS = 60000;

let grupoDetalleActual = null;
let intervaloProgresoActividad = null;
let intervaloRefrescoDetalleActividad = null;
let refrescoDetalleActividadEnCurso = false;
let generacionDetalleActividad = 0;
let estadoActividadActual = { vencidos: [], enCurso: [], terminados: [] };
let mensajesGrupoActual = [];
let fuenteMensajesActividad = null;
let chatActividadVisible = true;

let modalEliminarSesion = null;
let modalConfirmarEliminar = null;
let estadoEliminarSesion = null;
let miembroPendienteEliminar = null;
let tarjetaPendienteEliminar = null;
let listaPendienteEliminar = null;
let modalesEliminarCableados = false;

let visorFotoEquipo = null;
let imagenVisorFotoEquipo = null;
let botonCerrarVisorFoto = null;
let disparadorVisorFoto = null;
let scrollPrevioVisorFoto = '';

let modalIntegrantesGrupo = null;
let tituloModalIntegrantes = null;
let listaIntegrantesGrupo = null;
let botonVerIntegrantes = null;
let botonCerrarIntegrantes = null;
let disparadorIntegrantes = null;

function tokenActividadGrupos() {
  try {
    return localStorage.getItem('token') || '';
  } catch (err) {
    return '';
  }
}

function payloadTokenActividad() {
  const token = tokenActividadGrupos();
  if (!token || typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length < 2 || !partes[1]) return null;
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = (4 - (base64.length % 4)) % 4;
    return JSON.parse(atob(base64.padEnd(base64.length + relleno, '=')));
  } catch (err) {
    return null;
  }
}

function idsUsuarioActividad() {
  const payload = payloadTokenActividad();
  const ids = new Set();
  for (const clave of ['userId', 'usuarioId', 'user_id', 'id', '_id', 'sub', 'email']) {
    const valor = payload && payload[clave];
    if (
      (typeof valor === 'string' || typeof valor === 'number') &&
      String(valor).trim()
    ) {
      ids.add(String(valor).trim());
    }
  }
  return ids;
}

function valorFechaActividad(valor) {
  if (valor == null || valor === '') return 0;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
}

function normalizarGrupos(datos) {
  if (Array.isArray(datos)) return datos;
  if (datos && typeof datos === 'object') {
    for (const clave of ['groups', 'grupos', 'misGrupos', 'data']) {
      if (Array.isArray(datos[clave])) return datos[clave];
    }
  }
  return [];
}

function normalizarEstadoActividad(datos) {
  const base =
    datos && typeof datos === 'object'
      ? datos.activityState || datos.estado || datos.data || datos
      : {};
  return {
    vencidos: Array.isArray(base && base.vencidos) ? base.vencidos : [],
    enCurso: Array.isArray(base && base.enCurso) ? base.enCurso : [],
    terminados: Array.isArray(base && base.terminados) ? base.terminados : [],
  };
}

function partesFechaActividad(fecha) {
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_ACTIVIDAD_GRUPOS,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fecha);
  const buscar = (tipo) => {
    const parte = partes.find((item) => item.type === tipo);
    return parte ? parte.value : '';
  };
  let hora = buscar('hour');
  if (hora === '24') hora = '00';
  return {
    dia: buscar('day'),
    mes: buscar('month'),
    hora,
    minuto: buscar('minute'),
  };
}

function claveDiaActividad(fecha) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_ACTIVIDAD_GRUPOS,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(fecha);
  } catch (err) {
    return '';
  }
}

function formatearHoraActividad(valor) {
  if (valor == null || valor === '') return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  try {
    const partes = partesFechaActividad(fecha);
    const hora = `${partes.hora}:${partes.minuto}`;
    if (claveDiaActividad(fecha) === claveDiaActividad(new Date())) return hora;
    return `${partes.dia}/${partes.mes} ${hora}`;
  } catch (err) {
    return String(valor);
  }
}

function normalizarMensajesActividad(datos) {
  const base = Array.isArray(datos)
    ? datos
    : datos && Array.isArray(datos.mensajes)
      ? datos.mensajes
      : [];
  return base.filter((mensaje) => mensaje && typeof mensaje === 'object');
}

function normalizarMensajeActividad(datos) {
  if (!datos || typeof datos !== 'object') return null;
  if (datos.mensaje && typeof datos.mensaje === 'object') return datos.mensaje;
  if (datos.message && typeof datos.message === 'object') return datos.message;
  if (datos.id != null || datos._id != null || datos.enviadoEn != null) return datos;
  return null;
}

function mensajeIdActividad(mensaje) {
  return mensaje && (mensaje.id != null ? mensaje.id : mensaje._id);
}

function construirListasActividad(estado, mensajes) {
  const base = estado && typeof estado === 'object' ? estado : {};
  const vencidos = (Array.isArray(base.vencidos) ? base.vencidos : [])
    .slice()
    .sort(
      (a, b) =>
        valorFechaActividad(b && b.finPrevisto) -
        valorFechaActividad(a && a.finPrevisto)
    );
  const enCurso = (Array.isArray(base.enCurso) ? base.enCurso : [])
    .slice()
    .sort((a, b) => valorFechaActividad(b && b.inicio) - valorFechaActividad(a && a.inicio));
  const terminados = (Array.isArray(base.terminados) ? base.terminados : [])
    .slice()
    .sort((a, b) => valorFechaActividad(b && b.fin) - valorFechaActividad(a && a.fin));
  const mensajesOrdenados = (Array.isArray(mensajes) ? mensajes : [])
    .slice()
    .sort(
      (a, b) =>
        valorFechaActividad(b && b.enviadoEn) - valorFechaActividad(a && a.enviadoEn)
    );

  const mensajesEnCurso = [];
  const mensajesFinalizadas = [];
  for (const mensaje of mensajesOrdenados) {
    const enviadoEn = valorFechaActividad(mensaje && mensaje.enviadoEn);
    const perteneceEnCurso = enCurso.some(
      (actividad) => valorFechaActividad(actividad && actividad.inicio) > enviadoEn
    );
    if (perteneceEnCurso) mensajesEnCurso.push(mensaje);
    else mensajesFinalizadas.push(mensaje);
  }

  const tiempoItem = (item) =>
    item.tipo === 'mensaje'
      ? valorFechaActividad(item.mensaje && item.mensaje.enviadoEn)
      : valorFechaActividad(
          item.actividad &&
            (item.actividad.inicio != null ? item.actividad.inicio : item.actividad.fin)
        );

  const itemsEnCurso = enCurso
    .map((actividad) => ({ tipo: 'actividad', actividad }))
    .concat(mensajesEnCurso.map((mensaje) => ({ tipo: 'mensaje', mensaje })))
    .sort((a, b) => tiempoItem(b) - tiempoItem(a));

  const itemsTerminados = terminados
    .map((actividad) => ({ tipo: 'actividad', actividad }))
    .concat(
      mensajesFinalizadas.map((mensaje) => ({ tipo: 'mensaje', mensaje }))
    )
    .sort((a, b) => {
      const tiempoA =
        a.tipo === 'mensaje'
          ? valorFechaActividad(a.mensaje && a.mensaje.enviadoEn)
          : valorFechaActividad(a.actividad && a.actividad.fin);
      const tiempoB =
        b.tipo === 'mensaje'
          ? valorFechaActividad(b.mensaje && b.mensaje.enviadoEn)
          : valorFechaActividad(b.actividad && b.actividad.fin);
      return tiempoB - tiempoA;
    });

  return { vencidos, enCurso: itemsEnCurso, terminados: itemsTerminados };
}

function crearBurbujaMensaje(mensaje) {
  const datos = mensaje && typeof mensaje === 'object' ? mensaje : {};
  const propio =
    datos.userId != null && idsUsuarioActividad().has(String(datos.userId));
  const burbuja = document.createElement('div');
  burbuja.className = `grupo-mensaje${propio ? ' grupo-mensaje-propio' : ''}`;
  const id = mensajeIdActividad(datos);
  if (id != null) burbuja.setAttribute('data-mensaje-id', String(id));

  if (!propio) {
    burbuja.appendChild(
      crearTextoActividad(
        'grupo-mensaje-usuario',
        datos.usuario || 'Usuario',
        'span'
      )
    );
  }
  burbuja.appendChild(
    crearTextoActividad(
      'grupo-mensaje-texto',
      datos.texto == null ? '' : String(datos.texto),
      'p'
    )
  );
  burbuja.appendChild(
    crearTextoActividad(
      'grupo-mensaje-hora',
      formatearHoraActividad(datos.enviadoEn),
      'span'
    )
  );
  return burbuja;
}

function renderizarItemsMixtos(lista, items, esVencido, enCurso) {
  if (!lista) return;
  lista.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    lista.appendChild(crearTextoActividad('grupo-actividad-vacio', 'Sin registros.'));
    return;
  }
  for (const item of items) {
    if (item.tipo === 'mensaje') {
      lista.appendChild(crearBurbujaMensaje(item.mensaje));
    } else {
      lista.appendChild(
        crearTarjetaMiembro(item.actividad, esVencido, lista, enCurso)
      );
    }
  }
}

function renderizarListasActividad() {
  const listas = construirListasActividad(estadoActividadActual, mensajesGrupoActual);
  renderizarMiembrosEnLista(
    document.getElementById('listaVencidos'),
    listas.vencidos,
    true
  );
  renderizarItemsMixtos(
    document.getElementById('listaEnCurso'),
    listas.enCurso,
    false,
    true
  );
  renderizarItemsMixtos(
    document.getElementById('listaTerminados'),
    listas.terminados,
    false,
    false
  );
}

function actualizarEstadoVacioDetalleActividad() {
  const mensaje = document.getElementById('estadoDetalleActividad');
  const reintentar = document.getElementById('botonReintentarDetalle');
  if (reintentar) reintentar.hidden = true;
  const vacio =
    estadoActividadActual.vencidos.length === 0 &&
    estadoActividadActual.enCurso.length === 0 &&
    estadoActividadActual.terminados.length === 0 &&
    mensajesGrupoActual.length === 0;
  if (mensaje) {
    mensaje.textContent = vacio ? 'No hay actividad registrada para este grupo.' : '';
  }
}

function agregarMensajeActividad(mensaje) {
  const datos = normalizarMensajeActividad(mensaje);
  if (!datos) return false;
  const id = mensajeIdActividad(datos);
  if (
    id != null &&
    mensajesGrupoActual.some(
      (existente) =>
        mensajeIdActividad(existente) != null &&
        String(mensajeIdActividad(existente)) === String(id)
    )
  ) {
    return false;
  }
  mensajesGrupoActual = mensajesGrupoActual.concat([datos]);
  renderizarListasActividad();
  actualizarEstadoVacioDetalleActividad();
  return true;
}

function detenerStreamMensajesActividad() {
  if (!fuenteMensajesActividad) return;
  fuenteMensajesActividad.close();
  fuenteMensajesActividad = null;
}

function manejarEventoMensajeActividad(evento) {
  if (!evento || typeof evento.data !== 'string') return;
  try {
    agregarMensajeActividad(JSON.parse(evento.data));
  } catch (err) {
    console.error('[actividadGrupos] evento SSE de mensaje inválido');
  }
}

function iniciarStreamMensajesActividad(groupId, token) {
  detenerStreamMensajesActividad();
  if (typeof EventSource !== 'function') return;
  const url = `${ROOT_URL}/api/groups/${encodeURIComponent(
    groupId
  )}/messages/stream?token=${encodeURIComponent(token)}`;
  try {
    fuenteMensajesActividad = new EventSource(url);
    fuenteMensajesActividad.addEventListener('mensaje', (evento) => {
      if (idGrupoDetalleActividad(grupoDetalleActual) !== groupId) return;
      manejarEventoMensajeActividad(evento);
    });
  } catch (err) {
    fuenteMensajesActividad = null;
  }
}

function establecerChatActividadVisible(visible) {
  chatActividadVisible = Boolean(visible);
  const vista = document.getElementById('vistaDetalleActividadGrupos');
  if (vista) {
    vista.classList.toggle('actividad-grupos-chat-oculto', !chatActividadVisible);
  }
  const boton = document.getElementById('toggleChatGrupo');
  if (boton) {
    boton.textContent = chatActividadVisible ? 'Ocultar chat' : 'Ver chat';
    boton.classList.toggle('activo', chatActividadVisible);
    boton.setAttribute('aria-pressed', String(chatActividadVisible));
  }
}

function alternarChatActividad() {
  establecerChatActividadVisible(!chatActividadVisible);
}

function mostrarErrorEnvioMensaje(mensaje) {
  const error = document.getElementById('errorMensajeGrupo');
  if (error) error.textContent = mensaje;
}

async function enviarMensajeActividad(evento) {
  if (evento && typeof evento.preventDefault === 'function') {
    evento.preventDefault();
  }
  const grupo = grupoDetalleActual;
  const groupId = idGrupoDetalleActividad(grupo);
  const token = tokenActividadGrupos();
  const entrada = document.getElementById('entradaMensajeGrupo');
  const boton = document.getElementById('enviarMensajeGrupo');
  if (!entrada || !boton) return;
  const texto = String(entrada.value || '').trim();
  if (!texto) return;
  if (!groupId || !token) {
    mostrarErrorEnvioMensaje('No se pudo enviar. Intentá de nuevo.');
    return;
  }

  boton.disabled = true;
  entrada.disabled = true;
  mostrarErrorEnvioMensaje('');
  try {
    const respuesta = await fetch(
      `${ROOT_URL}/api/groups/${encodeURIComponent(groupId)}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ texto }),
      }
    );
    if (!respuesta.ok) throw new Error('No se pudo enviar.');
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      datos = null;
    }
    if (grupoDetalleActual === grupo) {
      const mensaje = normalizarMensajeActividad(datos);
      if (mensaje) agregarMensajeActividad(mensaje);
    }
    entrada.value = '';
  } catch (err) {
    mostrarErrorEnvioMensaje('No se pudo enviar. Intentá de nuevo.');
  } finally {
    boton.disabled = false;
    entrada.disabled = false;
  }
}

async function cargarMensajesActividad(groupId, token, generacion) {
  try {
    const respuesta = await fetch(
      `${ROOT_URL}/api/groups/${encodeURIComponent(groupId)}/messages`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (generacion !== generacionDetalleActividad) return [];
    if (!respuesta.ok) {
      registrarDebugActividad(
        `[actividadGrupos] GET messages falló: HTTP ${respuesta.status}`
      );
      return [];
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      if (generacion !== generacionDetalleActividad) return [];
      registrarDebugActividad('[actividadGrupos] GET messages devolvió JSON inválido');
      return [];
    }
    if (generacion !== generacionDetalleActividad) return [];
    return normalizarMensajesActividad(datos);
  } catch (err) {
    if (generacion !== generacionDetalleActividad) return [];
    const detalle = err && err.message ? err.message : String(err);
    registrarDebugActividad(`[actividadGrupos] GET messages falló: ${detalle}`);
    return [];
  }
}

function inicializarChatActividad() {
  const toggle = document.getElementById('toggleChatGrupo');
  if (toggle) toggle.addEventListener('click', alternarChatActividad);
  const form = document.getElementById('formMensajeGrupo');
  if (form) form.addEventListener('submit', enviarMensajeActividad);
}

function formatearFechaInteraccion(valor) {
  if (valor == null || valor === '') return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  try {
    const partes = partesFechaActividad(fecha);
    return `${partes.dia}/${partes.mes} ${partes.hora}:${partes.minuto}`;
  } catch (err) {
    return '';
  }
}

function contarMiembrosGrupo(grupo) {
  if (!grupo || typeof grupo !== 'object') return null;
  if (Array.isArray(grupo.members)) return grupo.members.length;
  if (Number.isFinite(grupo.memberCount)) return grupo.memberCount;
  if (Number.isFinite(grupo.miembros)) return grupo.miembros;
  return null;
}

function secundarioGrupo(grupo) {
  const miembros = contarMiembrosGrupo(grupo);
  if (miembros != null) {
    return `${miembros} integrante${miembros === 1 ? '' : 's'}`;
  }
  const fecha = formatearFechaInteraccion(grupo && grupo.ultimaInteraccion);
  return fecha ? `Última interacción: ${fecha}` : '';
}

function crearTextoActividad(clase, texto, tag = 'p') {
  const elemento = document.createElement(tag);
  elemento.className = clase;
  elemento.textContent = texto;
  return elemento;
}

function calcularProgreso(inicio, finPrevisto, fin, esVencido) {
  if (esVencido) return 100;
  const inicioMs = valorFechaActividad(inicio);
  const finPrevistoMs = valorFechaActividad(finPrevisto);
  if (!inicioMs || !finPrevistoMs || finPrevistoMs <= inicioMs) return 0;
  const finMs = fin != null && fin !== '' ? valorFechaActividad(fin) : Date.now();
  const base = finMs || Date.now();
  const progreso = ((base - inicioMs) / (finPrevistoMs - inicioMs)) * 100;
  if (!Number.isFinite(progreso)) return 0;
  return Math.max(0, Math.min(100, progreso));
}

function buscarDescendientePorClase(nodo, clase) {
  if (!nodo) return null;
  if (nodo.classList && nodo.classList.contains(clase)) return nodo;
  for (const hijo of nodo.children || nodo.hijos || []) {
    const encontrado = buscarDescendientePorClase(hijo, clase);
    if (encontrado) return encontrado;
  }
  return null;
}

function actualizarProgresosEnCurso() {
  if (document.visibilityState && document.visibilityState !== 'visible') return;
  const lista = document.getElementById('listaEnCurso');
  if (!lista) return;
  const pendientes = [lista];
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    if (actual.classList && actual.classList.contains('grupo-progreso-en-curso')) {
      const relleno = buscarDescendientePorClase(actual, 'grupo-progreso-barra');
      if (relleno) {
        const progreso = calcularProgreso(
          actual.getAttribute('data-inicio'),
          actual.getAttribute('data-fin-previsto'),
          null,
          false
        );
        relleno.style.width = `${progreso}%`;
      }
    }
    pendientes.push(...(actual.children || actual.hijos || []));
  }
}

function detenerProgresoActividad() {
  if (intervaloProgresoActividad == null) return;
  clearInterval(intervaloProgresoActividad);
  intervaloProgresoActividad = null;
}

function iniciarProgresoActividad() {
  detenerProgresoActividad();
  const lista = document.getElementById('listaEnCurso');
  if (!lista || !buscarDescendientePorClase(lista, 'grupo-progreso-en-curso')) return;
  actualizarProgresosEnCurso();
  if (typeof setInterval !== 'function') return;
  intervaloProgresoActividad = setInterval(
    actualizarProgresosEnCurso,
    INTERVALO_PROGRESO_ACTIVIDAD_MS
  );
}

function idGrupoDetalleActividad(grupo) {
  return grupo && (grupo._id || grupo.id || grupo.groupId);
}

function incluirEliminadosDetalleActividad() {
  const toggle = document.getElementById('toggleEliminadosGrupo');
  return Boolean(toggle && toggle.checked);
}

function urlEstadoActividadGrupo(groupId, incluirEliminados) {
  return `${ROOT_URL}/api/groups/${encodeURIComponent(
    groupId
  )}/activity-state${incluirEliminados ? '?incluirEliminados=1' : ''}`;
}

function registrarDebugActividad(mensaje) {
  if (typeof console !== 'undefined' && console && typeof console.debug === 'function') {
    console.debug(mensaje);
  }
}

function detenerRefrescoDetalleActividad() {
  if (intervaloRefrescoDetalleActividad == null) return;
  clearInterval(intervaloRefrescoDetalleActividad);
  intervaloRefrescoDetalleActividad = null;
}

function iniciarRefrescoDetalleActividad() {
  detenerRefrescoDetalleActividad();
  if (!idGrupoDetalleActividad(grupoDetalleActual)) return;
  const vistaDetalle = document.getElementById('vistaDetalleActividadGrupos');
  if (!vistaDetalle || vistaDetalle.hidden) return;
  if (typeof setInterval !== 'function') return;
  intervaloRefrescoDetalleActividad = setInterval(
    refrescarDetalleActividadEnSegundoPlano,
    INTERVALO_REFRESCO_DETALLE_ACTIVIDAD_MS
  );
}

async function refrescarDetalleActividadEnSegundoPlano() {
  if (document.visibilityState && document.visibilityState !== 'visible') return;
  if (refrescoDetalleActividadEnCurso) return;
  const grupo = grupoDetalleActual;
  const groupId = idGrupoDetalleActividad(grupo);
  if (!groupId) return;
  const token = tokenActividadGrupos();
  if (!token) return;

  const generacion = generacionDetalleActividad;
  const incluirEliminados = incluirEliminadosDetalleActividad();
  refrescoDetalleActividadEnCurso = true;
  try {
    const respuesta = await fetch(urlEstadoActividadGrupo(groupId, incluirEliminados), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) {
      registrarDebugActividad(
        `[actividadGrupos] refresco en segundo plano falló: HTTP ${respuesta.status}`
      );
      return;
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      registrarDebugActividad('[actividadGrupos] refresco en segundo plano devolvió JSON inválido');
      return;
    }
    if (grupoDetalleActual !== grupo || generacion !== generacionDetalleActividad) return;
    renderizarDetalleActividad(datos);
  } catch (err) {
    const detalle = err && err.message ? err.message : String(err);
    registrarDebugActividad(`[actividadGrupos] refresco en segundo plano falló: ${detalle}`);
  } finally {
    refrescoDetalleActividadEnCurso = false;
  }
}

function manejarVisibilidadProgresoActividad() {
  if (document.visibilityState && document.visibilityState !== 'visible') return;
  actualizarProgresosEnCurso();
  refrescarDetalleActividadEnSegundoPlano();
}

function nombreEquipoActividad(equipo) {
  if (equipo && typeof equipo === 'object') {
    return equipo.nombre || equipo.name || equipo.id || 'Equipo';
  }
  return equipo == null ? '' : String(equipo);
}

function abrirVisorFotoEquipo(foto, nombre, disparador) {
  if (!visorFotoEquipo || !imagenVisorFotoEquipo) return;
  const etiqueta = `Foto de ${nombre}`;
  imagenVisorFotoEquipo.src = foto;
  imagenVisorFotoEquipo.alt = etiqueta;
  visorFotoEquipo.setAttribute('aria-label', etiqueta);
  disparadorVisorFoto = disparador || null;
  if (document.body && document.body.style) {
    scrollPrevioVisorFoto = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  }
  visorFotoEquipo.classList.remove('hidden');
  if (botonCerrarVisorFoto && typeof botonCerrarVisorFoto.focus === 'function') {
    botonCerrarVisorFoto.focus();
  }
}

function cerrarVisorFotoEquipo() {
  if (!visorFotoEquipo) return;
  visorFotoEquipo.classList.add('hidden');
  if (imagenVisorFotoEquipo) {
    imagenVisorFotoEquipo.src = '';
    imagenVisorFotoEquipo.alt = '';
  }
  if (document.body && document.body.style) {
    document.body.style.overflow = scrollPrevioVisorFoto || '';
  }
  if (disparadorVisorFoto && typeof disparadorVisorFoto.focus === 'function') {
    disparadorVisorFoto.focus();
  }
  disparadorVisorFoto = null;
}

function crearItemEquipo(equipo) {
  const item = document.createElement('div');
  item.className = 'grupo-equipo';
  const nombre = nombreEquipoActividad(equipo);

  const foto = equipo && typeof equipo === 'object' ? equipo.foto : null;
  if (foto != null && foto !== '') {
    const botonFoto = document.createElement('button');
    botonFoto.type = 'button';
    botonFoto.className = 'grupo-equipo-foto-boton';
    botonFoto.setAttribute('aria-label', `Ver foto de ${nombre}`);
    const imagen = document.createElement('img');
    imagen.className = 'grupo-equipo-foto';
    imagen.src = foto;
    imagen.alt = '';
    botonFoto.appendChild(imagen);
    botonFoto.addEventListener('click', () => abrirVisorFotoEquipo(foto, nombre, botonFoto));
    item.appendChild(botonFoto);
  } else {
    const marcador = document.createElement('span');
    marcador.className = 'grupo-equipo-placeholder';
    marcador.setAttribute('aria-hidden', 'true');
    item.appendChild(marcador);
  }

  item.appendChild(crearTextoActividad('grupo-equipo-nombre', nombre, 'span'));
  return item;
}

function mostrarErrorEliminar(mensaje) {
  if (!estadoEliminarSesion) return;
  estadoEliminarSesion.textContent = mensaje;
}

function miembroEliminado(datos) {
  return Boolean(
    datos &&
      typeof datos === 'object' &&
      (datos.eliminado === true ||
        datos.deleted === true ||
        datos.estado === 'eliminado')
  );
}

function abrirModalEliminarSesion(miembro, tarjeta, lista) {
  if (!modalEliminarSesion) return;
  miembroPendienteEliminar = miembro;
  tarjetaPendienteEliminar = tarjeta;
  listaPendienteEliminar = lista;
  mostrarErrorEliminar('');
  if (modalConfirmarEliminar) modalConfirmarEliminar.classList.add('hidden');
  modalEliminarSesion.classList.remove('hidden');
  const continuar = document.getElementById('continuarEliminarSesion');
  if (continuar && typeof continuar.focus === 'function') continuar.focus();
}

function abrirModalConfirmarEliminar() {
  if (!modalConfirmarEliminar) return;
  if (modalEliminarSesion) modalEliminarSesion.classList.add('hidden');
  modalConfirmarEliminar.classList.remove('hidden');
  const eliminar = document.getElementById('eliminarSesion');
  if (eliminar && typeof eliminar.focus === 'function') eliminar.focus();
}

function cerrarModalesEliminar() {
  if (modalEliminarSesion) modalEliminarSesion.classList.add('hidden');
  if (modalConfirmarEliminar) modalConfirmarEliminar.classList.add('hidden');
  miembroPendienteEliminar = null;
  tarjetaPendienteEliminar = null;
  listaPendienteEliminar = null;
}

function manejarTeclaEliminar(evento) {
  if (!evento || evento.key !== 'Escape') return;
  const abierto =
    (modalEliminarSesion && !modalEliminarSesion.classList.contains('hidden')) ||
    (modalConfirmarEliminar && !modalConfirmarEliminar.classList.contains('hidden'));
  if (abierto) cerrarModalesEliminar();
}

async function leerErrorRespuestaActividad(respuesta) {
  try {
    const datos = await respuesta.json();
    if (datos && typeof datos.error === 'string' && datos.error.trim()) {
      return datos.error.trim();
    }
    if (datos && typeof datos.message === 'string' && datos.message.trim()) {
      return datos.message.trim();
    }
  } catch (err) {
    // Se intenta leer como texto.
  }
  try {
    const texto = await respuesta.text();
    if (typeof texto === 'string' && texto.trim()) return texto.trim();
  } catch (err) {
    // Sin cuerpo legible.
  }
  return '';
}

function actualizarVacioLista(lista) {
  if (!lista) return;
  const vacia =
    typeof lista.childElementCount === 'number'
      ? lista.childElementCount === 0
      : Array.isArray(lista.hijos)
        ? lista.hijos.length === 0
        : !lista.firstChild;
  if (!vacia) return;
  lista.appendChild(crearTextoActividad('grupo-actividad-vacio', 'Sin registros.'));
}

async function confirmarEliminarSesion() {
  const miembro = miembroPendienteEliminar;
  const tarjeta = tarjetaPendienteEliminar;
  const lista = listaPendienteEliminar;
  if (!miembro || !tarjeta) {
    cerrarModalesEliminar();
    return;
  }
  const id = miembro.id;
  const tipo = miembro.tipo;
  if (!id || (tipo !== 'sesion' && tipo !== 'registro')) {
    mostrarErrorEliminar('No se pudo eliminar: datos incompletos.');
    cerrarModalesEliminar();
    return;
  }
  const url =
    tipo === 'sesion'
      ? `${ROOT_URL}/api/message-events/session/${encodeURIComponent(id)}`
      : `${ROOT_URL}/api/activity-logs/${encodeURIComponent(id)}`;
  const token = tokenActividadGrupos();
  const boton = document.getElementById('eliminarSesion');
  if (boton) boton.disabled = true;
  try {
    const respuesta = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (respuesta.status === 204) {
      cerrarModalesEliminar();
      if (typeof tarjeta.remove === 'function') tarjeta.remove();
      actualizarVacioLista(lista);
      return;
    }
    mostrarErrorEliminar('No se pudo eliminar. Intentá de nuevo.');
    cerrarModalesEliminar();
  } catch (err) {
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[actividadGrupos] DELETE falló: ${detalle}`);
    mostrarErrorEliminar('No se pudo eliminar. Intentá de nuevo.');
    cerrarModalesEliminar();
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function restaurarMiembro(miembro, boton) {
  const datos = miembro && typeof miembro === 'object' ? miembro : {};
  const id = datos.id;
  const tipo = datos.tipo;
  if (!id || (tipo !== 'sesion' && tipo !== 'registro')) {
    mostrarErrorEliminar('No se pudo restaurar: datos incompletos.');
    return;
  }
  const url =
    tipo === 'sesion'
      ? `${ROOT_URL}/api/message-events/session/${encodeURIComponent(id)}/restaurar`
      : `${ROOT_URL}/api/activity-logs/${encodeURIComponent(id)}/restaurar`;
  const token = tokenActividadGrupos();
  if (boton) boton.disabled = true;
  mostrarErrorEliminar('');
  try {
    const respuesta = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (respuesta.status === 200) {
      if (grupoDetalleActual) await cargarDetalleGrupo(grupoDetalleActual);
      return;
    }
    const mensaje = await leerErrorRespuestaActividad(respuesta);
    mostrarErrorEliminar(mensaje || 'No se pudo restaurar. Intentá de nuevo.');
  } catch (err) {
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[actividadGrupos] PATCH restaurar falló: ${detalle}`);
    mostrarErrorEliminar('No se pudo restaurar. Intentá de nuevo.');
  } finally {
    if (boton) boton.disabled = false;
  }
}

function inicializarModalesEliminar() {
  if (modalesEliminarCableados) return;
  modalEliminarSesion = document.getElementById('modalEliminarSesion');
  modalConfirmarEliminar = document.getElementById('modalConfirmarEliminarSesion');
  if (!modalEliminarSesion || !modalConfirmarEliminar) return;
  estadoEliminarSesion = document.getElementById('estadoEliminarSesion');
  modalesEliminarCableados = true;
  const continuar = document.getElementById('continuarEliminarSesion');
  const cancelar = document.getElementById('cancelarEliminarSesion');
  const cerrar = document.getElementById('cerrarModalEliminarSesion');
  const eliminar = document.getElementById('eliminarSesion');
  const cancelar2 = document.getElementById('cancelarConfirmarEliminar');
  const cerrar2 = document.getElementById('cerrarModalConfirmarEliminar');
  if (continuar) continuar.addEventListener('click', abrirModalConfirmarEliminar);
  if (cancelar) cancelar.addEventListener('click', cerrarModalesEliminar);
  if (cerrar) cerrar.addEventListener('click', cerrarModalesEliminar);
  if (eliminar) eliminar.addEventListener('click', confirmarEliminarSesion);
  if (cancelar2) cancelar2.addEventListener('click', cerrarModalesEliminar);
  if (cerrar2) cerrar2.addEventListener('click', cerrarModalesEliminar);

  document.addEventListener('keydown', manejarTeclaEliminar);
}

function crearTarjetaMiembro(miembro, esVencido, lista, enCurso = false) {
  const datos = miembro && typeof miembro === 'object' ? miembro : {};
  const eliminado = miembroEliminado(datos);
  const tarjeta = document.createElement('div');
  tarjeta.className = `grupo-miembro-card${esVencido ? ' grupo-miembro-card-vencido' : ''}${
    eliminado ? ' grupo-miembro-card-eliminada' : ''
  }`;

  const cabecera = document.createElement('div');
  cabecera.className = 'grupo-miembro-cabecera';
  cabecera.appendChild(
    crearTextoActividad('grupo-miembro-usuario', datos.usuario || 'Usuario', 'strong')
  );
  cabecera.appendChild(
    crearTextoActividad('grupo-miembro-actividad', datos.actividad || 'Sin actividad', 'span')
  );
  const accionesCabecera = document.createElement('div');
  accionesCabecera.className = 'grupo-miembro-acciones';
  let tieneAcciones = false;
  if (eliminado) {
    accionesCabecera.appendChild(
      crearTextoActividad('grupo-eliminada-label', 'Eliminada', 'span')
    );
    if (datos.id && (datos.tipo === 'sesion' || datos.tipo === 'registro')) {
      const botonRestaurar = document.createElement('button');
      botonRestaurar.type = 'button';
      botonRestaurar.className = 'grupo-restaurar-boton';
      botonRestaurar.textContent = 'Restaurar';
      botonRestaurar.addEventListener('click', () => restaurarMiembro(datos, botonRestaurar));
      accionesCabecera.appendChild(botonRestaurar);
    }
    tieneAcciones = true;
  } else {
    if (datos.puedeEliminar === true) {
      const botonEliminar = document.createElement('button');
      botonEliminar.type = 'button';
      botonEliminar.className = 'grupo-eliminar-boton';
      botonEliminar.textContent = 'Eliminar';
      botonEliminar.addEventListener('click', () => {
        abrirModalEliminarSesion(datos, tarjeta, lista);
      });
      accionesCabecera.appendChild(botonEliminar);
      tieneAcciones = true;
    }
  }
  if (tieneAcciones) cabecera.appendChild(accionesCabecera);
  tarjeta.appendChild(cabecera);

  if (esVencido) {
    tarjeta.appendChild(
      crearTextoActividad(
        'grupo-alarma-estado',
        `Alarma: ${datos.estadoAlarma || 'sin_alarma'}`,
        'span'
      )
    );
  }

  const inicioTexto = formatearHoraActividad(datos.inicio);
  const horasTexto =
    datos.tipo === 'registro'
      ? `Inicio: ${inicioTexto} · Fin: ${formatearHoraActividad(datos.fin) || '—'}`
      : `Inicio: ${inicioTexto} · Fin previsto: ${formatearHoraActividad(datos.finPrevisto)}`;
  tarjeta.appendChild(crearTextoActividad('grupo-miembro-horas', horasTexto));

  if (datos.tipo !== 'registro' && (esVencido || enCurso)) {
    const progreso = calcularProgreso(datos.inicio, datos.finPrevisto, datos.fin, esVencido);
    const barra = document.createElement('div');
    barra.className = 'grupo-progreso';
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-valuemin', '0');
    barra.setAttribute('aria-valuemax', '100');
    barra.setAttribute('aria-valuenow', String(Math.round(progreso)));
    if (enCurso) {
      barra.classList.add('grupo-progreso-en-curso');
      barra.setAttribute(
        'data-inicio',
        datos.inicio == null ? '' : String(datos.inicio)
      );
      barra.setAttribute(
        'data-fin-previsto',
        datos.finPrevisto == null ? '' : String(datos.finPrevisto)
      );
    }
    const relleno = document.createElement('div');
    relleno.className = 'grupo-progreso-barra';
    relleno.style.width = `${progreso}%`;
    barra.appendChild(relleno);
    tarjeta.appendChild(barra);
  }

  const equipos = Array.isArray(datos.equipos)
    ? datos.equipos
    : Array.isArray(datos.equipo)
      ? datos.equipo
      : datos.equipo != null
        ? [datos.equipo]
        : [];
  const bloqueEquipos = document.createElement('div');
  bloqueEquipos.className = 'grupo-equipos';
  if (equipos.length === 0) {
    bloqueEquipos.appendChild(crearTextoActividad('grupo-equipos-vacio', 'Sin equipos'));
  } else {
    for (const equipo of equipos) {
      bloqueEquipos.appendChild(crearItemEquipo(equipo));
    }
  }
  const telefono = crearTextoActividad(
    'grupo-telefono-numero',
    datos.telefono == null ? '' : String(datos.telefono),
    'span'
  );
  telefono.hidden = true;
  const botonTelefono = document.createElement('button');
  botonTelefono.type = 'button';
  botonTelefono.className = 'grupo-telefono-boton';
  botonTelefono.textContent = '☎';
  botonTelefono.setAttribute('aria-label', 'Mostrar teléfono');
  botonTelefono.addEventListener('click', () => {
    const estabaOculto = telefono.hidden;
    telefono.hidden = !estabaOculto;
    botonTelefono.setAttribute(
      'aria-label',
      estabaOculto ? 'Ocultar teléfono' : 'Mostrar teléfono'
    );
  });

  const filaEquiposTelefono = document.createElement('div');
  filaEquiposTelefono.className = 'grupo-equipos-fila';
  filaEquiposTelefono.appendChild(bloqueEquipos);
  filaEquiposTelefono.appendChild(botonTelefono);
  tarjeta.appendChild(filaEquiposTelefono);

  const filaTelefono = document.createElement('div');
  filaTelefono.className = 'grupo-telefono';
  filaTelefono.appendChild(telefono);
  tarjeta.appendChild(filaTelefono);

  return tarjeta;
}

function renderizarMiembrosEnLista(lista, miembros, esVencido, enCurso = false) {
  if (!lista) return;
  lista.innerHTML = '';
  if (!Array.isArray(miembros) || miembros.length === 0) {
    lista.appendChild(crearTextoActividad('grupo-actividad-vacio', 'Sin registros.'));
    return;
  }
  for (const miembro of miembros) {
    lista.appendChild(crearTarjetaMiembro(miembro, esVencido, lista, enCurso));
  }
}

function renderizarDetalleActividad(datos) {
  estadoActividadActual = normalizarEstadoActividad(datos);
  renderizarListasActividad();
  actualizarEstadoVacioDetalleActividad();
  iniciarProgresoActividad();
  iniciarRefrescoDetalleActividad();
  return estadoActividadActual;
}

function mostrarErrorDetalleActividad() {
  const mensaje = document.getElementById('estadoDetalleActividad');
  const reintentar = document.getElementById('botonReintentarDetalle');
  for (const id of ['listaVencidos', 'listaEnCurso', 'listaTerminados']) {
    const lista = document.getElementById(id);
    if (lista) lista.innerHTML = '';
  }
  if (mensaje) mensaje.textContent = 'No se pudo cargar la actividad del grupo.';
  if (reintentar) reintentar.hidden = false;
}

async function cargarDetalleGrupo(grupo) {
  detenerProgresoActividad();
  detenerRefrescoDetalleActividad();
  detenerStreamMensajesActividad();
  mensajesGrupoActual = [];
  const generacion = ++generacionDetalleActividad;
  const mensaje = document.getElementById('estadoDetalleActividad');
  const reintentar = document.getElementById('botonReintentarDetalle');
  if (reintentar) reintentar.hidden = true;
  if (mensaje) mensaje.textContent = 'Cargando actividad...';
  const groupId = idGrupoDetalleActividad(grupo);
  if (!groupId) {
    mostrarErrorDetalleActividad();
    return null;
  }
  const token = tokenActividadGrupos();
  if (!token) {
    mostrarErrorDetalleActividad();
    return null;
  }
  try {
    const incluirEliminados = incluirEliminadosDetalleActividad();
    const [respuesta, mensajes] = await Promise.all([
      fetch(urlEstadoActividadGrupo(groupId, incluirEliminados), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }),
      cargarMensajesActividad(groupId, token, generacion),
    ]);
    if (generacion !== generacionDetalleActividad) return null;
    if (!respuesta.ok) {
      mostrarErrorDetalleActividad();
      return null;
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      if (generacion !== generacionDetalleActividad) return null;
      mostrarErrorDetalleActividad();
      return null;
    }
    if (generacion !== generacionDetalleActividad) return null;
    mensajesGrupoActual = mensajes;
    const estado = renderizarDetalleActividad(datos);
    iniciarStreamMensajesActividad(groupId, token);
    return estado;
  } catch (err) {
    if (generacion !== generacionDetalleActividad) return null;
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[actividadGrupos] GET activity-state falló: ${detalle}`);
    mostrarErrorDetalleActividad();
    return null;
  }
}

function abrirDetalleGrupo(grupo) {
  cerrarModalIntegrantes();
  grupoDetalleActual = grupo;
  const vistaLista = document.getElementById('vistaListaActividadGrupos');
  const vistaDetalle = document.getElementById('vistaDetalleActividadGrupos');
  const titulo = document.getElementById('tituloDetalleGrupo');
  if (vistaLista) vistaLista.hidden = true;
  if (vistaDetalle) vistaDetalle.hidden = false;
  if (titulo) titulo.textContent = (grupo && grupo.name) || 'Grupo';
  establecerChatActividadVisible(true);
  mostrarErrorEnvioMensaje('');
  return cargarDetalleGrupo(grupo);
}

function volverListaActividadGrupos() {
  generacionDetalleActividad += 1;
  detenerProgresoActividad();
  detenerRefrescoDetalleActividad();
  detenerStreamMensajesActividad();
  cerrarModalIntegrantes();
  grupoDetalleActual = null;
  const toggle = document.getElementById('toggleEliminadosGrupo');
  if (toggle) toggle.checked = false;
  const vistaLista = document.getElementById('vistaListaActividadGrupos');
  const vistaDetalle = document.getElementById('vistaDetalleActividadGrupos');
  if (vistaLista) vistaLista.hidden = false;
  if (vistaDetalle) vistaDetalle.hidden = true;
}

function textoIntegrante(valor) {
  return valor == null ? '' : String(valor).trim();
}

function agregarIntegranteGrupo(integrantes, indices, datos) {
  const id = textoIntegrante(datos && datos.id);
  const telefono = textoIntegrante(datos && datos.telefono);
  const nombre = textoIntegrante(datos && datos.nombre);
  if (!id && !telefono && !nombre) return;

  const claveTelefono = telefono.replace(/\D/g, '');
  const claveNombre = nombre.toLocaleLowerCase('es');
  let existente = id ? indices.porId.get(id) : null;
  if (!existente && claveTelefono) {
    existente = indices.porTelefono.get(claveTelefono);
  }
  if (!existente && !id && !claveTelefono && claveNombre) {
    existente = indices.porNombre.get(claveNombre);
  }

  if (existente) {
    if (!existente.nombre && nombre) existente.nombre = nombre;
    if (!existente.telefono && telefono) existente.telefono = telefono;
    if (id) indices.porId.set(id, existente);
    if (claveTelefono) indices.porTelefono.set(claveTelefono, existente);
    if (claveNombre) indices.porNombre.set(claveNombre, existente);
    return;
  }

  const integrante = {
    nombre: nombre || telefono || id || 'Integrante',
    telefono,
  };
  integrantes.push(integrante);
  if (id) indices.porId.set(id, integrante);
  if (claveTelefono) indices.porTelefono.set(claveTelefono, integrante);
  if (claveNombre) indices.porNombre.set(claveNombre, integrante);
}

function construirIntegrantesGrupo(grupo, estado) {
  const integrantes = [];
  const indices = {
    porId: new Map(),
    porTelefono: new Map(),
    porNombre: new Map(),
  };
  const miembros = Array.isArray(grupo && grupo.members)
    ? grupo.members
    : Array.isArray(grupo && grupo.miembros)
      ? grupo.miembros
      : Array.isArray(grupo && grupo.integrantes)
        ? grupo.integrantes
        : [];

  for (const miembro of miembros) {
    if (miembro == null) continue;
    if (typeof miembro !== 'object') {
      agregarIntegranteGrupo(integrantes, indices, {
        id: typeof miembro === 'number' ? miembro : '',
        telefono: typeof miembro === 'string' ? miembro : '',
      });
      continue;
    }
    const usuario =
      miembro.user && typeof miembro.user === 'object'
        ? miembro.user
        : miembro.usuario && typeof miembro.usuario === 'object'
          ? miembro.usuario
          : {};
    agregarIntegranteGrupo(integrantes, indices, {
      id:
        miembro.userId ??
        miembro.usuarioId ??
        miembro.user_id ??
        usuario.userId ??
        usuario.id ??
        usuario._id ??
        miembro.id ??
        miembro._id,
      nombre:
        miembro.name ??
        miembro.nombre ??
        (typeof miembro.usuario === 'string' ? miembro.usuario : null) ??
        usuario.name ??
        usuario.nombre,
      telefono:
        miembro.phone ??
        miembro.telefono ??
        usuario.phone ??
        usuario.telefono,
    });
  }

  const base = estado && typeof estado === 'object' ? estado : {};
  for (const clave of ['vencidos', 'enCurso', 'terminados']) {
    const lista = Array.isArray(base[clave]) ? base[clave] : [];
    for (const actividad of lista) {
      if (!actividad || typeof actividad !== 'object') continue;
      agregarIntegranteGrupo(integrantes, indices, {
        id:
          actividad.userId ??
          actividad.usuarioId ??
          actividad.user_id,
        nombre: actividad.usuario ?? actividad.nombre ?? actividad.name,
        telefono: actividad.telefono ?? actividad.phone,
      });
    }
  }

  return integrantes;
}

function renderizarIntegrantesGrupo() {
  if (!listaIntegrantesGrupo) return;
  const integrantes = construirIntegrantesGrupo(
    grupoDetalleActual,
    estadoActividadActual
  );
  listaIntegrantesGrupo.innerHTML = '';
  if (integrantes.length === 0) {
    listaIntegrantesGrupo.appendChild(
      crearTextoActividad(
        'grupo-integrantes-vacio',
        'No hay integrantes para mostrar.'
      )
    );
    return;
  }

  for (const integrante of integrantes) {
    const fila = document.createElement('div');
    fila.className = 'grupo-integrante';
    fila.appendChild(
      crearTextoActividad(
        'grupo-integrante-nombre',
        integrante.nombre,
        'span'
      )
    );
    if (integrante.telefono && integrante.telefono !== integrante.nombre) {
      fila.appendChild(
        crearTextoActividad(
          'grupo-integrante-telefono',
          integrante.telefono,
          'span'
        )
      );
    }
    listaIntegrantesGrupo.appendChild(fila);
  }
}

function abrirModalIntegrantes() {
  if (!modalIntegrantesGrupo) return;
  const nombre = (grupoDetalleActual && grupoDetalleActual.name) || 'grupo';
  if (tituloModalIntegrantes) {
    tituloModalIntegrantes.textContent = `Integrantes de ${nombre}`;
  }
  renderizarIntegrantesGrupo();
  disparadorIntegrantes = botonVerIntegrantes;
  modalIntegrantesGrupo.classList.remove('hidden');
  if (botonCerrarIntegrantes && typeof botonCerrarIntegrantes.focus === 'function') {
    botonCerrarIntegrantes.focus();
  }
}

function cerrarModalIntegrantes() {
  if (!modalIntegrantesGrupo) return;
  const estabaAbierto = !modalIntegrantesGrupo.classList.contains('hidden');
  modalIntegrantesGrupo.classList.add('hidden');
  if (
    estabaAbierto &&
    disparadorIntegrantes &&
    typeof disparadorIntegrantes.focus === 'function'
  ) {
    disparadorIntegrantes.focus();
  }
  disparadorIntegrantes = null;
}

function inicializarModalIntegrantes() {
  modalIntegrantesGrupo = document.getElementById('modalIntegrantesGrupo');
  tituloModalIntegrantes = document.getElementById('tituloModalIntegrantes');
  listaIntegrantesGrupo = document.getElementById('listaIntegrantesGrupo');
  botonVerIntegrantes = document.getElementById('verIntegrantesGrupo');
  botonCerrarIntegrantes = document.getElementById('cerrarIntegrantesBoton');
  const botonCerrar = document.getElementById('cerrarModalIntegrantes');
  if (!modalIntegrantesGrupo || !botonVerIntegrantes) return;
  botonVerIntegrantes.addEventListener('click', abrirModalIntegrantes);
  if (botonCerrar) {
    botonCerrar.addEventListener('click', cerrarModalIntegrantes);
  }
  if (botonCerrarIntegrantes) {
    botonCerrarIntegrantes.addEventListener('click', cerrarModalIntegrantes);
  }
  modalIntegrantesGrupo.addEventListener('click', (evento) => {
    if (evento && evento.target === modalIntegrantesGrupo) {
      cerrarModalIntegrantes();
    }
  });
  document.addEventListener('keydown', (evento) => {
    if (!evento || evento.key !== 'Escape') return;
    if (!modalIntegrantesGrupo.classList.contains('hidden')) {
      cerrarModalIntegrantes();
    }
  });
}

function crearTarjetaGrupo(grupo) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'perfil grupo-actividad-card grupo-actividad-card-full';

  const contenido = document.createElement('div');
  contenido.className = 'containerPerfil';

  const icono = document.createElement('img');
  icono.src = '../imagenes/amigosSinFondoBlanco.png';
  icono.alt = '';
  contenido.appendChild(icono);

  const textos = crearTextoActividad(
    'opciones',
    (grupo && grupo.name) || '(sin nombre)',
    'div'
  );
  textos.appendChild(
    crearTextoActividad('grupo-actividad-secundario', secundarioGrupo(grupo), 'div')
  );
  contenido.appendChild(textos);

  contenido.appendChild(crearTextoActividad('grupo-actividad-chevron', '>', 'div'));
  boton.appendChild(contenido);
  boton.addEventListener('click', () => abrirDetalleGrupo(grupo));
  return boton;
}

function renderizarGrupos(grupos) {
  const lista = document.getElementById('listaGrupos');
  const mensaje = document.getElementById('estadoListaGrupos');
  const reintentar = document.getElementById('botonReintentarGrupos');
  if (!lista) return [];
  lista.innerHTML = '';
  if (reintentar) reintentar.hidden = true;
  const normalizados = normalizarGrupos(grupos);
  if (mensaje) {
    mensaje.textContent =
      normalizados.length === 0 ? 'No tenés grupos todavía.' : '';
  }
  for (const grupo of normalizados) {
    lista.appendChild(crearTarjetaGrupo(grupo));
  }
  return normalizados;
}

function mostrarErrorGrupos() {
  const lista = document.getElementById('listaGrupos');
  const mensaje = document.getElementById('estadoListaGrupos');
  const reintentar = document.getElementById('botonReintentarGrupos');
  if (lista) lista.innerHTML = '';
  if (mensaje) mensaje.textContent = 'No se pudieron cargar los grupos.';
  if (reintentar) reintentar.hidden = false;
}

async function cargarGrupos() {
  const lista = document.getElementById('listaGrupos');
  const mensaje = document.getElementById('estadoListaGrupos');
  const reintentar = document.getElementById('botonReintentarGrupos');
  if (reintentar) reintentar.hidden = true;
  if (lista) lista.innerHTML = '';
  if (mensaje) mensaje.textContent = 'Cargando grupos...';

  const token = tokenActividadGrupos();
  if (!token) {
    mostrarErrorGrupos();
    return [];
  }
  try {
    const respuesta = await fetch(`${ROOT_URL}/api/groups/mine`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) {
      mostrarErrorGrupos();
      return [];
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      mostrarErrorGrupos();
      return [];
    }
    return renderizarGrupos(datos);
  } catch (err) {
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[actividadGrupos] GET groups/mine falló: ${detalle}`);
    mostrarErrorGrupos();
    return [];
  }
}

function inicializarControlesActividad() {
  const toggle = document.getElementById('toggleEliminadosGrupo');
  if (toggle) {
    toggle.addEventListener('change', () => {
      if (grupoDetalleActual) cargarDetalleGrupo(grupoDetalleActual);
    });
  }
  const volver = document.getElementById('volverListaGrupos');
  if (volver) volver.addEventListener('click', volverListaActividadGrupos);
  document.addEventListener('visibilitychange', manejarVisibilidadProgresoActividad);
  inicializarChatActividad();
}

function inicializarVisorFotoEquipo() {
  visorFotoEquipo = document.getElementById('visorFotoEquipo');
  imagenVisorFotoEquipo = document.getElementById('imagenVisorFotoEquipo');
  botonCerrarVisorFoto = document.getElementById('cerrarVisorFotoEquipo');
  if (!visorFotoEquipo || !imagenVisorFotoEquipo) return;
  if (botonCerrarVisorFoto) {
    botonCerrarVisorFoto.addEventListener('click', cerrarVisorFotoEquipo);
  }
  visorFotoEquipo.addEventListener('click', (evento) => {
    if (evento && evento.target === visorFotoEquipo) cerrarVisorFotoEquipo();
  });
  document.addEventListener('keydown', (evento) => {
    if (!evento || evento.key !== 'Escape') return;
    if (!visorFotoEquipo.classList.contains('hidden')) cerrarVisorFotoEquipo();
  });
}

inicializarModalesEliminar();
inicializarControlesActividad();
inicializarVisorFotoEquipo();
inicializarModalIntegrantes();

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pagehide', () => {
    generacionDetalleActividad += 1;
    detenerProgresoActividad();
    detenerRefrescoDetalleActividad();
    detenerStreamMensajesActividad();
  });
  window.addEventListener('DOMContentLoaded', () => {
    const reintentarGrupos = document.getElementById('botonReintentarGrupos');
    if (reintentarGrupos) reintentarGrupos.addEventListener('click', cargarGrupos);
    const reintentarDetalle = document.getElementById('botonReintentarDetalle');
    if (reintentarDetalle) {
      reintentarDetalle.addEventListener('click', () => {
        if (grupoDetalleActual) cargarDetalleGrupo(grupoDetalleActual);
      });
    }
    cargarGrupos();
  });
}
