import {
  showToast,
  showConfirm,
  showConfirmOkOnly,
  renderizarCabeceraContactos,
  renderizarFilasContactos,
} from "./utils.js";

window.addEventListener("DOMContentLoaded", async () => {
  // Verificar login
  try {
    const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!response.ok) throw new Error("Token inválido");
  } catch (err) {
    window.location.href = "iniciarSesion.html";
    return;
  }

  const toggleCrearGrupo = document.getElementById("toggleContactosManual");
  const crearGrupoContainer = document.getElementById(
    "mis-contactos-manuales-list"
  );

  toggleCrearGrupo?.addEventListener("click", async () => {
    const isVisible = crearGrupoContainer.style.display === "block";
    crearGrupoContainer.style.display = isVisible ? "none" : "block";

    const icon = toggleCrearGrupo.querySelector("i");
    if (icon) icon.classList.toggle("rotate", !isVisible);

    if (!isVisible) {
      await cargarFormularioGrupo();
    }
  });
});

async function cargarFormularioGrupo() {
  const container = document.getElementById("mis-contactos-manuales-list");
  container.innerHTML = ""; // Limpia contenido anterior

  // 📌 Input para nombre del grupo
  const nombreGrupoInput = document.createElement("input");
  nombreGrupoInput.type = "text";
  nombreGrupoInput.placeholder = "Nombre del grupo";
  nombreGrupoInput.className = "input-activity";
  nombreGrupoInput.style.marginBottom = "1em";
  container.appendChild(nombreGrupoInput);

  // 📌 Crear subcontenedor para contactos
  const subContainerId = "crear-grupo-contactos";
  const subContainer = document.createElement("div");
  subContainer.id = subContainerId;
  container.appendChild(subContainer);

  // 📌 Traer lista de contactos guardados
  const res = await fetch(`${ROOT_URL}/api/contacts`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  const { contactos } = await res.json();

  // 📌 Renderizar cabecera y filas usando utils.js
  renderizarCabeceraContactos(subContainerId, [
    "Nombre",
    "Quiero que reciba mis mensajes",
    "Quiero que me vea",
    "Acción",
  ]);

  renderizarFilasContactos(
    subContainerId,
    contactos,
    async (contacto, mensajes, visibilidad) => {
      if (!nombreGrupoInput.value.trim()) {
        showToast("Debe ingresar un nombre de grupo", "error");
        return;
      }

      try {
        const response = await fetch(`${ROOT_URL}/api/grupos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            grupo: nombreGrupoInput.value.trim(),
            contacto: contacto.nombre,
            mensajes,
            visibilidad,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          showToast(
            "Error al agregar contacto al grupo: " + err.error,
            "error"
          );
          return;
        }

        showToast(`Contacto ${contacto.nombre} agregado al grupo`, "success");
      } catch (err) {
        console.error("Error al agregar al grupo:", err);
        showToast("No se pudo conectar con el servidor", "error");
      }
    }
  );
}
