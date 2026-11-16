const LARGO_COMENTARIO_COLAPSADO = 160;
const TIMEOUT_HISTORIAL_MS = 8000;
const TEXTO_VACIO_HISTORIAL = 'Sin actividades registradas.';

let modalEliminarActividad = null;
let modalConfirmarEliminarActividad = null;
let estadoAccionHistorial = null;
let registroPendienteEliminar = null;
let filaPendienteEliminar = null;
let modalesHistorialCableados = false;

function tokenHistorial() {
  try {
    return localStorage.getItem('token') || '';
  } catch (err) {
    return '';
  }
}

function normalizarRegistros(datos) {
  if (Array.isArray(datos)) return datos;
  if (datos && typeof datos === 'object') {
    for (const clave of ['registros', 'logs', 'activityLogs', 'actividades']) {
      if (Array.isArray(datos[clave])) return datos[clave];
    }
  }
  return [];
}

function valorFecha(valor) {
  if (valor == null || valor === '') return 0;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
}

function fechaOrden(registro) {
  return valorFecha(registro && (registro.fin || registro.inicio));
}

function ordenarHistorial(registros) {
  const lista = Array.isArray(registros) ? registros.slice() : [];
  return lista.sort((a, b) => fechaOrden(b) - fechaOrden(a));
}

function formatearFechaHistorial(valor) {
  if (valor == null || valor === '') return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(fecha);
  } catch (err) {
    return fecha.toLocaleString();
  }
}

function equiposHistorial(equipos) {
  if (Array.isArray(equipos)) {
    return equipos
      .map((equipo) => {
        if (equipo && typeof equipo === 'object') {
          return equipo.nombre || equipo.name || equipo.id || '';
        }
        return equipo;
      })
      .filter(Boolean)
      .join(', ');
  }
  return equipos == null ? '' : String(equipos);
}

function crearTextoHistorial(clase, texto, tag = 'p') {
  const elemento = document.createElement(tag);
  elemento.className = clase;
  elemento.textContent = texto;
  return elemento;
}

function idRegistroHistorial(registro) {
  return registro && (registro._id || registro.id);
}

function registroEliminado(registro) {
  return Boolean(
    registro &&
      (registro.eliminado === true ||
        registro.deleted === true ||
        registro.estado === 'eliminado')
  );
}

function mostrarErrorAccionHistorial(mensaje) {
  if (!estadoAccionHistorial) return;
  estadoAccionHistorial.textContent = mensaje;
}

function limpiarErrorAccionHistorial() {
  if (estadoAccionHistorial) estadoAccionHistorial.textContent = '';
}

function crearFilaHistorial(registro) {
  const eliminado = registroEliminado(registro);
  const fila = document.createElement('div');
  fila.className = `containerActividad${eliminado ? ' historial-eliminada' : ''}`;

  const acciones = document.createElement('div');
  acciones.className = 'historial-acciones';
  if (eliminado) {
    acciones.appendChild(crearTextoHistorial('historial-eliminada-label', 'Eliminada', 'span'));
  }
  const id = idRegistroHistorial(registro);
  if (id) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = eliminado ? 'historial-restaurar-boton' : 'historial-eliminar-boton';
    boton.textContent = eliminado ? 'Restaurar' : 'Eliminar';
    boton.addEventListener('click', () => {
      if (eliminado) {
        restaurarActividad(registro, boton);
      } else {
        abrirModalEliminarActividad(registro, fila);
      }
    });
    acciones.appendChild(boton);
  }
  if (eliminado || id) fila.appendChild(acciones);

  const cabecera = document.createElement('div');
  cabecera.className = 'subActividad';
  cabecera.appendChild(crearTextoHistorial('fechaActividad', registro.usuario || 'Usuario'));
  cabecera.appendChild(
    crearTextoHistorial(
      'fechaActividad',
      `${formatearFechaHistorial(registro.inicio)} — ${formatearFechaHistorial(registro.fin)}`
    )
  );
  fila.appendChild(cabecera);

  fila.appendChild(
    crearTextoHistorial(
      'actividad',
      registro.actividad ? String(registro.actividad).toUpperCase() : 'Sin actividad'
    )
  );

  const equipos = equiposHistorial(registro.equipos);
  fila.appendChild(crearTextoHistorial('historial-equipos', `Equipos: ${equipos || 'Sin equipo'}`));

  const comentarios = typeof registro.comentarios === 'string' ? registro.comentarios.trim() : '';
  if (comentarios) {
    if (comentarios.length > LARGO_COMENTARIO_COLAPSADO) {
      const detalles = document.createElement('details');
      detalles.className = 'historial-comentarios';
      const resumen = document.createElement('summary');
      resumen.textContent = 'Comentarios';
      detalles.appendChild(resumen);
      detalles.appendChild(crearTextoHistorial('comentariosActividad', comentarios));
      fila.appendChild(detalles);
    } else {
      fila.appendChild(crearTextoHistorial('comentariosActividad', comentarios));
    }
  }

  fila.appendChild(crearTextoHistorial('breakVioleta', '', 'div'));
  return fila;
}

function renderizarHistorial(registros) {
  const lista = document.getElementById('listaHistorial');
  const estado = document.getElementById('estadoHistorial');
  const reintentar = document.getElementById('botonReintentarHistorial');
  if (!lista) return [];
  lista.innerHTML = '';
  if (reintentar) reintentar.hidden = true;
  limpiarErrorAccionHistorial();
  const ordenados = ordenarHistorial(registros);
  if (estado) {
    estado.textContent = ordenados.length === 0 ? TEXTO_VACIO_HISTORIAL : '';
  }
  for (const registro of ordenados) {
    lista.appendChild(crearFilaHistorial(registro));
  }
  return ordenados;
}

function mostrarErrorHistorial(mensaje) {
  const lista = document.getElementById('listaHistorial');
  const estado = document.getElementById('estadoHistorial');
  const reintentar = document.getElementById('botonReintentarHistorial');
  if (lista) lista.innerHTML = '';
  if (estado) estado.textContent = mensaje;
  if (reintentar) reintentar.hidden = false;
}

async function leerErrorRespuestaHistorial(respuesta) {
  try {
    const datos = await respuesta.json();
    if (datos && typeof datos.error === 'string' && datos.error.trim()) {
      return datos.error.trim();
    }
    if (datos && typeof datos.message === 'string' && datos.message.trim()) {
      return datos.message.trim();
    }
  } catch (err) {
    // Se intenta leer como texto abajo.
  }
  try {
    const texto = await respuesta.text();
    if (typeof texto === 'string' && texto.trim()) return texto.trim();
  } catch (err) {
    // Sin cuerpo legible.
  }
  return '';
}

function urlHistorial() {
  const base = `${ROOT_URL}/api/activity-logs`;
  const toggle = document.getElementById('toggleEliminadas');
  return toggle && toggle.checked ? `${base}?incluirEliminados=1` : base;
}

async function cargarHistorial() {
  const estado = document.getElementById('estadoHistorial');
  const lista = document.getElementById('listaHistorial');
  const reintentar = document.getElementById('botonReintentarHistorial');
  const url = urlHistorial();
  if (reintentar) reintentar.hidden = true;
  if (lista) lista.innerHTML = '';
  if (estado) estado.textContent = 'Cargando historial...';
  limpiarErrorAccionHistorial();

  const token = tokenHistorial();
  if (!token) {
    console.error(`[historial] GET ${url} sin token`);
    mostrarErrorHistorial('No se pudo cargar (401): No autenticado.');
    return [];
  }

  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIMEOUT_HISTORIAL_MS);
  try {
    const respuesta = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controlador.signal,
    });
    if (!respuesta.ok) {
      const mensaje = await leerErrorRespuestaHistorial(respuesta);
      console.error(
        `[historial] GET ${url} status=${respuesta.status}${mensaje ? `: ${mensaje}` : ''}`
      );
      mostrarErrorHistorial(
        `No se pudo cargar (${respuesta.status}): ${mensaje || 'Error desconocido'}`
      );
      return [];
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      console.error(
        `[historial] GET ${url} status=${respuesta.status}: respuesta ilegible`
      );
      mostrarErrorHistorial(
        `No se pudo cargar (${respuesta.status}): respuesta ilegible.`
      );
      return [];
    }
    return renderizarHistorial(normalizarRegistros(datos));
  } catch (err) {
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[historial] GET ${url} falló: ${detalle}`);
    mostrarErrorHistorial(`No se pudo cargar: ${detalle}`);
    return [];
  } finally {
    clearTimeout(reloj);
  }
}

function abrirModalEliminarActividad(registro, fila) {
  if (!modalEliminarActividad) return;
  registroPendienteEliminar = registro;
  filaPendienteEliminar = fila;
  limpiarErrorAccionHistorial();
  if (modalConfirmarEliminarActividad) modalConfirmarEliminarActividad.classList.add('hidden');
  modalEliminarActividad.classList.remove('hidden');
  const continuar = document.getElementById('continuarEliminarActividad');
  if (continuar && typeof continuar.focus === 'function') continuar.focus();
}

function abrirModalConfirmarEliminarActividad() {
  if (!modalConfirmarEliminarActividad) return;
  if (modalEliminarActividad) modalEliminarActividad.classList.add('hidden');
  modalConfirmarEliminarActividad.classList.remove('hidden');
  const eliminar = document.getElementById('eliminarActividad');
  if (eliminar && typeof eliminar.focus === 'function') eliminar.focus();
}

function cerrarModalesEliminarActividad() {
  if (modalEliminarActividad) modalEliminarActividad.classList.add('hidden');
  if (modalConfirmarEliminarActividad) modalConfirmarEliminarActividad.classList.add('hidden');
  registroPendienteEliminar = null;
  filaPendienteEliminar = null;
}

function manejarTeclaHistorial(evento) {
  if (!evento || evento.key !== 'Escape') return;
  const abierto =
    (modalEliminarActividad && !modalEliminarActividad.classList.contains('hidden')) ||
    (modalConfirmarEliminarActividad &&
      !modalConfirmarEliminarActividad.classList.contains('hidden'));
  if (abierto) cerrarModalesEliminarActividad();
}

function actualizarVacioHistorial() {
  const lista = document.getElementById('listaHistorial');
  const estado = document.getElementById('estadoHistorial');
  if (!lista) return;
  const vacia =
    typeof lista.childElementCount === 'number'
      ? lista.childElementCount === 0
      : Array.isArray(lista.hijos)
        ? lista.hijos.length === 0
        : !lista.firstChild;
  if (vacia && estado) estado.textContent = TEXTO_VACIO_HISTORIAL;
}

async function confirmarEliminarActividad() {
  const registro = registroPendienteEliminar;
  const fila = filaPendienteEliminar;
  if (!registro || !fila) {
    cerrarModalesEliminarActividad();
    return;
  }
  const id = idRegistroHistorial(registro);
  if (!id) {
    mostrarErrorAccionHistorial('No se pudo eliminar: falta el identificador.');
    cerrarModalesEliminarActividad();
    return;
  }
  const url = `${ROOT_URL}/api/activity-logs/${encodeURIComponent(id)}`;
  const token = tokenHistorial();
  const boton = document.getElementById('eliminarActividad');
  if (boton) boton.disabled = true;
  try {
    const respuesta = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (respuesta.status === 204) {
      cerrarModalesEliminarActividad();
      if (typeof fila.remove === 'function') fila.remove();
      actualizarVacioHistorial();
      return;
    }
    const mensaje = await leerErrorRespuestaHistorial(respuesta);
    console.error(
      `[historial] DELETE ${url} status=${respuesta.status}${mensaje ? `: ${mensaje}` : ''}`
    );
    mostrarErrorAccionHistorial('No se pudo eliminar. Intentá de nuevo.');
    cerrarModalesEliminarActividad();
  } catch (err) {
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[historial] DELETE ${url} falló: ${detalle}`);
    mostrarErrorAccionHistorial('No se pudo eliminar. Intentá de nuevo.');
    cerrarModalesEliminarActividad();
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function restaurarActividad(registro, boton) {
  const id = idRegistroHistorial(registro);
  if (!id) {
    mostrarErrorAccionHistorial('No se pudo restaurar: falta el identificador.');
    return;
  }
  const url = `${ROOT_URL}/api/activity-logs/${encodeURIComponent(id)}/restaurar`;
  const token = tokenHistorial();
  if (boton) boton.disabled = true;
  limpiarErrorAccionHistorial();
  try {
    const respuesta = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (respuesta.status === 200) {
      await cargarHistorial();
      return;
    }
    const mensaje = await leerErrorRespuestaHistorial(respuesta);
    console.error(
      `[historial] PATCH ${url} status=${respuesta.status}${mensaje ? `: ${mensaje}` : ''}`
    );
    mostrarErrorAccionHistorial('No se pudo restaurar. Intentá de nuevo.');
  } catch (err) {
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[historial] PATCH ${url} falló: ${detalle}`);
    mostrarErrorAccionHistorial('No se pudo restaurar. Intentá de nuevo.');
  } finally {
    if (boton) boton.disabled = false;
  }
}

function inicializarModalesHistorial() {
  if (modalesHistorialCableados) return;
  modalEliminarActividad = document.getElementById('modalEliminarActividad');
  modalConfirmarEliminarActividad = document.getElementById('modalConfirmarEliminarActividad');
  if (!modalEliminarActividad || !modalConfirmarEliminarActividad) return;
  estadoAccionHistorial = document.getElementById('estadoAccionHistorial');
  modalesHistorialCableados = true;
  const continuar = document.getElementById('continuarEliminarActividad');
  const cancelar = document.getElementById('cancelarEliminarActividad');
  const cerrar = document.getElementById('cerrarModalEliminarActividad');
  const eliminar = document.getElementById('eliminarActividad');
  const cancelar2 = document.getElementById('cancelarConfirmarEliminarActividad');
  const cerrar2 = document.getElementById('cerrarModalConfirmarEliminarActividad');
  if (continuar) continuar.addEventListener('click', abrirModalConfirmarEliminarActividad);
  if (cancelar) cancelar.addEventListener('click', cerrarModalesEliminarActividad);
  if (cerrar) cerrar.addEventListener('click', cerrarModalesEliminarActividad);
  if (eliminar) eliminar.addEventListener('click', confirmarEliminarActividad);
  if (cancelar2) cancelar2.addEventListener('click', cerrarModalesEliminarActividad);
  if (cerrar2) cerrar2.addEventListener('click', cerrarModalesEliminarActividad);
  document.addEventListener('keydown', manejarTeclaHistorial);
}

inicializarModalesHistorial();

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('DOMContentLoaded', () => {
    const reintentar = document.getElementById('botonReintentarHistorial');
    if (reintentar) reintentar.addEventListener('click', cargarHistorial);
    const toggle = document.getElementById('toggleEliminadas');
    if (toggle) toggle.addEventListener('change', cargarHistorial);
    cargarHistorial();
  });
}
