// src/models/paciente.js
const mongoose = require('mongoose');

const pacienteSchema = new mongoose.Schema({
  // Relación con el usuario
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Datos personales extendidos
  dni: {
    type: String,
    trim: true,
    required: true,
    unique: true
  },
  fechaNacimiento: {
    type: Date,
    required: true
  },
  genero: {
    type: String,
    enum: ['masculino', 'femenino', 'otro', 'no_especificado'],
    required: true
  },
  direccion: {
    calle: { type: String, trim: true },
    numero: { type: String, trim: true },
    piso: { type: String, trim: true },
    depto: { type: String, trim: true },
    codigoPostal: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    provincia: { type: String, trim: true }
  },
  // Datos médicos básicos
  grupoSanguineo: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'desconocido'],
    default: 'desconocido'
  },
  alergias: [{
    tipo: { type: String, trim: true },
    descripcion: { type: String, trim: true },
    gravedad: { type: String, enum: ['leve', 'moderada', 'grave'], default: 'moderada' }
  }],
  condicionesMedicas: [{
    nombre: { type: String, trim: true },
    desde: { type: Date },
    notas: { type: String, trim: true }
  }],
  medicacionActual: [{
    nombre: { type: String, trim: true },
    dosis: { type: String, trim: true },
    frecuencia: { type: String, trim: true }
  }],
  // Contacto de emergencia
  contactoEmergencia: {
    nombre: { type: String, trim: true },
    relacion: { type: String, trim: true },
    telefono: { type: String, trim: true }
  },
  // Preferencias
  preferencias: {
    recordatoriosSMS: { type: Boolean, default: true },
    recordatoriosEmail: { type: Boolean, default: true },
    recibirPromociones: { type: Boolean, default: false }
  },
  // Metadatos
  notas: { type: String, trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Paciente', pacienteSchema);