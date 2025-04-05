const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN.split(',');
    
    // Permitir solicitudes sin origen (como aplicaciones móviles o herramientas API) en desarrollo
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'X-CSRF-Token',
    'X-Client-ID',
    'Accept'
  ],
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range', 
    'New-Authorization',
    'X-Request-ID',
    'X-CSRF-Token'
  ],
  credentials: true,
  maxAge: 600, // 10 minutos
  preflightContinue: false,
  optionsSuccessStatus: 204
};

module.exports = corsOptions;