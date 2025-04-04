// src/utils/errores.js
/**
 * Clases de errores personalizados para la aplicación
 */

/**
 * Error base para la aplicación
 */
class AppError extends Error {
    constructor(message, statusCode, errorCode = null) {
      super(message);
      this.statusCode = statusCode;
      this.errorCode = errorCode;
      this.isOperational = true; // Errores operacionales (esperados)
      
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Error para recursos no encontrados
   */
  class NotFoundError extends AppError {
    constructor(message = 'Recurso no encontrado') {
      super(message, 404, 'RESOURCE_NOT_FOUND');
    }
  }
  
  /**
   * Error para problemas de validación
   */
  class ValidationError extends AppError {
    constructor(message = 'Datos de entrada no válidos', errors = []) {
      super(message, 400, 'VALIDATION_ERROR');
      this.errors = errors;
    }
  }
  
  /**
   * Error para problemas de autenticación
   */
  class AuthenticationError extends AppError {
    constructor(message = 'Error de autenticación') {
      super(message, 401, 'AUTHENTICATION_ERROR');
    }
  }
  
  /**
   * Error para problemas de autorización
   */
  class AuthorizationError extends AppError {
    constructor(message = 'No tiene permiso para realizar esta acción') {
      super(message, 403, 'AUTHORIZATION_ERROR');
    }
  }
  
  /**
   * Error para conflictos (e.g., recursos duplicados)
   */
  class ConflictError extends AppError {
    constructor(message = 'Conflicto con el estado actual del recurso') {
      super(message, 409, 'CONFLICT_ERROR');
    }
  }
  
  /**
   * Error para solicitudes incorrectas
   */
  class BadRequestError extends AppError {
    constructor(message = 'Solicitud incorrecta') {
      super(message, 400, 'BAD_REQUEST');
    }
  }
  
  /**
   * Error para límite de tasa excedido
   */
  class RateLimitError extends AppError {
    constructor(message = 'Demasiadas solicitudes, por favor intente más tarde', retryAfter = 60) {
      super(message, 429, 'RATE_LIMIT_EXCEEDED');
      this.retryAfter = retryAfter;
    }
  }
  
  /**
   * Error para problemas de base de datos
   */
  class DatabaseError extends AppError {
    constructor(message = 'Error en la base de datos', originalError = null) {
      super(message, 500, 'DATABASE_ERROR');
      this.originalError = originalError;
    }
  }
  
  /**
   * Handler global para errores
   * @param {Error} err - Error capturado
   * @param {Object} req - Objeto request de Express
   * @param {Object} res - Objeto response de Express
   * @param {Function} next - Función next de Express
   */
  const errorHandler = (err, req, res, next) => {
    // Importar logger
    const logger = require('./logger');
    
    // Registrar error con ID de petición para correlación
    logger.error(`Error [${req.requestId}]: ${err.message}`, {
      stack: err.stack,
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user: req.user ? req.user.userId : 'anonymous'
    });
    
    // Si es un error operacional conocido
    if (err.isOperational) {
      // Formato de respuesta para errores operacionales
      const response = {
        status: 'error',
        message: err.message,
        requestId: req.requestId
      };
      
      // Agregar detalles específicos según el tipo de error
      if (err instanceof ValidationError && err.errors) {
        response.errors = err.errors;
      }
      
      if (err instanceof RateLimitError) {
        res.setHeader('Retry-After', err.retryAfter);
      }
      
      return res.status(err.statusCode).json(response);
    }
    
    // Para errores no operacionales o no esperados
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
      ? (statusCode === 500 ? 'Error del servidor' : err.message)
      : err.message || 'Error del servidor';
      
    res.status(statusCode).json({
      status: 'error',
      message,
      requestId: req.requestId,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
  };
  
  /**
   * Envuelve funciones asincrónicas para manejar errores sin try/catch
   * @param {Function} fn - Función asincrónica a envolver
   * @returns {Function} - Función con manejo de errores
   */
  const asyncHandler = (fn) => {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
  
  module.exports = {
    AppError,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    BadRequestError,
    RateLimitError,
    DatabaseError,
    errorHandler,
    asyncHandler
  };