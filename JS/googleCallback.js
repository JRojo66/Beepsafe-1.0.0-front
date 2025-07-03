function mostrarSpinner() {
  const spinner = document.getElementById("google-spinner");
  if (spinner) spinner.style.display = "block";
}
function ocultarSpinner() {
  const spinner = document.getElementById("google-spinner");
  if (spinner) spinner.style.display = "none";
}
  mostrarSpinner();
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (code) {
    const redirect_uri = `${FRONT_URL}/pages/googleCallback.html`;

    fetch(`${ROOT_URL}/api/google/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ code, redirect_uri }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.contacts && Array.isArray(data.contacts)) {
            ocultarSpinner();
          window.location.href = `${FRONT_URL}/pages/misContactos.html`;
        } else {
          console.warn("Respuesta inválida del backend:", data);
          alert("No se encontraron contactos.");
          ocultarSpinner();
          window.location.href = `${FRONT_URL}/pages/iniciarSesion.html`;
        }
      })
      .catch((err) => {
        console.error("Error al obtener contactos:", err);
        alert("Error al obtener contactos");
      });
  } else {
    alert("Autorización cancelada o fallida");
  }