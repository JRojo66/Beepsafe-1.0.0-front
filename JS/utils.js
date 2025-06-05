// toasts
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000); // mismo que duración de animación
}

// Confirm
function showConfirm(message = "¿Estás seguro?") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const messageElement = document.getElementById("confirm-message");
    const btnYes = document.getElementById("confirm-yes");
    const btnNo = document.getElementById("confirm-no");

    messageElement.textContent = message;
    modal.classList.remove("hidden");

    const cleanup = () => {
      modal.classList.add("hidden");
      btnYes.removeEventListener("click", onYes);
      btnNo.removeEventListener("click", onNo);
    };

    const onYes = () => {
      cleanup();
      resolve(true);
    };

    const onNo = () => {
      cleanup();
      resolve(false);
    };

    btnYes.addEventListener("click", onYes);
    btnNo.addEventListener("click", onNo);
  });

}

// Confirm OK only
function showConfirmOkOnly(message = "Confirmá") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const messageElement = document.getElementById("confirm-message");
    const btnYes = document.getElementById("confirm-yes");
    const btnNo = document.getElementById("confirm-no");

    messageElement.textContent = message;
    modal.classList.remove("hidden");

    btnNo.style.display = "none";

    const cleanup = () => {
      modal.classList.add("hidden");
      btnYes.removeEventListener("click", onYes);
      btnNo.removeEventListener("click", onNo);
      btnNo.style.display = ""; 
    };

    const onYes = () => {
      cleanup();
      resolve(true);
    };

    const onNo = () => {
      cleanup();
      resolve(false);
    };

    btnYes.addEventListener("click", onYes);
    btnNo.addEventListener("click", onNo);
  });
}

window.showToast = showToast;
window.showConfirm = showConfirm;
window.showConfirmOkOnly = showConfirmOkOnly;
