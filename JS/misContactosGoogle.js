// Estado global
let googleContactsMemory = null;
let terminoBusqueda = "";
let googleContactPage = 1;
const GOOGLE_PAGE_SIZE = 20;
let abrirGoogleContactsAlVolver = false;

function inicializarGoogleContactList() {
  const desde = 0;
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

  if (filtrados.length > hasta) {
    const verMasBtn = document.createElement("button");
    verMasBtn.id = "btn-ver-mas-contactos";
    verMasBtn.textContent = "Ver más";
    verMasBtn.style.margin = "1em auto";
    verMasBtn.style.display = "block";
    verMasBtn.style.padding = "0.5em 1em";
    verMasBtn.style.borderRadius = "0.3em";
    verMasBtn.style.border = "none";
    verMasBtn.style.backgroundColor = "#007bff";
    verMasBtn.style.color = "white";
    verMasBtn.style.cursor = "pointer";

    verMasBtn.addEventListener("click", () => {
      googleContactPage++;
      inicializarGoogleContactList(); // vuelve a llamar con nueva página
    });

    body.appendChild(verMasBtn);
  }
}

function renderizarContactos(contactos) {
  renderizarCabecera();
  renderizarFilas(contactos);
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
        alert("Error al conectar con el servidor");
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

function renderizarCabecera() {
  const container = document.getElementById("google-contacts-list");
  if (container.querySelector(".contactos-header")) return;

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

      // Busca los contactos de Google en la base de datos
      const response = await fetch(`${ROOT_URL}/api/google/tempContacts`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const { contactos } = await response.json();
      let contactosGoogle = contactos;

      if (!contactosGoogle || contactosGoogle.length === 0) {
        const clientId = `${GOOGLE_CLIENT_ID}`;
        const redirectUri = `${FRONT_URL}/pages/googleCallback.html`;
        const scope = "https://www.googleapis.com/auth/contacts.readonly";
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(
          scope
        )}&access_type=online&prompt=consent`;
        localStorage.setItem("abrirGoogleContactsAlVolver", "true");
        window.location.href = authUrl;
        return; // Evita continuar si se va a redirigir
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
      alert("No se pudieron cargar los contactos desde Google.");
    }
  });
});
// Pone la función refrescarContactosGoogle disponible globalmente
window.refrescarContactosGoogle = refrescarContactosGoogle;
