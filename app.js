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
// Persistencia en localStorage
// =========================
function saveDB() {
  const data = db.export();
  const buffer = new Uint8Array(data);
  localStorage.setItem("db", JSON.stringify(Array.from(buffer)));
}

function loadDB(SQL) {
  const saved = localStorage.getItem("db");
  if (saved) {
    const buffer = new Uint8Array(JSON.parse(saved));
    return new SQL.Database(buffer);
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
// Inicialización SQL.js
// =========================
initSqlJs({
  locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm`
}).then(SQL => {
  db = loadDB(SQL);

  db.run(`
    CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrera TEXT NOT NULL,
      seccion TEXT NOT NULL,
      turno TEXT NOT NULL,
      institucion TEXT NOT NULL
    );
  `);

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

  renderClases();
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
  renderClases();
  e.target.reset();
});

// =========================
// Render: clases + estudiantes
// =========================
function renderClases() {
  const res = db.exec(`SELECT id, carrera, seccion, turno, institucion FROM clases ORDER BY id DESC`);
  const container = document.getElementById("clases");
  container.innerHTML = "";

  if (res.length === 0) {
    container.innerHTML = "<p class='meta'>No hay clases registradas aún.</p>";
    return;
  }

  res[0].values.forEach(row => {
    const [id, carrera, seccion, turno, institucion] = row;

    const card = document.createElement("div");
    card.className = "clase-card";
    card.innerHTML = `
      <h3>${carrera}</h3>
      <p class="meta">Institución: ${institucion}</p>
      <p class="meta">Sección ${seccion} · ${turno}</p>
      <div class="acciones">
        <button class="edit-clase" data-id="${id}">✏️ Editar</button>
        <button class="delete-clase" data-id="${id}">🗑️ Eliminar</button>
      </div>
    `;

    // Formulario interno para estudiantes
    const form = document.createElement("form");
    form.className = "form-estudiante";
    form.innerHTML = `
      <input type="text" name="nombre" placeholder="Nombre" required>
      <input type="text" name="apellido" placeholder="Apellido" required>
      <input type="text" name="cedula" placeholder="Cédula" required>
      <button type="submit">Agregar estudiante</button>
    `;
    form.addEventListener("submit", e => {
      e.preventDefault();
      const nombre = form.nombre.value.trim();
      const apellido = form.apellido.value.trim();
      const cedula = form.cedula.value.trim();

      if (!nombre || !apellido || !cedula) return;

      db.run(
        `INSERT INTO estudiantes (clase_id, nombre, apellido, cedula) VALUES (?, ?, ?, ?)`,
        [id, nombre, apellido, cedula]
      );

      saveDB();
      renderClases();
    });

    card.appendChild(form);

    // Lista de estudiantes por clase
    const estRes = db.exec(`
      SELECT id, clase_id, nombre, apellido, cedula, estrellas
      FROM estudiantes
      WHERE clase_id = ${id}
      ORDER BY id DESC
    `);

    if (estRes.length > 0 && estRes[0].values.length > 0) {
      const lista = document.createElement("div");
      lista.className = "estudiantes-lista";

      const rangoRes = db.exec(`
        SELECT MAX(estrellas) AS maxE, MIN(estrellas) AS minE
        FROM estudiantes WHERE clase_id = ${id}
      `);
      const maxEstrellas = rangoRes[0].values[0][0] ?? 0;
      const minEstrellas = rangoRes[0].values[0][1] ?? 0;

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
          <h4>${nombre} ${apellido}</h4>
          <p class="meta">Cédula: ${cedula}</p>
          <div class="stars" data-id="${eid}">
            <button class="star-btn add-star" type="button">⭐</button>
            <span class="meta">${estrellasHTML} (${estrellas}) · Nota ${nota}</span>
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
  });
}

// =========================
// Eventos globales
// =========================
document.addEventListener("click", e => {
  // ⭐ Añadir estrella
  if (e.target.classList.contains("add-star")) {
    const id = e.target.closest(".stars")?.dataset.id;
    if (!id) return;
    db.run(`UPDATE estudiantes SET estrellas = estrellas + 1 WHERE id = ?`, [id]);
    saveDB();
    renderClases();
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
