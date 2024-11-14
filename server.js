require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const redis = require('redis');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'A1234',
    database: process.env.DB_NAME || 'cine'
});

db.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err);
    } else {
        console.log('Conectado a la base de datos MySQL');
    }
});

app.use(express.static(__dirname + '/public'));

// Configuración de la conexión a Redis
const redisClient = redis.createClient();
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

// caché en Redis
async function manageCache(key, data) {
    let cacheData = await redisClient.hGetAll('actor_cache');

    // Verificar si la clave ya está en el caché
    if (cacheData[key]) {
        cacheData[key].count++;
        await redisClient.hSet('actor_cache', key, JSON.stringify(cacheData[key]));
    } else {
        // Si el caché tiene 5 elementos, eliminar el menos accedido
        if (Object.keys(cacheData).length >= 5) {
            let leastAccessedKey;
            let minAccessCount = Infinity;

            for (const k in cacheData) {
                const entry = JSON.parse(cacheData[k]);
                if (entry.count < minAccessCount) {
                    minAccessCount = entry.count;
                    leastAccessedKey = k;
                }
            }

            await redisClient.hDel('actor_cache', leastAccessedKey);
        }

        // Agregar nuevo elemento al caché
        await redisClient.hSet('actor_cache', key, JSON.stringify({ data, count: 1 }));
    }
}

// Ruta para buscar actor por nombre y guardar en caché
app.get('/actors/:name', async (req, res) => {
    const actorName = req.params.name;

    // Verificar si el actor está en el caché
    const cacheEntry = await redisClient.hGet('actor_cache', actorName);
    if (cacheEntry) {
        const parsedEntry = JSON.parse(cacheEntry);
        parsedEntry.count++;
        await redisClient.hSet('actor_cache', actorName, JSON.stringify(parsedEntry));
        return res.json(parsedEntry.data);
    }

    // Consultar la base de datos si no está en caché
    const query = 'SELECT primaryName, birthYear, deathYear, primaryProfession, knownForTitle FROM combined WHERE primaryName = ?';
    db.query(query, [actorName], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: err });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Actor no encontrado' });
        }

        const actorData = results[0];
        await manageCache(actorName, actorData);
        res.json(actorData);
    });
});

// Ruta para eliminar actor por nombre
app.delete('/actors/:name', (req, res) => {
    const actorName = req.params.name;
    const query = 'DELETE FROM combined WHERE primaryName = ?';

    db.query(query, [actorName], async (err, result) => {
        if (err) {
            return res.status(500).json({ error: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Actor no encontrado para eliminar' });
        }

        // Eliminar del caché
        await redisClient.hDel('actor_cache', actorName);
        res.json({ message: `Actor ${actorName} eliminado con éxito` });
    });
});

// Ruta para obtener los datos de la caché
app.get('/cache', async (req, res) => {
    let cacheData = await redisClient.hGetAll('actor_cache');
    let formattedCache = Object.entries(cacheData).map(([key, value]) => ({
        key,
        ...JSON.parse(value),
    }));
    res.json(formattedCache);
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
