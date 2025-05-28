// Evita el cache. Es necesario para  para iOS
// document.querySelectorAll('a').forEach(link => {
//     link.addEventListener('click', function (e) {
//         const href = this.getAttribute('href');
//         if (href) {
//             e.preventDefault();
//             window.location.href = href + '?t=' + new Date().getTime(); // evita caché
//         }
//     });
// });




window.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
        method: 'GET',
        // credentials: 'include',
        headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
  }
      });
      if (!response.ok) {
        throw new Error('Token inválido');
      }
  
      const data = await response.json();
      const nombreElemento = document.getElementById('nombre');
      nombreElemento.innerHTML = `<strong>${data.userJWT.name.toUpperCase()}</strong>`;
      // Se puede usar data.userJWT para personalizar la vista
    } catch (err) {
      console.warn('No autenticado, redirigiendo...');
      window.location.href = '/pages/iniciarSesion.html';
    }
  });

  
  