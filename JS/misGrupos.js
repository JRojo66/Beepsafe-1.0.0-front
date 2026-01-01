// misGrupos.js (CORREGIDO)
import { showToast, showConfirm } from "./utils.js";

// --- Variables globales para PAGINACIÓN Y BÚSQUEDA de "Crear Grupo" ---
let contactosGrupoCompleta = [];
let paginaActualGrupo = 1;
const PAGE_SIZE_GRUPO = 10;
let terminoBusquedaGrupo = "";
let contactosSeleccionadosParaGrupo = new Set();

// Referencias a los contenedores DOM específicos para la selección de contactos para un grupo
let listaContactosParaGrupoContainer = null;
let listaContactosParaGrupoBody = null;

window.loadContactsForGroupSelection = async function () {
  try {
    const res = await fetch(`${ROOT_URL}/api/contacts`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!res.ok) throw new Error("Error al cargar contactos del usuario.");
    const { contactos } = await res.json();

    // Aplica la búsqueda actual si hay un término
    const filtradosPorBusqueda = terminoBusquedaGrupo
      ? contactos.filter(
          (c) =>
            c.nombre.toLowerCase().includes(terminoBusquedaGrupo) ||
            (c.telefono && c.telefono.includes(terminoBusquedaGrupo))
        )
      : contactos;

    renderizarContactosParaGrupo(filtradosPorBusqueda);
  } catch (err) {
    console.error("Error al cargar contactos para selección:", err.message);
    showToast("Error al cargar tus contactos para selección.", "error");
  }
};

function renderizarContactosParaGrupo(contactos) {
  contactosGrupoCompleta = contactos;
  paginaActualGrupo = 1;
  renderizarCabeceraParaGrupo();
  renderizarFilasParaGrupo();
}

async function renderizarCabeceraParaGrupo() {
  listaContactosParaGrupoContainer = document.getElementById(
    "lista-contactos-para-grupo"
  );
  if (!listaContactosParaGrupoContainer) {
    console.error("Contenedor #lista-contactos-para-grupo no encontrado.");
    return;
  }

  // Si la cabecera ya está renderizada, terminar.
  let existingHeaderWrapper = listaContactosParaGrupoContainer.querySelector(
    ".contactos-header-wrapper-grupo"
  );
  if (existingHeaderWrapper) {
    const searchInput =
      existingHeaderWrapper.querySelector("input[type='text']");
    if (searchInput) {
      searchInput.value = terminoBusquedaGrupo;
    }
    return;
  }

  // Limpia cualquier paginador anterior
  let existingPaginador = listaContactosParaGrupoContainer.querySelector(
    "#paginador-para-grupo"
  );
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
  searchInput.value = terminoBusquedaGrupo;

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

  const columnas = [
    "Nombre",
    //"Seleccionar",
    "Integrantes",
    // "Mensajes",
    // "Visibilidad",
  ];

  columnas.forEach((title, i) => {
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
  listaContactosParaGrupoContainer.appendChild(headerWrapper);

  listaContactosParaGrupoBody = listaContactosParaGrupoContainer.querySelector(
    "#lista-contactos-para-grupo-body"
  );
  if (!listaContactosParaGrupoBody) {
    listaContactosParaGrupoBody = document.createElement("div");
    listaContactosParaGrupoBody.id = "lista-contactos-para-grupo-body";
    listaContactosParaGrupoContainer.appendChild(listaContactosParaGrupoBody);
  }

  searchInput.addEventListener("input", async () => {
    terminoBusquedaGrupo = searchInput.value.trim().toLowerCase();
    await window.loadContactsForGroupSelection();
  });
}

function renderizarFilasParaGrupo() {
  if (!listaContactosParaGrupoBody) {
    console.error(
      "Contenedor #lista-contactos-para-grupo-body no encontrado para renderizar filas."
    );
    return;
  }

  listaContactosParaGrupoBody.innerHTML = ""; // Borra filas renderizadas

  if (contactosGrupoCompleta.length === 0) {
    listaContactosParaGrupoBody.innerHTML = `<p style="color:white; text-align:center; padding:1em;">No se encontraron contactos para seleccionar.</p>`;
    renderizarControlesPaginadoParaGrupo();
    return;
  }

  const desde = (paginaActualGrupo - 1) * PAGE_SIZE_GRUPO;
  const hasta = paginaActualGrupo * PAGE_SIZE_GRUPO;
  const visibles = contactosGrupoCompleta.slice(desde, hasta);

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
    const checkboxSeleccionGrupo = document.createElement("input");
    checkboxSeleccionGrupo.type = "checkbox";
    checkboxSeleccionGrupo.name = `select-contact-${c._id}`;
    checkboxSeleccionGrupo.className = "checkbox-input-grupo";

    // 🆕 Mantener seleccionados aunque se re-renderice
    checkboxSeleccionGrupo.checked = contactosSeleccionadosParaGrupo.has(c._id);

    // 🆕 Evento para actualizar el estado global
    checkboxSeleccionGrupo.addEventListener("change", () => {
      if (checkboxSeleccionGrupo.checked) {
        contactosSeleccionadosParaGrupo.add(c._id);
      } else {
        contactosSeleccionadosParaGrupo.delete(c._id);
        contactosAdminParaGrupo.delete(c._id); // seguridad si admin existe
      }
    });
    // Aquí podrías comprobar si el contacto ya está seleccionado en la lista temporal del formulario de grupo
    // checkboxSeleccionGrupo.checked = selectedContactIds.includes(c._id);

    const seleccionCol = document.createElement("div");
    seleccionCol.appendChild(checkboxSeleccionGrupo);
    seleccionCol.style.flex = "1";
    seleccionCol.style.textAlign = "center";

    // // 🆕 Checkbox de Administrador
    // const checkboxAdmin = document.createElement("input");
    // checkboxAdmin.type = "checkbox";
    // checkboxAdmin.name = `admin-contact-${c._id}`;
    // checkboxAdmin.className = "checkbox-input-grupo-admin";
    // checkboxAdmin.disabled = true; // ⚠️ Deshabilitado por defecto

    // const adminCol = document.createElement("div");
    // adminCol.appendChild(checkboxAdmin);
    // adminCol.style.flex = "1";
    // adminCol.style.textAlign = "center";

    // // Lógica de habilitación/deshabilitación
    // checkboxSeleccionGrupo.addEventListener("change", () => {
    //   const isChecked = checkboxSeleccionGrupo.checked;
    //   checkboxAdmin.disabled = !isChecked; // Habilita si está seleccionado
    //   if (!isChecked) {
    //     checkboxAdmin.checked = false; // Desmarca si se deselecciona el contacto
    //   }
    // });
    // // Fin de la lógica de habilitación/deshabilitación

    const nombreColMC = document.createElement("div");
    nombreColMC.style.flex = "2";
    nombreColMC.style.minWidth = "120px";
    nombreColMC.style.textAlign = "left";

    const nombreSpan = document.createElement("div");
    nombreSpan.textContent = c.nombre;
    nombreSpan.style.fontWeight = "bold";

    const telefonoSpan = document.createElement("div");
    telefonoSpan.textContent = c.telefono || "(sin teléfono)";
    telefonoSpan.style.fontSize = "0.9em";
    telefonoSpan.style.opacity = "0.8";

    nombreColMC.appendChild(nombreSpan);
    nombreColMC.appendChild(telefonoSpan);

    // Mostrar el estado de mensajes y visibilidad (solo visualmente, sin interacción aquí)
    // const mensajesStatus = document.createElement("div");
    // mensajesStatus.textContent = c.messages ? "Sí" : "No"; // Asumo 'messages' del backend
    // mensajesStatus.style.flex = "1";
    // mensajesStatus.style.textAlign = "center";

    // const visibilidadStatus = document.createElement("div");
    // visibilidadStatus.textContent = c.visibility ? "Sí" : "No"; // Asumo 'visibility' del backend
    // visibilidadStatus.style.flex = "1";
    // visibilidadStatus.style.textAlign = "center";

    row.appendChild(nombreColMC);
    row.appendChild(seleccionCol);
    // row.appendChild(mensajesStatus);
    // row.appendChild(visibilidadStatus);

    listaContactosParaGrupoBody.appendChild(row);
  });

  renderizarControlesPaginadoParaGrupo();
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

function renderizarControlesPaginadoParaGrupo() {
  if (!listaContactosParaGrupoContainer) return;

  let paginador = listaContactosParaGrupoContainer.querySelector(
    "#paginador-para-grupo"
  );
  if (paginador) paginador.remove();

  const totalPaginas = Math.ceil(
    contactosGrupoCompleta.length / PAGE_SIZE_GRUPO
  );
  if (totalPaginas <= 1) return;

  paginador = document.createElement("div");
  paginador.id = "paginador-para-grupo";
  paginador.style.textAlign = "center";
  paginador.style.marginTop = "1em";
  paginador.style.color = "white";

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

  paginador.appendChild(
    crearBoton("⏮", paginaActualGrupo > 1, () => {
      paginaActualGrupo = 1;
      renderizarFilasParaGrupo();
    })
  );

  paginador.appendChild(
    crearBoton("◀", paginaActualGrupo > 1, () => {
      paginaActualGrupo--;
      renderizarFilasParaGrupo();
    })
  );

  const input = document.createElement("input");
  input.type = "number";
  input.min = 1;
  input.max = totalPaginas;
  input.value = paginaActualGrupo;
  input.style.width = "40px";
  input.style.textAlign = "center";
  input.style.margin = "0 0.3em";
  input.style.padding = "0.3em 0.5em";
  input.style.borderRadius = "0.3em";
  input.style.border = "1px solid #ccc";
  input.addEventListener("change", () => {
    const nueva = parseInt(input.value);
    if (!isNaN(nueva) && nueva >= 1 && nueva <= totalPaginas) {
      paginaActualGrupo = nueva;
      renderizarFilasParaGrupo();
    } else {
      input.value = paginaActualGrupo;
    }
  });

  const span = document.createElement("span");
  span.textContent = ` / ${totalPaginas}`;
  span.style.margin = "0 0.3em";

  paginador.appendChild(input);
  paginador.appendChild(span);

  paginador.appendChild(
    crearBoton("▶", paginaActualGrupo < totalPaginas, () => {
      paginaActualGrupo++;
      renderizarFilasParaGrupo();
    })
  );

  paginador.appendChild(
    crearBoton("⏭", paginaActualGrupo < totalPaginas, () => {
      paginaActualGrupo = totalPaginas;
      paginaActualGrupo;
      renderizarFilasParaGrupo();
    })
  );

  listaContactosParaGrupoContainer.appendChild(paginador);
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
        showToast("Cargando tus grupos...", "info");
        // await loadMyExistingGroups(); // Una función que cargaría tus grupos y los mostraría
        listaMisGruposExistentes.innerHTML = `<p style="color:white; text-align:center; padding:1em;">Funcionalidad para listar grupos pendientes.</p>`;
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
        listaContactosParaGrupo.style.display = "block";
        await window.loadContactsForGroupSelection();
        //showToast('Tus contactos se han cargado para seleccionar.', 'success');
      } else {
        // Cierra Crear Grupo
        listaContactosParaGrupo.style.display = "none";
        // RESETEAR selección de checkboxes
        contactosSeleccionadosParaGrupo.clear();
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
    icon.classList.toggle("rotate", !visible);

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
    const contactosIds = Array.from(contactosSeleccionadosParaGrupo);

    if (!nombreGrupo || !actividadGrupo) {
      showToast("Completá el nombre y la actividad.", "error");
      return;
    }

    if (contactosIds.length === 0) {
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
          nombre: nombreGrupo,
          actividad: actividadGrupo,
          contactos: contactosIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "No se pudo crear el grupo", "error");
        return;
      }

      showToast("Grupo creado con éxito 🎉", "success");

      // 📌 Vaciar selección
      contactosSeleccionadosParaGrupo.clear();

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
    const res = await fetch(
      `${ROOT_URL}/api/groups/${groupId}/respond`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ accepted }),
      }
    );

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


function renderizarInvitacionesPendientes(groups) {
  const container = document.getElementById("lista-invitaciones-pendientes");
  container.innerHTML = "";

  if (!groups.length) {
    container.innerHTML = `
      <p style="color:white; text-align:center; padding:1em;">
        No tenés invitaciones pendientes
      </p>`;
    return;
  }

  groups.forEach((group) => {
    const row = document.createElement("div");
    row.className = "grupo-row";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.marginBottom = "0.5em";
    row.style.color = "white";

    row.innerHTML = `
      <div>
        <strong>${group.name}</strong><br/>
        <small>${group.actividad}</small>
      </div>
    `;

    const actions = document.createElement("div");

    const btnAceptar = document.createElement("button");
    btnAceptar.textContent = "Aceptar";
    btnAceptar.onclick = () =>
      responderInvitacion(group._id, true);

    const btnRechazar = document.createElement("button");
    btnRechazar.textContent = "Rechazar";
    btnRechazar.onclick = () =>
      responderInvitacion(group._id, false);

    actions.appendChild(btnAceptar);
    actions.appendChild(btnRechazar);
    row.appendChild(actions);

    container.appendChild(row);
  });
}



