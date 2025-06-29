let terminoBusquedaMisContactos = "";

function renderizarMisContactos(contactos) {
  renderizarCabeceraMisContactos(contactos);
  renderizarFilasMisContactos(contactos);
}

async function renderizarCabeceraMisContactos(contactos) {
  const containerMC = document.getElementById("mis-contactos-list");
  if (containerMC.querySelector(".contactos-header")) return; // Si la cabecera está renderizada, terminar. contactos-header es la clase con la que están creadas las columnas de la cabecera

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
  containerMC.appendChild(searchWrapper);

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
    "Eliminar",
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

  containerMC.appendChild(header);

  if (!containerMC.querySelector("#mis-contactos-body")) {           // *** 
  const body = document.createElement("div");
  body.id = "mis-contactos-body";
  containerMC.appendChild(body);
}

  searchInput.addEventListener("input", () => {
    // Guarda el valor del cuadro de texto
    terminoBusquedaMisContactos = searchInput.value.trim().toLowerCase();
    
    const termino = searchInput.value.trim().toLowerCase();
    const filtrados = termino
      ? contactos.filter((c) => c.nombre.toLowerCase().includes(termino))
      : contactos;
    renderizarFilasMisContactos(filtrados, "mis-contactos-list");
  });
}

function renderizarFilasMisContactos(contactos) {
  const containerMC = document.getElementById("mis-contactos-list");
  const rows = containerMC.querySelectorAll(".contacto-row");
  rows.forEach((row) => row.remove()); // Borra filas renderizadas

  contactos.forEach((c) => {
    const row = document.createElement("div");
    row.classList.add("contacto-row");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.marginBottom = "0.5em";
    row.style.gap = "1em";
    row.style.color = "white";

    const nombreColMC = document.createElement("div");
    nombreColMC.textContent = c.nombre;
    nombreColMC.style.flex = "2";

    const checkboxMensajesMC = document.createElement("input");
    checkboxMensajesMC.type = "checkbox";
    checkboxMensajesMC.name = "recibirMensajes";
    checkboxMensajesMC.checked = c.mensajes !== false; // **

    const mensajesColMC = document.createElement("div");
    mensajesColMC.appendChild(checkboxMensajesMC);
    mensajesColMC.style.flex = "1";
    mensajesColMC.style.textAlign = "center";

    const checkboxVisibilidadMC = document.createElement("input");
    checkboxVisibilidadMC.type = "checkbox";
    checkboxVisibilidadMC.name = "verme";
    checkboxVisibilidadMC.checked = c.visibilidad !== false;

    const vermeColMC = document.createElement("div");
    vermeColMC.appendChild(checkboxVisibilidadMC);
    vermeColMC.style.flex = "1";
    vermeColMC.style.textAlign = "center";

    // Actualiza los valores de mensajes en la base
      checkboxMensajesMC.addEventListener("change", () => {
        actualizarContacto(
          c.nombre,
          checkboxMensajesMC.checked,
          checkboxVisibilidadMC.checked
        );
      });

      checkboxVisibilidadMC.addEventListener("change", () => {
        actualizarContacto(
          c.nombre,
          checkboxMensajesMC.checked,
          checkboxVisibilidadMC.checked
        );
      });

    row.appendChild(nombreColMC);
    row.appendChild(mensajesColMC);
    row.appendChild(vermeColMC);

    // Actualiza los valores de visibilidad en la base

      checkboxMensajesMC.addEventListener("change", () => {
        actualizarContacto(
          c.nombre,
          checkboxMensajesMC.checked,
          checkboxVisibilidadMC.checked
        );
      });

      checkboxVisibilidadMC.addEventListener("change", () => {
        actualizarContacto(
          c.nombre,
          checkboxMensajesMC.checked,
          checkboxVisibilidadMC.checked
        );
      });

      // 🗑️ Botón para eliminar contacto
      const btnEliminar = document.createElement("button");
      btnEliminar.innerHTML = `<i class="fas fa-trash-alt"></i>`;
      btnEliminar.title = "Eliminar contacto";
      btnEliminar.style.background = "none";
      btnEliminar.style.border = "none";
      btnEliminar.style.color = "white";
      btnEliminar.style.cursor = "pointer";
      btnEliminar.style.fontSize = "1.2em";

      const eliminarCol = document.createElement("div");
      eliminarCol.style.flex = "1";
      eliminarCol.style.textAlign = "center";
      eliminarCol.appendChild(btnEliminar);

      btnEliminar.addEventListener("click", async () => {
        const confirmar = confirm(`¿Eliminar a ${c.nombre}?`); // Alert
        if (!confirmar) return;

        try {
          const response = await fetch(
            `${ROOT_URL}/api/contacts?nombre=${encodeURIComponent(c.nombre)}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          );

          if (!response.ok) {
            const err = await response.json();
            alert("Error: " + err.error);
            return;
          }

          // Recargar la lista "Mis Contactos"
          const res = await fetch(`${ROOT_URL}/api/contacts`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          const { contactos } = await res.json();

          // 🔁 Restaurar en contactosGoogleCargados
          renderizarMisContactos(contactos, "mis-contactos-list");
        } catch (err) {
          console.error("Error al eliminar contacto:", err);
          alert("No se pudo eliminar el contacto");
        }
      });

      row.appendChild(eliminarCol);

      refrescarContactosGoogle();
    
    const body = document.getElementById("mis-contacts-body");
    (body || containerMC).appendChild(row);
  });
}

async function actualizarContacto(nombre, mensajes, visibilidad) {
  try {
    const response = await fetch(`${ROOT_URL}/api/contacts`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ nombre, mensajes, visibilidad }),
    });

    if (!response.ok) {
      const err = await response.json();
      alert("Error al actualizar contacto: " + err.error);
    }
  } catch (err) {
    console.error("Error al actualizar contacto:", err);
    alert("No se pudo conectar con el servidor");
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

  // 🟩 Toggle "Mis Contactos"
  const misContactosList = document.getElementById("mis-contactos-list");

  toggleMisContactos?.addEventListener("click", async () => {
    const isVisible = misContactosList.style.display === "block";
    misContactosList.style.display = isVisible ? "none" : "block"; // Togglea el estado de is Visible

    if (!isVisible) {
      try {
        const res = await fetch(`${ROOT_URL}/api/contacts`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const { contactos } = await res.json();
        // Filtra por el cuadro de texto de la lupita
        const filtrados = terminoBusquedaMisContactos
          ? contactos.filter((c) =>
              c.nombre.toLowerCase().includes(terminoBusquedaMisContactos)
            )
          : contactos;
        renderizarMisContactos(filtrados);
      } catch (err) {
        console.error("Error al cargar contactos guardados:", err.message);
      }
    }
  });
});
// Pone la función renderizarMisContactos disponible globalmente
window.renderizarMisContactos = renderizarMisContactos;

