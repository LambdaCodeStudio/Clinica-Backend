// src/services/almacenamiento.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Archivo = require('../models/archivo');

/**
 * Servicio para la gestión de archivos
 */
class AlmacenamientoService {
  /**
   * Guarda un archivo en el sistema de archivos y registra en BD
   * @param {Object} archivo - Datos del archivo
   * @param {Object} metadatos - Metadatos adicionales
   * @returns {Promise<Object>} - Información del archivo guardado
   */
  async guardarArchivo(archivo, metadatos) {
    try {
      const {
        originalname,
        mimetype,
        size,
        path: rutaTemp,
        filename
      } = archivo;
      
      const {
        tipo,
        paciente,
        subidoPor,
        cita,
        categoria,
        descripcion,
        tags
      } = metadatos;
      
      // Calcular hash para verificación de integridad
      const hash = await this._calcularHashArchivo(rutaTemp);
      
      // Ruta relativa para almacenar en BD
      const rutaRelativa = `/uploads/${tipo}s/${filename}`;
      
      // Crear registro en BD
      const nuevoArchivo = new Archivo({
        nombre: originalname,
        tipo,
        mimeType: mimetype,
        tamanio: size,
        ruta: rutaRelativa,
        paciente,
        subidoPor,
        cita,
        categoria,
        descripcion,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
        hash
      });
      
      await nuevoArchivo.save();
      
      return nuevoArchivo;
    } catch (error) {
      console.error('Error al guardar archivo:', error);
      // Si ocurre un error, intentar eliminar el archivo temporal
      if (archivo.path && fs.existsSync(archivo.path)) {
        fs.unlinkSync(archivo.path);
      }
      throw error;
    }
  }
  
  /**
   * Recupera un archivo por su ID
   * @param {String} archivoId - ID del archivo
   * @returns {Promise<Object>} - Información del archivo
   */
  async obtenerArchivo(archivoId) {
    try {
      const archivo = await Archivo.findById(archivoId);
      
      if (!archivo) {
        throw new Error('Archivo no encontrado');
      }
      
      // Verificar si el archivo ha sido eliminado
      if (archivo.fechaEliminacion) {
        throw new Error('Archivo eliminado');
      }
      
      return archivo;
    } catch (error) {
      console.error('Error al obtener archivo:', error);
      throw error;
    }
  }
  
  /**
   * Lee un archivo del sistema de archivos
   * @param {String} rutaRelativa - Ruta relativa del archivo
   * @returns {Promise<Buffer>} - Contenido del archivo
   */
  async leerArchivo(rutaRelativa) {
    try {
      const rutaCompleta = path.join(__dirname, '..', rutaRelativa);
      
      if (!fs.existsSync(rutaCompleta)) {
        throw new Error('Archivo no encontrado en el sistema de archivos');
      }
      
      return fs.readFileSync(rutaCompleta);
    } catch (error) {
      console.error('Error al leer archivo:', error);
      throw error;
    }
  }
  
  /**
   * Elimina un archivo
   * @param {String} archivoId - ID del archivo
   * @param {String} usuarioId - ID del usuario que elimina
   * @param {Boolean} eliminacionLogica - Si es true, solo marca como eliminado
   * @returns {Promise<Object>} - Resultado de la eliminación
   */
  async eliminarArchivo(archivoId, usuarioId, eliminacionLogica = true) {
    try {
      const archivo = await Archivo.findById(archivoId);
      
      if (!archivo) {
        throw new Error('Archivo no encontrado');
      }
      
      if (eliminacionLogica) {
        // Eliminación lógica (solo marcar como eliminado)
        archivo.fechaEliminacion = new Date();
        await archivo.save();
      } else {
        // Eliminación física
        const rutaCompleta = path.join(__dirname, '..', archivo.ruta);
        
        if (fs.existsSync(rutaCompleta)) {
          fs.unlinkSync(rutaCompleta);
        }
        
        await Archivo.deleteOne({ _id: archivoId });
      }
      
      return { success: true, mensaje: 'Archivo eliminado correctamente' };
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene los archivos de un paciente
   * @param {String} pacienteId - ID del paciente
   * @param {Object} filtros - Filtros adicionales
   * @returns {Promise<Array>} - Lista de archivos
   */
  async obtenerArchivosPorPaciente(pacienteId, filtros = {}) {
    try {
      const { tipo, categoria, fechaDesde, fechaHasta } = filtros;
      
      const query = { 
        paciente: pacienteId,
        fechaEliminacion: null // Solo archivos no eliminados
      };
      
      if (tipo) {
        query.tipo = tipo;
      }
      
      if (categoria) {
        query.categoria = categoria;
      }
      
      if (fechaDesde || fechaHasta) {
        query.createdAt = {};
        
        if (fechaDesde) {
          query.createdAt.$gte = new Date(fechaDesde);
        }
        
        if (fechaHasta) {
          query.createdAt.$lte = new Date(fechaHasta);
        }
      }
      
      return await Archivo.find(query).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error al obtener archivos por paciente:', error);
      throw error;
    }
  }
  
  /**
   * Verifica la integridad de un archivo
   * @param {String} archivoId - ID del archivo
   * @returns {Promise<Object>} - Resultado de la verificación
   */
  async verificarIntegridad(archivoId) {
    try {
      const archivo = await Archivo.findById(archivoId);
      
      if (!archivo) {
        throw new Error('Archivo no encontrado');
      }
      
      const rutaCompleta = path.join(__dirname, '..', archivo.ruta);
      
      if (!fs.existsSync(rutaCompleta)) {
        return { 
          integrity: false, 
          error: 'Archivo no encontrado en el sistema de archivos' 
        };
      }
      
      const hashActual = await this._calcularHashArchivo(rutaCompleta);
      
      return {
        integrity: hashActual === archivo.hash,
        originalHash: archivo.hash,
        currentHash: hashActual
      };
    } catch (error) {
      console.error('Error al verificar integridad:', error);
      throw error;
    }
  }
  
  /**
   * Calcula el hash de un archivo
   * @param {String} rutaArchivo - Ruta del archivo
   * @returns {Promise<String>} - Hash del archivo
   * @private
   */
  async _calcularHashArchivo(rutaArchivo) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(rutaArchivo);
      
      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
}

module.exports = new AlmacenamientoService();