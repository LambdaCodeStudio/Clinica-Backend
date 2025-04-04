// src/models/documento.js
const mongoose = require('mongoose');

const documentoSchema = new mongoose.Schema({
  paciente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paciente',
    required: true
  },
  medico: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cita: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cita'
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentoTemplate'
  },
  tipo: {
    type: String,
    enum: ['consentimiento', 'autorizacion', 'informativo', 'receta', 'certificado', 'otro'],
    required: true
  },
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  contenido: {
    type: String,
    required: true
  },
  // Datos de firma
  firmaPaciente: {
    fechaFirma: { type: Date },
    datosFirma: { type: String }, // Datos biométricos o imagen de firma
    ip: { type: String },
    dispositivo: { type: String }
  },
  firmaMedico: {
    fechaFirma: { type: Date },
    datosFirma: { type: String },
    ip: { type: String }
  },
  // Control de estado
  estado: {
    type: String,
    enum: ['borrador', 'pendiente_firma_paciente', 'pendiente_firma_medico', 'completado', 'anulado'],
    default: 'borrador'
  },
  // Archivos adjuntos (como PDFs generados)
  archivos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Archivo'
  }],
  // Metadatos
  vigenciaHasta: {
    type: Date
  },
  notas: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices para búsquedas comunes
documentoSchema.index({ paciente: 1, tipo: 1, createdAt: -1 });
documentoSchema.index({ medico: 1, createdAt: -1 });
documentoSchema.index({ estado: 1 });

module.exports = mongoose.model('Documento', documentoSchema);