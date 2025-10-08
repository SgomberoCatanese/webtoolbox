class ImageEditor {
  constructor() {
    this.images = [];
    this.activeFilters = new Set(['none']);
    this.currentTheme = 'light';
    this.init();
  }

  init() {
    this.setupElements();
    this.setupEventListeners();
    this.setupScrollBehavior();
    this.loadTheme();
  }

  setupElements() {
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('fileInput');
    this.previewsSection = document.getElementById('previewsSection');
    this.previewsGrid = document.getElementById('previewsGrid');
    this.filtersSection = document.getElementById('filtersSection');
    this.conversionSection = document.getElementById('conversionSection');
    this.convertBtn = document.getElementById('convertBtn');
    this.formatSelect = document.getElementById('formatSelect');
    this.resultsSection = document.getElementById('resultsSection');
    this.contextualMenu = document.getElementById('contextualMenu');
    this.menuContent = document.getElementById('menuContent');
    this.imageContextMenu = document.getElementById('imageContextMenu');
    this.imageMenuContent = document.getElementById('imageMenuContent');
    this.backdrop = document.getElementById('backdrop');
    this.navMenuBtn = document.getElementById('navMenuBtn');
    this.navbar = document.getElementById('navbar');
  }

  setupEventListeners() {
    this.dropzone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('drag-over');
    });

    this.dropzone.addEventListener('dragleave', () => {
      this.dropzone.classList.remove('drag-over');
    });

    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => this.toggleFilter(chip));
    });

    this.convertBtn.addEventListener('click', () => this.convertImages());
    this.navMenuBtn.addEventListener('click', () => this.showMainMenu());
    this.backdrop.addEventListener('click', () => this.closeAllMenus());
  }

  setupScrollBehavior() {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 20) {
        this.navbar.classList.add('scrolled');
      } else {
        this.navbar.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    });
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('imageEditorTheme') || 'light';
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    this.currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('imageEditorTheme', theme);
  }

  async handleFiles(files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    this.images = [];
    this.previewsGrid.innerHTML = '';

    for (const file of imageFiles) {
      try {
        const imageData = await this.loadImage(file);
        this.images.push(imageData);
        this.createPreview(imageData);
      } catch (error) {
        console.error('Error loading image:', error);
      }
    }

    this.updateUI();
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            file,
            name: file.name,
            img,
            filters: []
          });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  createPreview(imageData) {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const canvas = document.createElement('canvas');
    canvas.className = 'preview-canvas';
    canvas.width = 300;
    canvas.height = 300;

    const ctx = canvas.getContext('2d');
    const scale = Math.min(300 / imageData.img.width, 300 / imageData.img.height);
    const x = (300 - imageData.img.width * scale) / 2;
    const y = (300 - imageData.img.height * scale) / 2;

    ctx.drawImage(imageData.img, x, y, imageData.img.width * scale, imageData.img.height * scale);
    this.applyFiltersToCanvas(ctx, canvas);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'preview-menu-btn';
    menuBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="2"></circle>
        <circle cx="12" cy="12" r="2"></circle>
        <circle cx="12" cy="19" r="2"></circle>
      </svg>
    `;
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showImageMenu(imageData);
    });

    item.appendChild(canvas);
    item.appendChild(menuBtn);
    this.previewsGrid.appendChild(item);

    imageData.canvas = canvas;
    imageData.ctx = ctx;
  }

  toggleFilter(chip) {
    const filter = chip.dataset.filter;

    if (filter === 'none') {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.activeFilters.clear();
      this.activeFilters.add('none');
    } else {
      const noneChip = document.querySelector('.filter-chip[data-filter="none"]');
      noneChip.classList.remove('active');
      this.activeFilters.delete('none');

      chip.classList.toggle('active');

      if (chip.classList.contains('active')) {
        this.activeFilters.add(filter);
      } else {
        this.activeFilters.delete(filter);
      }

      if (this.activeFilters.size === 0) {
        noneChip.classList.add('active');
        this.activeFilters.add('none');
      }
    }

    this.updatePreviews();
  }

  updatePreviews() {
    this.images.forEach(imageData => {
      const ctx = imageData.ctx;
      const canvas = imageData.canvas;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scale = Math.min(300 / imageData.img.width, 300 / imageData.img.height);
      const x = (300 - imageData.img.width * scale) / 2;
      const y = (300 - imageData.img.height * scale) / 2;

      ctx.drawImage(imageData.img, x, y, imageData.img.width * scale, imageData.img.height * scale);
      this.applyFiltersToCanvas(ctx, canvas);
    });
  }

  applyFiltersToCanvas(ctx, canvas) {
    if (this.activeFilters.has('none') || this.activeFilters.size === 0) {
      return;
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (this.activeFilters.has('grayscale')) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = gray;
      }

      if (this.activeFilters.has('sepia')) {
        const tr = 0.393 * r + 0.769 * g + 0.189 * b;
        const tg = 0.349 * r + 0.686 * g + 0.168 * b;
        const tb = 0.272 * r + 0.534 * g + 0.131 * b;
        r = Math.min(255, tr);
        g = Math.min(255, tg);
        b = Math.min(255, tb);
      }

      if (this.activeFilters.has('contrast')) {
        const factor = 1.5;
        r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
        g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
        b = Math.min(255, Math.max(0, factor * (b - 128) + 128));
      }

      if (this.activeFilters.has('brightness')) {
        const adjust = 40;
        r = Math.min(255, r + adjust);
        g = Math.min(255, g + adjust);
        b = Math.min(255, b + adjust);
      }

      if (this.activeFilters.has('invert')) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      if (this.activeFilters.has('vintage')) {
        const tr = 0.4 * r + 0.6 * g + 0.2 * b;
        const tg = 0.3 * r + 0.5 * g + 0.1 * b;
        const tb = 0.2 * r + 0.4 * g + 0.3 * b;
        r = Math.min(255, tr + 20);
        g = Math.min(255, tg + 10);
        b = Math.min(255, tb - 10);
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  async convertImages() {
    if (this.images.length === 0) return;

    this.convertBtn.classList.add('loading');
    this.convertBtn.disabled = true;
    this.resultsSection.innerHTML = '';
    this.resultsSection.style.display = 'grid';

    const format = this.formatSelect.value;

    for (const imageData of this.images) {
      try {
        const blob = await this.convertImage(imageData, format);
        this.createResultCard(imageData, blob, format);
      } catch (error) {
        console.error('Conversion error:', error);
      }
    }

    this.convertBtn.classList.remove('loading');
    this.convertBtn.disabled = false;
  }

  convertImage(imageData, format) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.img.width;
      canvas.height = imageData.img.height;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(imageData.img, 0, 0);
      this.applyFiltersToCanvas(ctx, canvas);

      const mimeType = {
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp'
      }[format] || 'image/png';

      canvas.toBlob(resolve, mimeType, 0.92);
    });
  }

  createResultCard(imageData, blob, format) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const preview = document.createElement('img');
    preview.className = 'result-preview';
    preview.src = URL.createObjectURL(blob);

    const url = URL.createObjectURL(blob);
    const filename = imageData.name.replace(/\.[^/.]+$/, `.${format}`);

    const download = document.createElement('a');
    download.className = 'result-download';
    download.href = url;
    download.download = filename;
    download.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Scarica ${filename}</span>
    `;

    card.appendChild(preview);
    card.appendChild(download);
    this.resultsSection.appendChild(card);
  }

  showMainMenu() {
    const menuHTML = `
      <div class="menu-header">
        <div class="menu-title">Menu</div>
      </div>
      <ul class="menu-list">
        <li class="menu-item" data-action="selectFile">
          <div class="menu-item-content">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span class="menu-item-label">Seleziona File</span>
          </div>
        </li>
        <li class="menu-item" data-action="clearAll">
          <div class="menu-item-content">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
            </svg>
            <span class="menu-item-label">Svuota Tutto</span>
          </div>
        </li>
        <div class="menu-separator"></div>
        <li class="menu-item" data-action="showThemes">
          <div class="menu-item-content">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <span class="menu-item-label">Tema</span>
          </div>
          <svg class="menu-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </li>
        <li class="menu-item" data-action="showLanguages">
          <div class="menu-item-content">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></path>
            </svg>
            <span class="menu-item-label">Lingua</span>
          </div>
          <svg class="menu-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </li>
      </ul>
    `;

    this.menuContent.innerHTML = menuHTML;
    this.contextualMenu.classList.add('active');
    this.backdrop.classList.add('active');
    document.body.classList.add('no-scroll');

    this.menuContent.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => this.handleMenuAction(item.dataset.action));
    });
  }

  showThemesMenu() {
    const menuHTML = `
      <div class="menu-header">
        <button class="menu-back-btn" data-action="back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="menu-title">Tema</div>
      </div>
      <ul class="menu-list">
        <li class="menu-item" data-theme="light">
          <div class="menu-item-content">
            <span class="menu-item-label">Default Chiaro</span>
          </div>
          ${this.currentTheme === 'light' ? '<svg class="menu-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </li>
        <li class="menu-item" data-theme="dark">
          <div class="menu-item-content">
            <span class="menu-item-label">Default Scuro</span>
          </div>
          ${this.currentTheme === 'dark' ? '<svg class="menu-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </li>
        <li class="menu-item" data-theme="midnight">
          <div class="menu-item-content">
            <span class="menu-item-label">Midnight</span>
          </div>
          ${this.currentTheme === 'midnight' ? '<svg class="menu-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </li>
        <li class="menu-item" data-theme="slate">
          <div class="menu-item-content">
            <span class="menu-item-label">Slate</span>
          </div>
          ${this.currentTheme === 'slate' ? '<svg class="menu-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </li>
        <li class="menu-item" data-theme="latte">
          <div class="menu-item-content">
            <span class="menu-item-label">Latte</span>
          </div>
          ${this.currentTheme === 'latte' ? '<svg class="menu-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </li>
      </ul>
    `;

    this.menuContent.innerHTML = menuHTML;

    this.menuContent.querySelector('.menu-back-btn').addEventListener('click', () => this.showMainMenu());
    this.menuContent.querySelectorAll('.menu-item[data-theme]').forEach(item => {
      item.addEventListener('click', () => {
        this.setTheme(item.dataset.theme);
        this.showThemesMenu();
      });
    });
  }

  showLanguagesMenu() {
    const menuHTML = `
      <div class="menu-header">
        <button class="menu-back-btn" data-action="back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="menu-title">Lingua</div>
      </div>
      <ul class="menu-list">
        <li class="menu-item" data-lang="it">
          <div class="menu-item-content">
            <span class="menu-item-label">Italiano</span>
          </div>
          <svg class="menu-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </li>
        <li class="menu-item" data-lang="en">
          <div class="menu-item-content">
            <span class="menu-item-label">English</span>
          </div>
        </li>
      </ul>
    `;

    this.menuContent.innerHTML = menuHTML;

    this.menuContent.querySelector('.menu-back-btn').addEventListener('click', () => this.showMainMenu());
  }

  showImageMenu(imageData) {
    const menuHTML = `
      <div class="menu-header">
        <div class="menu-title">Opzioni Immagine</div>
      </div>
      <ul class="menu-list">
        <li class="menu-item" data-action="removeImage">
          <div class="menu-item-content">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
            </svg>
            <span class="menu-item-label">Rimuovi</span>
          </div>
        </li>
      </ul>
    `;

    this.imageMenuContent.innerHTML = menuHTML;
    this.imageContextMenu.classList.add('active');
    this.backdrop.classList.add('active');
    document.body.classList.add('no-scroll');

    this.imageMenuContent.querySelector('[data-action="removeImage"]').addEventListener('click', () => {
      this.removeImage(imageData);
      this.closeAllMenus();
    });
  }

  removeImage(imageData) {
    const index = this.images.indexOf(imageData);
    if (index > -1) {
      this.images.splice(index, 1);
      this.previewsGrid.innerHTML = '';
      this.images.forEach(img => this.createPreview(img));
      this.updateUI();
    }
  }

  handleMenuAction(action) {
    switch (action) {
      case 'selectFile':
        this.fileInput.click();
        this.closeAllMenus();
        break;
      case 'clearAll':
        this.clearAll();
        this.closeAllMenus();
        break;
      case 'showThemes':
        this.showThemesMenu();
        break;
      case 'showLanguages':
        this.showLanguagesMenu();
        break;
    }
  }

  clearAll() {
    this.images = [];
    this.previewsGrid.innerHTML = '';
    this.resultsSection.innerHTML = '';
    this.updateUI();
  }

  closeAllMenus() {
    this.contextualMenu.classList.remove('active');
    this.imageContextMenu.classList.remove('active');
    this.backdrop.classList.remove('active');
    document.body.classList.remove('no-scroll');
  }

  updateUI() {
    if (this.images.length > 0) {
      this.previewsSection.style.display = 'block';
      this.filtersSection.style.display = 'block';
      this.conversionSection.style.display = 'block';
      this.convertBtn.disabled = false;
      this.convertBtn.querySelector('.btn-text').textContent = `Converti ${this.images.length} ${this.images.length === 1 ? 'Immagine' : 'Immagini'}`;
    } else {
      this.previewsSection.style.display = 'none';
      this.filtersSection.style.display = 'none';
      this.conversionSection.style.display = 'none';
      this.resultsSection.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ImageEditor();
});
