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

            const rutaFinal = window.location.origin.includes('127.0.0.1') || window.location.origin.includes('localhost')
                ? '/frontend/index.html'
                : '/index.html';

            window.location.href = rutaFinal;
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

    // Inicializar formularios y eventos
    const formularioLogin = document.getElementById('Formulario');
    if (formularioLogin) {
        console.log("Configurando formulario de login");
        formularioLogin.addEventListener('submit', iniciarSesion);
    }

    // Configurar modal de verificación
    setupVerificacionModal();

    console.log("Inicialización de login completa");
});