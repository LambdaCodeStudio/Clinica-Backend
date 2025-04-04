// src/models/documentoTemplate.js
const mongoose = require('mongoose');

const documentoTemplateSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  tipo: {
    type: String,
    enum: ['consentimiento', 'autorizacion', 'informativo', 'receta', 'certificado'],
    required: true
  },
  categoria: {
    type: String,
    enum: ['estetica_general', 'medicina_estetica', 'general'],
    required: true
  },
  contenido: {
    type: String,
    required: true
  },
  // Variables dinámicas para personalizar el documento
  variables: [{
    nombre: { type: String, trim: true },
    descripcion: { type: String, trim: true },
    requerido: { type: Boolean, default: false }
  }],
  // Requiere firma del paciente
  requiereFirma: {
    type: Boolean,
    default: true
  },
  requiereFirmaMedico: {
    type: Boolean,
    default: true
  },
  // Versión y control
  version: {
    type: String,
    required: true,
    default: '1.0'
  },
  activo: {
    type: Boolean,
    default: true
  },
  // Información legal
  nota: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DocumentoTemplate', documentoTemplateSchema);