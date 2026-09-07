/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/database/init_db.js
 * DESCRIPCIÓN: Script de ejecución de migraciones en MySQL (V1 + V2 + V3)
 * USO: npm run init-db
 * ==========================================================
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('--- INICIALIZADOR DE BASE DE DATOS DEL CAMPO A TUS MANOS ---');
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT, 10) || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'del_campo_a_tus_manos';

    console.log(`Conectando al servidor MySQL en ${host}:${port}...`);
    try {
        const rootConn = await mysql.createConnection({ host, port, user, password });
        console.log(`Creando base de datos '${database}' si no existe...`);
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await rootConn.end();

        const dbConn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
        console.log(`Conectado a '${database}'.`);

        const v1Path = path.join(__dirname, 'migrations', 'V1__init.sql');
        const v2Path = path.join(__dirname, 'migrations', 'V2__seed_data.sql');

        console.log(`Leyendo y ejecutando V1__init.sql...`);
        const v1Sql = fs.readFileSync(v1Path, 'utf8');
        await dbConn.query(v1Sql);
        console.log(`✓ V1__init.sql ejecutado exitosamente.`);

        console.log(`Leyendo y ejecutando V2__seed_data.sql...`);
        const v2Sql = fs.readFileSync(v2Path, 'utf8');
        await dbConn.query(v2Sql);
        console.log(`✓ V2__seed_data.sql ejecutado exitosamente.`);

        const v3Path = path.join(__dirname, 'migrations', 'V3__password_reset_otp.sql');
        if (fs.existsSync(v3Path)) {
            console.log(`Leyendo y ejecutando V3__password_reset_otp.sql...`);
            const v3Sql = fs.readFileSync(v3Path, 'utf8');
            await dbConn.query(v3Sql);
            console.log(`✓ V3__password_reset_otp.sql ejecutado exitosamente.`);
        }

        console.log('--- BASE DE DATOS INICIALIZADA SATISFACTORIAMENTE ---');
        await dbConn.end();
        process.exit(0);
    } catch (err) {
        console.error('ERROR AL INICIALIZAR BASE DE DATOS:', err.message);
        console.error('Asegúrate de que el servicio MySQL esté activo en el puerto indicado.');
        process.exit(1);
    }
}

main();
