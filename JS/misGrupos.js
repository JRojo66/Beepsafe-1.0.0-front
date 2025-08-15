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
  const crearGrupoContainer = document.getElementById("mis-contactos-manuales-list");

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

  // 📌 Input para nombre del grupo (arriba)
  const nombreGrupoInput = document.createElement("input");
  nombreGrupoInput.type = "text";
  nombreGrupoInput.placeholder = "Nombre del grupo";
  nombreGrupoInput.className = "input-activity";
  nombreGrupoInput.style.marginBottom = "1em";
  container.appendChild(nombreGrupoInput);

  // 📌 Cabecera de columnas
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.fontWeight = "bold";
  header.style.color = "white";
  header.style.gap = "1em";
  header.style.marginBottom = "0.5em";
  header.style.flexWrap = "wrap";

  const columnas = ["Nombre", "Quiero que reciba mis mensajes", "Quiero que me vea", "Agregar"];

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

  // 📌 Traer lista de contactos guardados
  const res = await fetch(`${ROOT_URL}/api/contacts`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  const { contactos } = await res.json();

  // 📌 Render de cada contacto con su botón Agregar
  contactos.forEach((c) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.marginBottom = "0.5em";
    row.style.gap = "1em";
    row.style.color = "white";

    // Nombre
    const nombreCol = document.createElement("div");
    nombreCol.style.flex = "2";
    nombreCol.style.fontWeight = "bold";
    nombreCol.textContent = c.nombre;
    row.appendChild(nombreCol);

    // Checkbox recibir mensajes
    const mensajesCol = document.createElement("div");
    mensajesCol.style.flex = "1";
    mensajesCol.style.textAlign = "center";
    const checkboxMensajes = document.createElement("input");
    checkboxMensajes.type = "checkbox";
    checkboxMensajes.checked = true;
    mensajesCol.appendChild(checkboxMensajes);
    row.appendChild(mensajesCol);

    // Checkbox visibilidad
    const visibilidadCol = document.createElement("div");
    visibilidadCol.style.flex = "1";
    visibilidadCol.style.textAlign = "center";
    const checkboxVisibilidad = document.createElement("input");
    checkboxVisibilidad.type = "checkbox";
    checkboxVisibilidad.checked = true;
    visibilidadCol.appendChild(checkboxVisibilidad);
    row.appendChild(visibilidadCol);

    // Botón agregar
    const agregarCol = document.createElement("div");
    agregarCol.style.flex = "1";
    agregarCol.style.textAlign = "center";
    const btnAgregar = document.createElement("button");
    btnAgregar.textContent = "Agregar";
    btnAgregar.className = "btn-guardar-contacto";
    btnAgregar.addEventListener("click", async () => {
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
            contacto: c.nombre,
            mensajes: checkboxMensajes.checked,
            visibilidad: checkboxVisibilidad.checked,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          showToast("Error al agregar contacto al grupo: " + err.error, "error");
          return;
        }

        showToast(`Contacto ${c.nombre} agregado al grupo`, "success");
      } catch (err) {
        console.error("Error al agregar al grupo:", err);
        showToast("No se pudo conectar con el servidor", "error");
      }
    });
    agregarCol.appendChild(btnAgregar);
    row.appendChild(agregarCol);

    container.appendChild(row);
  });
}
