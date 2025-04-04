// src/models/historiaClinica.js
const mongoose = require('mongoose');

const historiaClinicaSchema = new mongoose.Schema({
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
    ref: 'Cita',
    required: true
  },
  tratamientoRealizado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tratamiento',
    required: true
  },
  // Datos clínicos
  motivoConsulta: {
    type: String,
    required: true,
    trim: true
  },
  diagnostico: {
    type: String,
    trim: true
  },
  observaciones: {
    type: String,
    trim: true
  },
  indicaciones: {
    type: String,
    trim: true
  },
  // Seguimiento y registros
  parametrosRegistrados: [{
    nombre: { type: String, trim: true },
    valor: { type: String, trim: true },
    unidad: { type: String, trim: true }
  }],
  // Para tratamientos estéticos 
  resultados: {
    type: String,
    trim: true
  },
  // Documentos y archivos
  documentos: [{
    tipo: { 
      type: String, 
      enum: ['consentimiento', 'receta', 'resultado', 'foto_antes', 'foto_despues', 'otros'] 
    },
    archivoId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Archivo' 
    },
    fechaCreacion: { 
      type: Date, 
      default: Date.now 
    },
    notas: { 
      type: String, 
      trim: true 
    }
  }],
  // Autorización de divulgación
  autorizacionDivulgacionImagenes: {
    type: Boolean,
    default: false
  },
  // Próximos pasos
  recomendacionesSeguimiento: {
    type: String,
    trim: true
  },
  proximaCita: {
    recomendada: { type: Boolean, default: false },
    tiempoRecomendado: { type: Number }, // En días
    observaciones: { type: String, trim: true }
  }
}, {
  timestamps: true
});

// Índices para mejorar búsquedas
historiaClinicaSchema.index({ paciente: 1, createdAt: -1 });
historiaClinicaSchema.index({ medico: 1, createdAt: -1 });

module.exports = mongoose.model('HistoriaClinica', historiaClinicaSchema);