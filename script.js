// ------------------
//| VERSION ANDROID |
//------------------- Version 2.2.0

// Variables globales
let films = [];
let personalRating = 0;
let currentFilmIndex = null;
let previousPage = 'home-page';
let isEditMode = false;
let editingFilmId = null;
let currentFilmId = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    await loadFilms(); // ✅ AJOUTE "await"
    updateStats();
    displayFilms();
});

// ========================================
// 🗜️ COMPRESSION D'IMAGE (NOUVEAU)
// ========================================
async function compressImage(base64String) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // ✅ Calculer nouvelles dimensions (hauteur max 410px)
            const MAX_HEIGHT = 410;
            let width = img.width;
            let height = img.height;

            if (height > MAX_HEIGHT) {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
            }

            canvas.width = width;
            canvas.height = height;

            // ✅ Dessiner l'image redimensionnée
            ctx.drawImage(img, 0, 0, width, height);

            // ✅ Compresser jusqu'à ≤ 30 Ko
            let quality = 0.70;
            let result = canvas.toDataURL('image/jpeg', quality);

            while (getBase64Size(result) > 30 && quality > 0.1) {
                quality -= 0.05;
                result = canvas.toDataURL('image/jpeg', quality);
            }

            console.log(`🗜️ Image compressée: ${getBase64Size(result)} Ko (qualité: ${quality.toFixed(2)})`);
            resolve(result);
        };
        img.src = base64String;
    });
}

// ========================================
// 📏 CALCULER TAILLE BASE64 (NOUVEAU)
// ========================================
function getBase64Size(base64String) {
    const base64Length = base64String.split(',')[1].length;
    return Math.round((base64Length * 3) / 4 / 1024); // En Ko
}

// Gestion des pages
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    if (pageId !== 'film-detail-page') {
        previousPage = Array.from(pages).find(p => p.classList.contains('active'))?.id || 'home-page';
    }

    // 🆕 RÉINITIALISER si on quitte la page d'ajout
    if (pageId !== 'add-film-page' && isEditMode) {
        isEditMode = false;
        editingFilmId = null;
        const addButton = document.querySelector('#add-film-view .btn-primary');
        if (addButton) {
            addButton.innerHTML = '<i class="fas fa-plus"></i> Ajouter le film';
        }
    }

    // 🆕 RÉINITIALISER le formulaire si on arrive sur la page d'ajout sans être en mode édition
    if (pageId === 'add-film-page' && !isEditMode) {
        resetForm();
    }

    document.getElementById(pageId).classList.add('active');

    if (pageId === 'my-films-page') {
        displayFilms();
    } else if (pageId === 'search-page') {
        searchFilms();
    }
}

function cancelEdit() {
    resetForm();
    showPage('my-films-page');
}

function goBackFromDetail() {
    showPage(previousPage);
}

// Statistiques
function updateStats() {
    const totalFilms = films.length;
    const totalBluray = films.filter(f => f.format === 'Blu-ray').length;
    const totalDVD = films.filter(f => f.format === 'DVD').length;
    const totalPrime = films.filter(f => f.format === 'Prime Vidéo').length;
    
    document.getElementById('total-films').textContent = totalFilms;
    document.getElementById('total-bluray').textContent = totalBluray;
    document.getElementById('total-dvd').textContent = totalDVD;
    document.getElementById('total-prime').textContent = totalPrime;
}

// ========================
// 🖼️ GESTION UPLOAD IMAGE
// ========================
function handleImageUpload(event, side) {
    const file = event.target.files[0];
    if (!file) return;

    console.log(`📸 Upload ${side}:`, file.name, `(${(file.size / 1024).toFixed(1)} Ko)`);

    const reader = new FileReader();
    reader.onload = async function(e) {
        const originalBase64 = e.target.result;
        const originalSize = getBase64Size(originalBase64);

        console.log(`📊 Taille originale: ${originalSize} Ko`);

        // ✅ COMPRESSION AUTOMATIQUE
        let finalBase64 = originalBase64;
        if (originalSize > 30) {
            console.log('🗜️ Compression nécessaire...');
            finalBase64 = await compressImage(originalBase64);
            console.log(`✅ Compressé de ${originalSize} Ko → ${getBase64Size(finalBase64)} Ko`);
        } else {
            console.log('✅ Image déjà optimale, pas de compression');
        }

        // ✅ Afficher l'aperçu
        const preview = document.getElementById(`image-preview-${side}`);
        preview.src = finalBase64;
        preview.style.display = 'block';
    };

    reader.readAsDataURL(file);
}

function addImageFromURL(side) {
    const url = prompt('Entrez l\'URL de l\'image :');
    if (url) {
        const preview = document.getElementById(`image-preview-${side}`);
        preview.src = url;
        preview.style.display = 'block';
        preview.onerror = () => {
            showMessage('URL d\'image invalide', 'error');
            preview.style.display = 'none';
        };
    }
}

// Fonction pour définir la note
function setRating(rating) {
    personalRating = rating;
    updateStars();
}

// Fonction pour mettre à jour l'affichage des étoiles
function updateStars() {
    const stars = document.querySelectorAll('.star-rating .star');
    stars.forEach((star, index) => {
        if (index < personalRating) {
            star.classList.add('active');
            star.textContent = '★';
        } else {
            star.classList.remove('active');
            star.textContent = '☆';
        }
    });
}

function getStars(rating) {
    if (!rating) return '☆☆☆☆☆';
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

// Badge d'âge
function getAgeBadge(age) {
    const badges = {
        'Tous public': '🟢 Tous public',
        '-10 ans': '🔵 Accord parental (-10 ans)',
        '-12 ans': '🟠 Interdit -12 ans',
        '-16 ans': '🔴 Interdit -16 ans',
        '-18 ans': '⚫ Interdit -18 ans'
    };
    return badges[age] || age;
}

// Gestion de la durée
function toggleDurationInputs() {
    const format = document.getElementById('duration-format').value;
    const minutesInput = document.getElementById('duration-minutes-input');
    const hoursInput = document.getElementById('duration-hours-input');
    
    if (format === 'minutes') {
        minutesInput.style.display = 'flex';
        hoursInput.style.display = 'none';
        document.getElementById('film-duration-hours').value = '';
        document.getElementById('film-duration-mins').value = '';
    } else {
        minutesInput.style.display = 'none';
        hoursInput.style.display = 'flex';
        document.getElementById('film-duration-min').value = '';
    }
}

function getDurationInMinutes() {
    const format = document.getElementById('duration-format').value;
    
    if (format === 'minutes') {
        const minutes = parseInt(document.getElementById('film-duration-min').value);
        return minutes || 0;
    } else {
        const hours = parseInt(document.getElementById('film-duration-hours').value) || 0;
        const mins = parseInt(document.getElementById('film-duration-mins').value) || 0;
        return (hours * 60) + mins;
    }
}

function formatDuration(minutes, format = 'both') {
    if (!minutes || minutes === 0) return 'N/A';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (format === 'minutes') {
        return `${minutes} min`;
    } else if (format === 'hours') {
        if (hours === 0) {
            return `${mins} min`;
        } else if (mins === 0) {
            return `${hours}h`;
        } else {
            return `${hours}h${mins < 10 ? '0' : ''}${mins}`;
        }
    } else { // 'both'
        if (hours === 0) {
            return `${mins} min`;
        } else if (mins === 0) {
            return `${hours}h (${minutes} min)`;
        } else {
            return `${hours}h${mins < 10 ? '0' : ''}${mins} (${minutes} min)`;
        }
    }
}

// Ajout d'un film
async function addFilm() {
    const name = document.getElementById('film-name').value.trim();
    const year = document.getElementById('film-year').value.trim();
    const genre = document.getElementById('film-genre').value;
    const ageRating = document.getElementById('film-age').value;
    const format = document.getElementById('film-format').value;
    const duration = getDurationInMinutes();

    if (!name || !year || !genre) {
        showMessage('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    // MODE ÉDITION : Mettre à jour un film existant
    if (isEditMode && editingFilmId) {
        const filmIndex = films.findIndex(f => f.id === editingFilmId);
        if (filmIndex !== -1) {
            films[filmIndex] = {
                ...films[filmIndex], // Garder l'ID et la date d'ajout originale
                name: name,
                year: year,
                imageRecto: document.getElementById('image-preview-recto').src || films[filmIndex].imageRecto,
                imageVerso: document.getElementById('image-preview-verso').src || films[filmIndex].imageVerso,
                genre: genre,
                duration: duration,
                ageRating: ageRating,
                pitch: document.getElementById('film-pitch').value,
                allocine: document.getElementById('film-allocine').value,
                rottenTomatoes: document.getElementById('film-rotten').value,
                personalRating: personalRating,
                format: format,
                resolution: document.getElementById('film-resolution').value
            };
            
            await saveFilms();
            showMessage('Film modifié avec succès !', 'success');
            
            // Réinitialiser le mode édition
            isEditMode = false;
            editingFilmId = null;
            
            // Remettre le texte du bouton
            const addButton = document.querySelector('#add-film-view .btn-primary');
            if (addButton) {
                addButton.innerHTML = '<i class="fas fa-plus"></i> Ajouter le film';
            }
            
            resetForm();
            updateStats();
            displayFilms();
            setTimeout(() => showPage('my-films-page'), 1000);
        }
        return;
    }

    // MODE AJOUT NORMAL : Créer un nouveau film
    const film = {
        id: Date.now().toString(),
        name: name,
        year: year,
        imageRecto: document.getElementById('image-preview-recto').src || '',
        imageVerso: document.getElementById('image-preview-verso').src || '',
        genre: genre,
        duration: duration,
        ageRating: ageRating,
        pitch: document.getElementById('film-pitch').value,
        allocine: document.getElementById('film-allocine').value,
        rottenTomatoes: document.getElementById('film-rotten').value,
        personalRating: personalRating,
        format: format,
        resolution: document.getElementById('film-resolution').value,
        dateAdded: new Date().toISOString()
    };

    films.push(film);
    await saveFilms();
    showMessage('Film ajouté avec succès !', 'success');
    resetForm();
    updateStats();
    setTimeout(() => showPage('my-films-page'), 1000);
}

function resetForm() {
    document.getElementById('add-film-form').reset();
    document.getElementById('image-preview-recto').style.display = 'none';
    document.getElementById('image-preview-verso').style.display = 'none';
    personalRating = 0;
    setRating(0);
    toggleDurationInputs();
    
    // 🆕 RÉINITIALISER le mode édition
    isEditMode = false;
    editingFilmId = null;
    
    // 🆕 REMETTRE le texte du bouton
    const addButton = document.querySelector('#add-film-view .btn-primary');
    if (addButton) {
        addButton.innerHTML = '<i class="fas fa-plus"></i> Ajouter le film';
    }
}

// Affichage des films
function displayFilms() {
    const searchTerm = document.getElementById('films-search').value.toLowerCase();
    const container = document.getElementById('films-list');

    let filteredFilms = films.filter(film => 
        film.name.toLowerCase().includes(searchTerm) ||
        (film.year && film.year.toString().includes(searchTerm)) ||
        film.genre.toLowerCase().includes(searchTerm)
    );

    filteredFilms = applySorting(filteredFilms);

    if (filteredFilms.length === 0) {
        container.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">Aucun film trouvé</p>';
        return;
    }

    container.innerHTML = filteredFilms.map(film => `
        <div class="film-card ${film.format === 'Blu-ray' ? 'bluray' : film.format === 'Prime Vidéo' ? 'prime' : 'dvd'}" onclick="showFilmDetail('${film.id}')">
            <img src="${film.imageRecto || 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${film.name}">
            <div class="film-card-info">
                <h3>${film.name} (${film.year || 'N/A'})</h3>
                <span class="film-genre">${film.genre}</span>
                <p>⏱️ ${formatDuration(film.duration, 'hours')}</p>
                <p>🎥 ${film.allocine || 'N/A'}% | 🍅 ${film.rottenTomatoes || 'N/A'}%</p>
                <p>⭐ ${getStars(film.personalRating)}</p>
            </div>
        </div>
    `).join('');
}

// Tri des films
function applySorting(filmsList) {
    const sortValue = document.getElementById('sort-select').value;
    
    return filmsList.sort((a, b) => {
        switch(sortValue) {
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'year-desc':
                return (b.year || 0) - (a.year || 0);
            case 'year-asc':
                return (a.year || 0) - (b.year || 0);
            case 'genre-asc':
                return a.genre.localeCompare(b.genre);
            case 'rating-desc':
                return (b.personalRating || 0) - (a.personalRating || 0);
            case 'rating-asc':
                return (a.personalRating || 0) - (b.personalRating || 0);
            case 'age-asc':
                return getAgeValue(a.ageRating) - getAgeValue(b.ageRating);
            case 'age-desc':
                return getAgeValue(b.ageRating) - getAgeValue(a.ageRating);
            default:
                return 0;
        }
    });
}

function getAgeValue(age) {
    const values = {
        'Tous public': 0,
        '-10 ans': 10,
        '-12 ans': 12,
        '-16 ans': 16,
        '-18 ans': 18
    };
    return values[age] || 0;
}

// Détails d'un film
function showFilmDetail(filmId) {
    currentFilmId = filmId;
    const filmIndex = films.findIndex(f => f.id === filmId);
    if (filmIndex === -1) return;
    
    currentFilmIndex = filmIndex;
    const film = films[filmIndex];

    document.getElementById('detail-title').textContent = `${film.name} (${film.year || 'N/A'})`;

    document.getElementById('film-detail-content').innerHTML = `
        <div class="detail-images">
            <div class="detail-image">
                <h3>Recto</h3>
                <img src="${film.imageRecto}" alt="${film.name} - Recto" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22%3E%3Crect width=%22300%22 height=%22450%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3EImage non disponible%3C/text%3E%3C/svg%3E'">
            </div>
            <div class="detail-image">
                <h3>Verso</h3>
                <img src="${film.imageVerso}" alt="${film.name} - Verso" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22%3E%3Crect width=%22300%22 height=%22450%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3EImage non disponible%3C/text%3E%3C/svg%3E'">
            </div>
        </div>

        <div class="detail-info">
            <h3>Informations</h3>
            <p><strong>Année :</strong> ${film.year || 'N/A'}</p>
            <p><strong>Genre :</strong> ${film.genre}</p>
            <p><strong>Âge minimum :</strong> ${getAgeBadge(film.ageRating)}</p>
            <p><strong>Durée :</strong> ${formatDuration(film.duration, 'both')}</p>
            <p><strong>Format :</strong> ${film.format}</p>
            <p><strong>Résolution :</strong> ${film.resolution || 'N/A'}</p>
        </div>

        ${film.pitch ? `
        <div class="detail-info">
            <h3>Synopsis</h3>
            <p>${film.pitch}</p>
        </div>
        ` : ''}

        <div class="detail-info">
            <h3>Notes</h3>
            <p><strong>Allociné :</strong> 🎥 ${film.allocine || 'N/A'}%</p>
            <p><strong>Rotten Tomatoes :</strong> 🍅 ${film.rottenTomatoes || 'N/A'}%</p>
            <p><strong>Note personnelle :</strong> ${getStars(film.personalRating)} (${film.personalRating}/5)</p>
        </div>

        <div class="detail-info">
            <p><strong>Ajouté le :</strong> ${new Date(film.dateAdded).toLocaleDateString('fr-FR')}</p>
        </div>
    `;

    showPage('film-detail-page');
}

function editFilm() {
    if (!currentFilmId) return;

    const film = films.find(f => f.id === currentFilmId);
    if (!film) return;

    // Activer le mode édition AVANT de changer de page
    isEditMode = true;
    editingFilmId = currentFilmId;

    // Aller à la page d'ajout AVANT de remplir le formulaire
    showPage('add-film-page');

    // Remplir le formulaire avec les données du film
    document.getElementById('film-name').value = film.name;
    document.getElementById('film-year').value = film.year || '';
    document.getElementById('film-genre').value = film.genre;
    document.getElementById('film-age').value = film.ageRating;
    document.getElementById('film-pitch').value = film.pitch || '';
    document.getElementById('film-allocine').value = film.allocine || '';
    document.getElementById('film-rotten').value = film.rottenTomatoes || '';

    // Gérer la note personnelle
    personalRating = film.personalRating || 0;
    updateStars();

    document.getElementById('film-format').value = film.format;
    document.getElementById('film-resolution').value = film.resolution || '';

    // ✅ GÉRER LA DURÉE CORRECTEMENT
    const hours = Math.floor(film.duration / 60);
    const minutes = film.duration % 60;
    
    if (hours > 0) {
        // Afficher le format heures
        document.getElementById('duration-format').value = 'hours';
        toggleDurationInputs(); // Afficher les bons champs
        document.getElementById('film-duration-hours').value = hours;
        document.getElementById('film-duration-mins').value = minutes;
    } else {
        // Afficher le format minutes
        document.getElementById('duration-format').value = 'minutes';
        toggleDurationInputs(); // Afficher les bons champs
        document.getElementById('film-duration-min').value = film.duration;
    }

    // Afficher les images actuelles
    if (film.imageRecto) {
        const rectoPreview = document.getElementById('image-preview-recto');
        rectoPreview.src = film.imageRecto;
        rectoPreview.style.display = 'block';
    }
    if (film.imageVerso) {
        const versoPreview = document.getElementById('image-preview-verso');
        versoPreview.src = film.imageVerso;
        versoPreview.style.display = 'block';
    }

    // Changer le texte du bouton
    const addButton = document.querySelector('#add-film-view .btn-primary');
    if (addButton) {
        addButton.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
    }
}


// Suppression d'un film
async function deleteFilm() {
    if (currentFilmIndex === null) return;
    
    const film = films[currentFilmIndex];
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${film.name}" ?`)) {
        films.splice(currentFilmIndex, 1);
        await saveFilms();
        showMessage('Film supprimé', 'success');
        updateStats();
        showPage(previousPage);
    }
}

// Recherche avancée
function searchFilms() {
    const name = document.getElementById('search-name').value.toLowerCase();
    const genre = document.getElementById('search-genre').value;
    const age = document.getElementById('search-age').value;
    const rating = parseInt(document.getElementById('search-rating').value);

    let filtered = films.filter(film => {
        const matchName = !name || film.name.toLowerCase().includes(name) || 
                         (film.year && film.year.toString().includes(name));
        const matchGenre = !genre || film.genre === genre;
        const matchAge = !age || film.ageRating === age;
        const matchRating = !rating || film.personalRating >= rating;

        return matchName && matchGenre && matchAge && matchRating;
    });

    const container = document.getElementById('search-results');

    if (filtered.length === 0) {
        container.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">Aucun film ne correspond à vos critères</p>';
        return;
    }

    container.innerHTML = filtered.map(film => `
        <div class="film-card ${film.format === 'Blu-ray' ? 'bluray' : film.format === 'Prime Vidéo' ? 'prime' : 'dvd'}" onclick="showFilmDetail('${film.id}')">
            <img src="${film.imageRecto || 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${film.name}">
            <div class="film-card-info">
                <h3>${film.name} (${film.year || 'N/A'})</h3>
                <span class="film-genre">${film.genre}</span>
                <p>${film.ageRating} • ${formatDuration(film.duration, 'hours')}</p>
                <p>🎥 ${film.allocine || 'N/A'}% | 🍅 ${film.rottenTomatoes || 'N/A'}%</p>
                <p>⭐ ${getStars(film.personalRating)}</p>
            </div>
        </div>
    `).join('');
}

function searchOnAllocine() {
    const filmName = document.getElementById('film-name').value;
    if (filmName) {
        const searchUrl = `https://www.allocine.fr/rechercher/?q=${encodeURIComponent(filmName)}`;
        window.open(searchUrl, '_blank');
    } else {
        showMessage('Veuillez d\'abord entrer un nom de film', 'error');
    }
}

function searchOnRottenTomatoes() {
    const filmName = document.getElementById('film-name').value;
    const url = filmName 
        ? `https://www.rottentomatoes.com/search?search=${encodeURIComponent(filmName)}`
        : 'https://www.rottentomatoes.com/';
    window.open(url, '_blank');
}

// ========================================
// 💾 SAUVEGARDE ET CHARGEMENT
// ========================================

// ========================================
// 🔧 INDEXEDDB : Ouvrir la base de données
// ========================================
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EcranoLibrary', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('films')) {
                db.createObjectStore('films', { keyPath: 'id' });
            }
        };
    });
}

// ========================================
// 💾 SAUVEGARDER (3 méthodes)
// ========================================
async function saveFilms() {
    console.log('💾 Tentative de sauvegarde de', films.length, 'films...');

    // 🪟 ELECTRON (Windows)
    if (window.electronAPI) {
        console.log('🖥️ Sauvegarde Electron');
        await window.electronAPI.saveLibrary(films);
        console.log('✅ Sauvegarde Electron OK');
        return;
    }

    // 📱 WEB/PWA (Android/iOS)
    const data = JSON.stringify(films);
    let saveSuccess = false;

    // ✅ MÉTHODE 1 : localStorage (rapide)
    try {
        localStorage.setItem('ecranoLibrary', data);
        console.log('✅ localStorage OK');
        saveSuccess = true;
    } catch (e) {
        console.warn('⚠️ localStorage échoué:', e.message);
    }

    // ✅ MÉTHODE 2 : IndexedDB (backup)
    try {
        const db = await openDB();
        const tx = db.transaction('films', 'readwrite');
        const store = tx.objectStore('films');
        
        await store.clear();
        await store.put({ id: 'library', data: films });
        
        console.log('✅ IndexedDB OK');
        saveSuccess = true;
    } catch (e) {
        console.warn('⚠️ IndexedDB échoué:', e.message);
    }

    // ✅ MÉTHODE 3 : Cache API (dernier recours)
    try {
        const cache = await caches.open('ecrano-backup-v1');
        const blob = new Blob([data], { type: 'application/json' });
        const response = new Response(blob);
        await cache.put('/backup.json', response);
        
        console.log('✅ Cache API OK');
        saveSuccess = true;
    } catch (e) {
        console.warn('⚠️ Cache API échoué:', e.message);
    }

    if (!saveSuccess) {
        console.error('❌ ÉCHEC TOTAL DE LA SAUVEGARDE');
        showMessage('⚠️ Impossible de sauvegarder !', 'error');
    } else {
        console.log('✅ Sauvegarde réussie');
    }
}

// ========================================
// 📂 CHARGER (3 méthodes)
// ========================================
async function loadFilms() {
    console.log('📂 Tentative de chargement...');

    // 🪟 ELECTRON (Windows)
    if (window.electronAPI) {
        console.log('🖥️ Chargement Electron');
        films = await window.electronAPI.loadLibrary();
        console.log('✅', films.length, 'films chargés');
        return;
    }

    // 📱 WEB/PWA (Android/iOS)

    // ✅ MÉTHODE 1 : localStorage (rapide)
    try {
        const data = localStorage.getItem('ecranoLibrary');
        if (data) {
            films = JSON.parse(data);
            console.log('✅ Chargé depuis localStorage:', films.length, 'films');
            return;
        }
    } catch (e) {
        console.warn('⚠️ Erreur localStorage:', e.message);
    }

    // ✅ MÉTHODE 2 : IndexedDB (backup)
    try {
        const result = await loadFromIndexedDB();
        if (result && Array.isArray(result)) {
            films = result;
            console.log('✅ Chargé depuis IndexedDB:', films.length, 'films');
            return;
        }
    } catch (e) {
        console.warn('⚠️ Erreur IndexedDB:', e.message);
    }

    // ✅ MÉTHODE 3 : Cache API (dernier recours)
    try {
        const cache = await caches.open('ecrano-backup-v1');
        const response = await cache.match('/backup.json');

        if (response) {
            const text = await response.text();
            films = JSON.parse(text);
            console.log('✅ Chargé depuis Cache API:', films.length, 'films');
            return;
        }
    } catch (e) {
        console.warn('⚠️ Erreur Cache API:', e.message);
    }

    console.log('ℹ️ Aucune sauvegarde trouvée');
    films = [];
}

// ========================================
// 🗄️ FONCTION HELPER POUR INDEXEDDB
// ========================================
function loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EcranoLibrary', 1);

        request.onerror = () => {
            console.error('❌ Erreur ouverture IndexedDB');
            reject(request.error);
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            
            // Vérifie que l'objectStore existe
            if (!db.objectStoreNames.contains('films')) {
                console.log('📭 ObjectStore "films" inexistant');
                resolve(null);
                return;
            }

            const transaction = db.transaction(['films'], 'readonly');
            const objectStore = transaction.objectStore('films');
            const getRequest = objectStore.get('library');

            getRequest.onsuccess = () => {
                const stored = getRequest.result;
                if (stored && stored.data && Array.isArray(stored.data)) {
                    resolve(stored.data);
                } else {
                    console.log('📭 Aucune donnée dans IndexedDB');
                    resolve(null);
                }
            };

            getRequest.onerror = () => {
                console.error('❌ Erreur lecture IndexedDB');
                reject(getRequest.error);
            };
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('films')) {
                db.createObjectStore('films');
                console.log('🗄️ ObjectStore "films" créé');
            }
        };
    });
}

// Import/Export
async function exportLibrary() {
    console.log("🔥🔥🔥 EXPORT CLIQUÉ !!! 🔥🔥🔥");
    console.log("📚 Nombre de films:", films.length);

    // ✅ VÉRIFICATION ET COMPRESSION DES IMAGES (NOUVEAU)
    console.log("🔍 Vérification des images...");
    let imagesCompressed = 0;

    for (let i = 0; i < films.length; i++) {
        const film = films[i];
        
        // Recto
        if (film.imageRecto) {
            const size = getBase64Size(film.imageRecto);
            if (size > 30) {
                console.log(`🗜️ Film ${i + 1}: Compression recto (${size} Ko → ...)`);
                film.imageRecto = await compressImage(film.imageRecto);
                imagesCompressed++;
            }
        }

        // Verso
        if (film.imageVerso) {
            const size = getBase64Size(film.imageVerso);
            if (size > 30) {
                console.log(`🗜️ Film ${i + 1}: Compression verso (${size} Ko → ...)`);
                film.imageVerso = await compressImage(film.imageVerso);
                imagesCompressed++;
            }
        }
    }

    if (imagesCompressed > 0) {
        console.log(`✅ ${imagesCompressed} images compressées avant export`);
        await saveFilms(); // Sauvegarder les versions compressées
    }

    let counterDiv = null;

    try {
        const dataStr = JSON.stringify(films, null, 2);
        console.log("✅ JSON créé, taille:", dataStr.length, "caractères");

        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const fileName = `ecrano-library-${dateStr}.json`;
        console.log("📝 Nom du fichier:", fileName);

        // ✅ VÉRIFICATION CAPACITOR
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
            console.log("📱 Utilisation de Capacitor.Plugins.Filesystem");

            // ✅ SUPPRESSION DU FICHIER S'IL EXISTE
            try {
                await Capacitor.Plugins.Filesystem.deleteFile({
                    path: fileName,
                    directory: 'DOCUMENTS'
                });
                console.log("🗑️ Ancien fichier supprimé");
            } catch (e) {
                console.log("ℹ️ Pas d'ancien fichier à supprimer");
            }

            // ✅ ÉCRITURE INITIALE (pour créer le fichier)
            console.log("📝 Création du fichier...");
            await Capacitor.Plugins.Filesystem.writeFile({
                path: fileName,
                data: '',
                directory: 'DOCUMENTS',
                encoding: 'utf8'
            });

            // ✅ ÉCRITURE PAR CHUNKS DE 500 KB (UTF-8)
            const CHUNK_SIZE = 512 * 1024; // 500 KB
            const chunks = [];

            console.log("🔄 Découpage en chunks de 500 KB...");
            for (let i = 0; i < dataStr.length; i += CHUNK_SIZE) {
                chunks.push(dataStr.slice(i, i + CHUNK_SIZE));
            }
            console.log(`✅ ${chunks.length} chunks créés`);

            // ✅ CRÉATION DU COMPTEUR EN JS (APRÈS avoir chunks.length)
            counterDiv = document.createElement('div');
            counterDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.95);
                color: white;
                padding: 32px 64px;
                border-radius: 20px;
                font-family: 'Courier New', monospace;
                z-index: 10000;
                box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
                text-align: center;
            `;
            counterDiv.innerHTML = `
                <div style="font-size: 18px; margin-bottom: 12px; opacity: 0.8;">Exportation...</div>
                <div id="counter-number" style="font-size: 48px; font-weight: 700; letter-spacing: 4px;">0/${chunks.length}</div>
            `;
            document.body.appendChild(counterDiv);

            // ✅ ÉCRITURE CHUNK PAR CHUNK
            for (let i = 0; i < chunks.length; i++) {
                console.log(`📝 Écriture chunk ${i + 1}/${chunks.length}...`);

                // ✅ MISE À JOUR DU COMPTEUR
                document.getElementById('counter-number').textContent = `${i + 1}/${chunks.length}`;

                await Capacitor.Plugins.Filesystem.appendFile({
                    path: fileName,
                    data: chunks[i],
                    directory: 'DOCUMENTS',
                    encoding: 'utf8'
                });

                // ✅ PETIT DÉLAI
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            console.log("✅ Tous les chunks écrits !");

            // ✅ VÉRIFICATION
            const check = await Capacitor.Plugins.Filesystem.stat({
                path: fileName,
                directory: 'DOCUMENTS'
            });
            console.log("📊 Taille finale:", check.size, "bytes");
            console.log("📂 Chemin:", check.uri);

            // ✅ TEST DE LECTURE (SEULEMENT LE DÉBUT)
            console.log("🔍 Vérification du format...");
            const preview = dataStr.substring(0, 100);
            console.log("📄 Début du fichier:", preview);

            // ✅ SUPPRIME LE COMPTEUR
            if (counterDiv) {
                document.body.removeChild(counterDiv);
            }

            if (preview.startsWith('[')) {
                console.log("✅ Fichier valide (JSON détecté)");
                showMessage(`✅ ${films.length} films exportés (${(check.size / 1024 / 1024).toFixed(1)} MB)`, 'success');
            } else {
                console.error("❌ Fichier corrompu (pas de JSON)");
                showMessage('❌ Erreur: fichier corrompu', 'error');
            }

            return;
        }

        // ✅ FALLBACK WEB
        console.log("🌐 Fallback sur Blob");
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        showMessage(`✅ ${films.length} films exportés !`, 'success');

    } catch (error) {
        console.error('❌ ERREUR EXPORT:', error);
        console.error('❌ Message:', error.message);
        console.error('❌ Stack:', error.stack);

        // ✅ SUPPRIME LE COMPTEUR EN CAS D'ERREUR
        if (counterDiv && counterDiv.parentNode) {
            document.body.removeChild(counterDiv);
        }

        showMessage(`❌ Erreur: ${error.message}`, 'error');
    }
}

async function importLibrary(event) {
    console.log("📥 IMPORT CLIQUÉ !");
    const file = event.target.files[0];
    
    if (!file) {
        console.log("⚠️ Aucun fichier sélectionné");
        return;
    }

    console.log("📄 Fichier sélectionné:", file.name, file.size, "bytes");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            console.log("📖 Lecture du fichier...");
            const imported = JSON.parse(e.target.result);
            console.log("✅ JSON parsé:", imported.length, "films");

            if (!Array.isArray(imported)) {
                console.error("❌ Le fichier n'est pas un tableau");
                showMessage('Fichier invalide', 'error');
                return;
            }

            if (confirm(`Importer ${imported.length} films ? Cela remplacera votre bibliothèque actuelle.`)) {
                console.log("✅ Confirmation utilisateur");
                films = imported;
                await saveFilms();
                updateStats();
                displayFilms();
                showMessage('Bibliothèque importée !', 'success');
                console.log("✅ Import terminé !");
            } else {
                console.log("⚠️ Import annulé par l'utilisateur");
            }
        } catch (error) {
            console.error('❌ Erreur import:', error);
            console.error('❌ Stack:', error.stack);
            showMessage('Fichier invalide', 'error');
        }
    };
    
    reader.onerror = (error) => {
        console.error('❌ Erreur lecture fichier:', error);
    };
    
    reader.readAsText(file);
}

// Messages toast
function showMessage(message, type = 'success') {
    console.log(`💬 Message (${type}):`, message);
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========================================
// 📱 ENREGISTREMENT DU SERVICE WORKER (PWA)
// ========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // ❌ Skip si Electron
        if (window.electronAPI) {
            console.log('⚠️ Service Worker désactivé (mode Electron)');
            return;
        }

        // ✅ Enregistrement du SW (mode web uniquement)
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('✅ Service Worker enregistré:', registration);
            })
            .catch(error => {
                console.log('❌ Erreur Service Worker:', error);
            });
    });
}
