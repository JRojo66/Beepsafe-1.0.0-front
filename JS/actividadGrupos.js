const ZONA_ACTIVIDAD_GRUPOS = 'America/Argentina/Buenos_Aires';
const INTERVALO_PROGRESO_ACTIVIDAD_MS = 10000;
const INTERVALO_REFRESCO_DETALLE_ACTIVIDAD_MS = 60000;

let grupoDetalleActual = null;
let intervaloProgresoActividad = null;
let intervaloRefrescoDetalleActividad = null;
let refrescoDetalleActividadEnCurso = false;
let generacionDetalleActividad = 0;

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

function tokenActividadGrupos() {
  try {
    return localStorage.getItem('token') || '';
  } catch (err) {
    return '';
  }
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
  const estado = normalizarEstadoActividad(datos);
  renderizarMiembrosEnLista(document.getElementById('listaVencidos'), estado.vencidos, true);
  renderizarMiembrosEnLista(
    document.getElementById('listaEnCurso'),
    estado.enCurso,
    false,
    true
  );
  renderizarMiembrosEnLista(document.getElementById('listaTerminados'), estado.terminados, false);

  const mensaje = document.getElementById('estadoDetalleActividad');
  const reintentar = document.getElementById('botonReintentarDetalle');
  if (reintentar) reintentar.hidden = true;
  const vacio =
    estado.vencidos.length === 0 &&
    estado.enCurso.length === 0 &&
    estado.terminados.length === 0;
  if (mensaje) {
    mensaje.textContent = vacio ? 'No hay actividad registrada para este grupo.' : '';
  }
  iniciarProgresoActividad();
  iniciarRefrescoDetalleActividad();
  return estado;
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
    const respuesta = await fetch(urlEstadoActividadGrupo(groupId, incluirEliminados), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
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
    return renderizarDetalleActividad(datos);
  } catch (err) {
    if (generacion !== generacionDetalleActividad) return null;
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[actividadGrupos] GET activity-state falló: ${detalle}`);
    mostrarErrorDetalleActividad();
    return null;
  }
}

function abrirDetalleGrupo(grupo) {
  grupoDetalleActual = grupo;
  const vistaLista = document.getElementById('vistaListaActividadGrupos');
  const vistaDetalle = document.getElementById('vistaDetalleActividadGrupos');
  const titulo = document.getElementById('tituloDetalleGrupo');
  if (vistaLista) vistaLista.hidden = true;
  if (vistaDetalle) vistaDetalle.hidden = false;
  if (titulo) titulo.textContent = (grupo && grupo.name) || 'Grupo';
  return cargarDetalleGrupo(grupo);
}

function volverListaActividadGrupos() {
  generacionDetalleActividad += 1;
  detenerProgresoActividad();
  detenerRefrescoDetalleActividad();
  grupoDetalleActual = null;
  const toggle = document.getElementById('toggleEliminadosGrupo');
  if (toggle) toggle.checked = false;
  const vistaLista = document.getElementById('vistaListaActividadGrupos');
  const vistaDetalle = document.getElementById('vistaDetalleActividadGrupos');
  if (vistaLista) vistaLista.hidden = false;
  if (vistaDetalle) vistaDetalle.hidden = true;
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

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pagehide', () => {
    generacionDetalleActividad += 1;
    detenerProgresoActividad();
    detenerRefrescoDetalleActividad();
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
