// Mostrar/ocultar contraseña
function togglePassword(id, icon) {
  const input = document.getElementById(id);
  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}



// Extraer token de la URL
function getParameterByName(name, url = window.location.href) {
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// Insertar token en el input hidden
const token = getParameterByName("token");
if (token) {
  document.getElementById("token").value = token;
}

// Validación de contraseña
const form = document.getElementById("resetPasswordForm");
const passwordInput = document.getElementById("newPassword");
const passwordError = document.getElementById("passwordError");

const spinner = document.getElementById("spinner");
form.addEventListener("submit", async function (e) {
  e.preventDefault(); // Evita que se recargue la página

  const password = passwordInput.value.trim();

  if (password.length < 6) {
    passwordError.textContent =
      "La contraseña debe tener al menos 6 caracteres.";
    passwordInput.focus();
    return;
  }

  passwordError.textContent = ""; // Limpiar error
  spinner.style.display = "block";

  const token = document.getElementById("token").value;

  try {
    const response = await fetch(`${ROOT_URL}/api/passwordReset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newPassword: password,
        token: token,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      //alert(`Error: ${error.error}`); // || 'Ocurrió un error'
      showConfirmOkOnly(`Error: ${error.error}`);
      return;
    }
    // alert("Contraseña cambiada correctamente. Iniciá sesión.");
    showToast("Contraseña cambiada correctamente. Iniciá sesión.", "success")
    setTimeout(() => {
    window.location.href = "../pages/iniciarSesion.html";
    }, 4000); 
    //window.location.href = "../pages/iniciarSesion.html";
  } catch (error) {
    console.error(`Error al enviar nueva contraseña: ${error}`, error);
    // alert("Ocurrió un error inesperado");
    showToast("❗ Ocurrió un error inesperado", "error");
  } finally {
    spinner.style.display = "none";
  }
});
