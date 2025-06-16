const btnImportar = document.getElementById("btnImportarGoogle");

btnImportar.addEventListener("click", () => {
  const clientId ="535159863210-aq1il4k0d3tj3rqv9oovt9l683foqrso.apps.googleusercontent.com";
  const redirectUri = `${FRONT_URL}/pages/googleCallback.html`;
  console.log(redirectUri);
  const scope = "https://www.googleapis.com/auth/contacts.readonly";

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(
    scope
  )}&access_type=online&prompt=consent`;
  console.log(authUrl);
  window.location.href = authUrl;
});

window.addEventListener("DOMContentLoaded", () => {
  const contactsRaw = localStorage.getItem("googleContacts");
  try {
    const contacts = JSON.parse(contactsRaw);
    if (!Array.isArray(contacts)) throw new Error("No es un array");

    const container = document.getElementById("google-contacts-list");

    contacts.forEach((c) => {
      const div = document.createElement("div");
      div.classList.add("contacto");

      const label = document.createElement("label");
      label.classList.add("contacto-label");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";

      label.appendChild(checkbox);

      const texto = document.createTextNode(` ${c.nombre} - ${c.telefono}`);

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
