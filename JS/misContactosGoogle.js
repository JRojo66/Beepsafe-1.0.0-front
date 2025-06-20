// Verifica que esté logueado
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
      method: "GET",
      // credentials: 'include',                                            windows - android
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`, // iOS
      },
    });
    if (!response.ok) {
      throw new Error("Token inválido");
    }
  } catch (err) {
    window.location.href = "iniciarSesion.html";
  }
});


const btnImportar = document.getElementById("btnImportarGoogle");

btnImportar.addEventListener("click", () => {
  const clientId ="535159863210-aq1il4k0d3tj3rqv9oovt9l683foqrso.apps.googleusercontent.com";
  const redirectUri = `${FRONT_URL}/pages/googleCallback.html`;
  //console.log(redirectUri);
  const scope = "https://www.googleapis.com/auth/contacts.readonly";
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(
    scope
  )}&access_type=online&prompt=consent`;
  //console.log(authUrl);
  window.location.href = authUrl;
});

window.addEventListener("DOMContentLoaded", () => {
  const contactsRaw = localStorage.getItem("googleContacts");
  if (!contactsRaw) return; // 👈 Si no hay nada en localStorage, salí
  try {
    const contacts = JSON.parse(contactsRaw);
    // if (!Array.isArray(contacts)) throw new Error("No es un array");

    const container = document.getElementById("google-contacts-list");

    // Crear tabla con encabezados
const table = document.createElement("table");
table.classList.add("tabla-contactos");

const thead = document.createElement("thead");
thead.innerHTML = `
  <tr>
    <th>Nombre</th>

    <th>Quiero que reciba mis mensajes</th>
    <th>Quiero que me pueda ver</th>
  </tr>
`; // <th>Teléfono</th>
table.appendChild(thead);

const tbody = document.createElement("tbody");


const header = document.createElement("div");
header.style.display = "flex";
header.style.fontWeight = "bold";
header.style.color = "white";
header.style.gap = "1em";
header.style.marginBottom = "0.5em";

["Nombre", "Quiero que reciba mis mensajes", "Quiero que me vea", "Acción"].forEach((title, i) => {
  const col = document.createElement("div");
  col.textContent = title;
  col.style.flex = i === 0 ? "2" : "1";
  col.style.textAlign = "center";
  header.appendChild(col);
});

container.appendChild(header);

// Crear una fila por contacto
contacts.forEach((c) => {
  const row = document.createElement("div");
  row.classList.add("contacto-row");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.marginBottom = "0.5em";
  row.style.gap = "1em";
  row.style.color = "white"; // color para texto del contacto

  // Nombre
  const nombreCol = document.createElement("div");
  nombreCol.textContent = c.nombre;
  nombreCol.style.flex = "2";

  // Checkbox: recibir mensajes
  const checkboxMessages = document.createElement("input");
  checkboxMessages.type = "checkbox";
  checkboxMessages.name = "recibirMensajes";
  checkboxMessages.checked = true;

  const mensajesCol = document.createElement("div");
  mensajesCol.appendChild(checkboxMessages);
  mensajesCol.style.flex = "1";
  mensajesCol.style.textAlign = "center";

  // Checkbox: verme
  const checkboxVisibility = document.createElement("input");
  checkboxVisibility.type = "checkbox";
  checkboxVisibility.name = "verme";
  checkboxVisibility.checked = true;

  const vermeCol = document.createElement("div");
  vermeCol.appendChild(checkboxVisibility);
  vermeCol.style.flex = "1";
  vermeCol.style.textAlign = "center";

  // Botón Agregar
  const btnAgregar = document.createElement("button");
  btnAgregar.textContent = "Agregar";
  btnAgregar.classList.add("btn-agregar");
  btnAgregar.style.flex = "1";

  // Acá podés agregarle un listener si necesitás
  btnAgregar.addEventListener("click", () => {
    console.log(`Agregar: ${c.nombre}`);
    // Podés enviar datos al backend, por ejemplo
  });

  const btnCol = document.createElement("div");
  btnCol.appendChild(btnAgregar);
  btnCol.style.flex = "1";
  btnCol.style.textAlign = "center";

  // Armar fila
  row.appendChild(nombreCol);
  row.appendChild(mensajesCol);
  row.appendChild(vermeCol);
  row.appendChild(btnCol);

  container.appendChild(row);
});


table.appendChild(tbody);
container.appendChild(table);

    // Limpiar después de usar
    localStorage.removeItem("googleContacts");
  } catch (e) {
    console.warn("No se pudieron cargar los contactos de Google:", e.message);
  }

  // Limpiar después de usar
  localStorage.removeItem("googleContacts");
});

// Manda los datos del contacto al hacer click en Agregar
btnAgregar.addEventListener("click", async () => {
  try {
    const token = localStorage.getItem("token");
    const contacto = {
      nombre: c.nombre,
      telefono: c.telefono || "",
      mensajes: checkboxMessages.checked,
      visibilidad: checkboxVisibility.checked,
    };

    const response = await fetch(`${ROOT_URL}/api/users/contactos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(contacto),
    });

    const data = await response.json();
    if (response.ok) {
      alert("Contacto agregado correctamente");
      btnAgregar.disabled = true;
      btnAgregar.textContent = "Agregado";
    } else {
      alert(data.error || "Error al agregar contacto");
    }
  } catch (err) {
    console.error("Error al agregar contacto:", err);
    alert("Error de red al intentar agregar el contacto");
  }
});
