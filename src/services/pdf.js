// src/services/pdf.js
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const moment = require('moment');
const { createCanvas } = require('canvas');
const mongoose = require('mongoose');

/**
 * Servicio para la generación de documentos PDF
 */
class PDFService {
  /**
   * Genera un PDF de historia clínica con todos sus documentos asociados
   * @param {Object} historia - Objeto de historia clínica (con populate)
   * @param {Array} archivos - Archivos asociados a la historia clínica
   * @param {String} rutaDestino - Ruta donde se guardará el PDF
   * @returns {Promise<String>} - Ruta del archivo generado
   */
  async generarHistoriaClinicaPDF(historia, archivos, rutaDestino) {
    return new Promise(async (resolve, reject) => {
      try {
        // Crear nuevo documento PDF
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Historia Clínica - ${historia.paciente.usuario.nombre} ${historia.paciente.usuario.apellido}`,
            Author: 'Clínica de Estética',
            Subject: 'Historia Clínica',
            Keywords: 'historia, clínica, paciente, tratamiento',
            CreationDate: new Date()
          }
        });

        // Stream para escribir el PDF en el archivo
        const stream = fs.createWriteStream(rutaDestino);
        doc.pipe(stream);

        // Generar código QR para validación
        const qrDataUrl = await QRCode.toDataURL(`https://clinica-estetica.com/verificar/${historia._id}`);
        const qrImage = await this._loadImage(qrDataUrl);

        // Encabezado
        await this._agregarEncabezado(doc, historia, qrImage);
        
        // Información básica del paciente
        await this._agregarInfoPaciente(doc, historia);
        
        // Datos de la consulta/tratamiento
        await this._agregarDatosConsulta(doc, historia);
        
        // Diagnóstico y observaciones
        doc.addPage();
        await this._agregarDiagnostico(doc, historia);
        
        // Resultados y seguimiento
        await this._agregarResultados(doc, historia);
        
        // Incluir documentos asociados
        if (historia.documentos && historia.documentos.length > 0) {
          doc.addPage();
          await this._agregarDocumentosAsociados(doc, historia, archivos);
        }
        
        // Agregar imágenes (antes/después) si existen
        const imagenes = archivos.filter(a => 
          a.tipo === 'imagen' && 
          (a.categoria === 'foto_antes' || a.categoria === 'foto_despues')
        );
        
        if (imagenes.length > 0) {
          doc.addPage();
          await this._agregarImagenes(doc, imagenes);
        }
        
        // Agregar pie de página en todas las páginas
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          await this._agregarPiePagina(doc, i + 1, historia);
        }

        // Finalizar el documento
        doc.end();

        stream.on('finish', () => {
          resolve(rutaDestino);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Genera un PDF de consentimiento informado o documento firmado
   * @param {Object} documento - Objeto documento (con populate)
   * @param {String} rutaDestino - Ruta donde se guardará el PDF
   * @returns {Promise<String>} - Ruta del archivo generado
   */
  async generarDocumentoPDF(documento, rutaDestino) {
    return new Promise(async (resolve, reject) => {
      try {
        // Crear nuevo documento PDF
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: documento.titulo,
            Author: 'Clínica de Estética',
            Subject: documento.tipo,
            Keywords: 'documento, paciente, consentimiento',
            CreationDate: new Date()
          }
        });

        // Stream para escribir el PDF en el archivo
        const stream = fs.createWriteStream(rutaDestino);
        doc.pipe(stream);

        // Generar código QR para validación
        const qrDataUrl = await QRCode.toDataURL(`https://clinica-estetica.com/verificar-documento/${documento._id}`);
        const qrImage = await this._loadImage(qrDataUrl);

        // Encabezado para el documento
        doc.image(path.join(__dirname, '../assets/logo.png'), 50, 45, { width: 150 })
           .fontSize(18)
           .font('Helvetica-Bold')
           .text(documento.titulo.toUpperCase(), 50, 150)
           .moveDown();
        
        // Metadatos del documento
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Tipo de documento: ${this._formatearTipoDocumento(documento.tipo)}`)
           .text(`Fecha de creación: ${moment(documento.createdAt).format('DD/MM/YYYY HH:mm')}`)
           .text(`Paciente: ${documento.paciente.usuario.nombre} ${documento.paciente.usuario.apellido}`)
           .text(`Médico: ${documento.medico.nombre} ${documento.medico.apellido}`)
           .moveDown(2);
        
        // Contenido principal
        doc.fontSize(12)
           .font('Helvetica')
           .text(documento.contenido, {
             align: 'justify',
             paragraphGap: 10
           })
           .moveDown(2);
        
        // Sección de firmas si existen
        if (documento.firmaPaciente?.fechaFirma || documento.firmaMedico?.fechaFirma) {
          doc.addPage();
          await this._agregarSeccionFirmas(doc, documento, qrImage);
        }
        
        // Código QR en la esquina
        doc.image(qrImage, doc.page.width - 100, doc.page.height - 100, { width: 80 });
        
        // Agregar pie de página en todas las páginas
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          this._agregarPiePaginaDocumento(doc, i + 1, documento);
        }

        // Finalizar el documento
        doc.end();

        stream.on('finish', () => {
          resolve(rutaDestino);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Agrega el encabezado al documento PDF
   * @param {PDFDocument} doc - Documento PDF
   * @param {Object} historia - Objeto historia clínica
   * @param {Buffer} qrImage - Imagen del código QR
   * @private
   */
  async _agregarEncabezado(doc, historia, qrImage) {
    // Logo de la clínica
    doc.image(path.join(__dirname, '../assets/logo.png'), 50, 45, { width: 150 });
    
    // Título del documento
    doc.fontSize(22)
       .font('Helvetica-Bold')
       .text('HISTORIA CLÍNICA', 50, 130, { align: 'center' })
       .moveDown();
    
    // Información de la clínica
    doc.fontSize(10)
       .font('Helvetica')
       .text('Clínica de Estética', { align: 'center' })
       .text('Dirección: Av. Principal 123, Ciudad', { align: 'center' })
       .text('Tel: (123) 456-7890 | Email: contacto@clinica-estetica.com', { align: 'center' })
       .moveDown();
    
    // Datos de identificación
    doc.rect(50, 230, doc.page.width - 100, 80)
       .fillAndStroke('#f6f6f6', '#cccccc');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .text(`ID Historia: ${historia._id}`, 60, 240)
       .text(`Fecha: ${moment(historia.createdAt).format('DD/MM/YYYY')}`, 60, 255)
       .text(`Médico: ${historia.medico.nombre} ${historia.medico.apellido}`, 60, 270)
       .text(`Especialidad: ${this._formatearEspecialidad(historia.medico.especialidad)}`, 60, 285);

    // Código QR
    doc.image(qrImage, doc.page.width - 140, 230, { width: 70 });
    
    doc.moveDown(4);
  }

  /**
   * Agrega la información del paciente al documento PDF
   * @param {PDFDocument} doc - Documento PDF
   * @param {Object} historia - Objeto historia clínica
   * @private
   */
  async _agregarInfoPaciente(doc, historia) {
    const paciente = historia.paciente;
    
    // Título de la sección
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('INFORMACIÓN DEL PACIENTE', 50, 330)
       .moveDown();
    
    // Tabla de datos del paciente
    doc.fontSize(10)
       .font('Helvetica');
    
    const infoTable = [
      { label: 'Nombre y Apellido:', valor: `${paciente.usuario.nombre} ${paciente.usuario.apellido}` },
      { label: 'DNI:', valor: paciente.dni },
      { label: 'Fecha de Nacimiento:', valor: moment(paciente.fechaNacimiento).format('DD/MM/YYYY') },
      { label: 'Edad:', valor: `${moment().diff(moment(paciente.fechaNacimiento), 'years')} años` },
      { label: 'Género:', valor: this._formatearGenero(paciente.genero) },
      { label: 'Teléfono:', valor: paciente.usuario.telefono || 'No registrado' },
      { label: 'Email:', valor: paciente.usuario.email },
      { label: 'Grupo Sanguíneo:', valor: paciente.grupoSanguineo }
    ];
    
    let yPos = 365;
    let col = 0;
    
    infoTable.forEach((item, index) => {
      if (index % 4 === 0 && index > 0) {
        yPos += 40;
        col = 0;
      }
      
      doc.font('Helvetica-Bold')
         .text(item.label, 50 + (col * 250), yPos, { width: 110, continued: true })
         .font('Helvetica')
         .text(item.valor);
      
      col++;
    });
    
    yPos += 40;
    
    // Alergias
    doc.font('Helvetica-Bold')
       .text('Alergias:', 50, yPos);
    
    if (paciente.alergias && paciente.alergias.length > 0) {
      yPos += 15;
      paciente.alergias.forEach(alergia => {
        doc.font('Helvetica')
           .text(`• ${alergia.tipo}: ${alergia.descripcion} (${alergia.gravedad})`, 70, yPos);
        yPos += 15;
      });
    } else {
      doc.font('Helvetica')
         .text('No registradas', 160, yPos);
    }
    
    yPos += 20;
    
    // Condiciones médicas
    doc.font('Helvetica-Bold')
       .text('Condiciones Médicas:', 50, yPos);
    
    if (paciente.condicionesMedicas && paciente.condicionesMedicas.length > 0) {
      yPos += 15;
      paciente.condicionesMedicas.forEach(condicion => {
        doc.font('Helvetica')
           .text(`• ${condicion.nombre} (desde: ${moment(condicion.desde).format('MM/YYYY')})`, 70, yPos);
        yPos += 15;
      });
    } else {
      doc.font('Helvetica')
         .text('No registradas', 200, yPos);
    }
    
    yPos += 20;
    
    // Medicación actual
    doc.font('Helvetica-Bold')
       .text('Medicación Actual:', 50, yPos);
    
    if (paciente.medicacionActual && paciente.medicacionActual.length > 0) {
      yPos += 15;
      paciente.medicacionActual.forEach(medicacion => {
        doc.font('Helvetica')
           .text(`• ${medicacion.nombre}: ${medicacion.dosis} (${medicacion.frecuencia})`, 70, yPos);
        yPos += 15;
      });
    } else {
      doc.font('Helvetica')
         .text('No registrada', 180, yPos);
    }
  }

  /**
   * Agrega los datos de la consulta al documento PDF
   * @param {PDFDocument} doc - Documento PDF
   * @param {Object} historia - Objeto historia clínica
   * @private
   */
  async _agregarDatosConsulta(doc, historia) {
    // Si estamos muy abajo en la página, agregar una nueva
    if (doc.y > 650) {
      doc.addPage();
    } else {
      doc.moveDown(2);
    }
    
    // Título de la sección
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('DATOS DE LA CONSULTA/TRATAMIENTO', { underline: true })
       .moveDown();
    
    // Fecha y tratamiento
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Fecha de la consulta: ', { continued: true })
       .font('Helvetica')
       .text(moment(historia.createdAt).format('DD/MM/YYYY HH:mm'))
       .moveDown(0.5);
    
    doc.font('Helvetica-Bold')
       .text('Tratamiento realizado: ', { continued: true })
       .font('Helvetica')
       .text(historia.tratamientoRealizado.nombre)
       .moveDown(0.5);
    
    doc.font('Helvetica-Bold')
       .text('Categoría: ', { continued: true })
       .font('Helvetica')
       .text(this._formatearCategoria(historia.tratamientoRealizado.categoria))
       .moveDown(0.5);
    
    doc.font('Helvetica-Bold')
       .text('Médico responsable: ', { continued: true })
       .font('Helvetica')
       .text(`${historia.medico.nombre} ${historia.medico.apellido}`)
       .moveDown(1);
    
    // Motivo de consulta
    doc.font('Helvetica-Bold')
       .text('MOTIVO DE CONSULTA:')
       .moveDown(0.5);
    
    doc.font('Helvetica')
       .text(historia.motivoConsulta, { align: 'justify' })
       .moveDown(1);
  }

  /**
   * Agrega el diagnóstico y observaciones al documento PDF
   * @param {PDFDocument} doc - Documento PDF
   * @param {Object} historia - Objeto historia clínica
   * @private
   */
  async _agregarDiagnostico(doc, historia) {
    // Título de la sección
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('DIAGNÓSTICO Y OBSERVACIONES', { underline: true })
       .moveDown();
    
    // Diagnóstico
    if (historia.diagnostico) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('DIAGNÓSTICO:')
         .moveDown(0.5);
      
      doc.font('Helvetica')
         .text(historia.diagnostico, { align: 'justify' })
         .moveDown(1);
    }
    
    // Observaciones
    if (historia.observaciones) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('OBSERVACIONES:')
         .moveDown(0.5);
      
      doc.font('Helvetica')
         .text(historia.observaciones, { align: 'justify' })
         .moveDown(1);
    }
    
    // Parámetros registrados
    if (historia.parametrosRegistrados && historia.parametrosRegistrados.length > 0) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('PARÁMETROS REGISTRADOS:')
         .moveDown(0.5);
      
      historia.parametrosRegistrados.forEach(param => {
        doc.font('Helvetica')
           .text(`• ${param.nombre}: ${param.valor} ${param.unidad || ''}`, { indent: 20 });
      });
      
      doc.moveDown(1);
    }
    
    // Indicaciones
    if (historia.indicaciones) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('INDICACIONES:')
         .moveDown(0.5);
      
      doc.font('Helvetica')
         .text(historia.indicaciones, { align: 'justify' })
         .moveDown(1);
    }
  }

  /**
   * Agrega los resultados y seguimiento al documento PDF
   * @param {PDFDocument} doc - Documento PDF
   * @param {Object} historia - Objeto historia clínica
   * @private
   */
  async _agregarResultados(doc, historia) {
    // Si estamos muy abajo en la página, agregar una nueva
    if (doc.y > 650) {
      doc.addPage();
    } else {
      doc.moveDown(2);
    }
    
    // Título de la sección
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('RESULTADOS Y SEGUIMIENTO', { underline: true })
       .moveDown();
    
    // Resultados
    if (historia.resultados) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('RESULTADOS:')
         .moveDown(0.5);
      
      doc.font('Helvetica')
         .text(historia.resultados, { align: 'justify' })
         .moveDown(1);
    }
    
    // Recomendaciones de seguimiento
    if (historia.recomendacionesSeguimiento) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('RECOMENDACIONES DE SEGUIMIENTO:')
         .moveDown(0.5);
      
      doc.font('Helvetica')
         .text(historia.recomendacionesSeguimiento, { align: 'justify' })
         .moveDown(1);
    }
    
    // Próxima cita
    if (historia.proximaCita && historia.proximaCita.recomendada) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('PRÓXIMA CITA:')
         .moveDown(0.5);
      
      doc.font('Helvetica')
         .text(`Se recomienda próxima visita en ${historia.proximaCita.tiempoRecomendado} días.`);
      
      if (historia.proximaCita.observaciones) {
        doc.text(`Observaciones: ${historia.proximaCita.observaciones}`);
      }
      
      doc.moveDown(1);
    }
  }

  /**
   * Agrega los documentos asociados al documento PDF
   * @param {PDFDocument} doc - Documento PDF
   * @param {Object} historia - Objeto historia clínica
   * @param {Array} archivos - Archivos asociados
   * @private
   */
  async _agregarDocumentosAsociados(doc, historia, archivos) {
    // Título de la sección
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('DOCUMENTOS ASOCIADOS', { underline: true })
       .moveDown();
    
    if (!historia.documentos || historia.documentos.length === 0) {
      doc.fontSize(10)
         .font('Helvetica')
         .text('No hay documentos asociados a esta historia clínica.')
         .moveDown();
      return;
    }
    
    // Listar documentos
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Documentos generados durante la consulta:')
       .moveDown(0.5);
    
    let yPos = doc.y;
    
    historia.documentos.forEach((doc, index) => {
      const tipo = this._formatearTipoDocumento(doc.tipo);
      const archivo = archivos.find(a => a._id.toString() === doc.archivoId.toString());
      
      doc.font('Helvetica')
         .text(`${index + 1}. ${tipo}: `, { continued: true })
         .font('Helvetica-Bold')
         .text(archivo ? archivo.nombre : 'Documento')
         .font('Helvetica')
         .text(`   Fecha: ${moment(doc.fechaCreacion).format('DD/MM/YYYY')}`, { indent: 20 });
      
      if (doc.notas) {
        doc.text(`   Notas: ${doc.notas}`, { indent: 20 });
      }
      
      doc.moveDown(0.5);
    });
    
    // Aviso de anexos
    doc.moveDown()
       .font('Helvetica-Bold')
       .text('Nota: ', { continued: true })
       .font('Helvetica')
       .text('Los documentos mencionados han sido anexados al final de este informe o se encuentran disponibles en el sistema electrónico de la clínica.');
  }

  /**
   * Agrega las imágenes al documento PDF
   * @param {PDFDocument} doc - Documento PDF
   * @param {Array} imagenes - Imágenes a incluir
   * @private
   */
  async _agregarImagenes(doc, imagenes) {
    // Título de la sección
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('IMÁGENES ASOCIADAS', { underline: true })
       .moveDown();
    
    if (!imagenes || imagenes.length === 0) {
      doc.fontSize(10)
         .font('Helvetica')
         .text('No hay imágenes asociadas a esta historia clínica.')
         .moveDown();
      return;
    }
    
    // Agrupar imágenes por antes/después
    const imagenesAntes = imagenes.filter(img => img.categoria === 'foto_antes');
    const imagenesDespues = imagenes.filter(img => img.categoria === 'foto_despues');
    
    let yPos = doc.y;
    const maxImageWidth = (doc.page.width - 150) / 2;
    
    // Si hay ambos tipos de imágenes, organizarlas en dos columnas
    if (imagenesAntes.length > 0 && imagenesDespues.length > 0) {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('ANTES', 100, yPos, { width: maxImageWidth, align: 'center' })
         .text('DESPUÉS', 300, yPos, { width: maxImageWidth, align: 'center' })
         .moveDown();
      
      yPos = doc.y;
      
      // Tomar el menor número de imágenes (antes o después)
      const pares = Math.min(imagenesAntes.length, imagenesDespues.length);
      
      for (let i = 0; i < pares; i++) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        
        // Imagen "antes"
        const rutaAntes = path.join(__dirname, '..', imagenesAntes[i].ruta);
        if (fs.existsSync(rutaAntes)) {
          doc.image(rutaAntes, 75, yPos, { width: maxImageWidth - 50 });
        }
        
        // Imagen "después"
        const rutaDespues = path.join(__dirname, '..', imagenesDespues[i].ruta);
        if (fs.existsSync(rutaDespues)) {
          doc.image(rutaDespues, 275, yPos, { width: maxImageWidth - 50 });
        }
        
        // Descripción si existe
        if (imagenesAntes[i].descripcion || imagenesDespues[i].descripcion) {
          yPos += 160;
          doc.fontSize(8);
          
          if (imagenesAntes[i].descripcion) {
            doc.text(imagenesAntes[i].descripcion, 75, yPos, { width: maxImageWidth - 50 });
          }
          
          if (imagenesDespues[i].descripcion) {
            doc.text(imagenesDespues[i].descripcion, 275, yPos, { width: maxImageWidth - 50 });
          }
          
          yPos += 30;
        } else {
          yPos += 180;
        }
      }
    } else {
      // Si solo hay un tipo, mostrarlas una debajo de otra
      const todasLasImagenes = [...imagenesAntes, ...imagenesDespues];
      
      for (let i = 0; i < todasLasImagenes.length; i++) {
        if (yPos > 600) {
          doc.addPage();
          yPos = 50;
        }
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text(todasLasImagenes[i].categoria === 'foto_antes' ? 'ANTES:' : 'DESPUÉS:', 50, yPos)
           .moveDown(0.5);
        
        yPos = doc.y;
        
        // Imagen
        const rutaImagen = path.join(__dirname, '..', todasLasImagenes[i].ruta);
        if (fs.existsSync(rutaImagen)) {
          doc.image(rutaImagen, 100, yPos, { width: doc.page.width - 200 });
        }
        
        // Descripción si existe
        if (todasLasImagenes[i].descripcion) {
          doc.fontSize(8)
             .font('Helvetica')
             .text(todasLasImagenes[i].descripcion, 100, yPos + 160, { width: doc.page.width - 200 });
          
          yPos += 180;
        } else {
          yPos += 160;
        }
      }
    }
  }

  /**
   * Agrega la sección de firmas al documento PDF
   * @param {PDFDocument} doc - Documento PDF
   * @param {Object} documento - Objeto documento
   * @param {Buffer} qrImage - Imagen del código QR
   * @private
   */
  async _agregarSeccionFirmas(doc, documento, qrImage) {
    // Título de la sección
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('CONFIRMACIÓN Y FIRMAS', { underline: true })
       .moveDown();
    
    // Texto de confirmación
    doc.fontSize(10)
       .font('Helvetica')
       .text('Este documento ha sido firmado electrónicamente según las disposiciones vigentes. La firma electrónica tiene la misma validez legal que la firma manuscrita.')
       .moveDown(1);
    
    // Firma del paciente
    if (documento.firmaPaciente?.fechaFirma) {
      doc.font('Helvetica-Bold')
         .text('Firma del Paciente:')
         .moveDown(0.5);
      
      // Si tenemos una imagen de firma
      if (documento.firmaPaciente.datosFirma) {
        try {
          // Convertir datos de firma (en formato base64) a imagen
          const firmaImg = Buffer.from(documento.firmaPaciente.datosFirma.split(',')[1], 'base64');
          doc.image(firmaImg, { width: 150 });
        } catch (error) {
          doc.text('[Firma electrónica registrada]');
        }
      } else {
        doc.text('[Firma electrónica registrada]');
      }
      
      doc.font('Helvetica')
         .text(`Fecha y hora: ${moment(documento.firmaPaciente.fechaFirma).format('DD/MM/YYYY HH:mm')}`)
         .text(`Firmado desde: ${documento.firmaPaciente.dispositivo || 'Dispositivo no registrado'}`)
         .moveDown(1);
    }
    
    // Firma del médico
    if (documento.firmaMedico?.fechaFirma) {
      doc.font('Helvetica-Bold')
         .text('Firma del Médico:')
         .moveDown(0.5);
      
      // Si tenemos una imagen de firma
      if (documento.firmaMedico.datosFirma) {
        try {
          // Convertir datos de firma (en formato base64) a imagen
          const firmaImg = Buffer.from(documento.firmaMedico.datosFirma.split(',')[1], 'base64');
          doc.image(firmaImg, { width: 150 });
        } catch (error) {
          doc.text('[Firma electrónica registrada]');
        }
      } else {
        doc.text('[Firma electrónica registrada]');
      }
      
      doc.font('Helvetica')
         .text(`Fecha y hora: ${moment(documento.firmaMedico.fechaFirma).format('DD/MM/YYYY HH:mm')}`)
         .text(`Dr/a. ${documento.medico.nombre} ${documento.medico.apellido}`)
         .moveDown(1);
    }
    
    // Información de validación
    doc.fontSize(8)
       .text('Para verificar la autenticidad de este documento, escanee el código QR o visite:')
       .text(`https://clinica-estetica.com/verificar-documento/${documento._id}`, { underline: true })
       .moveDown();
    
    // QR para validación
    doc.image(qrImage, doc.page.width - 120, doc.y - 80, { width: 80 });
  }

  /**
   * Agrega el pie de página al documento PDF de historia clínica
   * @param {PDFDocument} doc - Documento PDF
   * @param {Number} numPagina - Número de página
   * @param {Object} historia - Objeto historia clínica
   * @private
   */
  _agregarPiePagina(doc, numPagina, historia) {
    const paginaText = `Página ${numPagina}`;
    const fechaText = `Generado: ${moment().format('DD/MM/YYYY HH:mm')}`;
    const idText = `ID: ${historia._id}`;
    
    doc.fontSize(8)
       .font('Helvetica')
       .text(paginaText, 50, doc.page.height - 50, { align: 'left', width: 100 })
       .text('CONFIDENCIAL - HISTORIA CLÍNICA', 150, doc.page.height - 50, { align: 'center', width: doc.page.width - 300 })
       .text(fechaText, doc.page.width - 150, doc.page.height - 50, { align: 'right', width: 100 });
  }

  /**
   * Agrega el pie de página al documento PDF de documento/consentimiento
   * @param {PDFDocument} doc - Documento PDF
   * @param {Number} numPagina - Número de página
   * @param {Object} documento - Objeto documento
   * @private
   */
  _agregarPiePaginaDocumento(doc, numPagina, documento) {
    const paginaText = `Página ${numPagina}`;
    const fechaText = `Generado: ${moment().format('DD/MM/YYYY HH:mm')}`;
    
    doc.fontSize(8)
       .font('Helvetica')
       .text(paginaText, 50, doc.page.height - 50, { align: 'left', width: 100 })
       .text('DOCUMENTO LEGAL - CLÍNICA DE ESTÉTICA', 150, doc.page.height - 50, { align: 'center', width: doc.page.width - 300 })
       .text(fechaText, doc.page.width - 150, doc.page.height - 50, { align: 'right', width: 100 });
  }

  /**
   * Carga una imagen
   * @param {String|Buffer} src - Ruta o datos de la imagen
   * @returns {Promise<Buffer>} - Buffer de la imagen
   * @private
   */
  async _loadImage(src) {
    return new Promise((resolve, reject) => {
      // Si ya es un buffer, resolver directamente
      if (Buffer.isBuffer(src)) {
        resolve(src);
        return;
      }
      
      // Si es un Data URL (por ejemplo, de QRCode)
      if (src.startsWith('data:')) {
        try {
          const data = src.split(',')[1];
          const buffer = Buffer.from(data, 'base64');
          resolve(buffer);
        } catch (error) {
          reject(error);
        }
        return;
      }
      
      // Si es una ruta de archivo
      fs.readFile(src, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  /**
   * Formatea el tipo de documento para su visualización
   * @param {String} tipo - Tipo de documento
   * @returns {String} - Tipo formateado
   * @private
   */
  _formatearTipoDocumento(tipo) {
    const tipos = {
      'consentimiento': 'Consentimiento Informado',
      'autorizacion': 'Autorización',
      'informativo': 'Documento Informativo',
      'receta': 'Receta Médica',
      'certificado': 'Certificado Médico',
      'otro': 'Otro Documento'
    };
    
    return tipos[tipo] || tipo;
  }

  /**
   * Formatea la categoría para su visualización
   * @param {String} categoria - Categoría
   * @returns {String} - Categoría formateada
   * @private
   */
  _formatearCategoria(categoria) {
    const categorias = {
      'estetica_general': 'Estética General',
      'medicina_estetica': 'Medicina Estética'
    };
    
    return categorias[categoria] || categoria;
  }

  /**
   * Formatea la especialidad para su visualización
   * @param {String} especialidad - Especialidad
   * @returns {String} - Especialidad formateada
   * @private
   */
  _formatearEspecialidad(especialidad) {
    const especialidades = {
      'estetica_general': 'Estética General',
      'medicina_estetica': 'Medicina Estética',
      'ambas': 'Estética General y Medicina Estética'
    };
    
    return especialidades[especialidad] || 'No especificada';
  }

  /**
   * Formatea el género para su visualización
   * @param {String} genero - Género
   * @returns {String} - Género formateado
   * @private
   */
  _formatearGenero(genero) {
    const generos = {
      'masculino': 'Masculino',
      'femenino': 'Femenino',
      'otro': 'Otro',
      'no_especificado': 'No especificado'
    };
    
    return generos[genero] || genero;
  }
}

module.exports = new PDFService();

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

