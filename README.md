# Lab 3 — API Serverless de Biblioteca (Libros)

API REST serverless para administrar libros, construida con **AWS Lambda + API Gateway (HTTP API) + DynamoDB** y definida como infraestructura como código con **Serverless Framework**. Incluye un frontend en **React + Vite** para probar el sistema de forma visual.

---

## 1. ¿Qué hace el sistema?

El sistema expone una API que administra el catálogo de libros de una biblioteca. Cada operación del CRUD es atendida por **una función Lambda independiente**, y los datos persisten en **una tabla de DynamoDB**.

- **CRUD completo** de libros con validación de datos y códigos HTTP correctos (`200`, `201`, `400`, `404`, `500`).
- **Búsqueda por autor** mediante un _Global Secondary Index_ (GSI) `AutorIndex` con `QueryCommand` en lugar de `Scan`.
- **Actualización parcial** (`PATCH`) que solo modifica los campos enviados.
- **Paginación** en el listado mediante `limit` y `lastKey` (`LastEvaluatedKey`).
- **Permisos IAM de mínimo privilegio**: las Lambdas solo pueden operar sobre su propia tabla y su índice.
- **CORS habilitado** para que el frontend pueda consumir la API desde el navegador.
- **Frontend React** que consume la API real desplegada en AWS.

---

## 2. Estructura del proyecto

```
CloudLab3/
├── README.md
├── AWS Serverless.postman_collection.json
├── .gitignore
│
├── lab3libreria/
│   ├── serverless.yml
│   ├── handler.js
│   ├── package.json
│   ├── package-lock.json
│   └── .serverless/
│       ├── cloudformation-template-update-stack.json
│       ├── serverless-state.json
│       ├── lab3libreria.zip
│       └── meta.json
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── eslint.config.js
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── App.css
        └── assets/
            ├── hero.png
            ├── react.svg
            └── vite.svg
```

Cada carpeta tiene su propio `package.json` y su propia forma de instalar. `lab3libreria/` es el backend
serverless (se despliega en AWS) y `frontend/` es la SPA de React que consume la API.

---

## 3. La entidad: Libro

Para el desarrollo de este laboratorio se opto por trabajar con la entidad libro, y crear un sistema similar a una biblioteca.
Cada libro tiene **6 atributos de negocio** (más 2 generados por el sistema), superando el mínimo de 4 exigidos.

| Atributo          | Tipo    | Obligatorio | Notas                                                             |
| :---------------- | :------ | :---------- | :---------------------------------------------------------------- |
| `id`              | String  | Automático  | UUID generado con `crypto.randomUUID()`. Es la _partition key_.   |
| `titulo`          | String  | Sí          | Texto no vacío (se aplica `.trim()`).                             |
| `autor`           | String  | Sí          | Texto no vacío. Es la _partition key_ del GSI `AutorIndex`.       |
| `isbn`            | String  | Sí          | Texto no vacío.                                                   |
| `anioPublicacion` | Number  | Sí          | Número entero `>= 0`.                                             |
| `genero`          | String  | Sí          | Texto no vacío.                                                   |
| `disponible`      | Boolean | No          | Si se omite, se guarda `true`.                                    |
| `creadoEn`        | String  | Automático  | Fecha ISO `new Date().toISOString()`. Solo se escribe en `crear`. |

**Ejemplo de documento almacenado:**

```json
{
  "id": "d8ee9891-9a9b-46af-ac69-ffe8c113252e",
  "titulo": "Ficciones",
  "autor": "Jorge Luis Borges",
  "isbn": "978-8497593373",
  "anioPublicacion": 1944,
  "genero": "Cuento / Ficción filosófica",
  "disponible": true,
  "creadoEn": "2026-09-27T21:40:00.000Z"
}
```

---

## 4. Endpoints

URL base: `https://<id-api>.execute-api.us-east-1.amazonaws.com`
(La de este despliegue es `https://8i7wq7gtdl.execute-api.us-east-1.amazonaws.com`)

### 4.1 Tabla de rutas

| Método   | Ruta                    | Función Lambda   | Éxito                                                      | Errores                                                                          |
| :------- | :---------------------- | :--------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------- |
| `POST`   | `/libros`               | `crear`          | `201` con el libro creado                                  | `400` validación · `500` error interno                                           |
| `GET`    | `/libros`               | `listar`         | `200` con `{ items, lastKey }`                             | `500` error interno                                                              |
| `GET`    | `/libros/{id}`          | `obtener`        | `200` con el libro                                         | `404` no existe · `500` error interno                                            |
| `GET`    | `/libros/autor/{autor}` | `buscarPorAutor` | `200` con un arreglo de libros                             | `500` error interno                                                              |
| `PATCH`  | `/libros/{id}`          | `parcial`        | `200` con el libro actualizado                             | `400` body inválido o sin campos válidos · `404` no existe · `500` error interno |
| `PUT`    | `/libros/{id}`          | `actualizar`     | `200` con el libro actualizado                             | `400` validación · `404` no existe · `500` error interno                         |
| `DELETE` | `/libros/{id}`          | `eliminar`       | `200` con `{ "mensaje": "Libro eliminado correctamente" }` | `404` no existe · `500` error interno                                            |

**Headers:** todas las respuestas llevan `Content-Type: application/json`. Las peticiones con body necesitan
`Content-Type: application/json`.

**Bodies y query strings:**

| Endpoint             | Body / Query                                                                                                       |
| :------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `POST /libros`       | `{ "titulo", "autor", "isbn", "anioPublicacion", "genero", "disponible"? }` — los 5 primeros obligatorios          |
| `GET /libros`        | `?limit=` (por defecto **5**) · `?lastKey=` (cursor de la página anterior)                                         |
| `PATCH /libros/{id}` | Solo los campos a cambiar, de la lista blanca `titulo`, `autor`, `isbn`, `anioPublicacion`, `genero`, `disponible` |
| `PUT /libros/{id}`   | Body **completo** con los 5 campos obligatorios (misma validación que `POST`)                                      |

---

## 5. Requisitos previos

| Requisito                                                  | Versión / detalle                                                                                                                     |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js                                                    | 20 o superior (probado con v22.16.0). El runtime de Lambda es `nodejs24.x`.                                                           |
| npm                                                        | 9 o superior.                                                                                                                         |
| Serverless Framework **v4**                                | Instalado **globalmente**: `npm install -g serverless` (verificado con v4.43.0).                                                      |
| Cuenta en AWS                                              | Activa, con permisos sobre Lambda, API Gateway, DynamoDB, IAM, CloudFormation, S3 y CloudWatch Logs.                                  |
| Cuenta en [app.serverless.com](https://app.serverless.com) | **Obligatoria en Serverless v3+.** La organización del proyecto es `cloud202602` (campo `org` en `serverless.yml`).                   |
| Credenciales de AWS                                        | Las que use Serverless para desplegar: panel de Serverless Framework, variables de entorno, perfil de AWS CLI o `~/.aws/credentials`. |
| Postman o Insomnia                                         | Para las pruebas por línea de comandos (opcional, hay frontend).                                                                      |
| Navegador moderno                                          | Para el frontend (usa `fetch` y el React Compiler).                                                                                   |

---

## 6. Instalación y despliegue del backend (`lab3libreria`)

Serverless v3+ exige un **Access Key** de app.serverless.com, así que el primer paso es autenticarse:

```bash
serverless login
serverless whoami
```

Es necesario cambiar el campo `org` de
`serverless.yml:2` por la organización de tu cuenta en [app.serverless.com](https://app.serverless.com)

Luego, desde la carpeta del servicio:

```bash
cd lab3libreria
npm install
serverless deploy
```

`serverless deploy` imprime al final las URLs de los endpoints. **Guarda esa URL**: es la que necesita el
frontend y Postman.

Para probar en local (usa la **tabla real de AWS**, así que hay que haber desplegado antes y tener
credenciales válidas):

```bash
serverless offline
```

---

## 7. Instalación y ejecución del frontend (`frontend`)

El frontend es una SPA independiente. **No se despliega junto con la API**: es una herramienta de prueba
visual que corre en tu máquina y consume la API real en AWS.

```bash
cd frontend
npm install
```

Antes de levantarlo, apunta el frontend a tu API. Abre `frontend/src/App.jsx` y edita la constante de la
**línea 4**:

```javascript
const API_URL = "https://8i7wq7gtdl.execute-api.us-east-1.amazonaws.com";
```

| Escenario                              | Valor de `API_URL`                                       |
| :------------------------------------- | :------------------------------------------------------- |
| API desplegada en AWS                  | `https://8i7wq7gtdl.execute-api.us-east-1.amazonaws.com` |
| Pruebas locales (`serverless offline`) | `http://localhost:3000`                                  |

CORS ya está habilitado en la HTTP API (`allowedOrigins: ["*"]`), así que no hace falta configurar nada más.

```bash
npm run dev
```

---

## 8. Pruebas

### 8.1 Con el frontend (prueba visual)

1. Despliega la API: `cd lab3libreria && serverless deploy`.
2. Copia la URL en `frontend/src/App.jsx` línea 4.
3. En otra terminal: `cd frontend && npm run dev`.
4. Abre `http://localhost:5173` y ejercita: crear → buscar por autor → cambiar disponibilidad → eliminar.

### 8.2 Con la colección de Postman

El repositorio incluye **`AWS Serverless.postman_collection.json`** con las 7 peticiones ya configuradas:
`GET ALL` · `GET ONE` · `GET BY AUTOR` · `POST LIBRO` · `PUT LIBRO` · `PATCH LIBRO` · `DELETE LIBRO`.

1. Postman → **Import** → selecciona `AWS Serverless.postman_collection.json`.
2. Edita la variable de entorno **`baseURL`** de la colección (viene **vacía**) con la URL de tu despliegue,
   o con `http://localhost:3000` si usas `serverless offline`.
