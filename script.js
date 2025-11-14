// Variables globales
let films = [];
let personalRating = 0;
let currentFilmIndex = null;
let previousPage = 'home-page';
let isEditMode = false;
let editingFilmId = null;
let currentFilmId = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    loadFilms();
    updateStats();
    displayFilms();
});

// Gestion des pages
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    if (pageId !== 'film-detail-page') {
        previousPage = Array.from(pages).find(p => p.classList.contains('active'))?.id || 'home-page';
    }
    
    document.getElementById(pageId).classList.add('active');
    
    if (pageId === 'my-films-page') {
        displayFilms();
    } else if (pageId === 'search-page') {
        searchFilms();
    }
}

function goBackFromDetail() {
    showPage(previousPage);
}

// Statistiques
function updateStats() {
    const totalFilms = films.length;
    const totalBluray = films.filter(f => f.format === 'Blu-ray').length;
    const totalDVD = films.filter(f => f.format === 'DVD').length;
    
    document.getElementById('total-films').textContent = totalFilms;
    document.getElementById('total-bluray').textContent = totalBluray;
    document.getElementById('total-dvd').textContent = totalDVD;
}

// Gestion des images
function handleImageUpload(event, side) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(`image-preview-${side}`);
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
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
function addFilm() {
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
            
            saveFilms();
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
    saveFilms();
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
        <div class="film-card ${film.format === 'Blu-ray' ? 'bluray' : 'dvd'}" onclick="showFilmDetail('${film.id}')">
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
function deleteFilm() {
    if (currentFilmIndex === null) return;
    
    const film = films[currentFilmIndex];
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${film.name}" ?`)) {
        films.splice(currentFilmIndex, 1);
        saveFilms();
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
        <div class="film-card ${film.format === 'Blu-ray' ? 'bluray' : 'dvd'}" onclick="showFilmDetail('${film.id}')">
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

// Sauvegarde et chargement
function saveFilms() {
    localStorage.setItem('ecrano-films', JSON.stringify(films));
}

function loadFilms() {
    const saved = localStorage.getItem('ecrano-films');
    if (saved) {
        films = JSON.parse(saved);
    }
}

// Export/Import
function exportLibrary() {
    const dataStr = JSON.stringify(films, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ecrano-library-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showMessage('Bibliothèque exportée !', 'success');
}

function importLibrary(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (confirm(`Importer ${imported.length} films ? Cela remplacera votre bibliothèque actuelle.`)) {
                    films = imported;
                    saveFilms();
                    updateStats();
                    displayFilms();
                    showMessage('Bibliothèque importée !', 'success');
                }
            } catch (error) {
                showMessage('Fichier invalide', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// Messages toast
function showMessage(message, type = 'success') {
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
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker enregistré:', registration.scope);
            })
            .catch(error => {
                console.log('❌ Erreur Service Worker:', error);
            });
    });
}
