/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/store.js
 * DESCRIPCIÓN: Manejo de estado de sesión, usuario activo y notificaciones Toast
 * ==========================================================
 */

export const store = {
    getUser() {
        const u = localStorage.getItem('dcm_user');
        return u ? JSON.parse(u) : null;
    },

    getToken() {
        // D5: el JWT vive en cookie HttpOnly, inaccesible a JavaScript.
        // Se conserva el método para no romper llamadas existentes; siempre null.
        return null;
    },

    setSession(user) {
        localStorage.setItem('dcm_user', JSON.stringify(user));
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: user }));
    },

    clearSession() {
        localStorage.removeItem('dcm_user');
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
    },

    isAuthenticated() {
        return !!this.getUser();
    },

    isAdmin() {
        const user = this.getUser();
        return user && String(user.rol_nombre).toUpperCase() === 'ADMIN';
    },

    isProducer() {
        const user = this.getUser();
        return user && String(user.rol_nombre).toUpperCase() === 'PRODUCTOR';
    },

    isBuyer() {
        const user = this.getUser();
        return user && String(user.rol_nombre).toUpperCase() === 'COMPRADOR';
    }
};

/**
 * Muestra una notificación emergente accesible
 */
export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'check_circle';
    if (type === 'error') iconName = 'error';
    if (type === 'warning') iconName = 'warning';

    toast.innerHTML = `
        <span class="material-symbols-outlined text-[20px]" style="color: ${type === 'error' ? '#d32f2f' : (type === 'warning' ? '#f57c00' : '#2e7d32')}">
            ${iconName}
        </span>
        <span class="flex-1 text-on-surface font-medium">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Diálogo de confirmación estético con SweetAlert2 y respaldo moderno integrado
 */
export async function confirmDialog({
    title = '¿Estás seguro?',
    text = '',
    confirmButtonText = 'Sí, confirmar',
    cancelButtonText = 'Cancelar',
    icon = 'warning',
    confirmButtonColor = '#2E7D32'
} = {}) {
    const isDestructive = confirmButtonColor === '#d32f2f' || confirmButtonColor === '#dc2626' || /eliminar|cancelar/i.test(title);
    const mainColor = isDestructive ? '#DC2626' : (confirmButtonColor || '#2E7D32');
    const iconBg = isDestructive ? '#FEE2E2' : '#E8F5E9';
    const iconBorder = isDestructive ? '#FCA5A5' : '#A7F3D0';
    const iconSymbol = isDestructive ? 'delete_forever' : (icon === 'warning' ? 'warning' : 'help');

    if (typeof Swal !== 'undefined') {
        const result = await Swal.fire({
            title,
            text,
            iconHtml: `<span class="material-symbols-outlined" style="font-size: 38px; color: ${mainColor}; line-height: 1; display: flex; align-items: center; justify-content: center;">${iconSymbol}</span>`,
            showCancelButton: true,
            confirmButtonColor: mainColor,
            cancelButtonColor: '#6B7280',
            confirmButtonText,
            cancelButtonText,
            reverseButtons: true,
            focusCancel: true,
            customClass: {
                popup: 'rounded-2xl p-6 shadow-2xl border border-border font-sans',
                icon: 'border-0 !w-16 !h-16 !my-3 !mx-auto !rounded-full !flex !items-center !justify-center',
                title: '!text-lg !font-extrabold !text-gray-900 !pt-2',
                htmlContainer: '!text-xs !text-gray-600 !mt-1',
                confirmButton: '!rounded-xl !font-bold !text-xs !px-5 !py-2.5 !shadow-sm',
                cancelButton: '!rounded-xl !font-bold !text-xs !px-5 !py-2.5'
            },
            didOpen: (popup) => {
                const iconElem = popup.querySelector('.swal2-icon');
                if (iconElem) {
                    iconElem.style.backgroundColor = iconBg;
                    iconElem.style.borderColor = iconBorder;
                    iconElem.style.borderWidth = '2px';
                    iconElem.style.borderStyle = 'solid';
                }
            }
        });
        return result.isConfirmed;
    }

    // Modal moderno estilizado en caso de que Swal no haya cargado por red o CSP
    return new Promise((resolve) => {
        const existing = document.getElementById('custom-confirm-modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'custom-confirm-modal';
        overlay.className = 'fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';

        const isDestructive = confirmButtonColor === '#d32f2f';
        const iconSymbol = isDestructive ? 'delete_forever' : (icon === 'warning' ? 'warning' : 'help');
        const iconColor = isDestructive ? '#d32f2f' : '#2E7D32';
        const iconBg = isDestructive ? '#fee2e2' : '#E8F5E9';

        overlay.innerHTML = `
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-border text-center space-y-4">
                <div class="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style="background-color: ${iconBg};">
                    <span class="material-symbols-outlined text-[30px]" style="color: ${iconColor};">${iconSymbol}</span>
                </div>
                <div>
                    <h3 class="font-extrabold text-base text-on-surface">${title}</h3>
                    <p class="text-xs text-text-secondary mt-1.5 leading-relaxed">${text}</p>
                </div>
                <div class="flex items-center gap-2 pt-2">
                    <button id="custom-confirm-cancel" class="flex-1 h-10 rounded-xl border border-border text-xs font-bold text-text-secondary hover:bg-[#F5F3F3] transition-colors">
                        ${cancelButtonText}
                    </button>
                    <button id="custom-confirm-ok" class="flex-1 h-10 rounded-xl text-white text-xs font-bold shadow-sm transition-transform active:scale-95" style="background-color: ${confirmButtonColor};">
                        ${confirmButtonText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cleanup = (val) => {
            overlay.remove();
            resolve(val);
        };

        overlay.querySelector('#custom-confirm-cancel').addEventListener('click', () => cleanup(false));
        overlay.querySelector('#custom-confirm-ok').addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(false);
        });
    });
}


