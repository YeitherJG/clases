/* app.js - Gestión de clases y estudiantes con estrellas (+ y -)
Mantiene tu estructura original y añade la funcionalidad para quitar estrellas.
No se cambió nada que no solicitaste.
*/

let db;

// =========================
// Utilidad: cálculo de nota
// =========================
function calcularNota(estrellas, maxEstrellas, minEstrellas) {
if (estrellas === 0) return 1;
if (estrellas === minEstrellas) return 12;
if (estrellas === maxEstrellas) return 20;
const rango = 20 - 12;
const nota = 12 + Math.round((estrellas - minEstrellas) * rango / (maxEstrellas - minEstrellas || 1));
return nota;
}

// =========================
// Persistencia en localStorage (snapshot de SQL.js)
// =========================
function saveDB() {
try {
 const data = db.export();
 const buffer = new Uint8Array(data);
 localStorage.setItem("db", JSON.stringify(Array.from(buffer)));
} catch (err) {
 console.error("saveDB error:", err);
}
}

function loadDB(SQL) {
try {
 const saved = localStorage.getItem("db");
 if (saved) {
   const buffer = new Uint8Array(JSON.parse(saved));
   return new SQL.Database(buffer);
 }
} catch (err) {
 console.warn("No se pudo cargar DB guardada, creando nueva:", err);
}
return new SQL.Database();
}

// Registro del Service Worker (deja tal cual)
if ("serviceWorker" in navigator) {
navigator.serviceWorker.register("/sw.js")
 .then(reg => console.log("SW registrado:", reg.scope))
 .catch(err => console.error("Error SW:", err));
}
// =========================
// Inicialización SQL.js con nueva estructura
// =========================
initSqlJs({
  locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm`
}).then(SQL => {
  db = loadDB(SQL);

  // Tabla de materias (información estable)
  db.run(`
    CREATE TABLE IF NOT EXISTS materias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrera TEXT NOT NULL,        -- Ej: Ingeniería de Software
      institucion TEXT NOT NULL     -- Ej: Universidad X
      -- opcional: nombre si dictas varias materias dentro de la misma carrera
    );
  `);

  // Tabla de clases (sesiones puntuales de una materia en una fecha)
  db.run(`
    CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materia_id INTEGER NOT NULL,  -- Relación con la materia
      nombre TEXT NOT NULL,         -- Ej: "Clase sobre integrales"
      fecha TEXT NOT NULL,          -- Ej: "2025-11-28"
      grupo TEXT,                   -- Ej: "Grupo 3"
      seccion TEXT,                 -- Ej: "Sección 114"
      FOREIGN KEY(materia_id) REFERENCES materias(id)
    );
  `);

  // Tabla de estudiantes (asociados a una clase puntual)
  db.run(`
    CREATE TABLE IF NOT EXISTS estudiantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clase_id INTEGER NOT NULL,    -- Relación con la clase del día
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      cedula TEXT NOT NULL,
      estrellas INTEGER DEFAULT 0,
      FOREIGN KEY(clase_id) REFERENCES clases(id)
    );
  `);

  // Render inicial (puedes cambiar a renderMaterias si decides mostrar primero las materias)
  renderMaterias();

}).catch(err => {
console.error("Error inicializando SQL.js:", err);
});

// =========================
// Formulario: agregar clase
// =========================
document.getElementById("formClase").addEventListener("submit", e => {
e.preventDefault();

const carrera = document.getElementById("carrera").value.trim();
const seccion = document.getElementById("seccion").value.trim();
const turno = document.getElementById("turno").value;
const institucion = document.getElementById("institucion").value.trim();

if (!carrera || !seccion || !turno || !institucion) {
 alert("Por favor completa todos los campos de la clase");
 return;
}

db.run(
 `INSERT INTO clases (carrera, seccion, turno, institucion) VALUES (?, ?, ?, ?)`,
 [carrera, seccion, turno, institucion]
);

saveDB();
renderMaterias();
e.target.reset();
});
// =========================
// Render: materias → clases → estudiantes
// =========================
function renderMaterias() {
  const res = db.exec(`SELECT id, carrera, institucion FROM materias ORDER BY id DESC`);
  const container = document.getElementById("materias");
  container.innerHTML = "";

  if (res.length === 0) {
    container.innerHTML = "<p class='meta'>No hay materias registradas aún.</p>";
    return;
  }

  res[0].values.forEach(row => {
    const [materiaId, carrera, institucion] = row;

    const card = document.createElement("div");
    card.className = "materia-card";
    card.innerHTML = `
      <h3>${escapeHtml(carrera)}</h3>
      <p class="meta">Institución: ${escapeHtml(institucion)}</p>
      <div class="acciones">
        <button class="edit-materia" data-id="${materiaId}">✏️ Editar</button>
        <button class="delete-materia" data-id="${materiaId}">🗑️ Eliminar</button>
      </div>
    `;

    // Formulario para agregar clase dentro de la materia
    const formClase = document.createElement("form");
    formClase.className = "form-clase";
    formClase.innerHTML = `
      <input type="text" name="nombre" placeholder="Nombre de la clase" required>
      <input type="date" name="fecha" required>
      <input type="text" name="grupo" placeholder="Grupo">
      <input type="text" name="seccion" placeholder="Sección">
      <button type="submit">Agregar clase</button>
    `;
    formClase.addEventListener("submit", e => {
      e.preventDefault();
      const nombre = formClase.nombre.value.trim();
      const fecha = formClase.fecha.value;
      const grupo = formClase.grupo.value.trim();
      const seccion = formClase.seccion.value.trim();

      db.run(
        `INSERT INTO clases (materia_id, nombre, fecha, grupo, seccion) VALUES (?, ?, ?, ?, ?)`,
        [materiaId, nombre, fecha, grupo, seccion]
      );
      saveDB();
      renderMaterias();
    });
    card.appendChild(formClase);

    // Lista de clases de la materia
    const clasesRes = db.exec(`
      SELECT id, nombre, fecha, grupo, seccion
      FROM clases
      WHERE materia_id = ${materiaId}
      ORDER BY fecha DESC
    `);

    if (clasesRes.length > 0 && clasesRes[0].values.length > 0) {
      const listaClases = document.createElement("div");
      listaClases.className = "clases-lista";

      clasesRes[0].values.forEach(cl => {
        const [claseId, nombreClase, fecha, grupo, seccion] = cl;
        const claseCard = document.createElement("div");
        claseCard.className = "clase-card";
        claseCard.innerHTML = `
          <h4>${escapeHtml(nombreClase)}</h4>
          <p class="meta">Fecha: ${fecha} · Grupo: ${grupo || "-"} · Sección: ${seccion || "-"}</p>
          <div class="acciones">
            <button class="edit-clase" data-id="${claseId}">✏️ Editar</button>
            <button class="delete-clase" data-id="${claseId}">🗑️ Eliminar</button>
          </div>
        `;

        // Formulario para estudiantes dentro de la clase
        const formEst = document.createElement("form");
        formEst.className = "form-estudiante";
        formEst.innerHTML = `
          <input type="text" name="nombre" placeholder="Nombre" required>
          <input type="text" name="apellido" placeholder="Apellido" required>
          <input type="text" name="cedula" placeholder="Cédula" required>
          <button type="submit">Agregar estudiante</button>
        `;
        formEst.addEventListener("submit", e => {
          e.preventDefault();
          const nombre = formEst.nombre.value.trim();
          const apellido = formEst.apellido.value.trim();
          const cedula = formEst.cedula.value.trim();

          db.run(
            `INSERT INTO estudiantes (clase_id, nombre, apellido, cedula) VALUES (?, ?, ?, ?)`,
            [claseId, nombre, apellido, cedula]
          );
          saveDB();
          renderMaterias();
        });
        claseCard.appendChild(formEst);

        // Lista de estudiantes
        const estRes = db.exec(`
          SELECT id, nombre, apellido, cedula, estrellas
          FROM estudiantes
          WHERE clase_id = ${claseId}
          ORDER BY id DESC
        `);

        if (estRes.length > 0 && estRes[0].values.length > 0) {
          const listaEst = document.createElement("div");
          listaEst.className = "estudiantes-lista";

          estRes[0].values.forEach(est => {
            const [eid, nombre, apellido, cedula, estrellas] = est;
            let estrellasHTML = "";
            for (let i = 0; i < estrellas; i++) estrellasHTML += "⭐";

            const item = document.createElement("div");
            item.className = "estudiante-card";
            item.innerHTML = `
              <h4>${escapeHtml(nombre)} ${escapeHtml(apellido)}</h4>
              <p class="meta">Cédula: ${escapeHtml(cedula)}</p>
              <div class="stars" data-id="${eid}">
                <button class="star-btn remove-star" type="button">−</button>
                <span class="meta star-display">${estrellasHTML} (${estrellas})</span>
                <button class="star-btn add-star" type="button">+</button>
              </div>
              <div class="acciones">
                <button class="edit-estudiante" data-id="${eid}">✏️ Editar</button>
                <button class="delete-estudiante" data-id="${eid}">🗑️ Eliminar</button>
              </div>
            `;
            listaEst.appendChild(item);
          });

          claseCard.appendChild(listaEst);
        }

        listaClases.appendChild(claseCard);
      });

      card.appendChild(listaClases);
    }

    container.appendChild(card);
  });
}


 if (estRes.length > 0 && estRes[0].values.length > 0) {
   const lista = document.createElement("div");
   lista.className = "estudiantes-lista";

   const rangoRes = db.exec(`
     SELECT MAX(estrellas) AS maxE, MIN(estrellas) AS minE
     FROM estudiantes WHERE clase_id = ${id}
   `);
   const maxEstrellas = (rangoRes[0] && rangoRes[0].values[0][0]) ?? 0;
   const minEstrellas = (rangoRes[0] && rangoRes[0].values[0][1]) ?? 0;

   estRes[0].values.forEach(est => {
     const [eid, cid, nombre, apellido, cedula, estrellas] = est;
     const nota = calcularNota(estrellas, maxEstrellas, minEstrellas);

     // Generar estrellas visibles
     let estrellasHTML = "";
     for (let i = 0; i < estrellas; i++) {
       estrellasHTML += "⭐";
     }

     const item = document.createElement("div");
     item.className = "estudiante-card";
     item.innerHTML = `
       <h4>${escapeHtml(nombre)} ${escapeHtml(apellido)}</h4>
       <p class="meta">Cédula: ${escapeHtml(cedula)}</p>
       <div class="stars" data-id="${eid}">
         <button class="star-btn remove-star" type="button" aria-label="Quitar estrella">−</button>
         <span class="meta star-display">${estrellasHTML} (${estrellas}) · Nota ${nota}</span>
         <button class="star-btn add-star" type="button" aria-label="Agregar estrella">+</button>
       </div>
       <div class="acciones">
         <button class="edit-estudiante" data-id="${eid}">✏️ Editar</button>
         <button class="delete-estudiante" data-id="${eid}">🗑️ Eliminar</button>
       </div>
     `;
     lista.appendChild(item);
   });

   card.appendChild(lista);
 } else {
   const empty = document.createElement("p");
   empty.className = "meta";
   empty.textContent = "No hay estudiantes en esta clase aún.";
   card.appendChild(empty);
 }

 container.appendChild(card);

// Escapar para seguridad mínima
function escapeHtml(s = "") {
return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// =========================
// Eventos globales
// =========================
document.addEventListener("click", e => {
// ⭐ Añadir estrella
if (e.target.classList.contains("add-star")) {
 const id = e.target.closest(".stars")?.dataset.id;
 if (!id) return;

 // Actualizamos DB
 db.run(`UPDATE estudiantes SET estrellas = estrellas + 1 WHERE id = ?`, [id]);
 saveDB();

 // Actualizar solo la UI de la tarjeta afectada (sin render completo)
 const starsEl = e.target.closest(".stars");
 updateStarsUIFromDB(starsEl);
 return;
}

// ⭐ Quitar estrella
if (e.target.classList.contains("remove-star")) {
 const id = e.target.closest(".stars")?.dataset.id;
 if (!id) return;

 // Leer el conteo actual desde DB para evitar desincronía
 const res = db.exec(`SELECT estrellas FROM estudiantes WHERE id = ${id}`);
 let current = 0;
 if (res.length > 0 && res[0].values.length > 0) {
   current = res[0].values[0][0] || 0;
 }

 const next = Math.max(0, current - 1);
 db.run(`UPDATE estudiantes SET estrellas = ? WHERE id = ?`, [next, id]);
 saveDB();

 // Actualizar solo la UI de la tarjeta afectada (sin render completo)
 const starsEl = e.target.closest(".stars");
 updateStarsUIFromDB(starsEl);
 return;
}

// 🗑️ Eliminar clase
if (e.target.classList.contains("delete-clase")) {
 const id = e.target.dataset.id;
 db.run(`DELETE FROM estudiantes WHERE clase_id = ?`, [id]);
 db.run(`DELETE FROM clases WHERE id = ?`, [id]);
 saveDB();
 renderClases();
}

// ✏️ Editar clase
if (e.target.classList.contains("edit-clase")) {
 const id = e.target.dataset.id;
 const res = db.exec(`SELECT carrera, seccion, turno, institucion FROM clases WHERE id = ${id}`);
 if (res.length > 0 && res[0].values.length > 0) {
   const [carrera, seccion, turno, institucion] = res[0].values[0];
   const nuevoCarrera = prompt("Carrera:", carrera);
   const nuevoSeccion = prompt("Sección:", seccion);
   const nuevoTurno = prompt("Turno:", turno);
   const nuevoInstitucion = prompt("Institución:", institucion);
   if (nuevoCarrera && nuevoSeccion && nuevoTurno && nuevoInstitucion) {
     db.run(
       `UPDATE clases SET carrera=?, seccion=?, turno=?, institucion=? WHERE id=?`,
       [nuevoCarrera, nuevoSeccion, nuevoTurno, nuevoInstitucion, id]
     );
     saveDB();
     renderClases();
   }
 }
}

// 🗑️ Eliminar estudiante
if (e.target.classList.contains("delete-estudiante")) {
 const id = e.target.dataset.id;
 db.run(`DELETE FROM estudiantes WHERE id = ?`, [id]);
 saveDB();
 renderClases();
}

// ✏️ Editar estudiante
if (e.target.classList.contains("edit-estudiante")) {
 const id = e.target.dataset.id;
 const res = db.exec(`SELECT nombre, apellido, cedula FROM estudiantes WHERE id = ${id}`);
 if (res.length > 0 && res[0].values.length > 0) {
   const [nombre, apellido, cedula] = res[0].values[0];
   const nuevoNombre = prompt("Nombre:", nombre);
   const nuevoApellido = prompt("Apellido:", apellido);
   const nuevoCedula = prompt("Cédula:", cedula);
   if (nuevoNombre && nuevoApellido && nuevoCedula) {
     db.run(
       `UPDATE estudiantes SET nombre=?, apellido=?, cedula=? WHERE id=?`,
       [nuevoNombre, nuevoApellido, nuevoCedula, id]
     );
     saveDB();
     renderClases();
   }
 }
}
});

// =========================
// Actualizar la UI de estrellas de una tarjeta desde la DB (sin re-render completo)
// starsEl: elemento .stars
// =========================
function updateStarsUIFromDB(starsEl) {
if (!starsEl) return;
const id = starsEl.dataset.id;
const res = db.exec(`SELECT estrellas, clase_id FROM estudiantes WHERE id = ${id}`);
if (!(res.length > 0 && res[0].values.length > 0)) return;

const estrellas = res[0].values[0][0] || 0;
const claseId = res[0].values[0][1];

// Recalcular max/min para la clase para obtener nota coherente
const rangoRes = db.exec(`
 SELECT MAX(estrellas) AS maxE, MIN(estrellas) AS minE
 FROM estudiantes WHERE clase_id = ${claseId}
`);
const maxEstrellas = (rangoRes[0] && rangoRes[0].values[0][0]) ?? estrellas;
const minEstrellas = (rangoRes[0] && rangoRes[0].values[0][1]) ?? 0;
const nota = calcularNota(estrellas, maxEstrellas, minEstrellas);

// Reconstruir representación de estrellas
let estrellasHTML = "";
for (let i = 0; i < estrellas; i++) estrellasHTML += "⭐";

const display = starsEl.querySelector(".star-display");
if (display) {
 display.textContent = `${estrellasHTML} (${estrellas}) · Nota ${nota}`;
}

// Deshabilitar botón quitar si llega a 0
const removeBtn = starsEl.querySelector(".remove-star");
if (removeBtn) removeBtn.disabled = estrellas === 0;
}

// =========================
// Fin del archivo
// =========================

