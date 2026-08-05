const nodemailer = require('nodemailer')

function crearTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  })
}

async function enviarRecuperacion(destinatario, nombreUsuario, token) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}?reset=${token}`
  const transporter = crearTransporter()
  await transporter.sendMail({
    from: `"Lengua Joven" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: 'Recuperación de contraseña — Lengua Joven',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
        <div style="text-align:center;margin-bottom:24px;">
          <span style="font-size:28px;font-weight:700;">
            <span style="color:#F18B11;">Lengua</span> Joven
          </span>
        </div>
        <h2 style="color:#1a1a1a;font-size:20px;margin-bottom:8px;">Hola, ${nombreUsuario}</h2>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta.
          Haz clic en el botón de abajo para crear una nueva contraseña.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${url}" style="background:#F18B11;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;display:inline-block;">
            Restablecer contraseña
          </a>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.6;">
          Este enlace expira en <strong>1 hora</strong>. Si no solicitaste este correo, puedes ignorarlo.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;text-align:center;">
          Lengua Joven · Panel de Gestión Educativa
        </p>
      </div>
    `,
  })
}

async function enviarBienvenida(destinatario, nombreUsuario, emailUsuario, contrasena) {
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const transporter = crearTransporter()
  await transporter.sendMail({
    from: `"Lengua Joven" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: `¡Bienvenido/a a Lengua Joven, ${nombreUsuario}! Tus accesos están listos`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:0;background:#f9f9f9;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#F18B11 0%,#e07a00 100%);padding:40px 32px;text-align:center;border-radius:12px 12px 0 0;">
          <div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
            Lengua <span style="color:#fff3d4;">Joven</span>
          </div>
          <div style="color:#fff3d4;font-size:14px;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Panel de Gestión Educativa</div>
        </div>

        <!-- Body -->
        <div style="background:#fff;padding:36px 32px;">

          <h1 style="color:#1a1a1a;font-size:22px;margin:0 0 8px;">¡Felicidades, ${nombreUsuario}! 🎉</h1>
          <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Acabas de dar el <strong>primer gran paso hacia el cambio en tu vida profesional</strong>.
            Aprender un nuevo idioma abre puertas, construye puentes y transforma carreras —
            y tú decidiste empezar hoy.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 28px;">
            Tu cuenta en el portal de Lengua Joven ya está activa. A continuación encontrarás
            tus credenciales de acceso:
          </p>

          <!-- Credenciales -->
          <div style="background:#f5f5f5;border-left:4px solid #F18B11;border-radius:8px;padding:20px 24px;margin-bottom:28px;font-size:15px;line-height:2.2;">
            <div>👤 <strong>Usuario:</strong> <span style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${emailUsuario}</span></div>
            <div>🔑 <strong>Contraseña:</strong> <span style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${contrasena}</span></div>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${loginUrl}" style="background:#F18B11;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;display:inline-block;">
              Ingresar al portal →
            </a>
          </div>

          <!-- Tips -->
          <div style="background:#fffbf5;border:1px solid #f5dbb0;border-radius:8px;padding:18px 22px;margin-bottom:24px;">
            <div style="font-weight:700;color:#b86e00;font-size:13px;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">Primeros pasos recomendados</div>
            <ul style="margin:0;padding-left:18px;color:#555;font-size:14px;line-height:2;">
              <li>Inicia sesión con las credenciales de arriba</li>
              <li>Cambia tu contraseña desde <strong>Mi Perfil</strong></li>
              <li>Revisa tu grupo, horario y materiales en el panel</li>
            </ul>
          </div>

          <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
            Si tienes alguna duda o problema para acceder, escríbenos a
            <a href="mailto:soporte@injuve.mx" style="color:#F18B11;text-decoration:none;">soporte@injuve.mx</a>
            y con gusto te ayudamos.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f0f0f0;padding:20px 32px;text-align:center;border-radius:0 0 12px 12px;">
          <p style="color:#aaa;font-size:12px;margin:0;">
            Lengua Joven · Panel de Gestión Educativa<br>
            Este correo fue enviado porque un administrador creó tu cuenta.
          </p>
        </div>
      </div>
    `,
  })
}

async function enviarBienvenidaTutor(destinatario, nombreTutor, emailTutor, contrasena, nombreMenor) {
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const transporter = crearTransporter()
  await transporter.sendMail({
    from: `"Lengua Joven" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: `Acceso de tutor — Lengua Joven`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:0;background:#f9f9f9;">
        <div style="background:linear-gradient(135deg,#F18B11 0%,#e07a00 100%);padding:40px 32px;text-align:center;border-radius:12px 12px 0 0;">
          <div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
            Lengua <span style="color:#fff3d4;">Joven</span>
          </div>
          <div style="color:#fff3d4;font-size:14px;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Portal de Tutores</div>
        </div>
        <div style="background:#fff;padding:36px 32px;">
          <h1 style="color:#1a1a1a;font-size:22px;margin:0 0 8px;">Hola, ${nombreTutor}</h1>
          <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Se ha creado una cuenta de tutor para que puedas dar seguimiento al proceso académico de
            <strong>${nombreMenor}</strong> en Lengua Joven.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 28px;">
            Con tu cuenta podrás consultar las calificaciones de tu menor y los pagos pendientes.
          </p>
          <div style="background:#f5f5f5;border-left:4px solid #F18B11;border-radius:8px;padding:20px 24px;margin-bottom:28px;font-size:15px;line-height:2.2;">
            <div>👤 <strong>Usuario:</strong> <span style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${emailTutor}</span></div>
            <div>🔑 <strong>Contraseña:</strong> <span style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:4px;">${contrasena}</span></div>
          </div>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${loginUrl}" style="background:#F18B11;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;display:inline-block;">
              Ingresar al portal →
            </a>
          </div>
          <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
            Si tienes alguna duda, escríbenos a
            <a href="mailto:soporte@injuve.mx" style="color:#F18B11;text-decoration:none;">soporte@injuve.mx</a>.
          </p>
        </div>
        <div style="background:#f0f0f0;padding:20px 32px;text-align:center;border-radius:0 0 12px 12px;">
          <p style="color:#aaa;font-size:12px;margin:0;">
            Lengua Joven · Portal de Tutores<br>
            Este correo fue enviado porque un menor de edad te registró como tutor.
          </p>
        </div>
      </div>
    `,
  })
}

module.exports = { enviarRecuperacion, enviarBienvenida, enviarBienvenidaTutor }
