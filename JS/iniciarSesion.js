document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".ojo").forEach((icon) => {
    icon.addEventListener("click", () => {
      const targetId = icon.getAttribute("data-target");
      const passwordInput = document.getElementById(targetId);
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      icon.classList.toggle("fa-eye");
      icon.classList.toggle("fa-eye-slash");
    });
  });
});

// Validación de email
function isValidEmail(email) {
  // Expresión regular para validar un formato de email básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

const form = document.getElementById("iniciarSesionForm");
document
  .querySelector(".iniciarSesion2")
  .addEventListener("click", function () {
    form.requestSubmit();
  });

const spinner = document.getElementById("spinner"); // debajo del form = document.getElementById...

form.addEventListener("submit", function (event) {
  event.preventDefault(); // Evita el envío del formulario por defecto

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  let isValid = true;

  // Limpiar mensajes de error previos
  document.getElementById("emailError").textContent = "";
  document.getElementById("passwordError").textContent = "";

  // Validar Email
  if (!email.trim()) {
    document.getElementById("emailError").textContent =
      "Por favor, ingresa tu email.";
    isValid = false;
  } else if (!isValidEmail(email)) {
    document.getElementById("emailError").textContent =
      "Por favor, ingresa un email válido.";
    isValid = false;
  }

  // Validar la longitud de la contraseña
  if (password.length < 6) {
    document.getElementById("passwordError").textContent =
      "La contraseña debe tener al menos 6 caracteres.";
    return; // Detiene la ejecución de la función y no hace el fetch
  }

  if (isValid) {
    spinner.style.display = "block";

    fetch(`${ROOT_URL}/api/sessions/login`, {
      method: "POST",
      //credentials: "include", // 👈 NECESARIO PARA ENVIAR COOKIES     windows
      headers: {
        "Content-Type": "application/json", //iOS
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((errData) => {
            throw { status: response.status, ...errData };
          });
        }
        return response.json();
      })
      .then((data) => {
        console.log("DATA EN THEN:", data);
        //localStorage.setItem("token", data.token);    // iOS
        // ✅ Guardar token JWT en localStorage
        localStorage.setItem("token", data.token);

        // ✅ Limpiar intentos fallidos si existían
        // localStorage.removeItem(`intentosFallidos_${email}`);

        // ✅ Redirigir a la página protegida
        window.location.href = "iniciarDetener.html";
      })
      .catch((error) => {
        console.error("CATCH EJECUTADO:", error);
        const passwordErrorDiv = document.getElementById("passwordError");
        if (error.status === 429) {
          const retryAfter = error.retryAfter || 600;
          const unblockTime = Date.now() + retryAfter * 60 * 1000;
          const mensaje = `Demasiados intentos fallidos. Intentá nuevamente en ${retryAfter} minutos.`;
          // console.log(`errorIniciarSesion.html?error=${encodeURIComponent(
          //   mensaje
          // )}&retryAfter=${retryAfter}&email=${encodeURIComponent(email)}&unblockTime=${unblockTime}`);
          window.location.href = `errorIniciarSesion.html?error=${encodeURIComponent(
            mensaje
          )}&retryAfter=${retryAfter}&email=${encodeURIComponent(email)}&unblockTime=${unblockTime}`;
        } else {
          //Otro error
          passwordErrorDiv.textContent =
            error.error || "Algo salió mal, intentalo nuevamente.";
        }
      })
      .finally(() => {
        spinner.style.display = "none";
      });
  }
});

// Olvidó su contraseña
document
  .getElementById("resetPasswordLink")
  .addEventListener("click", function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();

    // Validar email antes de enviar
    if (!email) {
      document.getElementById("emailError").textContent =
        "Por favor, ingresa tu email para resetear la contraseña.";
      return;
    }
    if (!isValidEmail(email)) {
      document.getElementById("emailError").textContent =
        "Por favor, ingresa un email válido.";
      return;
    }

    // Enviar fetch POST a /api/sessions/passwordReset
    // spinner
    spinner.style.display = "block";

    fetch(`${ROOT_URL}/api/sessions/passwordReset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(
              err.error || "No se pudo iniciar el proceso de reseteo."
            );
          });
        }
        return response.json();
      })
      .then((data) => {
        showConfirmOkOnly("📬 Abrí tu mail para restablecer tu contraseña");
      })
      .catch((error) => {
        console.error("Error en reset de contraseña:", error);
        showConfirmOkOnly(
          "❌ No se pudo enviar el email. Por favor, intentá más tarde."
        );
      })
      .finally(() => {
        spinner.style.display = "none"; //spinner
      });
  });
