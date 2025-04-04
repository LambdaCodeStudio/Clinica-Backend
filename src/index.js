require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const { 
  dosProtection, 
  sanitizeParams, 
  csrfProtection, 
  generateCsrfToken, 
  detectSuspiciousContent,
  requestSizeLimit,
  cacheControl,
  logSuspiciousActivity
} = require('./middleware/security');
const corsOptions = require('./config/cors');
const MongoStore = require('connect-mongo');

// Inicializar Express
const app = express();

// Habilitar confianza en Proxy si está detrás de un balanceador de carga o proxy inverso
app.set('trust proxy', 1);

// Registro de actividad sospechosa - aplicar temprano en la cadena de middlewares
app.use(logSuspiciousActivity);

// Middlewares básicos
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' })); // Limitar tamaño de solicitudes JSON
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET)); // Firmar cookies

// Límite de tamaño de solicitud explícito
app.use(requestSizeLimit);

// Seguridad avanzada con Helmet
app.use(helmet({
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
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
}));

// Protección contra inyección NoSQL en MongoDB
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`¡Intento de inyección NoSQL detectado! Se sanitizó el campo: ${key}`);
  }
}));

// Protección contra contaminación de parámetros HTTP
app.use(sanitizeParams);

// Controlar caching de respuestas
app.use(cacheControl);

// Detección de contenido malicioso en solicitudes
app.use(detectSuspiciousContent);

// Configuración de sesiones con MongoDB
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: 'sid', // Nombre genérico para no revelar tecnología
  resave: false,
  saveUninitialized: false,
  rolling: true, // Renueva el tiempo de expiración en cada respuesta
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60, // 1 día
    crypto: {
      secret: process.env.SESSION_CRYPTO_SECRET
    },
    autoRemove: 'interval',
    autoRemoveInterval: 60, // Limpiar sesiones expiradas cada 60 minutos
    touchAfter: 5 * 60 // Actualizar sesión en la base de datos solo después de 5 minutos
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 día
  }
}));

// Generar y proporcionar token CSRF
app.use(generateCsrfToken);

// CSRF Protection - después de inicializar session
app.use(csrfProtection);

// Rate Limiting - diferente por rutas
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por ventana por IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar solicitudes exitosas
  message: { 
    status: 'error',
    message: 'Demasiados intentos fallidos desde esta IP, por favor intente nuevamente después de 15 minutos' 
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // limitar cada IP a 200 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    status: 'error',
    message: 'Demasiadas solicitudes, por favor intente nuevamente después de 15 minutos' 
  }
});

// Aplicar limitadores de tasa según la ruta
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api', apiLimiter);

// Protección contra DoS
app.use(dosProtection);

// Headers de seguridad adicionales
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Añadir ID de petición para debugging y correlación de logs
  const requestId = crypto.randomBytes(16).toString('hex');
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
});

// Endpoint para verificar estado de salud del servicio
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Endpoint para obtener token CSRF (útil para SPA)
app.get('/api/csrf-token', (req, res) => {
  res.json({ 
    csrfToken: req.session.csrfToken 
  });
});

// Rutas API
app.use('/api/auth', require('./routes/auth'));

// Middleware para errores 404
app.use((req, res) => {
  res.status(404).json({ 
    status: 'error',
    message: 'Recurso no encontrado' 
  });
});

// Middleware para manejo de errores global
app.use((err, req, res, next) => {
  // Registrar error con ID de petición para correlación
  console.error(`Error [${req.requestId}]: ${err.message}`);
  console.error(err.stack);
  
  // No exponer detalles de error en producción
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? (status === 500 ? 'Error del servidor' : err.message)
    : err.message || 'Error del servidor';
    
  res.status(status).json({
    status: 'error',
    message,
    requestId: req.requestId // Incluir ID para referenciar en reportes
  });
});

// Proceso de cierre limpio
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  console.log('Iniciando cierre controlado del servidor...');
  
  // Dejar de aceptar nuevas conexiones
  server.close(() => {
    console.log('Servidor HTTP cerrado.');
    
    // Cerrar conexión a la base de datos
    mongoose.connection.close(false, () => {
      console.log('Conexión a MongoDB cerrada.');
      process.exit(0);
    });
  });
  
  // Si el cierre no ocurre en 10 segundos, forzar cierre
  setTimeout(() => {
    console.error('No se pudo cerrar limpiamente, forzando cierre...');
    process.exit(1);
  }, 10000);
}

// Iniciar servidor
const PORT = process.env.PORT || 4000;

let server;
connectDB()
  .then(() => {
    server = app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
    
    // Configurar timeout del servidor
    server.timeout = 30000; // 30 segundos
    
    // Configurar keep-alive
    server.keepAliveTimeout = 65000; // Ligeramente mayor que el valor por defecto de ALB/Nginx (60s)
    server.headersTimeout = 66000; // Ligeramente mayor que keepAliveTimeout
  })
  .catch(err => {
    console.error('Error al iniciar servidor:', err);
    process.exit(1);
  });