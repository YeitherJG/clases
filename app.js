/* app.js - Gestión de materias, clases y estudiantes con estrellas (+ y -) */

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

// Registro del Service Worker
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

  // Tabla de materias
  db.run(`
    CREATE TABLE IF NOT EXISTS materias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrera TEXT NOT NULL,
      institucion TEXT NOT NULL
    );
  `);

  // Tabla de clases
  db.run(`
    CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materia_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      fecha TEXT NOT NULL,
      grupo TEXT,
      seccion TEXT,
      FOREIGN KEY(materia_id) REFERENCES materias(id)
    );
  `);

  // Tabla de estudiantes
  db.run(`
    CREATE TABLE IF NOT EXISTS estudiantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clase_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      cedula TEXT NOT NULL,
      estrellas INTEGER DEFAULT 0,
      FOREIGN KEY(clase_id) REFERENCES clases(id)
    );
  `);

  // Render inicial
  renderMaterias();
}).catch(err => {
  console.error("Error inicializando SQL.js:", err);
});

// =========================
// Formulario: agregar materia
// =========================
document.getElementById("formMateria").addEventListener("submit", e => {
  e.preventDefault();

  const carrera = document.getElementById("carrera").value.trim();
  const institucion = document.getElementById("institucion").value.trim();

  if (!carrera || !institucion) {
    alert("Por favor completa todos los campos de la materia");
    return;
  }

  db.run(
    `INSERT INTO materias (carrera, institucion) VALUES (?, ?)`,
    [carrera, institucion]
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
                <button class="star-btn remove-star" type="button" aria-label="Quitar estrella">−</button>
                <span class="meta star-display">${estrellasHTML} (${estrellas})</span>
                <button class="star-btn add-star" type="button" aria-label="Agregar estrella">+</button>
              </div>
              <div class="acciones">
                <button class="edit-estudiante" data-id="${eid}">✏️ Editar</button>
                <button class="delete-estudiante" data-id="${eid}">🗑️ Eliminar</button>
              </div>
            `;
            listaEst.appendChild(item);
          }); // ← aquí va el cierre correcto del forEach
          card.appendChild(listaEst); // ← no olvides añadir la lista al card
        } else {
          const empty = document.createElement("p");
          empty.className = "meta";
          empty.textContent = "No hay estudiantes en esta clase aún.";
          card.appendChild(empty);
        }
