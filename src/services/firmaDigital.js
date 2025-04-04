// src/services/firmaDigital.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { createCanvas } = require('canvas');

/**
 * Servicio para gestionar firmas digitales
 */
class FirmaDigitalService {
  /**
   * Procesa y guarda una firma digital
   * @param {String} datosImagen - Datos de imagen en formato base64
   * @param {String} idPaciente - ID del paciente
   * @param {String} idDocumento - ID del documento
   * @param {Object} metadatos - Metadatos adicionales (IP, dispositivo, etc.)
   * @returns {Promise<Object>} - Información de la firma guardada
   */
  async procesarFirma(datosImagen, idPaciente, idDocumento, metadatos = {}) {
    try {
      // Validar los datos de la imagen
      if (!datosImagen || !datosImagen.startsWith('data:image')) {
        throw new Error('Formato de imagen no válido');
      }
      
      // Extraer datos binarios de la imagen base64
      const base64Data = datosImagen.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Generar un nombre único para el archivo
      const nombreArchivo = `firma_${idPaciente}_${idDocumento}_${Date.now()}.png`;
      const rutaRelativa = `/uploads/firmas/${nombreArchivo}`;
      const rutaCompleta = path.join(__dirname, '..', rutaRelativa);
      
      // Asegurar que el directorio existe
      const directorioFirmas = path.dirname(rutaCompleta);
      if (!fs.existsSync(directorioFirmas)) {
        fs.mkdirSync(directorioFirmas, { recursive: true });
      }
      
      // Guardar la imagen de la firma
      fs.writeFileSync(rutaCompleta, buffer);
      
      // Calcular el hash para verificación de integridad
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      
      // Crear registro de la firma
      const registroFirma = {
        fechaFirma: new Date(),
        datosFirma: datosImagen,
        rutaArchivo: rutaRelativa,
        hash: hash,
        ip: metadatos.ip || null,
        dispositivo: metadatos.dispositivo || null
      };
      
      return registroFirma;
    } catch (error) {
      console.error('Error al procesar firma digital:', error);
      throw error;
    }
  }

  /**
   * Crea un canvas de firma a partir de los datos
   * @param {String} texto - Texto a mostrar (nombre del firmante)
   * @param {Object} opciones - Opciones de personalización
   * @returns {Promise<String>} - Datos de imagen en formato base64
   */
  async crearFirma(texto, opciones = {}) {
    try {
      const ancho = opciones.ancho || 300;
      const alto = opciones.alto || 150;
      
      // Crear canvas
      const canvas = createCanvas(ancho, alto);
      const ctx = canvas.getContext('2d');
      
      // Fondo blanco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ancho, alto);
      
      // Dibujar borde
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, ancho, alto);
      
      // Configurar texto
      ctx.font = opciones.font || 'italic 30px serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Ajustar texto multilínea si es necesario
      const palabras = texto.split(' ');
      let lineas = [];
      let lineaActual = '';
      
      for (let i = 0; i < palabras.length; i++) {
        const testLine = lineaActual + palabras[i] + ' ';
        const testWidth = ctx.measureText(testLine).width;
        
        if (testWidth > ancho - 20 && i > 0) {
          lineas.push(lineaActual);
          lineaActual = palabras[i] + ' ';
        } else {
          lineaActual = testLine;
        }
      }
      lineas.push(lineaActual);
      
      // Dibujar texto
      const lineHeight = 40;
      const startY = alto / 2 - (lineas.length - 1) * lineHeight / 2;
      
      for (let i = 0; i < lineas.length; i++) {
        ctx.fillText(lineas[i], ancho / 2, startY + i * lineHeight);
      }
      
      // Agregar fecha
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#666666';
      const fecha = moment().format('DD/MM/YYYY HH:mm:ss');
      ctx.fillText(fecha, ancho / 2, alto - 15);
      
      // Devolver el canvas como una imagen en formato base64
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error al crear firma digital:', error);
      throw error;
    }
  }

  /**
   * Verifica la integridad de una firma
   * @param {String} rutaArchivo - Ruta del archivo de firma
   * @param {String} hashOriginal - Hash original para verificación
   * @returns {Promise<Boolean>} - Resultado de la verificación
   */
  async verificarIntegridad(rutaArchivo, hashOriginal) {
    try {
      const rutaCompleta = path.join(__dirname, '..', rutaArchivo);
      
      // Verificar si el archivo existe
      if (!fs.existsSync(rutaCompleta)) {
        return false;
      }
      
      // Leer el archivo
      const buffer = fs.readFileSync(rutaCompleta);
      
      // Calcular hash actual
      const hashActual = crypto.createHash('sha256').update(buffer).digest('hex');
      
      // Comparar hashes
      return hashActual === hashOriginal;
    } catch (error) {
      console.error('Error al verificar integridad de firma:', error);
      return false;
    }
  }
}

module.exports = new FirmaDigitalService();

