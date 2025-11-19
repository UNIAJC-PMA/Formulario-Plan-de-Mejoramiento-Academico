// URL
const p1 = 'https://';
const p2 = 'vkfjtt';
const p3 = 'ukyrti';
const p4 = 'umzfmy';
const p5 = 'uk.supa';
const p6 = 'base.co';
const SUPABASE_URL = p1 + p2 + p3 + p4 + p5 + p6;

// KEY
const k1 = 'eyJhbGciOiJIUzI1';
const k2 = 'NiIsInR5cCI6IkpXVCJ9.';
const k3 = 'eyJpc3MiOiJzdXBhYmFzZS';
const k4 = 'IsInJlZiI6InZrZmp0dHVr';
const k5 = 'eXJ0aXVtemZteXVrIiwicm';
const k6 = '9sZSI6ImFub24iLCJpYXQi';
const k7 = 'OjE3NjI0NTU0MjQsImV4cC';
const k8 = 'I6MjA3ODAzMTQyNH0.';
const k9 = 'eU8GeI8IVazXydMDwY98';
const k10 = 'TUzT9xvjhcbXBu6cruCPiEk';
const SUPABASE_KEY = k1 + k2 + k3 + k4 + k5 + k6 + k7 + k8 + k9 + k10;

// ===================================
// CONSTANTES
// ===================================
const NOMBRES_FACULTADES = {
  'DCB': 'Departamento de Ciencias Básicas',
  'FCE': 'Facultad de Ciencias Empresariales',
  'FCSH': 'Facultad de Ciencias Sociales y Humanas',
  'FEDV': 'Facultad de Educación a Distancia y Virtual',
  'FI': 'Facultad de Ingeniería'
};

// ===================================
// VARIABLES GLOBALES
// ===================================
let datosEstudiante = null;
let instructorActual = null;
let formularioEnviandose = false;
let graficoTutorias = null;

// ===================================
// CACHE DE DATOS PRECARGADOS
// ===================================
let datosCache = {
  facultadesCarreras: [],
  tutoresNorte: [],
  tutoresSur: [],
  profesores: [],
  materias: [],
  temas: []
};

let facultadesData = {};

// ===================================
// FUNCIÓN AUXILIAR PARA FECHAS
// ===================================
function convertirFechaAColombia(fechaUTC) {
  const fecha = new Date(fechaUTC);
  const fechaColombia = new Date(fecha.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  
  const horas = String(fechaColombia.getHours()).padStart(2, '0');
  const minutos = String(fechaColombia.getMinutes()).padStart(2, '0');
  const horaFormateada = `${horas}:${minutos}`;
  
  // Número de serie de Excel
  const serialDate = (fechaColombia - new Date(1899, 11, 30)) / (24 * 60 * 60 * 1000);
  
  return { fechaColombia, horaFormateada, serialDate };
}

// ===================================
// FUNCIÓN AUXILIAR PARA FORMATO EXCEL
// ===================================
function aplicarFormatoExcel(ws, range) {
  // Formato de fecha DD/MM/YYYY en columna Fecha
  for (let row = 1; row <= range.e.r; row++) {
    const fechaCell = XLSX.utils.encode_cell({ r: row, c: 0 });
    if (ws[fechaCell] && row > 0) {
      ws[fechaCell].t = 'n';
      ws[fechaCell].z = 'dd/mm/yyyy';
    }
  }
  
  // Formato numérico en columna Documento
  for (let row = 1; row <= range.e.r; row++) {
    const docCell = XLSX.utils.encode_cell({ r: row, c: 2 });
    if (ws[docCell] && row > 0) {
      ws[docCell].t = 'n';
      ws[docCell].z = '0';
    }
  }
  
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
}

// ===================================
// VALIDAR RANGO DE FECHAS
// ===================================
function validarRangoFechas() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;

  if (!desde || !hasta) {
    alert('Por favor seleccione ambas fechas');
    return null;
  }

  if (new Date(desde) > new Date(hasta)) {
    alert('La fecha inicial no puede ser mayor que la fecha final');
    return null;
  }

  return { desde, hasta };
}

// ===================================
// FUNCIÓN DE REINTENTOS AUTOMÁTICOS
// ===================================
async function fetchConReintentos(url, options, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }
      
      return await response.json();
      
    } catch (error) {
      console.log(`Intento ${i + 1} de ${intentos} falló:`, error.message);
      
      if (i === intentos - 1) {
        throw new Error('No pudimos conectar con el servidor después de varios intentos. Por favor verifica tu conexión a internet e intenta de nuevo.');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      console.log(`Reintentando...`);
    }
  }
}

// ===================================
// FUNCIONES DE SUPABASE
// ===================================
async function supabaseQuery(table, options = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  
  if (options.select) url += `?select=${options.select}`;
  if (options.eq) url += `${options.select ? '&' : '?'}${options.eq.field}=eq.${options.eq.value}`;
  if (options.order) url += `${url.includes('?') ? '&' : '?'}order=${options.order}`;
  
  return await fetchConReintentos(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
}

async function supabaseInsert(table, data) {
  return await fetchConReintentos(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
}

// ===================================
// PRECARGA DE DATOS
// ===================================
async function precargarDatosFormulario() {
  if (datosCache.tutoresNorte.length > 0) return;
  
  try {
    console.log('Precargando datos del formulario...');
    
    const [tutoresNorte, tutoresSur, profesores, materias, temas] = await Promise.all([
      supabaseQuery('tutores_norte'),
      supabaseQuery('tutores_sur'),
      supabaseQuery('profesores'),
      supabaseQuery('materias'),
      supabaseQuery('temas')
    ]);
    
    datosCache.tutoresNorte = tutoresNorte;
    datosCache.tutoresSur = tutoresSur;
    datosCache.profesores = profesores;
    datosCache.materias = materias;
    datosCache.temas = temas;
    
    console.log('Datos del formulario cargados');
  } catch (error) {
    console.error('Error precargando datos del formulario:', error);
    throw error;
  }
}

async function precargarDatosRegistro() {
  if (datosCache.facultadesCarreras.length > 0) return;
  
  try {
    console.log('Precargando datos del registro...');
    
    const facultadesCarreras = await supabaseQuery('facultades_carreras');
    
    datosCache.facultadesCarreras = facultadesCarreras;
    procesarFacultadesData();
    
    console.log('Datos del registro cargados');
  } catch (error) {
    console.error('Error precargando datos del registro:', error);
    throw error;
  }
}

async function precargarDatosEstadisticas() {
  if (datosCache.tutoresNorte.length > 0 && datosCache.profesores.length > 0) return;
  
  try {
    console.log('Precargando datos de estadísticas...');
    
    const [tutoresNorte, tutoresSur, profesores] = await Promise.all([
      supabaseQuery('tutores_norte'),
      supabaseQuery('tutores_sur'),
      supabaseQuery('profesores')
    ]);
    
    datosCache.tutoresNorte = tutoresNorte;
    datosCache.tutoresSur = tutoresSur;
    datosCache.profesores = profesores;
    
    console.log('Datos de estadísticas cargados');
  } catch (error) {
    console.error('Error precargando datos de estadísticas:', error);
    throw error;
  }
}

function procesarFacultadesData() {
  facultadesData = {};
  
  datosCache.facultadesCarreras.forEach(item => {
    if (!facultadesData[item.facultad]) {
      facultadesData[item.facultad] = [];
    }
    facultadesData[item.facultad].push(item.programa);
  });
}

function limpiarEspacios(input) {
  const valorOriginal = input.value;
  
  let valor = input.value.trim();
  valor = valor.replace(/\s+/g, ' ');
  
  if (valorOriginal !== valor) {
    input.value = valor;
    input.style.backgroundColor = '#e8f4fd';
    setTimeout(() => {
      input.style.backgroundColor = '';
    }, 300);
  }
}

// ===================================
// FUNCIONES DE NAVEGACIÓN
// ===================================
function mostrarPantalla(id) {
  const pantallas = ['pantallaInicio', 'pantallaRegistro', 'pantallaLogin', 'pantallaFormulario', 'pantallaAdminLogin', 'pantallaAdmin'];
  pantallas.forEach(pantallaId => document.getElementById(pantallaId).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function mostrarLogin() {
  mostrarPantalla('pantallaLogin');
  document.getElementById('mensajeLogin').innerHTML = '';
  
  if (datosCache.tutoresNorte.length === 0) {
    const mensajeLogin = document.getElementById('mensajeLogin');
    mensajeLogin.innerHTML = '<div class="loader"></div><p style="text-align: center; color: #666; font-size: 13px; margin-top: 10px;">Cargando datos del formulario...</p>';
    
    try {
      await precargarDatosFormulario();
      mensajeLogin.innerHTML = '';
    } catch (error) {
      mensajeLogin.innerHTML = '';
      console.error('Error precargando datos:', error);
    }
  }
}

async function mostrarRegistro() {
  mostrarPantalla('pantallaRegistro');
  document.getElementById('mensajeRegistro').innerHTML = '';
  document.getElementById('confirmacionDatos').classList.add('hidden');
  document.getElementById('btnConfirmarRegistro').classList.add('hidden');
  
  document.getElementById('pasoDocumento').classList.remove('hidden');
  document.getElementById('formRegistro').classList.add('hidden');
  document.getElementById('regDocumento').value = '';
  
  if (datosCache.facultadesCarreras.length === 0) {
    mostrarCargando('mensajeRegistro');
    try {
      await precargarDatosRegistro();
      document.getElementById('mensajeRegistro').innerHTML = '';
      cargarFacultades();
    } catch (error) {
      mostrarMensaje('mensajeRegistro', 'Error al cargar los datos. Por favor intenta de nuevo.', 'error');
    }
  } else {
    cargarFacultades();
  }
}

function mostrarLoginAdmin() {
  mostrarPantalla('pantallaAdminLogin');
  document.getElementById('mensajeAdminLogin').innerHTML = '';
}

// ===================================
// GESTIÓN DE HORARIOS
// ===================================
function ocultarTodosLosHorarios() {
  ['horarioNorte', 'horarioSur', 'horarioVirtual'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

function toggleHorarios() {
  const contenedor = document.getElementById('contenedorHorarios');
  contenedor.classList.toggle('hidden');
  
  if (contenedor.classList.contains('hidden')) {
    ocultarTodosLosHorarios();
  }
}

function toggleHorario(sede) {
  ocultarTodosLosHorarios();
  
  const horarioMap = {
    'norte': 'horarioNorte',
    'sur': 'horarioSur',
    'virtual': 'horarioVirtual'
  };
  
  const horarioId = horarioMap[sede];
  if (horarioId) {
    document.getElementById(horarioId).classList.toggle('hidden');
  }
}

function volverInicio() {
  mostrarPantalla('pantallaInicio');
  limpiarFormularios();
  formularioEnviandose = false;
  
  ['btnContinuar', 'confirmacionDatos', 'contenedorHorarios'].forEach(id => {
    document.getElementById(id).classList.remove('hidden');
  });
  
  ['btnConfirmarRegistro'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  
  ocultarTodosLosHorarios();

  const btnEnviar = document.getElementById('btnEnviar');
  if (btnEnviar) reactivarBoton(btnEnviar, 'Enviar Formulario');
  
  const btnRegistro = document.getElementById('btnConfirmarRegistro');
  if (btnRegistro) reactivarBoton(btnRegistro, 'Confirmar y Registrarme');
}

function limpiarFormularios() {
  document.getElementById('formRegistro').reset();
  document.getElementById('formLogin').reset();
  document.getElementById('formTutoria').reset();
  document.getElementById('formAdminLogin').reset();
}

function mostrarMensaje(elementId, mensaje, tipo) {
  const elemento = document.getElementById(elementId);
  elemento.innerHTML = `<div class="mensaje ${tipo}">${mensaje}</div>`;
  
  setTimeout(() => {
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
  
  setTimeout(() => elemento.innerHTML = '', 10000);
}

function mostrarCargando(elementId) {
  const elemento = document.getElementById(elementId);
  elemento.innerHTML = '<div class="loader"></div>';
  
  setTimeout(() => {
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ===================================
// GESTIÓN DE ESTADO DE BOTONES
// ===================================
function desactivarBoton(boton, textoEspera) {
  boton.disabled = true;
  boton.textContent = textoEspera;
  boton.style.opacity = '0.6';
  boton.style.cursor = 'not-allowed';
}

function reactivarBoton(boton, textoOriginal) {
  boton.disabled = false;
  boton.textContent = textoOriginal;
  boton.style.opacity = '1';
  boton.style.cursor = 'pointer';
}

// ===================================
// VALIDACIÓN Y REGISTRO
// ===================================
function validarDocumento(documento) {
  const longitud = documento.length;
  
  if (longitud < 7 || longitud > 12) {
    return {
      valido: false,
      mensaje: 'Documento no válido'
    };
  }
  
  return { valido: true };
}

function cargarFacultades() {
  const select = document.getElementById('regFacultad');
  select.innerHTML = '<option value="">Seleccione una facultad</option>';
  
  const facultadesOrdenadas = Object.keys(facultadesData).sort();
  
  facultadesOrdenadas.forEach(facultad => {
    const option = document.createElement('option');
    option.value = facultad;
    option.textContent = facultad;
    select.appendChild(option);
  });
}

function cargarProgramas() {
  const facultad = document.getElementById('regFacultad').value;
  const selectPrograma = document.getElementById('regPrograma');
  
  if (!facultad) {
    selectPrograma.disabled = true;
    selectPrograma.innerHTML = '<option value="">Primero seleccione una facultad</option>';
    return;
  }
  
  selectPrograma.disabled = false;
  selectPrograma.innerHTML = '<option value="">Seleccione un programa</option>';
  
  const programas = facultadesData[facultad] || [];
  const programasOrdenados = programas.sort();
  
  programasOrdenados.forEach(programa => {
    const option = document.createElement('option');
    option.value = programa;
    option.textContent = programa;
    selectPrograma.appendChild(option);
  });
}


function mostrarConfirmacion() {
  const doc = document.getElementById('regDocumento').value;
  
  const validacion = validarDocumento(doc);
  if (!validacion.valido) {
    mostrarMensaje('mensajeRegistro', validacion.mensaje, 'error');
    return;
  }
    
  const primerNombre = document.getElementById('regPrimerNombre').value.toUpperCase();
  const segundoNombre = document.getElementById('regSegundoNombre').value.toUpperCase();
  const primerApellido = document.getElementById('regPrimerApellido').value.toUpperCase();
  const segundoApellido = document.getElementById('regSegundoApellido').value.toUpperCase();
  const facultad = document.getElementById('regFacultad').value;
  const programa = document.getElementById('regPrograma').value;
  const sede = document.getElementById('regSede').value;

  if (!doc || !primerNombre || !primerApellido || !segundoApellido || !facultad || !programa || !sede) {
    mostrarMensaje('mensajeRegistro', 'Por favor complete todos los campos obligatorios', 'error');
    return;
  }

  const nombreCompleto = `${primerNombre} ${segundoNombre} ${primerApellido} ${segundoApellido}`.replace(/\s+/g, ' ');

  const html = `
    <div class="confirmation-item">
      <div class="confirmation-label">Documento:</div>
      <div class="confirmation-value">${doc}</div>
    </div>
    <div class="confirmation-item">
      <div class="confirmation-label">Nombre Completo:</div>
      <div class="confirmation-value">${nombreCompleto}</div>
    </div>
    <div class="confirmation-item">
      <div class="confirmation-label">Facultad:</div>
      <div class="confirmation-value">${facultad}</div>
    </div>
    <div class="confirmation-item">
      <div class="confirmation-label">Programa:</div>
      <div class="confirmation-value">${programa}</div>
    </div>
    <div class="confirmation-item">
      <div class="confirmation-label">Sede:</div>
      <div class="confirmation-value">${sede}</div>
    </div>
  `;

  document.getElementById('datosConfirmacion').innerHTML = html;
  document.getElementById('confirmacionDatos').classList.remove('hidden');
  document.getElementById('btnConfirmarRegistro').classList.remove('hidden');
  document.getElementById('btnContinuar').classList.add('hidden');
  
  setTimeout(() => {
    document.getElementById('confirmacionDatos').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

async function verificarDocumento(event) {
  event.preventDefault();
  
  const doc = document.getElementById('regDocumento').value;
  
  const validacion = validarDocumento(doc);
  if (!validacion.valido) {
    mostrarMensaje('mensajeRegistro', validacion.mensaje, 'error');
    return;
  }
  
  mostrarCargando('mensajeRegistro');

  try {
    const existing = await supabaseQuery('estudiantes', {
      eq: { field: 'documento', value: doc }
    });

    if (existing.length > 0) {
      mostrarMensaje('mensajeRegistro', 'Este documento ya está registrado en el sistema. Si necesita actualizar sus datos, contacte al administrador.', 'error');
      return;
    }

    document.getElementById('mensajeRegistro').innerHTML = '';
    document.getElementById('pasoDocumento').classList.add('hidden');
    document.getElementById('formRegistro').classList.remove('hidden');
    document.getElementById('regDocumentoMostrar').value = doc;
    
    setTimeout(() => {
      document.getElementById('formRegistro').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

  } catch (error) {
    mostrarMensaje('mensajeRegistro', 'Error al verificar el documento: ' + error.message, 'error');
  }
}

async function registrarEstudiante(event) {
  event.preventDefault();
  
  const doc = document.getElementById('regDocumentoMostrar').value;
  const btnRegistro = document.getElementById('btnConfirmarRegistro');
  
  desactivarBoton(btnRegistro, '⏳ Registrando...');
  mostrarCargando('mensajeRegistro');

  const datos = {
    documento: doc,
    primer_nombre: document.getElementById('regPrimerNombre').value.toUpperCase(),
    segundo_nombre: document.getElementById('regSegundoNombre').value.toUpperCase() || null,
    primer_apellido: document.getElementById('regPrimerApellido').value.toUpperCase(),
    segundo_apellido: document.getElementById('regSegundoApellido').value.toUpperCase(),
    facultad: document.getElementById('regFacultad').value,
    programa: document.getElementById('regPrograma').value,
    sede: document.getElementById('regSede').value
  };

  try {
    const resultado = await supabaseInsert('estudiantes', datos);
    
    if (resultado && resultado.length > 0) {
      document.getElementById('mensajeRegistro').innerHTML = '';
      
      const modal = document.getElementById('modalExitoRegistro');
      modal.style.display = 'flex';
      modal.classList.remove('hidden');
      
      setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        volverInicio();
      }, 3000);
    } else {
      mostrarMensaje('mensajeRegistro', 'Error: No se pudo completar el registro', 'error');
      reactivarBoton(btnRegistro, 'Confirmar y Registrarme');
    }
  } catch (error) {
    mostrarMensaje('mensajeRegistro', error.message, 'error');
    reactivarBoton(btnRegistro, 'Confirmar y Registrarme');
  }
}

// ===================================
// LOGIN Y SESIÓN
// ===================================
function censurarNombre(nombreCompleto) {
  const partes = nombreCompleto.split(' ');
  return partes.map(parte => {
    if (parte.length <= 2) return parte;
    return parte.substring(0, 2) + '*'.repeat(parte.length - 2);
  }).join(' ');
}

async function iniciarSesion(event) {
  event.preventDefault();
  
  const documento = document.getElementById('loginDocumento').value;
  
  const validacion = validarDocumento(documento);
  if (!validacion.valido) {
    mostrarMensaje('mensajeLogin', validacion.mensaje, 'error');
    return;
  }
  
  mostrarCargando('mensajeLogin');

  if (datosCache.tutoresNorte.length === 0) {
    try {
      await precargarDatosFormulario();
    } catch (error) {
      mostrarMensaje('mensajeLogin', 'Error al cargar los datos del formulario. Por favor intenta de nuevo.', 'error');
      return;
    }
  }

  try {
    const data = await supabaseQuery('estudiantes', {
      eq: { field: 'documento', value: documento }
    });

    if (data.length === 0) {
      mostrarMensaje('mensajeLogin', 'Documento no encontrado. Por favor regístrese primero.', 'error');
      return;
    }

    const estudiante = data[0];
    const nombres = `${estudiante.primer_nombre} ${estudiante.segundo_nombre || ''}`.trim();
    const apellidos = `${estudiante.primer_apellido} ${estudiante.segundo_apellido}`.trim();
    const nombreCompleto = `${nombres} ${apellidos}`;

    datosEstudiante = {
      documento: estudiante.documento,
      nombres: nombres,
      apellidos: apellidos,
      nombreCensurado: censurarNombre(nombreCompleto),
      facultad: estudiante.facultad,
      programa: estudiante.programa,
      sede: estudiante.sede || ''
    };

    formularioEnviandose = false;
    mostrarPantalla('pantallaFormulario');
    document.getElementById('nombreUsuario').textContent = 'Bienvenido(a): ' + datosEstudiante.nombreCensurado;
    document.getElementById('mensajeFormulario').innerHTML = '';
    actualizarBotonCerrarSesion();
    actualizarProgreso(1);

  } catch (error) {
    mostrarMensaje('mensajeLogin', 'Error de conexión: ' + error.message, 'error');
  }
}

// ===================================
// VERIFICACIÓN DE REGISTROS
// ===================================
async function verificarRegistroRecenteConInstructor(documento, instructorSeleccionado) {
  try {
    const ahora = new Date();
    const ahoraColombia = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hace90Minutos = new Date(ahoraColombia.getTime() - (90 * 60 * 1000));
    const hace90MinutosISO = hace90Minutos.toISOString();
    
    const url = `${SUPABASE_URL}/rest/v1/formularios?documento=eq.${documento}&instructor=eq.${encodeURIComponent(instructorSeleccionado)}&fecha=gte.${hace90MinutosISO}&order=fecha.desc`;
    
    const registrosRecientes = await fetchConReintentos(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (registrosRecientes.length === 0) {
      return { puedeRegistrar: true };
    }
    
    const registroMasReciente = registrosRecientes[0];
    const fechaRegistro = new Date(registroMasReciente.fecha);
    const fechaRegistroColombia = new Date(fechaRegistro.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    
    const tiempoTranscurrido = Math.floor((ahoraColombia - fechaRegistroColombia) / (1000 * 60));
    const tiempoRestanteMinutos = 90 - tiempoTranscurrido;
    
    let tiempoRestante;
    if (tiempoRestanteMinutos >= 60) {
      const horas = Math.floor(tiempoRestanteMinutos / 60);
      const minutos = tiempoRestanteMinutos % 60;
      tiempoRestante = minutos > 0 ? `${horas} hora y ${minutos} minutos` : `${horas} hora`;
    } else {
      tiempoRestante = `${tiempoRestanteMinutos} minutos`;
    }
    
    return {
      puedeRegistrar: false,
      tiempoRestante: tiempoRestante,
      instructor: instructorSeleccionado
    };
    
  } catch (error) {
    console.error('Error verificando registro reciente:', error);
    return { puedeRegistrar: true };
  }
}

// ===================================
// GESTIÓN DE INSTRUCTORES Y MATERIAS
// ===================================
function cargarInstructores() {
  const sede = document.getElementById('sedeTutoria').value;
  const tipo = document.getElementById('tipoInstructor').value;

  if (!sede || !tipo) return;

  const grupoFacultad = document.getElementById('grupoFacultadDepartamento');
  const selectFacultad = document.getElementById('facultadDepartamento');
  
  grupoFacultad.classList.add('hidden');
  document.getElementById('grupoInstructor').classList.add('hidden');
  selectFacultad.value = '';
  document.getElementById('instructor').value = '';
  
  selectFacultad.removeAttribute('required');

  if (tipo === 'Tutor') {
    const selectInstructor = document.getElementById('instructor');
    document.getElementById('grupoInstructor').classList.remove('hidden');
    document.getElementById('labelInstructor').textContent = 'Tutor *';

    let instructores = [];
    
    if (sede === 'Virtual') {
      instructores = [...datosCache.tutoresNorte, ...datosCache.tutoresSur];
    } else if (sede === 'Norte') {
      instructores = datosCache.tutoresNorte;
    } else if (sede === 'Sur') {
      instructores = datosCache.tutoresSur;
    }

    const instructoresOrdenados = [...instructores].sort((a, b) => a.nombre.localeCompare(b.nombre));

    selectInstructor.innerHTML = '<option value="">Seleccione un tutor</option>';
    
    const instructoresUnicos = [];
    const nombresVistos = new Set();
    
    instructoresOrdenados.forEach(inst => {
      if (!nombresVistos.has(inst.nombre)) {
        nombresVistos.add(inst.nombre);
        instructoresUnicos.push(inst);
      }
    });
    
    instructoresUnicos.forEach(inst => {
      const option = document.createElement('option');
      option.value = inst.nombre;
      option.textContent = inst.nombre;
      selectInstructor.appendChild(option);
    });
    
    actualizarProgreso(2);
  } else if (tipo === 'Profesor') {
    grupoFacultad.classList.remove('hidden');
    selectFacultad.setAttribute('required', 'required');
    actualizarProgreso(2);
  }
}

function cargarProfesoresPorFacultad() {
  const facultadDepartamento = document.getElementById('facultadDepartamento').value;

  if (!facultadDepartamento) return;

  const selectInstructor = document.getElementById('instructor');
  document.getElementById('grupoInstructor').classList.remove('hidden');
  document.getElementById('labelInstructor').textContent = 'Profesor *';

  const profesores = datosCache.profesores.filter(
    prof => prof.facultad_departamento === facultadDepartamento
  );

  const profesoresOrdenados = [...profesores].sort((a, b) => a.nombre.localeCompare(b.nombre));

  selectInstructor.innerHTML = '<option value="">Seleccione un profesor</option>';
  profesoresOrdenados.forEach(prof => {
    const option = document.createElement('option');
    option.value = prof.nombre;
    option.setAttribute('data-area', prof.area);
    option.textContent = prof.nombre;
    selectInstructor.appendChild(option);
  });
}

function cargarMaterias() {
  const selectInstructor = document.getElementById('instructor');
  const selectedOption = selectInstructor.options[selectInstructor.selectedIndex];
  
  if (!selectedOption || !selectedOption.value) return;

  const instructorNombre = selectedOption.value;
  
  let areasInstructor = [];
  
  if (document.getElementById('tipoInstructor').value === 'Tutor') {
    const sede = document.getElementById('sedeTutoria').value;
    let tutores = [];
    
    if (sede === 'Virtual') {
      tutores = [...datosCache.tutoresNorte, ...datosCache.tutoresSur];
    } else if (sede === 'Norte') {
      tutores = datosCache.tutoresNorte;
    } else if (sede === 'Sur') {
      tutores = datosCache.tutoresSur;
    }
    
    tutores.forEach(tutor => {
      if (tutor.nombre === instructorNombre && !areasInstructor.includes(tutor.area)) {
        areasInstructor.push(tutor.area);
      }
    });
  } else {
    datosCache.profesores.forEach(prof => {
      if (prof.nombre === instructorNombre && !areasInstructor.includes(prof.area)) {
        areasInstructor.push(prof.area);
      }
    });
  }

  instructorActual = { nombre: instructorNombre, areas: areasInstructor };

  document.getElementById('grupoMateria').classList.remove('hidden');

  const materiasFiltradas = datosCache.materias.filter(mat => 
    areasInstructor.includes(mat.area)
  );
  
  const materiasOrdenadas = materiasFiltradas.sort((a, b) => a.materia.localeCompare(b.materia));

  const selectMateria = document.getElementById('asignatura');
  selectMateria.innerHTML = '<option value="">Seleccione una asignatura</option>';
  
  materiasOrdenadas.forEach(mat => {
    const option = document.createElement('option');
    option.value = mat.materia;
    option.textContent = mat.materia;
    selectMateria.appendChild(option);
  });
  
  const optionOtra = document.createElement('option');
  optionOtra.value = 'Otra';
  optionOtra.textContent = 'Otra: ¿Cuál?';
  optionOtra.style.fontWeight = 'bold';
  selectMateria.appendChild(optionOtra);
  
  actualizarProgreso(3);
}

function cargarTemas() {
  const materia = document.getElementById('asignatura').value;
  if (!materia) return;

  const containerAsignatura = document.getElementById('otraAsignaturaContainer');
  const inputAsignatura = document.getElementById('otraAsignatura');
  
  if (materia === 'Otra') {
    containerAsignatura.classList.remove('hidden');
    inputAsignatura.required = true;
    
    document.getElementById('grupoTema').classList.remove('hidden');
    
    const selectTema = document.getElementById('tema');
    selectTema.style.display = 'none';
    selectTema.required = false;
    
    const containerTema = document.getElementById('otroTemaContainer');
    const inputTema = document.getElementById('otroTema');
    containerTema.classList.remove('hidden');
    inputTema.required = true;
    
    const labelTema = document.querySelector('#grupoTema label');
    labelTema.textContent = 'Tema *';
    
    document.getElementById('grupoMotivo').classList.remove('hidden');
    document.getElementById('grupoCalificacion').classList.remove('hidden');
    document.getElementById('grupoSugerencias').classList.remove('hidden');
    document.getElementById('btnEnviar').classList.remove('hidden');
    
    formularioEnviandose = true;
    actualizarBotonCerrarSesion();
    actualizarProgreso(4);
    return;
  } else {
    containerAsignatura.classList.add('hidden');
    inputAsignatura.required = false;
    inputAsignatura.value = '';
  }

  document.getElementById('grupoTema').classList.remove('hidden');

  const temasFiltrados = datosCache.temas.filter(tem => tem.materia === materia);
  
  const selectTema = document.getElementById('tema');
  const containerTema = document.getElementById('otroTemaContainer');
  const inputTema = document.getElementById('otroTema');
  const labelTema = document.querySelector('#grupoTema label');

  if (temasFiltrados.length === 0) {
    selectTema.style.display = 'none';
    selectTema.required = false;
    
    containerTema.classList.remove('hidden');
    inputTema.required = true;
    inputTema.value = '';
    
    labelTema.textContent = 'Tema *';
  } else {
    const temasOrdenados = temasFiltrados.sort((a, b) => a.tema.localeCompare(b.tema));
    
    selectTema.style.display = '';
    selectTema.required = true;
    selectTema.innerHTML = '<option value="">Seleccione un tema</option>';
    
    temasOrdenados.forEach(tem => {
      const option = document.createElement('option');
      option.value = tem.tema;
      option.textContent = tem.tema;
      selectTema.appendChild(option);
    });

    const optionOtro = document.createElement('option');
    optionOtro.value = 'Otro';
    optionOtro.textContent = 'Otro: ¿Cuál?';
    optionOtro.style.fontWeight = 'bold';
    selectTema.appendChild(optionOtro);
    
    containerTema.classList.add('hidden');
    inputTema.required = false;
    inputTema.value = '';
    
    labelTema.textContent = 'Tema de la tutoría *';
  }

  document.getElementById('grupoMotivo').classList.remove('hidden');
  document.getElementById('grupoCalificacion').classList.remove('hidden');
  document.getElementById('grupoSugerencias').classList.remove('hidden');
  document.getElementById('btnEnviar').classList.remove('hidden');
  
  formularioEnviandose = true;
  actualizarBotonCerrarSesion();
  actualizarProgreso(4);
}

// ===================================
// FUNCIONES DE TOGGLE GENÉRICAS
// ===================================
function toggleCondicional(condicion, containerId, inputId, limpiarValor = true) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  
  if (condicion) {
    container.classList.remove('hidden');
    input.required = true;
  } else {
    container.classList.add('hidden');
    input.required = false;
    if (limpiarValor) input.value = '';
  }
}

function toggleOtroTema() {
  const tema = document.getElementById('tema').value;
  toggleCondicional(tema === 'Otro', 'otroTemaContainer', 'otroTema');
}

function toggleTituloCurso() {
  const tipo = document.getElementById('tipoAcompanamiento').value;
  toggleCondicional(tipo === 'Curso y/o capacitación', 'grupoTituloCurso', 'tituloCurso');
}

function toggleSugerencias() {
  const checkbox = document.getElementById('ningunaSugerencia');
  const textarea = document.getElementById('sugerencias');
  
  if (checkbox.checked) {
    textarea.value = 'Ninguna';
    textarea.disabled = true;
  } else {
    textarea.value = '';
    textarea.disabled = false;
  }
}

// ===================================
// FORMULARIO DE TUTORÍA
// ===================================
function actualizarBotonCerrarSesion() {
  const btnCerrar = document.getElementById('btnCancelarFormulario');
  if (btnCerrar) {
    btnCerrar.textContent = 'Cancelar';
    btnCerrar.onclick = confirmarCancelacion;
  }
}

function confirmarCancelacion() {
  mostrarModalConfirmacion(
    '¿Estás seguro que deseas cancelar?',
    'Se perderán todos los datos del formulario que has ingresado.',
    function() {
      cerrarSesion();
    }
  );
}

function mostrarModalConfirmacion(titulo, mensaje, callbackConfirmar) {
  const modal = document.getElementById('modalConfirmacion');
  document.getElementById('tituloConfirmacion').textContent = titulo;
  document.getElementById('mensajeConfirmacion').textContent = mensaje;
  
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  
  document.getElementById('btnConfirmarModal').onclick = function() {
    modal.style.display = 'none';
    modal.classList.add('hidden');
    if (callbackConfirmar) callbackConfirmar();
  };
  
  document.getElementById('btnCancelarModal').onclick = function() {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  };
}

async function guardarFormulario(event) {
  event.preventDefault();
  
  const btnEnviar = document.getElementById('btnEnviar');
  
  const calificacionRadio = document.querySelector('input[name="calificacion"]:checked');
  
  if (!calificacionRadio) {
    const grupoCalificacion = document.getElementById('grupoCalificacion');
    
    if (grupoCalificacion.classList.contains('hidden')) {
      mostrarMensaje('mensajeFormulario', 'Debe completar el formulario hasta la sección de calificación', 'error');
      return;
    }
    
    mostrarMensaje('mensajeFormulario', 'seleccione una calificación para la tutoría', 'error');
    
    setTimeout(() => {
      grupoCalificacion.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }, 100);
    
    setTimeout(() => {
      grupoCalificacion.style.background = '#fff3cd';
      grupoCalificacion.style.padding = '20px';
      grupoCalificacion.style.borderRadius = '8px';
      grupoCalificacion.style.border = '3px solid #ffffffff';
      grupoCalificacion.style.transition = 'all 0.3s';
      grupoCalificacion.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.5)';
      
      setTimeout(() => {
        grupoCalificacion.style.background = '';
        grupoCalificacion.style.padding = '';
        grupoCalificacion.style.border = '';
        grupoCalificacion.style.boxShadow = '';
      }, 2000);
    }, 600);
    
    return;
  }
  
  desactivarBoton(btnEnviar, '⏳ Enviando...');
  mostrarCargando('mensajeFormulario');
  
  const instructorSeleccionado = document.getElementById('instructor').value;
  
  const verificacion = await verificarRegistroRecenteConInstructor(datosEstudiante.documento, instructorSeleccionado);
  
  if (!verificacion.puedeRegistrar) {
    mostrarMensaje('mensajeFormulario', 
      `Ya tienes una tutoría reciente con este tutor. Podrás registrar otra en ${verificacion.tiempoRestante}, o puedes realizarla con otro tutor si lo prefieres.`, 
      'error');
    
    reactivarBoton(btnEnviar, 'Enviar Formulario');
    
    setTimeout(() => {
      const mensajeElement = document.getElementById('mensajeFormulario');
      mensajeElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }, 100);
    
    return;
  }

  let asignatura = document.getElementById('asignatura').value;
  if (asignatura === 'Otra') {
    asignatura = document.getElementById('otraAsignatura').value.trim().toUpperCase();
    if (!asignatura) {
      mostrarMensaje('mensajeFormulario', 'Por favor especifique la asignatura', 'error');
      reactivarBoton(btnEnviar, 'Enviar Formulario');
      return;
    }
  }

  const selectTema = document.getElementById('tema');
  const inputTema = document.getElementById('otroTema');
  let tema = '';

  if (selectTema.value === 'Otro') {
    tema = inputTema.value.trim().toUpperCase();
    if (!tema) {
      mostrarMensaje('mensajeFormulario', 'Por favor especifique el tema', 'error');
      reactivarBoton(btnEnviar, 'Enviar Formulario');
      return;
    }
  } else if (selectTema.style.display === 'none') {
    tema = inputTema.value.trim().toUpperCase();
    if (!tema) {
      mostrarMensaje('mensajeFormulario', 'Por favor ingrese el tema de la tutoría', 'error');
      reactivarBoton(btnEnviar, 'Enviar Formulario');
      return;
    }
  } else {
    tema = selectTema.value;
  }

  const tipoAcompanamiento = document.getElementById('tipoAcompanamiento').value;
  const tituloCurso = tipoAcompanamiento === 'Curso y/o capacitación' 
    ? document.getElementById('tituloCurso').value.toUpperCase() 
    : null;
  
  const ahora = new Date();
  const fechaColombia = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const fechaISO = fechaColombia.toISOString();
  
  const facultadDepartamentoValue = document.getElementById('facultadDepartamento').value || null;
  
  const datos = {
    documento: datosEstudiante.documento,
    nombres: datosEstudiante.nombres,
    apellidos: datosEstudiante.apellidos,
    facultad: datosEstudiante.facultad,
    programa: datosEstudiante.programa,
    semestre: parseInt(document.getElementById('semestre').value),
    grupo: document.getElementById('grupo').value.toUpperCase(),
    tipo_acompanamiento: tipoAcompanamiento,
    titulo_curso: tituloCurso,
    sede_estudiante: datosEstudiante.sede,
    sede_tutoria: document.getElementById('sedeTutoria').value,
    tipo_instructor: document.getElementById('tipoInstructor').value,
    facultad_departamento: facultadDepartamentoValue,
    instructor: instructorSeleccionado,
    asignatura: asignatura,
    tema: tema,
    motivo_consulta: document.getElementById('motivoConsulta').value,
    calificacion: parseInt(calificacionRadio.value),
    sugerencias: document.getElementById('sugerencias').value.toUpperCase() || 'Ninguna',
    fecha: fechaISO
  };

  try {
    await supabaseInsert('formularios', datos);
    
    document.getElementById('mensajeFormulario').innerHTML = '';
    
    const modal = document.getElementById('modalExitoFormulario');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    
    document.getElementById('formTutoria').reset();
    document.getElementById('grupoTituloCurso').classList.add('hidden');



    document.getElementById('grupoFacultadDepartamento').classList.add('hidden');
    document.getElementById('grupoInstructor').classList.add('hidden');
    document.getElementById('grupoMateria').classList.add('hidden');
    document.getElementById('grupoTema').classList.add('hidden');
    document.getElementById('grupoCalificacion').classList.add('hidden');
    document.getElementById('grupoMotivo').classList.add('hidden');
    document.getElementById('grupoSugerencias').classList.add('hidden');
    document.getElementById('btnEnviar').classList.add('hidden');
    formularioEnviandose = false;
    
    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.add('hidden');
      cerrarSesion();
    }, 3000);
  } catch (error) {
    mostrarMensaje('mensajeFormulario', error.message, 'error');
    reactivarBoton(btnEnviar, 'Enviar Formulario');
  }
}

function cerrarSesion() {
  datosEstudiante = null;
  instructorActual = null;
  formularioEnviandose = false;
  
  const btnEnviar = document.getElementById('btnEnviar');
  if (btnEnviar) reactivarBoton(btnEnviar, 'Enviar Formulario');
  
  const btnRegistro = document.getElementById('btnConfirmarRegistro');
  if (btnRegistro) reactivarBoton(btnRegistro, 'Confirmar y Registrarme');
  
  document.querySelectorAll('.progress-step').forEach(step => {
    step.classList.remove('active', 'completed');
  });
  
  const primerPaso = document.getElementById('step1');
  if (primerPaso) {
    primerPaso.classList.add('active');
  }
  
  volverInicio();
}

// ===================================
// ADMINISTRADOR
// ===================================
async function loginAdmin(event) {
  event.preventDefault();
  mostrarCargando('mensajeAdminLogin');

  const documento = document.getElementById('adminDocumento').value;
  const contrasena = document.getElementById('adminContrasena').value;

  try {
    const data = await supabaseQuery('administradores', {
      eq: { field: 'documento', value: documento }
    });

    if (data.length === 0 || data[0].contra !== contrasena) {
      mostrarMensaje('mensajeAdminLogin', 'Acceso denegado.', 'error');
      return;
    }

    document.getElementById('nombreAdmin').textContent = 'Administrador: ' + data[0].nombre;
    mostrarPantalla('pantallaAdmin');
  } catch (error) {
    mostrarMensaje('mensajeAdminLogin', 'Error de conexión: ' + error.message, 'error');
  }
}

async function cambiarTab(event, tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
  ['tabEstadisticas', 'tabGraficas', 'tabDescargas'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  
  const tabMap = {
    'estadisticas': 'tabEstadisticas',
    'graficas': 'tabGraficas',
    'descargas': 'tabDescargas'
  };
  
  document.getElementById(tabMap[tab]).classList.remove('hidden');
  
  switch(tab) {
    case 'estadisticas':
      await cargarDatosEstadisticas();
      break;
    case 'graficas':
      await cargarDatosGraficas();
      break;
  }
}

async function cargarDatosEstadisticas() {
  if (datosCache.tutoresNorte.length === 0) {
    document.getElementById('statsGrid').innerHTML = '<div class="loader"></div><p style="text-align: center; color: #666; margin-top: 15px;">Cargando datos...</p>';
    try {
      await precargarDatosEstadisticas();
    } catch (error) {
      document.getElementById('statsGrid').innerHTML = '<p style="text-align: center; color: #dc3545;">Error al cargar datos. Por favor intenta de nuevo.</p>';
      return;
    }
  }
  
  if (!window.datosFormulariosGlobal) {
    await cargarEstadisticas();
  }
}

async function cargarDatosGraficas() {
  if (!window.datosFormulariosGlobal) {
    const container = document.querySelector('#tabGraficas .chart-container');
    const contenidoOriginal = container.innerHTML;
    container.innerHTML = '<div class="loader"></div><p style="text-align: center; color: #666; margin-top: 15px;">Cargando datos para gráficas...</p>';
    
    try {
      const data = await supabaseQuery('formularios');
      window.datosFormulariosGlobal = data;
      container.innerHTML = contenidoOriginal;
    } catch (error) {
      container.innerHTML = '<p style="text-align: center; color: #dc3545;">Error al cargar datos. Por favor intenta de nuevo.</p>';
      return;
    }
  }
  
  if (!graficoTutorias) {
    actualizarGrafica();
  }
}

async function actualizarEstadisticas() {
  const btnActualizar = document.querySelector('.btn-actualizar');
  
  btnActualizar.disabled = true;
  btnActualizar.style.opacity = '0.6';
  
  try {
    await cargarEstadisticas();
    
    btnActualizar.textContent = '✓';
    
    setTimeout(() => {
      btnActualizar.textContent = '🔄';
    }, 1500);
    
  } catch (error) {
    console.error('Error actualizando estadísticas:', error);
    
    btnActualizar.textContent = '✗';
    
    setTimeout(() => {
      btnActualizar.textContent = '🔄';
    }, 1500);
  } finally {
    btnActualizar.disabled = false;
    btnActualizar.style.opacity = '1';
  }
}

// ===================================
// ESTADÍSTICAS
// ===================================
async function cargarEstadisticas() {
  document.getElementById('statsGrid').innerHTML = '<div class="loader"></div><p style="text-align: center; color: #666; margin-top: 15px;">Cargando estadísticas...</p>';
  document.getElementById('detallesStats').innerHTML = '';
  
  try {
    const data = await supabaseQuery('formularios');

    if (data.length === 0) {
      document.getElementById('statsGrid').innerHTML = '<p style="text-align: center; color: #666;">No hay datos disponibles aún.</p>';
      return;
    }

    const contenidoHTML = `
      <div class="estadisticas-menu-wrapper">
        <button class="btn btn-sede activo" onclick="mostrarEstadisticas('general', this)">
          General
        </button>
        <button class="btn btn-sede" onclick="mostrarEstadisticas('tutores', this)">
          Tutores
        </button>
        <button class="btn btn-sede" onclick="mostrarEstadisticas('profesores', this)">
          Profesores
        </button>
      </div>
      <div id="contenidoEstadisticas"></div>
    `;

    document.getElementById('statsGrid').innerHTML = contenidoHTML;
    document.getElementById('detallesStats').innerHTML = '';

    window.datosFormulariosGlobal = data;

    mostrarEstadisticas('general');

  } catch (error) {
    console.error('Error cargando estadísticas:', error);
    document.getElementById('statsGrid').innerHTML = '<p style="text-align: center; color: #dc3545;">Error al cargar estadísticas. Por favor intenta de nuevo.</p>';
  }

  const ahora = new Date().toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  document.getElementById('statsGrid').insertAdjacentHTML('afterbegin', 
    `<p style="text-align: right; color: #666; font-size: 12px;">
      Última actualización: ${ahora}
    </p>`
  );
}

function mostrarEstadisticas(tipo, botonClickeado) {
  document.querySelectorAll('.estadisticas-menu-wrapper .btn-sede').forEach(btn => {
    btn.classList.remove('activo');
  });
  
  if (botonClickeado) {
    botonClickeado.classList.add('activo');
  } else {
    const btnGeneral = document.querySelector('.estadisticas-menu-wrapper .btn-sede');
    if (btnGeneral) btnGeneral.classList.add('activo');
  }
  
  const data = window.datosFormulariosGlobal;
  
  let datosFiltrados;
  
  if (tipo === 'tutores') {
    datosFiltrados = data.filter(item => item.tipo_instructor === 'Tutor');
  } else if (tipo === 'profesores') {
    datosFiltrados = data.filter(item => item.tipo_instructor === 'Profesor');
  } else {
    datosFiltrados = data;
  }

  if (datosFiltrados.length === 0) {
    document.getElementById('contenidoEstadisticas').innerHTML = `<p style="text-align: center; color: #666;">No hay datos de ${tipo} disponibles aún.</p>`;
    document.getElementById('detallesStats').innerHTML = '';
    return;
  }

  const stats = {
    total: datosFiltrados.length,
    instructoresPorSede: { Norte: {}, Sur: {} },
    sedesTutorias: {},
    calificacionesPorInstructor: {},
    facultadDepartamento: {},
    sumaCalificaciones: 0
  };

  datosFiltrados.forEach(item => {
    const sede = item.sede_tutoria;
    const instructor = item.instructor;
    
    if (!stats.instructoresPorSede[sede]) {
      stats.instructoresPorSede[sede] = {};
    }
    stats.instructoresPorSede[sede][instructor] = (stats.instructoresPorSede[sede][instructor] || 0) + 1;

    stats.sedesTutorias[sede] = (stats.sedesTutorias[sede] || 0) + 1;

    if (!stats.calificacionesPorInstructor[instructor]) {
      stats.calificacionesPorInstructor[instructor] = { suma: 0, cantidad: 0 };
    }
    stats.calificacionesPorInstructor[instructor].suma += item.calificacion;
    stats.calificacionesPorInstructor[instructor].cantidad += 1;

    stats.sumaCalificaciones += item.calificacion;

    if (tipo === 'profesores' && item.facultad_departamento) {
      stats.facultadDepartamento[item.facultad_departamento] = (stats.facultadDepartamento[item.facultad_departamento] || 0) + 1;
    }
  });

  const promedioCalificacion = (stats.sumaCalificaciones / stats.total).toFixed(2);

  const promediosPorInstructor = {};
  Object.keys(stats.calificacionesPorInstructor).forEach(instructor => {
    const info = stats.calificacionesPorInstructor[instructor];
    promediosPorInstructor[instructor] = (info.suma / info.cantidad).toFixed(2);
  });

  let mejorInstructor = { nombre: '', promedio: 0, cantidad: 0 };
  
  Object.keys(stats.calificacionesPorInstructor).forEach(instructor => {
    const info = stats.calificacionesPorInstructor[instructor];
    const promedio = parseFloat((info.suma / info.cantidad).toFixed(2));
    
    if (promedio > mejorInstructor.promedio || 
       (promedio === mejorInstructor.promedio && info.cantidad > mejorInstructor.cantidad)) {
      mejorInstructor = { 
        nombre: instructor, 
        promedio: promedio.toFixed(2),
        cantidad: info.cantidad
      };
    }
  });

  const grid = document.getElementById('contenidoEstadisticas');
  
  if (tipo === 'general') {
    grid.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <h3>${stats.total}</h3>
          <p>Total de Registros</p>
        </div>
        <div class="stat-card">
          <h3>${promedioCalificacion}</h3>
          <p>Calificación Promedio</p>
        </div>
        <div class="stat-card">
          <h3>${mejorInstructor.nombre}</h3>
          <p>Mejor Calificación (${mejorInstructor.promedio})</p>
        </div>
      </div>
    `;
    document.getElementById('detallesStats').innerHTML = '';
    return;
  }

  const tituloTipo = tipo === 'tutores' ? 'Tutorías' : 'Asesorías con Profesores';

  grid.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>${stats.total}</h3>
        <p>Total ${tituloTipo}</p>
      </div>
      <div class="stat-card">
        <h3>${promedioCalificacion}</h3>
        <p>Calificación Promedio</p>
      </div>
      <div class="stat-card">
        <h3>${mejorInstructor.nombre}</h3>
        <p>Mejor Calificación (${mejorInstructor.promedio})</p>
      </div>
    </div>
  `;

  let detalles = '';

  if (tipo === 'tutores') {
    detalles += '<div class="chart-container"><h3 class="chart-title">Cantidad de Tutorías por Sede</h3>';
    Object.entries(stats.sedesTutorias).forEach(([sede, cantidad]) => {
      const porcentaje = ((cantidad / stats.total) * 100).toFixed(1);
      detalles += `<div class="list-item"><span>${sede}</span><strong>${cantidad} (${porcentaje}%)</strong></div>`;
    });
    detalles += '</div>';

    const tutoriasPorInstructor = {};
    datosFiltrados.forEach(item => {
      const instructor = item.instructor;
      tutoriasPorInstructor[instructor] = (tutoriasPorInstructor[instructor] || 0) + 1;
    });

    const tutoresPorSedeOrigen = { Norte: {}, Sur: {} };
    
    if (datosCache.tutoresNorte.length > 0 && datosCache.tutoresSur.length > 0) {
      Object.keys(tutoriasPorInstructor).forEach(instructor => {
        const cantidadTotal = tutoriasPorInstructor[instructor];
        
        const esTutorNorte = datosCache.tutoresNorte.some(t => t.nombre === instructor);
        const esTutorSur = datosCache.tutoresSur.some(t => t.nombre === instructor);
        
        if (esTutorNorte) {
          tutoresPorSedeOrigen.Norte[instructor] = cantidadTotal;
        }
        if (esTutorSur) {
          tutoresPorSedeOrigen.Sur[instructor] = cantidadTotal;
        }
      });
    }

    detalles += `<div class="chart-container">
      <h3 class="chart-title">Cantidad de Tutorías por Tutor</h3>
      
      <div class="botones-sedes">
        <button class="btn btn-secondary btn-sede" onclick="toggleInstructoresSede('norte')">
          Sede Norte
        </button>
        <button class="btn btn-secondary btn-sede" onclick="toggleInstructoresSede('sur')">
          Sede Sur
        </button>
      </div>

      <div id="instructoresNorteAdmin" class="horario-info hidden">
        <h4 class="horario-titulo">Tutores de Sede Norte</h4>`;
    
    const instructoresNorte = Object.entries(tutoresPorSedeOrigen.Norte)
      .sort((a, b) => b[1] - a[1]);
    
    if (instructoresNorte.length > 0) {
      instructoresNorte.forEach(([instructor, cantidad]) => {
        const promedio = promediosPorInstructor[instructor] || 'N/A';
        detalles += `<div class="list-item">
          <span>${instructor}</span>
          <strong>${cantidad} tutoría${cantidad !== 1 ? 's' : ''}<br><span style="font-size: 12px; font-weight: normal;">Calificación: ${promedio}</span></strong>
        </div>`;
      });
    } else {
      detalles += '<p style="text-align: center; color: #666;">No hay tutores registrados en Sede Norte</p>';
    }
    
    detalles += `</div>

      <div id="instructoresSurAdmin" class="horario-info hidden">
        <h4 class="horario-titulo">Tutores de Sede Sur</h4>`;
    
    const instructoresSur = Object.entries(tutoresPorSedeOrigen.Sur)
      .sort((a, b) => b[1] - a[1]);
    
    if (instructoresSur.length > 0) {
      instructoresSur.forEach(([instructor, cantidad]) => {
        const promedio = promediosPorInstructor[instructor] || 'N/A';
        detalles += `<div class="list-item">
          <span>${instructor}</span>
          <strong>${cantidad} tutoría${cantidad !== 1 ? 's' : ''}<br><span style="font-size: 12px; font-weight: normal;">Calificación: ${promedio}</span></strong>
        </div>`;
      });
    } else {
      detalles += '<p style="text-align: center; color: #666;">No hay tutores registrados en Sede Sur</p>';
    }
    
    detalles += '</div></div>';
  }

  if (tipo === 'profesores') {
    detalles += '<div class="chart-container"><h3 class="chart-title">Cantidad de Asesorías por Facultad/Departamento</h3>';
    
    const facultadesOrdenadas = Object.entries(stats.facultadDepartamento)
      .sort((a, b) => b[1] - a[1]);
    
    if (facultadesOrdenadas.length > 0) {
      facultadesOrdenadas.forEach(([facultad, cantidad]) => {
        const nombreCompleto = obtenerNombreFacultad(facultad);
        const porcentaje = ((cantidad / stats.total) * 100).toFixed(1);
        detalles += `<div class="list-item"><span>${nombreCompleto}</span><strong>${cantidad} (${porcentaje}%)</strong></div>`;
      });
    } else {
      detalles += '<p style="text-align: center; color: #666;">No hay datos por facultad</p>';
    }
    
    detalles += '</div>';

    detalles += `<div class="chart-container">
      <h3 class="chart-title">Cantidad de Asesorías por Profesor</h3>`;

    const profesoresPorFacultad = {};
    
    datosFiltrados.forEach(item => {
      const facultad = item.facultad_departamento || 'Sin Facultad';
      const profesor = item.instructor;
      
      if (!profesoresPorFacultad[facultad]) {
        profesoresPorFacultad[facultad] = {};
      }
      
      profesoresPorFacultad[facultad][profesor] = (profesoresPorFacultad[facultad][profesor] || 0) + 1;
    });

    const facultadesConProfesores = Object.keys(profesoresPorFacultad).sort();
    
    if (facultadesConProfesores.length > 0) {
      detalles += '<div class="botones-sedes">';
      
      facultadesConProfesores.forEach(facultad => {
        const facultadId = facultad.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const nombreCompleto = obtenerNombreFacultad(facultad);
        const facultadCorta = nombreCompleto.replace('Facultad de ', '').replace('Departamento de ', '');
        detalles += `
          <button class="btn btn-secondary btn-sede" onclick="toggleProfesoresFacultad('${facultadId}')">
            ${facultadCorta}
          </button>`;
      });
      
      detalles += '</div>';

      facultadesConProfesores.forEach(facultad => {
        const facultadId = facultad.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const profesores = profesoresPorFacultad[facultad];
        const profesoresOrdenados = Object.entries(profesores).sort((a, b) => b[1] - a[1]);
        
        const nombreCompletoTitulo = obtenerNombreFacultad(facultad);
        detalles += `
          <div id="profesores${facultadId}" class="horario-info hidden">
            <h4 class="horario-titulo">${nombreCompletoTitulo}</h4>`;
        
        if (profesoresOrdenados.length > 0) {
          profesoresOrdenados.forEach(([profesor, cantidad]) => {
            const promedio = promediosPorInstructor[profesor] || 'N/A';
            detalles += `<div class="list-item">
              <span>${profesor}</span>
              <strong>${cantidad} asesorías<br><span style="font-size: 12px; font-weight: normal;">Calificación: ${promedio}</span></strong>
            </div>`;
          });
        } else {
          detalles += '<p style="text-align: center; color: #666;">No hay profesores en esta facultad</p>';
        }
        
        detalles += '</div>';
      });
    } else {
      detalles += '<p style="text-align: center; color: #666;">No hay datos de profesores disponibles</p>';
    }
    
    detalles += '</div>';
  }

  document.getElementById('detallesStats').innerHTML = detalles;
}

// ===================================
// DESCARGAS Y EXCEL
// ===================================
async function descargarDatos() {
  const fechas = validarRangoFechas();
  if (!fechas) return;
  
  const { desde, hasta } = fechas;

  const btnDescarga = event.target;
  const textoOriginal = btnDescarga.textContent;
  desactivarBoton(btnDescarga, '⏳ Preparando descarga...');

  try {
    let url = `${SUPABASE_URL}/rest/v1/formularios?fecha=gte.${desde}T00:00:00&fecha=lte.${hasta}T23:59:59&order=fecha.asc`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    const data = await response.json();
    const datosTutores = data.filter(item => item.tipo_instructor === 'Tutor');
    
    if (datosTutores.length === 0) {
      alert('No hay registros de tutores en el rango de fechas seleccionado');
      return;
    }

    generarExcelSimplificado(datosTutores, `PMA_Tutores_${desde}_a_${hasta}`);
    alert(`${datosTutores.length} registros de tutores descargados exitosamente`);
  } catch (error) {
    alert('Error al descargar datos: ' + error.message);
  } finally {
    reactivarBoton(btnDescarga, textoOriginal);
  }
}

async function descargarTodo() {
  if (!confirm('¿Descargar todos los registros?')) {
    return;
  }

  const btnDescarga = event.target;
  const textoOriginal = btnDescarga.textContent;
  desactivarBoton(btnDescarga, '⏳ Preparando descarga completa...');

  try {
    const data = await supabaseQuery('formularios', { order: 'fecha.asc' });
    
    if (data.length === 0) {
      alert('No hay registros para descargar');
      return;
    }

    generarExcelCompleto(data, 'PMA_Completo');
    alert(`${data.length} registros descargados exitosamente`);
  } catch (error) {
    alert('Error al descargar datos: ' + error.message);
  } finally {
    reactivarBoton(btnDescarga, textoOriginal);
  }
}

async function descargarDocentes() {
  const fechas = validarRangoFechas();
  if (!fechas) return;
  
  const { desde, hasta } = fechas;

  const btnDescarga = event.target;
  const textoOriginal = btnDescarga.textContent;
  desactivarBoton(btnDescarga, '⏳ Preparando descarga...');

  try {
    let url = `${SUPABASE_URL}/rest/v1/formularios?fecha=gte.${desde}T00:00:00&fecha=lte.${hasta}T23:59:59&order=fecha.asc`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    const data = await response.json();
    const datosDocentes = data.filter(item => item.tipo_instructor === 'Profesor');
    
    if (datosDocentes.length === 0) {
      alert('No hay registros de docentes en el rango de fechas seleccionado');
      return;
    }

    generarExcelDocentes(datosDocentes, `PMA_Docentes_${desde}_a_${hasta}`);
    alert(`${datosDocentes.length} registros de docentes descargados exitosamente`);
  } catch (error) {
    alert('Error al descargar datos: ' + error.message);
  } finally {
    reactivarBoton(btnDescarga, textoOriginal);
  }
}

function generarExcelSimplificado(datos, nombreArchivo) {
  const datosExcel = datos.map(fila => {
    const { serialDate, horaFormateada } = convertirFechaAColombia(fila.fecha);
    
    return {
      'Fecha': serialDate,
      'Hora': horaFormateada,
      'Documento': parseInt(fila.documento),
      'Nombres': fila.nombres,
      'Apellidos': fila.apellidos,
      'Programa': fila.programa,
      'Instructor': fila.instructor,
      'Asignatura': fila.asignatura,
      'Tema': fila.tema
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datosExcel);

  const range = XLSX.utils.decode_range(ws['!ref']);
  aplicarFormatoExcel(ws, range);

  ws['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
    { wch: 35 }, { wch: 25 }, { wch: 30 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Tutores");

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${nombreArchivo}_${fechaHoy}.xlsx`);
}

function generarExcelCompleto(datos, nombreArchivo) {
  const datosExcel = datos.map(fila => {
    const { serialDate, horaFormateada } = convertirFechaAColombia(fila.fecha);
    
    return {
      'Fecha': serialDate,
      'Hora': horaFormateada,
      'Documento': parseInt(fila.documento),
      'Nombres': fila.nombres,
      'Apellidos': fila.apellidos,
      'Facultad': fila.facultad,
      'Programa': fila.programa,
      'Semestre': fila.semestre,
      'Grupo': fila.grupo,
      'Tipo Acompañamiento': fila.tipo_acompanamiento || 'Tutoría',
      'Título Curso': fila.titulo_curso || '',
      'Sede Estudiante': fila.sede_estudiante || '',
      'Sede Tutoría': fila.sede_tutoria,
      'Tipo Instructor': fila.tipo_instructor,
      'Facultad/Departamento': fila.facultad_departamento || '',
      'Instructor': fila.instructor,
      'Asignatura': fila.asignatura,
      'Tema': fila.tema,
      'Motivo Consulta': fila.motivo_consulta || '',
      'Calificación': fila.calificacion,
      'Sugerencias': fila.sugerencias || ''
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datosExcel);

  const range = XLSX.utils.decode_range(ws['!ref']);
  aplicarFormatoExcel(ws, range);

  ws['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
    { wch: 35 }, { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
    { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 },
    { wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 40 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Registros Completos");

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${nombreArchivo}_${fechaHoy}.xlsx`);
}

function generarExcelDocentes(datos, nombreArchivo) {
  const datosExcel = datos.map(fila => {
    const { serialDate, horaFormateada } = convertirFechaAColombia(fila.fecha);
    
    return {
      'Fecha': serialDate,
      'Hora': horaFormateada,
      'Documento': parseInt(fila.documento),
      'Nombres': fila.nombres,
      'Apellidos': fila.apellidos,
      'Programa': fila.programa,
      'Facultad/Departamento': fila.facultad_departamento || '',
      'Instructor': fila.instructor,
      'Asignatura': fila.asignatura,
      'Tema': fila.tema
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datosExcel);

  const range = XLSX.utils.decode_range(ws['!ref']);
  aplicarFormatoExcel(ws, range);

  ws['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
    { wch: 35 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Docentes");

  const fechaHoy = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${nombreArchivo}_${fechaHoy}.xlsx`);
}

function cerrarSesionAdmin() {
  volverInicio();
}

// ===================================
// ACTUALIZAR INDICADOR DE PROGRESO
// ===================================
function actualizarProgreso(paso) {
  document.querySelectorAll('.progress-step').forEach(step => {
    step.classList.remove('active');
  });
  
  for (let i = 1; i < paso; i++) {
    document.getElementById(`step${i}`).classList.add('completed');
  }
  
  document.getElementById(`step${paso}`).classList.add('active');
}

// ===================================
// TOGGLE DE SECCIONES ADMIN
// ===================================
function toggleSeccionUnica(seccionesIds, seccionSeleccionada) {
  seccionesIds.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  
  const elemento = document.getElementById(seccionSeleccionada);
  if (elemento) {
    elemento.classList.toggle('hidden');
  }
}

function toggleInstructoresSede(sede) {
  const sedeMap = {
    'norte': 'instructoresNorteAdmin',
    'sur': 'instructoresSurAdmin'
  };
  
  toggleSeccionUnica(
    ['instructoresNorteAdmin', 'instructoresSurAdmin'],
    sedeMap[sede]
  );
}

function toggleProfesoresFacultad(facultadId) {
  const todasLasSecciones = document.querySelectorAll('[id^="profesores"]');
  todasLasSecciones.forEach(seccion => seccion.classList.add('hidden'));
  
  const seccionActual = document.getElementById('profesores' + facultadId);
  if (seccionActual) {
    seccionActual.classList.toggle('hidden');
  }
}

// ===================================
// FUNCIONES AUXILIARES
// ===================================
function obtenerNombreFacultad(codigo) {
  return NOMBRES_FACULTADES[codigo] || codigo;
}

function togglePassword() {
  const input = document.getElementById('adminContrasena');
  const button = input.nextElementSibling;
  
  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '--';
  } else {
    input.type = 'password';
    button.textContent = '👁️';
  }
}

function toggleUsername() {
  const input = document.getElementById('adminDocumento');
  const button = input.nextElementSibling;
  
  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '--';
  } else {
    input.type = 'password';
    button.textContent = '👁️';
  }
}

// ===================================
// GRÁFICAS
// ===================================
function actualizarGrafica() {
  const periodo = document.getElementById('filtroGraficaPeriodo').value;
  const tipoInstructor = document.getElementById('filtroGraficaTipo').value;
  
  const data = window.datosFormulariosGlobal;
  if (!data || data.length === 0) return;
  
  let datosFiltrados = data;
  if (tipoInstructor !== 'todos') {
    datosFiltrados = data.filter(item => item.tipo_instructor === tipoInstructor);
  }
  
  if (datosFiltrados.length === 0) {
    if (graficoTutorias) {
      graficoTutorias.destroy();
    }
    const ctx = document.getElementById('graficaTutorias').getContext('2d');
    graficoTutorias = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Sin datos'],
        datasets: [{
          label: 'Cantidad de tutorías',
          data: [0],
          backgroundColor: 'rgba(30, 60, 114, 0.7)',
          borderColor: 'rgba(30, 60, 114, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
    return;
  }
  
  let labels = [];
  let valores = [];
  
  if (periodo === 'semanal') {
    const fechas = datosFiltrados.map(item => new Date(item.fecha));
    const fechaMin = new Date(Math.min(...fechas));
    const fechaMax = new Date(Math.max(...fechas));
    
    function obtenerDomingo(fecha) {
      const dia = fecha.getDay();
      const diff = fecha.getDate() - dia;
      const domingo = new Date(fecha);
      domingo.setDate(diff);
      domingo.setHours(0, 0, 0, 0);
      return domingo;
    }
    
    let domingoActual = obtenerDomingo(fechaMin);
    
    const semanas = {};
    
    while (domingoActual <= fechaMax) {
      const sabado = new Date(domingoActual);
      sabado.setDate(sabado.getDate() + 6);
      sabado.setHours(23, 59, 59, 999);
      
      const diaD = String(domingoActual.getDate()).padStart(2, '0');
      const mesD = String(domingoActual.getMonth() + 1).padStart(2, '0');
      
      const diaS = String(sabado.getDate()).padStart(2, '0');
      const mesS = String(sabado.getMonth() + 1).padStart(2, '0');
      
      const label = `${diaD}/${mesD} - ${diaS}/${mesS}`;
      
      const cantidad = datosFiltrados.filter(item => {
        const fechaItem = new Date(item.fecha);
        return fechaItem >= domingoActual && fechaItem <= sabado;
      }).length;
      
      semanas[label] = cantidad;
      
      domingoActual = new Date(domingoActual);
      domingoActual.setDate(domingoActual.getDate() + 7);
    }
    
    labels = Object.keys(semanas);
    valores = Object.values(semanas);
    
  } else if (periodo === 'mensual') {
    const meses = {};
    const nombresMesesCortos = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    
    datosFiltrados.forEach(item => {
      const fecha = new Date(item.fecha);
      const mes = fecha.getMonth();
      const año = fecha.getFullYear();
      const claveMes = `${año}-${String(mes + 1).padStart(2, '0')}`;
      const labelMes = `${nombresMesesCortos[mes]} ${año}`;
      
      if (!meses[claveMes]) {
        meses[claveMes] = {
          label: labelMes,
          cantidad: 0
        };
      }
      
      meses[claveMes].cantidad++;
    });
    
    const clavesMesesOrdenadas = Object.keys(meses).sort();
    
    labels = clavesMesesOrdenadas.map(clave => meses[clave].label);
    valores = clavesMesesOrdenadas.map(clave => meses[clave].cantidad);
  }
  
  if (graficoTutorias) {
    graficoTutorias.destroy();
  }
  
  const ctx = document.getElementById('graficaTutorias').getContext('2d');
  graficoTutorias = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cantidad de tutorías',
        data: valores,
        backgroundColor: 'rgba(30, 60, 114, 0.7)',
        borderColor: 'rgba(30, 60, 114, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.parsed.y + ' tutoría' + (context.parsed.y !== 1 ? 's' : '');
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
}

// ===================================
// INICIALIZACIÓN DEL SISTEMA
// ===================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('Sistema PMA con Supabase iniciado');
  console.log('Los datos se cargarán solo cuando sean necesarios.');
  
  const calificaciones = document.querySelectorAll('input[name="calificacion"]');
  calificaciones.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        const step4 = document.getElementById('step4');
        step4.classList.add('completed');
        step4.classList.remove('active');
      }
    });
  });
});
