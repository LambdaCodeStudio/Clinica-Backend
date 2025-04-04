// src/services/sms.js
const twilio = require('twilio');

/**
 * Servicio para el envío de SMS
 */
class SMSService {
  constructor() {
    // Verificar si las credenciales están configuradas
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilio = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
      this.enabled = true;
    } else {
      console.warn('Credenciales de Twilio no configuradas. El servicio de SMS está deshabilitado.');
      this.enabled = false;
    }
  }
  
  /**
   * Envía un mensaje SMS
   * @param {String} to - Número de teléfono del destinatario
   * @param {String} message - Contenido del mensaje
   * @returns {Promise<Object>} - Información del envío
   */
  async enviarSMS(to, message) {
    try {
      if (!this.enabled) {
        throw new Error('Servicio de SMS no configurado');
      }
      
      // Validar número de teléfono
      if (!this._validarTelefono(to)) {
        throw new Error('Número de teléfono no válido');
      }
      
      // Formatear teléfono si es necesario
      const numeroFormateado = this._formatearTelefono(to);
      
      // Enviar SMS
      const resultado = await this.twilio.messages.create({
        body: message,
        from: this.phoneNumber,
        to: numeroFormateado
      });
      
      console.log('SMS enviado:', resultado.sid);
      return resultado;
    } catch (error) {
      console.error('Error al enviar SMS:', error);
      throw error;
    }
  }
  
  /**
   * Envía un recordatorio de cita por SMS
   * @param {String} telefono - Número de teléfono del destinatario
   * @param {String} nombre - Nombre del destinatario
   * @param {Object} cita - Datos de la cita
   * @returns {Promise<Object>} - Información del envío
   */
  async enviarRecordatorioCita(telefono, nombre, cita) {
    try {
      const fecha = new Date(cita.fechaInicio).toLocaleDateString('es-ES');
      const hora = new Date(cita.fechaInicio).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const mensaje = `Hola ${nombre}, recordatorio de tu cita en Clínica de Estética el ${fecha} a las ${hora}. Confirma al ${process.env.CLINICA_TELEFONO || '(123) 456-7890'}.`;
      
      return await this.enviarSMS(telefono, mensaje);
    } catch (error) {
      console.error('Error al enviar recordatorio por SMS:', error);
      throw error;
    }
  }
  
  /**
   * Valida un número de teléfono
   * @param {String} telefono - Número de teléfono
   * @returns {Boolean} - True si es válido
   * @private
   */
  _validarTelefono(telefono) {
    // Eliminar espacios, guiones, paréntesis, etc.
    const numeroLimpio = telefono.replace(/\s+|\(|\)|\-/g, '');
    
    // Verificar que tenga al menos 10 dígitos
    return /^\+?[0-9]{10,15}$/.test(numeroLimpio);
  }
  
  /**
   * Formatea un número de teléfono para Twilio
   * @param {String} telefono - Número de teléfono
   * @returns {String} - Número formateado
   * @private
   */
  _formatearTelefono(telefono) {
    // Eliminar espacios, guiones, paréntesis, etc.
    let numeroLimpio = telefono.replace(/\s+|\(|\)|\-/g, '');
    
    // Asegurarse que tenga prefijo internacional
    if (!numeroLimpio.startsWith('+')) {
      // Asumir que es de Argentina si no tiene prefijo
      numeroLimpio = `+54${numeroLimpio}`;
      
      // Si empieza con 0, quitarlo
      if (numeroLimpio.charAt(3) === '0') {
        numeroLimpio = `+54${numeroLimpio.substring(4)}`;
      }
    }
    
    return numeroLimpio;
  }
}

module.exports = new SMSService();