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

// Duraciones disponibles para el select de Tiempo, en minutos
const DURACIONES_MINUTOS = [15, 30, 45, 60, 90, 120, 180];
const DURACION_DEFECTO_MINUTOS = 180;

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

// Estado compartido de la sesión seleccionada
const estadoSesion = {
  actividad: '',
  equipo: '',
  tiempoSegundos: DURACION_DEFECTO_MINUTOS * 60,
};

// Lista de actividades del usuario: [{ name, equipment? }]
let actividades = [];

// true cuando cargarActividades terminó (aunque sea en modo degradado);
// hasta entonces INICIAR no debe persistir nada (REL-101)
let cargaCompleta = false;

// Email del usuario autenticado: namespace de las claves de localStorage
// para no mezclar sesiones de usuarios distintos en el mismo navegador (REL-106)
let emailSesion = '';

// Referencias del DOM
let selectActividad = null;
let selectEquipo = null;
let selectTiempo = null;
let botonIniciar = null;
let etiquetaBoton = null;
let etiquetaTiempo = null;
let iconoActividad = null;
let anilloProgreso = null;
let elegidoActividad = null;
let elegidoEquipo = null;
let elegidoTiempo = null;

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

// Segundos -> HH:MM:SS
function formatearTiempo(totalSegundos) {
  const numero = Number(totalSegundos);
  const seguros = Number.isFinite(numero) ? Math.max(0, Math.floor(numero)) : 0;
  const horas = Math.floor(seguros / 3600);
  const minutos = Math.floor((seguros % 3600) / 60);
  const segundos = seguros % 60;
  return [horas, minutos, segundos]
    .map((valor) => String(valor).padStart(2, '0'))
    .join(':');
}

function obtenerTextoSeleccionado(select) {
  if (!select || !select.selectedOptions || select.selectedOptions.length === 0) {
    return '';
  }
  return select.selectedOptions[0].text;
}

function poblarSelectTiempo() {
  selectTiempo.length = 0;
  for (const minutos of DURACIONES_MINUTOS) {
    selectTiempo.add(new Option(formatearTiempo(minutos * 60), String(minutos)));
  }
  selectTiempo.value = String(DURACION_DEFECTO_MINUTOS);
}

function poblarSelectActividad() {
  selectActividad.length = 0;
  if (actividades.length === 0) {
    const opcion = new Option('Sin actividades', '', false, true);
    opcion.disabled = true;
    selectActividad.add(opcion);
    return;
  }
  for (const actividad of actividades) {
    selectActividad.add(new Option(actividad.name, actividad.name));
  }
}

function poblarSelectEquipo(nombreActividad, equipoPreferido) {
  selectEquipo.length = 0;
  if (!nombreActividad) {
    // sin actividad no hay equipos que mostrar: placeholder para que el select
    // nunca quede vacío (REL-109)
    const opcion = new Option('Sin actividad', '', false, true);
    opcion.disabled = true;
    selectEquipo.add(opcion);
    return;
  }

  const actividad = actividades.find((item) => item.name === nombreActividad);
  const equipos =
    actividad && Array.isArray(actividad.equipment)
      ? actividad.equipment.filter((equipo) => equipo && typeof equipo.name === 'string')
      : [];

  if (equipos.length === 0) {
    const opcion = new Option('Sin equipo', '', false, true);
    opcion.disabled = true;
    selectEquipo.add(opcion);
    return;
  }
  for (const equipo of equipos) {
    selectEquipo.add(new Option(equipo.name, equipo.name));
  }
  if (equipoPreferido && equipos.some((equipo) => equipo.name === equipoPreferido)) {
    selectEquipo.value = equipoPreferido;
  }
}

function sincronizarEstadoSesion() {
  estadoSesion.actividad = selectActividad.value;
  estadoSesion.equipo = selectEquipo.value;
  estadoSesion.tiempoSegundos = Math.max(0, Number(selectTiempo.value) || 0) * 60;
}

function sincronizarElegidos() {
  elegidoActividad.textContent = obtenerTextoSeleccionado(selectActividad);
  elegidoEquipo.textContent = obtenerTextoSeleccionado(selectEquipo);
  elegidoTiempo.textContent = obtenerTextoSeleccionado(selectTiempo);
}

function actualizarIconoActividad() {
  const archivo = imagenParaActividad(selectActividad.value);
  iconoActividad.src = `${RUTA_IMAGENES}${archivo}`;
  iconoActividad.alt = `Imagen de ${selectActividad.value || 'actividad'}`;
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
  }
}

function leerUltimaSesion() {
  const claveActual = claveConUsuario(CLAVE_ULTIMA_SESION);

  let guardada = null;
  try {
    const crudo = localStorage.getItem(claveActual);
    if (crudo) {
      const parsed = JSON.parse(crudo);
      if (parsed && typeof parsed === 'object') guardada = parsed;
    }
  } catch (err) {
    guardada = null;
  }
  if (guardada) return guardada;

  // Migración única: clave legada sin namespace de usuario (REL-106)
  if (claveActual === CLAVE_ULTIMA_SESION) return null;
  try {
    const crudoLegado = localStorage.getItem(CLAVE_ULTIMA_SESION);
    if (!crudoLegado) return null;
    const legada = JSON.parse(crudoLegado);
    if (!legada || typeof legada !== 'object') return null;
    localStorage.setItem(claveActual, crudoLegado);
    localStorage.removeItem(CLAVE_ULTIMA_SESION);
    return legada;
  } catch (err) {
    return null;
  }
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
  }
}

function quitarSesionEnCurso() {
  try {
    localStorage.removeItem(claveConUsuario(CLAVE_SESION_EN_CURSO));
  } catch (err) {
    // nada que hacer: sin la clave no hay reanudación
  }
}

// Restaura una sesión en curso que quedó guardada al recargar la página (REL-105)
function reanudarSesionEnCurso() {
  let crudo = null;
  try {
    crudo = localStorage.getItem(claveConUsuario(CLAVE_SESION_EN_CURSO));
  } catch (err) {
    return;
  }
  if (!crudo) return;

  let guardada = null;
  try {
    guardada = JSON.parse(crudo);
  } catch (err) {
    return; // payload ilegible: ignorar
  }
  if (!guardada || typeof guardada !== 'object') return;
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
  fijarSelectsBloqueados(true);
  if (temporizador) clearInterval(temporizador);
  temporizador = setInterval(contarSegundo, 1000);
  actualizarVisualizacion();
}

function minutosValidos(tiempoSegundos) {
  return (
    Number.isFinite(tiempoSegundos) &&
    tiempoSegundos > 0 &&
    Number.isInteger(tiempoSegundos / 60) &&
    DURACIONES_MINUTOS.includes(tiempoSegundos / 60)
  );
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
    selectActividad.value = nombreActividad;
  }

  const equipoPreferido =
    guardada && guardada.actividad === nombreActividad && typeof guardada.equipo === 'string'
      ? guardada.equipo
      : '';
  poblarSelectEquipo(nombreActividad, equipoPreferido);

  let minutos = DURACION_DEFECTO_MINUTOS;
  if (guardada && minutosValidos(guardada.tiempoSegundos)) {
    minutos = guardada.tiempoSegundos / 60;
  }
  selectTiempo.value = String(minutos);

  sincronizarEstadoSesion();
  sincronizarElegidos();
  actualizarIconoActividad();
  actualizarVisualizacion();
}

// Bloquea o desbloquea los tres selects mientras la cuenta corre: cambiar una
// selección a mitad de cuenta contradeciría la UI (REL-103)
function fijarSelectsBloqueados(bloqueados) {
  const deshabilitados = Boolean(bloqueados);
  selectActividad.disabled = deshabilitados;
  selectEquipo.disabled = deshabilitados;
  selectTiempo.disabled = deshabilitados;
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
  fijarSelectsBloqueados(true); // selects inmutables durante la cuenta (REL-103)
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
  fijarSelectsBloqueados(false);
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
    fijarSelectsBloqueados(false); // habilitar para que un cambio reinicie (REL-001)
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
  fijarSelectsBloqueados(false);
}

function manejarCambioActividad() {
  reiniciarSiFinalizado();
  poblarSelectEquipo(selectActividad.value, '');
  sincronizarEstadoSesion();
  sincronizarElegidos();
  actualizarIconoActividad();
  actualizarVisualizacion();
}

function manejarCambioEquipo() {
  reiniciarSiFinalizado();
  sincronizarEstadoSesion();
  sincronizarElegidos();
  actualizarVisualizacion();
}

function manejarCambioTiempo() {
  reiniciarSiFinalizado();
  sincronizarEstadoSesion();
  sincronizarElegidos();
  actualizarVisualizacion();
}

function inicializarUI() {
  selectActividad = document.getElementById('selectActividad');
  selectEquipo = document.getElementById('selectEquipo');
  selectTiempo = document.getElementById('selectTiempo');
  botonIniciar = document.getElementById('botonIniciar');
  etiquetaBoton = document.getElementById('etiquetaBoton');
  etiquetaTiempo = document.querySelector('.botonIniciar .tiempo');
  iconoActividad = document.getElementById('iconoActividad');
  anilloProgreso = document.getElementById('anilloProgreso');
  elegidoActividad = document.querySelector('.item1 .elegidos');
  elegidoEquipo = document.querySelector('.item2 .elegidos');
  elegidoTiempo = document.querySelector('.item3 .elegidos');

  const nodosRequeridos = {
    selectActividad,
    selectEquipo,
    selectTiempo,
    botonIniciar,
    etiquetaBoton,
    etiquetaTiempo,
    iconoActividad,
    anilloProgreso,
    elegidoActividad,
    elegidoEquipo,
    elegidoTiempo,
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

  poblarSelectTiempo();

  selectActividad.addEventListener('change', manejarCambioActividad);
  selectEquipo.addEventListener('change', manejarCambioEquipo);
  selectTiempo.addEventListener('change', manejarCambioTiempo);
  botonIniciar.addEventListener('click', alternarContador);

  // Si el PNG de la actividad no existe (asset sin trackear), caer a la imagen
  // por defecto; el chequeo evita un loop si también falla la de repuesto (REL-102)
  iconoActividad.addEventListener('error', () => {
    const actual = iconoActividad.src || '';
    if (actual.endsWith(IMAGENES_POR_DEFECTO[0])) return;
    iconoActividad.src = `${RUTA_IMAGENES}${IMAGENES_POR_DEFECTO[0]}`;
  });

  return true;
}

// Carga las actividades del usuario y deja la página lista (degradación segura)
async function cargarActividades(email) {
  let lista = [];
  const destino = typeof email === 'string' ? email.trim() : '';

  if (destino) {
    try {
      const respuesta = await fetch(
        `${ROOT_URL}/api/activities/${encodeURIComponent(destino)}`
      );
      if (respuesta.ok) {
        const datos = await respuesta.json();
        if (Array.isArray(datos)) {
          lista = datos.filter((item) => item && typeof item.name === 'string');
        }
      }
    } catch (err) {
      lista = []; // sin actividades la página funciona en modo degradado
    }
  }

  actividades = lista;
  poblarSelectActividad();
  restaurarUltimaSesion();
  reanudarSesionEnCurso();
  cargaCompleta = true; // último paso: recién ahí INICIAR puede persistir (REL-101)
}

// Verifica que esté logueado
window.addEventListener('DOMContentLoaded', async () => {
  const uiLista = inicializarUI();

  let emailUsuario = '';
  const controlador = new AbortController();
  const relojTimeout = setTimeout(() => controlador.abort(), 8000);
  try {
      const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
        method: 'GET',
        // credentials: 'include',                                            windows - android
        headers: {          
         "Authorization": `Bearer ${localStorage.getItem("token")}`        // iOS 
        },
        signal: controlador.signal
      });

      // Solo un token rechazado explícitamente cierra la sesión; cualquier otro
      // fallo (500, red, timeout) deja la página en modo degradado (REL-104)
      if (response.status === 401 || response.status === 403) {
        window.location.href = 'iniciarSesion.html';
        return;
      }

      if (response.ok) {
        let data = null;
        try {
          data = await response.json();
        } catch (err) {
          data = null; // JSON ilegible: sin saludo y sin redirect
        }

        const usuarioJWT = data && data.userJWT ? data.userJWT : null;
        const nombreElemento = document.getElementById('nombre');
        if (nombreElemento && usuarioJWT && typeof usuarioJWT.name === 'string') {
          const nombreFuerte = document.createElement('strong');
          nombreFuerte.textContent = `${usuarioJWT.name.toUpperCase()}!`;
          nombreElemento.textContent = '';
          nombreElemento.appendChild(nombreFuerte);
        }

        if (usuarioJWT && typeof usuarioJWT.email === 'string') {
          emailUsuario = usuarioJWT.email;
          emailSesion = emailUsuario; // namespace de claves de localStorage (REL-106)
        }
      }
    } catch (err) {
      // Red caída o timeout: seguir sin saludo y sin redirect (REL-104)
    } finally {
      clearTimeout(relojTimeout);
    }

  if (!uiLista) return; // la UI no se inicializó: no tocar nodos inexistentes
  await cargarActividades(emailUsuario);
  });
  
