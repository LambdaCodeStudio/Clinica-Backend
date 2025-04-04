// src/utils/formatters.js
const moment = require('moment');

/**
 * Utilidades para formateo de datos
 */
class Formatters {
  /**
   * Formatea una fecha en el formato deseado
   * @param {Date|String} fecha - Fecha a formatear
   * @param {String} formato - Formato deseado (por defecto DD/MM/YYYY)
   * @returns {String} - Fecha formateada
   */
  static formatearFecha(fecha, formato = 'DD/MM/YYYY') {
    if (!fecha) return '';
    return moment(fecha).format(formato);
  }

  /**
   * Formatea una fecha y hora en el formato deseado
   * @param {Date|String} fecha - Fecha a formatear
   * @param {String} formato - Formato deseado (por defecto DD/MM/YYYY HH:mm)
   * @returns {String} - Fecha y hora formateada
   */
  static formatearFechaHora(fecha, formato = 'DD/MM/YYYY HH:mm') {
    if (!fecha) return '';
    return moment(fecha).format(formato);
  }

  /**
   * Formatea un importe en pesos argentinos
   * @param {Number} importe - Importe a formatear
   * @param {Boolean} conSimbolo - Si incluye el símbolo $ o no
   * @returns {String} - Importe formateado
   */
  static formatearImporte(importe, conSimbolo = true) {
    if (importe === undefined || importe === null) return '';
    
    const importeFormateado = Number(importe).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    return conSimbolo ? `$${importeFormateado}` : importeFormateado;
  }

  /**
   * Formatea un nombre completo (apellido, nombre)
   * @param {String} nombre - Nombre
   * @param {String} apellido - Apellido
   * @returns {String} - Nombre completo formateado
   */
  static formatearNombreCompleto(nombre, apellido) {
    if (!nombre && !apellido) return '';
    if (!nombre) return apellido;
    if (!apellido) return nombre;
    
    return `${apellido}, ${nombre}`;
  }

  /**
   * Formatea el género para mostrar
   * @param {String} genero - Código de género
   * @returns {String} - Texto del género
   */
  static formatearGenero(genero) {
    const generos = {
      'masculino': 'Masculino',
      'femenino': 'Femenino',
      'otro': 'Otro',
      'no_especificado': 'No especificado'
    };
    
    return generos[genero] || genero || 'No especificado';
  }

  /**
   * Formatea el rol para mostrar
   * @param {String} rol - Código de rol
   * @returns {String} - Texto del rol
   */
  static formatearRol(rol) {
    const roles = {
      'administrador': 'Administrador',
      'medico': 'Médico',
      'secretaria': 'Secretaria',
      'paciente': 'Paciente'
    };
    
    return roles[rol] || rol || '';
  }

  /**
   * Formatea la especialidad para mostrar
   * @param {String} especialidad - Código de especialidad
   * @returns {String} - Texto de la especialidad
   */
  static formatearEspecialidad(especialidad) {
    const especialidades = {
      'estetica_general': 'Estética General',
      'medicina_estetica': 'Medicina Estética',
      'ambas': 'Estética General y Medicina Estética'
    };
    
    return especialidades[especialidad] || especialidad || '';
  }

  /**
   * Formatea el estado de una cita para mostrar
   * @param {String} estado - Código de estado
   * @returns {String} - Texto del estado
   */
  static formatearEstadoCita(estado) {
    const estados = {
      'programada': 'Programada',
      'confirmada': 'Confirmada',
      'en_curso': 'En Curso',
      'completada': 'Completada',
      'cancelada': 'Cancelada',
      'reprogramada': 'Reprogramada',
      'no_asistio': 'No Asistió'
    };
    
    return estados[estado] || estado || '';
  }

  /**
   * Formatea el método de pago para mostrar
   * @param {String} metodo - Código del método de pago
   * @returns {String} - Texto del método de pago
   */
  static formatearMetodoPago(metodo) {
    const metodos = {
      'efectivo': 'Efectivo',
      'tarjeta_debito': 'Tarjeta de Débito',
      'tarjeta_credito': 'Tarjeta de Crédito',
      'transferencia': 'Transferencia Bancaria',
      'cheque': 'Cheque',
      'otro': 'Otro'
    };
    
    return metodos[metodo] || metodo || '';
  }

  /**
   * Formatea duración en minutos a horas y minutos
   * @param {Number} minutos - Duración en minutos
   * @returns {String} - Duración formateada
   */
  static formatearDuracion(minutos) {
    if (!minutos) return '';
    
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    
    if (horas === 0) {
      return `${minutosRestantes} min`;
    } else if (minutosRestantes === 0) {
      return `${horas} h`;
    } else {
      return `${horas} h ${minutosRestantes} min`;
    }
  }

  /**
   * Trunca un texto a cierta longitud y agrega puntos suspensivos
   * @param {String} texto - Texto a truncar
   * @param {Number} longitud - Longitud máxima
   * @returns {String} - Texto truncado
   */
  static truncarTexto(texto, longitud = 100) {
    if (!texto) return '';
    if (texto.length <= longitud) return texto;
    
    return texto.substring(0, longitud) + '...';
  }

  /**
   * Formatea un objeto de error para respuesta estándar
   * @param {Error} error - Objeto de error
   * @param {Boolean} incluirDetalles - Si incluye detalles o no (solo en desarrollo)
   * @returns {Object} - Error formateado
   */
  static formatearError(error, incluirDetalles = false) {
    const esDesarrollo = process.env.NODE_ENV === 'development';
    
    return {
      status: 'error',
      message: error.message || 'Error interno del servidor',
      ...(esDesarrollo && incluirDetalles ? { 
        stack: error.stack,
        code: error.code
      } : {})
    };
  }

  /**
   * Formatea un grupo sanguíneo para mostrar
   * @param {String} grupo - Código del grupo sanguíneo
   * @returns {String} - Texto del grupo sanguíneo
   */
  static formatearGrupoSanguineo(grupo) {
    if (!grupo || grupo === 'desconocido') return 'Desconocido';
    return grupo;
  }

  /**
   * Formatea un DNI con puntos
   * @param {String} dni - DNI sin formato
   * @returns {String} - DNI formateado
   */
  static formatearDNI(dni) {
    if (!dni) return '';
    
    // Eliminar caracteres no numéricos
    const dniLimpio = dni.replace(/\D/g, '');
    
    // Formatear con puntos
    return dniLimpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Formatea un número de teléfono
   * @param {String} telefono - Teléfono sin formato
   * @returns {String} - Teléfono formateado
   */
  static formatearTelefono(telefono) {
    if (!telefono) return '';
    
    // Eliminar caracteres no numéricos
    const telefonoLimpio = telefono.replace(/\D/g, '');
    
    // Si es número de Argentina
    if (telefonoLimpio.length === 10) {
      return `(${telefonoLimpio.substring(0, 3)}) ${telefonoLimpio.substring(3, 6)}-${telefonoLimpio.substring(6)}`;
    }
    
    // Si es número con código de país
    if (telefonoLimpio.length > 10) {
      const codigoPais = telefonoLimpio.substring(0, telefonoLimpio.length - 10);
      const resto = telefonoLimpio.substring(telefonoLimpio.length - 10);
      return `+${codigoPais} (${resto.substring(0, 3)}) ${resto.substring(3, 6)}-${resto.substring(6)}`;
    }
    
    // Devolver sin formato si no coincide con patrones
    return telefono;
  }
}

module.exports = Formatters;