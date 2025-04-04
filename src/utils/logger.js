// src/utils/logger.js
const fs = require('fs');
const path = require('path');
const { format } = require('util');

/**
 * Clase para manejar el logging de la aplicación
 */
class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      debug: 4
    };

    // Configuración por defecto
    this.config = {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'combined',
      logToFile: process.env.LOG_TO_FILE === 'true',
      logDir: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
      maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE || 5) * 1024 * 1024, // 5MB por defecto
      maxLogFiles: parseInt(process.env.MAX_LOG_FILES || 5),
      colorize: process.env.NODE_ENV !== 'production'
    };

    // Crear directorio de logs si no existe
    if (this.config.logToFile && !fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }

    // Colores para la consola
    this.colors = {
      reset: '\x1b[0m',
      error: '\x1b[31m', // Rojo
      warn: '\x1b[33m',  // Amarillo
      info: '\x1b[36m',  // Cyan
      http: '\x1b[35m',  // Magenta
      debug: '\x1b[32m'  // Verde
    };
  }

  /**
   * Verifica si el nivel de log está habilitado
   * @param {String} level - Nivel a verificar
   * @returns {Boolean} - true si el nivel está habilitado
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.config.level];
  }

  /**
   * Formatea un mensaje de log
   * @param {String} level - Nivel del log
   * @param {String} message - Mensaje a loguear
   * @param {Object} meta - Metadatos adicionales
   * @returns {String} - Mensaje formateado
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const requestId = meta.requestId || '-';
    
    // Formatear metadatos
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      // Eliminar requestId ya que se incluye por separado
      const { requestId, ...restMeta } = meta;
      if (Object.keys(restMeta).length > 0) {
        metaStr = JSON.stringify(restMeta);
      }
    }
    
    // Estilo simple o combinado
    if (this.config.format === 'simple') {
      return `${timestamp} [${level.toUpperCase()}] [${requestId}] ${message} ${metaStr}`;
    } else {
      // Formato combinado (similar a Apache)
      const pid = process.pid;
      return `${timestamp} [${level.toUpperCase()}] [${pid}] [${requestId}] ${message} ${metaStr}`;
    }
  }

  /**
   * Escribe un mensaje en el log
   * @param {String} level - Nivel del log
   * @param {String} message - Mensaje a loguear
   * @param {Object} meta - Metadatos adicionales
   */
  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;
    
    // Si se proporcionaron argumentos de formato, aplicarlos
    if (arguments.length > 3) {
      const args = Array.prototype.slice.call(arguments, 2);
      message = format(message, ...args);
    }
    
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Output a consola
    if (this.config.colorize) {
      console[level](`${this.colors[level]}${formattedMessage}${this.colors.reset}`);
    } else {
      console[level](formattedMessage);
    }
    
    // Output a archivo si está configurado
    if (this.config.logToFile) {
      this.writeToFile(level, formattedMessage);
    }
  }

  /**
   * Escribe un mensaje en un archivo de log
   * @param {String} level - Nivel del log
   * @param {String} message - Mensaje formateado
   */
  writeToFile(level, message) {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const logFile = path.join(this.config.logDir, `${level}-${date}.log`);
      
      // Agregar salto de línea
      message += '\n';
      
      // Escribir de forma asíncrona
      fs.appendFile(logFile, message, (err) => {
        if (err) {
          console.error(`Error al escribir en archivo de log: ${err.message}`);
        }
        
        // Verificar tamaño del archivo
        this.checkLogFileSize(logFile);
      });
    } catch (error) {
      console.error(`Error en el sistema de logs: ${error.message}`);
    }
  }

  /**
   * Verifica el tamaño del archivo de log y lo rota si es necesario
   * @param {String} logFile - Ruta del archivo de log
   */
  checkLogFileSize(logFile) {
    fs.stat(logFile, (err, stats) => {
      if (err) return;
      
      if (stats.size >= this.config.maxLogFileSize) {
        this.rotateLogFile(logFile);
      }
    });
  }

  /**
   * Rota un archivo de log
   * @param {String} logFile - Ruta del archivo de log
   */
  rotateLogFile(logFile) {
    const dirname = path.dirname(logFile);
    const basename = path.basename(logFile);
    
    // Buscar archivos rotados existentes
    fs.readdir(dirname, (err, files) => {
      if (err) return;
      
      const rotatedFiles = files
        .filter(file => file.startsWith(`${basename}.`))
        .sort((a, b) => {
          const numA = parseInt(a.split('.').pop() || '0');
          const numB = parseInt(b.split('.').pop() || '0');
          return numB - numA; // Ordenar descendente
        });
      
      // Eliminar archivos antiguos si excede el máximo
      if (rotatedFiles.length >= this.config.maxLogFiles) {
        const oldestFile = rotatedFiles.pop();
        fs.unlink(path.join(dirname, oldestFile), (err) => {
          if (err) console.error(`Error al eliminar log antiguo: ${err.message}`);
        });
      }
      
      // Rotar archivos
      let maxIndex = 0;
      if (rotatedFiles.length > 0) {
        maxIndex = parseInt(rotatedFiles[0].split('.').pop() || '0');
      }
      
      const newFile = `${logFile}.${maxIndex + 1}`;
      fs.rename(logFile, newFile, (err) => {
        if (err) console.error(`Error al rotar archivo de log: ${err.message}`);
      });
    });
  }

  /**
   * Métodos para cada nivel de log
   */
  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  http(message, meta = {}) {
    this.log('http', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Registra el inicio de una petición HTTP
   * @param {Object} req - Objeto de solicitud
   * @param {Object} res - Objeto de respuesta
   */
  logRequest(req, res) {
    const startTime = new Date();
    
    // Registrar cuando finalice la petición
    res.on('finish', () => {
      const duration = new Date() - startTime;
      const { method, originalUrl, ip } = req;
      const { statusCode } = res;
      
      // Determinar el nivel según el código de estado
      let level = 'info';
      if (statusCode >= 500) level = 'error';
      else if (statusCode >= 400) level = 'warn';
      
      this.log(level, `${method} ${originalUrl} ${statusCode} ${duration}ms`, {
        requestId: req.requestId,
        ip,
        userAgent: req.headers['user-agent'],
        statusCode
      });
    });
  }
}

module.exports = new Logger();