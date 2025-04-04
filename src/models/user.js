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