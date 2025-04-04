// src/models/user.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Datos básicos
  nombre: { 
    type: String, 
    required: true, 
    trim: true 
  },
  apellido: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  telefono: { 
    type: String, 
    trim: true 
  },
  // Control de acceso
  rol: { 
    type: String, 
    enum: ['administrador', 'medico', 'secretaria', 'paciente'], 
    required: true 
  },
  especialidad: { 
    type: String,
    enum: ['estetica_general', 'medicina_estetica', 'ambas', ''],
    default: '' 
  },
  activo: { 
    type: Boolean, 
    default: true 
  },
  // Datos extras dependiendo del rol
  matriculaProfesional: {
    type: String,
    trim: true
  },
  // Seguimiento y auditoría
  ultimoAcceso: { 
    type: Date, 
    default: null 
  },
  tokenRecuperacion: { 
    type: String, 
    default: null 
  },
  expiracionToken: { 
    type: Date, 
    default: null 
  },
  intentosFallidos: { 
    type: Number, 
    default: 0 
  },
  bloqueadoHasta: { 
    type: Date, 
    default: null 
  }
}, { 
  timestamps: true, // Añade createdAt y updatedAt automáticamente
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.password; // No incluir contraseña en JSON
      return ret;
    }
  }
});

// Hash de contraseña antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
userSchema.methods.compararPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para gestionar intentos fallidos
userSchema.methods.registrarIntentoFallido = async function() {
  this.intentosFallidos += 1;
  
  // Si supera el límite, bloquear por 30 minutos
  if (this.intentosFallidos >= 5) {
    this.bloqueadoHasta = new Date(Date.now() + 30 * 60 * 1000);
  }
  
  await this.save();
};

// Método para verificar si la cuenta está bloqueada
userSchema.methods.estaBloqueado = function() {
  return this.bloqueadoHasta && this.bloqueadoHasta > new Date();
};

// Método para reiniciar intentos fallidos
userSchema.methods.reiniciarIntentos = async function() {
  this.intentosFallidos = 0;
  this.bloqueadoHasta = null;
  await this.save();
};

module.exports = mongoose.model('User', userSchema);