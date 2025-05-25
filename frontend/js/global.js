// script.js corregido
const API_URL = 'https://sistema-de-rastreo-de-flotas.onrender.com/api';


// Determinar la base URL dependiendo de dónde se carga el script
function getBasePath() {
  const path = window.location.pathname;
  // Si estamos en una ruta que contiene '/frontend', ajustamos la base
  if (path.includes('/frontend/')) {
    return '/frontend';
  }
  return '';
}

const BASE_PATH = getBasePath();

// -------------------- AUTENTICACIÓN Y ACCESO --------------------
function verificarAcceso() {
  const ruta = window.location.pathname;
  if (ruta.includes('/frontend/templates/logueo.html') || ruta.includes('/templates/logueo.html')) return;

  const token = localStorage.getItem('token');
  const verificado = sessionStorage.getItem("verificacion_completa") === "true";

  if (!token || !verificado) {
    sessionStorage.clear();
    localStorage.clear();
    window.location.replace(`${BASE_PATH}/templates/logueo.html`);
  }
}

function cerrarSesion() {
  sessionStorage.clear();
  localStorage.clear();
  window.location.href = `${BASE_PATH}/templates/logueo.html`;
}

// -------------------- FETCH GENERAL --------------------
async function fetchAPI(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    console.log(`Enviando ${method} a ${API_URL}/${endpoint}`, options);

    const res = await fetch(`${API_URL}/${endpoint}`, options);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error en la solicitud: ${res.status} ${res.statusText}`, errorText);
      throw new Error(errorText || `Error ${res.status}: ${res.statusText}`);
    }

    const responseData = await res.json();
    console.log(`Respuesta de ${endpoint}:`, responseData);
    return responseData;
  } catch (error) {
    console.error(`Error en fetchAPI para ${endpoint}:`, error);
    throw error;
  }
}

// -------------------- UTILIDADES  --------------------
function formatearFecha(fecha) {
  return fecha ? new Date(fecha).toLocaleDateString('es-AR') : 'No especificada';
}

// -------------------- INIT --------------------
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM cargado, inicializando aplicación...");
  console.log("Ruta actual:", window.location.pathname);

  verificarAcceso();

  const salirBtn = document.getElementById('CerrarSesion');
  if (salirBtn) {
    console.log("Configurando botón de salir");
    salirBtn.addEventListener('click', cerrarSesion);
  }

    console.log("Inicialización global completa");
});