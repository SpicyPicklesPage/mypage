'use strict';
(() => {
  const CONFIG = window.FILM_ROLL_CONFIG || {};
  const BASE = CONFIG.photoBase || './photos/film-00015980/';
  const VERSION = CONFIG.assetVersion || '20261119-library';
  const gallery = document.getElementById('gallery');
  const more = document.getElementById('loadMore');
  const loading = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');
  const sequence = document.getElementById('sequenceLabel');
  const dialog = document.getElementById('lightbox');
  const image = document.getElementById('lightboxImage');
  const status = document.getElementById('lightboxStatus');
  const close = document.getElementById('lightboxClose');
  const wander = document.getElementById('wanderView');
  const sheet = document.getElementById('sheetView');
  let originals = [], photos = [], loaded = 0, mode = 'wander';
  let active = -1, focusBefore = null, lastTouch = null;
  const pad = number => String(number).padStart(2, '0');
  const url = (photo, full = false) => BASE + (full ? 'full/' + photo.filename : photo.thumbnail) + '?v=' + encodeURIComponent(VERSION);

  const labelFor = (photo, index) => Number.isFinite(photo.frame) ? `第 ${photo.frame} 格` : `第 ${index + 1} 张`;

  function createPhoto(photo, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo';
    button.dataset.ratio = photo.width / photo.height;
    button.setAttribute('aria-label', `展开${labelFor(photo, index)}照片`);
    const frame = document.createElement('span');
    frame.className = 'photo-image';
    frame.dataset.frame = Number.isFinite(photo.frame) ? pad(photo.frame) : pad(index + 1);
    frame.dataset.roll = CONFIG.label || 'SHD400';
    frame.style.setProperty('--ratio', photo.width / photo.height);
    const thumb = new Image();
    thumb.loading = 'lazy'; thumb.decoding = 'async';
    thumb.width = photo.width; thumb.height = photo.height;
    thumb.alt = photo.title;
    thumb.addEventListener('error', () => {
      const error = document.createElement('span');
      error.className = 'photo-error'; error.textContent = '点击重新查看';
      frame.append(error);
    }, { once: true });
    thumb.src = url(photo);
    frame.append(thumb);
    const caption = document.createElement('span');
    caption.className = 'photo-caption';
    const number = document.createElement('span'), label = document.createElement('span');
    number.textContent = labelFor(photo, index); label.textContent = CONFIG.label || 'SHD400';
    caption.append(number, label); button.append(frame, caption);
    button.addEventListener('click', () => openPhoto(index));
    requestAnimationFrame(() => button.classList.add('is-visible'));
    return button;
  }
  function renderBatch() {
    const end = mode === 'sheet' ? photos.length : Math.min(loaded + 10, photos.length);
    const fragment = document.createDocumentFragment();
    for (let i = loaded; i < end; i++) fragment.append(createPhoto(photos[i], i));
    gallery.append(fragment); loaded = end;
    sequence.textContent = `${pad(loaded)} / ${pad(photos.length)} FRAMES`;
    more.hidden = loaded >= photos.length;
    loadingText.textContent = loaded >= photos.length ? '这一卷，到这里。 / END OF ROLL' : '往下，光还在继续。';
  }
  function setView(view) {
    if (!originals.length) return;
    mode = view; loaded = 0;
    photos = originals;
    wander.setAttribute('aria-pressed', String(mode === 'wander'));
    sheet.setAttribute('aria-pressed', String(mode === 'sheet'));
    gallery.classList.toggle('is-sheet', mode === 'sheet');
    document.getElementById('viewHint').textContent = CONFIG.order === 'import'
      ? '按扫描导入顺序展示。点击照片展开细节。'
      : '按底片帧号顺序展示。点击照片展开细节。';
    gallery.replaceChildren(); renderBatch();
  }
  function showPhoto(index) {
    active = (index + photos.length) % photos.length;
    const photo = photos[active];
    status.textContent = '正在载入大图…';
    // Keep the thumbnail visible until the full JPEG has finished loading.
    image.src = url(photo); image.alt = photo.title;
    document.getElementById('lightboxTitle').textContent = photo.title;
    document.getElementById('lightboxMeta').textContent = `${CONFIG.stock || '乐凯 SHD400'} · ${labelFor(photo, active)}`;
    document.getElementById('lightboxCount').textContent = `${pad(active + 1)} / ${pad(photos.length)}`;
    const full = new Image(), expected = active;
    full.onload = () => { if (active === expected && !dialog.hidden) { image.src = full.src; status.textContent = ''; } };
    full.onerror = () => { if (active === expected && !dialog.hidden) status.textContent = '大图暂时未能载入，当前显示预览图'; };
    full.src = url(photo, true);
  }
  function openPhoto(index) {
    focusBefore = document.activeElement;
    dialog.hidden = false; document.body.classList.add('is-locked');
    document.querySelector('main').inert = true;
    document.querySelector('.site-header').inert = true;
    document.querySelector('footer').inert = true;
    showPhoto(index); close.focus();
  }
  function closePhoto() {
    if (dialog.hidden) return;
    dialog.hidden = true; active = -1; image.removeAttribute('src');
    document.body.classList.remove('is-locked');
    document.querySelector('main').inert = false;
    document.querySelector('.site-header').inert = false;
    document.querySelector('footer').inert = false;
    focusBefore?.focus({ preventScroll: true });
  }
  more.addEventListener('click', () => originals.length ? renderBatch() : load());
  wander.addEventListener('click', () => setView('wander'));
  sheet.addEventListener('click', () => setView('sheet'));
  close.addEventListener('click', closePhoto);
  document.getElementById('lightboxPrev').addEventListener('click', () => showPhoto(active - 1));
  document.getElementById('lightboxNext').addEventListener('click', () => showPhoto(active + 1));
  dialog.addEventListener('click', event => { if (event.target === dialog) closePhoto(); });
  dialog.addEventListener('touchstart', event => { lastTouch = event.touches[0]?.clientX; }, { passive: true });
  dialog.addEventListener('touchend', event => {
    const delta = (event.changedTouches[0]?.clientX ?? lastTouch) - lastTouch;
    if (lastTouch !== null && Math.abs(delta) > 65) showPhoto(active + (delta < 0 ? 1 : -1));
    lastTouch = null;
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (dialog.hidden) return;
    if (event.key === 'Escape') closePhoto();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); showPhoto(active + (event.key === 'ArrowRight' ? 1 : -1));
    }
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('button')];
      const current = controls.indexOf(document.activeElement);
      event.preventDefault(); controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }
  });
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && loaded && loaded < photos.length && mode === 'wander') renderBatch();
  }, { rootMargin: '800px' });
  observer.observe(loading);
  async function load() {
    more.hidden = true;
    try {
      let data;
      if (location.protocol === 'file:') {
        data = window.FILM_ROLL_PHOTOS;
      } else {
        const response = await fetch(BASE + 'photos_info.json?v=' + encodeURIComponent(VERSION));
        if (!response.ok) throw new Error('HTTP ' + response.status);
        data = await response.json();
      }
      if (!Array.isArray(data) || !data.length || data.some(photo => !photo.filename || !photo.thumbnail || !(photo.width > 0 && photo.height > 0))) throw new Error('Invalid gallery data');
      originals = data.map((photo, index) => ({...photo, __inputOrder:index})).sort((a,b) => {
        const orderA = Number.isFinite(a.frame) ? a.frame : Number.isFinite(a.sequence) ? a.sequence : a.__inputOrder;
        const orderB = Number.isFinite(b.frame) ? b.frame : Number.isFinite(b.sequence) ? b.sequence : b.__inputOrder;
        return orderA - orderB;
      });
      document.getElementById('photoCount').textContent = originals.length;
      setView('wander');
    } catch (error) {
      console.error('无法载入胶片相册', error);
      sequence.textContent = 'LOAD ERROR'; loadingText.textContent = '照片暂时无法载入';
      more.hidden = false; more.textContent = '重新载入';
    }
  }
  load();
})();
