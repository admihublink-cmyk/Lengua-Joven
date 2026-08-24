const bcrypt = require('bcryptjs')
const db = require('./db')

const planteles = [
  { id: 'p1',  slug: 'mty'  },
  { id: 'p2',  slug: 'gdlp' },
  { id: 'p3',  slug: 'ain'  },
  { id: 'p4',  slug: 'imnar'},
  { id: 'p5',  slug: 'ies'  },
  { id: 'p6',  slug: 'len'  },
  { id: 'p7',  slug: 'utk'  },
  { id: 'p8',  slug: 'item' },
  { id: 'p9',  slug: 'cca'  },
  { id: 'p10', slug: 'alt'  },
]

const roles = ['coordinador', 'director', 'profesor', 'alumno', 'admin_ventas', 'tutor']
const PASSWORD = 'Injuve2025!'
const hash = bcrypt.hashSync(PASSWORD, 10)

let counter = 62
const insert = db.prepare(`
  INSERT OR IGNORE INTO usuarios (id, nombre, email, password_hash, rol, plantel_id, activo)
  VALUES (?, ?, ?, ?, ?, ?, 1)
`)

const usuarios = []

for (const p of planteles) {
  for (const rol of roles) {
    const id = 'u' + counter++
    const email = `${rol}.${p.slug}@lj.test`
    const rolLabel = {
      coordinador: 'Coordinador', director: 'Director', profesor: 'Profesor',
      alumno: 'Alumno', admin_ventas: 'Admin Ventas', tutor: 'Tutor',
    }[rol]
    const nombre = `${rolLabel} ${p.slug.toUpperCase()}`
    insert.run(id, nombre, email, hash, rol, p.id)
  }
}

console.log(`✓ ${usuarios.length} usuarios creados`)
console.log(`\nContraseña para todos: ${PASSWORD}\n`)
console.log('Ejemplo por plantel:\n')

for (const p of planteles) {
  const us = usuarios.filter(u => u.plantel === p.id)
  console.log(`${p.id} (${p.slug}):`)
  us.forEach(u => console.log(`  ${u.rol.padEnd(14)} → ${u.email}`))
}
