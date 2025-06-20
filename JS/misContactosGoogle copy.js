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

    contacts.forEach((c) => {
  const div = document.createElement("div");
  div.classList.add("contacto");

  const label = document.createElement("label");
  label.classList.add("contacto-label");

  // Checkbox 1: "Quiero que reciba mis mensajes"
  const checkboxMessages = document.createElement("input");
  checkboxMessages.type = "checkbox";
  checkboxMessages.name = "recibirMensajes";

  const labelMessages = document.createElement("span");
  labelMessages.textContent = " Quiero que reciba mis mensajes";

  // Checkbox 2: "Quiero que me vea"
  const checkboxVisibility = document.createElement("input");
  checkboxVisibility.type = "checkbox";
  checkboxVisibility.name = "verme";
  checkboxVisibility.style.marginLeft = "1em";

  const labelVisibility = document.createElement("span");
  labelVisibility.textContent = " Quiero que me vea";

  // Texto con nombre y teléfono
  const texto = document.createElement("div");
  texto.textContent = `${c.nombre} - ${c.telefono}`;
  texto.style.marginTop = "0.5em";

  // Armado del contenido
  label.appendChild(checkboxMessages);
  label.appendChild(labelMessages);
  label.appendChild(document.createElement("br"));

  label.appendChild(checkboxVisibility);
  label.appendChild(labelVisibility);
  label.appendChild(document.createElement("br"));

  label.appendChild(texto);

  div.appendChild(label);
  container.appendChild(div);
});
    // Limpiar después de usar
    localStorage.removeItem("googleContacts");
  } catch (e) {
    console.warn("No se pudieron cargar los contactos de Google:", e.message);
  }

  // Limpiar después de usar
  localStorage.removeItem("googleContacts");
});
