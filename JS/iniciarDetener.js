// Evita el cache. Es necesario para  para iOS
// document.querySelectorAll('a').forEach(link => {
//     link.addEventListener('click', function (e) {
//         const href = this.getAttribute('href');
//         if (href) {
//             e.preventDefault();
//             window.location.href = href + '?t=' + new Date().getTime(); // evita caché
//         }
//     });
// });


// Clave de persistencia de la última sesión elegida (localStorage)
const CLAVE_ULTIMA_SESION = 'beepsafe_ultima_sesion';
// Clave de la sesión en curso: se persiste al INICIAR y se borra al DETENER
// o al FINALIZAR, para poder reanudarla si la página se recarga (REL-105)
const CLAVE_SESION_EN_CURSO = 'beepsafe_sesion_en_curso';

// Valores por defecto del stepper de Tiempo: 0 días, 3 horas, 0 minutos
// (= 180 minutos, la duración histórica por defecto de la pantalla)
const DIAS_DEFECTO = 0;
const HORAS_DEFECTO = 3;
const MINUTOS_DEFECTO = 0;
// Máximo representable con los selects: 7 días, 23 horas, 59 minutos
const TIEMPO_MAXIMO_SEGUNDOS = 7 * 86400 + 23 * 3600 + 59 * 60;
// Límites de cada campo del stepper de Tiempo (mismos que los viejos selects)
const LIMITE_DIAS = { min: 0, max: 7 };
const LIMITE_HORAS = { min: 0, max: 23 };
const LIMITE_MINUTOS = { min: 0, max: 59 };
// Título del tiempo mientras la función pura no tiene nada que resumir
const TITULO_TIEMPO = 'Tiempo';
// Placeholders de las filas de valor (las cabeceras son estáticas en el HTML)
const TEXTO_SIN_ACTIVIDAD = 'Sin actividad';
const TEXTO_SIN_ACTIVIDADES = 'Sin actividades';
const TEXTO_SIN_EQUIPO = 'Sin equipo';
// La fila de valor de Tiempo muestra "0h" cuando todo el stepper está en cero
const TEXTO_TIEMPO_EN_CERO = '0h';
// Mensaje de la fila de valor cuando el fetch de actividades FALLÓ: distinto
// de "Sin actividades" (ese es una cuenta vacía real) para que el modo
// degradado no sea indistinguible de una cuenta sin datos (RES-001)
const TEXTO_ERROR_ACTIVIDADES = 'No se pudieron cargar las actividades';

// Timeout por petición de red (mismo patrón de 8000 ms que ya usaba el fetch
// de sessions/current) y tope de intentos: 1 fallo -> 1 reintento. Acota el
// tiempo hasta que la UI queda usable y garantiza que nada queda colgado sin
// límite (RES-002 / RES-003)
const TIMEOUT_PETICION_MS = 8000;
const MAX_INTENTOS_PETICION = 2;
// Tope de espera al DETENER cuando el POST de creación de sesión sigue en vuelo:
// acota cuánto puede demorar el stop sin dejar la UI colgada (REL-002)
const TIMEOUT_ESPERA_SESION_MS = 10000;
// Aviso visible cuando la sesión no se pudo registrar en el backend (REL-001)
const TEXTO_SESION_NO_REGISTRADA =
  'El contador va a correr, pero no se enviará la alarma automática porque no se pudo registrar la sesión.';

// Ubicación del dispositivo: se captura al INICIAR y se refresca cada 5 min
// solo con la página visible. Se envía en el alta y en PATCH; nunca en el FIN.
const INTERVALO_UBICACION_MS = 5 * 60 * 1000;
const OPCIONES_UBICACION = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

// Pre-aviso (blink + beep) y polling de confirmación de la alarma
const UMBRAL_PREAVISO_MAXIMO_SEGUNDOS = 300;
const FRECUENCIA_BEEP_HZ = 880;
const DURACION_BEEP_SEGUNDOS = 0.2;
const INTERVALO_BEEP_MS = 2000;
const GANANCIA_BEEP = 0.2;
const INTERVALO_POLL_ALARMA_MS = 10000;
const TEXTO_CANCELACION_ALARMA =
  'Estoy bien! Solo no llegué a cancelar la alarma a tiempo.';

// Textos manuales de inicio/fin. Ya no los manda la API: el usuario los
// comparte desde su propio WhatsApp con el panel "Avisar a mis contactos".
const ZONA_HORARIA_AVISOS = 'America/Argentina/Buenos_Aires';
const CLAVE_MENSAJES_AVISOS = 'beepsafe_mensajes';
const VALORES_AVISO_RESPALDO = {
  contacto: 'María',
  usuario: 'Marcelo',
  actividad: 'windsurf',
  hora: '19:00',
};

// Mapa actividad -> imagen de imagenes/. Las claves están normalizadas:
// minúsculas, sin acentos y sin espacios extra.
const IMAGEN_POR_ACTIVIDAD = {
  windsurf: 'IlustracionWindsurf.png',
  kitesurf: 'Jetski.png',
  surf: 'Surf.png',
  surfista: 'Surf.png',
  sup: 'SUP.png',
  paddle: 'SUP.png',
  paddleboard: 'SUP.png',
  jetski: 'Jetski.png',
  motoacuatica: 'Jetski.png',
};
const IMAGENES_POR_DEFECTO = [
  'IlustracionWindsurf.png',
  'Surf.png',
  'SUP.png',
  'Jetski.png',
];
const RUTA_IMAGENES = '../imagenes/';

// Estado de la UI de los desplegables: valores elegidos (la fuente de verdad
// de los disparadores custom; ya no hay <select> nativos)
let valorActividad = '';
// Selección múltiple y ordenada de equipos de la actividad elegida
let equiposSeleccionados = [];
let tiempoDias = DIAS_DEFECTO;
let tiempoHoras = HORAS_DEFECTO;
let tiempoMinutos = MINUTOS_DEFECTO;

// Panel desplegable abierto a este momento ('actividad' | 'equipo' |
// 'tiempo' | null); solo uno puede estar abierto a la vez
let panelAbierto = null;

// true mientras la sesión corre: los cuatro triggers quedan bloqueados (REL-103)
let controlesBloqueados = false;

// Estado compartido de la sesión seleccionada
const estadoSesion = {
  actividad: '',
  equipo: [], // 0-N nombres elegidos, en orden de selección
  tiempoSegundos: DIAS_DEFECTO * 86400 + HORAS_DEFECTO * 3600 + MINUTOS_DEFECTO * 60,
};

// Lista de actividades del usuario: [{ name, equipment? }]
let actividades = [];

// true cuando cargarActividades terminó (aunque sea en modo degradado);
// hasta entonces INICIAR no debe persistir nada (REL-101). Se asienta en
// TODOS los caminos de la carga, incluso si algo lanza (RES-002)
let cargaCompleta = false;

// true cuando la carga de actividades falló (error/timeout/agotar reintentos
// o falta de email para armar la URL): la fila de valor muestra
// TEXTO_ERROR_ACTIVIDADES en vez de "Sin actividades" (RES-001)
let cargaActividadesFallida = false;

// Email del usuario autenticado: namespace de las claves de localStorage
// para no mezclar sesiones de usuarios distintos en el mismo navegador (REL-106)
let emailSesion = '';

// Nombre visible del usuario para los textos de WhatsApp (fallback: Marcelo)
let nombreUsuarioAvisos = '';

// Contactos que pueden recibir los avisos manuales de inicio/fin
let contactosAvisos = [];

// Panel "Mandar WhatsApp de inicio/fin": tipo visible, texto de "Compartir…"
// y contactos ya abiertos (para auto-ocultar cuando se abrieron todos).
let tipoAvisoActual = '';
let textoCompartirActual = '';
let avisosAbiertos = new Set();

// Referencias del DOM
let triggerActividad = null;
let filaValorActividad = null;
let panelActividad = null;
let listaActividad = null;
let triggerEquipo = null;
let filaValorEquipo = null;
let panelEquipo = null;
let listaEquipo = null;
// Botones de la lista de Equipo, en el mismo orden en que se crearon
let opcionesEquipo = [];
let triggerTiempo = null;
let filaValorTiempo = null;
let panelTiempo = null;
let valorDias = null;
let valorHoras = null;
let valorMinutos = null;
let botonDiasMas = null;
let botonDiasMenos = null;
let botonHorasMas = null;
let botonHorasMenos = null;
let botonMinutosMas = null;
let botonMinutosMenos = null;
let botonIniciar = null;
let etiquetaBoton = null;
let etiquetaTiempo = null;
let avisoAlarmaEnviada = null;
let avisoAlarmaDetalle = null;
let avisoAlarmaCancelacion = null;
let listaCancelacionAlarma = null;
let botonCompartirCancelacion = null;
let iconoActividad = null;
let anilloProgreso = null;
let panelAvisos = null;
let tituloAvisos = null;
let listaAvisos = null;
let botonCompartirAviso = null;
let botonCerrarAvisos = null;

// Última posición válida del dispositivo y timer de refresco cada 5 minutos.
let ultimaUbicacion = null;
let temporizadorUbicacion = null;

// Id de la sesión registrada en el backend, para poder detenerla al DETENER.
// Vacío cuando la creación falló o el backend no lo devolvió: no se dispara stop.
let sessionIdEnCurso = '';
// Promesa del POST de creación de sesión en vuelo. Si el usuario DETIENE antes
// de que resuelva, se espera (con tope) para no perder el stop (REL-002).
let promesaSesionEnCurso = null;

// Estado del contador
let circunferenciaAnillo = 0;
let temporizador = null;
let segundosRestantes = estadoSesion.tiempoSegundos;
let totalContador = 0;
let inicioContadorMs = 0; // marca de tiempo del inicio (REL-002)
let estadoContador = 'detenido'; // 'detenido' | 'corriendo' | 'finalizado'

// Audio del pre-aviso y polling post-alarma
let contextoAudio = null;
let temporizadorBeep = null;
let temporizadorAlarma = null;
let alarmaConfirmada = false;

// Normaliza un nombre: minúsculas, sin diacríticos y con espacios simples
function normalizarNombre(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Texto legible de un error para los console.error con prefijo estable
// (AbortError -> "timeout", el resto -> nombre + mensaje)
function mensajeDeError(err) {
  if (!err) return 'error desconocido';
  if (err.name === 'AbortError') return 'timeout (abort)';
  if (err.name && err.message) return `${err.name}: ${err.message}`;
  if (err.message) return err.message;
  return String(err);
}

// Devuelve la imagen de una actividad: coincidencia exacta normalizada,
// luego por palabra (exacta o por prefijo) y, entre las candidatas, gana la
// clave más larga. La palabra exacta tiene prioridad sobre el prefijo: así
// "Surf & Windsurf" elige windsurf (no el primer token "surf"), pero
// "Surf de olas" sigue eligiendo surf. "Windsurfing" matchea "windsurf"
// por prefijo. Sin coincidencia usa una imagen por defecto elegida de forma
// estable con el nombre (mismo nombre -> misma imagen).
function imagenParaActividad(nombre) {
  const normalizado = normalizarNombre(nombre);
  if (!normalizado) return IMAGENES_POR_DEFECTO[0];
  if (Object.prototype.hasOwnProperty.call(IMAGEN_POR_ACTIVIDAD, normalizado)) {
    return IMAGEN_POR_ACTIVIDAD[normalizado];
  }
  const tokens = normalizado.split(/[^a-z0-9]+/).filter(Boolean);
  const exactas = [];
  const porPrefijo = [];
  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(IMAGEN_POR_ACTIVIDAD, token)) {
      exactas.push(token);
    }
    for (const clave of Object.keys(IMAGEN_POR_ACTIVIDAD)) {
      if (clave.startsWith(token) || token.startsWith(clave)) {
        porPrefijo.push(clave);
      }
    }
  }
  const masLarga = (lista) =>
    lista.slice().sort((a, b) => b.length - a.length)[0];
  const mejor = exactas.length > 0 ? masLarga(exactas) : masLarga(porPrefijo);
  if (mejor) {
    return IMAGEN_POR_ACTIVIDAD[mejor];
  }
  // Hash FNV-1a del nombre -> índice estable entre las imágenes por defecto
  let hash = 2166136261;
  for (let i = 0; i < normalizado.length; i++) {
    hash ^= normalizado.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const indice = Math.abs(hash) % IMAGENES_POR_DEFECTO.length;
  return IMAGENES_POR_DEFECTO[indice];
}

// Segundos -> HH:MM:SS; con 24 h o más agrega el prefijo de días: "1d 03:00:00"
// (Nd con N = horas enteras / 24; el resto se muestra como HH:MM:SS)
function formatearTiempo(totalSegundos) {
  const numero = Number(totalSegundos);
  const seguros = Number.isFinite(numero) ? Math.max(0, Math.floor(numero)) : 0;
  const horasTotales = Math.floor(seguros / 3600);
  const dias = Math.floor(horasTotales / 24);
  const horas = horasTotales % 24;
  const minutos = Math.floor((seguros % 3600) / 60);
  const segundos = seguros % 60;
  const hhmmss = [horas, minutos, segundos]
    .map((valor) => String(valor).padStart(2, '0'))
    .join(':');
  return dias > 0 ? `${dias}d ${hhmmss}` : hhmmss;
}

// Resumen compacto del tiempo: omite las unidades en cero
// ("3h", "2h 30m", "1d 3h 15m"); todo en cero -> el título "Tiempo" (la fila
// de valor de Tiempo lo muestra como "0h")
function resumenTiempoCorto(dias, horas, minutos) {
  const partes = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (horas > 0) partes.push(`${horas}h`);
  if (minutos > 0) partes.push(`${minutos}m`);
  return partes.length > 0 ? partes.join(' ') : TITULO_TIEMPO;
}

// Limita un valor a [min, max] (clamp de los steppers de Tiempo)
function limitarRango(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

// Fija el stepper de Tiempo a partir de segundos guardados (división
// entera: días, horas y minutos; los segundos sueltos se descartan)
function fijarTiempoDesdeSegundos(totalSegundos) {
  const numero = Math.max(0, Math.floor(Number(totalSegundos) || 0));
  const seguros = Math.min(TIEMPO_MAXIMO_SEGUNDOS, numero);
  tiempoDias = Math.floor(seguros / 86400);
  tiempoHoras = Math.floor((seguros % 86400) / 3600);
  tiempoMinutos = Math.floor((seguros % 3600) / 60);
}

// Total del stepper de Tiempo en segundos
function segundosDesdeValoresTiempo() {
  return Math.round(tiempoDias * 86400 + tiempoHoras * 3600 + tiempoMinutos * 60);
}

// Construye las opciones de una lista; cada opción es un <button> con su handler.
// Devuelve los botones creados para poder re-marcarlos sin volver a consultar
// el DOM (la selección múltiple de Equipo usa esta referencia)
function poblarListaOpciones(lista, opciones) {
  lista.innerHTML = '';
  const botones = [];
  for (const opcion of opciones) {
    const elemento = document.createElement('button');
    elemento.type = 'button';
    elemento.className = 'opcionDesplegable';
    elemento.textContent = opcion.texto;
    elemento.addEventListener('click', opcion.alElegir);
    lista.appendChild(elemento);
    botones.push(elemento);
  }
  return botones;
}

function poblarListaActividad() {
  // sin actividades no hay nada que elegir: la caja queda deshabilitada y
  // no-interactiva (REL-109; la fila de valor muestra "Sin actividades" si la
  // cuenta está vacía o TEXTO_ERROR_ACTIVIDADES si el fetch falló, RES-001)
  poblarListaOpciones(
    listaActividad,
    actividades.map((actividad) => ({
      texto: actividad.name,
      alElegir: () => manejarSeleccionActividad(actividad.name),
    }))
  );
  actualizarDisponibilidadTriggers();
}

// Equipos con nombre de una actividad (lista vacía si no hay actividad o equipo)
function equiposDeActividad(nombreActividad) {
  const actividad = actividades.find((item) => item.name === nombreActividad);
  return actividad && Array.isArray(actividad.equipment)
    ? actividad.equipment.filter((equipo) => equipo && typeof equipo.name === 'string')
    : [];
}

function poblarListaEquipo(nombreActividad) {
  // sin actividad no hay equipos que mostrar: la caja queda no-interactiva
  // y la fila de valor en "Sin equipo" (REL-109)
  const equipos = equiposDeActividad(nombreActividad);
  // sin dedupe en la lista: cada equipo de la actividad aparece una sola vez y
  // la selección múltiple se marca por nombre con la clase `seleccionada`
  opcionesEquipo = poblarListaOpciones(
    listaEquipo,
    equipos.map((equipo) => ({
      texto: equipo.name,
      alElegir: () => manejarSeleccionEquipo(equipo.name),
    }))
  );
  marcarOpcionesEquipoSeleccionadas();
  actualizarDisponibilidadTriggers();
}

// Re-marca las opciones del panel sin reconstruirlo: mantiene el scroll y el
// estado de cada <button> en sincronía con la selección (multi-select)
function marcarOpcionesEquipoSeleccionadas() {
  for (const opcion of opcionesEquipo) {
    if (equiposSeleccionados.includes(opcion.textContent)) {
      opcion.classList.add('seleccionada');
      opcion.setAttribute('aria-selected', 'true');
    } else {
      opcion.classList.remove('seleccionada');
      opcion.setAttribute('aria-selected', 'false');
    }
  }
}

// Equipos elegidos como array ordenado de 0-N nombres (copia del estado)
function equipoElegido() {
  return equiposSeleccionados.slice();
}

function sincronizarEstadoSesion() {
  estadoSesion.actividad = valorActividad;
  estadoSesion.equipo = equipoElegido();
  estadoSesion.tiempoSegundos = segundosDesdeValoresTiempo();
}

// Habilita o deshabilita cada trigger según el estado de la sesión: todavía sin
// cargar o en modo degradado no hay actividad elegible (REL-109), mientras
// corre la cuenta todos quedan bloqueados (REL-103) y sin actividad elegida no
// hay equipos que mostrar
function actualizarDisponibilidadTriggers() {
  const equiposDisponibles = equiposDeActividad(valorActividad);
  triggerActividad.disabled = controlesBloqueados || !cargaCompleta || actividades.length === 0;
  triggerEquipo.disabled =
    controlesBloqueados || !valorActividad || equiposDisponibles.length === 0;
  triggerTiempo.disabled = controlesBloqueados;
  // la fila de valor se bloquea junto con su cabecera: la caja completa queda
  // no-interactiva (mismo gating, sin lógica nueva)
  filaValorActividad.disabled = triggerActividad.disabled;
  filaValorEquipo.disabled = triggerEquipo.disabled;
  filaValorTiempo.disabled = triggerTiempo.disabled;
}

// Pinta la fila de valor de Equipo: los dos primeros nombres, cada uno en su
// propio <span> y sin contador; la selección completa se conserva en el estado
// (el corte con elipsis de cada línea lo resuelve el CSS)
function renderizarEquipoSeleccionado() {
  const lineas =
    equiposSeleccionados.length === 0
      ? [TEXTO_SIN_EQUIPO]
      : equiposSeleccionados.slice(0, 2);
  filaValorEquipo.innerHTML = '';
  for (const nombre of lineas) {
    const linea = document.createElement('span');
    linea.className = 'lineaEquipo';
    linea.textContent = nombre;
    filaValorEquipo.appendChild(linea);
  }
}

// Actualiza el texto de las cuatro filas de valor (la cabecera es estática:
// siempre muestra el título, nunca lo pisa el valor elegido) y los valores
// visibles del stepper de Tiempo
function refrescarTriggers() {
  // Tres estados distintos en la fila de Actividad (RES-001): fetch fallido ->
  // mensaje de error; cuenta vacía real -> "Sin actividades"; todavía sin
  // cargar -> placeholder. Un fallo de red NUNCA se muestra como cuenta vacía
  let textoActividad = TEXTO_SIN_ACTIVIDAD;
  if (valorActividad) {
    textoActividad = valorActividad;
  } else if (cargaCompleta && cargaActividadesFallida) {
    textoActividad = TEXTO_ERROR_ACTIVIDADES;
  } else if (cargaCompleta && actividades.length === 0) {
    textoActividad = TEXTO_SIN_ACTIVIDADES;
  }
  filaValorActividad.textContent = textoActividad;
  // clase de apoyo para el CSS (wrap del mensaje largo); textContent/classList,
  // nunca innerHTML con strings dinámicos
  if (cargaCompleta && cargaActividadesFallida) {
    filaValorActividad.classList.add('cargaFallida');
  } else {
    filaValorActividad.classList.remove('cargaFallida');
  }
  renderizarEquipoSeleccionado();
  const resumen = resumenTiempoCorto(tiempoDias, tiempoHoras, tiempoMinutos);
  filaValorTiempo.textContent =
    resumen === TITULO_TIEMPO ? TEXTO_TIEMPO_EN_CERO : resumen;
  valorDias.textContent = String(tiempoDias);
  valorHoras.textContent = String(tiempoHoras);
  valorMinutos.textContent = String(tiempoMinutos);
  actualizarDisponibilidadTriggers();
}

// Cierra cualquier panel desplegable abierto (click fuera o segundo click)
function cerrarPaneles() {
  const paneles = [panelActividad, panelEquipo, panelTiempo];
  for (const panel of paneles) {
    if (panel) panel.classList.remove('abierto');
  }
  const triggers = [triggerActividad, triggerEquipo, triggerTiempo];
  for (const trigger of triggers) {
    if (trigger) {
      trigger.classList.remove('activo');
      trigger.setAttribute('aria-expanded', 'false');
    }
  }
  panelAbierto = null;
}

// Devuelve panel y trigger de un desplegable por nombre corto
function elementosPanel(nombre) {
  if (nombre === 'actividad') return { panel: panelActividad, trigger: triggerActividad };
  if (nombre === 'equipo') return { panel: panelEquipo, trigger: triggerEquipo };
  return { panel: panelTiempo, trigger: triggerTiempo };
}

// Abre el panel indicado; si ya estaba abierto lo cierra (toggle del trigger).
// Antes de abrir se cierra cualquier otro: solo un panel a la vez.
function alternarPanel(nombre) {
  if (panelAbierto === nombre) {
    cerrarPaneles();
    return;
  }
  cerrarPaneles();
  const { panel, trigger } = elementosPanel(nombre);
  panelAbierto = nombre;
  panel.classList.add('abierto');
  trigger.classList.add('activo');
  trigger.setAttribute('aria-expanded', 'true');
}

// Un click originado dentro de un panel abierto no debe alternarlo: las
// opciones ya tienen su propio handler y reabrir el panel pisaría el cierre
// que hacen al elegir
function esClickEnPanel(evento) {
  const destino = evento && evento.target;
  return Boolean(
    destino && typeof destino.closest === 'function' && destino.closest('.panelDesplegable')
  );
}

function manejarClickTriggerActividad(evento) {
  if (esClickEnPanel(evento)) return;
  if (triggerActividad.disabled) return;
  alternarPanel('actividad');
}

function manejarClickTriggerEquipo(evento) {
  if (esClickEnPanel(evento)) return;
  if (triggerEquipo.disabled) return;
  alternarPanel('equipo');
}

function manejarClickTriggerTiempo(evento) {
  if (esClickEnPanel(evento)) return;
  if (triggerTiempo.disabled) return;
  alternarPanel('tiempo');
}

function manejarSeleccionActividad(nombre) {
  if (triggerActividad.disabled) return;
  reiniciarSiFinalizado();
  valorActividad = nombre;
  // al cambiar de actividad vuelve el default: se auto-selecciona el primer
  // equipo de la actividad (o queda vacío si no tiene equipos)
  const equipos = equiposDeActividad(nombre);
  equiposSeleccionados = equipos.length > 0 ? [equipos[0].name] : [];
  poblarListaEquipo(nombre);
  cerrarPaneles();
  sincronizarEstadoSesion();
  refrescarTriggers();
  actualizarIconoActividad();
  actualizarVisualizacion();
}

// Click en una opción del panel de Equipo: alterna su pertenencia a la
// selección. El panel queda abierto (multi-select); se cierra con el trigger,
// la fila de valor o un click afuera
function manejarSeleccionEquipo(nombre) {
  if (triggerEquipo.disabled) return;
  reiniciarSiFinalizado();
  const indice = equiposSeleccionados.indexOf(nombre);
  if (indice === -1) {
    equiposSeleccionados.push(nombre);
  } else {
    equiposSeleccionados.splice(indice, 1);
  }
  marcarOpcionesEquipoSeleccionadas();
  sincronizarEstadoSesion();
  refrescarTriggers();
  actualizarVisualizacion();
}

// Un paso del stepper de Tiempo: incrementa o decrementa el campo (clampeado
// a su rango) y recalcula tiempoSegundos. El panel permanece abierto mientras
// se ajusta; solo lo cierra el click afuera o el segundo click en el trigger.
function manejarPasoTiempo(campo, delta) {
  if (triggerTiempo.disabled) return;
  reiniciarSiFinalizado();
  if (campo === 'dias') {
    tiempoDias = limitarRango(tiempoDias + delta, LIMITE_DIAS.min, LIMITE_DIAS.max);
  } else if (campo === 'horas') {
    tiempoHoras = limitarRango(tiempoHoras + delta, LIMITE_HORAS.min, LIMITE_HORAS.max);
  } else if (campo === 'minutos') {
    tiempoMinutos = limitarRango(tiempoMinutos + delta, LIMITE_MINUTOS.min, LIMITE_MINUTOS.max);
  }
  sincronizarEstadoSesion();
  refrescarTriggers();
  actualizarVisualizacion();
}

function actualizarIconoActividad() {
  const archivo = imagenParaActividad(valorActividad);
  iconoActividad.src = `${RUTA_IMAGENES}${archivo}`;
  iconoActividad.alt = `Imagen de ${valorActividad || 'actividad'}`;
}

// Refresca tiempo visible y anillo según el estado del contador
function actualizarVisualizacion() {
  const total = estadoContador === 'detenido' ? estadoSesion.tiempoSegundos : totalContador;
  let restantes;
  if (estadoContador === 'corriendo') {
    restantes = segundosRestantes;
  } else if (estadoContador === 'finalizado') {
    restantes = 0;
  } else {
    restantes = estadoSesion.tiempoSegundos;
  }

  etiquetaTiempo.textContent = formatearTiempo(restantes);

  // 0% transcurrido -> offset = circunferencia (sin rojo)
  // 100% transcurrido -> offset = 0 (anillo rojo completo)
  const transcurrido = total > 0 ? (total - restantes) / total : 0;
  anilloProgreso.style.strokeDashoffset = String(circunferenciaAnillo * (1 - transcurrido));
}

// Namespace de claves por usuario: `base:email` cuando hay sesión conocida,
// o la clave simple cuando la carga fue degradada sin email (REL-106)
function claveConUsuario(base) {
  return emailSesion ? `${base}:${emailSesion}` : base;
}

// Lee una clave cruda sin lanzar: un localStorage bloqueado se loguea en vez de
// romper la carga (RES-001: ningún fallo en silencio)
function obtenerCrudo(clave) {
  try {
    return localStorage.getItem(clave);
  } catch (err) {
    console.error(`[iniciarDetener] localStorage ilegible en ${clave}: ${mensajeDeError(err)}`);
    return null;
  }
}

// JSON -> objeto; null si el payload está corrupto o no es un objeto (loguea
// el motivo para poder diagnosticar la clave problemática)
function leerPayload(crudo, clave) {
  try {
    const parsed = JSON.parse(crudo);
    if (parsed && typeof parsed === 'object') return parsed;
    console.error(`[iniciarDetener] payload inválido en ${clave}: no es un objeto JSON`);
  } catch (err) {
    console.error(`[iniciarDetener] payload ilegible en ${clave}: ${mensajeDeError(err)}`);
  }
  return null;
}

// Variantes alternas a probar cuando la clave actual no tiene datos (RES-004):
// reconcilia el split-brain "simple <-> base:email" que deja un reload con la
// auth caída escrita bajo la otra variante que originó la sesión.
//  - actual namespaceada -> alterna simple (la legada sin email)
//  - actual simple -> alterna namespaceada, si el email se conoce
//  - sin email en esta carga (falló sessions/current) -> única clave
//    namespaceada de esa base en el store; con varias de usuarios distintos no
//    se adivina: se loguea la ambigüedad y no se migra
function clavesAlternativas(base) {
  const actual = claveConUsuario(base);
  if (actual !== base) return [base];
  if (emailSesion) return [`${base}:${emailSesion}`];
  const prefijo = `${base}:`;
  const encontradas = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (clave && clave.startsWith(prefijo)) encontradas.push(clave);
    }
  } catch (err) {
    console.error(`[iniciarDetener] no se pudo enumerar localStorage: ${mensajeDeError(err)}`);
    return [];
  }
  if (encontradas.length === 1) return [encontradas[0]];
  if (encontradas.length > 1) {
    console.error(
      `[iniciarDetener] claves ambiguas bajo "${prefijo}" (${encontradas.length}): no se reconcilia ${base}`
    );
  }
  return [];
}

// Lee `base` reconciliando variantes (RES-004): si la variante actual no tiene
// datos válidos y la alterna sí, migra el payload a la variante actual, borra
// la clave origen y loguea la reconciliación. Los payloads siguen limitados a
// actividad/equipo/tiempoSegundos/inicioContadorMs: nunca tokens ni credenciales
function leerObjetoReconciliado(base) {
  const actual = claveConUsuario(base);
  const crudoActual = obtenerCrudo(actual);
  if (crudoActual) {
    const payload = leerPayload(crudoActual, actual);
    if (payload) return payload;
    // corrupta: se intenta la variante alterna, que al migrar la sobrescribe
  }

  for (const alterna of clavesAlternativas(base)) {
    if (alterna === actual) continue;
    const crudoAlterno = obtenerCrudo(alterna);
    if (!crudoAlterno) continue;
    const payload = leerPayload(crudoAlterno, alterna);
    if (!payload) continue; // inválido: no migrar ni borrar la origen
    try {
      localStorage.setItem(actual, crudoAlterno);
      localStorage.removeItem(alterna);
      console.info(`[iniciarDetener] localStorage reconciliado: ${alterna} -> ${actual}`);
    } catch (err) {
      console.error(
        `[iniciarDetener] no se pudo reconciliar ${alterna} -> ${actual}: ${mensajeDeError(err)}`
      );
    }
    return payload;
  }
  return null;
}

function guardarUltimaSesion() {
  if (!estadoSesion.actividad) return; // nunca pisar una sesión válida con vacía (REL-101)
  try {
    localStorage.setItem(
      claveConUsuario(CLAVE_ULTIMA_SESION),
      JSON.stringify({
        actividad: estadoSesion.actividad,
        equipo: estadoSesion.equipo,
        tiempoSegundos: estadoSesion.tiempoSegundos,
      })
    );
  } catch (err) {
    // localStorage lleno o bloqueado: la sesión no persiste pero la app sigue
    console.error(
      `[iniciarDetener] no se pudo guardar la última sesión: ${mensajeDeError(err)}`
    );
  }
}

function leerUltimaSesion() {
  return leerObjetoReconciliado(CLAVE_ULTIMA_SESION);
}

// Persiste la sesión en curso para poder reanudarla tras un reload (REL-105).
// Incluye el sessionId del backend solo cuando ya se conoce; los payloads
// viejos sin ese campo siguen siendo válidos (no disparan stop).
function guardarSesionEnCurso() {
  try {
    const payload = {
      actividad: estadoSesion.actividad,
      equipo: estadoSesion.equipo,
      tiempoSegundos: estadoSesion.tiempoSegundos,
      inicioContadorMs,
    };
    if (sessionIdEnCurso) payload.sessionId = sessionIdEnCurso;
    if (ultimaUbicacion) {
      payload.ubicacion = { lat: ultimaUbicacion.lat, lng: ultimaUbicacion.lng };
    }
    localStorage.setItem(claveConUsuario(CLAVE_SESION_EN_CURSO), JSON.stringify(payload));
  } catch (err) {
    // localStorage bloqueado: la sesión no sobrevive al reload pero sigue corriendo
    console.error(
      `[iniciarDetener] no se pudo guardar la sesión en curso: ${mensajeDeError(err)}`
    );
  }
}

function quitarSesionEnCurso() {
  try {
    localStorage.removeItem(claveConUsuario(CLAVE_SESION_EN_CURSO));
  } catch (err) {
    console.error(`[iniciarDetener] no se pudo quitar la sesión en curso: ${mensajeDeError(err)}`);
  }
}

// Id de la sesión persistida (si existe). Un payload viejo sin `sessionId` es
// válido: devuelve cadena vacía y DETENER no envía nada.
function leerSessionIdEnCurso() {
  const guardada = leerObjetoReconciliado(CLAVE_SESION_EN_CURSO);
  return guardada && typeof guardada.sessionId === 'string' && guardada.sessionId
    ? guardada.sessionId
    : '';
}

// Restaura una sesión en curso que quedó guardada al recargar la página (REL-105).
// La lectura reconcilia variantes de clave como leerUltimaSesion (RES-004):
// una sesión escrita bajo la otra variante se encuentra, se migra y se reanuda
function reanudarSesionEnCurso() {
  const guardada = leerObjetoReconciliado(CLAVE_SESION_EN_CURSO);
  if (!guardada) return;
  if (typeof guardada.inicioContadorMs !== 'number' || guardada.inicioContadorMs <= 0) return;
  if (typeof guardada.tiempoSegundos !== 'number' || guardada.tiempoSegundos <= 0) return;

  const restantes = Math.max(
    0,
    guardada.tiempoSegundos - Math.floor((Date.now() - guardada.inicioContadorMs) / 1000)
  );

  if (restantes <= 0) {
    // la ventana ya terminó: descartar sin salto a finalizado (REL-105)
    quitarSesionEnCurso();
    return;
  }

  totalContador = guardada.tiempoSegundos;
  segundosRestantes = restantes;
  inicioContadorMs = guardada.inicioContadorMs;
  // recupera el id si la sesión ya se había registrado (payloads viejos: vacío)
  sessionIdEnCurso =
    typeof guardada.sessionId === 'string' && guardada.sessionId ? guardada.sessionId : '';
  ultimaUbicacion = normalizarUbicacion(guardada.ubicacion);
  estadoContador = 'corriendo';
  etiquetaBoton.textContent = 'DETENER';
  fijarTriggersBloqueados(true);
  if (temporizador) clearInterval(temporizador);
  temporizador = setInterval(contarSegundo, 1000);
  if (sessionIdEnCurso) iniciarRefrescoUbicacion();
  actualizarVisualizacion();
}

// Un tiempo guardado es válido si es un entero de segundos mayor que cero
function tiempoValido(tiempoSegundos) {
  return Number.isInteger(tiempoSegundos) && tiempoSegundos > 0;
}

// Restaura la última sesión guardada si su actividad todavía existe
function restaurarUltimaSesion() {
  const guardada = leerUltimaSesion();

  let nombreActividad = '';
  if (actividades.length > 0) {
    if (
      guardada &&
      typeof guardada.actividad === 'string' &&
      actividades.some((item) => item.name === guardada.actividad)
    ) {
      nombreActividad = guardada.actividad;
    } else {
      nombreActividad = actividades[0].name;
    }
    valorActividad = nombreActividad;
  }

  // Equipos guardados: array (formato actual) o string (payloads viejos, que se
  // migran a array de un nombre). Se deduplican preservando el primer orden y
  // se descartan los nombres que ya no existen en la actividad.
  const mismaActividad = Boolean(guardada) && guardada.actividad === nombreActividad;
  let equipoGuardado = [];
  if (mismaActividad && Array.isArray(guardada.equipo)) {
    equipoGuardado = guardada.equipo.filter((nombre) => typeof nombre === 'string' && nombre);
  } else if (mismaActividad && typeof guardada.equipo === 'string' && guardada.equipo) {
    equipoGuardado = [guardada.equipo];
  }

  // el primer nombre repetido gana; el orden de aparición se conserva
  const vistos = new Set();
  equipoGuardado = equipoGuardado.filter((nombre) => {
    if (vistos.has(nombre)) return false;
    vistos.add(nombre);
    return true;
  });

  const equipos = equiposDeActividad(nombreActividad);
  const nombresValidos = equipos.map((equipo) => equipo.name);
  equiposSeleccionados = equipoGuardado.filter((nombre) => nombresValidos.includes(nombre));
  // sin ninguna selección restaurable vuelve el default histórico: el primer
  // equipo de la actividad (o vacío si la actividad no tiene equipos)
  if (equiposSeleccionados.length === 0 && equipos.length > 0) {
    equiposSeleccionados = [equipos[0].name];
  }

  poblarListaEquipo(nombreActividad);

  fijarTiempoDesdeSegundos(
    guardada && tiempoValido(guardada.tiempoSegundos)
      ? guardada.tiempoSegundos
      : DIAS_DEFECTO * 86400 + HORAS_DEFECTO * 3600 + MINUTOS_DEFECTO * 60
  );

  sincronizarEstadoSesion();
  refrescarTriggers();
  actualizarIconoActividad();
  actualizarVisualizacion();
}

// Bloquea o desbloquea los cuatro triggers mientras la cuenta corre: cambiar
// una selección a mitad de cuenta contradiría la UI (REL-103)
function fijarTriggersBloqueados(bloqueados) {
  controlesBloqueados = Boolean(bloqueados);
  if (controlesBloqueados) cerrarPaneles(); // sin paneles abiertos durante la cuenta
  actualizarDisponibilidadTriggers();
}

// ------------------------------------------------- avisos manuales (wa.me)
// Los textos de inicio/fin ya no salen por la API: se componen acá con la
// misma interpolación/fallbacks que usa el preview del editor de mensajes.

function diaAbreviadoAviso(fecha) {
  const formato = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA_AVISOS,
    weekday: 'short',
  });
  return formato.format(fecha).replace(/\./g, '').trim().toLowerCase();
}

function formatearHoraAviso(fecha) {
  try {
    const formato = new Intl.DateTimeFormat('es-AR', {
      timeZone: ZONA_HORARIA_AVISOS,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const partes = formato.formatToParts(fecha);
    const buscar = (tipo) => {
      const parte = partes.find((item) => item.type === tipo);
      return parte ? parte.value : '';
    };
    const dia = diaAbreviadoAviso(fecha);
    let hora = buscar('hour');
    const minuto = buscar('minute');
    if (hora === '24') hora = '00';
    if (dia && hora && minuto) return `${dia} ${hora}:${minuto}`;
  } catch (err) {
    console.error(`[iniciarDetener] no se pudo formatear la hora del aviso: ${mensajeDeError(err)}`);
  }
  return horaAvisoFallback();
}

// Mismo fallback que el preview: día de HOY en Buenos Aires a las 19:00
function horaAvisoFallback() {
  try {
    const dia = diaAbreviadoAviso(new Date());
    if (dia) return `${dia} 19:00`;
  } catch (err) {
    console.error(
      `[iniciarDetener] no se pudo calcular el día del aviso: ${mensajeDeError(err)}`
    );
  }
  return VALORES_AVISO_RESPALDO.hora;
}

function horaPrevistaAviso() {
  const duracion = estadoSesion.tiempoSegundos;
  if (!Number.isFinite(duracion) || duracion <= 0) return horaAvisoFallback();
  const base = inicioContadorMs > 0 ? inicioContadorMs : Date.now();
  return formatearHoraAviso(new Date(base + duracion * 1000));
}

function leerMensajesAvisos() {
  for (const clave of [claveConUsuario(CLAVE_MENSAJES_AVISOS), CLAVE_MENSAJES_AVISOS]) {
    const crudo = obtenerCrudo(clave);
    if (!crudo) continue;
    try {
      const datos = JSON.parse(crudo);
      if (!datos || typeof datos !== 'object') continue;
      if (datos.mensajes && typeof datos.mensajes === 'object') return datos.mensajes;
      return datos;
    } catch (err) {
      console.error(`[iniciarDetener] mensajes ilegibles en ${clave}: ${mensajeDeError(err)}`);
    }
  }
  return {};
}

function mensajeGuardadoAviso(tipo) {
  const mensajes = leerMensajesAvisos();
  return typeof mensajes[tipo] === 'string' ? mensajes[tipo] : '';
}

// Cierra la frase del mensaje personal antes de encadenar la parte fija:
// trim, agrega "." si falta puntuación final y devuelve "" si está vacío
// (así no quedan puntos sueltos ni dobles espacios).
function cerrarFrase(texto) {
  const limpio = typeof texto === 'string' ? texto.trim() : '';
  if (!limpio) return '';
  return /[.!?…]$/.test(limpio) ? limpio : `${limpio}.`;
}

function componerTextoAviso(tipo, contactoNombre, mensaje) {
  const contacto =
    typeof contactoNombre === 'string' && contactoNombre.trim()
      ? contactoNombre.trim()
      : VALORES_AVISO_RESPALDO.contacto;
  const usuario = nombreUsuarioAvisos.trim() || VALORES_AVISO_RESPALDO.usuario;
  const actividad =
    estadoSesion.actividad && estadoSesion.actividad.trim()
      ? estadoSesion.actividad.trim()
      : VALORES_AVISO_RESPALDO.actividad;
  const partes = [];
  if (tipo === 'inicio') {
    partes.push(`Aviso de BeepSafe para ${contacto}: ${usuario} comenzó una sesión de ${actividad}.`);
  } else if (tipo === 'fin') {
    partes.push(`Aviso de BeepSafe para ${contacto}: ${usuario} finalizó su sesión de ${actividad}.`);
  } else {
    return '';
  }
  const limpio = cerrarFrase(mensaje);
  if (limpio) partes.push(limpio);
  if (tipo === 'inicio') {
    partes.push(`Tiene previsto finalizarla el ${horaPrevistaAviso()}.`);
    const ubicacion = urlUbicacionAviso();
    if (ubicacion) partes.push(ubicacion);
  }
  return partes.join(' ');
}

function normalizarContactoAviso(contacto) {
  const origen = contacto && typeof contacto === 'object' ? contacto : {};
  const fuente =
    origen.mensajesPorTipo && typeof origen.mensajesPorTipo === 'object'
      ? origen.mensajesPorTipo
      : null;
  const asignado = (tipo) => (fuente ? fuente[tipo] === true : origen.mensajes === true);
  return {
    nombre: typeof origen.nombre === 'string' ? origen.nombre : String(origen.nombre ?? ''),
    telefono: typeof origen.telefono === 'string' ? origen.telefono : String(origen.telefono ?? ''),
    inicio: asignado('inicio'),
    fin: asignado('fin'),
    alarma: asignado('alarma'),
  };
}

function contactosParaAviso(tipo) {
  if (tipo !== 'inicio' && tipo !== 'fin' && tipo !== 'alarma') return [];
  return contactosAvisos.filter(
    (contacto) => contacto[tipo] === true && contacto.nombre.trim() !== ''
  );
}

function contactosCancelacionAlarma() {
  return contactosParaAviso('alarma').filter(
    (contacto) => soloDigitos(contacto.telefono) !== ''
  );
}

function soloDigitos(telefono) {
  return String(telefono ?? '').replace(/\D/g, '');
}

function construirUrlWhatsapp(telefono, texto) {
  return `https://wa.me/${soloDigitos(telefono)}?text=${encodeURIComponent(texto)}`;
}

function abrirWhatsapp(href) {
  try {
    if (typeof window !== 'undefined' && window && typeof window.open === 'function') {
      window.open(href, '_blank', 'noopener');
      return true;
    }
  } catch (err) {
    console.error(`[iniciarDetener] no se pudo abrir WhatsApp: ${mensajeDeError(err)}`);
  }
  return false;
}

function mostrarToastAviso(mensaje, tipo) {
  try {
    asegurarContenedorToasts();
    if (
      typeof window !== 'undefined' &&
      window.utils &&
      typeof window.utils.showToast === 'function'
    ) {
      window.utils.showToast(mensaje, tipo || 'info');
      return;
    }
    if (typeof showToast === 'function') {
      showToast(mensaje, tipo || 'info');
      return;
    }
    import('../JS/utils.js')
      .then((modulo) => {
        if (modulo && typeof modulo.showToast === 'function') {
          modulo.showToast(mensaje, tipo || 'info');
        }
      })
      .catch(() => {});
  } catch (err) {
    // sin toast disponible: el log de error ya dejó el rastro
  }
}

function copiarTextoAlPortapapeles(texto) {
  const confirmado = () => mostrarToastAviso('Mensaje copiado al portapapeles.', 'success');
  const fallido = () => mostrarToastAviso('No se pudo copiar el mensaje.', 'error');
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      const resultado = navigator.clipboard.writeText(texto);
      if (resultado && typeof resultado.then === 'function') {
        resultado.then(confirmado).catch(fallido);
      } else {
        confirmado();
      }
      return true;
    }
  } catch (err) {
    console.error(`[iniciarDetener] no se pudo copiar el mensaje: ${mensajeDeError(err)}`);
  }
  fallido();
  return false;
}

function compartirTexto(texto) {
  if (!texto) return false;
  if (typeof navigator !== 'undefined' && navigator && typeof navigator.share === 'function') {
    try {
      const resultado = navigator.share({ text: texto });
      if (resultado && typeof resultado.catch === 'function') resultado.catch(() => {});
      return true;
    } catch (err) {
      console.error(`[iniciarDetener] navigator.share falló: ${mensajeDeError(err)}`);
    }
  }
  return copiarTextoAlPortapapeles(texto);
}

function manejarCompartirAviso() {
  return compartirTexto(textoCompartirActual);
}

function manejarCompartirCancelacion() {
  return compartirTexto(TEXTO_CANCELACION_ALARMA);
}

function claveContactoAviso(contacto) {
  return `${contacto.nombre.trim()}|${soloDigitos(contacto.telefono)}`;
}

function cerrarPanelAvisos() {
  if (panelAvisos) panelAvisos.hidden = true;
}

// Auto-ocultado sin timer: cuando se abrió al menos una vez el WhatsApp de
// CADA contacto del panel actual, el panel se esconde solo.
function marcarContactoAvisoAbierto(contacto) {
  avisosAbiertos.add(claveContactoAviso(contacto));
  const contactos = contactosParaAviso(tipoAvisoActual);
  if (contactos.length === 0) return;
  const todos = contactos.every((item) => avisosAbiertos.has(claveContactoAviso(item)));
  if (todos) cerrarPanelAvisos();
}

function renderizarPanelAvisos(tipo) {
  if (tipo !== 'inicio' && tipo !== 'fin') return false;
  if (!panelAvisos || !listaAvisos) return false;
  const contactos = contactosParaAviso(tipo);
  const mensaje = mensajeGuardadoAviso(tipo);
  avisosAbiertos = new Set();
  if (tituloAvisos) {
    tituloAvisos.textContent =
      tipo === 'inicio' ? 'Mandar WhatsApp de inicio' : 'Mandar WhatsApp de fin';
  }
  listaAvisos.innerHTML = '';
  for (const contacto of contactos) {
    const texto = componerTextoAviso(tipo, contacto.nombre, mensaje);
    const href = construirUrlWhatsapp(contacto.telefono, texto);
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'panelAvisosBoton';
    boton.textContent = `Abrir WhatsApp — ${contacto.nombre}`;
    boton.addEventListener('click', () => {
      abrirWhatsapp(href);
      marcarContactoAvisoAbierto(contacto);
    });
    listaAvisos.appendChild(boton);
  }
  const contactoCompartir =
    contactos.length > 0 ? contactos[0].nombre : VALORES_AVISO_RESPALDO.contacto;
  textoCompartirActual = componerTextoAviso(tipo, contactoCompartir, mensaje);
  tipoAvisoActual = tipo;
  panelAvisos.hidden = false;
  return true;
}

async function cargarContactosAvisos() {
  const url = `${ROOT_URL}/api/contacts`;
  const token = localStorage.getItem('token');
  if (!token) {
    console.error(`[iniciarDetener] GET contacts sin token: ${url}`);
    contactosAvisos = [];
    return contactosAvisos;
  }
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) {
      console.error(`[iniciarDetener] GET contacts falló: ${url} status=${respuesta.status}`);
      contactosAvisos = [];
      return contactosAvisos;
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      console.error(
        `[iniciarDetener] contacts devolvió JSON ilegible: ${url} — ${mensajeDeError(err)}`
      );
      contactosAvisos = [];
      return contactosAvisos;
    }
    const lista = datos && Array.isArray(datos.contactos) ? datos.contactos : [];
    contactosAvisos = lista
      .filter(
        (contacto) =>
          contacto && typeof contacto === 'object' && typeof contacto.nombre === 'string'
      )
      .map(normalizarContactoAviso);
    if (tipoAvisoActual) renderizarPanelAvisos(tipoAvisoActual);
    return contactosAvisos;
  } catch (err) {
    console.error(`[iniciarDetener] GET contacts falló: ${url} — ${mensajeDeError(err)}`);
    contactosAvisos = [];
    return contactosAvisos;
  }
}

// ------------------------------------------------------------- ubicación GPS

function geolocalizacionDisponible() {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator &&
      navigator.geolocation &&
      typeof navigator.geolocation.getCurrentPosition === 'function'
  );
}

function normalizarUbicacion(valor) {
  if (!valor || typeof valor !== 'object') return null;
  const lat = Number(valor.lat);
  const lng = Number(valor.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function ubicacionDesdePosicion(posicion) {
  const coords = posicion && posicion.coords ? posicion.coords : null;
  if (!coords) return null;
  return normalizarUbicacion({ lat: coords.latitude, lng: coords.longitude });
}

// Resuelve siempre (null si no hay API, error, permiso denegado o timeout):
// un fallo de ubicación nunca bloquea el INICIAR ni muestra un toast de error.
function obtenerUbicacionActual() {
  return new Promise((resolve) => {
    if (!geolocalizacionDisponible()) {
      resolve(null);
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (posicion) => resolve(ubicacionDesdePosicion(posicion)),
        () => resolve(null),
        OPCIONES_UBICACION
      );
    } catch (err) {
      console.error(`[iniciarDetener] geolocation falló: ${mensajeDeError(err)}`);
      resolve(null);
    }
  });
}

function detenerRefrescoUbicacion() {
  if (temporizadorUbicacion) {
    clearInterval(temporizadorUbicacion);
    temporizadorUbicacion = null;
  }
}

function iniciarRefrescoUbicacion() {
  detenerRefrescoUbicacion();
  if (!geolocalizacionDisponible()) return; // sin API: no-op silencioso
  temporizadorUbicacion = setInterval(refrescarUbicacion, INTERVALO_UBICACION_MS);
}

async function actualizarUbicacionEnBackend(sessionId, ubicacion) {
  const url = `${ROOT_URL}/api/message-events/session/${encodeURIComponent(sessionId)}/ubicacion`;
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ lat: ubicacion.lat, lng: ubicacion.lng }),
    });
    if (!respuesta.ok) {
      console.error(
        `[iniciarDetener] PATCH ubicación falló: ${url} status=${respuesta.status}`
      );
    }
  } catch (err) {
    console.error(`[iniciarDetener] PATCH ubicación falló: ${url} — ${mensajeDeError(err)}`);
  }
}

function refrescarUbicacion() {
  // Solo se refresca con la pestaña visible; oculto se saltea sin cortar el timer
  if (typeof document !== 'undefined' && document && document.visibilityState !== 'visible') {
    return;
  }
  const sessionId = sessionIdEnCurso;
  if (!sessionId) return;
  obtenerUbicacionActual().then((ubicacion) => {
    if (!ubicacion) return;
    if (estadoContador !== 'corriendo' || sessionIdEnCurso !== sessionId) return;
    ultimaUbicacion = ubicacion;
    guardarSesionEnCurso();
    actualizarUbicacionEnBackend(sessionId, ubicacion);
  });
}

function urlUbicacionAviso() {
  if (!ultimaUbicacion) return '';
  return `Ubicación: https://www.google.com/maps?q=${ultimaUbicacion.lat},${ultimaUbicacion.lng}`;
}

// ------------------------------------------- pre-aviso y alarma enviada

function umbralPreaviso(duracionSegundos) {
  const duracion = Number(duracionSegundos);
  if (!Number.isFinite(duracion) || duracion <= 0) return 0;
  return Math.min(UMBRAL_PREAVISO_MAXIMO_SEGUNDOS, duracion * 0.10);
}

// El AudioContext debe crearse/reanudarse dentro del gesto de INICIAR:
// los navegadores bloquean audio creado fuera de un click del usuario.
function prepararAudio() {
  if (typeof window === 'undefined' || !window) return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return contextoAudio; // sin Web Audio: skip silencioso
  if (!contextoAudio) {
    try {
      contextoAudio = new Ctor();
    } catch (err) {
      console.error(`[iniciarDetener] no se pudo crear AudioContext: ${mensajeDeError(err)}`);
      return null;
    }
  }
  if (
    contextoAudio &&
    contextoAudio.state === 'suspended' &&
    typeof contextoAudio.resume === 'function'
  ) {
    try {
      const reanudado = contextoAudio.resume();
      if (reanudado && typeof reanudado.catch === 'function') reanudado.catch(() => {});
    } catch (err) {
      console.error(`[iniciarDetener] no se pudo reanudar AudioContext: ${mensajeDeError(err)}`);
    }
  }
  return contextoAudio;
}

function emitirBeep() {
  if (!contextoAudio || typeof contextoAudio.createOscillator !== 'function') return;
  try {
    const oscilador = contextoAudio.createOscillator();
    const ganancia = contextoAudio.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.value = FRECUENCIA_BEEP_HZ;
    ganancia.gain.value = GANANCIA_BEEP;
    oscilador.connect(ganancia);
    ganancia.connect(contextoAudio.destination);
    const ahora = contextoAudio.currentTime || 0;
    oscilador.start(ahora);
    oscilador.stop(ahora + DURACION_BEEP_SEGUNDOS);
  } catch (err) {
    console.error(`[iniciarDetener] no se pudo emitir el beep: ${mensajeDeError(err)}`);
  }
}

function iniciarBeep() {
  if (!contextoAudio || temporizadorBeep) return;
  emitirBeep();
  temporizadorBeep = setInterval(emitirBeep, INTERVALO_BEEP_MS);
}

function detenerBeep() {
  if (temporizadorBeep) {
    clearInterval(temporizadorBeep);
    temporizadorBeep = null;
  }
}

function activarAlertaPrevia() {
  if (etiquetaTiempo) etiquetaTiempo.classList.add('parpadeando');
  iniciarBeep();
}

function detenerAlertaPrevia() {
  if (etiquetaTiempo) etiquetaTiempo.classList.remove('parpadeando');
  if (etiquetaBoton) etiquetaBoton.classList.remove('parpadeando');
  detenerBeep();
}

function detenerPollAlarma() {
  if (temporizadorAlarma) {
    clearInterval(temporizadorAlarma);
    temporizadorAlarma = null;
  }
}

function renderizarDetalleAlarma(detalle) {
  if (!avisoAlarmaDetalle) return;
  avisoAlarmaDetalle.innerHTML = '';
  const items = Array.isArray(detalle) ? detalle : [];
  if (items.length === 0) {
    const linea = document.createElement('p');
    linea.className = 'avisoAlarmaLinea';
    linea.textContent = 'Sin detalle de envío.';
    avisoAlarmaDetalle.appendChild(linea);
    return;
  }
  for (const item of items) {
    const linea = document.createElement('p');
    linea.className = 'avisoAlarmaLinea';
    const telefono = item && item.telefono != null ? String(item.telefono) : '';
    if (item && item.ok === true) {
      linea.textContent = `Enviado a ${telefono}: aceptado`;
    } else {
      const error = item && item.error ? item.error : {};
      const code = error.code != null ? String(error.code) : '';
      const message = error.message != null ? String(error.message) : '';
      linea.textContent = `Error con ${telefono}: ${code} — ${message}`;
    }
    avisoAlarmaDetalle.appendChild(linea);
  }
}

function renderizarCancelacionAlarma() {
  if (!avisoAlarmaCancelacion || !listaCancelacionAlarma) return;
  const contactos = contactosCancelacionAlarma();
  listaCancelacionAlarma.innerHTML = '';
  if (contactos.length === 0) {
    avisoAlarmaCancelacion.hidden = true;
    return;
  }
  avisoAlarmaCancelacion.hidden = false;
  for (const contacto of contactos) {
    const href = construirUrlWhatsapp(contacto.telefono, TEXTO_CANCELACION_ALARMA);
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'avisoAlarmaCancelacionBoton';
    boton.textContent = `Abrir WhatsApp — ${contacto.nombre}`;
    boton.addEventListener('click', () => abrirWhatsapp(href));
    listaCancelacionAlarma.appendChild(boton);
  }
}

function confirmarAlarmaEnviada(detalle) {
  if (alarmaConfirmada) return;
  alarmaConfirmada = true;
  detenerPollAlarma();
  detenerAlertaPrevia();
  if (etiquetaBoton) etiquetaBoton.classList.add('parpadeando');
  renderizarDetalleAlarma(detalle);
  renderizarCancelacionAlarma();
  if (avisoAlarmaEnviada) avisoAlarmaEnviada.hidden = false;
}

async function consultarAlarma(sessionId) {
  const url = `${ROOT_URL}/api/message-events/session/${encodeURIComponent(sessionId)}`;
  try {
    const respuesta = await fetchConTimeout(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!respuesta.ok) {
      console.error(`[iniciarDetener] GET sesión falló: ${url} status=${respuesta.status}`);
      return;
    }
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (err) {
      console.error(
        `[iniciarDetener] sesión devolvió JSON ilegible: ${url} — ${mensajeDeError(err)}`
      );
      return;
    }
    if (datos && datos.alarmaEnviada === true) {
      confirmarAlarmaEnviada(datos.alarmaDetalle);
    }
  } catch (err) {
    console.error(`[iniciarDetener] GET sesión falló: ${url} — ${mensajeDeError(err)}`);
  }
}

function iniciarPollAlarma() {
  if (temporizadorAlarma || alarmaConfirmada) return;
  const lanzar = (sessionId) => {
    if (!sessionId || alarmaConfirmada) return;
    consultarAlarma(sessionId);
    temporizadorAlarma = setInterval(() => consultarAlarma(sessionId), INTERVALO_POLL_ALARMA_MS);
  };
  const sessionId = sessionIdEnCurso || leerSessionIdEnCurso();
  if (sessionId) {
    lanzar(sessionId);
    return;
  }
  const pendiente = promesaSesionEnCurso;
  if (pendiente && typeof pendiente.then === 'function') {
    pendiente
      .then((id) => {
        if (estadoContador === 'finalizado' && !alarmaConfirmada) lanzar(id);
      })
      .catch(() => {});
  }
}

// Reanuda el polling solo si la sesión terminó y la alarma sigue sin
// confirmarse. `iniciarPollAlarma` no duplica el interval si ya está activo.
function reanudarPollAlarmaSiCorresponde() {
  if (estadoContador === 'finalizado' && !alarmaConfirmada) iniciarPollAlarma();
}

function reiniciarAvisoAlarma() {
  detenerPollAlarma();
  detenerAlertaPrevia();
  alarmaConfirmada = false;
  if (avisoAlarmaDetalle) avisoAlarmaDetalle.innerHTML = '';
  if (listaCancelacionAlarma) listaCancelacionAlarma.innerHTML = '';
  if (avisoAlarmaCancelacion) avisoAlarmaCancelacion.hidden = true;
  if (avisoAlarmaEnviada) avisoAlarmaEnviada.hidden = true;
}

function iniciarContador() {
  if (!cargaCompleta) return; // carga pendiente: no arrancar ni persistir (REL-101)
  prepararAudio(); // dentro del gesto del click de INICIAR
  sincronizarEstadoSesion();

  totalContador = estadoSesion.tiempoSegundos;
  if (totalContador <= 0) {
    detenerContador(); // sin duración: dejar la UI en estado detenido consistente
    return;
  }

  guardarUltimaSesion();
  reiniciarAvisoAlarma(); // sesión nueva: sin blink, beep, polling ni caja roja

  sessionIdEnCurso = ''; // sesión nueva: el id anterior ya no aplica
  promesaSesionEnCurso = null;
  detenerRefrescoUbicacion();
  ultimaUbicacion = null; // se captura fresca al registrar la sesión
  segundosRestantes = totalContador;
  inicioContadorMs = Date.now();
  estadoContador = 'corriendo';
  etiquetaBoton.textContent = 'DETENER';
  fijarTriggersBloqueados(true); // triggers inmutables durante la cuenta (REL-103)
  guardarSesionEnCurso(); // sobrevive a un reload (REL-105)
  enviarInicioSesionEnBackend(); // registra la sesión y dispara el "inicio" (fire-and-forget)
  actualizarVisualizacion();

  if (temporizador) clearInterval(temporizador);
  temporizador = setInterval(contarSegundo, 1000);
}

function detenerContador() {
  // REL-002: si el POST de creación sigue en vuelo, no se pierde el stop.
  // REL-004: el id en memoria manda; localStorage es solo un respaldo.
  const veniaCorriendo = estadoContador === 'corriendo';
  const promesaCreacion = promesaSesionEnCurso;
  promesaSesionEnCurso = null;
  const sessionIdConocido = sessionIdEnCurso || leerSessionIdEnCurso();

  // La UI y el localStorage se resetean YA: DETENER es inmediato para el usuario
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
  detenerRefrescoUbicacion(); // el GPS deja de refrescarse al cerrar la sesión
  reiniciarAvisoAlarma(); // DETENER corta blink, beep y polling de alarma
  quitarSesionEnCurso(); // DETENER resetea: no queda nada que reanudar (REL-105)
  sessionIdEnCurso = '';
  ultimaUbicacion = null;
  inicioContadorMs = 0;
  estadoContador = 'detenido';
  etiquetaBoton.textContent = 'INICIAR';
  fijarTriggersBloqueados(false);
  actualizarVisualizacion();

  // El fin ya no lo manda la API: el panel ofrece compartirlo por WhatsApp.
  // Se muestra al instante, sin esperar el stop del backend.
  if (veniaCorriendo) renderizarPanelAvisos('fin');

  // El stop corre detrás: espera acotada al registro pendiente y luego cierra
  return (async () => {
    let sessionId = sessionIdConocido;
    if (!sessionId && promesaCreacion) {
      sessionId = await esperarConTiempoLimite(promesaCreacion, TIMEOUT_ESPERA_SESION_MS);
    }
    if (!sessionId) return false;
    return enviarStopSesionEnBackend(sessionId);
  })();
}

function contarSegundo() {
  // Basado en reloj de pared: correcto aunque el timer se aplane o se suspenda
  const transcurrido = Math.floor((Date.now() - inicioContadorMs) / 1000);
  segundosRestantes = Math.max(0, totalContador - transcurrido);
  if (segundosRestantes <= 0) {
    segundosRestantes = 0;
    if (temporizador) {
      clearInterval(temporizador);
      temporizador = null;
    }
    estadoContador = 'finalizado';
    etiquetaBoton.textContent = 'FINALIZADO';
    detenerAlertaPrevia(); // llegó a 0: se corta blink y beep
    quitarSesionEnCurso(); // terminó: no hay sesión en curso que reanudar (REL-105)
    fijarTriggersBloqueados(false); // habilitar para que un cambio reinicie (REL-001)
    iniciarPollAlarma(); // consulta la confirmación real enviada por el backend
  } else if (
    estadoContador === 'corriendo' &&
    segundosRestantes <= umbralPreaviso(totalContador)
  ) {
    activarAlertaPrevia(); // últimos segundos: blink + beep intermitente
  }
  actualizarVisualizacion();
}

function alternarContador() {
  if (estadoContador === 'corriendo') {
    detenerContador();
  } else {
    iniciarContador();
  }
}

// Al cambiar una selección, salir del estado finalizado para volver a mostrar
// el tiempo recién elegido (REL-001)
function reiniciarSiFinalizado() {
  if (estadoContador !== 'finalizado') return;
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
  inicioContadorMs = 0;
  estadoContador = 'detenido';
  etiquetaBoton.textContent = 'INICIAR';
  fijarTriggersBloqueados(false);
  reiniciarAvisoAlarma(); // al reiniciar se limpia la caja roja y el polling
}

function inicializarUI() {
  triggerActividad = document.getElementById('triggerActividad');
  filaValorActividad = document.getElementById('filaValorActividad');
  panelActividad = document.getElementById('panelActividad');
  listaActividad = document.getElementById('listaActividad');
  triggerEquipo = document.getElementById('triggerEquipo');
  filaValorEquipo = document.getElementById('filaValorEquipo');
  panelEquipo = document.getElementById('panelEquipo');
  listaEquipo = document.getElementById('listaEquipo');
  triggerTiempo = document.getElementById('triggerTiempo');
  filaValorTiempo = document.getElementById('filaValorTiempo');
  panelTiempo = document.getElementById('panelTiempo');
  valorDias = document.getElementById('valorDias');
  valorHoras = document.getElementById('valorHoras');
  valorMinutos = document.getElementById('valorMinutos');
  botonDiasMas = document.getElementById('btnDiasMas');
  botonDiasMenos = document.getElementById('btnDiasMenos');
  botonHorasMas = document.getElementById('btnHorasMas');
  botonHorasMenos = document.getElementById('btnHorasMenos');
  botonMinutosMas = document.getElementById('btnMinutosMas');
  botonMinutosMenos = document.getElementById('btnMinutosMenos');
  botonIniciar = document.getElementById('botonIniciar');
  etiquetaBoton = document.getElementById('etiquetaBoton');
  etiquetaTiempo = document.querySelector('.botonIniciar .tiempo');
  avisoAlarmaEnviada = document.getElementById('avisoAlarmaEnviada');
  avisoAlarmaDetalle = document.getElementById('avisoAlarmaDetalle');
  avisoAlarmaCancelacion = document.getElementById('avisoAlarmaCancelacion');
  listaCancelacionAlarma = document.getElementById('listaCancelacionAlarma');
  botonCompartirCancelacion = document.getElementById('botonCompartirCancelacion');
  iconoActividad = document.getElementById('iconoActividad');
  anilloProgreso = document.getElementById('anilloProgreso');
  panelAvisos = document.getElementById('panelAvisos');
  tituloAvisos = document.getElementById('tituloAvisos');
  listaAvisos = document.getElementById('listaAvisos');
  botonCompartirAviso = document.getElementById('botonCompartirAviso');
  botonCerrarAvisos = document.getElementById('botonCerrarAvisos');

  const nodosRequeridos = {
    triggerActividad,
    filaValorActividad,
    panelActividad,
    listaActividad,
    triggerEquipo,
    filaValorEquipo,
    panelEquipo,
    listaEquipo,
    triggerTiempo,
    filaValorTiempo,
    panelTiempo,
    valorDias,
    valorHoras,
    valorMinutos,
    botonDiasMas,
    botonDiasMenos,
    botonHorasMas,
    botonHorasMenos,
    botonMinutosMas,
    botonMinutosMenos,
    botonIniciar,
    etiquetaBoton,
    etiquetaTiempo,
    avisoAlarmaEnviada,
    avisoAlarmaDetalle,
    avisoAlarmaCancelacion,
    listaCancelacionAlarma,
    botonCompartirCancelacion,
    iconoActividad,
    anilloProgreso,
    panelAvisos,
    tituloAvisos,
    listaAvisos,
    botonCompartirAviso,
    botonCerrarAvisos,
  };
  const faltantes = Object.keys(nodosRequeridos).filter((nombre) => !nodosRequeridos[nombre]);
  if (faltantes.length > 0) {
    console.error('[iniciarDetener] nodos faltantes:', faltantes);
    return false; // la página no tiene los elementos esperados
  }

  const radio = Number(anilloProgreso.getAttribute('r')) || 145;
  circunferenciaAnillo = 2 * Math.PI * radio;
  anilloProgreso.style.strokeDasharray = String(circunferenciaAnillo);
  anilloProgreso.style.strokeDashoffset = String(circunferenciaAnillo);

  // cabecera (título + flecha) y fila de valor alternan el mismo panel: la
  // caja entera menos el panel es el área clicable
  triggerActividad.addEventListener('click', manejarClickTriggerActividad);
  filaValorActividad.addEventListener('click', manejarClickTriggerActividad);
  triggerEquipo.addEventListener('click', manejarClickTriggerEquipo);
  filaValorEquipo.addEventListener('click', manejarClickTriggerEquipo);
  triggerTiempo.addEventListener('click', manejarClickTriggerTiempo);
  filaValorTiempo.addEventListener('click', manejarClickTriggerTiempo);
  botonDiasMas.addEventListener('click', () => manejarPasoTiempo('dias', 1));
  botonDiasMenos.addEventListener('click', () => manejarPasoTiempo('dias', -1));
  botonHorasMas.addEventListener('click', () => manejarPasoTiempo('horas', 1));
  botonHorasMenos.addEventListener('click', () => manejarPasoTiempo('horas', -1));
  botonMinutosMas.addEventListener('click', () => manejarPasoTiempo('minutos', 1));
  botonMinutosMenos.addEventListener('click', () => manejarPasoTiempo('minutos', -1));
  botonIniciar.addEventListener('click', alternarContador);
  botonCompartirAviso.addEventListener('click', manejarCompartirAviso);
  botonCerrarAvisos.addEventListener('click', cerrarPanelAvisos);
  botonCompartirCancelacion.addEventListener('click', manejarCompartirCancelacion);

  // Al abandonar la página se corta el refresco de ubicación (no queda timer)
  if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', detenerRefrescoUbicacion);
    window.addEventListener('pagehide', detenerRefrescoUbicacion);
    window.addEventListener('pagehide', detenerPollAlarma);
    // bfcache: al volver con pageshow se reintenta la confirmación pendiente
    window.addEventListener('pageshow', reanudarPollAlarmaSiCorresponde);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      reanudarPollAlarmaSiCorresponde();
    } else {
      detenerPollAlarma(); // oculta: se corta el polling (batería)
    }
  });

  // Click fuera de cualquier desplegable -> cerrar el panel abierto. El click
  // sobre el propio trigger o su panel es "adentro" (closest('.desplegable'))
  // y no lo cierra, para no pelear con el toggle del trigger.
  document.addEventListener('click', (evento) => {
    const destino = evento && evento.target;
    if (!destino || typeof destino.closest !== 'function' || !destino.closest('.desplegable')) {
      cerrarPaneles();
    }
  });

  // Si el PNG de la actividad no existe (asset sin trackear), caer a la imagen
  // por defecto; el chequeo evita un loop si también falla la de repuesto (REL-102)
  iconoActividad.addEventListener('error', () => {
    const actual = iconoActividad.src || '';
    if (actual.endsWith(IMAGENES_POR_DEFECTO[0])) return;
    iconoActividad.src = `${RUTA_IMAGENES}${IMAGENES_POR_DEFECTO[0]}`;
  });

  refrescarTriggers(); // placeholders de las filas de valor + stepper default

  return true;
}

// fetch con timeout por AbortController: aborta a TIMEOUT_PETICION_MS para que
// ninguna carga quede colgada sin límite (mismo patrón que ya usaba el fetch de
// sessions/current; RES-002)
function fetchConTimeout(url, init = {}) {
  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIMEOUT_PETICION_MS);
  return fetch(url, { ...init, signal: controlador.signal }).finally(() => {
    clearTimeout(reloj);
  });
}

// La pantalla de Iniciar/Detener no trae #toast-container en su HTML. Se crea
// al vuelo para que el helper real de utils.js pueda mostrar el aviso.
function asegurarContenedorToasts() {
  try {
    if (document.getElementById('toast-container')) return true;
    if (!document.body) return false;
    const contenedor = document.createElement('div');
    contenedor.id = 'toast-container';
    document.body.appendChild(contenedor);
    return true;
  } catch (err) {
    return false;
  }
}

// Aviso visible (toast) de que la sesión no quedó registrada. En el navegador
// utils.js es un módulo ES y esta página carga scripts clásicos: se importa
// dinámicamente. Si el helper ya está expuesto como global (tests), se usa ese.
function mostrarToastSesionNoRegistrada(mensaje) {
  mostrarToastAviso(mensaje, 'error');
}

// POST de creación de sesión con un reintento (mismo tope que activities).
// Resuelve con el sessionId devuelto o '' si ambos intentos fallaron.
async function crearSesionEnBackend(cuerpo) {
  const url = `${ROOT_URL}/api/message-events/session`;
  for (let intento = 1; intento <= MAX_INTENTOS_PETICION; intento++) {
    try {
      const respuesta = await fetchConTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`, // iOS
        },
        body: JSON.stringify(cuerpo),
      });
      if (!respuesta.ok) {
        console.error(
          `[iniciarDetener] POST message-events/session falló (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} status=${respuesta.status}`
        );
        continue;
      }
      let datos = null;
      try {
        datos = await respuesta.json();
      } catch (err) {
        console.error(
          `[iniciarDetener] message-events/session devolvió JSON ilegible (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} — ${mensajeDeError(err)}`
        );
        continue;
      }
      const sessionId = datos && typeof datos.sessionId === 'string' ? datos.sessionId : '';
      if (!sessionId) {
        console.error(
          `[iniciarDetener] message-events/session no devolvió sessionId (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url}`
        );
        continue;
      }
      return sessionId;
    } catch (err) {
      console.error(
        `[iniciarDetener] POST message-events/session falló (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} — ${mensajeDeError(err)}`
      );
    }
  }
  return '';
}

// Espera una promesa con tope de tiempo; resuelve '' si vence (DETENER nunca
// queda colgado esperando al backend, REL-002)
function esperarConTiempoLimite(promesa, ms) {
  return new Promise((resolver) => {
    let resuelto = false;
    const reloj = setTimeout(() => {
      if (resuelto) return;
      resuelto = true;
      resolver('');
    }, ms);
    Promise.resolve(promesa)
      .then((valor) => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(reloj);
        resolver(valor || '');
      })
      .catch(() => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(reloj);
        resolver('');
      });
  });
}

// Registra la sesión en el backend al INICIAR (el backend manda el WhatsApp de
// "inicio"). Fire-and-forget: nunca bloquea el contador ni rompe la UI si falla.
// Devuelve (y deja en promesaSesionEnCurso) la promesa que resuelve el sessionId
// para que DETENER pueda esperarla si llega antes de que termine (REL-002).
function enviarInicioSesionEnBackend() {
  const inicioEnviado = inicioContadorMs;
  const promesa = (async () => {
    // Geolocation con timeout propio de la API: si falla, se sigue sin ubicación
    const ubicacion = await obtenerUbicacionActual();
    if (ubicacion && estadoContador === 'corriendo' && inicioContadorMs === inicioEnviado) {
      ultimaUbicacion = ubicacion;
      guardarSesionEnCurso(); // persiste para reutilizarla tras un reload
    }
    const cuerpo = {
      actividad: estadoSesion.actividad,
      duracionSegundos: estadoSesion.tiempoSegundos,
    };
    if (ubicacion) cuerpo.ubicacion = { lat: ubicacion.lat, lng: ubicacion.lng };
    const sessionId = await crearSesionEnBackend(cuerpo);
    if (sessionId) {
      // Si mientras tanto la sesión se detuvo o reinició, no pisar el estado
      if (estadoContador === 'corriendo' && inicioContadorMs === inicioEnviado) {
        sessionIdEnCurso = sessionId;
        guardarSesionEnCurso(); // el id persiste: un reload todavía puede detenerla
        iniciarRefrescoUbicacion(); // refresco cada 5 min mientras esté visible
        // Sesión registrada: recién ahora el inicio puede compartirse a mano
        renderizarPanelAvisos('inicio');
      }
      return sessionId;
    }
    // Falló tras el reintento: el contador sigue, pero nadie recibirá la alarma
    // automática. El aviso es visible además del log (REL-001)
    console.error(
      `[iniciarDetener] no se pudo registrar la sesión: el contador sigue pero no habrá alarma automática`
    );
    mostrarToastSesionNoRegistrada(TEXTO_SESION_NO_REGISTRADA);
    return '';
  })();
  promesaSesionEnCurso = promesa;
  if (promesa && typeof promesa.catch === 'function') promesa.catch(() => '');
  return promesa;
}

// Cierra la sesión en el backend al DETENER (el backend manda el WhatsApp de
// "fin"). Reintenta una vez con el mismo id si el primer intento falla.
// Fire-and-forget con las mismas reglas de logging que el INICIAR.
async function enviarStopSesionEnBackend(sessionId) {
  const url = `${ROOT_URL}/api/message-events/session/${encodeURIComponent(sessionId)}/stop`;
  for (let intento = 1; intento <= MAX_INTENTOS_PETICION; intento++) {
    try {
      const respuesta = await fetchConTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`, // iOS
        },
      });
      if (respuesta.ok) return true;
      console.error(
        `[iniciarDetener] POST message-events/session stop falló (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} status=${respuesta.status}`
      );
    } catch (err) {
      console.error(
        `[iniciarDetener] POST message-events/session stop falló (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} — ${mensajeDeError(err)}`
      );
    }
  }
  return false;
}

// Descarga /api/activities con timeout y un reintento como máximo (RES-002).
// Devuelve la lista filtrada y si la carga falló; cada intento fallido se
// loguea con la URL y el motivo (RES-001)
async function obtenerActividades(destino) {
  const url = `${ROOT_URL}/api/activities/${encodeURIComponent(destino)}`;
  for (let intento = 1; intento <= MAX_INTENTOS_PETICION; intento++) {
    try {
      const respuesta = await fetchConTimeout(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`, // iOS
        },
      });
      if (!respuesta.ok) {
        console.error(
          `[iniciarDetener] activities falló (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} status=${respuesta.status}`
        );
        continue;
      }
      const datos = await respuesta.json();
      if (!Array.isArray(datos)) {
        console.error(
          `[iniciarDetener] activities devolvió un payload que no es lista (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url}`
        );
        continue;
      }
      return {
        lista: datos.filter((item) => item && typeof item.name === 'string'),
        fallo: false,
      };
    } catch (err) {
      console.error(
        `[iniciarDetener] activities falló (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} — ${mensajeDeError(err)}`
      );
    }
  }
  return { lista: [], fallo: true };
}

// Consulta /api/sessions/current con timeout y un reintento (RES-003). Solo el
// rechazo explícito de auth (401/403) NO se reintenta: el resto (500, red,
// timeout) reintenta una vez y, si agota, devuelve estado 'fallo' ya logueado
// para que la degradación sea ruidosa (RES-001)
async function obtenerSesion() {
  const url = `${ROOT_URL}/api/sessions/current`;
  for (let intento = 1; intento <= MAX_INTENTOS_PETICION; intento++) {
    try {
      const respuesta = await fetchConTimeout(url, {
        method: 'GET',
        // credentials: 'include',                                            windows - android
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`, // iOS
        },
      });

      // Solo un token rechazado explícitamente cierra la sesión (REL-104)
      if (respuesta.status === 401 || respuesta.status === 403) {
        console.error(
          `[iniciarDetener] sesión rechazada (status=${respuesta.status}): ${url}; sin reintentos, redirigiendo`
        );
        return { estado: 'rechazado', data: null };
      }

      if (!respuesta.ok) {
        console.error(
          `[iniciarDetener] sessions/current falló (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} status=${respuesta.status}`
        );
        continue;
      }

      let data = null;
      try {
        data = await respuesta.json();
      } catch (err) {
        data = null; // JSON ilegible: sin saludo y sin redirect (REL-104)
        console.error(
          `[iniciarDetener] sessions/current con JSON ilegible: ${url} — ${mensajeDeError(err)}`
        );
      }
      return { estado: 'ok', data };
    } catch (err) {
      // Red caída o timeout: se reintenta una vez; sin email disponible la
      // carga sigue hasta el final en modo degradado ruidoso (REL-104/RES-003)
      console.error(
        `[iniciarDetener] sessions/current falló (intento ${intento}/${MAX_INTENTOS_PETICION}): ${url} — ${mensajeDeError(err)}`
      );
    }
  }
  return { estado: 'fallo', data: null };
}

// Carga las actividades del usuario y deja la página lista (degradación segura)
async function cargarActividades(email) {
  const destino = typeof email === 'string' ? email.trim() : '';
  try {
    if (destino) {
      const resultado = await obtenerActividades(destino);
      actividades = resultado.lista;
      cargaActividadesFallida = resultado.fallo;
    } else {
      // Sin email no hay URL posible: el fallo de sessions/current se hace
      // visible acá en vez de parecer una cuenta vacía (RES-001 / RES-003)
      actividades = [];
      cargaActividadesFallida = true;
      console.error(
        '[iniciarDetener] sin email de usuario: no se pudo consultar /api/activities; carga degradada'
      );
    }
    poblarListaActividad();
    restaurarUltimaSesion();
    reanudarSesionEnCurso();
  } catch (err) {
    // un error inesperado tampoco puede dejar la UI sin terminar de cargar
    cargaActividadesFallida = true;
    console.error(`[iniciarDetener] carga de actividades inesperada: ${mensajeDeError(err)}`);
  } finally {
    cargaCompleta = true; // se asienta en TODOS los caminos: INICIAR nunca queda en limbo (RES-002)
    refrescarTriggers(); // con cargaCompleta=true se habilitan los triggers válidos
  }
}

// Verifica que esté logueado
window.addEventListener('DOMContentLoaded', async () => {
  const uiLista = inicializarUI();

  const sesion = await obtenerSesion();

  // Solo un token rechazado explícitamente cierra la sesión; cualquier otro
  // fallo (500, red, timeout) deja la página en modo degradado (REL-104) y ya
  // quedó logueado con URL y motivo por obtenerSesion (RES-001/RES-003)
  if (sesion.estado === 'rechazado') {
    window.location.href = 'iniciarSesion.html';
    return;
  }

  const usuarioJWT = sesion.data && sesion.data.userJWT ? sesion.data.userJWT : null;
  const nombreElemento = document.getElementById('nombre');
  if (nombreElemento && usuarioJWT && typeof usuarioJWT.name === 'string') {
    const nombreFuerte = document.createElement('strong');
    nombreFuerte.textContent = `${usuarioJWT.name.toUpperCase()}!`;
    nombreElemento.textContent = '';
    nombreElemento.appendChild(nombreFuerte);
  }

  if (usuarioJWT && typeof usuarioJWT.email === 'string') {
    emailSesion = usuarioJWT.email; // namespace de claves de localStorage (REL-106)
  }
  if (usuarioJWT && typeof usuarioJWT.name === 'string') {
    nombreUsuarioAvisos = usuarioJWT.name;
  }

  if (!uiLista) return; // la UI no se inicializó: no tocar nodos inexistentes
  // Las actividades se piden por el email disponible, no por el éxito del call
  // de auth: un fallo de sesión no debe starvear un /api/activities sano (RES-003)
  await Promise.all([cargarActividades(emailSesion), cargarContactosAvisos()]);
});

