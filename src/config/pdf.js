// src/config/pdf.js
const PDFKit = require('pdfkit');
const QRCode = require('qrcode');
const moment = require('moment');
moment.locale('es');

/**
 * Configuración para generación de PDFs
 */
class PDFConfig {
  /**
   * Obtiene configuración básica para documentos PDF
   * @param {Object} opciones - Opciones adicionales
   * @returns {Object} - Configuración para PDFKit
   */
  obtenerConfiguracionBase(opciones = {}) {
    return {
      size: opciones.size || 'A4',
      margin: opciones.margin || 50,
      info: {
        Title: opciones.titulo || 'Documento',
        Author: opciones.autor || 'Clínica de Estética',
        Subject: opciones.asunto || 'Documento',
        Keywords: opciones.palabrasClave || 'clínica, documento',
        CreationDate: new Date()
      },
      bufferPages: true,
      autoFirstPage: true,
      ...opciones
    };
  }
  
  /**
   * Agrega un encabezado estándar al documento
   * @param {PDFDocument} doc - Documento PDF
   * @param {String} titulo - Título del documento
   * @param {String} subtitulo - Subtítulo (opcional)
   * @param {Object} opciones - Opciones adicionales
   */
  agregarEncabezado(doc, titulo, subtitulo = null, opciones = {}) {
    const logoPath = opciones.logoPath || __dirname + '/../assets/logo.png';
    const colorPrimario = opciones.colorPrimario || '#1e3a8a';
    
    // Logo en la esquina superior izquierda
    doc.image(logoPath, 50, 45, { width: 150 });
    
    // Título centrado
    doc.fontSize(22)
       .fillColor(colorPrimario)
       .font('Helvetica-Bold')
       .text(titulo.toUpperCase(), 50, 130, { align: 'center' })
       .moveDown(0.5);
    
    // Subtítulo si existe
    if (subtitulo) {
      doc.fontSize(14)
         .font('Helvetica')
         .text(subtitulo, { align: 'center' })
         .moveDown();
    }
    
    // Información de la clínica
    doc.fontSize(10)
       .fillColor('#333333')
       .text('Clínica de Estética', { align: 'center' })
       .text(process.env.CLINICA_DIRECCION || 'Av. Principal 123, Ciudad', { align: 'center' })
       .text(`Tel: ${process.env.CLINICA_TELEFONO || '(123) 456-7890'} | Email: ${process.env.CLINICA_EMAIL || 'contacto@clinica-estetica.com'}`, { align: 'center' })
       .moveDown(2);
    
    // Línea separadora
    doc.strokeColor(colorPrimario)
       .lineWidth(1)
       .moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke()
       .moveDown();
  }
  
  /**
   * Agrega un pie de página estándar
   * @param {PDFDocument} doc - Documento PDF
   * @param {Number} pageNumber - Número de página
   * @param {String} idDocumento - ID del documento (opcional)
   * @param {Object} opciones - Opciones adicionales
   */
  agregarPiePagina(doc, pageNumber, idDocumento = null, opciones = {}) {
    const colorTexto = opciones.colorTexto || '#666666';
    const textoConfidencial = opciones.textoConfidencial || 'CONFIDENCIAL';
    const textoFecha = `Generado: ${moment().format('DD/MM/YYYY HH:mm')}`;
    const textoPagina = `Página ${pageNumber}`;
    
    doc.fontSize(8)
       .fillColor(colorTexto)
       .text(textoPagina, 50, doc.page.height - 50, { align: 'left', width: 100 })
       .text(textoConfidencial, 150, doc.page.height - 50, { align: 'center', width: doc.page.width - 300 });
    
    // Si hay ID de documento, mostrarlo
    if (idDocumento) {
      doc.text(`ID: ${idDocumento}`, doc.page.width - 200, doc.page.height - 50, { align: 'right', width: 150 });
    }
    
    doc.text(textoFecha, doc.page.width - 150, doc.page.height - 35, { align: 'right', width: 100 });
  }
  
  /**
   * Genera un código QR para un documento
   * @param {String} data - Datos para el código QR
   * @returns {Promise<Buffer>} - Imagen del código QR
   */
  async generarQR(data) {
    try {
      const qrDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 150
      });
      
      // Convertir Data URL a Buffer
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      
      return qrBuffer;
    } catch (error) {
      console.error('Error al generar QR:', error);
      throw error;
    }
  }
  
  /**
   * Agrega metadatos de sección
   * @param {PDFDocument} doc - Documento PDF
   * @param {String} titulo - Título de la sección
   * @param {Object} opciones - Opciones adicionales
   */
  agregarTituloSeccion(doc, titulo, opciones = {}) {
    const colorTitulo = opciones.colorTitulo || '#1e3a8a';
    const tamanoFuente = opciones.tamanoFuente || 14;
    const subrayado = opciones.subrayado !== false;
    
    doc.fontSize(tamanoFuente)
       .fillColor(colorTitulo)
       .font('Helvetica-Bold')
       .text(titulo.toUpperCase(), { underline: subrayado })
       .moveDown();
  }
  
  /**
   * Configura colores corporativos para los documentos
   * @returns {Object} - Objeto con colores
   */
  obtenerColoresCorporativos() {
    return {
      primario: '#1e3a8a', // Azul oscuro
      secundario: '#3b82f6', // Azul claro
      acento: '#10b981', // Verde
      fondo: '#f9fafb', // Gris claro
      texto: '#1f2937', // Casi negro
      textoSecundario: '#6b7280', // Gris oscuro
      exito: '#10b981', // Verde
      advertencia: '#f59e0b', // Amarillo
      error: '#ef4444' // Rojo
    };
  }
}

module.exports = new PDFConfig();