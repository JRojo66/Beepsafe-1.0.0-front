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
const TEXTO_NINGUNO = 'Ninguno';
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
let valorEquipo1 = '';
let valorEquipo2 = '';
let tiempoDias = DIAS_DEFECTO;
let tiempoHoras = HORAS_DEFECTO;
let tiempoMinutos = MINUTOS_DEFECTO;

// Panel desplegable abierto a este momento ('actividad' | 'equipo1' |
// 'equipo2' | 'tiempo' | null); solo uno puede estar abierto a la vez
let panelAbierto = null;

// true mientras la sesión corre: los cuatro triggers quedan bloqueados (REL-103)
let controlesBloqueados = false;

// Estado compartido de la sesión seleccionada
const estadoSesion = {
  actividad: '',
  equipo: [], // 0-2 nombres elegidos (los vacíos se filtran)
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

// Referencias del DOM
let triggerActividad = null;
let filaValorActividad = null;
let panelActividad = null;
let listaActividad = null;
let triggerEquipo1 = null;
let filaValorEquipo1 = null;
let panelEquipo1 = null;
let listaEquipo1 = null;
let triggerEquipo2 = null;
let filaValorEquipo2 = null;
let panelEquipo2 = null;
let listaEquipo2 = null;
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
let iconoActividad = null;
let anilloProgreso = null;

// Estado del contador
let circunferenciaAnillo = 0;
let temporizador = null;
let segundosRestantes = estadoSesion.tiempoSegundos;
let totalContador = 0;
let inicioContadorMs = 0; // marca de tiempo del inicio (REL-002)
let estadoContador = 'detenido'; // 'detenido' | 'corriendo' | 'finalizado'

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

// Construye las opciones de una lista; cada opción es un <button> con su handler
function poblarListaOpciones(lista, opciones) {
  lista.innerHTML = '';
  for (const opcion of opciones) {
    const elemento = document.createElement('button');
    elemento.type = 'button';
    elemento.className = 'opcionDesplegable';
    elemento.textContent = opcion.texto;
    elemento.addEventListener('click', opcion.alElegir);
    lista.appendChild(elemento);
  }
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

function poblarListaEquipo1(nombreActividad) {
  // sin actividad no hay equipos que mostrar: la caja queda no-interactiva
  // y la fila de valor en "Sin equipo" (REL-109)
  const equipos = equiposDeActividad(nombreActividad);
  // sin dedupe: el usuario puede usar el mismo equipo en las dos ranuras
  poblarListaOpciones(
    listaEquipo1,
    equipos.map((equipo) => ({
      texto: equipo.name,
      alElegir: () => manejarSeleccionEquipo1(equipo.name),
    }))
  );
  actualizarDisponibilidadTriggers();
}

function poblarListaEquipo2(nombreActividad) {
  const equipos = equiposDeActividad(nombreActividad);
  // "Ninguno" es siempre la primera opción (valor vacío, no bloquea el arranque)
  // sin dedupe: el usuario puede usar el mismo equipo en las dos ranuras
  poblarListaOpciones(listaEquipo2, [
    { texto: TEXTO_NINGUNO, alElegir: () => manejarSeleccionEquipo2('') },
    ...equipos.map((equipo) => ({
      texto: equipo.name,
      alElegir: () => manejarSeleccionEquipo2(equipo.name),
    })),
  ]);
  actualizarDisponibilidadTriggers();
}

// Equipos elegidos como array de 0-2 nombres (los vacíos se filtran)
function equipoElegido() {
  const nombres = [];
  if (valorEquipo1) nombres.push(valorEquipo1);
  if (valorEquipo2) nombres.push(valorEquipo2);
  return nombres;
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
  triggerEquipo1.disabled =
    controlesBloqueados || !valorActividad || equiposDisponibles.length === 0;
  triggerEquipo2.disabled = controlesBloqueados || !valorActividad;
  triggerTiempo.disabled = controlesBloqueados;
  // la fila de valor se bloquea junto con su cabecera: la caja completa queda
  // no-interactiva (mismo gating, sin lógica nueva)
  filaValorActividad.disabled = triggerActividad.disabled;
  filaValorEquipo1.disabled = triggerEquipo1.disabled;
  filaValorEquipo2.disabled = triggerEquipo2.disabled;
  filaValorTiempo.disabled = triggerTiempo.disabled;
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
  filaValorEquipo1.textContent = valorEquipo1 || TEXTO_SIN_EQUIPO;
  filaValorEquipo2.textContent = valorEquipo2 || TEXTO_NINGUNO;
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
  const paneles = [panelActividad, panelEquipo1, panelEquipo2, panelTiempo];
  for (const panel of paneles) {
    if (panel) panel.classList.remove('abierto');
  }
  const triggers = [triggerActividad, triggerEquipo1, triggerEquipo2, triggerTiempo];
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
  if (nombre === 'equipo1') return { panel: panelEquipo1, trigger: triggerEquipo1 };
  if (nombre === 'equipo2') return { panel: panelEquipo2, trigger: triggerEquipo2 };
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

function manejarClickTriggerEquipo1(evento) {
  if (esClickEnPanel(evento)) return;
  if (triggerEquipo1.disabled) return;
  alternarPanel('equipo1');
}

function manejarClickTriggerEquipo2(evento) {
  if (esClickEnPanel(evento)) return;
  if (triggerEquipo2.disabled) return;
  alternarPanel('equipo2');
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
  // al cambiar de actividad vuelven los defaults: primer equipo y "Ninguno"
  // (mismo comportamiento que al poblar los viejos selects)
  const equipos = equiposDeActividad(nombre);
  valorEquipo1 = equipos.length > 0 ? equipos[0].name : '';
  valorEquipo2 = '';
  poblarListaEquipo1(nombre);
  poblarListaEquipo2(nombre);
  cerrarPaneles();
  sincronizarEstadoSesion();
  refrescarTriggers();
  actualizarIconoActividad();
  actualizarVisualizacion();
}

function manejarSeleccionEquipo1(nombre) {
  if (triggerEquipo1.disabled) return;
  reiniciarSiFinalizado();
  valorEquipo1 = nombre;
  cerrarPaneles();
  sincronizarEstadoSesion();
  refrescarTriggers();
  actualizarVisualizacion();
}

function manejarSeleccionEquipo2(nombre) {
  if (triggerEquipo2.disabled) return;
  reiniciarSiFinalizado();
  valorEquipo2 = nombre;
  cerrarPaneles();
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

// Persiste la sesión en curso para poder reanudarla tras un reload (REL-105)
function guardarSesionEnCurso() {
  try {
    localStorage.setItem(
      claveConUsuario(CLAVE_SESION_EN_CURSO),
      JSON.stringify({
        actividad: estadoSesion.actividad,
        equipo: estadoSesion.equipo,
        tiempoSegundos: estadoSesion.tiempoSegundos,
        inicioContadorMs,
      })
    );
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
  estadoContador = 'corriendo';
  etiquetaBoton.textContent = 'DETENER';
  fijarTriggersBloqueados(true);
  if (temporizador) clearInterval(temporizador);
  temporizador = setInterval(contarSegundo, 1000);
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
  // migran a array de a un nombre). Los nombres que ya no existen en la
  // actividad se descartan sin romper (poblarLista solo deja válidos).
  const mismaActividad = Boolean(guardada) && guardada.actividad === nombreActividad;
  let equipoGuardado = [];
  if (mismaActividad && Array.isArray(guardada.equipo)) {
    equipoGuardado = guardada.equipo.filter((nombre) => typeof nombre === 'string' && nombre);
  } else if (mismaActividad && typeof guardada.equipo === 'string' && guardada.equipo) {
    equipoGuardado = [guardada.equipo];
  }

  // Equipo 1: el preferido si todavía existe; si no, el primero de la lista
  // (mismo default que dejaba seleccionado el viejo <select>)
  const equipos = equiposDeActividad(nombreActividad);
  if (equipoGuardado[0] && equipos.some((equipo) => equipo.name === equipoGuardado[0])) {
    valorEquipo1 = equipoGuardado[0];
  } else {
    valorEquipo1 = equipos.length > 0 ? equipos[0].name : '';
  }
  // Equipo 2: el preferido si todavía existe; si no, "Ninguno" (valor vacío)
  valorEquipo2 =
    equipoGuardado[1] && equipos.some((equipo) => equipo.name === equipoGuardado[1])
      ? equipoGuardado[1]
      : '';

  poblarListaEquipo1(nombreActividad);
  poblarListaEquipo2(nombreActividad);

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

function iniciarContador() {
  if (!cargaCompleta) return; // carga pendiente: no arrancar ni persistir (REL-101)
  sincronizarEstadoSesion();

  totalContador = estadoSesion.tiempoSegundos;
  if (totalContador <= 0) {
    detenerContador(); // sin duración: dejar la UI en estado detenido consistente
    return;
  }

  guardarUltimaSesion();

  segundosRestantes = totalContador;
  inicioContadorMs = Date.now();
  estadoContador = 'corriendo';
  etiquetaBoton.textContent = 'DETENER';
  fijarTriggersBloqueados(true); // triggers inmutables durante la cuenta (REL-103)
  guardarSesionEnCurso(); // sobrevive a un reload (REL-105)
  actualizarVisualizacion();

  if (temporizador) clearInterval(temporizador);
  temporizador = setInterval(contarSegundo, 1000);
}

function detenerContador() {
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
  quitarSesionEnCurso(); // DETENER resetea: no queda nada que reanudar (REL-105)
  inicioContadorMs = 0;
  estadoContador = 'detenido';
  etiquetaBoton.textContent = 'INICIAR';
  fijarTriggersBloqueados(false);
  actualizarVisualizacion();
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
    quitarSesionEnCurso(); // terminó: no hay sesión en curso que reanudar (REL-105)
    fijarTriggersBloqueados(false); // habilitar para que un cambio reinicie (REL-001)
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
}

function inicializarUI() {
  triggerActividad = document.getElementById('triggerActividad');
  filaValorActividad = document.getElementById('filaValorActividad');
  panelActividad = document.getElementById('panelActividad');
  listaActividad = document.getElementById('listaActividad');
  triggerEquipo1 = document.getElementById('triggerEquipo1');
  filaValorEquipo1 = document.getElementById('filaValorEquipo1');
  panelEquipo1 = document.getElementById('panelEquipo1');
  listaEquipo1 = document.getElementById('listaEquipo1');
  triggerEquipo2 = document.getElementById('triggerEquipo2');
  filaValorEquipo2 = document.getElementById('filaValorEquipo2');
  panelEquipo2 = document.getElementById('panelEquipo2');
  listaEquipo2 = document.getElementById('listaEquipo2');
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
  iconoActividad = document.getElementById('iconoActividad');
  anilloProgreso = document.getElementById('anilloProgreso');

  const nodosRequeridos = {
    triggerActividad,
    filaValorActividad,
    panelActividad,
    listaActividad,
    triggerEquipo1,
    filaValorEquipo1,
    panelEquipo1,
    listaEquipo1,
    triggerEquipo2,
    filaValorEquipo2,
    panelEquipo2,
    listaEquipo2,
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
    iconoActividad,
    anilloProgreso,
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
  triggerEquipo1.addEventListener('click', manejarClickTriggerEquipo1);
  filaValorEquipo1.addEventListener('click', manejarClickTriggerEquipo1);
  triggerEquipo2.addEventListener('click', manejarClickTriggerEquipo2);
  filaValorEquipo2.addEventListener('click', manejarClickTriggerEquipo2);
  triggerTiempo.addEventListener('click', manejarClickTriggerTiempo);
  filaValorTiempo.addEventListener('click', manejarClickTriggerTiempo);
  botonDiasMas.addEventListener('click', () => manejarPasoTiempo('dias', 1));
  botonDiasMenos.addEventListener('click', () => manejarPasoTiempo('dias', -1));
  botonHorasMas.addEventListener('click', () => manejarPasoTiempo('horas', 1));
  botonHorasMenos.addEventListener('click', () => manejarPasoTiempo('horas', -1));
  botonMinutosMas.addEventListener('click', () => manejarPasoTiempo('minutos', 1));
  botonMinutosMenos.addEventListener('click', () => manejarPasoTiempo('minutos', -1));
  botonIniciar.addEventListener('click', alternarContador);

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

// Descarga /api/activities con timeout y un reintento como máximo (RES-002).
// Devuelve la lista filtrada y si la carga falló; cada intento fallido se
// loguea con la URL y el motivo (RES-001)
async function obtenerActividades(destino) {
  const url = `${ROOT_URL}/api/activities/${encodeURIComponent(destino)}`;
  for (let intento = 1; intento <= MAX_INTENTOS_PETICION; intento++) {
    try {
      const respuesta = await fetchConTimeout(url);
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

  if (!uiLista) return; // la UI no se inicializó: no tocar nodos inexistentes
  // Las actividades se piden por el email disponible, no por el éxito del call
  // de auth: un fallo de sesión no debe starvear un /api/activities sano (RES-003)
  await cargarActividades(emailSesion);
});

