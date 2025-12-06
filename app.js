/* app.js - Gestión de materias, clases y estudiantes con estrellas (+ y -) */

let db;

// =========================
// Utilidad: cálculo de nota
// =========================
function calcularNota(estrellas, maxEstrellas = 5, minEstrellas = 0) {  // Asumiendo max 5 estrellas por defecto
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

// Función para asegurar que las tablas existan (útil si la DB cargada no las tiene)
function ensureTables() {
  try {
    // Verifica y crea tablas si no existen
    db.run(`
      CREATE TABLE IF NOT EXISTS materias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        carrera TEXT NOT NULL,
        institucion TEXT NOT NULL
      );
    `);
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
    db.run(`
      CREATE TABLE IF NOT EXISTS estudiantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clase_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        apellido TEXT NOT NULL,
        cedula TEXT NOT NULL UNIQUE,
        estrellas INTEGER DEFAULT 0,
        FOREIGN KEY(clase_id) REFERENCES clases(id)
      );
    `);
    console.log("Tablas verificadas/creadas exitosamente");
  } catch (err) {
    console.error("Error al asegurar tablas:", err);
  }
}

// Registro del Service Worker (ajusta la ruta si sw.js no está en raíz)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")  // Cambia a "./sw.js" si está en la misma carpeta que index.html
    .then(reg => console.log("SW registrado:", reg.scope))
    .catch(err => console.error("Error SW:", err));
}

// =========================
// Inicialización SQL.js con archivos locales
// =========================
initSqlJs({
  locateFile: () => `./sql-wasm.wasm`  // Usa el archivo local en lugar de CDN
}).then(SQL => {
  db = loadDB(SQL);
  ensureTables();  // Asegura que las tablas existan
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
  console.log("Renderizando materias...");
  try {
    const res = db.exec(`SELECT id, carrera, institucion FROM materias ORDER BY id DESC`);
    console.log("Materias encontradas:", res);
    const container = document.getElementById("materias");
    container.innerHTML = "";

    if (res.length === 0) {
      container.innerHTML = "<p class='meta'>No hay materias registradas aún.</p>";
      return;
    }

    res[0].values.forEach(row => {
      const [materiaId, carrera, institucion] = row;
      console.log("Renderizando materia:", materiaId, carrera);

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

        if (!nombre || !fecha) {
          alert("Completa nombre y fecha de la clase");
          return;
        }

        console.log("Agregando clase a materia:", materiaId);
        try {
          db.run(
            `INSERT INTO clases (materia_id, nombre, fecha, grupo, seccion) VALUES (?, ?, ?, ?, ?)`,
            [materiaId, nombre, fecha, grupo, seccion]
          );
          console.log("Clase agregada exitosamente");
          saveDB();
          renderMaterias();
        } catch (err) {
          console.error("Error al agregar clase:", err);
          alert("Error al agregar clase: " + err.message);
        }
      });
      card.appendChild(formClase);

      // Lista de clases de la materia
      let clasesRes = [];
      try {
        clasesRes = db.exec(`
          SELECT id, nombre, fecha, grupo, seccion
          FROM clases
          WHERE materia_id = ${materiaId}
          ORDER BY fecha DESC
        `);
        console.log("Clases para materia", materiaId, ":", clasesRes);
      } catch (err) {
        console.error("Error al consultar clases:", err);
        // Si falla, asume que no hay clases
      }

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

            if (!nombre || !apellido || !cedula) {
              alert("Completa todos los campos del estudiante");
              return;
            }

            try {
              db.run(
                `INSERT INTO estudiantes (clase_id, nombre, apellido, cedula) VALUES (?, ?, ?, ?)`,
                [claseId, nombre, apellido, cedula]
              );
              saveDB();
              renderMaterias();
            } catch (err) {
              alert("Error: Cédula ya existe o problema en DB");
            }
          });
          claseCard.appendChild(formEst);

          // Lista de estudiantes
          let estRes = [];
          try {
            estRes = db.exec(`
              SELECT id, nombre, apellido, cedula, estrellas
              FROM estudiantes
              WHERE clase_id = ${claseId}
              ORDER BY id DESC
            `);
          } catch (err) {
            console.error("Error al consultar estudiantes (posiblemente tabla no existe):", err);
            // Si falla, muestra mensaje de que no hay estudiantes
            const emptyEst = document.createElement("p");
            emptyEst.className = "meta";
            emptyEst.textContent = "No hay estudiantes en esta clase aún (error en DB).";
            claseCard.appendChild(emptyEst);
            return;  // Salta al siguiente
          }

          if (estRes.length > 0 && estRes[0].values.length > 0) {
            const listaEst = document.createElement("div");
            listaEst.className = "estudiantes-lista";

            estRes[0].values.forEach(est => {
              const [eid, nombre, apellido, cedula, estrellas] = est;
              let estrellasHTML = "";
              for (let i = 0; i < estrellas; i++) estrellasHTML += "⭐";
              const nota = calcularNota(estrellas);

              const item = document.createElement("div");
              item.className = "estudiante-card";
              item.innerHTML = `
                <h4>${escapeHtml(nombre)} ${escapeHtml(apellido)}</h4>
                <p class="meta">Cédula: ${escapeHtml(cedula)}</p>
                <div class="stars" data-id="${eid}">
                  <button class="star-btn remove-star" type="button" aria-label="Quitar estrella">−</button>
                  <span class="meta star-display">${estrellasHTML} (${estrellas}) - Nota: ${nota}</span>
                  <button class="star-btn add-star" type="button" aria-label="Agregar estrella">+</button>
                </div>
                <div class="acciones">
                  <button class="edit-estudiante" data-id="${eid}">✏️ Editar</button>
                  <button class="delete-estudiante" data-id="${eid}">🗑️ Eliminar</button>
                </div>
              `;
              listaEst.appendChild(item);
            });

            claseCard.appendChild(listaEst);
          } else {
            const emptyEst = document.createElement("p");
            emptyEst.className = "meta";
            emptyEst.textContent = "No hay estudiantes en esta clase aún.";
            claseCard.appendChild(emptyEst);
          }

          listaClases.appendChild(claseCard);
        });

        card.appendChild(listaClases);
      } else {
        const emptyClase = document.createElement("p");
        emptyClase.className = "meta";
        emptyClase.textContent = "No hay clases registradas aún.";
        card.appendChild(emptyClase);
      }

      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error en renderMaterias:", err);
    alert("Error al renderizar: " + err.message);
  }
}

// =========================
// Event listeners delegados para acciones dinámicas (estrellas, editar, eliminar)
// =========================
document.getElementById("materias").addEventListener("click", e => {
  const target = e.target;

  // Agregar estrella
  if (target.classList.contains("add-star")) {
    const id = target.closest(".stars").dataset.id;
    db.run(`UPDATE estudiantes SET estrellas = estrellas + 1 WHERE id = ?`, [id]);
    saveDB();
    renderMaterias();
  }

  // Quitar estrella
  else if (target.classList.contains("remove-star")) {
    const id = target.closest(".stars").dataset.id;
    db.run(`UPDATE estudiantes SET estrellas = MAX(0, estrellas - 1) WHERE id = ?`, [id]);
    saveDB();
    renderMaterias();
  }

  // Eliminar materia
  else if (target.classList.contains("delete-materia")) {
    const id = target.dataset.id;
    if (confirm("¿Eliminar materia y todo lo relacionado?")) {
      db.run(`DELETE FROM estudiantes WHERE clase_id IN (SELECT id FROM clases WHERE materia_id = ?)`, [id]);
      db.run(`DELETE FROM clases WHERE materia_id = ?`, [id]);
      db.run(`DELETE FROM materias WHERE id = ?`, [id]);
      saveDB();
      renderMaterias();
    }
  }

  // Eliminar clase
  else if (target.classList.contains("delete-clase")) {
    const id = target.dataset.id;
    if (confirm("¿Eliminar clase y estudiantes?")) {
      db.run(`DELETE FROM estudiantes WHERE clase_id = ?`, [id]);
      db.run(`DELETE FROM clases WHERE id = ?`, [id]);
      saveDB();
      renderMaterias();
    }
  }

  // Eliminar estudiante
  else if (target.classList.contains("delete-estudiante")) {
    const id = target.dataset.id;
    if (confirm("¿Eliminar estudiante?")) {
      db.run(`DELETE FROM estudiantes WHERE id = ?`, [id]);
      saveDB();
      renderMaterias();
    }
  }

  // Editar materia (simple prompt)
  else if (target.classList.contains("edit-materia")) {
    const id = target.dataset.id;
    const res = db.exec(`SELECT carrera, institucion FROM materias WHERE id = ?`, [id]);
    if (res.length > 0) {
      const [carrera, institucion] = res[0].values[0];
      const newCarrera = prompt("Nueva carrera:", carrera);
      const newInstitucion = prompt("Nueva institución:", institucion);
      if (newCarrera && newInstitucion) {
        db.run(`UPDATE materias SET carrera = ?, institucion = ? WHERE id = ?`, [newCarrera.trim(), newInstitucion.trim(), id]);
        saveDB();
        renderMaterias();
      }
    }
  }

  // Editar clase (simple prompt)
  else if (target.classList.contains("edit-clase")) {
    const id = target.dataset.id;
    const res = db.exec(`SELECT nombre, fecha, grupo, seccion FROM clases WHERE id = ?`, [id]);
    if (res.length > 0) {
      const [nombre, fecha, grupo, seccion] = res[0].values[0];
      const newNombre = prompt("Nuevo nombre:", nombre);
      const newFecha = prompt("Nueva fecha:", fecha);
      if (newNombre && newFecha) {
        db.run(`UPDATE clases SET nombre = ?, fecha = ?, grupo = ?, seccion = ? WHERE id = ?`, [newNombre.trim(), newFecha, grupo, seccion, id]);
        saveDB();
        renderMaterias();
      }
    }
  }

  // Editar estudiante (simple prompt)
  else if (target.classList.contains("edit-estudiante")) {
    const id = target.dataset.id;
    const res = db.exec(`SELECT nombre, apellido, cedula FROM
