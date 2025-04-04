// src/models/pago.js
const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  paciente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paciente',
    required: true
  },
  cita: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cita',
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
  // Datos financieros
  monto: {
    type: Number,
    required: true,
    min: 0
  },
  metodoPago: {
    type: String,
    enum: ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque', 'otro'],
    required: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'completado', 'reembolsado', 'anulado'],
    default: 'pendiente'
  },
  // Información fiscal
  comprobante: {
    tipo: { 
      type: String, 
      enum: ['factura_a', 'factura_b', 'factura_c', 'recibo', 'ticket', 'otro'] 
    },
    numero: { type: String, trim: true },
    fechaEmision: { type: Date }
  },
  // Datos para reportes
  categoria: {
    type: String,
    enum: ['estetica_general', 'medicina_estetica'],
    required: true
  },
  // Reembolsos o cancelaciones
  reembolso: {
    fecha: { type: Date },
    monto: { type: Number, min: 0 },
    motivo: { type: String, trim: true },
    aprobadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  // Metadatos
  notasInternas: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices para reportes y búsquedas
pagoSchema.index({ paciente: 1, createdAt: -1 });
pagoSchema.index({ medico: 1, createdAt: -1 });
pagoSchema.index({ createdAt: -1 });
pagoSchema.index({ estado: 1 });
pagoSchema.index({ categoria: 1, createdAt: -1 });

module.exports = mongoose.model('Pago', pagoSchema);