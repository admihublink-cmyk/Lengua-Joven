const router = require('express').Router()
const { query, queryOne, run } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const path = require('path')
const fs = require('fs')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, VerticalAlign, HeadingLevel,
  PageOrientation, convertInchesToTwip, ShadingType, UnderlineType,
  ImageRun, Header
} = require('docx')

const APORTACION_INJUVE = 200

function celda(text, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text ?? ''),
        bold: opts.bold ?? false,
        size: opts.size ?? 20,
        color: opts.color || '000000',
        font: 'Arial',
      })]
    })],
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.shade ? { type: ShadingType.SOLID, color: '1F3864', fill: '1F3864' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    columnSpan: opts.span,
  })
}

function celdaEncabezado(text, span) {
  return new TableCell({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })]
    })],
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.SOLID, color: '1F3864', fill: '1F3864' },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    columnSpan: span,
  })
}

function tablaOferta(idioma, filas) {
  const encabezados = ['Categoría de grupo', 'Edades', 'Costo del curso\nLengua Joven', 'Aportación a\nINJUVE', 'Costo final\npara el alumno']
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80 },
    rows: [
      new TableRow({ children: [celdaEncabezado(`MODALIDAD — ${idioma.toUpperCase()}`, 5)] }),
      new TableRow({
        children: encabezados.map(h => new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })] })],
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.SOLID, color: '2E5493', fill: '2E5493' },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }))
      }),
      ...filas.map(f => {
        const costoFinal = Number(f.costo || 0)
        const costoLJ = Math.max(0, costoFinal - APORTACION_INJUVE)
        return new TableRow({
          children: [
            celda(f.categoria, { center: true }),
            celda(f.edades, { center: true }),
            celda(`$${costoLJ.toLocaleString('es-MX')}`, { center: true }),
            celda(`$${APORTACION_INJUVE.toLocaleString('es-MX')}`, { center: true }),
            celda(`$${costoFinal.toLocaleString('es-MX')}`, { center: true, bold: true }),
          ]
        })
      })
    ]
  })
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 200 },
    indent: opts.indent ? { firstLine: convertInchesToTwip(0.5) } : undefined,
    children: [new TextRun({
      text,
      bold: opts.bold ?? false,
      size: opts.size ?? 22,
      font: 'Arial',
      underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
    })]
  })
}

const { puedeVerPlantel } = require('../middleware/auth')

router.get('/:id/generar-convenio', requireAuth, async (req, res) => {
  if (!['superadmin', 'director', 'coordinador'].includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' })
  if (!puedeVerPlantel(req.user, req.params.id)) return res.status(403).json({ error: 'Sin permiso' })

  const plantel = await queryOne('SELECT * FROM planteles WHERE id = $1', [req.params.id])
  if (!plantel) return res.status(404).json({ error: 'Plantel no encontrado' })

  const razonSocial = plantel.razon_social || '[RAZÓN SOCIAL DE LA INSTITUCIÓN]'
  const representante = plantel.representante_legal || '[Nombre del representante legal]'
  const rfc = plantel.rfc || '[RFC]'
  const domicilio = plantel.domicilio_fiscal || '[Domicilio fiscal de la institución]'
  const tipoPersona = plantel.tipo_persona === 'fisica' ? 'persona física' : 'Sociedad de Responsabilidad Limitada de Capital Variable'
  const proveedorNombre = plantel.proveedor_nombre || plantel.nombre
  const fechaHoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const anio = new Date().getFullYear()

  const logoPath = path.join(__dirname, '../assets/injuve_logo.png')
  const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null

  // Obtener idiomas del plantel
  const idiomas = await query('SELECT DISTINCT nombre FROM idiomas WHERE plantel_id = $1 ORDER BY nombre', [plantel.id])

  // Obtener oferta educativa del proveedor
  const ofertaRaw = await query(`
    SELECT idioma, categoria, edades, costo, modalidad
    FROM ofertas
    WHERE proveedor LIKE $1
    ORDER BY idioma, categoria
  `, [`%${proveedorNombre}%`])

  // Agrupar por idioma+modalidad → una tabla por combinación
  const porIdiomaModalidad = {}
  if (ofertaRaw.length > 0) {
    for (const o of ofertaRaw) {
      const key = `${o.idioma}___${o.modalidad || 'Presencial'}`
      if (!porIdiomaModalidad[key]) porIdiomaModalidad[key] = { idioma: o.idioma, modalidad: o.modalidad || 'Presencial', cats: {} }
      if (!porIdiomaModalidad[key].cats[o.categoria]) {
        porIdiomaModalidad[key].cats[o.categoria] = { categoria: o.categoria, edades: o.edades, costo: o.costo }
      }
    }
  } else {
    // Fallback: usar idiomas del plantel con precios de la config
    const cfg = await queryOne("SELECT value FROM config WHERE key = 'costo_inscripcion'", [])
    const costo = cfg ? parseFloat(cfg.value) || 1500 : 1500
    for (const idm of idiomas) {
      const key = `${idm.nombre}___Presencial`
      porIdiomaModalidad[key] = {
        idioma: idm.nombre,
        modalidad: 'Presencial',
        cats: {
          'Jóvenes': { categoria: 'Jóvenes', edades: '16-29 años', costo },
          'Plus': { categoria: 'Plus', edades: '30 en adelante', costo },
        }
      }
    }
  }

  const tablasIdioma = Object.values(porIdiomaModalidad).map(({ idioma, modalidad, cats }) =>
    tablaOferta(`${idioma} — ${modalidad}`, Object.values(cats))
  )

  const idiomasTexto = idiomas.map(i => i.nombre).join(', ') || 'inglés'
  const nivelesTexto = '14 niveles por idioma'

  const doc = new Document({
    sections: [{
      properties: {},
      headers: logoBuffer ? {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 200 },
              children: [
                new ImageRun({
                  data: logoBuffer,
                  transformation: { width: 160, height: 60 },
                }),
              ],
            }),
          ],
        }),
      } : undefined,
      children: [
        p(`CONVENIO /DG/INJUVE/${String(anio).slice(-4)}/2026`, { center: true, bold: true, size: 24 }),
        p(''),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 240 },
          children: [
            new TextRun({ text: 'Convenio de Colaboración en Materia Educativa denominado "Lengua Joven" que celebran por una parte el ', size: 22, font: 'Arial' }),
            new TextRun({ text: 'Instituto Estatal de la Juventud del Estado de Nuevo León', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: `, representado por el C. EDELMI SÁNCHEZ GARZA, en su carácter de Director General del mismo, a quien en adelante se le denominará "EL INJUVE" y por otra parte `, size: 22, font: 'Arial' }),
            new TextRun({ text: razonSocial, bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: `, representada por ${representante}, a quien en adelante se denominará "LA INSTITUCIÓN", al tenor de las siguientes:`, size: 22, font: 'Arial' }),
          ]
        }),
        p('B A S E S', { center: true, bold: true, underline: true }),
        p('Que "EL INJUVE" tiene por objeto de conformidad con lo dispuesto por el artículo 4 de la Ley del Instituto Estatal de la Juventud, fracción II.- Planear, Diseñar, Desarrollar, Ejecutar, Impulsar, Coordinar y Evaluar políticas, programas y acciones de apoyo a la juventud del Estado de Nuevo León, para lograr su pleno desarrollo e integración en el ámbito familiar, social, económico, político y cultural.', { indent: true }),
        p('Es así, que en cumplimiento al objetivo encaminado "EL INJUVE" implementó el programa denominado "PRO-EDUCACIÓN" y asimismo su línea de acción "LENGUA JOVEN" enfocado en incrementar las oportunidades de acceso de la población joven en el Estado de Nuevo León al aprendizaje del idioma inglés y otros idiomas.', { indent: true }),
        p('Lo que en cumplimiento al citado objetivo se formaliza el presente instrumento jurídico.', { indent: true }),
        p(''),
        p('DECLARAN LAS PARTES:', { bold: true, underline: true }),
        p('I.- Declara "EL INJUVE"', { bold: true }),
        p('I.1.- Que en fecha 24 de diciembre del año 2003, se publicó en el periódico oficial del estado de Nuevo León, el decreto número 38, mediante la cual se expide la Ley del Instituto Estatal de la Juventud.'),
        p('I.2.- Que de acuerdo con el nombramiento expedido en fecha 05 de julio del año 2024, mediante oficio número 109-A/2024, signado por el C. Dr. Samuel Alejandro García Sepúlveda, gobernador del Estado de Nuevo León, fue designado como Director General del "INJUVE" el C. Edelmi Sánchez Garza.'),
        p('I.3.- Que para los efectos del presente acto jurídico, señala como domicilio legal para oír y recibir notificaciones, la sede del mismo, ubicado en Washington No. 2000, Col. Mitras Centro, CP. 64460, Monterrey, Nuevo León.'),
        p(`I.4.- Que cuenta con el registro federal de contribuyente IEJ031009K92, expedido por el Servicio de Administración Tributaria.`),
        p('II.- Declara "LA INSTITUCIÓN"', { bold: true }),
        p(`II.1.- Que es una ${tipoPersona}, que tiene como parte de su objeto llevar a cabo por cuenta propia o de terceros la impartición de clases y cursos de idiomas.`),
        p(`II.2.- Que su representación la tiene ${representante}, quien manifiesta que tiene el poder y la capacidad legal suficiente para celebrar el presente convenio.`),
        p(`II.3.- "LA INSTITUCIÓN" tiene como domicilio para los efectos de oír y recibir notificaciones el ubicado en ${domicilio}.`),
        p(`II.4.- Que cuenta con el Registro Federal de Contribuyente ${rfc}, expedido por el Servicio de Administración Tributaria.`),
        p('III.- Declaran las Partes:', { bold: true }),
        p('En virtud de lo anterior, las partes se reconocen mutuamente la personalidad con la que comparecen a celebrar el presente convenio de colaboración en materia educativa y se comprometen a cumplir los objetivos establecidos en el mismo.'),
        p(''),
        p('C L Á U S U L A S', { center: true, bold: true, underline: true }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'PRIMERA.- OBJETO.  ', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: `El presente convenio tiene por objeto establecer entre "EL INJUVE" y "LA INSTITUCIÓN" un programa de colaboración en materia de educación, denominado "Lengua Joven".`, size: 22, font: 'Arial' }),
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'SEGUNDA.- GESTIÓN DE ESTABLECIMIENTO.  ', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: '"EL INJUVE" se compromete a realizar las gestiones necesarias con las escuelas públicas y privadas del Estado de Nuevo León, para acordar el uso de sus instalaciones para la impartición de cursos de idiomas dentro del programa "Lengua Joven".', size: 22, font: 'Arial' }),
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'TERCERA.- OBLIGACIONES.  ', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: `"LA INSTITUCIÓN" se obliga a impartir las clases de los idiomas ${idiomasTexto} en ${nivelesTexto}, con docentes calificados, en los planteles que "EL INJUVE" designe. La oferta educativa y costos son los siguientes:`, size: 22, font: 'Arial' }),
          ]
        }),
        p(''),
        ...tablasIdioma.flatMap(t => [t, p('')]),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'CUARTA.- PLAZO DE EJECUCIÓN.  ', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: `"LA INSTITUCIÓN" se obliga a iniciar los servicios objeto del presente convenio, a partir del día ${fechaHoy}.`, size: 22, font: 'Arial' }),
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'QUINTA.- MATERIAL DIDÁCTICO.  ', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: 'Queda establecido que el material didáctico no aplica dentro del pago de colegiatura y de cuota para los gastos de administración y operación del programa. Su costo es independiente y es responsabilidad del alumno cubrirlo.', size: 22, font: 'Arial' }),
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: `SEXTA.- DIFUSIÓN.  `, bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: '"EL INJUVE" se compromete a difundir el programa objeto del presente convenio a través de sus medios informativos impresos, redes sociales y radio.', size: 22, font: 'Arial' }),
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'SÉPTIMA.- VIGENCIA DEL CONVENIO.  ', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: `Las partes manifiestan que el presente convenio tendrá una vigencia al 31 de diciembre del ${anio}, sin embargo, por voluntad de cualquiera de las partes podrá darse por terminado con 30 días de anticipación mediante aviso por escrito.`, size: 22, font: 'Arial' }),
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'OCTAVA.- RELACIÓN LABORAL.  ', bold: true, size: 22, font: 'Arial' }),
            new TextRun({ text: '"LAS PARTES" acuerdan que el personal que comisionen, asignen o contraten para el desarrollo de las estrategias y acciones que les correspondan, según lo pactado en el presente instrumento, estará bajo la dirección y responsabilidad directa de la parte que lo haya comisionado, asignado o contratado y, por consiguiente, en ningún caso se generarán relaciones de carácter laboral entre las partes.', size: 22, font: 'Arial' }),
          ]
        }),
        p('Enteradas las partes del alcance y contenido del presente convenio, manifiestan que no existe impedimento legal o vicio alguno de voluntad que invalide el presente acto jurídico, firmando de conformidad en la ciudad de Monterrey, Nuevo León, a los ' + fechaHoy + '.'),
        p(''),
        p(''),
        // Tabla de firmantes principales
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top:     { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            bottom:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            left:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          rows: [
            // Fila 1: nombre de la organización
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'INSTITUTO ESTATAL DE LA JUVENTUD', bold: true, size: 22, font: 'Arial' })] })],
                  margins: { top: 200, bottom: 0, left: 200, right: 200 },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
                new TableCell({
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: razonSocial.toUpperCase(), bold: true, size: 22, font: 'Arial' })] })],
                  margins: { top: 200, bottom: 0, left: 200, right: 200 },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
              ]
            }),
            // Fila 2: espacio en blanco para firma
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ spacing: { after: 1800 }, children: [new TextRun({ text: '', size: 22, font: 'Arial' })] })],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
                new TableCell({
                  children: [new Paragraph({ spacing: { after: 1800 }, children: [new TextRun({ text: '', size: 22, font: 'Arial' })] })],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
              ]
            }),
            // Fila 3: nombre y cargo
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'MTRO. EDELMIRO CAVAZOS VALDÉS', bold: true, size: 22, font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'DIRECTOR GENERAL', bold: true, size: 22, font: 'Arial' })] }),
                  ],
                  margins: { top: 0, bottom: 200, left: 200, right: 200 },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
                new TableCell({
                  children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `C.  ${representante.toUpperCase()}`, bold: true, size: 22, font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'REPRESENTANTE LEGAL', bold: true, size: 22, font: 'Arial' })] }),
                  ],
                  margins: { top: 0, bottom: 200, left: 200, right: 200 },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
              ]
            }),
          ]
        }),
        p(''),
        p('Testigos', { center: true, bold: true }),
        p(''),
        p(''),
        // Tabla de testigos
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top:     { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            bottom:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            left:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'LIC. LUIS FERNANDO QUIROZ GONZÁLEZ', bold: true, size: 22, font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'DIRECTOR DE BIENESTAR Y CALIDAD DE VIDA', bold: true, size: 22, font: 'Arial' })] }),
                  ],
                  margins: { top: 200, bottom: 200, left: 200, right: 200 },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
                new TableCell({
                  children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'C. ALEXIS GUADALUPE ACEVEDO SANDOVAL', bold: true, size: 22, font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'JEFATURA DE BIENESTAR', bold: true, size: 22, font: 'Arial' })] }),
                  ],
                  margins: { top: 200, bottom: 200, left: 200, right: 200 },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
              ]
            }),
          ]
        }),
      ]
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const nombreArchivo = `Convenio_${razonSocial.replace(/[^a-zA-Z0-9]/g, '_')}_${anio}.docx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`)
  res.send(buffer)
})

module.exports = router
