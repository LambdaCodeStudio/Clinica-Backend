# Backend Seguro con Express y MongoDB

Esta plantilla proporciona un backend seguro y listo para producción con Express.js y MongoDB, implementando las mejores prácticas de seguridad y rendimiento.

## 🛡️ Características de Seguridad Avanzadas

- ✅ Autenticación JWT con renovación automática y soporte multi-fuente
- ✅ Protección CSRF avanzada con tokens y verificación de origen
- ✅ Rate limiting diferenciado por ruta con penalización para intentos fallidos
- ✅ Detección de contenido malicioso en solicitudes
- ✅ Protección contra inyecciones NoSQL con alertas
- ✅ Content Security Policy (CSP) configurable por tipo de contenido
- ✅ Cookies seguras con firma criptográfica
- ✅ Control granular de caché para prevenir filtraciones de datos
- ✅ Gestión segura de sesiones en MongoDB con cifrado adicional
- ✅ Tracking de actividad sospechosa y ataques potenciales
- ✅ Cierre controlado del servidor para mantener integridad de datos
- ✅ Sistema de correlación de errores con Request-ID
- ✅ Monitoreo de salud del servidor con endpoint dedicado
- ✅ Control de tamaño de payload para prevenir ataques DoS
- ✅ Headers de seguridad extensivos con configuración optimizada

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- MongoDB instalado y corriendo
- npm o yarn

## 🚀 Instalación

1. Clonar e instalar:
```bash
git clone <tu-repositorio>
cd backend
npm install
```

2. Configurar `.env`:
```env
# Server
PORT=4000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/tubasededatos

# Security
JWT_SECRET=genera_un_token_aleatorio_largo_y_seguro_aqui
JWT_EXPIRES_IN=1d
SESSION_SECRET=otro_token_aleatorio_largo_y_seguro_diferente
SESSION_CRYPTO_SECRET=token_aleatorio_para_cifrado_sesiones
COOKIE_SECRET=token_aleatorio_para_firmar_cookies

# CORS
CORS_ORIGIN=http://localhost:3000,https://tudominio.com

# Logs (opcional)
LOG_LEVEL=error
LOG_FORMAT=combined
```

## 🏃‍♂️ Inicio

```bash
npm start
```

## 📁 Estructura y Flujo

```
backend/
  ├── src/
  │   ├── config/
  │   │   ├── db.js        # Conexión MongoDB
  │   │   └── cors.js      # Configuración CORS mejorada
  │   ├── controllers/
  |   |   └── auth.js      # Controladores autenticación
  │   ├── middleware/
  │   │   ├── auth.js      # JWT Middleware avanzado
  │   │   └── security.js  # Múltiples capas de seguridad
  │   ├── models/
  │   ├── routes/
  │   └── index.js         # Configuración principal
```

## 🔒 Protocolos de Seguridad Implementados

### 1. Sistema Completo de Protección CSRF
- **Double Submit Cookie Pattern**: Token CSRF enviado tanto en cookie como en header
- **Verificación Origen/Referer**: Validación estricta de origen de solicitudes
- **Generación Segura**: Tokens CSRF utilizando `crypto.randomBytes()`
- **API Endpoint**: Soporte para SPAs con `/api/csrf-token`
- **Renovación Automática**: Regeneración de tokens en caso de error
- **Bypass de Métodos Seguros**: Permitido para GET/HEAD/OPTIONS

### 2. Sistema Avanzado de Detección de Amenazas
- **Patrones de Ataque**: Detección de patrones de XSS, inyección, etc.
- **Registro de Actividad Sospechosa**: Alertas para URLs y patrones maliciosos
- **Monitoreo de Payloads**: Validación de tamaño y contenido
- **Logging Mejorado**: Correlación de solicitudes con Request-IDs únicos
- **Sanitización de Datos**: Limpieza agresiva de entradas con alertas de intento

### 3. Gestión de Sesiones de Alta Seguridad
- **Almacenamiento Encriptado**: Datos de sesión cifrados en MongoDB
- **Rotación Automática**: Rolling sessions para extender automáticamente
- **Timeout de Inactividad**: Caducidad configurable
- **Limpieza Periódica**: Auto-eliminación de sesiones expiradas
- **Optimización MongoDB**: Reducción de operaciones con touchAfter

### 4. Protección Contra Ataques de Fuerza Bruta
- **Rate Limiting Inteligente**: Diferentes límites según criticidad de ruta
- **Penalización para Fallos**: skipSuccessfulRequests para identificar ataques
- **Headers Estándar**: Conformidad con RFC para clients y proxies
- **Retry-After**: Indicación explícita de tiempo de espera
- **Mensajes Claros**: Respuestas informativas sin divulgar detalles sensibles

### 5. Gestión Robusta de Errores y Despliegue
- **Centralización**: Manejo unificado de todos los errores
- **Request-ID**: Correlación para facilitar debugging
- **Mensajes Sanitizados**: Sin detalle técnico en producción
- **Cierre Controlado**: Proceso de apagado limpio con timeout
- **Keep-Alive**: Configuración optimizada para balanceadores de carga

## 🌐 Endpoints API

### Autenticación y Usuarios
- **POST** `/api/auth/register` - Registro con validación robusta
- **POST** `/api/auth/login` - Login con generación de token JWT
- **GET** `/api/auth/me` - Obtener perfil con renovación automática de token
- **POST** `/api/auth/logout` - Cierre seguro de sesión
- **POST** `/api/auth/forgot-password` - Solicitud de recuperación de contraseña
- **POST** `/api/auth/reset-password` - Restablecimiento de contraseña con token
- **POST** `/api/auth/change-password` - Cambio de contraseña (autenticado)

### Sistema y Monitoreo
- **GET** `/api/health` - Verificación de estado del servidor
- **GET** `/api/csrf-token` - Obtención de nuevo token CSRF

## ⚙️ Flujo de Seguridad de Solicitudes

1. **Validación Inicial**:
   - Verificación de actividad sospechosa
   - Limitación de tamaño de payload
   - Control CORS con origen verificado

2. **Capa de Seguridad HTTP**:
   - Headers Helmet con CSP estricto
   - Sanitización de entradas MongoDB
   - Protección contra parámetros duplicados

3. **Validación de Contenido**:
   - Detección de patrones maliciosos
   - Control de caché para datos sensibles
   - Rate limiting según criticidad

4. **Verificación de Identidad**:
   - CSRF token validation
   - JWT verification con renovación
   - Control de sesión

5. **Procesamiento Seguro**:
   - Validación específica de ruta
   - Autorización basada en roles
   - Sanitización de salidas

6. **Manejo de Errores**:
   - Request-ID para correlación
   - Mensajes adaptados al entorno
   - Logging estructurado

## 🔧 Configuración de Helmet

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      formAction: ["'self'"],
      workerSrc: ["'self'", "blob:"]
    }
  },
  // Configuraciones adicionales...
})
```

## ⚠️ Consideraciones para Producción

1. Implementar HTTPS con certificados válidos
2. Configurar límites de rate según tráfico esperado
3. Ajustar CSP conforme a necesidades específicas
4. Verificar compatibilidad CORS con todos los clientes
5. Implementar logs a sistema externo para análisis
6. Configurar sistema de alerta para actividad sospechosa
7. Realizar auditorías de seguridad periódicas

## 📝 Licencia

MIT# Clinica-Backend
