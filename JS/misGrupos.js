// misGrupos.js
import { showToast, showConfirm } from "./utils.js";

// Verifica que esté logueado
async function checkAuthOrRedirect() {
  try {
    const res = await fetch(`${ROOT_URL}/api/sessions/current`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!res.ok) throw new Error();
    return true;
  } catch {
    window.location.href = "iniciarSesion.html";
    return false;
  }
}

/**
 * Normaliza un teléfono a E.164 canónico. Es el mismo criterio que aplica el
 * backend en `normalizarTelefonoE164` (src/utils.js): sin esta copia el front
 * no puede comparar un contacto con los miembros del grupo, porque los miembros
 * se guardan normalizados y los contactos pueden venir de cualquier formato.
 * El backend sigue siendo la autoridad: revalida y normaliza todo lo que llega.
 */
function normalizarTelefonoE164(input) {
  if (!input) return null;
  let tel = String(input).replace(/\D/g, "");
  if (tel.startsWith("0")) tel = tel.slice(1);
  if (tel.startsWith("549")) return `+${tel}`;
  if (tel.startsWith("54")) return `+549${tel.slice(2)}`;
  if (tel.startsWith("9")) return `+54${tel}`;
  return `+549${tel}`;
}

function normalizarContacto(c) {
  return {
    name: c.name || c.nombre || "",
    phone: c.phone || c.telefono || "",
  };
}

// *************************
// Tabla de selección de contactos
// La usan "Crear Grupo" y "Invitar" sobre un grupo existente: es la misma tabla
// con distinto destino, así que el estado vive en un contexto por instancia y
// las funciones de render lo reciben por parámetro en vez de leer variables
// sueltas.
// *************************

const PAGE_SIZE_GRUPO = 10;
const COLUMNAS_SELECCION = ["Nombre", "Integrantes", "Co-Admins"];

function crearContextoSeleccionGrupo(idContenedor, opciones = {}) {
  return {
    idContenedor,
    contactos: [],
    pagina: 1,
    busqueda: "",
    seleccionados: new Set(),
    admins: new Set(),
    // Teléfonos que no se ofrecen para seleccionar
    excluidos: opciones.excluir || new Set(),
  };
}

// Contexto de "Crear Grupo": el contenedor con este id ya está en el HTML
const contextoCrearGrupo = crearContextoSeleccionGrupo(
  "lista-contactos-para-grupo"
);

// Instancia de la tabla que se está mostrando en este momento
let contextoSeleccionActual = contextoCrearGrupo;

/**
 * Descarga los contactos del usuario y pinta la tabla de `ctx`. La tabla del
 * buscador vuelve a usar la instancia que tiene abierta, no la última creada.
 */
async function cargarContactosSeleccion(ctx) {
  try {
    const res = await fetch(`${ROOT_URL}/api/contacts`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!res.ok) throw new Error("Error al cargar contactos del usuario.");
    const { contactos } = await res.json();

    const normalizados = (contactos || []).map(normalizarContacto);

    const disponibles = normalizados.filter(
      (c) =>
        !ctx.excluidos.has(c.phone ? normalizarTelefonoE164(c.phone) : null)
    );

    const filtradosPorBusqueda = ctx.busqueda
      ? disponibles.filter(
          (c) =>
            c.name.toLowerCase().includes(ctx.busqueda) ||
            c.phone.includes(ctx.busqueda)
        )
      : disponibles;

    ctx.contactos = filtradosPorBusqueda;
    ctx.pagina = 1;
    renderizarCabeceraSeleccion(ctx);
    renderizarFilasSeleccion(ctx);
  } catch (err) {
    console.error("Error al cargar contactos para selección:", err.message);
    showToast("Error al cargar tus contactos para selección.", "error");
  }
}

// Entrada pública que usa el toggle de "Crear Grupo" y el buscador
window.loadContactsForGroupSelection = async function () {
  return cargarContactosSeleccion(contextoSeleccionActual);
};

function renderizarCabeceraSeleccion(ctx) {
  const container = document.getElementById(ctx.idContenedor);
  if (!container) {
    console.error(`Contenedor #${ctx.idContenedor} no encontrado.`);
    return;
  }

  // Si la cabecera ya está renderizada, terminar.
  let existingHeaderWrapper = container.querySelector(
    ".contactos-header-wrapper-grupo"
  );
  if (existingHeaderWrapper) {
    const searchInput =
      existingHeaderWrapper.querySelector("input[type='text']");
    if (searchInput) {
      searchInput.value = ctx.busqueda;
    }
    return;
  }

  // Limpia cualquier paginador anterior
  const existingPaginador = container.querySelector(".paginador-para-grupo");
  if (existingPaginador) {
    existingPaginador.remove();
  }

  const headerWrapper = document.createElement("div");
  headerWrapper.classList.add(
    "contactos-header-wrapper",
    "contactos-header-wrapper-grupo"
  );
  headerWrapper.style.backgroundColor = "rgba(0,0,0,0.2)"; // Estilo para diferenciar

  const searchWrapper = document.createElement("div");
  searchWrapper.style.margin = "0 auto 0.5em auto";
  searchWrapper.style.display = "flex";
  searchWrapper.style.alignItems = "center";
  searchWrapper.style.gap = "0.5em";
  searchWrapper.style.maxWidth = "440px";

  const searchIcon = document.createElement("i");
  searchIcon.className = "fas fa-search";
  searchIcon.style.color = "white";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Buscar contacto...";
  searchInput.style.flex = "1";
  searchInput.style.padding = "0.3em 0.5em";
  searchInput.style.borderRadius = "0.3em";
  searchInput.style.border = "1px solid #ccc";
  searchInput.style.width = "100%";
  searchInput.style.boxSizing = "border-box";
  searchInput.value = ctx.busqueda;

  searchWrapper.appendChild(searchIcon);
  searchWrapper.appendChild(searchInput);
  headerWrapper.appendChild(searchWrapper);

  const header = document.createElement("div");
  header.classList.add("contactos-header");
  header.style.display = "flex";
  header.style.fontWeight = "bold";
  header.style.color = "white";
  header.style.gap = "1em";
  header.style.marginBottom = "0.5em";
  header.style.flexWrap = "wrap";

  COLUMNAS_SELECCION.forEach((title, i) => {
    const col = document.createElement("div");
    col.textContent = title;
    col.style.flex = i === 0 ? "2" : "1"; // Nombre es más ancho
    col.style.textAlign = "center";
    col.style.minWidth = "0";
    col.style.overflow = "hidden";
    col.style.textOverflow = "ellipsis";
    header.appendChild(col);
  });

  headerWrapper.appendChild(header);
  container.appendChild(headerWrapper);

  searchInput.addEventListener("input", async () => {
    ctx.busqueda = searchInput.value.trim().toLowerCase();
    await cargarContactosSeleccion(ctx);
  });
}

function renderizarFilasSeleccion(ctx) {
  const container = document.getElementById(ctx.idContenedor);
  if (!container) {
    console.error(
      `Contenedor #${ctx.idContenedor} no encontrado para renderizar filas.`
    );
    return;
  }

  let body = container.querySelector(".lista-contactos-body");
  if (!body) {
    body = document.createElement("div");
    body.className = "lista-contactos-body";
    container.appendChild(body);
  }

  body.innerHTML = ""; // Borra filas renderizadas

  if (ctx.contactos.length === 0) {
    body.innerHTML = `<p style="color:white; text-align:center; padding:1em;">No se encontraron contactos para seleccionar.</p>`;
    renderizarControlesPaginadoSeleccion(ctx);
    return;
  }

  const desde = (ctx.pagina - 1) * PAGE_SIZE_GRUPO;
  const hasta = ctx.pagina * PAGE_SIZE_GRUPO;
  const visibles = ctx.contactos.slice(desde, hasta);

  visibles.forEach((c) => {
    const row = document.createElement("div");
    row.classList.add("contacto-row-grupo");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.marginBottom = "0.5em";
    row.style.gap = "1em";
    row.style.color = "white";
    row.style.flexWrap = "wrap";

    // Checkbox de selección para añadir al grupo
    const checkboxSeleccion = document.createElement("input");
    checkboxSeleccion.type = "checkbox";
    checkboxSeleccion.className = "checkbox-input-grupo";

    // Checkbox de Co-Administrador
    const checkboxAdmin = document.createElement("input");
    checkboxAdmin.type = "checkbox";
    checkboxAdmin.className = "checkbox-input-grupo-admin";

    // Restaurar estados
    checkboxSeleccion.checked = ctx.seleccionados.has(c.phone);
    checkboxAdmin.checked = ctx.admins.has(c.phone);

    // Admin solo si es integrante
    checkboxAdmin.disabled = !checkboxSeleccion.checked;

    // 🔗 Evento integrante
    checkboxSeleccion.addEventListener("change", () => {
      if (!c.phone) return;

      if (checkboxSeleccion.checked) {
        ctx.seleccionados.add(c.phone);
        checkboxAdmin.disabled = false;
      } else {
        ctx.seleccionados.delete(c.phone);
        checkboxAdmin.checked = false;
        checkboxAdmin.disabled = true;
        ctx.admins.delete(c.phone);
      }
    });

    // 👑 Evento admin
    checkboxAdmin.addEventListener("change", () => {
      if (!c.phone) return;

      if (checkboxAdmin.checked) {
        ctx.admins.add(c.phone);
      } else {
        ctx.admins.delete(c.phone);
      }
    });

    const nombreCol = document.createElement("div");
    nombreCol.style.flex = "2";
    nombreCol.style.minWidth = "120px";
    nombreCol.style.textAlign = "left";

    const nombreSpan = document.createElement("div");
    nombreSpan.textContent = c.name;
    nombreSpan.style.fontWeight = "bold";

    const telefonoSpan = document.createElement("div");
    telefonoSpan.textContent = c.phone || "(sin teléfono)";
    telefonoSpan.style.fontSize = "0.9em";
    telefonoSpan.style.opacity = "0.8";

    const seleccionCol = document.createElement("div");
    seleccionCol.style.flex = "1";
    seleccionCol.style.textAlign = "center";
    seleccionCol.appendChild(checkboxSeleccion);

    const adminCol = document.createElement("div");
    adminCol.style.flex = "1";
    adminCol.style.textAlign = "center";
    adminCol.appendChild(checkboxAdmin);

    nombreCol.appendChild(nombreSpan);
    nombreCol.appendChild(telefonoSpan);

    row.appendChild(nombreCol);
    row.appendChild(seleccionCol);
    row.appendChild(adminCol);

    body.appendChild(row);
  });

  renderizarControlesPaginadoSeleccion(ctx);
}

function renderizarControlesPaginadoSeleccion(ctx) {
  const container = document.getElementById(ctx.idContenedor);
  if (!container) return;

  const paginador = document.createElement("div");
  paginador.className = "paginador-para-grupo";
  paginador.style.textAlign = "center";
  paginador.style.marginTop = "1em";
  paginador.style.color = "white";

  const totalPaginas = Math.ceil(ctx.contactos.length / PAGE_SIZE_GRUPO);

  const crearBoton = (texto, habilitado, accion) => {
    const btn = document.createElement("button");
    btn.textContent = texto;
    btn.disabled = !habilitado;
    btn.style.margin = "0 0.3em";
    btn.style.padding = "0.3em 0.3em";
    btn.style.borderRadius = "0.3em";
    btn.style.border = "none";
    btn.style.cursor = habilitado ? "pointer" : "default";
    btn.style.backgroundColor = habilitado ? "#007bff" : "#6c757d";
    btn.style.color = "white";
    if (habilitado) btn.addEventListener("click", accion);
    return btn;
  };

  const irAPagina = (nueva) => {
    ctx.pagina = nueva;
    renderizarFilasSeleccion(ctx);
  };

  paginador.appendChild(
    crearBoton("⏮", ctx.pagina > 1, () => irAPagina(1))
  );

  paginador.appendChild(
    crearBoton("◀", ctx.pagina > 1, () => irAPagina(ctx.pagina - 1))
  );

  const input = document.createElement("input");
  input.type = "number";
  input.min = 1;
  input.max = totalPaginas;
  input.value = ctx.pagina;
  input.style.width = "40px";
  input.style.textAlign = "center";
  input.style.margin = "0 0.3em";
  input.style.padding = "0.3em 0.5em";
  input.style.borderRadius = "0.3em";
  input.style.border = "1px solid #ccc";
  input.addEventListener("change", () => {
    const nueva = parseInt(input.value);
    if (!isNaN(nueva) && nueva >= 1 && nueva <= totalPaginas) {
      irAPagina(nueva);
    } else {
      input.value = ctx.pagina;
    }
  });

  const span = document.createElement("span");
  span.textContent = ` / ${totalPaginas}`;
  span.style.margin = "0 0.3em";

  paginador.appendChild(input);
  paginador.appendChild(span);

  paginador.appendChild(
    crearBoton("▶", ctx.pagina < totalPaginas, () => irAPagina(ctx.pagina + 1))
  );

  paginador.appendChild(
    crearBoton("⏭", ctx.pagina < totalPaginas, () => irAPagina(totalPaginas))
  );

  container.appendChild(paginador);
}

// En el contexto de MIS GRUPOS, esta función debería actualizar la información de un GRUPO,
// o si es para contactos seleccionados para un grupo, debería ir en el código de selección
// de contactos, y no tener el mismo nombre que la de mis contactos.
// Por ahora, la dejaré como está, pero la renombro para evitar confusión y uso `_id`.
async function actualizarContactoParaGrupo(contactId, messages, visibility) {
  try {
    const response = await fetch(`${ROOT_URL}/api/contacts/${contactId}`, {
      // Asumo PUT /api/contacts/:id
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ messages, visibility }),
    });

    if (!response.ok) {
      const err = await response.json();
      showToast("Error al actualizar contacto: " + err.error, "error");
    } else {
      showToast(
        "Preferencias del contacto actualizadas (en grupo).",
        "success"
      );
    }
  } catch (err) {
    console.error("Error al actualizar contacto para grupo:", err);
    showToast("No se pudo conectar con el servidor", "error");
  }
}

// *************************
// Código principal de misGrupos
// *************************

window.addEventListener("DOMContentLoaded", async () => {
  // Verificar login
  try {
    const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!response.ok) throw new Error("Token inválido");
  } catch (err) {
    window.location.href = "iniciarSesion.html";
    return;
  }

  // Toggle "Mis Grupos"
  const toggleMisGrupos = document.getElementById("toggleMisGrupos");
  const listaMisGruposExistentes = document.getElementById(
    "lista-mis-grupos-existentes"
  );

  if (toggleMisGrupos && listaMisGruposExistentes) {
    const icon = toggleMisGrupos.querySelector("i");
    toggleMisGrupos.addEventListener("click", async () => {
      const isVisible = listaMisGruposExistentes.style.display === "block";
      listaMisGruposExistentes.style.display = isVisible ? "none" : "block";
      if (icon) icon.classList.toggle("rotate", !isVisible);

      if (!isVisible) {
        // Cargar y renderizar TUS GRUPOS EXISTENTES
        await loadMyExistingGroups();
      }
    });
  } else {
    console.warn(
      "Elemento #toggleMisGrupos o #lista-mis-grupos-existentes no encontrado."
    );
  }

  // Toggle "Crear Grupo"
  const toggleCrearGrupoForm = document.getElementById("toggleCrearGrupoForm");
  const contenedorFormularioCrearGrupo = document.getElementById(
    "contenedor-formulario-crear-grupo"
  );
  const listaContactosParaGrupo = document.getElementById(
    "lista-contactos-para-grupo"
  );

  if (
    toggleCrearGrupoForm &&
    contenedorFormularioCrearGrupo &&
    listaContactosParaGrupo
  ) {
    const icon = toggleCrearGrupoForm.querySelector("i");
    toggleCrearGrupoForm.addEventListener("click", async () => {
      const isVisible =
        contenedorFormularioCrearGrupo.style.display === "block";
      contenedorFormularioCrearGrupo.style.display = isVisible
        ? "none"
        : "block";
      if (icon) icon.classList.toggle("rotate", !isVisible);

      if (!isVisible) {
        // La tabla de esta sección siempre es la misma instancia
        contextoSeleccionActual = contextoCrearGrupo;
        listaContactosParaGrupo.style.display = "block";
        await window.loadContactsForGroupSelection();
        //showToast('Tus contactos se han cargado para seleccionar.', 'success');
      } else {
        // Cierra Crear Grupo
        listaContactosParaGrupo.style.display = "none";
        // RESETEAR selección de checkboxes
        contextoCrearGrupo.seleccionados.clear();
        contextoCrearGrupo.admins.clear();
      }
    });
  } else {
    console.warn(
      "Uno o más elementos para 'Crear Grupo' (toggleCrearGrupoForm, contenedorFormularioCrearGrupo, listaContactosParaGrupo) no fueron encontrados."
    );
  }

  // Toggle "Invitaciones Pendientes"
  const toggleInvitaciones = document.getElementById(
    "toggleInvitacionesPendientes"
  );
  const listaInvitaciones = document.getElementById(
    "lista-invitaciones-pendientes"
  );

  if (toggleInvitaciones && listaInvitaciones) {
    const icon = toggleInvitaciones.querySelector("i");

    toggleInvitaciones.addEventListener("click", async () => {
      const visible = listaInvitaciones.style.display === "block";
      listaInvitaciones.style.display = visible ? "none" : "block";
      if (icon) icon.classList.toggle("rotate", !visible);

      if (!visible) {
        await cargarInvitacionesPendientes();
      }
    });
  }
});

const btnCrearGrupo = document.getElementById("crear-grupo-btn");

if (btnCrearGrupo) {
  btnCrearGrupo.addEventListener("click", async () => {
    const nombreGrupo = document.getElementById("nombre-grupo").value.trim();
    const actividadGrupo = document.getElementById("actividad").value.trim();
    const members = Array.from(contextoCrearGrupo.seleccionados);
    const admins = Array.from(contextoCrearGrupo.admins);

    if (!nombreGrupo || !actividadGrupo) {
      showToast("Completá el nombre y la actividad.", "error");
      return;
    }

    if (members.length === 0) {
      showToast("Seleccioná al menos un contacto.", "error");
      return;
    }

    try {
      const res = await fetch(`${ROOT_URL}/api/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name: nombreGrupo,
          activity: actividadGrupo,
          members, // 👈 phones
          admins,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "No se pudo crear el grupo", "error");
        return;
      }

      showToast("Grupo creado con éxito 🎉", "success");

      // 📌 Vaciar selección
      contextoCrearGrupo.seleccionados.clear();
      contextoCrearGrupo.admins.clear();

      // Volver a renderizar la lista (para desmarcar checkboxes visualmente)
      await window.loadContactsForGroupSelection();

      // 📌 Vaciar inputs
      document.getElementById("nombre-grupo").value = "";
      document.getElementById("actividad").value = "";

      // 📌 Cerrar formulario
      document.getElementById(
        "contenedor-formulario-crear-grupo"
      ).style.display = "none";
      document.getElementById("lista-contactos-para-grupo").style.display =
        "none";
    } catch (err) {
      console.error(err);
      showToast("Error de conexión", "error");
    }
  });
}

// función para aceptar o rechazar invitación
async function cargarInvitacionesPendientes() {
  try {
    const res = await fetch(`${ROOT_URL}/api/groups/pending`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!res.ok) throw new Error();

    const { groups } = await res.json();
    renderizarInvitacionesPendientes(groups);
  } catch (err) {
    console.error(err);
    showToast("Error al cargar invitaciones", "error");
  }
}

async function responderInvitacion(groupId, accepted) {
  try {
    const res = await fetch(`${ROOT_URL}/api/groups/${groupId}/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ accepted }),
    });

    if (!res.ok) throw new Error();

    showToast(
      accepted ? "Invitación aceptada" : "Invitación rechazada",
      "success"
    );

    cargarInvitacionesPendientes();
  } catch (err) {
    console.error(err);
    showToast("Error al responder invitación", "error");
  }
}

// Escapa texto antes de interpolarlo en innerHTML (XSS).
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
// Render de integrantes: fuente única de rol y estado
// Lo usan "Invitaciones pendientes" y "Mis Grupos", así que la lógica de
// rol/estado no puede quedar duplicada en los dos renderizadores.
// ============================================================

// Etiqueta y clase de color del estado de un invitado.
function estadoDeInvitacion(accepted) {
  if (accepted === true) return { texto: "✅ Aceptada", clase: "estado-aceptada" };
  if (accepted === false)
    return { texto: "❌ Rechazada", clase: "estado-rechazada" };
  return { texto: "⏳ Pendiente", clase: "estado-pendiente" };
}

// Etiqueta del rol de un miembro dentro del grupo.
function rolDeMiembro(group, member) {
  if (member.phone === group.owner) return "👑 Creador";
  const admins = Array.isArray(group.admins) ? group.admins : [];
  if (admins.includes(member.phone)) return "⭐ Co-Admin";
  return "Miembro";
}

/**
 * Arma la lista de integrantes de un grupo.
 * @param {object} group  grupo con `members`, `admins` y `owner`
 * @param {object} opciones
 *   - `userPhone`: teléfono del usuario actual (para decidir si puede quitar)
 *   - `mostrarQuitar`: agrega el botón "Quitar" a las filas que puede tocar
 * Devuelve un <div> con las filas. Se arma con textContent, así que no hace
 * falta escapar: escribir en textContent nunca interpreta HTML.
 */
function renderizarMiembrosGrupo(group, opciones = {}) {
  const { userPhone = null, mostrarQuitar = false } = opciones;
  const members = Array.isArray(group.members) ? group.members : [];

  const lista = document.createElement("div");
  lista.className = "invitacion-miembros";

  members.forEach((m) => {
    const esCreador = m.phone === group.owner;
    const { texto: estado, clase: claseEstado } = estadoDeInvitacion(
      m.accepted
    );
    const displayName = m.name && m.name.trim() !== "" ? m.name : m.phone;

    const row = document.createElement("div");
    row.className = "invitacion-miembro";
    row.dataset.phone = m.phone || "";

    const nombre = document.createElement("div");
    nombre.className = "miembro-nombre";
    nombre.textContent = displayName;

    const rol = document.createElement("div");
    rol.className = "miembro-rol";
    rol.textContent = rolDeMiembro(group, m);

    const estadoEl = document.createElement("div");
    estadoEl.className = `miembro-estado ${claseEstado}`;
    estadoEl.textContent = estado;

    row.appendChild(nombre);
    row.appendChild(rol);
    row.appendChild(estadoEl);

    // Nunca se ofrece quitar al creador, ni siquiera al owner o a un admin
    if (mostrarQuitar && !esCreador && elUsuarioAdministraElGrupo(group, userPhone)) {
      const btnQuitar = document.createElement("button");
      btnQuitar.type = "button";
      btnQuitar.className = "btn-quitar-miembro";
      btnQuitar.textContent = "Quitar";
      btnQuitar.onclick = () => quitarMiembroDelGrupo(group, m.phone, displayName);
      row.appendChild(btnQuitar);
    }

    lista.appendChild(row);
  });

  return lista;
}

function renderizarInvitacionesPendientes(groups) {
  const container = document.getElementById("lista-invitaciones-pendientes");
  if (!container) return;

  container.innerHTML = "";

  if (!groups || !groups.length) {
    container.innerHTML = `
      <p style="color:white; text-align:center; padding:1em;">
        No tenés invitaciones pendientes
      </p>`;
    return;
  }

  groups.forEach((group) => {
    const wrapper = document.createElement("div");
    wrapper.className = "invitacion-grupo-wrapper";

    /* ===== CABECERA ===== */
    const header = document.createElement("div");
    header.className = "invitacion-header";
    header.innerHTML = `
      <div>
        <strong>${escapeHtml(group.name)}</strong>
        <div class="invitacion-actividad">${escapeHtml(group.activity)}</div>
      </div>
      <i class="fas fa-chevron-down"></i>
    `;

    /* ===== DETALLE ===== */
    const detalle = document.createElement("div");
    detalle.className = "invitacion-detalle";
    detalle.style.display = "none";

    // En esta vista el usuario es el invitado, no administra el grupo: se
    // muestran los mismos datos que antes, sin acciones de quitar.
    detalle.appendChild(renderizarMiembrosGrupo(group, { mostrarQuitar: false }));

    /* ===== ACCIONES ===== */
    const actions = document.createElement("div");
    actions.className = "invitacion-actions";

    const btnAceptar = document.createElement("button");
    btnAceptar.textContent = "Aceptar";
    btnAceptar.className = "btn-guardar-contacto";
    btnAceptar.onclick = () => responderInvitacion(group._id, true);

    const btnRechazar = document.createElement("button");
    btnRechazar.textContent = "Rechazar";
    btnRechazar.className = "btn-cancelar-contacto";
    btnRechazar.onclick = () => responderInvitacion(group._id, false);

    actions.appendChild(btnAceptar);
    actions.appendChild(btnRechazar);

    /* ===== TOGGLE ===== */
    header.addEventListener("click", () => {
      detalle.style.display =
        detalle.style.display === "none" ? "block" : "none";
      const icon = header.querySelector("i");
      if (icon) icon.classList.toggle("rotate");
    });

    wrapper.appendChild(header);
    wrapper.appendChild(detalle);
    wrapper.appendChild(actions);
    container.appendChild(wrapper);
  });
}

// ============================================================
// MIS GRUPOS (grupos donde soy creador o acepté la invitación)
// ============================================================

// Lee el teléfono del usuario actual desde el payload del JWT.
// Ya normalizado: los miembros y el owner del grupo siempre se guardan en E.164,
// así que comparar contra el teléfono crudo del JWT fallaría en silencio.
// Devuelve null si no se puede decodificar, para degradar sin romper.
function getCurrentUserPhone() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    // JWT usa base64url: padding + alfabeto alternativo
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const data = JSON.parse(atob(padded));
    if (!data || data.phone == null) return null;
    return normalizarTelefonoE164(String(data.phone));
  } catch {
    return null;
  }
}

// El owner o un co-admin administran los integrantes del grupo
function elUsuarioAdministraElGrupo(group, userPhone) {
  if (!userPhone) return false;
  if (group.owner === userPhone) return true;
  const admins = Array.isArray(group.admins) ? group.admins : [];
  return admins.includes(userPhone);
}

// Quita a un integrante del grupo. Solo owner y admins llegan hasta acá.
async function quitarMiembroDelGrupo(group, phone, nombreMostrado) {
  const ok = await showConfirm(
    `¿Querés quitar a ${nombreMostrado} del grupo? Si lo sacás, después lo podés volver a invitar.`
  );
  if (!ok) return;

  try {
    const res = await fetch(
      `${ROOT_URL}/api/groups/${encodeURIComponent(
        group._id
      )}/members/${encodeURIComponent(phone)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || "No se pudo quitar al miembro", "error");
      return;
    }

    showToast("Miembro removido", "success");
    await loadMyExistingGroups();
  } catch (err) {
    console.error("Error al quitar miembro del grupo:", err);
    showToast("Error de conexión", "error");
  }
}

// Panel de invitación: reutiliza la misma tabla de selección de contactos que
// usa "Crear Grupo", con su propio contexto y su propio contenedor.
function construirPanelInvitacion(group) {
  // Los que ya son miembros no se ofrecen: el back los rechaza con
  // "Ya es miembro del grupo" y no hay forma de reinvitar sin quitarlos antes.
  const yaMiembros = new Set(
    (Array.isArray(group.members) ? group.members : []).map((m) =>
      normalizarTelefonoE164(m.phone)
    )
  );

  const ctx = crearContextoSeleccionGrupo(
    `lista-contactos-invitacion-${group._id}`,
    { excluir: yaMiembros }
  );

  const panel = document.createElement("div");
  panel.className = "invitacion-panel";

  const barra = document.createElement("div");
  barra.className = "invitacion-panel-barra";

  const btnConfirmar = document.createElement("button");
  btnConfirmar.type = "button";
  btnConfirmar.className = "btn-guardar-contacto";
  btnConfirmar.textContent = "Enviar invitaciones";
  btnConfirmar.onclick = () => confirmarInvitacionMiembros(group, ctx);

  const btnCancelar = document.createElement("button");
  btnCancelar.type = "button";
  btnCancelar.className = "btn-cancelar-contacto";
  btnCancelar.textContent = "Cerrar";
  btnCancelar.onclick = () => panel.remove();

  barra.appendChild(btnConfirmar);
  barra.appendChild(btnCancelar);

  const lista = document.createElement("div");
  lista.id = ctx.idContenedor;
  lista.className = "contactos-lista";

  panel.appendChild(barra);
  panel.appendChild(lista);

  return { panel, ctx };
}

async function confirmarInvitacionMiembros(group, ctx) {
  const members = Array.from(ctx.seleccionados);

  if (members.length === 0) {
    showToast("Seleccioná al menos un contacto.", "error");
    return;
  }

  const admins = Array.from(ctx.admins);

  try {
    const res = await fetch(
      `${ROOT_URL}/api/groups/${encodeURIComponent(group._id)}/members`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ members, admins }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      showToast(
        err.error || "No se pudieron enviar las invitaciones",
        "error"
      );
      return;
    }

    showToast("Invitaciones enviadas", "success");
    // El refresh redibuja la lista y se lleva el panel con ella
    await loadMyExistingGroups();
  } catch (err) {
    console.error("Error al invitar miembros al grupo:", err);
    showToast("Error de conexión", "error");
  }
}

async function loadMyExistingGroups() {
  const container = document.getElementById("lista-mis-grupos-existentes");
  if (!container) {
    console.error("Contenedor #lista-mis-grupos-existentes no encontrado.");
    return;
  }

  // Estado de carga
  container.innerHTML = `<p style="color:white; text-align:center; padding:1em;">Cargando grupos...</p>`;

  try {
    const res = await fetch(`${ROOT_URL}/api/groups`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!res.ok) throw new Error("Error al cargar tus grupos");

    const data = await res.json();
    renderizarMisGrupos(data && data.groups);
  } catch (err) {
    console.error(err);
    showToast("Error al cargar tus grupos", "error");
    container.innerHTML = `<p style="color:white; text-align:center; padding:1em;">No se pudieron cargar tus grupos. Intentá de nuevo.</p>`;
  }
}

function renderizarMisGrupos(groups) {
  const container = document.getElementById("lista-mis-grupos-existentes");
  if (!container) return;

  container.innerHTML = "";

  if (!groups || !groups.length) {
    container.innerHTML = `
      <p style="color:white; text-align:center; padding:1em;">
        No tenés grupos todavía
      </p>`;
    return;
  }

  const myPhone = getCurrentUserPhone();

  groups.forEach((group) => {
    const members = Array.isArray(group.members) ? group.members : [];
    const administra = elUsuarioAdministraElGrupo(group, myPhone);

    // Rol del usuario actual dentro del grupo
    let rol = "Miembro";
    if (administra) rol = group.owner === myPhone ? "👑 Creador" : "⭐ Co-Admin";

    /* ===== WRAPPER ===== */
    const wrapper = document.createElement("div");
    wrapper.className = "invitacion-grupo-wrapper";

    /* ===== CABECERA ===== */
    const header = document.createElement("div");
    header.className = "invitacion-header";

    const info = document.createElement("div");

    const nombre = document.createElement("strong");
    nombre.className = "invitacion-nombre";
    nombre.textContent = group.name || "(sin nombre)";

    const actividad = document.createElement("div");
    actividad.className = "invitacion-actividad";
    actividad.textContent = group.activity || "(sin actividad)";

    const meta = document.createElement("div");
    meta.className = "invitacion-meta";
    meta.textContent = `${rol} · ${members.length} integrantes`;

    info.appendChild(nombre);
    info.appendChild(actividad);
    info.appendChild(meta);

    const icon = document.createElement("i");
    icon.className = "fas fa-chevron-down";

    header.appendChild(info);
    header.appendChild(icon);

    /* ===== DETALLE ===== */
    const detalle = document.createElement("div");
    detalle.className = "invitacion-detalle";
    detalle.style.display = "none";

    // Lista real de integrantes, con la misma fuente de rol/estado que usa
    // "Invitaciones pendientes"
    detalle.appendChild(
      renderizarMiembrosGrupo(group, {
        userPhone: myPhone,
        mostrarQuitar: administra,
      })
    );

    /* ===== ACCIONES ===== */
    const actions = document.createElement("div");
    actions.className = "invitacion-actions";

    const btnEnviar = document.createElement("button");
    btnEnviar.type = "button";
    btnEnviar.textContent = "Enviar mensaje";
    btnEnviar.className = "btn-guardar-contacto";
    btnEnviar.disabled = true; // sin flujo de envío de mensajes todavía

    actions.appendChild(btnEnviar);

    // Solo owner y co-admins pueden invitar gente nueva al grupo
    if (administra) {
      const btnInvitar = document.createElement("button");
      btnInvitar.type = "button";
      btnInvitar.className = "btn-cancelar-contacto";
      btnInvitar.textContent = "Invitar";

      btnInvitar.onclick = () => {
        const existente = detalle.querySelector(".invitacion-panel");
        if (existente) {
          existente.remove();
          return;
        }

        // El botón vive fuera del desplegable: si el detalle estaba cerrado hay
        // que abrirlo, o el panel se agrega a algo invisible.
        if (detalle.style.display === "none") {
          detalle.style.display = "block";
          icon.classList.add("rotate");
        }

        const { panel, ctx } = construirPanelInvitacion(group);
        detalle.appendChild(panel);
        // La tabla busca sus contactos con su propio contexto, así que no hace
        // falta que la tabla global apunte acá
        cargarContactosSeleccion(ctx);
      };

      actions.appendChild(btnInvitar);
    }

    /* ===== TOGGLE ===== */
    header.addEventListener("click", () => {
      detalle.style.display =
        detalle.style.display === "none" ? "block" : "none";
      icon.classList.toggle("rotate");
    });

    wrapper.appendChild(header);
    wrapper.appendChild(detalle);
    wrapper.appendChild(actions);
    container.appendChild(wrapper);
  });
}
