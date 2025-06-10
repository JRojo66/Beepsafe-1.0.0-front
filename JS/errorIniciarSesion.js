document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const unblockTime = parseInt(urlParams.get("unblockTime"), 10);
  const retryAfter = urlParams.get("retryAfter");
  const errorMessage = urlParams.get("error");
  const errorDisplay = document.getElementById("errorMessageDisplay");

  if (errorDisplay && errorMessage) {
    errorDisplay.textContent = decodeURIComponent(errorMessage);
  }

  if (unblockTime && Date.now() < unblockTime) {
    const tiempoRestante = unblockTime - Date.now();
    mostrarCuentaRegresiva(tiempoRestante, unblockTime, errorDisplay);
  }

  function mostrarCuentaRegresiva(tiempoRestante, unblockTime, errorDisplay) {
    const intervalo = setInterval(() => {
      const ahora = Date.now();
      const diferencia = unblockTime - ahora;

      if (diferencia <= 0) {
        clearInterval(intervalo);
        errorDisplay.textContent =
          "Ya puedes volver a intentar iniciar sesión.";
        return;
      }

      const minutos = Math.floor(diferencia / 60000);
      const segundos = Math.floor((diferencia % 60000) / 1000);

      errorDisplay.textContent = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutos}m ${segundos}s.`;
    }, 1000);
  }
});
