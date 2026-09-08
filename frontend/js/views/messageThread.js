/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/messageThread.js
 * DESCRIPCIÓN: Hilo de mensajes reutilizable (RF-10, ticket M4)
 * - Burbujas propias/ajenas, envío, marca de leídos y polling 15s.
 * - Sin websockets (Fase-2-simple, documentado en TRD).
 * ==========================================================
 */

import { api } from '../api.js';
import { store, showToast } from '../store.js';

const POLL_MS = 15000;
const timers = new Map();
let badgeListenerOn = false;

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
    try {
        return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

/** Bloque plegable para incrustar en la tarjeta del pedido. */
export function threadToggleHTML(pedidoId, unreadCount = 0) {
    return `
    <div class="pt-3 border-t border-border" data-thread-root="${pedidoId}">
        <button class="btn-thread-toggle text-xs font-bold flex items-center gap-1.5 hover:underline" style="color: var(--color-primary);" data-id="${pedidoId}">
            <span class="material-symbols-outlined text-[18px]">forum</span>
            Mensajes
            ${Number(unreadCount) > 0 ? `<span data-unread-badge class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style="background-color: var(--color-secondary);">${unreadCount} nuevos</span>` : ''}
        </button>
        <div class="thread-box hidden mt-3" data-thread-box="${pedidoId}"></div>
    </div>`;
}

/** Cablea los toggles dentro de un contenedor ya renderizado. */
export function attachThreadToggles(root) {
    initThreadBadgeCleaner();
    root.querySelectorAll('.btn-thread-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const box = root.querySelector(`[data-thread-box="${id}"]`);
            if (!box) return;
            const opening = box.classList.contains('hidden');
            box.classList.toggle('hidden');
            if (opening) {
                await loadThread(box, id);
            } else {
                stopThread(box);
            }
        });
    });
}

/** Limpia insignias de un pedido cuando se lee su hilo (una sola suscripción global). */
export function initThreadBadgeCleaner() {
    if (badgeListenerOn) return;
    badgeListenerOn = true;
    window.addEventListener('thread-read', (e) => {
        const id = e.detail && e.detail.pedidoId;
        if (id === undefined || id === null) return;
        document.querySelectorAll(`[data-thread-root="${id}"] [data-unread-badge]`).forEach(el => el.remove());
    });
}

export function stopThread(box) {
    const t = timers.get(box);
    if (t) {
        clearInterval(t);
        timers.delete(box);
    }
}

export async function loadThread(box, pedidoId) {
    stopThread(box);
    box.innerHTML = `
        <div data-msg-list class="space-y-2 max-h-64 overflow-y-auto pr-1">
            <p class="text-xs text-text-secondary">Cargando mensajes...</p>
        </div>
        <form data-msg-form class="flex gap-2 mt-3">
            <input data-msg-input type="text" maxlength="1000" placeholder="Escribe un mensaje al productor/comprador..."
                   class="flex-1 h-10 px-3 border border-border rounded-xl text-xs focus:outline-none focus:border-primary">
            <button type="submit" class="btn-primary-cta text-xs px-3 h-10 min-w-[44px] shrink-0" aria-label="Enviar mensaje">
                <span class="material-symbols-outlined text-[18px]">send</span>
            </button>
        </form>
        <div data-msg-error class="text-[11px] text-red-600 font-semibold hidden mt-1"></div>
    `;

    const form = box.querySelector('[data-msg-form]');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = box.querySelector('[data-msg-input]');
        const errDiv = box.querySelector('[data-msg-error]');
        const texto = input.value.trim();
        if (!texto) return;
        if (texto.length > 1000) {
            errDiv.textContent = 'Máximo 1000 caracteres.';
            errDiv.classList.remove('hidden');
            return;
        }
        errDiv.classList.add('hidden');
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            await api.postOrderMessage(pedidoId, texto);
            input.value = '';
            await refreshList(false);
        } catch (err) {
            errDiv.textContent = err.message;
            errDiv.classList.remove('hidden');
        } finally {
            btn.disabled = false;
        }
    });

    const refreshList = async (silent = false) => {
        const list = box.querySelector('[data-msg-list]');
        if (!list) return;
        try {
            const res = await api.getOrderMessages(pedidoId);
            paintList(list, res.mensajes || []);
            if (!silent) {
                api.markMessagesRead(pedidoId).catch(() => {});
                window.dispatchEvent(new CustomEvent('thread-read', { detail: { pedidoId: Number(pedidoId) } }));
            }
        } catch (err) {
            if (!silent) {
                list.innerHTML = `<p class="text-xs text-red-600">${esc(err.message)}</p>`;
            }
        }
    };

    const paintList = (list, msgs) => {
        const myId = Number(store.getUser()?.id);
        if (!msgs.length) {
            list.innerHTML = '<p class="text-[11px] text-text-secondary">Aún no hay mensajes. ¡Saluda primero!</p>';
            return;
        }
        list.innerHTML = msgs.map(m => {
            const mine = Number(m.autor_id) === myId;
            return `
            <div class="flex ${mine ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[85%] rounded-xl px-3 py-2 text-xs ${mine ? 'text-white' : 'bg-[#F5F3F3] text-on-surface'}" style="${mine ? 'background-color: var(--color-primary);' : ''}">
                    <div class="text-[10px] font-bold opacity-80 mb-0.5">${esc(m.autor_nombre)} · ${fmtDate(m.created_at)}</div>
                    <div class="leading-relaxed">${esc(m.mensaje)}</div>
                </div>
            </div>`;
        }).join('');
        list.scrollTop = list.scrollHeight;
    };

    await refreshList(false);

    const t = setInterval(() => {
        if (!document.contains(box) || box.classList.contains('hidden')) {
            stopThread(box);
            return;
        }
        refreshList(true);
    }, POLL_MS);
    timers.set(box, t);
}
