const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const { randomUUID } = require("crypto");
const TABLE = process.env.LIBROS_TABLE;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const respuesta = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const leerBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
};

const validar = (data) => {
  if (!data) {
    return "El cuerpo debe ser un JSON válido";
  }

  if (typeof data.titulo !== "string" || !data.titulo.trim()) {
    return '"titulo" es obligatorio y debe ser texto';
  }

  if (typeof data.autor !== "string" || !data.autor.trim()) {
    return '"autor" es obligatorio y debe ser texto';
  }

  if (typeof data.isbn !== "string" || !data.isbn.trim()) {
    return '"isbn" es obligatorio y debe ser texto';
  }

  if (
    typeof data.anioPublicacion !== "number" ||
    !Number.isInteger(data.anioPublicacion) ||
    data.anioPublicacion < 0
  ) {
    return '"anioPublicacion" debe ser un número entero válido';
  }

  if (typeof data.genero !== "string" || !data.genero.trim()) {
    return '"genero" es obligatorio y debe ser texto';
  }

  if (data.disponible !== undefined && typeof data.disponible !== "boolean") {
    return '"disponible" debe ser booleano';
  }

  return null;
};

// CREATE - POST /libros
module.exports.crear = async (event) => {
  const data = leerBody(event);
  const error = validar(data);
  if (error) return respuesta(400, { error });

  const libro = {
    id: randomUUID(),
    titulo: data.titulo.trim(),
    autor: data.autor.trim(),
    isbn: data.isbn.trim(),
    anioPublicacion: data.anioPublicacion,
    genero: data.genero.trim(),
    disponible: data.disponible ?? true,
    creadoEn: new Date().toISOString(),
  };

  try {
    await db.send(new PutCommand({ TableName: TABLE, Item: libro }));
    return respuesta(201, libro);
  } catch (err) {
    console.error(err);

    return respuesta(500, {
      error: "No fue posible crear el libro",
    });
  }
};

// READ ALL - GET /libros?limit=5
module.exports.listar = async (event) => {
  try {
    const limit = Number(event.queryStringParameters?.limit) || 5;

    const params = {
      TableName: TABLE,
      Limit: limit,
    };

    const lastKey = event.queryStringParameters?.lastKey;

    if (lastKey) {
      params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));
    }

    const resultado = await db.send(new ScanCommand(params));

    return respuesta(200, {
      items: resultado.Items || [],
      lastKey: resultado.LastEvaluatedKey
        ? encodeURIComponent(JSON.stringify(resultado.LastEvaluatedKey))
        : null,
    });
  } catch (err) {
    console.error(err);

    return respuesta(500, {
      error: "No fue posible listar los libros",
    });
  }
};

// READ ONE - GET /libros/{id}
module.exports.obtener = async (event) => {
  const { id } = event.pathParameters;

  try {
    const { Item } = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { id },
      }),
    );

    if (!Item) return respuesta(404, { error: "Libro no encontrado" });

    return respuesta(200, Item);
  } catch (err) {
    console.error(err);
    return respuesta(500, {
      error: "No fue posible consultar el libro",
    });
  }
};

// READ BY AUTHOR - GET /libros/autor/{autor}
module.exports.buscarPorAutor = async (event) => {
  const { autor } = event.pathParameters;
  try {
    const { Items } = await db.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "AutorIndex",
        KeyConditionExpression: "autor = :autor",
        ExpressionAttributeValues: {
          ":autor": autor,
        },
      }),
    );
    return respuesta(200, Items);
  } catch (err) {
    console.error(err);
    return respuesta(500, {
      error: "No fue posible consultar los libros por autor",
    });
  }
};

// PUT /libros/{id}
module.exports.actualizar = async (event) => {
  const { id } = event.pathParameters;
  const data = leerBody(event);
  const error = validar(data);
  if (error) return respuesta(400, { error });

  try {
    const resultado = await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        UpdateExpression: `
          SET titulo = :titulo,
              autor = :autor,
              isbn = :isbn,
              anioPublicacion = :anioPublicacion,
              genero = :genero,
              disponible = :disponible
        `,

        ExpressionAttributeValues: {
          ":titulo": data.titulo.trim(),
          ":autor": data.autor.trim(),
          ":isbn": data.isbn.trim(),
          ":anioPublicacion": data.anioPublicacion,
          ":genero": data.genero.trim(),
          ":disponible": data.disponible ?? true,
        },
        ConditionExpression: "attribute_exists(id)",

        ReturnValues: "ALL_NEW",
      }),
    );
    return respuesta(200, resultado.Attributes);
  } catch (err) {
    console.error(err);
    if (err.name === "ConditionalCheckFailedException") {
      return respuesta(404, {
        error: "Libro no encontrado",
      });
    }
    return respuesta(500, {
      error: "No fue posible actualizar el libro",
    });
  }
};

//PATCH /libros/{id}
module.exports.parcial = async (event) => {
  const { id } = event.pathParameters;

  const data = leerBody(event);

  if (!data) {
    return respuesta(400, {
      error: "El cuerpo debe ser un JSON válido",
    });
  }

  const camposPermitidos = [
    "titulo",
    "autor",
    "isbn",
    "anioPublicacion",
    "genero",
    "disponible",
  ];

  const campos = Object.keys(data).filter((campo) =>
    camposPermitidos.includes(campo),
  );

  if (campos.length === 0) {
    return respuesta(400, {
      error: "Debe enviar al menos un campo válido",
    });
  }

  const valores = {};
  const expresiones = [];

  for (const campo of campos) {
    expresiones.push(`${campo} = :${campo}`);
    valores[`:${campo}`] = data[campo];
  }

  try {
    const resultado = await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id },

        UpdateExpression: `SET ${expresiones.join(", ")}`,

        ExpressionAttributeValues: valores,

        ConditionExpression: "attribute_exists(id)",

        ReturnValues: "ALL_NEW",
      }),
    );

    return respuesta(200, resultado.Attributes);
  } catch (err) {
    console.error(err);

    if (err.name === "ConditionalCheckFailedException") {
      return respuesta(404, {
        error: "Libro no encontrado",
      });
    }

    return respuesta(500, {
      error: "No fue posible actualizar el libro",
    });
  }
};

// DELETE /libros/{id}
module.exports.eliminar = async (event) => {
  const { id } = event.pathParameters;

  try {
    await db.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { id },
        ConditionExpression: "attribute_exists(id)",
      }),
    );

    return respuesta(200, {
      mensaje: "Libro eliminado correctamente",
    });
  } catch (err) {
    console.error(err);

    if (err.name === "ConditionalCheckFailedException") {
      return respuesta(404, {
        error: "Libro no encontrado",
      });
    }

    return respuesta(500, {
      error: "No fue posible eliminar el libro",
    });
  }
};
