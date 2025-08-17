// toasts
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000); // mismo que duración de animación
}

// Confirm
export function showConfirm(message = "¿Estás seguro?") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const messageElement = document.getElementById("confirm-message");
    const btnYes = document.getElementById("confirm-yes");
    const btnNo = document.getElementById("confirm-no");

    messageElement.textContent = message;
    modal.classList.remove("hidden");

    const cleanup = () => {
      modal.classList.add("hidden");
      btnYes.removeEventListener("click", onYes);
      btnNo.removeEventListener("click", onNo);
    };

    const onYes = () => {
      cleanup();
      resolve(true);
    };

    const onNo = () => {
      cleanup();
      resolve(false);
    };

    btnYes.addEventListener("click", onYes);
    btnNo.addEventListener("click", onNo);
  });
}

// Confirm OK only
export function showConfirmOkOnly(message = "Confirmá") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const messageElement = document.getElementById("confirm-message");
    const btnYes = document.getElementById("confirm-yes");
    const btnNo = document.getElementById("confirm-no");

    messageElement.textContent = message;
    modal.classList.remove("hidden");

    btnNo.style.display = "none";

    const cleanup = () => {
      modal.classList.add("hidden");
      btnYes.removeEventListener("click", onYes);
      btnNo.removeEventListener("click", onNo);
      btnNo.style.display = "";
    };

    const onYes = () => {
      cleanup();
      resolve(true);
    };

    const onNo = () => {
      cleanup();
      resolve(false);
    };

    btnYes.addEventListener("click", onYes);
    btnNo.addEventListener("click", onNo);
  });
}

export function renderizarCabeceraContactos(containerId, columnas) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (container.querySelector(".contactos-header")) return;

  const header = document.createElement("div");
  header.classList.add("contactos-header");
  header.style.display = "flex";
  header.style.fontWeight = "bold";
  header.style.color = "white";
  header.style.gap = "1em";
  header.style.marginBottom = "0.5em";
  header.style.flexWrap = "wrap";

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

  // Crea el body con convención "<containerId>-body"
  if (!container.querySelector(`#${containerId}-body`)) {
    const body = document.createElement("div");
    body.id = `${containerId}-body`;
    container.appendChild(body);
  }
}

export function renderizarFilasContactos(containerId, contactos, onAccionClick) {
  const body = document.getElementById(`${containerId}-body`);
  if (!body) return;
  body.querySelectorAll(".contacto-row").forEach((n) => n.remove());

  contactos.forEach((c) => {
    const row = document.createElement("div");
    row.classList.add("contacto-row");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.marginBottom = "0.5em";
    row.style.gap = "1em";
    row.style.color = "white";

    // Nombre + teléfono
    const nombreCol = document.createElement("div");
    nombreCol.style.flex = "2";
    const nombreSpan = document.createElement("div");
    nombreSpan.textContent = c.nombre;
    nombreSpan.style.fontWeight = "bold";
    const telSpan = document.createElement("div");
    telSpan.textContent = c.telefono || "(sin teléfono)";
    telSpan.style.fontSize = "0.9em";
    telSpan.style.opacity = "0.8";
    nombreCol.appendChild(nombreSpan);
    nombreCol.appendChild(telSpan);

    // Mensajes
    const mensajesCol = document.createElement("div");
    mensajesCol.style.flex = "1";
    mensajesCol.style.textAlign = "center";
    const chkMensajes = document.createElement("input");
    chkMensajes.type = "checkbox";
    chkMensajes.className = "checkbox-input";
    chkMensajes.checked = c.mensajes !== false;
    mensajesCol.appendChild(chkMensajes);

    // Visibilidad
    const vermeCol = document.createElement("div");
    vermeCol.style.flex = "1";
    vermeCol.style.textAlign = "center";
    const chkVerme = document.createElement("input");
    chkVerme.type = "checkbox";
    chkVerme.className = "checkbox-input";
    chkVerme.checked = c.visibilidad !== false;
    vermeCol.appendChild(chkVerme);

    // Botón Agregar
    const accionCol = document.createElement("div");
    accionCol.style.flex = "1";
    accionCol.style.textAlign = "center";
    const btn = document.createElement("button");
    btn.textContent = "Agregar";
    btn.classList.add("btn-agregar");
    btn.style.minWidth = "90px";
    btn.style.padding = "0.4em 1em";
    btn.style.textAlign = "center";
    btn.style.display = "inline-block";
    btn.addEventListener("click", () => {
      if (typeof onAccionClick === "function") {
        onAccionClick(c, chkMensajes.checked, chkVerme.checked);
      }
    });
    accionCol.appendChild(btn);

    row.appendChild(nombreCol);
    row.appendChild(mensajesCol);
    row.appendChild(vermeCol);
    row.appendChild(accionCol);

    body.appendChild(row);
  });
}

export function renderizarBuscadorYBotonRefrescar({ container, onBuscar }) {
  if (!container.querySelector("#google-refresh-btn")) {
    // Botón Refrescar
    const refreshBtn = document.createElement("button");
    refreshBtn.id = "google-refresh-btn";
    refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Refrescar`;
    refreshBtn.title = "Volver a importar contactos desde Google";
    Object.assign(refreshBtn.style, {
      padding: "0.4em 0.6em",
      border: "none",
      borderRadius: "0.3em",
      backgroundColor: getComputedStyle(document.documentElement)
        .getPropertyValue("--color-fondo")
        .trim(),
      color: "white",
      cursor: "pointer",
      marginBottom: "0.5em",
      display: "flex",
      alignItems: "center",
      gap: "0.4em",
    });
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

    // Buscador
    const searchWrapper = document.createElement("div");
    searchWrapper.id = "google-search-wrapper";
    Object.assign(searchWrapper.style, {
      margin: "0 auto 0.5em auto",
      display: "flex",
      alignItems: "center",
      gap: "0.5em",
      maxWidth: "440px",
    });

    const searchIcon = document.createElement("i");
    searchIcon.className = "fas fa-search";
    searchIcon.style.color = "white";

    const searchInput = document.createElement("input");
    searchInput.id = "google-search-input";
    searchInput.type = "text";
    searchInput.placeholder = "Buscar contacto...";
    Object.assign(searchInput.style, {
      flex: "1",
      padding: "0.3em 0.5em",
      borderRadius: "0.3em",
      border: "1px solid #ccc",
      width: "100%",
      boxSizing: "border-box",
    });

    searchInput.addEventListener("input", () => {
      const termino = searchInput.value.trim().toLowerCase();
      onBuscar(termino);
    });

    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(searchInput);
    container.appendChild(searchWrapper);
  }
}



export function renderizarContactosConPaginado({
  containerId,
  contactos,
  paginaActual,
  pageSize,
  columnas,
  onAccionClick,
  onPaginaChange
}) {
  const totalPaginas = Math.ceil(contactos.length / pageSize);
  const desde = (paginaActual - 1) * pageSize;
  const hasta = paginaActual * pageSize;
  const visibles = contactos.slice(desde, hasta);

  renderizarCabeceraContactos(containerId, columnas);
  renderizarFilasContactos(containerId, visibles, onAccionClick);

  const body = document.getElementById(`${containerId}-body`);
  if (!body) return;

  let paginador = document.getElementById(`paginador-${containerId}`);
  if (paginador) paginador.remove();

  paginador = document.createElement("div");
  paginador.id = `paginador-${containerId}`;
  paginador.style.textAlign = "center";
  paginador.style.marginTop = "1em";
  paginador.style.color = "white";

  const crearBoton = (texto, habilitado, accion) => {
    const btn = document.createElement("button");
    btn.textContent = texto;
    btn.disabled = !habilitado;
    btn.style.margin = "0 0.3em";
    btn.style.padding = "0.3em 0.7em";
    btn.style.borderRadius = "0.3em";
    btn.style.border = "none";
    btn.style.cursor = habilitado ? "pointer" : "default";
    btn.style.backgroundColor = habilitado ? "#007bff" : "#ccc";
    btn.style.color = "white";
    if (habilitado) btn.addEventListener("click", accion);
    return btn;
  };

  paginador.appendChild(crearBoton("⏮", paginaActual > 1, () => onPaginaChange(1)));
  paginador.appendChild(crearBoton("◀", paginaActual > 1, () => onPaginaChange(paginaActual - 1)));

  const input = document.createElement("input");
  input.type = "number";
  input.min = 1;
  input.max = totalPaginas;
  input.value = paginaActual;
  input.style.width = "40px";
  input.style.textAlign = "center";
  input.addEventListener("change", () => {
    const nueva = parseInt(input.value);
    if (!isNaN(nueva) && nueva >= 1 && nueva <= totalPaginas) {
      onPaginaChange(nueva);
    } else {
      input.value = paginaActual;
    }
  });

  const span = document.createElement("span");
  span.textContent = ` / ${totalPaginas}`;
  span.style.margin = "0 0.3em";

  paginador.appendChild(input);
  paginador.appendChild(span);
  paginador.appendChild(crearBoton("▶", paginaActual < totalPaginas, () => onPaginaChange(paginaActual + 1)));
  paginador.appendChild(crearBoton("⏭", paginaActual < totalPaginas, () => onPaginaChange(totalPaginas)));

  body.appendChild(paginador);
}


export function sanitizarTelefonoE164(input) {
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


