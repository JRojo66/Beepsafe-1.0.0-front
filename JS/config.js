const isLocalhost = location.hostname === "localhost";

const ROOT_URL = isLocalhost
  ? "http://localhost:8080"
  // const ROOT_URL = "https://beepsafe-10-0-back-production.up.railway.app"; // Para produccion railway
  : "https://beepsafe-p11h.onrender.com";

const FRONT_URL = isLocalhost
  ? `http://${location.hostname}:${location.port}`
  : "https://jrojo66.github.io/Beepsafe-1.0.0-front";

const GOOGLE_CLIENT_ID = "535159863210-aq1il4k0d3tj3rqv9oovt9l683foqrso.apps.googleusercontent.com"

