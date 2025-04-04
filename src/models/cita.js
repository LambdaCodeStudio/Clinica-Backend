// src/models/cita.js
const mongoose = require('mongoose');

const citaSchema = new mongoose.Schema({
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
  tratamiento: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tratamiento',
    required: true
  },
  fechaInicio: {
    type: Date,
    required: true
  },
  fechaFin: {
    type: Date,
    required: true
  },
  estado: {
    type: String,
    enum: ['programada', 'confirmada', 'en_curso', 'completada', 'cancelada', 'reprogramada', 'no_asistio'],
    default: 'programada'
  },
  notas: {
    type: String,
    trim: true
  },
  // Para reprogramaciones
  citaOriginal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cita',
    default: null
  },
  // Recordatorios
  recordatoriosEnviados: [{
    tipo: { type: String, enum: ['email', 'sms'] },
    fecha: { type: Date },
    estado: { type: String, enum: ['enviado', 'fallido', 'recibido'] }
  }],
  // Para métricas y reportes
  canceladoPor: {
    type: String,
    enum: ['paciente', 'medico', 'sistema', 'no_aplica'],
    default: 'no_aplica'
  },
  motivoCancelacion: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices para mejorar búsquedas comunes
citaSchema.index({ paciente: 1, fechaInicio: -1 });
citaSchema.index({ medico: 1, fechaInicio: -1 });
citaSchema.index({ estado: 1, fechaInicio: -1 });

module.exports = mongoose.model('Cita', citaSchema);