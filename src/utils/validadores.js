// src/utils/validadores.js
/**
 * Funciones de validación reutilizables
 * Complementa a express-validator usado en middleware/validacion.js
 */

/**
 * Valida que un valor sea un DNI válido (8 o 9 dígitos)
 * @param {String} dni - DNI a validar
 * @returns {Boolean} - True si es válido
 */
exports.esDNIValido = (dni) => {
    if (!dni) return false;
    const dniLimpio = dni.replace(/\D/g, '');
    return /^\d{7,9}$/.test(dniLimpio);
  };
  
  /**
   * Valida que un email tenga formato válido
   * @param {String} email - Email a validar
   * @returns {Boolean} - True si el formato es válido
   */
  exports.esEmailValido = (email) => {
    if (!email) return false;
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return emailRegex.test(email);
  };
  
  /**
   * Valida que un teléfono tenga formato válido 
   * @param {String} telefono - Teléfono a validar
   * @returns {Boolean} - True si el formato es válido
   */
  exports.esTelefonoValido = (telefono) => {
    if (!telefono) return false;
    const telefonoLimpio = telefono.replace(/[\s\-\(\)]+/g, '');
    return /^(\+?[0-9]{1,3})?[0-9]{10,15}$/.test(telefonoLimpio);
  };
  
  /**
   * Valida que una fecha sea válida y dentro de un rango razonable
   * @param {String|Date} fecha - Fecha a validar
   * @param {Object} opciones - Opciones adicionales
   * @returns {Boolean} - True si la fecha es válida
   */
  exports.esFechaValida = (fecha, opciones = {}) => {
    if (!fecha) return false;
    
    try {
      // Convertir a objeto Date si es string
      const fechaObj = fecha instanceof Date ? fecha : new Date(fecha);
      
      // Verificar si la fecha es válida
      if (isNaN(fechaObj.getTime())) return false;
      
      // Verificar rango mínimo si se especificó
      if (opciones.minDate && fechaObj < opciones.minDate) return false;
      
      // Verificar rango máximo si se especificó
      if (opciones.maxDate && fechaObj > opciones.maxDate) return false;
      
      // Verificar que no sea fecha futura si se requiere
      if (opciones.noFuture === true && fechaObj > new Date()) return false;
      
      return true;
    } catch (error) {
      return false;
    }
  };
  
  /**
   * Valida que un rango de fechas sea válido
   * @param {String|Date} fechaInicio - Fecha de inicio
   * @param {String|Date} fechaFin - Fecha de fin
   * @returns {Boolean} - True si el rango es válido
   */
  exports.esRangoFechasValido = (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin) return false;
    
    try {
      // Convertir a objetos Date
      const inicio = fechaInicio instanceof Date ? fechaInicio : new Date(fechaInicio);
      const fin = fechaFin instanceof Date ? fechaFin : new Date(fechaFin);
      
      // Verificar que ambas fechas sean válidas
      if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return false;
      
      // Verificar que la fecha fin sea posterior a la de inicio
      return fin > inicio;
    } catch (error) {
      return false;
    }
  };
  
  /**
   * Valida que una contraseña cumpla requisitos mínimos de seguridad
   * @param {String} password - Contraseña a validar
   * @returns {Object} - Resultado de validación con detalles
   */
  exports.validarFortalezaPassword = (password) => {
    if (!password) {
      return { valido: false, mensaje: 'La contraseña es requerida' };
    }
    
    const resultado = {
      valido: true,
      longitud: password.length >= 8,
      tieneMayuscula: /[A-Z]/.test(password),
      tieneMinuscula: /[a-z]/.test(password),
      tieneNumero: /[0-9]/.test(password),
      tieneEspecial: /[^A-Za-z0-9]/.test(password),
      puntaje: 0
    };
    
    // Calcular puntaje de fortaleza
    if (resultado.longitud) resultado.puntaje += 1;
    if (resultado.tieneMayuscula) resultado.puntaje += 1;
    if (resultado.tieneMinuscula) resultado.puntaje += 1;
    if (resultado.tieneNumero) resultado.puntaje += 1;
    if (resultado.tieneEspecial) resultado.puntaje += 1;
    
    // Determinar validez general
    resultado.valido = resultado.longitud && (resultado.puntaje >= 3);
    
    // Generar mensaje según fortaleza
    if (!resultado.valido) {
      resultado.mensaje = 'La contraseña debe tener al menos 8 caracteres y cumplir 3 de 4 criterios: mayúsculas, minúsculas, números y caracteres especiales';
    } else if (resultado.puntaje <= 3) {
      resultado.mensaje = 'Contraseña aceptable pero podría ser más segura';
    } else if (resultado.puntaje === 4) {
      resultado.mensaje = 'Contraseña segura';
    } else {
      resultado.mensaje = 'Contraseña muy segura';
    }
    
    return resultado;
  };
  
  /**
   * Valida un número de matrícula profesional
   * @param {String} matricula - Número de matrícula
   * @returns {Boolean} - True si la matrícula es válida
   */
  exports.esMatriculaValida = (matricula) => {
    if (!matricula) return false;
    
    // Formato: Letras-Números (ej. MN-12345)
    const formatoMatricula = /^[A-Z]{1,2}-\d{1,6}$/;
    return formatoMatricula.test(matricula);
  };
  
  /**
   * Valida que un valor decimal tenga formato válido
   * @param {String|Number} valor - Valor a validar
   * @param {Number} min - Valor mínimo (opcional)
   * @param {Number} max - Valor máximo (opcional)
   * @returns {Boolean} - True si el formato es válido
   */
  exports.esDecimalValido = (valor, min = null, max = null) => {
    if (valor === undefined || valor === null) return false;
    
    // Convertir a número si es string
    const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
    
    // Verificar que sea un número válido
    if (isNaN(numero)) return false;
    
    // Verificar mínimo si se especificó
    if (min !== null && numero < min) return false;
    
    // Verificar máximo si se especificó
    if (max !== null && numero > max) return false;
    
    return true;
  };
  
  /**
   * Valida que un código postal argentino tenga formato válido
   * @param {String} cp - Código postal a validar
   * @returns {Boolean} - True si el formato es válido
   */
  exports.esCodigoPostalValido = (cp) => {
    if (!cp) return false;
    
    // Formato Argentino: Letra+Números o 4 dígitos
    const formatoCPNuevo = /^[A-Z]\d{4}[A-Z]{3}$/;
    const formatoCPAntiguo = /^\d{4}$/;
    
    return formatoCPNuevo.test(cp) || formatoCPAntiguo.test(cp);
  };
  
  /**
   * Valida que un valor exista en un array de valores permitidos
   * @param {*} valor - Valor a validar
   * @param {Array} valoresPermitidos - Array de valores permitidos
   * @returns {Boolean} - True si el valor existe en el array
   */
  exports.existeEnEnum = (valor, valoresPermitidos) => {
    if (!valor || !Array.isArray(valoresPermitidos)) return false;
    return valoresPermitidos.includes(valor);
  };
  
  /**
   * Sanitiza un string para prevenir inyecciones
   * @param {String} texto - Texto a sanitizar
   * @returns {String} - Texto sanitizado
   */
  exports.sanitizarTexto = (texto) => {
    if (!texto) return '';
    
    // Remover tags HTML y caracteres especiales
    return texto
      .replace(/<[^>]*>/g, '')
      .replace(/[<>"'&]/g, (match) => {
        switch (match) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&#39;';
          case '&': return '&amp;';
          default: return match;
        }
      });
  };