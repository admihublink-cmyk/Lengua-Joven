const CURP_REGEX = /^[A-Z][AEIOU][A-Z]{2}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/

const ESTADOS = {
  AS:'Aguascalientes', BC:'Baja California', BS:'Baja California Sur',
  CC:'Campeche', CS:'Chiapas', CH:'Chihuahua', DF:'Ciudad de México',
  CL:'Coahuila', CM:'Colima', DG:'Durango', GR:'Guerrero',
  GT:'Guanajuato', HG:'Hidalgo', JC:'Jalisco', MC:'México',
  MN:'Michoacán', MS:'Morelos', NT:'Nayarit', NL:'Nuevo León',
  OC:'Oaxaca', PL:'Puebla', QT:'Querétaro', QR:'Quintana Roo',
  SP:'San Luis Potosí', SL:'Sinaloa', SR:'Sonora', TC:'Tabasco',
  TL:'Tlaxcala', TS:'Tamaulipas', VZ:'Veracruz', YN:'Yucatán',
  ZS:'Zacatecas', NE:'Nacido en el Extranjero',
}

function parsearCURP(curp) {
  if (!curp || typeof curp !== 'string') return { valido: false, error: 'CURP vacío' }
  const c = curp.toUpperCase().trim()
  if (c.length !== 18) return { valido: false, error: 'CURP debe tener 18 caracteres' }
  if (!CURP_REGEX.test(c)) return { valido: false, error: 'Formato de CURP inválido' }

  const yy = parseInt(c.slice(4, 6), 10)
  const mm = parseInt(c.slice(6, 8), 10)
  const dd = parseInt(c.slice(8, 10), 10)

  // Posición 16 (homoclave): dígito → nacido 1900-1999, letra → 2000+
  const homoclave = c[16]
  const siglo = /[A-Z]/.test(homoclave) ? 2000 : 1900
  const yyyy = siglo + yy

  const sexo = c[10] === 'H' ? 'masculino' : 'femenino'
  const claveEstado = c.slice(11, 13)
  const estadoNacimiento = ESTADOS[claveEstado] || claveEstado

  const fechaNacimiento = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`

  // Calcular edad exacta
  const hoy = new Date()
  const nacimiento = new Date(yyyy, mm - 1, dd)
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const cumple = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate())
  if (hoy < cumple) edad--
  const esMenorEdad = edad < 18

  return { valido: true, fechaNacimiento, esMenorEdad, edad, sexo, estadoNacimiento }
}

module.exports = { parsearCURP }
