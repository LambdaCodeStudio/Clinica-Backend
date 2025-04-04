// src/models/tratamiento.js
const mongoose = require('mongoose');

const tratamientoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  categoria: {
    type: String,
    enum: ['estetica_general', 'medicina_estetica'],
    required: true
  },
  subcategoria: {
    type: String,
    trim: true,
    required: true
  },
  precio: {
    type: Number,
    required: true,
    min: 0
  },
  duracionEstimada: {
    type: Number, // En minutos
    required: true,
    min: 15
  },
  requiereConsulta: {
    type: Boolean,
    default: false
  },
  requiereConsentimiento: {
    type: Boolean,
    default: false
  },
  // ID del documento de consentimiento informado si es necesario
  consentimientoTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentoTemplate',
    default: null
  },
  // Profesionales habilitados para realizar este tratamiento
  profesionalesHabilitados: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Control de estado
  activo: {
    type: Boolean,
    default: true
  },
  // Metadatos
  notas: {
    type: String,
    trim: true
  },
  imagenes: [{
    url: { type: String },
    descripcion: { type: String, trim: true }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Tratamiento', tratamientoSchema);