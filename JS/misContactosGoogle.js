// Estado global
let googleContactsMemory = null;
let terminoBusqueda = "";
let googleContactPage = 1;
const GOOGLE_PAGE_SIZE = 10;
let abrirGoogleContactsAlVolver = false;

function inicializarGoogleContactList() {
  const desde = (googleContactPage - 1) * GOOGLE_PAGE_SIZE;
  const hasta = googleContactPage * GOOGLE_PAGE_SIZE;

  const base = contactosGoogleCargadosCompleta || [];
  const filtrados = terminoBusqueda
    ? base.filter((c) => c.nombre.toLowerCase().includes(terminoBusqueda))
    : base;

  const visibles = filtrados.slice(desde, hasta);
  contactosGoogleCargados = filtrados;

  const container = document.getElementById("google-contacts-list");
  let body = document.getElementById("google-contacts-body");

  // Crear cabecera + body si no existen
  if (!container.querySelector(".contactos-header")) {
    renderizarCabecera();
    body = document.getElementById("google-contacts-body");
  }

  // Limpia solo el contenido del body
  if (body) body.innerHTML = "";

  renderizarFilas(visibles);

  const totalPaginas = Math.ceil(filtrados.length / GOOGLE_PAGE_SIZE);

  // Contenedor de paginación
  const paginacion = document.createElement("div");
  paginacion.id = "paginacion-contactos";
  paginacion.style.display = "flex";
  paginacion.style.justifyContent = "center";
  paginacion.style.alignItems = "center";
  paginacion.style.gap = "0.5em";
  paginacion.style.marginTop = "1em";
  paginacion.style.color = "white";

  // Botón ⏮ (Primera página)
  const btnPrimera = document.createElement("button");
  btnPrimera.innerHTML = "⏮";
  btnPrimera.disabled = googleContactPage === 1;
  btnPrimera.style.opacity = btnPrimera.disabled ? "0.5" : "1";
  btnPrimera.addEventListener("click", () => {
    googleContactPage = 1;
    inicializarGoogleContactList();
  });
  paginacion.appendChild(btnPrimera);

  // Botón ◀ (Anterior)
  const btnAnterior = document.createElement("button");
  btnAnterior.innerHTML = "◀";
  btnAnterior.disabled = googleContactPage === 1;
  btnAnterior.style.opacity = btnAnterior.disabled ? "0.5" : "1";
  btnAnterior.addEventListener("click", () => {
    if (googleContactPage > 1) {
      googleContactPage--;
      inicializarGoogleContactList();
    }
  });
  paginacion.appendChild(btnAnterior);

  // Cuadro editable de número de página
  const inputPagina = document.createElement("input");
  inputPagina.type = "number";
  inputPagina.value = googleContactPage;
  inputPagina.min = 1;
  inputPagina.max = totalPaginas;
  inputPagina.style.width = "3em";
  inputPagina.style.textAlign = "center";
  inputPagina.style.padding = "0.3em";
  inputPagina.style.borderRadius = "0.3em";
  inputPagina.style.border = "1px solid #ccc";
  inputPagina.style.backgroundColor = "#f8f9fa";

  inputPagina.addEventListener("change", () => {
    let nuevaPagina = parseInt(inputPagina.value);
    if (isNaN(nuevaPagina) || nuevaPagina < 1) nuevaPagina = 1;
    if (nuevaPagina > totalPaginas) nuevaPagina = totalPaginas;
    googleContactPage = nuevaPagina;
    inicializarGoogleContactList();
  });
  paginacion.appendChild(inputPagina);

  // Total de páginas
  const totalSpan = document.createElement("span");
  totalSpan.textContent = ` / ${totalPaginas}`;
  paginacion.appendChild(totalSpan);

  // Botón ▶ (Siguiente)
  const btnSiguiente = document.createElement("button");
  btnSiguiente.innerHTML = "▶";
  btnSiguiente.disabled = googleContactPage >= totalPaginas;
  btnSiguiente.style.opacity = btnSiguiente.disabled ? "0.5" : "1";
  btnSiguiente.addEventListener("click", () => {
    if (googleContactPage < totalPaginas) {
      googleContactPage++;
      inicializarGoogleContactList();
    }
  });
  paginacion.appendChild(btnSiguiente);

  // Botón ⏭ (Última página)
  const btnUltima = document.createElement("button");
  btnUltima.innerHTML = "⏭";
  btnUltima.disabled = googleContactPage >= totalPaginas;
  btnUltima.style.opacity = btnUltima.disabled ? "0.5" : "1";
  btnUltima.addEventListener("click", () => {
    googleContactPage = totalPaginas;
    inicializarGoogleContactList();
  });
  paginacion.appendChild(btnUltima);

  // Agregar al body
  if (body) {
    body.appendChild(paginacion);
  }
}

function renderizarContactos(contactos) {
  renderizarCabecera();
  renderizarFilas(contactos);
}

function sanitizarTelefonoE164(input) {
  const limpio = input.trim().replace(/[^\d+]/g, ""); // 🔧 Elimina todo excepto dígitos y "+"
  const soloNumeros = limpio.replace(/\D/g, ""); // solo números

  // 🌍 Si empieza con 00 → internacional
  if (soloNumeros.startsWith("00")) {
    return "+" + soloNumeros.slice(2);
  }

  // ✅ Si empieza con +54 (Argentina), forzamos +549...
  if (limpio.startsWith("+54")) {
    const sinMas = soloNumeros; // Ej: "541134560947" o "5491151227864"
    if (sinMas.startsWith("54") && !sinMas.startsWith("549")) {
      return "+549" + sinMas.slice(2); // fuerza el 9 después de 54
    }
    return "+" + sinMas;
  }

  // 📱 Si empieza con 15 y tiene 11 dígitos → +549...
  if (soloNumeros.startsWith("15") && soloNumeros.length === 11) {
    return "+549" + soloNumeros.slice(2);
  }

  // 📲 Si empieza con 9 y tiene 11 dígitos → ya está bien
  if (soloNumeros.startsWith("9") && soloNumeros.length === 11) {
    return "+54" + soloNumeros;
  }

  // 🏠 Si empieza con 0 y tiene 11 dígitos → forzamos +549...
  if (soloNumeros.startsWith("0") && soloNumeros.length === 11) {
    return "+549" + soloNumeros.slice(1);
  }

  // 🧼 Si tiene 10 dígitos → asumimos móvil sin 0 ni 9 → le agregamos ambos
  if (soloNumeros.length === 10) {
    return "+549" + soloNumeros;
  }

  // Fallback genérico (último recurso)
  return "+" + soloNumeros;
}

function esTelefonoValido(numero) {
  // Debe empezar con + y tener entre 10 y 15 dígitos (ej: +541112345678)
  return /^\+\d{10,15}$/.test(numero);
}

// ⚠️ Evitar mostrar si el usuario ya tildó "No volver a mostrar"
async function esperarOk(mensaje) {
  if (window.__noMostrarMensajeDePrefijo9) return;

  return new Promise((resolve) => {
    const modal = document.getElementById("info-modal");
    const mensajeEl = document.getElementById("info-message");
    const okBtn = document.getElementById("info-ok");
    const checkbox = document.getElementById("info-dont-show-again");

    mensajeEl.textContent = mensaje;
    checkbox.checked = false;
    modal.classList.remove("hidden");

    okBtn.onclick = () => {
      if (checkbox.checked) {
        window.__noMostrarMensajeDePrefijo9 = true;
      }
      modal.classList.add("hidden");
      resolve();
    };
  });
}

function renderizarFilas(contactos) {
  const container =
    document.getElementById("google-contacts-body") ||
    document.getElementById("google-contacts-list");
  const rows = container.querySelectorAll(".contacto-row");
  rows.forEach((row) => row.remove()); // Borra solo filas anteriores

  contactos.forEach((c) => {
    const row = document.createElement("div");
    row.classList.add("contacto-row");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.marginBottom = "0.5em";
    row.style.gap = "1em";
    row.style.color = "white";

    const nombreCol = document.createElement("div");
    nombreCol.style.flex = "2";

    // Línea del nombre
    const nombreSpan = document.createElement("div");
    nombreSpan.textContent = c.nombre;
    nombreSpan.style.fontWeight = "bold";

    // Línea del teléfono
    const telefonoSpan = document.createElement("div");
    telefonoSpan.textContent = c.telefono || "(sin teléfono)";
    telefonoSpan.style.fontSize = "0.9em";
    telefonoSpan.style.opacity = "0.8";

    // Insertar ambas líneas en la columna
    nombreCol.appendChild(nombreSpan);
    nombreCol.appendChild(telefonoSpan);

    const checkboxMensajes = document.createElement("input");
    checkboxMensajes.type = "checkbox";
    checkboxMensajes.name = "recibirMensajes";
    checkboxMensajes.className = "checkbox-input";
    checkboxMensajes.checked = c.mensajes !== false; // **

    const mensajesCol = document.createElement("div");
    mensajesCol.appendChild(checkboxMensajes);
    mensajesCol.style.flex = "1";
    mensajesCol.style.textAlign = "center";

    const checkboxVisibilidad = document.createElement("input");
    checkboxVisibilidad.type = "checkbox";
    checkboxVisibilidad.name = "verme";
    checkboxVisibilidad.className = "checkbox-input";
    checkboxVisibilidad.checked = c.visibilidad !== false; // **

    const vermeCol = document.createElement("div");
    vermeCol.appendChild(checkboxVisibilidad);
    vermeCol.style.flex = "1";
    vermeCol.style.textAlign = "center";

    row.appendChild(nombreCol);
    row.appendChild(mensajesCol);
    row.appendChild(vermeCol);

    const btnAccion = document.createElement("button");
    btnAccion.textContent = "Agregar";
    btnAccion.classList.add("btn-agregar");
    btnAccion.style.flex = "unset";
    btnAccion.style.minWidth = "90px";
    btnAccion.style.padding = "0.4em 1em";
    btnAccion.style.textAlign = "center";
    btnAccion.style.display = "inline-block";

    btnAccion.addEventListener("click", async () => {
      const endpoint = `${ROOT_URL}/api/contacts`;
      // Sanitizar y validar el número de teléfono
      const telefonoOriginal = c.telefono || "";
      const telefonoSanitizado = sanitizarTelefonoE164(telefonoOriginal);

      // Mostrar advertencia si se agregó el "9" automáticamente
      if (
        telefonoSanitizado.startsWith("+549") &&
        !telefonoOriginal.replace(/\D/g, "").startsWith("9") &&
        !telefonoOriginal.replace(/\D/g, "").startsWith("15") &&
        !telefonoOriginal.trim().startsWith("+549")
      ) {
        // ⚠️ Mostrar modal si se agregó el 9
        if (
          telefonoSanitizado.startsWith("+549") &&
          !telefonoOriginal.replace(/\D/g, "").startsWith("9") &&
          !telefonoOriginal.replace(/\D/g, "").startsWith("15") &&
          !telefonoOriginal.trim().startsWith("+549")
        ) {
          await esperarOk(
            "El número agregado no tenía prefijo 9. Beepsafe lo ha agregado automáticamente. Por favor, verificá que sea un número de celular con WhatsApp válido. De no serlo, el destinatario no recibirá los mensajes."
          );
        }
      }

      if (!esTelefonoValido(telefonoSanitizado)) {
        showToast(
          `El número de teléfono "${telefonoOriginal}" de este contacto no es válido`,
          "error"
        );
        return;
      }

      const payload = {
        nombre: c.nombre,
        telefono: telefonoSanitizado || "",
        mensajes: checkboxMensajes.checked,
        visibilidad: checkboxVisibilidad.checked,
      };

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json();
          showToast("Error: " + err.error, "error");
          return;
        }

        // ✅ Eliminar de la lista de contactosGoogleCargados
        contactosGoogleCargados = contactosGoogleCargados.filter(
          (contacto) =>
            contacto.nombre.trim().toLowerCase() !==
            c.nombre.trim().toLowerCase()
        );

        // ✅ Volver a renderizar los contactos filtrados correctamente
        contactosGoogleCargadosCompleta = contactosGoogleCargados.slice();

        googleContactPage = 1;
        inicializarGoogleContactList();

        // 🆕 ✅ Refrescar "Mis Contactos"                                       *** Refresca?
        const res = await fetch(`${ROOT_URL}/api/contacts`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const { contactos: nuevosContactos } = await res.json();

        if (typeof renderizarMisContactos === "function") {
          renderizarMisContactos(nuevosContactos);
        }
      } catch (err) {
        showToast("Error al conectar con el servidor", "error");
        console.error(err);
      }
    });

    const btnCol = document.createElement("div");
    btnCol.style.flex = "1";
    btnCol.style.textAlign = "center";
    btnCol.appendChild(btnAccion);
    row.appendChild(btnCol);

    const body = document.getElementById("google-contacts-body");
    (body || container).appendChild(row);
  });
}

async function refrescarContactosGoogle() {
  try {
    const response = await fetch(`${ROOT_URL}/api/google/tempContacts`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    const { contactos: googleContacts } = await response.json();

    const res = await fetch(`${ROOT_URL}/api/contacts`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    const { contactos: contactosGuardados } = await res.json();

    const nombresGuardados = new Set(
      contactosGuardados.map((c) => c.nombre.trim().toLowerCase())
    );

    const contactosFiltrados = googleContacts.filter(
      (gc) => !nombresGuardados.has(gc.nombre.trim().toLowerCase())
    );

    contactosGoogleCargadosCompleta = contactosFiltrados;
    googleContactPage = 1;
    inicializarGoogleContactList();
  } catch (err) {
    console.warn("Error al refrescar contactos de Google:", err.message);
  }
}

async function renderizarCabecera() {
  const container = document.getElementById("google-contacts-list");
  if (container.querySelector(".contactos-header")) return;

  // 🔄 Botón Refresh
  const refreshBtn = document.createElement("button");
  refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Refrescar`;
  refreshBtn.title = "Volver a importar contactos desde Google";
  refreshBtn.style.padding = "0.4em 0.6em";
  refreshBtn.style.border = "none";
  refreshBtn.style.borderRadius = "0.3em";
  refreshBtn.style.backgroundColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-fondo")
    .trim();
  refreshBtn.style.color = "white";
  refreshBtn.style.cursor = "pointer";
  refreshBtn.style.marginBottom = "0.5em";
  refreshBtn.style.display = "flex";
  refreshBtn.style.alignItems = "center";
  refreshBtn.style.gap = "0.4em";

  refreshBtn.addEventListener("click", () => {
    try {
      const clientId = `${GOOGLE_CLIENT_ID}`;
      const redirectUri = `${FRONT_URL}/pages/googleCallback.html`;
      const scope = "https://www.googleapis.com/auth/contacts.readonly";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(
        scope
      )}&access_type=online&prompt=consent`;

      localStorage.setItem("abrirGoogleContactsAlVolver", "true");
      window.location.href = authUrl;
    } catch (err) {
      console.error("Error al redirigir a Google OAuth:", err);
      showToast("Error al conectar con Google. Intenta nuevamente.", "error");
    }
  });

  container.appendChild(refreshBtn);

  // 🔍 Search + input
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

  searchWrapper.appendChild(searchIcon);
  searchWrapper.appendChild(searchInput);
  container.appendChild(searchWrapper);

  // 📋 Cabecera de columnas
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
    "Quiero que reciba mis mensajes",
    "Quiero que me vea",
    "Acción",
  ];

  columnas.forEach((title, i) => {
    const col = document.createElement("div");
    col.textContent = title;
    col.style.flex = i === 0 ? "2" : "1";
    col.style.textAlign = "center";
    col.style.minWidth = "0";
    col.style.overflow = "hidden";
    col.style.textOverflow = "ellipsis";
    header.appendChild(col);
  });

  container.appendChild(header);

  searchInput.addEventListener("input", () => {
    terminoBusqueda = searchInput.value.trim().toLowerCase();
    inicializarGoogleContactList();
  });

  if (!container.querySelector("#google-contacts-body")) {
    const body = document.createElement("div");
    body.id = "google-contacts-body";
    container.appendChild(body);
  }
}

async function cargarContactosGoogleDesdeBackend() {
  try {
    const res = await fetch(`${ROOT_URL}/api/google/tempContacts`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    const { contactos } = await res.json();
    return contactos;
  } catch (err) {
    console.warn("No se pudieron recuperar contactos desde el backend:", err);
    return [];
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // 🔒 Verifica que esté logueado
  try {
    const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!response.ok) {
      throw new Error("Token inválido");
    }
  } catch (err) {
    window.location.href = "iniciarSesion.html";
    return;
  }

  // 🔽 Referencias
  const toggleGoogleContactos = document.getElementById(
    "toggleGoogleContactos"
  );
  const googleContactsList = document.getElementById("google-contacts-list");

  // Ejecuta cuando el usuario hace click en el botón de importar contactos desde Google
  toggleGoogleContactos?.addEventListener("click", async () => {
    try {
      // Cambia el estado de visibilidad del contenedor de contactos de Google
      const isVisible = googleContactsList.style.display === "block";
      googleContactsList.style.display = isVisible ? "none" : "block";

      // Rota el icono de chevron
      const icon = toggleGoogleContactos.querySelector("i");
      if (icon) {
        icon.classList.toggle("rotate", !isVisible);
      }

      // Busca los contactos de Google en la base de datos
      const response = await fetch(`${ROOT_URL}/api/google/tempContacts`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const { contactos } = await response.json();
      let contactosGoogle = contactos;

      if (!contactosGoogle || contactosGoogle.length === 0) {
        try {
          const clientId = `${GOOGLE_CLIENT_ID}`;
          const redirectUri = `${FRONT_URL}/pages/googleCallback.html`;
          const scope = "https://www.googleapis.com/auth/contacts.readonly";
          const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(
            scope
          )}&access_type=online&prompt=consent`;

          localStorage.setItem("abrirGoogleContactsAlVolver", "true");
          window.location.href = authUrl;
          return;
        } catch (authErr) {
          console.error("Error al iniciar autenticación con Google:", authErr);
          showToast(
            "Error al conectar con Google. Verifica la configuración.",
            "error"
          );
          return;
        }
      }

      // Trae los contactos del usuario
      const res = await fetch(`${ROOT_URL}/api/contacts`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const { contactos: contactosGuardados } = await res.json();
      const nombresGuardados = new Set(
        contactosGuardados.map((c) => c.nombre.trim().toLowerCase())
      );

      const contactosFiltrados = contactosGoogle.filter(
        (c) => !nombresGuardados.has(c.nombre.trim().toLowerCase())
      );

      contactosGoogleCargadosCompleta = contactosFiltrados;
      googleContactPage = 1;
      inicializarGoogleContactList();
    } catch (err) {
      console.error("Error al procesar contactos de Google:", err);
      showToast("No se pudieron cargar los contactos desde Google.", "error");
    }
  });
  // ✅ Si volvimos de Google y tenemos bandera activa
  const abrirGoogle = localStorage.getItem("abrirGoogleContactsAlVolver");
  if (abrirGoogle === "true") {
    localStorage.removeItem("abrirGoogleContactsAlVolver");

    // ✅ Simular clic en el botón para abrir contactos de Google
    const btnGoogle = document.getElementById("toggleGoogleContactos");
    if (btnGoogle) {
      btnGoogle.click(); // Esto ejecuta la lógica de carga y renderizado
    }
  }
});
// Pone la función refrescarContactosGoogle disponible globalmente
window.refrescarContactosGoogle = refrescarContactosGoogle;
