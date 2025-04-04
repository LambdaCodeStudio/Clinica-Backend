// src/services/email.js
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');

/**
 * Servicio para el envío de correos electrónicos
 */
class EmailService {
  constructor() {
    // Configurar transporte de email
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    // Cargar plantillas de email
    this.plantillas = {
      recordatorioCita: this._cargarPlantilla('recordatorio-cita'),
      confirmacionCita: this._cargarPlantilla('confirmacion-cita'),
      recuperacionPassword: this._cargarPlantilla('recuperacion-password'),
      bienvenida: this._cargarPlantilla('bienvenida'),
      resultadosTratamiento: this._cargarPlantilla('resultados-tratamiento'),
      documentoFirmado: this._cargarPlantilla('documento-firmado')
    };
  }
  
  /**
   * Carga una plantilla de email
   * @param {String} nombre - Nombre de la plantilla
   * @returns {Function} - Función compilada de Handlebars
   * @private
   */
  _cargarPlantilla(nombre) {
    try {
      const rutaPlantilla = path.join(__dirname, '../templates/email', `${nombre}.html`);
      const plantilla = fs.readFileSync(rutaPlantilla, 'utf8');
      return handlebars.compile(plantilla);
    } catch (error) {
      console.error(`Error al cargar plantilla ${nombre}:`, error);
      // Plantilla simple de respaldo
      return handlebars.compile('<html><body><h1>{{titulo}}</h1><p>{{mensaje}}</p></body></html>');
    }
  }
  
  /**
   * Envía un correo electrónico
   * @param {Object} opciones - Opciones del correo
   * @returns {Promise<Object>} - Información del envío
   * @private
   */
  async _enviarEmail(opciones) {
    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_NOMBRE || 'Clínica de Estética'}" <${process.env.EMAIL_USER}>`,
        to: opciones.destinatario,
        subject: opciones.asunto,
        html: opciones.html,
        attachments: opciones.adjuntos || []
      });
      
      console.log('Email enviado:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error al enviar email:', error);
      throw error;
    }
  }
  
  /**
   * Envía un recordatorio de cita
   * @param {String} email - Email del destinatario
   * @param {String} nombre - Nombre del destinatario
   * @param {Object} cita - Datos de la cita
   * @returns {Promise<Object>} - Información del envío
   */
  async enviarRecordatorioCita(email, nombre, cita) {
    const html = this.plantillas.recordatorioCita({
      nombre,
      fecha: new Date(cita.fechaInicio).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      hora: new Date(cita.fechaInicio).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      medico: `${cita.medico.nombre} ${cita.medico.apellido}`,
      tratamiento: cita.tratamiento.nombre,
      direccion: process.env.CLINICA_DIRECCION || 'Av. Principal 123',
      urlConfirmar: `${process.env.FRONTEND_URL}/citas/confirmar/${cita._id}`,
      urlCancelar: `${process.env.FRONTEND_URL}/citas/cancelar/${cita._id}`
    });
    
    return this._enviarEmail({
      destinatario: email,
      asunto: 'Recordatorio de tu cita en Clínica de Estética',
      html
    });
  }
  
  /**
   * Envía una confirmación de cita
   * @param {String} email - Email del destinatario
   * @param {String} nombre - Nombre del destinatario
   * @param {Object} cita - Datos de la cita
   * @returns {Promise<Object>} - Información del envío
   */
  async enviarConfirmacionCita(email, nombre, cita) {
    const html = this.plantillas.confirmacionCita({
      nombre,
      fecha: new Date(cita.fechaInicio).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      hora: new Date(cita.fechaInicio).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      medico: `${cita.medico.nombre} ${cita.medico.apellido}`,
      tratamiento: cita.tratamiento.nombre,
      direccion: process.env.CLINICA_DIRECCION || 'Av. Principal 123',
      telefono: process.env.CLINICA_TELEFONO || '(123) 456-7890',
      urlCancelar: `${process.env.FRONTEND_URL}/citas/cancelar/${cita._id}`
    });
    
    return this._enviarEmail({
      destinatario: email,
      asunto: 'Confirmación de tu cita en Clínica de Estética',
      html
    });
  }
  
  /**
   * Envía un email para recuperación de contraseña
   * @param {String} email - Email del destinatario
   * @param {String} nombre - Nombre del destinatario
   * @param {String} resetUrl - URL para restablecer contraseña
   * @returns {Promise<Object>} - Información del envío
   */
  async enviarEmailRecuperacion(email, nombre, resetUrl) {
    const html = this.plantillas.recuperacionPassword({
      nombre,
      resetUrl,
      expiracion: '1 hora',
      anio: new Date().getFullYear()
    });
    
    return this._enviarEmail({
      destinatario: email,
      asunto: 'Recuperación de contraseña - Clínica de Estética',
      html
    });
  }
  
  /**
   * Envía un email de bienvenida
   * @param {String} email - Email del destinatario
   * @param {String} nombre - Nombre del destinatario
   * @param {String} password - Contraseña temporal (opcional)
   * @returns {Promise<Object>} - Información del envío
   */
  async enviarEmailBienvenida(email, nombre, password = null) {
    const html = this.plantillas.bienvenida({
      nombre,
      password,
      mostrarPassword: !!password,
      urlLogin: `${process.env.FRONTEND_URL}/login`,
      anio: new Date().getFullYear()
    });
    
    return this._enviarEmail({
      destinatario: email,
      asunto: 'Bienvenido/a a Clínica de Estética',
      html
    });
  }
  
  /**
   * Envía un email con resultados del tratamiento
   * @param {String} email - Email del destinatario
   * @param {String} nombre - Nombre del destinatario
   * @param {Object} historia - Datos de la historia clínica
   * @param {Array} adjuntos - Archivos adjuntos
   * @returns {Promise<Object>} - Información del envío
   */
  async enviarResultadosTratamiento(email, nombre, historia, adjuntos = []) {
    const html = this.plantillas.resultadosTratamiento({
      nombre,
      medico: `${historia.medico.nombre} ${historia.medico.apellido}`,
      tratamiento: historia.tratamientoRealizado.nombre,
      fecha: new Date(historia.createdAt).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      resultados: historia.resultados || 'No se registraron resultados específicos',
      indicaciones: historia.indicaciones || 'No se registraron indicaciones específicas',
      recomendaciones: historia.recomendacionesSeguimiento || 'No se registraron recomendaciones específicas',
      urlHistoria: `${process.env.FRONTEND_URL}/pacientes/historias/${historia._id}`,
      anio: new Date().getFullYear()
    });
    
    // Preparar adjuntos si existen
    const emailAdjuntos = adjuntos.map(adjunto => ({
      filename: adjunto.nombre,
      path: adjunto.ruta,
      contentType: adjunto.mimeType
    }));
    
    return this._enviarEmail({
      destinatario: email,
      asunto: `Resultados de tu tratamiento: ${historia.tratamientoRealizado.nombre}`,
      html,
      adjuntos: emailAdjuntos
    });
  }
  
  /**
   * Envía un email con documento firmado
   * @param {String} email - Email del destinatario
   * @param {String} nombre - Nombre del destinatario
   * @param {Object} documento - Datos del documento
   * @param {Object} adjunto - Archivo PDF adjunto
   * @returns {Promise<Object>} - Información del envío
   */
  async enviarDocumentoFirmado(email, nombre, documento, adjunto) {
    const html = this.plantillas.documentoFirmado({
      nombre,
      tipoDocumento: this._formatearTipoDocumento(documento.tipo),
      titulo: documento.titulo,
      fecha: new Date(documento.updatedAt).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      firmadoPor: documento.firmaPaciente && documento.firmaMedico 
        ? 'usted y su médico'
        : documento.firmaPaciente 
          ? 'usted' 
          : 'su médico',
      urlDocumento: `${process.env.FRONTEND_URL}/pacientes/documentos/${documento._id}`,
      anio: new Date().getFullYear()
    });
    
    // Preparar adjunto
    const emailAdjuntos = [{
      filename: `${documento.titulo.replace(/\s+/g, '_')}.pdf`,
      path: adjunto.ruta,
      contentType: 'application/pdf'
    }];
    
    return this._enviarEmail({
      destinatario: email,
      asunto: `Documento firmado: ${documento.titulo}`,
      html,
      adjuntos: emailAdjuntos
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
      'otro': 'Documento'
    };
    
    return tipos[tipo] || tipo;
  }
}

module.exports = new EmailService();