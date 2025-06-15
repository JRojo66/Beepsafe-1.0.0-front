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


// Verifica que esté logueado
window.addEventListener('DOMContentLoaded', async () => {
  try {
      const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
        method: 'GET',
        // credentials: 'include',                                            windows - android
        headers: {          
         "Authorization": `Bearer ${localStorage.getItem("token")}`        // iOS 
        }
      });
      if (!response.ok) {
        throw new Error('Token inválido');
      }

      
      const data = await response.json();
      const nombreElemento = document.getElementById('nombre');
      nombreElemento.innerHTML = `<strong>${data.userJWT.name.toUpperCase()}!</strong>`;
      
    } catch (err) {
      // console.warn('No autenticado, redirigiendo...');
      window.location.href = 'iniciarSesion.html';
    }
  });
  