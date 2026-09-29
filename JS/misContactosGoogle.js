import {
  showToast,
  renderizarCabeceraContactos,
  renderizarFilasContactos,
  renderizarContactosConPaginado,
  renderizarBuscadorYBotonRefrescar,
  sanitizarTelefonoE164,
  esTelefonoValido,
} from "./utils.js";

let contactosGoogleCargados = [];
let contactosGoogleCargadosCompleta = [];

// Estado global
let googleContacts = [];
let paginaGoogle = 1;
const PAGE_SIZE_GOOGLE = 10;
let terminoGoogle = "";

async function actualizarGoogleContacts() {
  try {
    // 2.1) Traer lista de Google
    const res = await fetch(`${ROOT_URL}/api/google/tempContacts`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!res.ok) throw new Error("No se pudieron cargar contactos de Google");
    const { contactos } = await res.json();
    googleContacts = contactos;

    // 🆕 Filtrar los que ya existen en Mis Contactos
    const resMis = await fetch(`${ROOT_URL}/api/contacts`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const { contactos: contactosGuardados } = await resMis.json();
    const nombresGuardados = new Set(
      contactosGuardados.map((c) => c.nombre.trim().toLowerCase())
    );

    // Filtrar contactos de Google que no estén ya guardados
    googleContacts = googleContacts.filter(
      (c) => !nombresGuardados.has(c.nombre.trim().toLowerCase())
    );

    // 2.2) Renderizar buscador + refrescar
    const container = document.getElementById("google-contacts-list");
    renderizarBuscadorYBotonRefrescar({
      container,
      onBuscar: (termino) => {
        terminoGoogle = termino;
        paginaGoogle = 1;
        renderGoogle();
      },
      onRefrescar: actualizarGoogleContacts,
    });

    // 2.3) Filtrar por término
    const filtrados = terminoGoogle
      ? googleContacts.filter((c) =>
          c.nombre.toLowerCase().includes(terminoGoogle)
        )
      : googleContacts;

    // 2.4) Renderizar tabla con paginado y callback de “Agregar”
    renderizarContactosConPaginado({
      containerId: "google-contacts-list",
      contactos: filtrados,
      paginaActual: paginaGoogle,
      pageSize: PAGE_SIZE_GOOGLE,
      columnas: [
        "Nombre",
        "Quiero que reciba mis mensajes",
        "Quiero que me vea",
        "Acción",
      ],
      onAccionClick: (contacto, mensajes, visibilidad) =>
        agregarContactoDesdeGoogle(contacto, mensajes, visibilidad),
      onPaginaChange: (nueva) => {
        paginaGoogle = nueva;
        renderGoogle();
      },
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}

// 3) Separar render para reusarlo en paginado
function renderGoogle() {
  actualizarGoogleContacts();
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

// Función reutilizable para el click de "Agregar" en cada fila
async function agregarContactoDesdeGoogle(c, mensajes, visibilidad) {
  const endpoint = `${ROOT_URL}/api/contacts`;

  const telefonoOriginal = c.telefono || "";
  // Sólo se usa para COMPARAR y decidir si avisamos lo del prefijo 9.
  // No se manda en el payload: el backend normaliza el valor canónico.
  const telefonoSanitizado = sanitizarTelefonoE164(telefonoOriginal);

  // Advertencia por prefijo 9
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

  // Chequeo previo sólo para feedback instantáneo. No sanitizamos acá: el
  // backend es el dueño de la forma canónica del teléfono.
  if (!esTelefonoValido(telefonoOriginal)) {
    showToast(
      `El número de teléfono "${telefonoOriginal}" de este contacto no es válido`,
      "error"
    );
    return;
  }

  // Mandamos lo que tenemos del contacto de Google, sin inventar el E.164
  const payload = {
    nombre: c.nombre,
    telefono: telefonoOriginal,
    mensajes,
    visibilidad,
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
      // El 400 del backend trae { error: "..." } con el motivo del rechazo.
      // Si el body no es JSON no queremos caer en el catch de red y perder ese
      // mensaje, así que tolerateamos el parseo.
      let err = {};
      try {
        err = await response.json();
      } catch (parseErr) {
        console.warn("No se pudo leer el error del servidor:", parseErr);
      }
      showToast(
        "Error: " + (err.error || "No se pudo agregar el contacto"),
        "error"
      );
      return;
    }

    // Sacarlo de la lista local
    contactosGoogleCargados = contactosGoogleCargados.filter(
      (contacto) =>
        contacto.nombre.trim().toLowerCase() !== c.nombre.trim().toLowerCase()
    );
    contactosGoogleCargadosCompleta = contactosGoogleCargados.slice();

    // Reiniciar a página 1 y re-render
    paginaGoogle = 1;
    renderGoogle();

    // Refrescar "Mis Contactos"
    const res = await fetch(`${ROOT_URL}/api/contacts`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    const { contactos: nuevosContactos } = await res.json();
    if (typeof renderizarMisContactos === "function") {
      renderizarMisContactos(nuevosContactos);
      showToast(`Contacto ${c.nombre} agregado con éxito.`, "success");
      //Refrescar la lista de Google, lo que la forzará a no mostrar el contacto que acabamos de guardar.
      if (typeof refrescarContactosGoogle === "function") {
        await refrescarContactosGoogle();
      }
    }
  } catch (err) {
    showToast("Error al conectar con el servidor", "error");
    console.error(err);
  }
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
    paginaGoogle = 1;
    renderGoogle();
  } catch (err) {
    console.warn("Error al refrescar contactos de Google:", err.message);
  }
}

// async function cargarContactosGoogleDesdeBackend() {
//   try {
//     const res = await fetch(`${ROOT_URL}/api/google/tempContacts`, {
//       headers: {
//         Authorization: `Bearer ${localStorage.getItem("token")}`,
//       },
//     });
//     const { contactos } = await res.json();
//     return contactos;
//   } catch (err) {
//     console.warn("No se pudieron recuperar contactos desde el backend:", err);
//     return [];
//   }
// }

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

      contactosGoogleCargadosCompleta = contactosGoogle;
      
      paginaGoogle = 1;
      renderGoogle();
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
