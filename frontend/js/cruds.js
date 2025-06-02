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

        const fechaRtoRealizacion = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);
        // Sumar 2 años a la fecha de realización para obtener la fecha de vencimiento
        const fechaRtoVencimiento = new Date(fechaRtoRealizacion);
        fechaRtoVencimiento.setFullYear(fechaRtoVencimiento.getFullYear() + 2);

        const hoy = new Date();
        const diferenciaRto = (fechaRtoVencimiento - hoy) / (1000 * 60 * 60 * 24);

        if (diferenciaRto <= 14 && diferenciaRto >= 0) {
            alert(`¡Atención! El vehículo con patente ${row.cells[0].innerText} tiene la RTO por vencer en ${Math.ceil(diferenciaRto)} días.`);
        }
    });

}

// Función para normalizar texto (quitar tildes y caracteres especiales)
function normalizarTexto(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quita los acentos
        .replace(/[^\w\s]/g, ''); // Quita caracteres especiales excepto espacios
}

function filtrarTabla(idTabla, idInput, idContador) {
    const input = document.getElementById(idInput);
    const filter = normalizarTexto(input.value);

    // Mapeo de IDs para mantener compatibilidad
    const mapeoTablas = {
        'tablaConductores': 'conductorTable',
        'tablaPasajeros': 'pasajeroTable',
        'tablaVehiculos': 'vehiculoTable'
    };

    // Usar el ID mapeado si existe, sino usar el ID original
    const idTablaReal = mapeoTablas[idTabla] || idTabla;
    const table = document.getElementById(idTablaReal);

    if (!table) {
        console.error(`No se encontró la tabla con ID: ${idTabla} o ${idTablaReal}`);
        return;
    }

    const rows = table.getElementsByTagName("tr");
    let totalCoincidencias = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getElementsByTagName("td");
        let show = false;

        for (let j = 0; j < cells.length; j++) {
            const textoCelda = normalizarTexto(cells[j].innerText);
            if (textoCelda.includes(filter)) {
                show = true;
                break;
            }
        }

        row.style.display = show ? "" : "none";
        if (show) totalCoincidencias++;
    }

    if (counter) {
        if (filter === "") {
            counter.textContent = "";
            counter.classList.remove('visible', 'no-results');
        } else {
            counter.classList.add('visible');
            if (totalCoincidencias > 0) {
                counter.textContent = totalCoincidencias;
                counter.classList.remove('no-results');
            } else {
                counter.textContent = "0";
                counter.classList.add('no-results');
            }
        }
    }
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

function limpiarFormulario(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelectorAll('input, textarea, select').forEach(campo => {
        if (campo.type === 'checkbox' || campo.type === 'radio') {
            campo.checked = false;
        } else {
            campo.value = '';
        }
    });

    // También eliminamos el atributo de edición por si estaba seteado
    form.removeAttribute('data-editando-dni');
    form.removeAttribute('data-editando-patente');
}

//--------------------------------- INIT ---------------------------------
document.addEventListener('DOMContentLoaded', () => {
    cargarConductores();
    cargarPasajeros();
    cargarPatentesVehiculos();
    cargarVehiculos();

    // Limpiar formularios al abrir los modales de "nuevo"
    const btnNuevoConductor = document.getElementById('btnNuevoConductor');
    if (btnNuevoConductor) {
        btnNuevoConductor.addEventListener('click', () => {
            limpiarFormulario('conductorForm');
        });
    }

    const btnNuevoPasajero = document.getElementById('btnNuevoPasajero');
    if (btnNuevoPasajero) {
        btnNuevoPasajero.addEventListener('click', () => {
            limpiarFormulario('pasajeroForm');
        });
    }

    const btnNuevoVehiculo = document.getElementById('btnNuevoVehiculo');
    if (btnNuevoVehiculo) {
        btnNuevoVehiculo.addEventListener('click', () => {
            limpiarFormulario('vehiculoForm');
        });
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
});

