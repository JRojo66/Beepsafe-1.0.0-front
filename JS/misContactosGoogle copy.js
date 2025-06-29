// Estado global
let contactosGoogleCargados = null;
let contactosGoogleCargadosCompleta = null;
let terminoBusqueda = "";
let googleContactPage = 1;
const GOOGLE_PAGE_SIZE = 20;

function inicializarGoogleContactList(containerId) {
  const desde = 0;
  const hasta = googleContactPage * GOOGLE_PAGE_SIZE;

  const base = contactosGoogleCargadosCompleta || [];
  const filtrados = terminoBusqueda
    ? base.filter((c) => c.nombre.toLowerCase().includes(terminoBusqueda))
    : base;

  const visibles = filtrados.slice(desde, hasta);
  contactosGoogleCargados = filtrados;

  console.log("visibles: ",visibles);                                                                             // clg visibles
  console.log("contactosGoogleCargados",contactosGoogleCargados);                                                 // clg contactosGoogleCargados

  const container = document.getElementById(containerId);
  let body = document.getElementById("google-contacts-body");

  // Crear cabecera + body si no existen
  console.log("container.querySelector(.contactos-header/): ",container.querySelector(".contactos-header"));                                                     // clg 
  if (!container.querySelector(".contactos-header")) {
    renderizarCabecera(containerId);
    body = document.getElementById("google-contacts-body");
  }

  // Limpia solo el contenido del body
  if (body) body.innerHTML = "";

  renderizarFilas(visibles, containerId);

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
      inicializarGoogleContactList(containerId); // vuelve a llamar con nueva página
    });

    body.appendChild(verMasBtn);
  }
}

function renderizarContactos(contactos, containerId) {
  renderizarCabecera(containerId);
  renderizarFilas(contactos, containerId);
}

function renderizarFilas(contactos, containerId) {
  console.log("contactos en RenderizarFilas: ",contactos);                                   // clg contactos
  const container =
    containerId === "google-contacts-list"
      ? document.getElementById("google-contacts-body") ||
        document.getElementById(containerId)
      : document.getElementById(containerId);

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
          // Asegurarse de que no se están mezclando con contactos de Google
          const contactosLimpios = contactos.filter((c) => c.telefono || c.id);
          renderizarContactos(contactosLimpios, "mis-contactos-list");

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
            (contacto) => {
              return (
                contacto.nombre.trim().toLowerCase() !==
                c.nombre.trim().toLowerCase()
              );
            }
          );
          // ✅ Volver a renderizar los contactos filtrados
          contactosGoogleCargadosCompleta = contactosFiltrados;
          googleContactPage = 1;
          inicializarGoogleContactList("google-contacts-list");

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

    const body = document.getElementById("google-contacts-body");
    (body || container).appendChild(row);
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

    contactosGoogleCargadosCompleta = contactosFiltrados;
    // contactosGoogleCargados = contactosFiltrados.slice(0, 20);
    googleContactPage = 1;
    inicializarGoogleContactList("google-contacts-list");
  } catch (err) {
    console.warn("Error al refrescar contactos de Google:", err.message);
  }
}

function renderizarCabecera(containerId) {
  const container = document.getElementById(containerId);
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
    containerId === "google-contacts-list" ? "Acción" : "Eliminar",
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
    inicializarGoogleContactList(containerId);
  });

  if (!container.querySelector("#google-contacts-body")) {
    const body = document.createElement("div");
    body.id = "google-contacts-body";
    container.appendChild(body);
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
    console.log(contactsRaw); // clg contactos en LocalStorage
    try {
      const contacts = JSON.parse(contactsRaw);
      // Busca los contactos de este usuario
      const { contactos: contactosGuardados } = await fetch(
        `${ROOT_URL}/api/contacts`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      ).then((res) => res.json());
      console.log(contactosGuardados); // clg contactos del usuario en Google primeros 100

      const nombresGuardados = new Set(
        contactosGuardados.map((c) => c.nombre.trim().toLowerCase())
      );

      console.log(nombresGuardados); // clg contactos del usuario pasados a minuscula

      const contactosFiltrados = contacts.filter(
        (c) => !nombresGuardados.has(c.nombre.trim().toLowerCase())
      );

      console.log(contactosFiltrados); // clg contactos del usuario en Google primeros 100, sacando los contactos del usuario

      contactosGoogleCargadosCompleta = contactosFiltrados;
      googleContactPage = 1;
      inicializarGoogleContactList("google-contacts-list"); // manda como parámetro donde mostrarlo

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
  // toggleMisContactos?.addEventListener("click", async () => {
  //   const isVisible = misContactosList.style.display === "block";
  //   misContactosList.style.display = isVisible ? "none" : "block";

  //   if (!isVisible) {
  //     try {
  //       const res = await fetch(`${ROOT_URL}/api/contacts`, {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem("token")}`,
  //         },
  //       });
  //       const { contactos } = await res.json();
  //       console.log("contactos: ",contactos);
  //       renderizarContactos(contactos, "mis-contactos-list");
  //     } catch (err) {
  //       console.error("Error al cargar contactos guardados:", err.message);
  //     }
  //   }
  // });

  // 🟦 Toggle "Importar contactos desde Google"
  toggleGoogleContactos?.addEventListener("click", async () => {
    const isVisible = googleContactsList.style.display === "block";
    googleContactsList.style.display = isVisible ? "none" : "block";

    console.log("isVisible: ",isVisible);                             // clg  
    console.log("contactosGoogleCargados: ",contactosGoogleCargados);                        // clg

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

          contactosGoogleCargadosCompleta = contactosFiltrados;
          googleContactPage = 1;
          inicializarGoogleContactList("google-contacts-list");

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

          contactosGoogleCargadosCompleta = contactosFiltrados;
          googleContactPage = 1;
          inicializarGoogleContactList("google-contacts-list");

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
