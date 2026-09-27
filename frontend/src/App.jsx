import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_URL = "https://8i7wq7gtdl.execute-api.us-east-1.amazonaws.com";

function App() {
  const [libros, setLibros] = useState([]);

  const [formulario, setFormulario] = useState({
    titulo: "",
    autor: "",
    isbn: "",
    anioPublicacion: "",
    genero: "",
    disponible: true,
  });

  const [autorBusqueda, setAutorBusqueda] = useState("");

  const [mensaje, setMensaje] = useState("");

  // ==============================
  // GET /libros
  // ==============================

  const listarLibros = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/libros`);

      if (!response.ok) {
        throw new Error("No fue posible obtener los libros");
      }

      const data = await response.json();

      // Si usamos paginación, la API devolverá { items, lastKey }
      if (Array.isArray(data)) {
        setLibros(data);
      } else {
        setLibros(data.items || []);
      }
    } catch (error) {
      setMensaje(error.message);
    }
  }, []);

  // Ejecutar al cargar la página
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    listarLibros();
  }, [listarLibros]);

  // ==============================
  // POST /libros
  // ==============================

  async function crearLibro(event) {
    event.preventDefault();

    try {
      const response = await fetch(`${API_URL}/libros`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titulo: formulario.titulo,
          autor: formulario.autor,
          isbn: formulario.isbn,
          anioPublicacion: Number(formulario.anioPublicacion),
          genero: formulario.genero,
          disponible: formulario.disponible,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible crear el libro");
      }

      setMensaje("Libro creado correctamente");

      setFormulario({
        titulo: "",
        autor: "",
        isbn: "",
        anioPublicacion: "",
        genero: "",
        disponible: true,
      });

      await listarLibros();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  // ==============================
  // PATCH /libros/{id}
  // ==============================

  async function cambiarDisponibilidad(libro) {
    try {
      const response = await fetch(`${API_URL}/libros/${libro.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          disponible: !libro.disponible,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible actualizar el libro");
      }

      setMensaje("Libro actualizado correctamente");

      await listarLibros();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  // ==============================
  // DELETE /libros/{id}
  // ==============================

  async function eliminarLibro(id) {
    const confirmar = window.confirm("¿Está seguro de eliminar este libro?");

    if (!confirmar) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/libros/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible eliminar el libro");
      }

      setMensaje("Libro eliminado correctamente");

      await listarLibros();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  // ==============================
  // GET /libros/autor/{autor}
  // ==============================

  async function buscarPorAutor(event) {
    event.preventDefault();

    if (!autorBusqueda.trim()) {
      listarLibros();
      return;
    }

    try {
      const autor = encodeURIComponent(autorBusqueda.trim());

      const response = await fetch(`${API_URL}/libros/autor/${autor}`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible realizar la búsqueda");
      }

      setLibros(data);

      setMensaje(`Libros encontrados para: ${autorBusqueda}`);
    } catch (error) {
      setMensaje(error.message);
    }
  }

  // ==============================
  // Manejar formulario
  // ==============================

  function cambiarCampo(event) {
    const { name, value, type, checked } = event.target;

    setFormulario({
      ...formulario,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  return (
    <div className="app">
      <header>
        <h1>Biblioteca</h1>
        <p>Gestión de libros</p>
      </header>

      {mensaje && <div className="mensaje">{mensaje}</div>}

      {/* ==========================
          CREAR LIBRO
      ========================== */}

      <section className="card">
        <h2>Agregar libro</h2>

        <form onSubmit={crearLibro}>
          <input
            type="text"
            name="titulo"
            placeholder="Título"
            value={formulario.titulo}
            onChange={cambiarCampo}
            required
          />

          <input
            type="text"
            name="autor"
            placeholder="Autor"
            value={formulario.autor}
            onChange={cambiarCampo}
            required
          />

          <input
            type="text"
            name="isbn"
            placeholder="ISBN"
            value={formulario.isbn}
            onChange={cambiarCampo}
            required
          />

          <input
            type="number"
            name="anioPublicacion"
            placeholder="Año de publicación"
            value={formulario.anioPublicacion}
            onChange={cambiarCampo}
            required
          />

          <input
            type="text"
            name="genero"
            placeholder="Género"
            value={formulario.genero}
            onChange={cambiarCampo}
            required
          />

          <label className="checkbox">
            <input
              type="checkbox"
              name="disponible"
              checked={formulario.disponible}
              onChange={cambiarCampo}
            />
            Disponible
          </label>

          <button type="submit">Crear libro</button>
        </form>
      </section>

      {/* ==========================
          BUSCAR POR AUTOR
      ========================== */}

      <section className="card">
        <h2>Buscar por autor</h2>

        <form onSubmit={buscarPorAutor} className="search">
          <input
            type="text"
            placeholder="Nombre del autor"
            value={autorBusqueda}
            onChange={(event) => setAutorBusqueda(event.target.value)}
          />

          <button type="submit">Buscar</button>

          <button
            type="button"
            onClick={() => {
              setAutorBusqueda("");
              listarLibros();
            }}
          >
            Ver todos
          </button>
        </form>
      </section>

      {/* ==========================
          LISTADO
      ========================== */}

      <section className="card">
        <div className="list-header">
          <h2>Libros</h2>

          <button onClick={listarLibros}>Actualizar</button>
        </div>

        {libros.length === 0 ? (
          <p>No hay libros para mostrar.</p>
        ) : (
          <div className="libros">
            {libros.map((libro) => (
              <article className="libro" key={libro.id}>
                <div>
                  <h3>{libro.titulo}</h3>

                  <p>
                    <strong>Autor:</strong> {libro.autor}
                  </p>

                  <p>
                    <strong>ISBN:</strong> {libro.isbn}
                  </p>

                  <p>
                    <strong>Año:</strong> {libro.anioPublicacion}
                  </p>

                  <p>
                    <strong>Género:</strong> {libro.genero}
                  </p>

                  <p>
                    <strong>Estado:</strong>{" "}
                    {libro.disponible ? "Disponible" : "No disponible"}
                  </p>
                </div>

                <div className="acciones">
                  <button onClick={() => cambiarDisponibilidad(libro)}>
                    Cambiar disponibilidad
                  </button>

                  <button
                    className="eliminar"
                    onClick={() => eliminarLibro(libro.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
