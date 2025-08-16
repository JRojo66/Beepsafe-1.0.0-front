// toasts
function showToast(message, type = "info") {
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
function showConfirm(message = "¿Estás seguro?") {
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
function showConfirmOkOnly(message = "Confirmá") {
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

window.showToast = showToast;
window.showConfirm = showConfirm;
window.showConfirmOkOnly = showConfirmOkOnly;

// Renderizado para Importar contactos desde Google y Mis Grupos
// utils.js (global, sin modules)
(function (global) {
function renderizarCabeceraContactos(containerId, columnas) {
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

function renderizarFilasContactos(containerId, contactos, onAccionClick) {
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
  global.renderizarCabeceraContactos = renderizarCabeceraContactos;
  global.renderizarFilasContactos = renderizarFilasContactos;
})(window);

