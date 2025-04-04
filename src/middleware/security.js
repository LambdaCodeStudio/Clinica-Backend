const toobusy = require('toobusy-js');
const { validationResult } = require('express-validator');
const hpp = require('hpp');
const crypto = require('crypto');

// Configuración de DoS
toobusy.maxLag(70); // Ajustar sensibilidad (valor en ms, menor es más sensible)

// Protección contra DoS
const dosProtection = (req, res, next) => {
  if (toobusy()) {
    res.status(503).json({ 
      status: 'error',
      message: 'Servidor ocupado, intente más tarde',
      retryAfter: 30
    });
    res.setHeader('Retry-After', '30');
  } else {
    next();
  }
};

// Validación de entrada
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      status: 'error',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Sanitización de parámetros HTTP
const sanitizeParams = hpp({
  whitelist: [] // Añadir parámetros que pueden duplicarse, si es necesario
});

// Protección contra CSRF
const csrfProtection = (req, res, next) => {
  const requestOrigin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = process.env.CORS_ORIGIN.split(',');
  
  // Bypass para métodos seguros (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Verificar origen y referer para métodos no seguros
  const validOrigin = !requestOrigin || allowedOrigins.some(origin => requestOrigin === origin);
  const validReferer = !referer || allowedOrigins.some(origin => referer.startsWith(origin));
  
  if (!validOrigin || !validReferer) {
    console.warn(`Posible ataque CSRF bloqueado: Origin=${requestOrigin}, Referer=${referer}`);
    return res.status(403).json({ 
      status: 'error', 
      message: 'Solicitud no permitida por motivos de seguridad'
    });
  }
  
  // Verificar CSRF token para métodos que modifican datos
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionCsrfToken = req.session?.csrfToken;
    
    if (!csrfToken || !sessionCsrfToken || csrfToken !== sessionCsrfToken) {
      return res.status(403).json({
        status: 'error',
        message: 'Token CSRF inválido o faltante'
      });
    }
  }
  
  next();
};

// Generador de token CSRF
const generateCsrfToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  // Exponer el token CSRF en una cookie no-HttpOnly para que JS pueda acceder
  res.cookie('XSRF-TOKEN', req.session.csrfToken, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    httpOnly: false, // Debe ser false para que JS pueda leerlo
    path: '/'
  });
  
  next();
};

// Detector de contenido malicioso
const detectSuspiciousContent = (req, res, next) => {
  const body = JSON.stringify(req.body).toLowerCase();
  
  // Patrones que podrían indicar contenido malicioso
  const suspiciousPatterns = [
    /<script>/i,
    /javascript:/i,
    /onclick/i,
    /onerror/i,
    /onload/i,
    /eval\(/i,
    /document\.cookie/i,
    /exec\(/i,
    /function\(\)/i,
    /\$where:/i, // Intento de inyección NoSQL
    /\$ne:/i,    // Intento de inyección NoSQL
    /\$gt:/i     // Intento de inyección NoSQL
  ];
  
  // Revisar el cuerpo de la solicitud para patrones sospechosos
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(body)) {
      console.warn(`Contenido sospechoso detectado: ${pattern.toString()}`);
      return res.status(403).json({
        status: 'error',
        message: 'La solicitud contiene contenido potencialmente malicioso'
      });
    }
  }
  
  next();
};

// Limitar tamaño de solicitudes
const requestSizeLimit = (req, res, next) => {
  // Ya configurado globalmente en express.json() y express.urlencoded(),
  // Este middleware es para verificación adicional
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  // Límite de 100KB
  if (contentLength > 102400) {
    return res.status(413).json({
      status: 'error',
      message: 'Payload demasiado grande. El límite es 100KB.'
    });
  }
  
  next();
};

// Establecer restricciones de cache
const cacheControl = (req, res, next) => {
  // No cachear respuestas por defecto
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Registro de actividad sospechosa
const logSuspiciousActivity = (req, res, next) => {
  // Lista de patrones sospechosos en URL
  const suspiciousUrlPatterns = [
    /\/\.git/,
    /\/\.env/,
    /\/wp-admin/,
    /\/admin/,
    /\/backup/,
    /\/config/,
    /\/shell/,
    /\/cmd/,
    /\/login\.php/,
    /\/admin\.php/
  ];
  
  const url = req.originalUrl || req.url;
  
  // Verificar si la URL es sospechosa
  for (const pattern of suspiciousUrlPatterns) {
    if (pattern.test(url)) {
      const ipAddress = req.ip || req.connection.remoteAddress;
      console.warn(`Actividad sospechosa: IP=${ipAddress}, URL=${url}, Método=${req.method}`);
      // Continuar la ejecución pero registrar la actividad
      break;
    }
  }
  
  next();
};

module.exports = { 
  dosProtection, 
  validate, 
  sanitizeParams,
  csrfProtection,
  generateCsrfToken,
  detectSuspiciousContent,
  requestSizeLimit,
  cacheControl,
  logSuspiciousActivity
};