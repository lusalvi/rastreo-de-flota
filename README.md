# Sistema de Rastreo de Flotas 🚗📍

Sistema web diseñado para gestionar eficientemente los vehículos de una empresa constructora, permitiendo monitorear en tiempo real la ubicación de los vehículos y gestionar los datos del personal asignado a cada unidad.

## 📋 Características Principales

- **Autenticación segura** con verificación por correo electrónico
- **Gestión integral** de vehículos, conductores y pasajeros
- **Monitoreo en tiempo real** con Google Maps API
- **Panel de control** con alertas de vencimientos
- **Interfaz dedicada** para conductores
- **Gestión de rutas** y asignación de personal

## 🛠️ Stack Tecnológico

### Frontend
- **HTML5** - Estructura de las páginas
- **CSS3** - Diseño y estética
- **JavaScript** - Lógica de interacción
- **Bootstrap** - Framework CSS para diseño responsivo

### Backend
- **Node.js** - Entorno de ejecución
- **Express.js** - Framework web
- **PostgreSQL** - Base de datos relacional

### Servicios Externos
- **Google Maps API** - Visualización de mapas y rutas
- **EmailJS** - Envío de correos de verificación
- **Supabase** - Base de datos como servicio

### Despliegue
- **Frontend**: Netlify
- **Backend**: Render
- **Base de datos**: Supabase

## 📦 Instalación

### Prerrequisitos

- Node.js
- npm o yarn
- Cuenta en Google Cloud Platform (para Maps API)
- Cuenta en Supabase
- Cuenta en EmailJS

### 1. Clonar el repositorio

```bash
git clone https://github.com/pauladist/rastreo-de-flota.git
cd rastreo-de-flota
```

### 2. Configurar el Backend

```bash
cd backend
npm install
```

Crear un archivo `.env` en la carpeta backend:

```env
# Configuración de Supabase
SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_supabase_anon_key

# Configuración del servidor
PORT=3000
NODE_ENV=development

# CORS (agregar el dominio del frontend)
FRONTEND_URL=http://localhost:3001
```

### 3. Configurar la Base de Datos

1. Crear un proyecto en [Supabase](https://supabase.com)
2. Ejecutar las siguientes tablas en el SQL Editor de Supabase:

```sql
-- Tabla de vehículos
CREATE TABLE vehiculos (
  id SERIAL PRIMARY KEY,
  marca VARCHAR(50) NOT NULL,
  modelo VARCHAR(50) NOT NULL,
  patente VARCHAR(10) UNIQUE NOT NULL,
  fecha_rto DATE,
  tipo_combustible VARCHAR(20),
  kilometraje INTEGER,
  equipamiento TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de conductores
CREATE TABLE conductores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  dni VARCHAR(20) UNIQUE NOT NULL,
  domicilio TEXT,
  fecha_venc_licencia DATE,
  categoria_licencia VARCHAR(10),
  vehiculo_patente VARCHAR(10) REFERENCES vehiculos(patente),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de pasajeros
CREATE TABLE pasajeros (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  dni VARCHAR(20) UNIQUE NOT NULL,
  domicilio TEXT,
  vehiculo_patente VARCHAR(10) REFERENCES vehiculos(patente),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de usuarios (supervisor)
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  ultimo_acceso TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Configurar el Frontend

```bash
cd ../frontend
# No requiere instalación de dependencias adicionales ya que usa CDN
```

Crear un archivo config.js en la carpeta frontend:
```bash
// Configuración de APIs
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api',
  GOOGLE_MAPS_API_KEY: 'tu_google_maps_api_key',
  EMAILJS_PUBLIC_KEY: 'tu_emailjs_public_key',
  EMAILJS_SERVICE_ID: 'tu_emailjs_service_id',
  EMAILJS_TEMPLATE_ID: 'tu_emailjs_template_id'
};
```

### 5. Configurar APIs Externas

#### Google Maps API
1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear un nuevo proyecto o seleccionar uno existente
3. Habilitar las APIs: Maps JavaScript API, Geocoding API, Directions API
4. Crear credenciales (API Key)
5. Configurar restricciones de dominio para seguridad

#### EmailJS
1. Crear cuenta en [EmailJS](https://www.emailjs.com)
2. Configurar un servicio de email (Gmail, Outlook, etc.)
3. Crear un template para el código de verificación
4. Obtener las claves: Public Key, Service ID, Template ID

## 🚀 Ejecución

### Desarrollo Local

1. **Iniciar el backend:**
```bash
cd backend
npm run dev
# El servidor estará disponible en http://localhost:3000
```

2. **Servir el frontend:**
```bash
cd frontend
# Usar un servidor local, por ejemplo:
python -m http.server 3001
# O usando Live Server en VS Code
# El frontend estará disponible en http://localhost:3001
```

## 📱 Uso del Sistema

### Acceso del Supervisor
1. Acceder a la URL del frontend
2. Iniciar sesión con credenciales registradas
3. Verificar identidad con código enviado por email
4. Acceder al panel principal

### Funcionalidades Principales
- **Dashboard**: Vista general de vehículos, conductores y vencimientos
- **Gestión de Vehículos**: CRUD completo de la flota
- **Gestión de Personal**: CRUD completo de conductores y pasajeros
- **Centro de Monitoreo**: Visualización en tiempo real de vehículos activos

### Interfaz del Conductor
Acceder a: `[frontend-url]/templates/seguimiento.html?dni=[dni_conductor]`

## 🏗️ Estructura del Proyecto

```
rastreo-de-flota/
├── backend/
│   ├── .env             
│   ├── server.js        
│   └── package.json
├── frontend/
│   ├── css/             
│   ├── js/              
│   ├── templates/      
│   ├── img/        
│   └── index.html     
└── README.md
```

## 🔒 Seguridad

- Autenticación en dos pasos con verificación por email
- Variables de entorno para claves sensibles
- Configuración CORS para el backend
- Validación de datos en frontend y backend

## 🚀 Despliegue en Producción

### Frontend (Netlify)
1. Conectar repositorio de GitHub
2. Configurar build settings si es necesario
3. Agregar variables de entorno en Netlify

### Backend (Render)
1. Conectar repositorio de GitHub
2. Configurar variables de entorno
3. El servicio se reiniciará automáticamente con cada push

## 📄 Licencia

Este proyecto fue desarrollado como trabajo académico para la materia de Metodología y Testing.

## 👥 Autores

- Paula Distefano
- Lucía Salvi  
- Yael Zuna

---

⭐ Si este proyecto te resultó útil, no olvides darle una estrella en GitHub!
