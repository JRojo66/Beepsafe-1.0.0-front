

// Muestra/oculta las contraseñas al hacer click en el ojito
// function togglePassword(id, icon) {
//   let input = document.getElementById(id);
//   if (input.type === "password") {
//     input.type = "text";
//     icon.classList.remove("fa-eye");
//     icon.classList.add("fa-eye-slash");
//   } else {
//     input.type = "password";
//     icon.classList.remove("fa-eye-slash");
//     icon.classList.add("fa-eye");
//   }
// }

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".ojo").forEach(icon => {
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


// document.addEventListener("DOMContentLoaded", () => {
//   const toggleIcon = document.getElementById("togglePasswordIcon");
//   const passwordInput = document.getElementById("password");

//   toggleIcon.addEventListener("click", function () {
//     const type = passwordInput.type === "password" ? "text" : "password";
//     passwordInput.type = type;

//     // Alternar el ícono del ojito si querés
//     this.classList.toggle("fa-eye");
//     this.classList.toggle("fa-eye-slash");
//   });
// });


// Validación de email
function isValidEmail(email) {
  // Expresión regular para validar un formato de email básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

const form = document.getElementById("iniciarSesionForm");
document.querySelector(".iniciarSesion2").addEventListener("click", function () {
  form.requestSubmit();
});

const spinner = document.getElementById("spinner"); // debajo del form = document.getElementById...

let intentosFallidos = parseInt(localStorage.getItem("intentosFallidos")) || 0;
let MAX_INTENTOS_FALLIDOS = 5; // Default max intentos fallidos hasta que cargue del backend
let BLOCK_TIME_MINUTES = 60; // Default tiempo de bloqueo entre intentos hasta que cargue del backend

// Fetchear config apenas carga la página
fetch(`${ROOT_URL}/api/config`)
  .then((response) => response.json())
  .then((config) => {
    MAX_INTENTOS_FALLIDOS = config.maxLoginAttempts;
    BLOCK_TIME_MINUTES = config.blockTimeMinutes;
  })
  .catch((error) => {
    console.error("❌ Error cargando config del backend:", error);
  });

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
        "Content-Type": "application/json",                             //iOS
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
        localStorage.removeItem("intentosFallidos");

        // ✅ Redirigir a la página protegida
        window.location.href = "iniciarDetener.html";
      })
      .catch((error) => {
        console.error("CATCH EJECUTADO:", error);
        const passwordErrorDiv = document.getElementById("passwordError");
        if (error.status === 401) {
          //Credenciales inválidas//
          intentosFallidos++;
          localStorage.setItem("intentosFallidos", intentosFallidos); // 👉 Guarda en localStorage
          
          if (intentosFallidos >= MAX_INTENTOS_FALLIDOS) {
            localStorage.removeItem("intentosFallidos"); // 👉 Reseteamos los intentos al bloquear
            const now = Date.now();
            const unblockTime = now + BLOCK_TIME_MINUTES * 60 * 1000; // tiempo futuro en ms
            localStorage.setItem("blockedUntil", unblockTime);
            const minutosRestantes = error.retryAfter || BLOCK_TIME_MINUTES; // por si no viene retryAfter
            //Redirigir a la página de error y pasar el mensaje como parámetro en la URL
            passwordErrorDiv.textContent = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutosRestantes} minutos.`;
            let messageErrorTime = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutosRestantes} minutos.`;
            window.location.href = `errorIniciarSesion.html?error=${encodeURIComponent(messageErrorTime)}`;
          } else {
            passwordErrorDiv.textContent = `Credenciales inválidas. Intento ${intentosFallidos} de ${MAX_INTENTOS_FALLIDOS}.`;
          } 
        } else if (error.status === 429) {
          //Ratelimit excedido
          const now = Date.now();
          window.location.href = "errorIniciarSesion.html"
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
        showConfirmOkOnly(`Error al cambiar la contraseña ${error}`, error)
      })
      .finally(() => {
        spinner.style.display = "none"; //spinner
      });
  });
