/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/authModal.js
 * DESCRIPCIÓN: Modal interactivo de Inicio de Sesión, Registro y Recuperación de Contraseña con OTP
 * ==========================================================
 */

import { api } from '../api.js';
import { store, showToast } from '../store.js';

let authModalElement = null;
let currentMode = 'login'; // 'login' | 'register' | 'forgot'
let forgotStep = 1; // 1: Pedir correo, 2: Pedir OTP + nueva contraseña
let cachedEmail = '';

export function initAuthModal() {
    if (authModalElement) return;

    authModalElement = document.createElement('div');
    authModalElement.id = 'auth-modal-root';
    authModalElement.className = 'modal-overlay hidden';
    document.body.appendChild(authModalElement);

    window.addEventListener('open-auth-modal', (e) => {
        currentMode = e.detail?.mode || 'login';
        forgotStep = 1;
        renderAuthModal();
        authModalElement.classList.remove('hidden');
    });
}

function renderAuthModal() {
    const isLogin = currentMode === 'login';
    const isRegister = currentMode === 'register';
    const isForgot = currentMode === 'forgot';

    let headerTitle = 'Iniciar Sesión en Del Campo a Tus Manos';
    let headerIcon = 'login';
    if (isRegister) {
        headerTitle = 'Crear Cuenta Campesina o Comprador';
        headerIcon = 'person_add';
    } else if (isForgot) {
        headerTitle = 'Recuperar Acceso con Código OTP';
        headerIcon = 'lock_reset';
    }

    authModalElement.innerHTML = `
        <div class="modal-content">
            <div class="flex items-center justify-between pb-3 border-b border-border mb-4">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-[22px]" style="color: var(--color-primary);">
                        ${headerIcon}
                    </span>
                    <h3 class="font-bold text-base text-on-surface">
                        ${headerTitle}
                    </h3>
                </div>
                <button id="btn-close-auth-modal" class="text-text-secondary hover:text-on-surface">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <!-- Botones de Relleno Rápido de Prueba (Demo) -->
            ${isLogin ? `
                <div class="mb-4 p-3 rounded-xl bg-[#F5F3F3] border border-border text-xs">
                    <span class="font-bold text-on-surface block mb-1.5">⚡ Acceso Rápido de Prueba (Evaluadores SENA):</span>
                    <div class="flex flex-wrap gap-1.5">
                        <button type="button" class="btn-demo-fill px-2 py-1 bg-white border border-border rounded-md font-semibold text-[11px] hover:border-primary" data-user="admin">Admin</button>
                        <button type="button" class="btn-demo-fill px-2 py-1 bg-white border border-border rounded-md font-semibold text-[11px] hover:border-primary" data-user="productor">Productor</button>
                        <button type="button" class="btn-demo-fill px-2 py-1 bg-white border border-border rounded-md font-semibold text-[11px] hover:border-primary" data-user="comprador">Comprador</button>
                        <button type="button" class="btn-demo-fill px-2 py-1 bg-white border border-red-200 text-red-700 rounded-md font-semibold text-[11px] hover:bg-red-50" data-user="bloqueado">Inactivo (RF-08)</button>
                    </div>
                </div>
            ` : ''}

            <!-- FORMULARIO LOGIN / REGISTRO -->
            ${!isForgot ? `
                <form id="auth-form" class="space-y-4">
                    ${isRegister ? `
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Nombre Completo *</label>
                            <input id="auth-nombre" type="text" required placeholder="Ej. Ana Milena Rojas"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>

                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Tipo de Usuario *</label>
                            <select id="auth-rol" required class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-white">
                                <option value="3">Comprador (Personas, Familias, Restaurantes)</option>
                                <option value="2">Productor Agrícola (Campesinos, Fincas)</option>
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-xs font-bold text-text-secondary block mb-1">Municipio *</label>
                                <input id="auth-municipio" type="text" required placeholder="Ej. Boyacá - Tibasosa"
                                       class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                            </div>
                            <div>
                                <label class="text-xs font-bold text-text-secondary block mb-1">Teléfono</label>
                                <input id="auth-telefono" type="tel" placeholder="+57 3..."
                                       class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                            </div>
                        </div>
                    ` : ''}

                    <div>
                        <label class="text-xs font-bold text-text-secondary block mb-1">Correo Electrónico *</label>
                        <input id="auth-email" type="email" required value="${cachedEmail}" placeholder="correo@ejemplo.com"
                               class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                    </div>

                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-xs font-bold text-text-secondary">Contraseña *</label>
                            ${isLogin ? `
                                <button type="button" id="btn-switch-to-forgot" class="text-[11px] font-semibold text-primary hover:underline" style="color: var(--color-primary);">
                                    ¿Olvidaste tu contraseña?
                                </button>
                            ` : ''}
                        </div>
                        <input id="auth-password" type="password" required placeholder="Mínimo 6 caracteres" minlength="6"
                               class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                    </div>

                    <!-- Error Inline (USER_FLOW §6) -->
                    <div id="auth-error-msg" class="text-xs text-red-600 font-semibold hidden"></div>

                    <button type="submit" id="btn-submit-auth" class="btn-institutional w-full h-11 text-xs font-bold shadow-sm">
                        <span id="auth-btn-text">${isLogin ? 'Ingresar a mi Cuenta' : 'Registrarme'}</span>
                        <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>

                    <!-- Conmutador entre Login y Registro -->
                    <div class="pt-2 text-center text-xs text-text-secondary">
                        ${isLogin ? `
                            ¿No tienes cuenta todavía? 
                            <button type="button" id="btn-switch-to-register" class="font-bold text-primary hover:underline ml-1" style="color: var(--color-primary);">
                                Regístrate aquí
                            </button>
                        ` : `
                            ¿Ya tienes una cuenta registrada? 
                            <button type="button" id="btn-switch-to-login" class="font-bold text-primary hover:underline ml-1" style="color: var(--color-primary);">
                                Inicia sesión
                            </button>
                        `}
                    </div>
                </form>
            ` : `
                <!-- FORMULARIO RECUPERACIÓN CON OTP -->
                <form id="otp-form" class="space-y-4">
                    ${forgotStep === 1 ? `
                        <p class="text-xs text-text-secondary leading-relaxed">
                            Ingresa el correo electrónico asociado a tu cuenta. Te enviaremos un <strong>código OTP de 6 dígitos</strong> con validez de 10 minutos para verificar tu identidad.
                        </p>

                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Correo Electrónico Registrado *</label>
                            <input id="otp-email" type="email" required value="${cachedEmail}" placeholder="correo@ejemplo.com"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>

                        <div id="otp-error-msg" class="text-xs text-red-600 font-semibold hidden"></div>

                        <button type="submit" id="btn-submit-otp-step1" class="btn-institutional w-full h-11 text-xs font-bold shadow-sm">
                            <span id="otp-step1-btn-text">Enviar Código OTP al Correo</span>
                            <span class="material-symbols-outlined text-[18px]">send</span>
                        </button>
                    ` : `
                        <div class="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
                            <div class="flex items-center gap-1.5 font-bold mb-1">
                                <span class="material-symbols-outlined text-[18px]">mark_email_read</span>
                                Código OTP enviado a: <strong>${cachedEmail}</strong>
                            </div>
                            <p class="text-[11px] text-green-700">Revisa tu bandeja de entrada (o la consola del servidor en desarrollo). Ingresa el código y define tu nueva contraseña:</p>
                        </div>

                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Código de Verificación OTP (6 dígitos) *</label>
                            <input id="otp-code" type="text" required maxlength="6" pattern="[0-9]{6}" placeholder="123456"
                                   class="w-full h-12 px-3 border border-border rounded-xl text-center text-xl font-mono font-bold tracking-widest focus:outline-none focus:border-primary">
                        </div>

                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Nueva Contraseña *</label>
                            <input id="otp-new-password" type="password" required placeholder="Mínimo 6 caracteres" minlength="6"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>

                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Confirmar Nueva Contraseña *</label>
                            <input id="otp-confirm-password" type="password" required placeholder="Repite tu nueva contraseña" minlength="6"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>

                        <div id="otp-error-msg" class="text-xs text-red-600 font-semibold hidden"></div>

                        <button type="submit" id="btn-submit-otp-step2" class="btn-institutional w-full h-11 text-xs font-bold shadow-sm">
                            <span id="otp-step2-btn-text">Guardar Nueva Contraseña</span>
                            <span class="material-symbols-outlined text-[18px]">check_circle</span>
                        </button>

                        <div class="text-center pt-1">
                            <button type="button" id="btn-resend-otp" class="text-[11px] text-text-secondary hover:text-primary underline">
                                ¿No te llegó el código? Reenviar OTP
                            </button>
                        </div>
                    `}

                    <div class="pt-2 text-center text-xs text-text-secondary border-t border-border">
                        <button type="button" id="btn-cancel-forgot" class="font-bold text-primary hover:underline" style="color: var(--color-primary);">
                            ← Volver a Iniciar Sesión
                        </button>
                    </div>
                </form>
            `}
        </div>
    `;

    attachAuthListeners();
}

function attachAuthListeners() {
    const closeBtn = document.getElementById('btn-close-auth-modal');
    closeBtn.addEventListener('click', () => authModalElement.classList.add('hidden'));

    // Conmutadores
    document.getElementById('btn-switch-to-register')?.addEventListener('click', () => {
        currentMode = 'register';
        renderAuthModal();
    });

    document.getElementById('btn-switch-to-login')?.addEventListener('click', () => {
        currentMode = 'login';
        renderAuthModal();
    });

    document.getElementById('btn-switch-to-forgot')?.addEventListener('click', () => {
        const emailInput = document.getElementById('auth-email');
        if (emailInput && emailInput.value) cachedEmail = emailInput.value.trim();
        currentMode = 'forgot';
        forgotStep = 1;
        renderAuthModal();
    });

    document.getElementById('btn-cancel-forgot')?.addEventListener('click', () => {
        currentMode = 'login';
        renderAuthModal();
    });

    document.getElementById('btn-resend-otp')?.addEventListener('click', async () => {
        try {
            showToast('Reenviando código OTP...', 'info');
            const res = await api.solicitarOtp(cachedEmail);
            showToast(res.message || 'Nuevo código enviado a tu correo.', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    });

    // Relleno Demo
    authModalElement.querySelectorAll('.btn-demo-fill').forEach(btn => {
        btn.addEventListener('click', () => {
            const userType = btn.getAttribute('data-user');
            const emailInput = document.getElementById('auth-email');
            const passwordInput = document.getElementById('auth-password');

            if (userType === 'admin') emailInput.value = 'admin@campo.com';
            if (userType === 'productor') emailInput.value = 'carlos.campesino@campo.com';
            if (userType === 'comprador') emailInput.value = 'comprador@campo.com';
            if (userType === 'bloqueado') emailInput.value = 'bloqueado@campo.com';

            passwordInput.value = 'Password123!';
        });
    });

    // Envío del Formulario Login / Registro
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorDiv = document.getElementById('auth-error-msg');
            errorDiv.classList.add('hidden');

            const isLogin = currentMode === 'login';
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            cachedEmail = email;

            const submitBtn = document.getElementById('btn-submit-auth');
            submitBtn.disabled = true;
            document.getElementById('auth-btn-text').textContent = 'Validando...';

            try {
                if (isLogin) {
                    const res = await api.login({ email, password });
                    store.setSession(res.user);
                    showToast(`Bienvenido/a de nuevo, ${res.user.nombre}.`, 'success');
                    authModalElement.classList.add('hidden');
                    
                    if (store.isAdmin()) window.location.hash = '#/admin';
                    else if (store.isProducer()) window.location.hash = '#/productor';
                    else window.location.hash = '#/catalogo';

                } else {
                    const nombre = document.getElementById('auth-nombre').value.trim();
                    const rol_id = document.getElementById('auth-rol').value;
                    const municipio = document.getElementById('auth-municipio').value.trim();
                    const telefono = document.getElementById('auth-telefono').value.trim();

                    const res = await api.register({
                        nombre,
                        email,
                        password,
                        rol_id,
                        municipio,
                        telefono
                    });

                    store.setSession(res.user);
                    showToast('¡Registro exitoso! Bienvenido a Del Campo a Tus Manos.', 'success');
                    authModalElement.classList.add('hidden');

                    if (store.isProducer()) window.location.hash = '#/productor';
                    else window.location.hash = '#/catalogo';
                }
            } catch (err) {
                errorDiv.textContent = err.message;
                errorDiv.classList.remove('hidden');
                submitBtn.disabled = false;
                document.getElementById('auth-btn-text').textContent = isLogin ? 'Ingresar a mi Cuenta' : 'Registrarme';
            }
        });
    }

    // Envío del Formulario OTP
    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorDiv = document.getElementById('otp-error-msg');
            errorDiv.classList.add('hidden');

            if (forgotStep === 1) {
                // Paso 1: Enviar OTP
                const emailInput = document.getElementById('otp-email');
                const email = emailInput.value.trim();
                cachedEmail = email;

                const submitBtn = document.getElementById('btn-submit-otp-step1');
                submitBtn.disabled = true;
                document.getElementById('otp-step1-btn-text').textContent = 'Enviando código...';

                try {
                    const res = await api.solicitarOtp(email);
                    showToast(res.message || 'Código OTP enviado al correo.', 'success');
                    forgotStep = 2;
                    renderAuthModal();
                } catch (err) {
                    errorDiv.textContent = err.message;
                    errorDiv.classList.remove('hidden');
                    submitBtn.disabled = false;
                    document.getElementById('otp-step1-btn-text').textContent = 'Enviar Código OTP al Correo';
                }
            } else {
                // Paso 2: Validar OTP y cambiar contraseña
                const otp = document.getElementById('otp-code').value.trim();
                const newPassword = document.getElementById('otp-new-password').value;
                const confirmPassword = document.getElementById('otp-confirm-password').value;

                if (newPassword !== confirmPassword) {
                    errorDiv.textContent = 'Las contraseñas no coinciden. Por favor verifícalas.';
                    errorDiv.classList.remove('hidden');
                    return;
                }

                const submitBtn = document.getElementById('btn-submit-otp-step2');
                submitBtn.disabled = true;
                document.getElementById('otp-step2-btn-text').textContent = 'Actualizando clave...';

                try {
                    const res = await api.resetPasswordOtp({
                        email: cachedEmail,
                        otp,
                        newPassword
                    });

                    showToast(res.message || '¡Contraseña restablecida con éxito!', 'success');
                    currentMode = 'login';
                    forgotStep = 1;
                    renderAuthModal();
                } catch (err) {
                    errorDiv.textContent = err.message;
                    errorDiv.classList.remove('hidden');
                    submitBtn.disabled = false;
                    document.getElementById('otp-step2-btn-text').textContent = 'Guardar Nueva Contraseña';
                }
            }
        });
    }
}
