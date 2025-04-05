# Clinica-Backend

API backend para el sistema de gestión de clínica odontológica.

## Tecnologías
- Node.js
- Express v4.21.2
- MongoDB (mongoose v8.10.1)
- JWT para autenticación

## Dependencias principales
- bcryptjs: ^3.0.0
- canvas: ^3.1.0
- connect-mongo: ^5.1.0
- cookie-parser: ^1.4.7
- cors: ^2.8.5
- dotenv: ^16.4.7
- exceljs: ^4.4.0
- express-mongo-sanitize: ^2.2.0
- express-rate-limit: ^7.5.0
- express-session: ^1.18.1
- express-validator: ^7.2.1
- handlebars: ^4.7.8
- helmet: ^8.0.0
- jsonwebtoken: ^9.0.2
- nodemailer: ^6.10.0
- pdfkit: ^0.16.0
- qrcode: ^1.5.4
- twilio: ^5.5.1

## Estructura
- `/src`: Código fuente principal
  - `/config`: Configuraciones (DB, CORS, storage, PDF)
  - `/controllers`: Controladores para las rutas API
  - `/middleware`: Middlewares (auth, security, upload, validación)
  - `/models`: Modelos de datos MongoDB
  - `/routes`: Definición de rutas API
  - `/services`: Servicios (PDF, email, SMS, estadísticas)
  - `/utils`: Utilidades (errores, validadores, formatters, logger)
  - `index.js`: Punto de entrada principal
- `/logs`: Archivos de registro del sistema

## Características
- Autenticación avanzada con JWT y renovación automática
- Seguridad robusta (protección CSRF, rate limiting, detección de contenido malicioso)
- Gestión de sesiones con almacenamiento seguro en MongoDB
- Protección contra ataques NoSQL injection, XSS, CSRF
- Generación de PDFs y documentos con firmas digitales
- Sistema completo de citas (programación, reprogramación y cancelación)
- Gestión completa de expedientes médicos
- Sistema integrado de facturación y pagos
- Generación de informes (exportación a Excel y PDF)
- Comunicación multicanal (Email y SMS)
- Control de acceso por roles (Administrador, médico, secretaria, paciente)

## Endpoints principales

### Autenticación
- POST `/api/auth/register`: Registro de usuarios
- POST `/api/auth/login`: Inicio de sesión
- GET `/api/auth/me`: Información del usuario actual
- PUT `/api/auth/password`: Cambio de contraseña
- POST `/api/auth/recovery`: Recuperación de contraseña
- POST `/api/auth/logout`: Cierre de sesión

### Pacientes
- GET `/api/pacientes`: Listar pacientes
- POST `/api/pacientes`: Crear paciente
- GET `/api/pacientes/:id`: Obtener paciente por ID
- PUT `/api/pacientes/:id`: Actualizar paciente
- GET `/api/pacientes/:id/historias`: Historias clínicas
- GET `/api/pacientes/:id/documentos`: Documentos
- GET `/api/pacientes/:id/citas`: Citas

### Citas
- GET `/api/citas`: Listar citas
- POST `/api/citas`: Crear cita
- GET `/api/citas/:id`: Obtener cita por ID
- PUT `/api/citas/:id`: Actualizar cita
- PUT `/api/citas/:id/estado`: Cambiar estado
- POST `/api/citas/:id/reprogramar`: Reprogramar
- POST `/api/citas/:id/cancelar`: Cancelar

## Instalación
```
npm install
```

## Configuración
Crear archivo `.env` con las siguientes variables:
```
# Server
PORT=4000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/tubasededatos

# Security
JWT_SECRET=token_secreto
JWT_EXPIRES_IN=1d
SESSION_SECRET=token_secreto_sesion
SESSION_CRYPTO_SECRET=token_secreto_cifrado
COOKIE_SECRET=token_secreto_cookies

# CORS
CORS_ORIGIN=http://localhost:3000,https://tudominio.com

# Logs (opcional)
LOG_LEVEL=error
LOG_FORMAT=combined
```

## Ejecución
```
npm start    # Para producción
npm run dev  # Para desarrollo con nodemon
```