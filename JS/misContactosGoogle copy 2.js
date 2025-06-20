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

// Crear una fila por contacto
contacts.forEach((c) => {
  const row = document.createElement("tr");

  const tdNombre = document.createElement("td");
  tdNombre.textContent = c.nombre;

  // const tdTelefono = document.createElement("td");
  // tdTelefono.textContent = c.telefono;

  const tdCheckbox1 = document.createElement("td");
  const checkbox1 = document.createElement("input");
  checkbox1.type = "checkbox";
  checkbox1.name = "recibirMensajes";
  tdCheckbox1.appendChild(checkbox1);
  checkbox1.checked = true; 

  const tdCheckbox2 = document.createElement("td");
  const checkbox2 = document.createElement("input");
  checkbox2.type = "checkbox";
  checkbox2.name = "verme";
  tdCheckbox2.appendChild(checkbox2);
  checkbox2.checked = true; 

  row.appendChild(tdNombre);
  // row.appendChild(tdTelefono);
  row.appendChild(tdCheckbox1);
  row.appendChild(tdCheckbox2);

  tbody.appendChild(row);
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
