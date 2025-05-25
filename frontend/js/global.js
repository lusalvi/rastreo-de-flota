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

// Función para iniciar el proceso de verificación por código
function iniciarVerificacion(correo) {
  // Generar código de verificación
  const codigo = Math.floor(100000 + Math.random() * 900000); // 6 dígitos
  localStorage.setItem("codigo_verificacion", codigo.toString());
  localStorage.setItem("correo_verificacion", correo);
  localStorage.setItem("inicio_sesion_correcto", "true");

  console.log("Enviando código de verificación:", codigo);

  // Mostrar modal de verificación
  const modal = new bootstrap.Modal(document.getElementById('modalVerificacion'));
  modal.show();

  // Enviar email con el código utilizando EmailJS
  emailjs.send("service_nz7d0e3", "template_bgispc8", {
    otp: codigo,
    to_email: correo,
  })
    .then(() => {
      console.log("Email enviado correctamente");
    })
    .catch(err => {
      console.error("Error enviando el correo:", err);
      alert("Error enviando el correo: " + err.text);
    });
}

function cerrarSesion() {
  sessionStorage.clear();
  localStorage.clear();
  window.location.href = `${BASE_PATH}/templates/logueo.html`;
}

// código para el input de 6 dígitos

const inputs = document.querySelectorAll('.code-input input');

inputs.forEach((input, index) => {
  input.addEventListener('input', () => {
    const value = input.value;
    if (!/^[0-9]$/.test(value)) {
      input.value = '';
      return;
    }
    if (index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      if (input.value === '' && index > 0) {
        inputs[index - 1].focus();
      }
    }
  });

  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '');
    [...paste].forEach((char, i) => {
      if (inputs[i]) {
        inputs[i].value = char;
      }
    });
    if (inputs[paste.length]) {
      inputs[paste.length].focus();
    }
  });
});

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

function formatearFecha(fecha) {
  return fecha ? new Date(fecha).toLocaleDateString('es-AR') : 'No especificada';
}

// -------------------- VALIDACIONES --------------------
function validarDNI(dni) {
  return /^\d{7,}$/.test(dni);
}

function validarPatente(patente) {
  return /^[A-Za-z0-9]{1,7}$/.test(patente);
}

function validarCategoriaLic(cat) {
  return /^[A-Za-z]{1,2}[0-9]{0,2}$/.test(cat);
}

function alertaFechas() {
  document.querySelectorAll('#conductorTableBody tr').forEach(row => {
    const fechaLic = row.cells[4].innerText;
    if (fechaLic === 'No especificada') return;

    const partesFecha = fechaLic.split('/');
    if (partesFecha.length !== 3) return;

    const fechaLicDate = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);
    const hoy = new Date();
    const diferenciaLic = (fechaLicDate - hoy) / (1000 * 60 * 60 * 24);

    if (diferenciaLic <= 14 && diferenciaLic > 0) {
      alert(`¡Atención! La licencia del conductor con DNI ${row.cells[0].innerText} vence pronto.`);
    }
  });

  document.querySelectorAll('#vehiculoTableBody tr').forEach(row => {
    const fechaRto = row.cells[5].innerText;
    if (fechaRto === 'No especificada') return;

    const partesFecha = fechaRto.split('/');
    if (partesFecha.length !== 3) return;

    const fechaRtoDate = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);
    const hoy = new Date();
    const diferenciaRto = (hoy - fechaRtoDate) / (1000 * 60 * 60 * 24);

    if (diferenciaRto >= 715 && diferenciaRto <= 730) {
      alert(`¡Atención! El vehículo con patente ${row.cells[0].innerText} tiene la RTO por vencer (hace casi 2 años).`);
    }
  });
}

// -------------------- CRUD CONDUCTORES --------------------
async function cargarConductores() {
  try {
    console.log("Cargando conductores...");
    const data = await fetchAPI('conductores');
    const tbody = document.getElementById('conductorTableBody');
    if (!tbody) {
      console.warn("No se encontró el elemento conductorTableBody");
      return;
    }
    tbody.innerHTML = '';
    data.forEach(c => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${c.dni}</td>
        <td>${c.nombreCompleto}</td>
        <td>${c.email}</td>
        <td>${c.codigoPostal}</td>
        <td>${c.domicilio}</td>
        <td>${formatearFecha(c.vencimientoLic)}</td>
        <td>${c.categoriaLic}</td>
        <td>${typeof c.vehiculo === 'object' ? c.vehiculo?.patente || 'No asignado' : c.vehiculo || 'No asignado'}</td>
        <td>
          <button class='btn btn-warning btn-sm' onclick="editarConductor('${c.dni}')">Editar</button>
          <button class='btn btn-danger btn-sm' onclick="eliminarConductor('${c.dni}')">Eliminar</button>
        </td>`;
      tbody.appendChild(row);
    });
    console.log("Conductores cargados correctamente");
    alertaFechas();
  } catch (e) {
    console.error("Error al cargar conductores:", e);
    alert("Error al cargar conductores: " + e.message);
  }
}

async function guardarConductor(e) {
  e.preventDefault();
  try {
    const f = new FormData(e.target);
    const dni = f.get('dni');
    const categoriaLicRaw = f.get('categoriaLic');
    const categoriaLic = categoriaLicRaw ? categoriaLicRaw.toUpperCase() : '';

    if (!validarDNI(dni)) {
      alert('DNI inválido. Debe contener al menos 7 dígitos.');
      return;
    }

    if (!validarCategoriaLic(categoriaLic)) {
      alert('Categoría de licencia inválida. Debe contener de 1 a 3 letras y números.');
      return;
    }

    const obj = Object.fromEntries(f);
    obj.categoriaLic = categoriaLic;

    const formElement = document.getElementById('conductorForm');
    const dniOriginal = formElement.getAttribute('data-editando-dni');
    const esEdicion = !!dniOriginal;

    const endpoint = esEdicion ? `conductores/${dniOriginal}` : 'conductores';
    const method = esEdicion ? 'PUT' : 'POST';

    await fetchAPI(endpoint, method, obj);

    /* if (method === 'POST') {
      const enlace = `https://sistemaderastreodeflotas.netlify.app/templates/seguimiento.html?dni=${obj.dni}`;
      emailjs.send("service_nz7d0e3, template_bgispc8", {
      to_email: obj.email,
      seguimiento_link: enlace
    }).then(() => {
      console.log("Correo de seguimiento enviado a", obj.email);
    }).catch(err => {
      console.error("Error enviando correo de seguimiento:", err);
      alert("No se pudo enviar el correo de seguimiento.");
    });
    console.log("Datos que se enviaran a EmailJS: ");
    console.log({
      to_email: correo,
      seguimiento_link: linkPersonalizado
    })
  } */

    const modalEl = document.getElementById('modalConductor');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) {
      modal.hide();
    } else {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      document.querySelector('.modal-backdrop')?.remove();
    }

    formElement.removeAttribute('data-editando-dni');
    await cargarConductores();
    alert(method === 'PUT' ? 'Conductor actualizado correctamente' : 'Conductor agregado correctamente');
  } catch (e) {
    console.error("Error al guardar conductor:", e);
    alert('Error al guardar conductor: ' + e.message);
  }
}


function editarConductor(dni) {
  try {
    console.log("Editando conductor con DNI:", dni);
    fetchAPI(`conductores/${dni}`).then(data => {
      const f = document.getElementById('conductorForm');
      f.reset();
      f.dni.value = data.dni;
      f.nombreCompleto.value = data.nombreCompleto;
      f.email.value = data.email;
      f.codigoPostal.value = data.codigoPostal;
      f.domicilio.value = data.domicilio;
      f.vencimientoLic.value = data.vencimientoLic?.split('T')[0] || '';
      f.categoriaLic.value = data.categoriaLic || '';
      f.vehiculo.value = typeof data.vehiculo === 'object' ? data.vehiculo?.patente || '' : data.vehiculo || '';

      // Guardamos el dni original por si lo cambian
      f.setAttribute('data-editando-dni', data.dni);

      const modal = new bootstrap.Modal(document.getElementById('modalConductor'));
      modal.show();
    }).catch(err => {
      console.error("Error al obtener datos del conductor:", err);
      alert("Error al obtener datos del conductor: " + err.message);
    });
  } catch (e) {
    console.error("Error al editar conductor:", e);
    alert("Error al editar conductor: " + e.message);
  }
}

async function eliminarConductor(dni) {
  if (confirm('¿Eliminar conductor con DNI ' + dni + '?')) {
    try {
      await fetchAPI(`conductores/${dni}`, 'DELETE');
      await cargarConductores();
      alert('Conductor eliminado correctamente');
    } catch (e) {
      console.error("Error al eliminar conductor:", e);
      alert("Error al eliminar conductor: " + e.message);
    }
  }
}

// -------------------- CRUD PASAJEROS --------------------
async function cargarPasajeros() {
  try {
    console.log("Cargando pasajeros...");
    const data = await fetchAPI('pasajeros');
    const tbody = document.getElementById('pasajeroTableBody');
    if (!tbody) {
      console.warn("No se encontró el elemento pasajeroTableBody");
      return;
    }
    tbody.innerHTML = '';
    data.forEach(p => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${p.dni}</td>
        <td>${p.nombreCompleto}</td>
        <td>${p.codigoPostal}</td>
        <td>${p.domicilio}</td>
        <td>${typeof p.vehiculoasignado === 'object' ? p.vehiculoasignado?.patente || 'No asignado' : p.vehiculoasignado || 'No asignado'}</td>
        <td>
          <button class='btn btn-warning btn-sm' onclick="editarPasajero('${p.dni}')">Editar</button>
          <button class='btn btn-danger btn-sm' onclick="eliminarPasajero('${p.dni}')">Eliminar</button>
        </td>`;
      tbody.appendChild(row);
    });
    console.log("Pasajeros cargados correctamente");
  } catch (e) {
    console.error("Error al cargar pasajeros:", e);
    alert("Error al cargar pasajeros: " + e.message);
  }
}

async function guardarPasajero(e) {
  e.preventDefault();
  try {
    const f = new FormData(e.target);
    const dni = f.get('dni');

    if (!validarDNI(dni)) {
      alert('DNI inválido. Debe contener al menos 7 dígitos.');
      return;
    }

    const obj = Object.fromEntries(f);

    const formElement = document.getElementById('pasajeroForm');
    const dniOriginal = formElement.getAttribute('data-editando-dni');
    const esEdicion = !!dniOriginal;

    const endpoint = esEdicion ? `pasajeros/${dniOriginal}` : 'pasajeros';
    const method = esEdicion ? 'PUT' : 'POST';

    await fetchAPI(endpoint, method, obj);

    const modalEl = document.getElementById('modalPasajero');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) {
      modal.hide();
    } else {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      document.querySelector('.modal-backdrop')?.remove();
    }

    formElement.removeAttribute('data-editando-dni');
    await cargarPasajeros();
    alert(method === 'PUT' ? 'Pasajero actualizado correctamente' : 'Pasajero agregado correctamente');
  } catch (e) {
    console.error("Error al guardar pasajero:", e);
    alert('Error al guardar pasajero: ' + e.message);
  }
}

function editarPasajero(dni) {
  try {
    console.log("Editando pasajero con DNI:", dni);
    fetchAPI(`pasajeros/${dni}`).then(data => {
      const f = document.getElementById('pasajeroForm');
      f.reset();
      f.dni.value = data.dni;
      f.nombreCompleto.value = data.nombreCompleto;
      f.codigoPostal.value = data.codigoPostal;
      f.domicilio.value = data.domicilio;
      f.vehiculoasignado.value = typeof data.vehiculoasignado === 'object'
        ? data.vehiculoasignado?.patente || ''
        : data.vehiculoasignado || '';

      // Guardamos el dni original por si lo cambian
      f.setAttribute('data-editando-dni', data.dni);

      const modal = new bootstrap.Modal(document.getElementById('modalPasajero'));
      modal.show();
    }).catch(err => {
      console.error("Error al obtener datos del pasajero:", err);
      alert("Error al obtener datos del pasajero: " + err.message);
    });
  } catch (e) {
    console.error("Error al editar pasajero:", e);
    alert("Error al editar pasajero: " + e.message);
  }
}

async function eliminarPasajero(dni) {
  if (confirm('¿Eliminar pasajero con DNI ' + dni + '?')) {
    try {
      await fetchAPI(`pasajeros/${dni}`, 'DELETE');
      await cargarPasajeros();
      alert('Pasajero eliminado correctamente');
    } catch (e) {
      console.error("Error al eliminar pasajero:", e);
      alert("Error al eliminar pasajero: " + e.message);
    }
  }
}

// -------------------- CRUD VEHÍCULOS --------------------
async function cargarVehiculos() {
  try {
    console.log("Cargando vehículos...");
    const data = await fetchAPI('vehiculos');
    const tbody = document.getElementById('vehiculoTableBody');
    if (!tbody) {
      console.warn("No se encontró el elemento vehiculoTableBody");
      return;
    }
    tbody.innerHTML = '';
    data.forEach(v => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${v.patente}</td>
        <td>${v.marca}</td>
        <td>${v.modelo}</td>
        <td>${v.combustible}</td>
        <td>${v.kilometraje}</td>
        <td>${formatearFecha(v.rto)}</td>
        <td>${v.equipamiento}</td>
        <td>
          <button class='btn btn-warning btn-sm' onclick="editarVehiculo('${v.patente}')">Editar</button>
          <button class='btn btn-danger btn-sm' onclick="eliminarVehiculo('${v.patente}')">Eliminar</button>
        </td>`;
      tbody.appendChild(row);
    });
    console.log("Vehículos cargados correctamente");
    alertaFechas();
  } catch (e) {
    console.error("Error al cargar vehículos:", e);
    alert("Error al cargar vehículos: " + e.message);
  }
}

async function guardarVehiculo(e) {
  e.preventDefault();
  try {
    const f = new FormData(e.target);
    let patente = f.get('patente')?.toUpperCase();

    if (!validarPatente(patente)) {
      alert('Patente inválida. Debe contener entre 1 y 7 caracteres alfanuméricos.');
      return;
    }

    const obj = Object.fromEntries(f);
    obj.patente = patente;

    const formElement = document.getElementById('vehiculoForm');
    const patenteOriginal = formElement.getAttribute('data-editando-patente');
    const esEdicion = !!patenteOriginal;

    const endpoint = esEdicion ? `vehiculos/${patenteOriginal}` : 'vehiculos';
    const method = esEdicion ? 'PUT' : 'POST';

    await fetchAPI(endpoint, method, obj);

    const modalEl = document.getElementById('modalVehiculo');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) {
      modal.hide();
    } else {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      document.querySelector('.modal-backdrop')?.remove();
    }

    formElement.removeAttribute('data-editando-patente');
    await cargarVehiculos();
    alert(method === 'PUT' ? 'Vehículo actualizado correctamente' : 'Vehículo agregado correctamente');
  } catch (e) {
    console.error("Error al guardar vehículo:", e);
    alert('Error al guardar vehículo: ' + e.message);
  }
}

function editarVehiculo(patente) {
  try {
    console.log("Editando vehículo con patente:", patente);
    fetchAPI(`vehiculos/${patente}`).then(data => {
      const f = document.getElementById('vehiculoForm');
      f.reset();
      f.patente.value = data.patente;
      f.marca.value = data.marca;
      f.modelo.value = data.modelo;
      f.combustible.value = data.combustible;
      f.kilometraje.value = data.kilometraje;
      f.rto.value = data.rto?.split('T')[0] || '';
      f.equipamiento.value = data.equipamiento || '';

      // Guardamos la patente original por si la cambian
      f.setAttribute('data-editando-patente', data.patente);

      const modal = new bootstrap.Modal(document.getElementById('modalVehiculo'));
      modal.show();
    }).catch(err => {
      console.error("Error al obtener datos del vehículo:", err);
      alert("Error al obtener datos del vehículo: " + err.message);
    });
  } catch (e) {
    console.error("Error al editar vehículo:", e);
    alert("Error al editar vehículo: " + e.message);
  }
}

async function eliminarVehiculo(patente) {
  if (confirm('¿Eliminar vehículo con patente ' + patente + '?')) {
    try {
      await fetchAPI(`vehiculos/${patente}`, 'DELETE');
      await cargarVehiculos();
      alert('Vehículo eliminado correctamente');
    } catch (e) {
      console.error("Error al eliminar vehículo:", e);
      alert("Error al eliminar vehículo: " + e.message);
    }
  }
}

// -------------------- PATENTES EN SELECT --------------------
async function cargarPatentesVehiculos() {
  try {
    console.log("Cargando patentes para selects...");
    const data = await fetchAPI('vehiculos/patentes');
    document.querySelectorAll('select[name="vehiculo"], select[name="vehiculoasignado"]').forEach(select => {
      select.innerHTML = '<option value="">Seleccione un vehículo</option>';
      data.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.patente;
        opt.textContent = v.patente;
        select.appendChild(opt);
      });
    });
    console.log("Patentes cargadas correctamente");
  } catch (e) {
    console.error("Error al cargar patentes:", e);
    alert("Error al cargar patentes: " + e.message);
  }
}

// -------------------- VERIFICACIÓN CÓDIGO --------------------
function setupVerificacionModal() {
  const btnVerificar = document.getElementById('btnVerificarModal');
  if (!btnVerificar) {
    console.warn("No se encontró el botón de verificación");
    return;
  }

  btnVerificar.addEventListener('click', () => {
    const inputs = document.querySelectorAll('.digit');
    if (!inputs || inputs.length === 0) {
      alert("No se encontraron campos de código.");
      return;
    }

    let codigo = '';
    inputs.forEach(input => {
      if (input && input.value) {
        codigo += input.value;
      }
    });

    console.log("Código ingresado:", codigo, "Longitud:", codigo.length);

    if (codigo.length !== 6) {
      alert("Por favor ingrese el código completo de 6 dígitos.");
      return;
    }

    const real = localStorage.getItem("codigo_verificacion");
    console.log("Código real:", real);

    if (codigo === real) {
      sessionStorage.setItem("verificacion_completa", "true");

      const modalEl = document.getElementById('modalVerificacion');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) {
        modal.hide();
      } else {
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.querySelector('.modal-backdrop')?.remove();
      }

      window.location.href = `${BASE_PATH}/index.html`;
    } else {
      alert("Código incorrecto");

      inputs.forEach(input => {
        input.value = '';
      });
      if (inputs[0]) {
        inputs[0].focus();
      }
    }
  });
}

// Iniciar sesión con Supabase
async function iniciarSesion(e) {
  if (e) e.preventDefault();

  try {
    const correo = document.getElementById("floatingInput").value;
    const contraseña = document.getElementById("floatingPassword").value;

    console.log("Iniciando sesión con correo:", correo);

    // Validar que los campos no estén vacíos
    if (!correo || !contraseña) {
      alert("Por favor complete todos los campos");
      return;
    }

    // Verificar que supabase esté disponible
    if (!window.supabase) {
      console.error("Error: Supabase no está inicializado correctamente");
      alert("Error de autenticación: el servicio no está disponible");
      return;
    }

    // Usamos la misma instancia de Supabase que viene del script del HTML
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email: correo,
      password: contraseña
    });

    if (error) {
      console.error("Error de autenticación:", error);
      alert("Correo o contraseña incorrectos.");
      return;
    }

    console.log("Autenticación exitosa:", data);

    // Si llegamos aquí, la autenticación fue exitosa
    localStorage.setItem("token", "ok");

    // Iniciamos el proceso de verificación por código
    iniciarVerificacion(correo);

  } catch (error) {
    console.error("Error general al iniciar sesión:", error);
    alert("Error al iniciar sesión: " + error.message);
  }
}

// -------------------- INIT --------------------
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM cargado, inicializando aplicación...");
  console.log("Ruta actual:", window.location.pathname);

  verificarAcceso();
  cargarConductores();
  cargarPasajeros();
  cargarPatentesVehiculos();
  cargarVehiculos();

  // Inicializar formularios y eventos
  const formularioLogin = document.getElementById('Formulario');
  if (formularioLogin) {
    console.log("Configurando formulario de login");
    formularioLogin.addEventListener('submit', iniciarSesion);
  }

  const salirBtn = document.getElementById('salir');
  if (salirBtn) {
    console.log("Configurando botón de salir");
    salirBtn.addEventListener('click', cerrarSesion);
  }

  const conductorForm = document.getElementById('conductorForm');
  if (conductorForm) {
    console.log("Configurando formulario de conductor");
    conductorForm.addEventListener('submit', guardarConductor);
  }

  const pasajeroForm = document.getElementById('pasajeroForm');
  if (pasajeroForm) {
    console.log("Configurando formulario de pasajero");
    pasajeroForm.addEventListener('submit', guardarPasajero);
  }

  const vehiculoForm = document.getElementById('vehiculoForm');
  if (vehiculoForm) {
    console.log("Configurando formulario de vehículo");
    vehiculoForm.addEventListener('submit', guardarVehiculo);
  }

  // Configurar modal de verificación
  setupVerificacionModal();

  // Cargar datos si estamos en las páginas correspondientes
  const path = window.location.pathname;
  if (path.includes('personal.html') || path.includes('/templates/personal.html')) {
    console.log("Estamos en la página de personal, cargando datos...");
    cargarConductores();
    cargarPasajeros();
    cargarPatentesVehiculos();
  } else if (path.includes('vehiculos.html') || path.includes('/templates/vehiculos.html')) {
    console.log("Estamos en la página de vehículos, cargando datos...");
    cargarVehiculos();
  }

  console.log("Inicialización completa");
});