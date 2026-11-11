const ZONA_ACTIVIDAD_GRUPOS = 'America/Argentina/Buenos_Aires';

let grupoDetalleActual = null;

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

function nombreEquipoActividad(equipo) {
  if (equipo && typeof equipo === 'object') {
    return equipo.nombre || equipo.name || equipo.id || 'Equipo';
  }
  return equipo == null ? '' : String(equipo);
}

function crearItemEquipo(equipo) {
  const item = document.createElement('div');
  item.className = 'grupo-equipo';

  const foto = equipo && typeof equipo === 'object' ? equipo.foto : null;
  if (foto != null && foto !== '') {
    const imagen = document.createElement('img');
    imagen.className = 'grupo-equipo-foto';
    imagen.src = foto;
    imagen.alt = `Foto de ${nombreEquipoActividad(equipo)}`;
    item.appendChild(imagen);
  } else {
    const marcador = document.createElement('span');
    marcador.className = 'grupo-equipo-placeholder';
    marcador.setAttribute('aria-hidden', 'true');
    item.appendChild(marcador);
  }

  item.appendChild(
    crearTextoActividad('grupo-equipo-nombre', nombreEquipoActividad(equipo), 'span')
  );
  return item;
}

function crearTarjetaMiembro(miembro, esVencido) {
  const datos = miembro && typeof miembro === 'object' ? miembro : {};
  const tarjeta = document.createElement('div');
  tarjeta.className = `grupo-miembro-card${esVencido ? ' grupo-miembro-card-vencido' : ''}`;

  const cabecera = document.createElement('div');
  cabecera.className = 'grupo-miembro-cabecera';
  cabecera.appendChild(
    crearTextoActividad('grupo-miembro-usuario', datos.usuario || 'Usuario', 'strong')
  );
  cabecera.appendChild(
    crearTextoActividad('grupo-miembro-actividad', datos.actividad || 'Sin actividad', 'span')
  );
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

  tarjeta.appendChild(
    crearTextoActividad(
      'grupo-miembro-horas',
      `Inicio: ${formatearHoraActividad(datos.inicio)} · Fin previsto: ${formatearHoraActividad(
        datos.finPrevisto
      )}`
    )
  );

  const progreso = calcularProgreso(datos.inicio, datos.finPrevisto, datos.fin, esVencido);
  const barra = document.createElement('div');
  barra.className = 'grupo-progreso';
  barra.setAttribute('role', 'progressbar');
  barra.setAttribute('aria-valuemin', '0');
  barra.setAttribute('aria-valuemax', '100');
  barra.setAttribute('aria-valuenow', String(Math.round(progreso)));
  const relleno = document.createElement('div');
  relleno.className = 'grupo-progreso-barra';
  relleno.style.width = `${progreso}%`;
  barra.appendChild(relleno);
  tarjeta.appendChild(barra);

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
  tarjeta.appendChild(bloqueEquipos);

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
  const filaTelefono = document.createElement('div');
  filaTelefono.className = 'grupo-telefono';
  filaTelefono.appendChild(botonTelefono);
  filaTelefono.appendChild(telefono);
  tarjeta.appendChild(filaTelefono);

  return tarjeta;
}

function renderizarMiembrosEnLista(lista, miembros, esVencido) {
  if (!lista) return;
  lista.innerHTML = '';
  if (!Array.isArray(miembros) || miembros.length === 0) {
    lista.appendChild(crearTextoActividad('grupo-actividad-vacio', 'Sin registros.'));
    return;
  }
  for (const miembro of miembros) {
    lista.appendChild(crearTarjetaMiembro(miembro, esVencido));
  }
}

function renderizarDetalleActividad(datos) {
  const estado = normalizarEstadoActividad(datos);
  renderizarMiembrosEnLista(document.getElementById('listaVencidos'), estado.vencidos, true);
  renderizarMiembrosEnLista(document.getElementById('listaEnCurso'), estado.enCurso, false);
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
  const mensaje = document.getElementById('estadoDetalleActividad');
  const reintentar = document.getElementById('botonReintentarDetalle');
  if (reintentar) reintentar.hidden = true;
  if (mensaje) mensaje.textContent = 'Cargando actividad...';
  const groupId = grupo && (grupo._id || grupo.id || grupo.groupId);
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
    const respuesta = await fetch(
      `${ROOT_URL}/api/groups/${encodeURIComponent(groupId)}/activity-state`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    );
    if (!respuesta.ok) {
      mostrarErrorDetalleActividad();
      return null;
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      mostrarErrorDetalleActividad();
      return null;
    }
    return renderizarDetalleActividad(datos);
  } catch (err) {
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
  grupoDetalleActual = null;
  const vistaLista = document.getElementById('vistaListaActividadGrupos');
  const vistaDetalle = document.getElementById('vistaDetalleActividadGrupos');
  if (vistaLista) vistaLista.hidden = false;
  if (vistaDetalle) vistaDetalle.hidden = true;
}

function crearTarjetaGrupo(grupo) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'perfil grupo-actividad-card';

  const contenido = document.createElement('div');
  contenido.className = 'containerPerfil';

  const icono = document.createElement('img');
  icono.className = 'encabezado';
  icono.src = '../imagenes/amigosSinFondoBlanco.png';
  icono.alt = '';
  contenido.appendChild(icono);

  const textos = document.createElement('div');
  textos.className = 'msj-fila-textos';
  textos.appendChild(
    crearTextoActividad('opciones', (grupo && grupo.name) || '(sin nombre)', 'div')
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

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('DOMContentLoaded', () => {
    const reintentarGrupos = document.getElementById('botonReintentarGrupos');
    if (reintentarGrupos) reintentarGrupos.addEventListener('click', cargarGrupos);
    const reintentarDetalle = document.getElementById('botonReintentarDetalle');
    if (reintentarDetalle) {
      reintentarDetalle.addEventListener('click', () => {
        if (grupoDetalleActual) cargarDetalleGrupo(grupoDetalleActual);
      });
    }
    const volver = document.getElementById('volverListaGrupos');
    if (volver) volver.addEventListener('click', volverListaActividadGrupos);
    cargarGrupos();
  });
}
