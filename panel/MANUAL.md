# Manual de Usuario — INJUVE Link · Panel de Gestión
**Versión 1.0.0 · Julio 2026**

---

## Índice

1. [Introducción](#1-introducción)
2. [Acceso al sistema](#2-acceso-al-sistema)
3. [Navegación general](#3-navegación-general)
4. [Módulos por rol](#4-módulos-por-rol)
   - 4.1 [Super Admin](#41-super-admin)
   - 4.2 [Director](#42-director)
   - 4.3 [Coordinador](#43-coordinador)
   - 4.4 [Profesor](#44-profesor)
   - 4.5 [Alumno](#45-alumno)
   - 4.6 [Admin / Ventas](#46-admin--ventas)
5. [Flujo de inscripción paso a paso](#5-flujo-de-inscripción-paso-a-paso)
6. [Módulos en detalle](#6-módulos-en-detalle)
7. [Preguntas frecuentes](#7-preguntas-frecuentes)

---

## 1. Introducción

**INJUVE Link · Panel de Gestión** es la plataforma interna del programa de inglés INJUVE Link del Gobierno de Nuevo León. Centraliza la operación del ciclo escolar completo:

- Gestión de planteles, idiomas, grupos y docentes
- Inscripción y seguimiento de alumnos
- Registro de pagos
- Control de asistencia y evaluaciones
- Placement test con sugerencia automática de grupo
- Comunicados y reportes

La plataforma funciona en cualquier navegador moderno (Chrome, Firefox, Edge, Safari) en computadora o celular.

---

## 2. Acceso al sistema

### Iniciar sesión

1. Abre el navegador y navega a la dirección del sistema.
2. Ingresa tu **correo electrónico** y **contraseña** asignados.
3. Haz clic en **Iniciar sesión**.

### Credenciales

Solicita tu correo y contraseña al administrador del sistema. No compartas tus credenciales con nadie.

### Cerrar sesión

Haz clic en **Cerrar sesión** en la parte inferior del menú lateral.

---

## 3. Navegación general

### Menú lateral (Sidebar)

El menú de navegación se encuentra en el lado izquierdo de la pantalla. Los módulos que ves dependen de tu rol. Los elementos activos se resaltan en naranja.

En dispositivos móviles el menú se oculta. Toca el ícono **☰** en la parte superior para abrirlo.

### Dashboard (Inicio)

Al ingresar verás un resumen adaptado a tu rol:
- **Admins/Dirección:** métricas de inscripciones, pagos e inscripciones recientes
- **Profesor:** lista de sus grupos
- **Alumno:** estado de su inscripción y calificaciones

---

## 4. Módulos por rol

### 4.1 Super Admin

Acceso completo a todos los módulos y todos los planteles.

| Módulo | Qué puede hacer |
|--------|-----------------|
| Planteles | Crear y editar cualquier plantel |
| Idiomas y Niveles | Configurar idiomas y escala de niveles |
| Grupos | Crear grupos en cualquier plantel, asignar profesores |
| Asistencia | Ver y registrar asistencia de cualquier grupo |
| Evaluación | Ver y registrar calificaciones de cualquier grupo |
| Placement Test | Aplicar y ver exámenes de cualquier alumno |
| Inscripciones | CRUD completo, cambiar estados, confirmar sugerencias |
| Pagos | Registrar y confirmar pagos de cualquier alumno |
| Avisos | Publicar comunicados globales o por plantel/grupo |
| Reportes | Reportes de todos los planteles |
| Configuración | Parámetros del sistema y gestión de usuarios |

### 4.2 Director

Acceso a todos los módulos de su plantel.

- Puede editar los datos de **su plantel** (no crear nuevos planteles)
- Acceso completo a inscripciones, pagos y reportes de su plantel
- Puede crear grupos, asignar profesores y publicar avisos

### 4.3 Coordinador

Operación académica y administrativa del plantel.

- **No puede** ver o modificar inscripciones sin el permiso explícito de confirmar grupos
- Puede aplicar placement tests y confirmar la sugerencia de grupo
- Puede crear grupos y configurar idiomas dentro de su plantel

### 4.4 Profesor

Herramientas para su labor docente.

- Ve **solo sus grupos**
- Puede tomar asistencia y registrar calificaciones de sus grupos
- Puede publicar avisos a su grupo específico
- Ve (solo lectura) resultados de placement test de sus alumnos

### 4.5 Alumno

Vista personal de su progreso.

- Ve el estado de su inscripción y grupo asignado
- Consulta su historial de asistencia y calificaciones
- Ve su resultado de placement test
- Puede realizar su pago desde el módulo de Pagos
- Recibe avisos globales, del plantel y de su grupo

### 4.6 Admin / Ventas

Gestión del proceso de inscripción y cobranza.

- Captura inscripciones nuevas y registra pagos
- Aplica placement tests y confirma la sugerencia de grupo automática
- **No accede** a configuración de grupos ni módulos académicos

---

## 5. Flujo de inscripción paso a paso

El diagrama de flujo del documento define este proceso:

```
Alumno muestra interés
        ↓
Admin/Ventas crea inscripción → Estado: NUEVA
        ↓
Equipo valida información → Estado: VALIDADA
        ↓
Se envía liga/referencia de pago → Estado: LIGA_ENVIADA
        ↓
[Opcional] Alumno toma Placement Test
        ↓
Sistema sugiere grupo automáticamente (INSC_SUGERIR)
        ↓
Coordinador/Admin confirma o rechaza sugerencia
        ↓
Alumno paga → Estado: PAGADA
        ↓
Se asigna al grupo → Estado: ASIGNADA
```

### Cómo registrar una inscripción nueva

1. Ve a **Inscripciones** en el menú lateral.
2. Haz clic en **+ Nueva inscripción**.
3. Llena los datos: nombre, correo, teléfono y plantel.
4. Guarda → la inscripción queda en estado **Nueva**.
5. Usa el selector de estado en la tabla para avanzarla por el flujo.

### Cómo aplicar un Placement Test

1. Ve a **Placement Test**.
2. Haz clic en **+ Capturar resultado**.
3. Selecciona el alumno, el idioma y el nivel sugerido.
4. Ingresa la calificación (0-100) y observaciones opcionales.
5. Haz clic en **Guardar y sugerir grupo** — el sistema busca automáticamente el grupo disponible para ese nivel en el plantel y lo sugiere.

### Cómo confirmar la sugerencia de grupo

1. Ve a **Inscripciones**.
2. Haz clic en **Ver** en la inscripción con sugerencia pendiente.
3. Revisa el grupo sugerido y elige **Confirmar** o **Rechazar**.
4. Al confirmar, la inscripción pasa a estado **Asignada**.

---

## 6. Módulos en detalle

### Planteles

Muestra todos los planteles activos en tarjetas. El botón **+ Nuevo plantel** aparece solo para Superadmin. El Director solo puede **Editar** su plantel.

### Idiomas y Niveles

Muestra idiomas configurados con sus niveles en chips. Usa **+ Idioma** para agregar un nuevo idioma y **+ Nivel** dentro de cada tarjeta para agregar niveles.

### Grupos / Cohortes

Lista completa de grupos en tabla. Columnas: Código, Idioma, Nivel, Plantel, Profesor, Horario, Alumnos/Cupo, Estado.

Al crear un grupo se debe asignar: Código único, Idioma, Nivel, Plantel, Profesor (opcional) y Cupo.

### Asistencia

1. Selecciona el **Grupo** y la **Fecha** en los filtros superiores.
2. La tabla muestra todos los alumnos asignados a ese grupo.
3. Marca **Presente / Ausente** para cada alumno con los botones de radio.
4. Haz clic en **Guardar asistencia**.

### Evaluación

1. Selecciona el **Grupo** en el filtro.
2. Para registrar: **+ Registrar evaluación** → selecciona alumno, tipo (diagnóstico / parcial / final / extraordinario), calificación 0-100 y observaciones.
3. Las calificaciones ≥70 se muestran en verde, <70 en rojo.

### Pagos

- La tabla muestra todos los pagos con su estado (pendiente / pagado / cancelado).
- El botón **Confirmar** en un pago pendiente lo marca como pagado y avanza la inscripción relacionada a estado "pagada".
- Para registrar un nuevo pago: **+ Registrar pago** → selecciona inscripción, monto, método y referencia.

### Avisos

- Los avisos aparecen como tarjetas con título, fecha y ámbito (global / plantel / grupo).
- Para publicar: **+ Publicar aviso** → completa título, contenido y opcionalmente filtra a plantel o grupo específico.
- **Archivar** desactiva el aviso sin borrarlo.

### Reportes

Panel de métricas con:
- **Inscripciones por estado** (gráfica de barras)
- **Ocupación de grupos** (tabla con barra de porcentaje)
- **Desempeño académico** (promedio de calificaciones por grupo)
- **Resumen financiero** (pagado vs. pendiente)

### Configuración *(Solo Superadmin)*

- **Configuración general:** nombre del sistema, correo de soporte, ciclo activo, costo de inscripción, días de gracia.
- **Usuarios del sistema:** CRUD de usuarios con asignación de rol y plantel.
- **Restablecer datos de demo:** regresa todos los datos al estado inicial (útil para pruebas).

---

## 7. Preguntas frecuentes

**¿Por qué no veo algunos módulos en el menú?**  
El menú solo muestra los módulos para los que tienes permiso según tu rol. Si crees que falta un acceso, contacta al Superadmin.

**¿Los datos se guardan en el servidor?**  
En la versión demo, los datos se guardan en el almacenamiento del navegador (localStorage). No se pierden al cerrar la ventana, pero sí al borrar caché o usar otro navegador. En la versión de producción se conectará a Supabase.

**¿Qué pasa si rechazo la sugerencia de grupo del sistema?**  
La sugerencia se descarta y puedes asignar el grupo manualmente en el modal de detalle de inscripción.

**¿Cómo cambio mi contraseña?**  
El Superadmin puede editar cualquier usuario desde **Configuración → Usuarios del sistema**. Ingresa la nueva contraseña en el campo correspondiente al editar el usuario.

**¿Puedo exportar los reportes?**  
La exportación a Excel/PDF está en el roadmap de la versión 1.1.0.

---

*INJUVE Link · Panel de Gestión v1.0.0 · Gobierno de Nuevo León*
