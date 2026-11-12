// ------------------
//| VERSION ANDROID |
//------------------- Version 2.3.0

// Variables globales
let films = [];
let personalRating = 0;
let currentFilmIndex = null;
let previousPage = 'home-page';
let isEditMode = false;
let editingFilmId = null;
let currentFilmId = null;

// Image affichée quand un film n'a pas de jaquette (locale : fonctionne hors ligne)
const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22%3E%3Crect width=%22300%22 height=%22450%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22sans-serif%22%3EImage non disponible%3C/text%3E%3C/svg%3E';

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    // Demande au navigateur de ne pas effacer les données en cas de manque de place
    try {
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
        }
    } catch (e) { /* rien */ }

    const chargementOk = await loadFilms();
    updateStats();
    displayFilms();

    // 🏠 Synchro avec le serveur maison (version web / PWA uniquement)
    if (chargementOk) demarrerSyncMaison();
    if (window.electronAPI) {
        const bouton = document.getElementById('btn-serveur-maison');
        if (bouton) bouton.style.display = 'none';
    }
});

// ========================================
// 🛡️ ÉCHAPPEMENT HTML (titres avec " ' < >…)
// ========================================
function escapeHtml(valeur) {
    return String(valeur === undefined || valeur === null ? '' : valeur)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ========================================
// 🗜️ COMPRESSION D'IMAGE (NOUVEAU)
// ========================================
async function compressImage(base64String) {
    return new Promise((resolve) => {
        const img = new Image();
        // Format illisible par le navigateur (ex. HEIC) : on garde l'original au lieu de bloquer
        img.onerror = () => {
            console.warn('⚠️ Image illisible, conservée sans compression');
            resolve(base64String);
        };
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

            // ✅ Fond blanc (sinon les zones transparentes d'un PNG deviennent noires en JPEG)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

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
    // Une image ajoutée par URL (http…) n'est pas une dataURL : taille 0, pas de compression
    if (!isDataUrl(base64String)) return 0;
    const base64Length = base64String.split(',')[1].length;
    return Math.round((base64Length * 3) / 4 / 1024); // En Ko
}

function isDataUrl(valeur) {
    return typeof valeur === 'string' && valeur.startsWith('data:image/') && valeur.includes(',');
}

// Gestion des pages
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    const pageActuelle = Array.from(pages).find(p => p.classList.contains('active'))?.id || 'home-page';

    // On mémorise la page d'où l'on vient quand on ouvre une fiche (pour « Retour »)
    if (pageId === 'film-detail-page' && pageActuelle !== 'film-detail-page') {
        previousPage = pageActuelle;
    }

    pages.forEach(page => page.classList.remove('active'));

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
// Image actuellement choisie dans le formulaire ('' si aucune)
function getPreviewImage(side) {
    const preview = document.getElementById(`image-preview-${side}`);
    if (!preview || preview.style.display === 'none') return '';
    return preview.getAttribute('src') || '';
}

function setPreviewImage(side, src) {
    const preview = document.getElementById(`image-preview-${side}`);
    preview.onerror = null;
    if (src) {
        preview.src = src;
        preview.style.display = 'block';
    } else {
        preview.removeAttribute('src');
        preview.style.display = 'none';
    }
}

function handleImageUpload(event, side) {
    const file = event.target.files[0];
    // Permet de re-choisir la même photo plus tard
    event.target.value = '';
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
        setPreviewImage(side, finalBase64);
    };

    reader.readAsDataURL(file);
}

function addImageFromURL(side) {
    const url = (prompt('Entrez l\'URL de l\'image :') || '').trim();
    if (url) {
        setPreviewImage(side, url);
        const preview = document.getElementById(`image-preview-${side}`);
        preview.onerror = () => {
            showMessage('URL d\'image invalide', 'error');
            setPreviewImage(side, '');
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
    const note = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return '★'.repeat(note) + '☆'.repeat(5 - note);
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

// Ajout d'un film (protégé contre le double clic pendant l'enregistrement)
let ajoutEnCours = false;
async function addFilm() {
    if (ajoutEnCours) return;
    ajoutEnCours = true;
    try {
        await addFilmInterne();
    } finally {
        ajoutEnCours = false;
    }
}

async function addFilmInterne() {
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
        if (filmIndex === -1) {
            // Le film a pu être supprimé entre-temps (par ex. sur un autre appareil)
            showMessage('Ce film n\'existe plus (supprimé sur un autre appareil ?)', 'error');
            resetForm();
            showPage('my-films-page');
            return;
        }
        if (filmIndex !== -1) {
            films[filmIndex] = {
                ...films[filmIndex], // Garder l'ID et la date d'ajout originale
                name: name,
                year: year,
                imageRecto: getPreviewImage('recto') || films[filmIndex].imageRecto || '',
                imageVerso: getPreviewImage('verso') || films[filmIndex].imageVerso || '',
                genre: genre,
                duration: duration,
                ageRating: ageRating,
                pitch: document.getElementById('film-pitch').value,
                allocine: document.getElementById('film-allocine').value,
                rottenTomatoes: document.getElementById('film-rotten').value,
                personalRating: personalRating,
                format: format,
                resolution: document.getElementById('film-resolution').value,
                updatedAt: Date.now()
            };

            try {
                await enregistrerFilm(films[filmIndex]);
            } catch (e) {
                console.error('❌ Enregistrement impossible:', e);
                showMessage('⚠️ Impossible d\'enregistrer le film !', 'error');
                return;
            }
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
    let id = Date.now().toString();
    while (films.some(f => f.id === id)) id = (Number(id) + 1).toString(); // double clic rapide

    const film = {
        id: id,
        name: name,
        year: year,
        imageRecto: getPreviewImage('recto'),
        imageVerso: getPreviewImage('verso'),
        genre: genre,
        duration: duration,
        ageRating: ageRating,
        pitch: document.getElementById('film-pitch').value,
        allocine: document.getElementById('film-allocine').value,
        rottenTomatoes: document.getElementById('film-rotten').value,
        personalRating: personalRating,
        format: format,
        resolution: document.getElementById('film-resolution').value,
        dateAdded: new Date().toISOString(),
        updatedAt: Date.now()
    };

    films.push(film);
    try {
        await enregistrerFilm(film);
    } catch (e) {
        console.error('❌ Enregistrement impossible:', e);
        films = films.filter(f => f !== film);
        showMessage('⚠️ Impossible d\'enregistrer le film !', 'error');
        return;
    }
    showMessage('Film ajouté avec succès !', 'success');
    resetForm();
    updateStats();
    setTimeout(() => showPage('my-films-page'), 1000);
}

function resetForm() {
    document.getElementById('add-film-form').reset();
    // On efface vraiment les images (sinon le film suivant récupérait celles du précédent)
    setPreviewImage('recto', '');
    setPreviewImage('verso', '');
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
        (film.name || '').toLowerCase().includes(searchTerm) ||
        (film.year && film.year.toString().includes(searchTerm)) ||
        (film.genre || '').toLowerCase().includes(searchTerm)
    );

    filteredFilms = applySorting(filteredFilms);

    if (filteredFilms.length === 0) {
        container.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">Aucun film trouvé</p>';
        return;
    }

    container.innerHTML = filteredFilms.map(film => filmCardHtml(film, `⏱️ ${formatDuration(film.duration, 'hours')}`)).join('');
}

// Carte d'un film (liste et recherche)
function filmCardHtml(film, ligneInfo) {
    const classeFormat = film.format === 'Blu-ray' ? 'bluray' : film.format === 'Prime Vidéo' ? 'prime' : 'dvd';
    return `
        <div class="film-card ${classeFormat}" data-id="${escapeHtml(film.id)}" onclick="showFilmDetail(this.dataset.id)">
            <img src="${escapeHtml(film.imageRecto || PLACEHOLDER_IMG)}" alt="${escapeHtml(film.name)}" loading="lazy" onerror="this.onerror=null;this.src=PLACEHOLDER_IMG">
            <div class="film-card-info">
                <h3>${escapeHtml(film.name)} (${escapeHtml(film.year || 'N/A')})</h3>
                <span class="film-genre">${escapeHtml(film.genre)}</span>
                <p>${ligneInfo}</p>
                <p>🎥 ${escapeHtml(film.allocine || 'N/A')}% | 🍅 ${escapeHtml(film.rottenTomatoes || 'N/A')}%</p>
                <p>⭐ ${getStars(film.personalRating)}</p>
            </div>
        </div>
    `;
}

// Tri des films
function applySorting(filmsList) {
    const sortValue = document.getElementById('sort-select').value;
    
    return filmsList.sort((a, b) => {
        switch(sortValue) {
            case 'name-asc':
                return (a.name || '').localeCompare(b.name || '');
            case 'name-desc':
                return (b.name || '').localeCompare(a.name || '');
            case 'year-desc':
                return (b.year || 0) - (a.year || 0);
            case 'year-asc':
                return (a.year || 0) - (b.year || 0);
            case 'genre-asc':
                return (a.genre || '').localeCompare(b.genre || '');
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
    if (!renderFilmDetail(filmId)) return;
    showPage('film-detail-page');
}

// Remplit la fiche d'un film (sans changer de page). Renvoie false si le film n'existe pas.
function renderFilmDetail(filmId) {
    const filmIndex = films.findIndex(f => f.id === filmId);
    if (filmIndex === -1) return false;

    currentFilmId = filmId;
    currentFilmIndex = filmIndex;
    const film = films[filmIndex];

    document.getElementById('detail-title').textContent = `${film.name} (${film.year || 'N/A'})`;

    const dateAjout = film.dateAdded ? new Date(film.dateAdded) : null;
    const dateAjoutTexte = dateAjout && !isNaN(dateAjout) ? dateAjout.toLocaleDateString('fr-FR') : 'N/A';

    document.getElementById('film-detail-content').innerHTML = `
        <div class="detail-images">
            <div class="detail-image">
                <h3>Recto</h3>
                <img src="${escapeHtml(film.imageRecto || PLACEHOLDER_IMG)}" alt="${escapeHtml(film.name)} - Recto" onerror="this.onerror=null;this.src=PLACEHOLDER_IMG">
            </div>
            <div class="detail-image">
                <h3>Verso</h3>
                <img src="${escapeHtml(film.imageVerso || PLACEHOLDER_IMG)}" alt="${escapeHtml(film.name)} - Verso" onerror="this.onerror=null;this.src=PLACEHOLDER_IMG">
            </div>
        </div>

        <div class="detail-info">
            <h3>Informations</h3>
            <p><strong>Année :</strong> ${escapeHtml(film.year || 'N/A')}</p>
            <p><strong>Genre :</strong> ${escapeHtml(film.genre)}</p>
            <p><strong>Âge minimum :</strong> ${escapeHtml(getAgeBadge(film.ageRating) || 'N/A')}</p>
            <p><strong>Durée :</strong> ${formatDuration(film.duration, 'both')}</p>
            <p><strong>Format :</strong> ${escapeHtml(film.format)}</p>
            <p><strong>Résolution :</strong> ${escapeHtml(film.resolution || 'N/A')}</p>
        </div>

        ${film.pitch ? `
        <div class="detail-info">
            <h3>Synopsis</h3>
            <p style="white-space: pre-line;">${escapeHtml(film.pitch)}</p>
        </div>
        ` : ''}

        <div class="detail-info">
            <h3>Notes</h3>
            <p><strong>Allociné :</strong> 🎥 ${escapeHtml(film.allocine || 'N/A')}%</p>
            <p><strong>Rotten Tomatoes :</strong> 🍅 ${escapeHtml(film.rottenTomatoes || 'N/A')}%</p>
            <p><strong>Note personnelle :</strong> ${getStars(film.personalRating)} (${film.personalRating || 0}/5)</p>
        </div>

        <div class="detail-info">
            <p><strong>Ajouté le :</strong> ${dateAjoutTexte}</p>
        </div>
    `;

    return true;
}

function editFilm() {
    if (!currentFilmId) return;

    const film = films.find(f => f.id === currentFilmId);
    if (!film) return;

    // Partir d'un formulaire propre (images, durée… du film édité précédemment)
    resetForm();

    // Activer le mode édition AVANT de changer de page
    isEditMode = true;
    editingFilmId = currentFilmId;

    // Aller à la page d'ajout AVANT de remplir le formulaire
    showPage('add-film-page');

    // Remplir le formulaire avec les données du film
    document.getElementById('film-name').value = film.name || '';
    document.getElementById('film-year').value = film.year || '';
    document.getElementById('film-genre').value = film.genre || '';
    document.getElementById('film-age').value = film.ageRating || '';
    document.getElementById('film-pitch').value = film.pitch || '';
    document.getElementById('film-allocine').value = film.allocine || '';
    document.getElementById('film-rotten').value = film.rottenTomatoes || '';

    // Gérer la note personnelle
    personalRating = film.personalRating || 0;
    updateStars();

    document.getElementById('film-format').value = film.format || '';
    document.getElementById('film-resolution').value = film.resolution || '';

    // ✅ GÉRER LA DURÉE CORRECTEMENT
    const duree = parseInt(film.duration) || 0;
    const hours = Math.floor(duree / 60);
    const minutes = duree % 60;

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
        document.getElementById('film-duration-min').value = duree || '';
    }

    // Afficher les images actuelles
    setPreviewImage('recto', film.imageRecto || '');
    setPreviewImage('verso', film.imageVerso || '');

    // Changer le texte du bouton
    const addButton = document.querySelector('#add-film-view .btn-primary');
    if (addButton) {
        addButton.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
    }
}


// Suppression d'un film
async function deleteFilm() {
    if (!currentFilmId) return;

    // On retrouve le film par son id (l'index peut avoir changé après une synchro)
    const film = films.find(f => f.id === currentFilmId);
    if (!film) return;

    const message = window.electronAPI
        ? `Êtes-vous sûr de vouloir supprimer "${film.name}" ?`
        : `Supprimer "${film.name}" ?\n\nLe film sera supprimé sur tous les appareils synchronisés.`;

    if (confirm(message)) {
        const id = film.id;
        const avant = films;
        films = films.filter(f => f.id !== id);
        try {
            await effacerFilm(id);
        } catch (e) {
            console.error('❌ Suppression impossible:', e);
            films = avant;
            showMessage('⚠️ Impossible de supprimer le film !', 'error');
            return;
        }
        currentFilmId = null;
        currentFilmIndex = null;
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
        const matchName = !name || (film.name || '').toLowerCase().includes(name) ||
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

    container.innerHTML = filtered.map(film =>
        filmCardHtml(film, `${escapeHtml(film.ageRating || 'N/A')} • ${formatDuration(film.duration, 'hours')}`)
    ).join('');
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
// Web / PWA : IndexedDB uniquement, UN film par enregistrement
//             (base 'EcranoLibrary' v2, store 'films', clé 'id').
// Electron  : fichier géré par window.electronAPI (inchangé).
//
// Jusqu'à la v2.2.0, toute la liste était copiée à 3 endroits (localStorage
// 'ecranoLibrary', IndexedDB { id: 'library', data: films } et Cache API).
// Au premier lancement de la v2.3.0, ces copies sont fusionnées dans la
// nouvelle base (sans rien perdre), puis supprimées.

const DB_NAME = 'EcranoLibrary';
const DB_VERSION = 2;
const ANCIENNE_CLE_LOCALSTORAGE = 'ecranoLibrary';
const ANCIEN_CACHE_SAUVEGARDE = 'ecrano-backup-v1';
const ANCIEN_FICHIER_CACHE = '/backup.json';

let dbPromise = null;
let anciennesSources = null;   // copies v2.2.0 lues avant l'ouverture de la base
let resultatMigration = null;  // rempli si la migration a eu lieu pendant cette session

// ========================================
// 🔧 INDEXEDDB : Ouvrir la base de données
// ========================================
function openDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                migrerBase(request.result, request.transaction, event.oldVersion);
            };
            request.onsuccess = () => {
                const db = request.result;
                // Une future version de l'appli (autre onglet) pourra mettre la base à jour
                db.onversionchange = () => db.close();
                resolve(db);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                console.warn('⏳ Mise à jour de la base bloquée par un autre onglet');
                showMessage('Fermez les autres onglets d\'Écrano pour terminer la mise à jour', 'error');
            };
        }).catch((err) => {
            dbPromise = null;
            throw err;
        });
    }
    return dbPromise;
}

// Migration v1 → v2, dans la transaction de mise à jour : si quoi que ce soit
// échoue, tout est annulé et l'ancienne base reste intacte.
function migrerBase(db, tx, ancienneVersion) {
    console.log(`🗄️ Mise à jour de la base (v${ancienneVersion} → v${DB_VERSION})`);

    const terminer = (filmsAncienneBase) => {
        if (db.objectStoreNames.contains('films')) db.deleteObjectStore('films');
        const store = db.createObjectStore('films', { keyPath: 'id' });

        const fusion = fusionnerSources([
            { nom: 'IndexedDB', films: filmsAncienneBase },
            { nom: 'Cache API', films: anciennesSources && anciennesSources.cache },
            { nom: 'localStorage', films: anciennesSources && anciennesSources.localStorage },
        ]);
        fusion.films.forEach((film) => store.put(film));
        resultatMigration = fusion;
        console.log(`✅ Migration : ${fusion.films.length} films (source principale : ${fusion.principale || 'aucune'}, +${fusion.ajoutes} trouvés ailleurs)`);
    };

    if (db.objectStoreNames.contains('films')) {
        const lecture = tx.objectStore('films').getAll();
        lecture.onsuccess = () => terminer(extraireFilmsAncienneBase(lecture.result));
        // en cas d'erreur, la transaction est annulée : rien n'est perdu
    } else {
        terminer(null);
    }
}

// L'ancienne base contenait { id: 'library', data: [films] }
function extraireFilmsAncienneBase(enregistrements) {
    if (!enregistrements || !enregistrements.length) return null;
    const liste = [];
    for (const e of enregistrements) {
        if (e && Array.isArray(e.data)) liste.push(...e.data);
        else if (e && typeof e === 'object' && e.id !== undefined && e.id !== 'library' && 'name' in e) liste.push(e);
    }
    return liste;
}

// Garde les identifiants existants tels quels (seul un id numérique devient texte)
function normaliserFilm(f) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
    const film = { ...f };
    if (typeof film.id === 'number' && Number.isFinite(film.id)) film.id = String(film.id);
    if (typeof film.id !== 'string' || !film.id || film.id === 'library') {
        film.id = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
    return film;
}

// Deux films différents avec le même id (très improbable) : le second reçoit
// un id dérivé, toujours le même, pour ne rien perdre.
function dedoublonner(liste) {
    const vus = new Set();
    return liste.map((film) => {
        if (!vus.has(film.id)) { vus.add(film.id); return film; }
        let n = 2;
        while (vus.has(`${film.id}-${n}`)) n++;
        const copie = { ...film, id: `${film.id}-${n}` };
        vus.add(copie.id);
        return copie;
    });
}

// Part de la source la plus complète, puis ajoute les films présents
// uniquement dans les autres copies.
function fusionnerSources(sources) {
    const valides = sources
        .filter((s) => Array.isArray(s.films))
        .map((s) => ({ nom: s.nom, films: dedoublonner(s.films.map(normaliserFilm).filter(Boolean)) }));
    if (!valides.length) return { films: [], principale: null, ajoutes: 0 };

    let principale = valides[0];
    for (const s of valides) if (s.films.length > principale.films.length) principale = s;

    const parId = new Map(principale.films.map((f) => [f.id, f]));
    let ajoutes = 0;
    for (const s of valides) {
        if (s === principale) continue;
        for (const f of s.films) {
            if (!parId.has(f.id)) { parId.set(f.id, f); ajoutes++; }
        }
    }
    return { films: Array.from(parId.values()), principale: principale.nom, ajoutes };
}

async function lireAnciennesSources() {
    const sources = { localStorage: null, cache: null };
    try {
        const texte = localStorage.getItem(ANCIENNE_CLE_LOCALSTORAGE);
        if (texte) {
            const valeur = JSON.parse(texte);
            if (Array.isArray(valeur)) sources.localStorage = valeur;
        }
    } catch (e) {
        console.warn('⚠️ Ancienne copie localStorage illisible:', e.message);
    }
    try {
        if (window.caches && await caches.has(ANCIEN_CACHE_SAUVEGARDE)) {
            const cache = await caches.open(ANCIEN_CACHE_SAUVEGARDE);
            const reponse = await cache.match(ANCIEN_FICHIER_CACHE);
            if (reponse) {
                const valeur = JSON.parse(await reponse.text());
                if (Array.isArray(valeur)) sources.cache = valeur;
            }
        }
    } catch (e) {
        console.warn('⚠️ Ancienne copie Cache API illisible:', e.message);
    }
    return sources;
}

async function nettoyerAnciennesSources() {
    try { localStorage.removeItem(ANCIENNE_CLE_LOCALSTORAGE); } catch (e) { /* rien */ }
    try {
        if (window.caches) await caches.delete(ANCIEN_CACHE_SAUVEGARDE);
    } catch (e) { /* rien */ }
}

// ========================================
// 🗄️ OPÉRATIONS INDEXEDDB (store 'films')
// ========================================
async function idbTransaction(mode, action) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('films', mode);
        const requete = action(tx.objectStore('films'));
        tx.oncomplete = () => resolve(requete ? requete.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
    });
}

async function idbGetAll() {
    const tous = (await idbTransaction('readonly', (s) => s.getAll())) || [];
    return tous.filter((f) => f && f.id !== 'library');
}

function idbPutFilm(film) {
    return idbTransaction('readwrite', (s) => { s.put(film); });
}

function idbDeleteFilm(id) {
    return idbTransaction('readwrite', (s) => { s.delete(id); });
}

function idbRemplacerTout(liste) {
    return idbTransaction('readwrite', (s) => {
        s.clear();
        liste.forEach((film) => s.put(film));
    });
}

// ========================================
// ✍️ ÉCRITURES (un film à la fois) + synchro
// ========================================
async function enregistrerFilm(film) {
    if (window.electronAPI) {
        await saveFilms();
        return;
    }
    await idbPutFilm(film);
    syncModifie(film);
}

async function effacerFilm(id) {
    if (window.electronAPI) {
        await saveFilms();
        return;
    }
    await idbDeleteFilm(id);
    syncSupprime(id);
}

// updatedAt peut être un nombre (ms) ou un texte de date ISO
function horodatageFilm(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
        const t = Date.parse(v);
        if (Number.isFinite(t)) return t;
    }
    return 0;
}

function syncModifie(film) {
    if (window.electronAPI || !window.SyncMaison) return;
    Promise.resolve(SyncMaison.modifie('films', { ...film }))
        .catch((e) => console.warn('[Écrano] Synchro (modification) :', e));
}

function syncSupprime(id) {
    if (window.electronAPI || !window.SyncMaison) return;
    Promise.resolve(SyncMaison.supprime('films', id))
        .catch((e) => console.warn('[Écrano] Synchro (suppression) :', e));
}

// ========================================
// 💾 SAUVEGARDER TOUTE LA BIBLIOTHÈQUE
// ========================================
// Electron : inchangé. Web : chaque film est enregistré au moment où il
// change (enregistrerFilm / effacerFilm) ; cette fonction ne sert qu'en secours.
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
    await idbRemplacerTout(films);
    console.log('✅ IndexedDB OK');
}

// ========================================
// 📂 CHARGER
// ========================================
// Renvoie true si la base est utilisable (la synchro peut démarrer).
async function loadFilms() {
    console.log('📂 Tentative de chargement...');

    // 🪟 ELECTRON (Windows)
    if (window.electronAPI) {
        console.log('🖥️ Chargement Electron');
        films = await window.electronAPI.loadLibrary();
        console.log('✅', films.length, 'films chargés');
        return true;
    }

    // 📱 WEB/PWA (Android/iOS)
    try {
        anciennesSources = await lireAnciennesSources();
        await openDB();
        films = await idbGetAll();
        console.log('✅ Chargé depuis IndexedDB:', films.length, 'films');

        if (resultatMigration) {
            // On ne supprime les anciennes copies qu'après avoir vérifié la nouvelle base
            if (films.length >= resultatMigration.films.length) {
                await nettoyerAnciennesSources();
                if (films.length) showMessage(`✅ Bibliothèque mise à jour (${films.length} films)`, 'success');
            } else {
                console.error('❌ Migration incomplète : anciennes copies conservées');
            }
        } else if (anciennesSources.localStorage || anciennesSources.cache) {
            // Copies réécrites par une ancienne version restée ouverte : déjà migrées
            await nettoyerAnciennesSources();
        }
        anciennesSources = null;
        return true;
    } catch (e) {
        console.error('❌ Erreur IndexedDB:', e);
        // Secours : on affiche au moins les anciennes copies, s'il y en a
        const secours = fusionnerSources([
            { nom: 'Cache API', films: anciennesSources && anciennesSources.cache },
            { nom: 'localStorage', films: anciennesSources && anciennesSources.localStorage },
        ]);
        films = secours.films;
        showMessage('⚠️ Base de données inaccessible : modifications impossibles', 'error');
        return false;
    }
}

// ========================================
// 🏠 SYNCHRO AVEC LE SERVEUR MAISON
// ========================================
function demarrerSyncMaison() {
    if (window.electronAPI || !window.SyncMaison) return;
    try {
        SyncMaison.configurer({
            app: 'ecrano',
            nom: 'Écrano',
            mode: 'complet',
            stores: ['films'],
            toutLire: async (store) => (store === 'films' ? idbGetAll() : []),
            appliquer: appliquerChangementsSync,
        });
    } catch (e) {
        console.error('[Écrano] Synchro maison non démarrée :', e);
    }
}

function ouvrirServeurMaison() {
    if (window.SyncMaison && SyncMaison.instance) {
        SyncMaison.ouvrirReglages();
    } else {
        showMessage('Synchronisation indisponible', 'error');
    }
}

// Changements reçus du serveur : [{ store, id, data }] (data === null → supprimé).
// Écrits dans IndexedDB SANS rappeler SyncMaison, puis affichage rafraîchi.
async function appliquerChangementsSync(changements) {
    const final = new Map(); // id → film ou null (le dernier changement l'emporte)
    for (const ch of changements || []) {
        if (!ch || ch.store !== 'films' || ch.id === undefined || ch.id === null) continue;
        const id = String(ch.id);
        if (ch.data && typeof ch.data === 'object') final.set(id, { ...ch.data, id });
        else final.set(id, null);
    }
    if (!final.size) return;

    await idbTransaction('readwrite', (s) => {
        for (const [id, film] of final) {
            if (film) s.put(film);
            else s.delete(id); // un film inconnu ici est simplement ignoré
        }
    });

    // Mise à jour du tableau en mémoire (remplacer / ajouter / retirer par id)
    const modifies = new Set();
    const supprimes = new Set();
    films = films
        .filter((f) => !(final.has(f.id) && final.get(f.id) === null))
        .map((f) => (final.has(f.id) ? final.get(f.id) : f));
    const presents = new Set(films.map((f) => f.id));
    for (const [id, film] of final) {
        if (film) {
            modifies.add(id);
            if (!presents.has(id)) films.push(film);
        } else {
            supprimes.add(id);
        }
    }

    rafraichirApresSync(modifies, supprimes);
}

function rafraichirApresSync(modifies, supprimes) {
    const pageActive = document.querySelector('.page.active')?.id;

    updateStats();
    if (pageActive === 'my-films-page') displayFilms();
    if (pageActive === 'search-page') searchFilms();

    // Fiche ouverte : on retrouve le film par son id
    if (currentFilmId) {
        const index = films.findIndex((f) => f.id === currentFilmId);
        if (index === -1) {
            currentFilmId = null;
            currentFilmIndex = null;
            if (pageActive === 'film-detail-page') {
                showMessage('Ce film a été supprimé sur un autre appareil', 'error');
                showPage(previousPage);
            }
        } else {
            currentFilmIndex = index;
            if (pageActive === 'film-detail-page' && modifies.has(currentFilmId)) {
                renderFilmDetail(currentFilmId);
            }
        }
    }

    // Film en cours de modification
    if (isEditMode && editingFilmId) {
        if (!films.some((f) => f.id === editingFilmId)) {
            showMessage('Ce film a été supprimé sur un autre appareil', 'error');
            resetForm();
            if (pageActive === 'add-film-page') showPage('my-films-page');
        } else if (modifies.has(editingFilmId)) {
            showMessage('Ce film vient d\'être modifié sur un autre appareil', 'success');
        }
    }
}

// Import/Export
async function exportLibrary() {
    console.log("🔥🔥🔥 EXPORT CLIQUÉ !!! 🔥🔥🔥");
    console.log("📚 Nombre de films:", films.length);

    // ✅ VÉRIFICATION ET COMPRESSION DES IMAGES (NOUVEAU)
    console.log("🔍 Vérification des images...");
    let imagesCompressed = 0;
    const filmsCompresses = [];

    for (let i = 0; i < films.length; i++) {
        const film = films[i];
        let modifie = false;

        // Recto (les images par URL ne sont pas des dataURL : ignorées)
        if (isDataUrl(film.imageRecto)) {
            const size = getBase64Size(film.imageRecto);
            if (size > 30) {
                console.log(`🗜️ Film ${i + 1}: Compression recto (${size} Ko → ...)`);
                const compressee = await compressImage(film.imageRecto);
                if (compressee !== film.imageRecto) { film.imageRecto = compressee; modifie = true; imagesCompressed++; }
            }
        }

        // Verso
        if (isDataUrl(film.imageVerso)) {
            const size = getBase64Size(film.imageVerso);
            if (size > 30) {
                console.log(`🗜️ Film ${i + 1}: Compression verso (${size} Ko → ...)`);
                const compressee = await compressImage(film.imageVerso);
                if (compressee !== film.imageVerso) { film.imageVerso = compressee; modifie = true; imagesCompressed++; }
            }
        }

        if (modifie) {
            film.updatedAt = Date.now();
            filmsCompresses.push(film);
        }
    }

    if (imagesCompressed > 0) {
        console.log(`✅ ${imagesCompressed} images compressées avant export`);
        // Sauvegarder les versions compressées
        try {
            if (window.electronAPI) {
                await saveFilms();
            } else {
                for (const film of filmsCompresses) await enregistrerFilm(film);
            }
        } catch (e) {
            console.warn('⚠️ Images compressées non enregistrées:', e);
        }
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
    // Permet de ré-importer le même fichier plus tard
    event.target.value = '';

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

            if (!Array.isArray(imported)) {
                console.error("❌ Le fichier n'est pas un tableau");
                showMessage('Fichier invalide', 'error');
                return;
            }
            console.log("✅ JSON parsé:", imported.length, "films");

            // Mêmes identifiants que dans le fichier ; updatedAt du fichier conservé
            // (sinon 1) pour qu'un vieux fichier ne passe pas pour plus récent que le serveur.
            let importes = dedoublonner(imported.map(normaliserFilm).filter(Boolean)).map((film) => ({
                ...film,
                updatedAt: (film.updatedAt !== undefined && film.updatedAt !== null && film.updatedAt !== '') ? film.updatedAt : 1
            }));

            // Web synchronisé : si cet appareil a une version PLUS RÉCENTE d'un film que
            // celle du fichier, on la garde (la synchro donnerait de toute façon raison à la
            // plus récente ; sinon l'appareil resterait avec l'ancienne version du fichier).
            const gardesLocaux = new Set();
            if (!window.electronAPI) {
                const locaux = new Map(films.map(f => [f.id, f]));
                importes = importes.map((film) => {
                    const local = locaux.get(film.id);
                    if (local && horodatageFilm(local.updatedAt) > horodatageFilm(film.updatedAt)) {
                        gardesLocaux.add(film.id);
                        return local;
                    }
                    return film;
                });
            }

            const message = window.electronAPI
                ? `Importer ${importes.length} films ? Cela remplacera votre bibliothèque actuelle.`
                : `Importer ${importes.length} films ?\n\nCela remplacera votre bibliothèque actuelle sur cet appareil ET sur tous les appareils synchronisés : les films absents du fichier y seront supprimés.`
                  + (gardesLocaux.size ? `\n\n(${gardesLocaux.size} film(s) modifié(s) plus récemment que le fichier garderont leur version actuelle.)` : '');

            if (confirm(message)) {
                console.log("✅ Confirmation utilisateur");

                if (window.electronAPI) {
                    films = importes;
                    await saveFilms();
                } else {
                    const idsImportes = new Set(importes.map(f => f.id));
                    const disparus = films.filter(f => !idsImportes.has(f.id)).map(f => f.id);
                    await idbRemplacerTout(importes);
                    films = importes;
                    importes.forEach(film => { if (!gardesLocaux.has(film.id)) syncModifie(film); });
                    disparus.forEach(id => syncSupprime(id));
                }

                if (currentFilmId && !films.some(f => f.id === currentFilmId)) {
                    currentFilmId = null;
                    currentFilmIndex = null;
                }
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
