let contactosGoogleCargados = null;

function renderizarContactos(contactos, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = ""; // Limpiamos antes

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.fontWeight = "bold";
  header.style.color = "white";
  header.style.gap = "1em";
  header.style.marginBottom = "0.5em";
  const columnas = [
    "Nombre",
    "Quiero que reciba mis mensajes",
    "Quiero que me vea",
  ];

  if (containerId === "mis-contactos-list") {
    columnas.push("Eliminar");
  }

  if (containerId === "google-contacts-list") {
    columnas.push("Acción");
  }

  columnas.forEach((title, i) => {
    const col = document.createElement("div");
    col.textContent = title;
    col.style.flex = i === 0 ? "2" : "1";
    col.style.textAlign = "center";
    header.appendChild(col);
  });

  container.appendChild(header);

  contactos.forEach((c) => {
    const row = document.createElement("div");
    row.classList.add("contacto-row");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.marginBottom = "0.5em";
    row.style.gap = "1em";
    row.style.color = "white";

    const nombreCol = document.createElement("div");
    nombreCol.textContent = c.nombre;
    nombreCol.style.flex = "2";

    const checkboxMensajes = document.createElement("input");
    checkboxMensajes.type = "checkbox";
    checkboxMensajes.name = "recibirMensajes";
    checkboxMensajes.checked = c.mensajes !== false; // **

    const mensajesCol = document.createElement("div");
    mensajesCol.appendChild(checkboxMensajes);
    mensajesCol.style.flex = "1";
    mensajesCol.style.textAlign = "center";

    const checkboxVisibilidad = document.createElement("input");
    checkboxVisibilidad.type = "checkbox";
    checkboxVisibilidad.name = "verme";
    checkboxVisibilidad.checked = c.visibilidad !== false; // **

    const vermeCol = document.createElement("div");
    vermeCol.appendChild(checkboxVisibilidad);
    vermeCol.style.flex = "1";
    vermeCol.style.textAlign = "center";

    if (containerId === "mis-contactos-list") {
      checkboxMensajes.addEventListener("change", () => {
        actualizarContacto(
          c.nombre,
          checkboxMensajes.checked,
          checkboxVisibilidad.checked
        );
      });

      checkboxVisibilidad.addEventListener("change", () => {
        actualizarContacto(
          c.nombre,
          checkboxMensajes.checked,
          checkboxVisibilidad.checked
        );
      });
    }

    row.appendChild(nombreCol);
    row.appendChild(mensajesCol);
    row.appendChild(vermeCol);

    if (containerId === "mis-contactos-list") {
      checkboxMensajes.addEventListener("change", () => {
        actualizarContacto(
          c.nombre,
          checkboxMensajes.checked,
          checkboxVisibilidad.checked
        );
      });

      checkboxVisibilidad.addEventListener("change", () => {
        actualizarContacto(
          c.nombre,
          checkboxMensajes.checked,
          checkboxVisibilidad.checked
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
        const confirmar = confirm(`¿Eliminar a ${c.nombre}?`);
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
          renderizarContactos(contactos, "mis-contactos-list");

          // 🔁 Restaurar en contactosGoogleCargados
          await refrescarContactosGoogle();
        } catch (err) {
          console.error("Error al eliminar contacto:", err);
          alert("No se pudo eliminar el contacto");
        }
      });

      row.appendChild(eliminarCol);
    }

    if (containerId === "google-contacts-list") {
      const btnAccion = document.createElement("button");
      btnAccion.textContent = "Agregar";
      btnAccion.classList.add("btn-agregar");
      btnAccion.style.flex = "1";

      btnAccion.addEventListener("click", async () => {
        const endpoint = `${ROOT_URL}/api/contacts`;
        const payload = {
          nombre: c.nombre,
          telefono: c.telefono || "",
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
            alert("Error: " + err.error);
            return;
          }

          // ✅ Eliminar de la lista de contactosGoogleCargados
          contactosGoogleCargados = contactosGoogleCargados.filter(
            (contacto) => {
              return (
                contacto.nombre.trim().toLowerCase() !==
                c.nombre.trim().toLowerCase()
              );
            }
          );

          // ✅ Volver a renderizar los contactos filtrados
          renderizarContactos(contactosGoogleCargados, "google-contacts-list");

          // 🆕 ✅ Refrescar "Mis Contactos"
          const res = await fetch(`${ROOT_URL}/api/contacts`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          const { contactos: nuevosContactos } = await res.json();
          renderizarContactos(nuevosContactos, "mis-contactos-list");
        } catch (err) {
          alert("Error al conectar con el servidor");
          console.error(err);
        }
      });

      const btnCol = document.createElement("div");
      btnCol.style.flex = "1";
      btnCol.style.textAlign = "center";
      btnCol.appendChild(btnAccion);
      row.appendChild(btnCol);
    }

    container.appendChild(row);
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

async function refrescarContactosGoogle() {
  const googleRaw = localStorage.getItem("googleContacts");
  if (!googleRaw) return;

  try {
    const googleContacts = JSON.parse(googleRaw);

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

    contactosGoogleCargados = contactosFiltrados;
    renderizarContactos(contactosFiltrados, "google-contacts-list");
  } catch (err) {
    console.warn("Error al refrescar contactos de Google:", err.message);
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
  const toggleMisContactos = document.getElementById("toggleMisContactos");
  const misContactosList = document.getElementById("mis-contactos-list");
  const toggleGoogleContactos = document.getElementById(
    "toggleGoogleContactos"
  );
  const googleContactsList = document.getElementById("google-contacts-list");

  // 📦 Si venimos de Google con contactos ya cargados en localStorage
  const contactsRaw = localStorage.getItem("googleContacts");
  if (contactsRaw) {
    try {
      const contacts = JSON.parse(contactsRaw);

      const { contactos: contactosGuardados } = await fetch(
        `${ROOT_URL}/api/contacts`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      ).then((res) => res.json());

      const nombresGuardados = new Set(
        contactosGuardados.map((c) => c.nombre.trim().toLowerCase())
      );

      const contactosFiltrados = contacts.filter(
        (c) => !nombresGuardados.has(c.nombre.trim().toLowerCase())
      );

      contactosGoogleCargados = contactosFiltrados;
      renderizarContactos(contactosFiltrados, "google-contacts-list");
      googleContactsList.style.display = "block";

      if (localStorage.getItem("misContactosEstabanAbiertos") === "true") {
        misContactosList.style.display = "block";
        try {
          const res = await fetch(`${ROOT_URL}/api/contacts`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          const { contactos } = await res.json();
          renderizarContactos(contactos, "mis-contactos-list");
        } catch (err) {
          console.error("Error al cargar contactos guardados:", err.message);
        }
        localStorage.removeItem("misContactosEstabanAbiertos");
      }

      // localStorage.removeItem("googleContacts");
    } catch (e) {
      console.warn("No se pudieron cargar los contactos de Google:", e.message);
      // localStorage.removeItem("googleContacts");
    }
  }

  // 🟩 Toggle "Mis Contactos"
  toggleMisContactos?.addEventListener("click", async () => {
    const isVisible = misContactosList.style.display === "block";
    misContactosList.style.display = isVisible ? "none" : "block";

    if (!isVisible) {
      try {
        const res = await fetch(`${ROOT_URL}/api/contacts`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const { contactos } = await res.json();
        renderizarContactos(contactos, "mis-contactos-list");
      } catch (err) {
        console.error("Error al cargar contactos guardados:", err.message);
      }
    }
  });

  // 🟦 Toggle "Importar contactos desde Google"
  toggleGoogleContactos?.addEventListener("click", async () => {
    const isVisible = googleContactsList.style.display === "block";
    googleContactsList.style.display = isVisible ? "none" : "block";

    if (!isVisible) {
      if (contactosGoogleCargados) {
        try {
          const { contactos: contactosGuardados } = await fetch(
            `${ROOT_URL}/api/contacts`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          ).then((res) => res.json());

          const nombresGuardados = new Set(
            contactosGuardados.map((c) => c.nombre.trim().toLowerCase())
          );
          const contactosFiltrados = contactosGoogleCargados.filter(
            (c) => !nombresGuardados.has(c.nombre.trim().toLowerCase())
          );
          contactosGoogleCargados = contactosFiltrados;
          renderizarContactos(contactosFiltrados, "google-contacts-list");
          return;
        } catch (err) {
          console.warn("Error al volver a filtrar contactos:", err.message);
          return;
        }
      }

      const abrirGoogle =
        localStorage.getItem("abrirGoogleContactsAlVolver") === "true";
      const contactsRaw = localStorage.getItem("googleContacts");
      if (contactsRaw) {
        try {
          const contacts = JSON.parse(contactsRaw);
          // 👇 Filtrar los contactos que ya existen
          const { contactos: contactosGuardados } = await fetch(
            `${ROOT_URL}/api/contacts`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          ).then((res) => res.json());

          // Filtrar contactos de Google que no estén ya guardados
          const nombresGuardados = new Set(
            contactosGuardados.map((c) => c.nombre.trim().toLowerCase())
          );
          const contactosFiltrados = contacts.filter(
            (c) => !nombresGuardados.has(c.nombre.trim().toLowerCase())
          );

          contactosGoogleCargados = contactosFiltrados;
          renderizarContactos(contactosFiltrados, "google-contacts-list");

          // Solo mostrar si el usuario venía de importar
          if (abrirGoogle) {
            googleContactsList.style.display = "block";
          }

          // localStorage.removeItem("googleContacts");
          localStorage.removeItem("abrirGoogleContactsAlVolver");
        } catch (e) {
          console.warn("Error al parsear contactos de Google:", e.message);
          // localStorage.removeItem("googleContacts");
        }
      }

      // 🔁 Redirigir a Google para autorización
      const clientId = `${GOOGLE_CLIENT_ID}`;
      const redirectUri = `${FRONT_URL}/pages/googleCallback.html`;
      const scope = "https://www.googleapis.com/auth/contacts.readonly";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(
        scope
      )}&access_type=online&prompt=consent`;
      localStorage.setItem("abrirGoogleContactsAlVolver", "true");
      if (misContactosList.style.display === "block") {
        localStorage.setItem("misContactosEstabanAbiertos", "true");
      }
      window.location.href = authUrl;
    }
  });
});
