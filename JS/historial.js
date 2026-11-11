const LARGO_COMENTARIO_COLAPSADO = 160;
const TIMEOUT_HISTORIAL_MS = 8000;

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

function crearFilaHistorial(registro) {
  const fila = document.createElement('div');
  fila.className = 'containerActividad';

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
  const ordenados = ordenarHistorial(registros);
  if (estado) {
    estado.textContent =
      ordenados.length === 0 ? 'Todavía no tenés actividades registradas.' : '';
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

async function cargarHistorial() {
  const estado = document.getElementById('estadoHistorial');
  const lista = document.getElementById('listaHistorial');
  const reintentar = document.getElementById('botonReintentarHistorial');
  if (reintentar) reintentar.hidden = true;
  if (lista) lista.innerHTML = '';
  if (estado) estado.textContent = 'Cargando historial...';

  const token = tokenHistorial();
  if (!token) {
    mostrarErrorHistorial('No se pudo cargar el historial. Iniciá sesión de nuevo.');
    return [];
  }

  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIMEOUT_HISTORIAL_MS);
  try {
    const respuesta = await fetch(`${ROOT_URL}/api/activity-logs`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controlador.signal,
    });
    if (!respuesta.ok) {
      mostrarErrorHistorial('No se pudo cargar el historial.');
      return [];
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      mostrarErrorHistorial('No se pudo leer el historial.');
      return [];
    }
    return renderizarHistorial(normalizarRegistros(datos));
  } catch (err) {
    const detalle = err && err.message ? err.message : String(err);
    console.error(`[historial] GET activity-logs falló: ${detalle}`);
    mostrarErrorHistorial('No se pudo cargar el historial.');
    return [];
  } finally {
    clearTimeout(reloj);
  }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('DOMContentLoaded', () => {
    const reintentar = document.getElementById('botonReintentarHistorial');
    if (reintentar) reintentar.addEventListener('click', cargarHistorial);
    cargarHistorial();
  });
}
