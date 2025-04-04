// src/models/archivo.js
const mongoose = require('mongoose');

const archivoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  tipo: {
    type: String,
    enum: ['imagen', 'documento', 'firma', 'receta', 'consentimiento', 'certificado', 'otro'],
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  tamanio: {
    type: Number, // en bytes
    required: true
  },
  ruta: {
    type: String,
    required: true
  },
  // Relaciones
  paciente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paciente',
    required: true
  },
  subidoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cita: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cita'
  },
  // Metadatos
  categoria: {
    type: String,
    enum: ['foto_antes', 'foto_despues', 'receta', 'estudio', 'consentimiento', 'documento_firmado', 'otro'],
    required: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  // Control y seguridad
  hash: {
    type: String // Para verificación de integridad
  },
  fechaEliminacion: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Índices para búsquedas comunes
archivoSchema.index({ paciente: 1, tipo: 1, createdAt: -1 });
archivoSchema.index({ subidoPor: 1, createdAt: -1 });
archivoSchema.index({ categoria: 1 });

module.exports = mongoose.model('Archivo', archivoSchema);