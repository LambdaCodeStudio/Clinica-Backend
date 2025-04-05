// src/services/sms.js

// Determina si el servicio SMS está habilitado
const smsEnabled = process.env.SMS_ENABLED === 'true';

class SMSService {
  constructor() {
    this.enabled = smsEnabled;
    
    if (this.enabled) {
      try {
        const twilio = require('twilio');
        this.client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      } catch (error) {
        console.error("Error inicializando Twilio:", error);
        this.enabled = false;
      }
    } else {
      console.log("Servicio SMS deshabilitado por configuración");
    }
  }

  async sendSMS(to, message) {
    if (!this.enabled) {
      console.log(`📱 SMS simulado: Para: ${to}, Mensaje: ${message}`);
      return {
        success: true,
        sid: "SIMULADO_" + Date.now(),
        message: "Mensaje simulado (no enviado realmente)"
      };
    }
    
    try {
      const result = await this.client.messages.create({
        body: message,
        to: to,
        from: process.env.TWILIO_PHONE_NUMBER
      });
      
      return {
        success: true,
        sid: result.sid,
        message: "Mensaje enviado correctamente"
      };
    } catch (error) {
      console.error("Error al enviar SMS:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendVerificationCode(to, code) {
    const message = `Tu código de verificación es: ${code}`;
    return this.sendSMS(to, message);
  }

  async sendAppointmentReminder(to, appointmentData) {
    const { patientName, doctorName, date, time, location } = appointmentData;
    const message = `Recordatorio: ${patientName}, tienes una cita con ${doctorName} el ${date} a las ${time} en ${location}.`;
    return this.sendSMS(to, message);
  }

  async sendPasswordReset(to, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const message = `Para restablecer tu contraseña, haz clic en el siguiente enlace: ${resetUrl}. El enlace expira en 1 hora.`;
    return this.sendSMS(to, message);
  }
}

module.exports = new SMSService();