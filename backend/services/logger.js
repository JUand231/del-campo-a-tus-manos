/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/services/logger.js
 * DESCRIPCIÓN: Logger con niveles y volcado a archivo diario (TRD §5, D12)
 * - Niveles: info / warn / error. warn y error también salen por consola.
 * - Archivo diario backend/logs/app-AAAA-MM-DD.log, retención 14 días.
 * - Nunca lanza: un fallo de logging jamás tumba la aplicación.
 * ==========================================================
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const RETENTION_DAYS = 14;
let prunedDate = '';

function ensureDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function dailyFile() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return path.join(LOG_DIR, `app-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.log`);
}

function pruneOld() {
    try {
        const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(LOG_DIR).filter((f) => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(f));
        for (const f of files) {
            const full = path.join(LOG_DIR, f);
            if (fs.statSync(full).mtimeMs < cutoff) {
                fs.unlinkSync(full);
            }
        }
    } catch (e) {
        // noop: la poda es best-effort
    }
}

function write(level, message) {
    try {
        ensureDir();
        const today = new Date().toISOString().slice(0, 10);
        if (prunedDate !== today) {
            prunedDate = today;
            pruneOld();
        }
        fs.appendFileSync(dailyFile(), `[${new Date().toISOString()}] [${level}] ${message}\n`);
    } catch (e) {
        // noop: el logging nunca debe romper el flujo principal
    }
}

module.exports = {
    info: (message) => write('INFO', message),
    warn: (message) => { write('WARN', message); console.warn(message); },
    error: (message) => { write('ERROR', message); console.error(message); }
};
