// src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Configurar directorios de almacenamiento
const directorios = {
  imagen: path.join(__dirname, '../uploads/imagenes'),
  documento: path.join(__dirname, '../uploads/documentos'),
  firma: path.join(__dirname, '../uploads/firmas'),
  receta: path.join(__dirname, '../uploads/recetas'),
  consentimiento: path.join(__dirname, '../uploads/consentimientos'),
  certificado: path.join(__dirname, '../uploads/certificados'),
  otro: path.join(__dirname, '../uploads/otros')
};

// Crear directorios si no existen
Object.values(directorios).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configurar almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determinar directorio según el tipo de archivo
    const tipo = req.body.tipo || 'otro';
    const directorio = directorios[tipo] || directorios.otro;
    
    cb(null, directorio);
  },
  filename: (req, file, cb) => {
    // Generar nombre único para el archivo
    const nombreUnico = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const extension = path.extname(file.originalname);
    
    cb(null, nombreUnico + extension);
  }
});

// Filtro de archivos permitidos
const fileFilter = (req, file, cb) => {
  // Lista de tipos MIME permitidos
  const tiposPermitidos = {
    imagen: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    documento: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    firma: ['image/jpeg', 'image/png', 'image/svg+xml'],
    receta: ['image/jpeg', 'image/png', 'application/pdf'],
    consentimiento: ['application/pdf', 'image/jpeg', 'image/png'],
    certificado: ['application/pdf', 'image/jpeg', 'image/png'],
    otro: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
  };
  
  // Determinar tipo del archivo
  const tipo = req.body.tipo || 'otro';
  const tiposAceptados = tiposPermitidos[tipo] || tiposPermitidos.otro;
  
  // Verificar si el tipo MIME es permitido
  if (tiposAceptados.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Se acepta: ${tiposAceptados.join(', ')}`), false);
  }
};

// Configuración de límites
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB máximo
  files: 1 // Solo un archivo a la vez
};

// Exportar middleware configurado
const upload = multer({
  storage,
  fileFilter,
  limits
});

module.exports = upload;