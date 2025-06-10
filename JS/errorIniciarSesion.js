
const urlParams = new URLSearchParams(window.location.search);
const unblockTime = urlParams.get("unblockTime");
const retryAfter = urlParams.get("retryAfter")

if (unblockTime && Date.now() < unblockTime) {
  const tiempoRestante = unblockTime - Date.now();
  mostrarCuentaRegresiva(tiempoRestante);
}

const errorDisplay = document.getElementById("errorMessageDisplay");

function mostrarCuentaRegresiva(tiempoRestante) {
  const intervalo = setInterval(() => {
    const ahora = Date.now();
    const diferencia =
      unblockTime - ahora;

    if (diferencia <= 0) {
      clearInterval(intervalo);
      errorDisplay.textContent = "Ya puedes volver a intentar iniciar sesión.";
      return;
    }

    const minutos = Math.floor(diferencia / 60000);
    const segundos = Math.floor((diferencia % 60000) / 1000);

    errorDisplay.textContent = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutos}m ${segundos}s.`;
  }, 1000);
}
