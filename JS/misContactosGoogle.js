const btnImportar = document.getElementById("btnImportarGoogle");

btnImportar.addEventListener("click", () => {
  const clientId = "208323455256-ori44vokdn55k8vc9bruqhkhqk7q1dkf.apps.googleusercontent.com";
  const redirectUri = "https://jrojo66.github.io/Beepsafe-1.0.0-front/pages/googleCallback.html";
  const scope = "https://www.googleapis.com/auth/contacts.readonly";

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scope)}&access_type=online&prompt=consent`;

  window.location.href = authUrl;
});

window.addEventListener("DOMContentLoaded", () => {
  const contactsRaw = localStorage.getItem("googleContacts");
  if (!contactsRaw) return;

  const contacts = JSON.parse(contactsRaw);
  const container = document.getElementById("google-contacts-list");

  contacts.forEach((c) => {
    const div = document.createElement("div");
    div.classList.add("contacto");

    div.innerHTML = `
      <label>
        <input type="checkbox" />
        <strong>${c.nombre}</strong> - ${c.email} ${c.telefono}
      </label>
    `;

    container.appendChild(div);
  });

  // Limpiar después de usar
  localStorage.removeItem("googleContacts");
});
