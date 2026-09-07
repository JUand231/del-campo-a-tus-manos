/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/catalogView.js
 * DESCRIPCIÓN: Catálogo público con búsqueda y filtros sin recarga (RF-03)
 * REGLAS: Excluye sin stock, estados loading/empty/error (USER_FLOW §6)
 * ==========================================================
 */

import { api } from '../api.js';

let currentCategory = null;
let currentSearch = '';
let currentRegion = 'todos';

export async function renderCatalog(container) {
    container.innerHTML = `
        <div class="flex flex-col w-full">
            <!-- Hero Section (Stitch Mockup Design) -->
            <section class="relative w-full overflow-hidden bg-surface-container-low py-12 px-4 sm:px-8 border-b border-border">
                <div class="max-w-[1200px] mx-auto flex flex-col items-center text-center">
                    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm mb-4 border border-border">
                        <span class="material-symbols-outlined text-primary text-[18px]">eco</span>
                        <span class="font-bold text-xs text-primary uppercase tracking-wider">Cosecha Directa Campesina · Sin Intermediarios</span>
                    </div>
                    <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-on-surface tracking-tight mb-4 max-w-3xl leading-tight">
                        Cosechas frescas del campo directo a tu mesa, <span class="text-primary" style="color: var(--color-primary);">precio justo</span>
                    </h1>
                    <p class="text-base sm:text-lg text-text-secondary max-w-2xl mb-8" style="color: var(--color-text-secondary);">
                        Apoya a las familias campesinas y compra alimentos recién recolectados con transparencia de origen y garantía de frescura.
                    </p>

                    <!-- Barra de Búsqueda y Filtro de Región -->
                    <div class="w-full max-w-3xl bg-white p-2 sm:p-3 rounded-2xl shadow-md border border-border flex flex-col sm:flex-row items-stretch gap-2">
                        <div class="flex-1 flex items-center px-4 bg-[#F5F3F3] rounded-xl h-11">
                            <span class="material-symbols-outlined text-outline text-[22px] mr-2 text-[#707A6C]">search</span>
                            <input id="catalog-search" type="search" placeholder="¿Qué alimento buscas? Ej. Tomate, Papa criolla, Aguacate..." 
                                   class="w-full bg-transparent text-sm focus:outline-none text-[#212121]" value="${currentSearch}">
                        </div>
                        <div class="flex items-center px-3 bg-[#F5F3F3] rounded-xl h-11">
                            <span class="material-symbols-outlined text-[20px] mr-1.5" style="color: var(--color-primary);">location_on</span>
                            <select id="catalog-region" class="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer text-[#616161]">
                                <option value="todos" ${currentRegion === 'todos' ? 'selected' : ''}>Toda Colombia</option>
                                <option value="Boyacá" ${currentRegion === 'Boyacá' ? 'selected' : ''}>Boyacá</option>
                                <option value="Cundinamarca" ${currentRegion === 'Cundinamarca' ? 'selected' : ''}>Cundinamarca</option>
                                <option value="Antioquia" ${currentRegion === 'Antioquia' ? 'selected' : ''}>Antioquia</option>
                                <option value="Santander" ${currentRegion === 'Santander' ? 'selected' : ''}>Santander</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Contenedor Principal de Catálogo -->
            <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8">
                <!-- Categorías (Chips Filtrables) -->
                <div class="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none" id="categories-bar">
                    <button class="cat-chip px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${!currentCategory ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border text-[#616161] hover:border-primary'}" 
                            style="${!currentCategory ? 'background-color: var(--color-primary); color: white;' : ''}" data-cat="">
                        Todas las Cosechas
                    </button>
                    <!-- Las demás categorías se insertan dinámicamente -->
                </div>

                <!-- Resumen de Resultados -->
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-bold text-on-surface" id="catalog-header-title">Productos Disponibles</h2>
                    <span class="text-xs font-medium text-text-secondary" id="catalog-count-badge">Cargando...</span>
                </div>

                <!-- Grid de Productos / Skeletons / Empty State -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="products-grid">
                    <!-- Skeletons iniciales -->
                    ${[1, 2, 3, 4].map(() => `
                        <div class="product-card p-4 space-y-3">
                            <div class="skeleton w-full aspect-[4/3]"></div>
                            <div class="skeleton h-4 w-3/4"></div>
                            <div class="skeleton h-3 w-1/2"></div>
                            <div class="skeleton h-8 w-full mt-4"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Configurar listeners de búsqueda y filtro
    const searchInput = document.getElementById('catalog-search');
    const regionSelect = document.getElementById('catalog-region');

    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        loadProducts();
    });

    regionSelect.addEventListener('change', (e) => {
        currentRegion = e.target.value;
        loadProducts();
    });

    await loadCategories();
    await loadProducts();
}

async function loadCategories() {
    try {
        const res = await api.getCategories();
        const bar = document.getElementById('categories-bar');
        if (!bar || !res.categorias) return;

        const chipsHtml = res.categorias.map(cat => `
            <button class="cat-chip px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${currentCategory === cat.id ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border text-[#616161] hover:border-primary'}" 
                    style="${currentCategory === cat.id ? 'background-color: var(--color-primary); color: white;' : ''}" data-cat="${cat.id}">
                ${cat.nombre}
            </button>
        `).join('');

        bar.innerHTML = `
            <button class="cat-chip px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${!currentCategory ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border text-[#616161] hover:border-primary'}" 
                    style="${!currentCategory ? 'background-color: var(--color-primary); color: white;' : ''}" data-cat="">
                Todas las Cosechas
            </button>
            ${chipsHtml}
        `;

        bar.querySelectorAll('.cat-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const catVal = btn.getAttribute('data-cat');
                currentCategory = catVal ? Number(catVal) : null;
                bar.querySelectorAll('.cat-chip').forEach(b => {
                    b.style.backgroundColor = '';
                    b.style.color = '';
                    b.classList.remove('bg-primary', 'text-white', 'shadow-sm');
                    b.classList.add('bg-white', 'text-[#616161]');
                });
                btn.style.backgroundColor = 'var(--color-primary)';
                btn.style.color = 'white';
                loadProducts();
            });
        });
    } catch (e) {
        console.error('Error cargando categorías:', e);
    }
}

async function loadProducts() {
    const grid = document.getElementById('products-grid');
    const countBadge = document.getElementById('catalog-count-badge');
    if (!grid) return;

    try {
        const params = {};
        if (currentCategory) params.categoria_id = currentCategory;
        if (currentSearch.trim()) params.q = currentSearch.trim();
        if (currentRegion !== 'todos') params.municipio = currentRegion;

        const res = await api.getCatalog(params);
        const productos = res.productos || [];

        countBadge.textContent = `${productos.length} lote(s) disponible(s)`;

        // EMPTY STATE (USER_FLOW §6: ilustración y mensaje claro)
        if (productos.length === 0) {
            grid.className = 'col-span-full py-16 flex flex-col items-center justify-center text-center';
            grid.innerHTML = `
                <div class="w-20 h-20 rounded-full flex items-center justify-center mb-4" style="background-color: var(--color-primary-container);">
                    <span class="material-symbols-outlined text-[40px]" style="color: var(--color-primary);">agriculture</span>
                </div>
                <h3 class="text-lg font-bold text-on-surface mb-2">Todavía no hay productos disponibles en esta categoría</h3>
                <p class="text-sm text-text-secondary max-w-md mb-6" style="color: var(--color-text-secondary);">
                    Los campesinos están recolectando nuevas cosechas o el término de búsqueda no arrojó resultados disponibles con stock.
                </p>
                <button id="btn-reset-filters" class="btn-outline text-xs">
                    <span class="material-symbols-outlined text-[16px]">restart_alt</span>
                    Ver todas las cosechas disponibles
                </button>
            `;

            document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
                currentCategory = null;
                currentSearch = '';
                currentRegion = 'todos';
                document.getElementById('catalog-search').value = '';
                document.getElementById('catalog-region').value = 'todos';
                loadCategories();
                loadProducts();
            });
            return;
        }

        grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6';
        grid.innerHTML = productos.map(prod => `
            <article class="product-card group cursor-pointer" data-id="${prod.id}">
                <!-- Foto 4:3 con Badge de Origen y Lazy Loading (RULES.md: IMG-WEBP-LAZY, ALT-IMAGES) -->
                <div class="relative w-full aspect-[4/3] overflow-hidden bg-[#F5F3F3]">
                    <img src="${prod.foto_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'}" 
                         alt="Fotografía de ${prod.nombre} cosechado en ${prod.municipio}"
                         loading="lazy"
                         onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'"
                         class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                    <div class="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm flex items-center gap-1 backdrop-blur-sm"
                         style="background-color: rgba(255, 255, 255, 0.9); color: var(--color-primary);">
                        <span class="material-symbols-outlined text-[14px]">eco</span>
                        ${prod.categoria_nombre || 'Cosecha'}
                    </div>
                </div>

                <!-- Contenido de la Tarjeta -->
                <div class="p-4 flex flex-col flex-1 justify-between">
                    <div>
                        <div class="flex items-center gap-1 text-[11px] text-text-secondary mb-1" style="color: var(--color-text-secondary);">
                            <span class="material-symbols-outlined text-[13px]">location_on</span>
                            <span class="truncate">${prod.municipio}</span>
                        </div>
                        <h3 class="font-bold text-base text-on-surface group-hover:text-primary transition-colors leading-snug mb-1 line-clamp-2">
                            ${prod.nombre}
                        </h3>
                        <p class="text-xs text-text-secondary mb-3 truncate" style="color: var(--color-text-secondary);">
                            Por: <span class="font-medium text-[#212121]">${prod.productor_nombre}</span>
                        </p>
                    </div>

                    <div class="pt-3 border-t border-border flex items-end justify-between gap-2">
                        <div>
                            <span class="text-[11px] text-text-secondary block">Precio Directo</span>
                            <span class="text-lg font-extrabold" style="color: var(--color-primary);">
                                $${Number(prod.precio).toLocaleString('es-CO')}
                            </span>
                            <span class="text-xs text-text-secondary font-normal">/${prod.unidad_medida}</span>
                        </div>
                        <button class="btn-primary-cta text-xs px-3.5 py-2 shrink-0" data-id="${prod.id}">
                            <span>Pedir</span>
                            <span class="material-symbols-outlined text-[16px]">shopping_basket</span>
                        </button>
                    </div>
                </div>
            </article>
        `).join('');

        // Listeners para abrir vista de detalle
        grid.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const prodId = card.getAttribute('data-id');
                window.location.hash = `#/producto/${prodId}`;
            });
        });

    } catch (err) {
        grid.innerHTML = `
            <div class="col-span-full p-8 text-center bg-red-50 rounded-xl border border-red-200">
                <span class="material-symbols-outlined text-red-500 text-3xl mb-2">error</span>
                <p class="text-sm font-semibold text-red-700 mb-1">Error al conectar con el catálogo agrícola</p>
                <p class="text-xs text-red-600 mb-4">${err.message}</p>
                <button onclick="window.location.reload()" class="btn-outline text-xs">Reintentar</button>
            </div>
        `;
    }
}
