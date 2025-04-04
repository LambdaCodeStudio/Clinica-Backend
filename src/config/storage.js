// src/config/storage.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Configuración para almacenamiento de archivos
 */
class StorageConfig {
  constructor() {
    // Definir directorios base
    this.directorios = {
      base: path.join(__dirname, '../uploads'),
      imagenes: path.join(__dirname, '../uploads/imagenes'),
      documentos: path.join(__dirname, '../uploads/documentos'),
      firmas: path.join(__dirname, '../uploads/firmas'),
      recetas: path.join(__dirname, '../uploads/recetas'),
      consentimientos: path.join(__dirname, '../uploads/consentimientos'),
      temporales: path.join(__dirname, '../uploads/temp')
    };
    
    // Crear directorios si no existen
    this._crearDirectorios();
    
    // Configuración de Multer para diferentes tipos de archivos
    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const tipo = req.body.tipo || this._detectarTipoArchivo(file);
        const directorio = this._obtenerDirectorio(tipo);
        cb(null, directorio);
      },
      filename: (req, file, cb) => {
        // Generar nombre único para el archivo
        const nombreUnico = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const extension = path.extname(file.originalname);
        cb(null, nombreUnico + extension);
      }
    });
    
    // Filtro de archivos
    this.fileFilter = (req, file, cb) => {
      const tiposPermitidos = this._obtenerTiposPermitidos(req.body.tipo);
      
      if (tiposPermitidos.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Tipo de archivo no permitido. Se acepta: ${tiposPermitidos.join(', ')}`), false);
      }
    };
    
    // Límites de archivos
    this.limits = {
      fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB por defecto
      files: 1 // Solo un archivo a la vez
    };
  }
  
  /**
   * Crea los directorios necesarios
   * @private
   */
  _crearDirectorios() {
    Object.values(this.directorios).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  /**
   * Detecta el tipo de archivo basado en su MIME type
   * @param {Object} file - Archivo a analizar
   * @returns {String} - Tipo detectado
   * @private
   */
  _detectarTipoArchivo(file) {
    const mimetype = file.mimetype.toLowerCase();
    
    if (mimetype.startsWith('image/')) {
      return 'imagen';
    } else if (mimetype === 'application/pdf') {
      return 'documento';
    } else if (mimetype.includes('word')) {
      return 'documento';
    } else {
      return 'otro';
    }
  }
  
  /**
   * Obtiene el directorio correspondiente al tipo de archivo
   * @param {String} tipo - Tipo de archivo
   * @returns {String} - Ruta del directorio
   * @private
   */
  _obtenerDirectorio(tipo) {
    switch (tipo) {
      case 'imagen':
        return this.directorios.imagenes;
      case 'documento':
        return this.directorios.documentos;
      case 'firma':
        return this.directorios.firmas;
      case 'receta':
        return this.directorios.recetas;
      case 'consentimiento':
        return this.directorios.consentimientos;
      default:
        return this.directorios.temporales;
    }
  }
  
  /**
   * Obtiene los tipos MIME permitidos según el tipo de archivo
   * @param {String} tipo - Tipo de archivo
   * @returns {Array} - Lista de tipos MIME permitidos
   * @private
   */
  _obtenerTiposPermitidos(tipo) {
    switch (tipo) {
      case 'imagen':
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      case 'documento':
        return [
          'application/pdf', 
          'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
      case 'firma':
        return ['image/jpeg', 'image/png', 'image/svg+xml'];
      case 'receta':
        return ['image/jpeg', 'image/png', 'application/pdf'];
      case 'consentimiento':
        return ['application/pdf', 'image/jpeg', 'image/png'];
      default:
        return [
          'image/jpeg', 'image/png', 'image/gif', 
          'application/pdf', 'text/plain',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
    }
  }
  
  /**
   * Obtiene una instancia configurada de Multer
   * @returns {Object} - Instancia de Multer
   */
  obtenerMulter() {
    return multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: this.limits
    });
  }
  
  /**
   * Obtiene una instancia configurada de Multer para memoria (no guarda en disco)
   * @returns {Object} - Instancia de Multer
   */
  obtenerMulterMemoria() {
    return multer({
      storage: multer.memoryStorage(),
      fileFilter: this.fileFilter,
      limits: this.limits
    });
  }
}

module.exports = new StorageConfig();