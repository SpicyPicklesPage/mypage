const gallery = document.getElementById('gallery');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const sequenceLabel = document.getElementById('sequenceLabel');

const PAGE_CONFIG = window.PHOTO_V2_CONFIG || {};
const DATA_URL = PAGE_CONFIG.dataUrl || './My_Gallery/photos_info.json';
const PHOTO_BASE = PAGE_CONFIG.photoBase || './photos/';
const BATCH_SIZE = 10;

// A controlled photobook rhythm: pairs alternate with large solitary photographs.
const EDITORIAL_PATTERN = [
  { size: 'small', align: 'left', inset: .035, before: .02, after: 0 },
  { size: 'medium', align: 'right', inset: .055, pair: true, offset: .08, after: .18 },
  { size: 'large', align: 'left', inset: .08, before: .06, after: .2 },
  { size: 'small', align: 'right', inset: .15, before: .03, after: 0 },
  { size: 'medium', align: 'left', inset: .025, pair: true, offset: .07, after: .18 },
  { size: 'large', align: 'center', inset: 0, before: .05, after: .21 },
  { size: 'small', align: 'left', inset: .16, before: .02, after: 0 },
  { size: 'medium', align: 'right', inset: .025, pair: true, offset: .1, after: .17 },
  { size: 'large', align: 'right', inset: .07, before: .07, after: .22 }
];

let photos = [];
let loadedCount = 0;
let layoutCursor = 0;
let lastPlacement = null;
let isLoading = false;
let activeIndex = -1;
let resizeTimer;
let imageRelayoutTimer;

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function photoTags(photo) {
  const rawTags = photo.tags ?? photo.Tags ?? photo.tag ?? photo.Tag ?? [];
  if (Array.isArray(rawTags)) return rawTags.map(String).map((tag) => tag.trim()).filter(Boolean);
  if (typeof rawTags === 'string') return rawTags.split(/[,;|]/).map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function organizeByTag(allPhotos) {
  const colorPriority = ['Red', 'Orange', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple', 'Magenta', 'B&W'];
  const groups = new Map();
  allPhotos.forEach((photo) => {
    const tags = photoTags(photo);
    const key = tags.find((tag) => colorPriority.includes(tag)) || tags[0] || 'Others';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(photo);
  });
  // 只打乱“色彩组”的先后以及组内顺序，不打散组本身。
  // 因而每次刷新顺序不同，但相似色调仍然连续出现。
  return shuffle([...groups.keys()]).flatMap((key) => (
    shuffle(groups.get(key)).map((photo) => ({ ...photo, __clusterTag: key }))
  ));
}

function photoUrl(filename) {
  return PHOTO_BASE + String(filename).split('/').map(encodeURIComponent).join('/');
}

function calculateLayout() {
  layoutCursor = 0;
  lastPlacement = null;
}

function setPosition(element, x, y, width, height) {
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  if (!element.isConnected) gallery.appendChild(element);
  requestAnimationFrame(() => element.classList.add('is-visible'));
}

function widthFraction(size, ratio, isMobile, isPaired) {
  if (isMobile) {
    if (size === 'small') return ratio < .85 ? .34 : .38;
    if (size === 'medium') return isPaired ? .52 : (ratio < .85 ? .68 : .72);
    return ratio < .85 ? .8 : .98;
  }
  if (size === 'small') return ratio < .85 ? .21 : .28;
  if (size === 'medium') return ratio < .85 ? .36 : .45;
  return ratio < .85 ? .56 : .8;
}

function placeItem(item) {
  const index = Number(item.element.dataset.index);
  const pattern = EDITORIAL_PATTERN[index % EDITORIAL_PATTERN.length];
  const galleryWidth = gallery.clientWidth;
  const viewportHeight = Math.max(640, window.innerHeight);
  const isMobile = galleryWidth < 680;
  const fraction = widthFraction(pattern.size, item.ratio, isMobile, Boolean(pattern.pair));
  const width = galleryWidth * fraction;
  const height = width / item.ratio;
  const availableInset = Math.max(0, galleryWidth - width);
  const inset = Math.min(galleryWidth * pattern.inset, availableInset);

  let x = inset;
  if (pattern.align === 'right') x = galleryWidth - width - inset;
  if (pattern.align === 'center') x = (galleryWidth - width) / 2;

  const pairClearance = galleryWidth * .025;
  const doesNotOverlap = lastPlacement && (
    x + width + pairClearance <= lastPlacement.x
    || lastPlacement.x + lastPlacement.width + pairClearance <= x
  );
  const canPair = pattern.pair && lastPlacement && doesNotOverlap;
  const y = canPair
    ? lastPlacement.top + viewportHeight * pattern.offset
    : layoutCursor + viewportHeight * (pattern.before || 0);
  const bottom = y + height;

  setPosition(item.element, x, y, width, height);
  layoutCursor = Math.max(layoutCursor, bottom) + viewportHeight * pattern.after;
  lastPlacement = { top: y, bottom, x, width };
  gallery.style.height = `${layoutCursor}px`;
}

function createPhotoElement(photo, index) {
  const container = document.createElement('article');
  container.className = 'image-container';
  const width = Number(photo.width) || 3000;
  const height = Number(photo.height) || 2000;
  const ratio = width / height;
  container.dataset.ratio = ratio;
  container.dataset.wide = ratio > 1.6 ? 'true' : 'false';
  container.dataset.cluster = photo.__clusterTag || 'Others';
  container.dataset.index = index;
  container.tabIndex = 0;
  container.setAttribute('role', 'button');
  container.setAttribute('aria-label', `查看照片 ${index + 1}`);
  container.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openLightbox(index); }
  });

  const frame = document.createElement('div');
  frame.className = 'image-frame';
  const image = document.createElement('img');
  image.loading = 'lazy';
  image.decoding = 'async';
  image.src = photoUrl(photo.filename);
  image.alt = photo.title || '摄影作品';
  image.addEventListener('load', () => {
    image.classList.add('is-loaded');

    // JSON 只负责首次占位；最终始终服从照片自身的真实宽高比。
    const naturalRatio = image.naturalWidth / image.naturalHeight;
    if (Number.isFinite(naturalRatio) && Math.abs(naturalRatio - Number(container.dataset.ratio)) > 0.005) {
      container.dataset.ratio = naturalRatio;
      container.dataset.wide = naturalRatio > 1.6 ? 'true' : 'false';
      clearTimeout(imageRelayoutTimer);
      imageRelayoutTimer = setTimeout(relayout, 120);
    }
  });
  const number = document.createElement('p');
  number.className = 'image-number';
  number.textContent = String(index + 1).padStart(3, '0');
  frame.append(image, number);
  container.appendChild(frame);
  container.addEventListener('click', () => openLightbox(index));
  return { element: container, ratio, isWide: ratio > 1.6 };
}

function renderBatch() {
  if (loadedCount >= photos.length) {
    loadingText.textContent = '序列结束 / END OF SEQUENCE';
    loading.querySelector('.loading__line').style.animation = 'none';
    isLoading = false;
    return;
  }
  const end = Math.min(loadedCount + BATCH_SIZE, photos.length);
  for (let index = loadedCount; index < end; index += 1) {
    placeItem(createPhotoElement(photos[index], index));
  }
  loadedCount = end;
  sequenceLabel.textContent = `${String(loadedCount).padStart(3, '0')} / ${String(photos.length).padStart(3, '0')}`;
  loadingText.textContent = '继续向下 / KEEP LOOKING';
  isLoading = false;
}

function relayout() {
  calculateLayout();
  document.querySelectorAll('.image-container').forEach((element) => {
    placeItem({
      element,
      ratio: Number(element.dataset.ratio),
      isWide: element.dataset.wide === 'true'
    });
  });
}

function prepareFilmOpening() {
  const opening = document.getElementById('openingFrame');
  const locationTitle = PAGE_CONFIG.dataUrl ? document.getElementById('pageTitle').textContent : '';
  opening.classList.add('film-opening');
  opening.innerHTML = `
    <div class="film-heading">
      <p class="eyebrow">LIGHT / TIME / MEMORY</p>
      <h1 id="pageTitle" aria-label="昼痕夜像">
        <svg class="film-lettering" viewBox="0 0 700 460" role="img" aria-labelledby="letteringTitle">
          <title id="letteringTitle">昼痕夜像</title>
          <defs><linearGradient id="dayInk"><stop stop-color="#8dafc6"/><stop offset="1" stop-color="#d6c8ba"/></linearGradient><linearGradient id="nightInk"><stop stop-color="#dcb495"/><stop offset="1" stop-color="#ed9a64"/></linearGradient></defs>
          <g fill="none" stroke="url(#dayInk)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(22 20) skewX(-12)">
            <path d="M86 44 Q118 23 143 21 Q143 29 122 51 M93 65 L146 51 M101 54 Q87 106 34 161 Q24 171 15 175 M114 76 Q173 106 209 108 Q222 109 229 104 M116 77 Q147 87 174 99 M109 104 Q105 126 111 149 L136 135 L139 101 Q124 101 110 116 M111 128 L136 115 M82 179 Q129 157 168 153"/>
            <path d="M320 35 Q336 39 326 47 M304 72 Q343 46 378 43 M305 82 Q288 152 251 200 M278 104 L267 98 M277 113 L254 134 M332 101 Q345 89 355 88 Q359 94 347 114 L322 134 M329 115 L350 102 M324 108 Q311 153 320 163 Q329 171 368 123 M332 139 Q409 172 478 182"/>
          </g>
          <g fill="none" stroke="url(#nightInk)" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" transform="translate(290 254) skewX(-12)">
            <path d="M74 7 Q91 5 80 17 M31 50 Q87 19 133 17 M80 45 Q47 91 4 118 M64 69 Q69 81 64 105 M99 39 L86 62 Q102 61 112 50 L97 85 M88 63 L96 72 M96 84 Q124 105 181 110 M98 81 Q73 120 50 136"/>
            <path d="M252 15 Q244 39 215 72 M230 56 L219 106 M267 4 L253 31 Q265 19 279 17 Q278 32 256 49 M259 43 Q275 30 284 32 L274 55 L252 64 L254 45 M255 56 L278 43 M265 61 Q248 79 245 85 M266 67 Q286 96 269 150 Q263 173 256 170 L258 132 M264 84 Q246 106 235 114 M267 103 Q249 134 225 163 M282 80 L306 53 M280 82 Q312 103 368 111"/>
          </g>
        </svg>
      </h1>
      <p class="film-caption">昼的余痕，夜的留像</p>
      <p class="poem-location"></p>
    </div>
    <figure class="opening-print">
      <div class="opening-frame__image"></div>
      <figcaption><span>一瞬 / UN INSTANT</span><span class="print-number"></span></figcaption>
    </figure>
    <div class="opening-colophon">
      <a class="opening-frame__down" href="#galleryStart">循光而行 <span aria-hidden="true">↓</span></a>
      <div class="film-controls">
        <div class="light-choice" role="group" aria-label="页面光色"><button type="button" data-light="cold" aria-pressed="true">昼痕</button><span aria-hidden="true">/</span><button type="button" data-light="warm" aria-pressed="false">夜像</button></div>
        <button class="exposure-toggle" id="exposureToggle" type="button" aria-pressed="false" aria-label="开启显影模式">
          <span class="exposure-toggle__iris" aria-hidden="true"><i></i></span>
          <span class="exposure-toggle__name"><strong>显影</strong><small>LUMEN TRACE</small></span>
          <span class="exposure-toggle__state" aria-hidden="true">未感光</span>
        </button>
      </div>
      <p class="opening-frame__index"><span id="photoCount">—</span> 瞬间留存</p>
    </div>`;
  opening.querySelector('.poem-location').textContent = locationTitle;
  const lightButtons = [...opening.querySelectorAll('[data-light]')];
  const setLight = (light) => {
    document.body.dataset.light = light;
    lightButtons.forEach(option => {
      option.setAttribute('aria-pressed', String(option.dataset.light === light));
    });
  };
  lightButtons.forEach(button => {
    button.addEventListener('click', () => {
      setLight(button.dataset.light);
    });
  });
  setLight(Math.random() < 0.5 ? 'cold' : 'warm');
}

function prepareExposureMode() {
  const toggle = document.getElementById('exposureToggle');
  const state = toggle.querySelector('.exposure-toggle__state');
  let activeSurface = null;

  const setActiveSurface = (surface) => {
    if (surface === activeSurface) return;
    activeSurface?.classList.remove('is-under-exposure');
    activeSurface = surface;
    activeSurface?.classList.add('is-under-exposure');
  };

  const findExposureSurface = (clientX, clientY) => {
    const target = document.elementFromPoint(clientX, clientY);
    return target?.closest('.image-frame, .opening-frame__image') || null;
  };

  const traceExposureAt = (clientX, clientY) => {
    if (!document.body.classList.contains('is-exposure-mode')) return;
    const surface = findExposureSurface(clientX, clientY);
    setActiveSurface(surface);
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    surface.style.setProperty('--exposure-x', `${x.toFixed(1)}px`);
    surface.style.setProperty('--exposure-y', `${y.toFixed(1)}px`);
  };

  const traceExposure = (event) => traceExposureAt(event.clientX, event.clientY);
  const traceTouchExposure = (event) => {
    const touch = event.touches[0];
    if (touch) traceExposureAt(touch.clientX, touch.clientY);
  };

  const setExposureMode = (enabled) => {
    document.body.classList.toggle('is-exposure-mode', enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', `${enabled ? '关闭' : '开启'}显影模式`);
    state.textContent = enabled ? '感光中' : '未感光';
    if (!enabled) setActiveSurface(null);
  };

  toggle.addEventListener('click', () => {
    setExposureMode(toggle.getAttribute('aria-pressed') !== 'true');
  });
  document.addEventListener('pointermove', traceExposure, { passive: true });
  document.addEventListener('pointerdown', traceExposure, { passive: true });
  document.addEventListener('touchstart', traceTouchExposure, { passive: true });
  document.addEventListener('touchmove', traceTouchExposure, { passive: true });
  document.addEventListener('touchend', () => setActiveSurface(null), { passive: true });
  document.addEventListener('touchcancel', () => setActiveSurface(null), { passive: true });
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) setActiveSurface(null);
  });
  window.addEventListener('blur', () => setActiveSurface(null));
}

function setOpeningImage(photo) {
  const image = new Image();
  image.onload = () => {
    const opening = document.getElementById('openingFrame');
    const ratio = image.naturalWidth / image.naturalHeight;
    opening.dataset.orientation = ratio < 1 ? 'portrait' : 'landscape';
    opening.style.setProperty('--print-ratio', ratio);
    image.alt = photo.title || '随机摄影作品';
    image.className = 'opening-photograph';
    document.querySelector('.opening-frame__image').replaceChildren(image);
    opening.querySelector('.print-number').textContent = String(photos.indexOf(photo) + 1).padStart(4, '0');
    opening.classList.add('print-ready');
  };
  image.src = photoUrl(photo.filename);
}

async function loadPhotos() {
  try {
    isLoading = true;
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    photos = organizeByTag(await response.json());
    document.getElementById('photoCount').textContent = photos.length;
    if (photos.length) setOpeningImage(photos[Math.floor(Math.random() * photos.length)]);
    renderBatch();
  } catch (error) {
    console.error('无法读取摄影档案：', error);
    loadingText.textContent = '照片暂时无法载入，请稍后刷新';
    sequenceLabel.textContent = 'LOAD ERROR';
    isLoading = false;
  }
}

function metaFor(photo) {
  const parts = [photo.CameraModel, photo.FocalLength, photo.Aperture, photo.ExposureTime];
  if (photo.ISO) parts.push(`ISO ${photo.ISO}`);
  const tags = photoTags(photo);
  if (tags.length) parts.push(tags.join(' · '));
  return parts.filter(Boolean).map((part) => String(part).trim()).join('  /  ');
}

function openLightbox(index) {
  activeIndex = index;
  const photo = photos[index];
  const lightbox = document.getElementById('lightbox');
  const image = document.getElementById('lightboxImage');
  image.src = photoUrl(photo.filename);
  image.alt = photo.title || '摄影作品';
  document.getElementById('lightboxTitle').textContent = photo.title || 'UNTITLED';
  document.getElementById('lightboxMeta').textContent = metaFor(photo);
  document.getElementById('lightboxCount').textContent = `${String(index + 1).padStart(3, '0')} / ${String(photos.length).padStart(3, '0')}`;
  lightbox.classList.add('is-open');
  lightbox.inert = false;
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
  document.getElementById('lightboxClose').focus();
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.inert = true;
  document.body.classList.remove('is-locked');
}

function stepLightbox(direction) {
  if (!photos.length) return;
  activeIndex = (activeIndex + direction + photos.length) % photos.length;
  openLightbox(activeIndex);
}

function setMenu(open) {
  const menu = document.getElementById('archiveMenu');
  const scrim = document.getElementById('menuScrim');
  menu.classList.toggle('is-open', open);
  scrim.classList.toggle('is-open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menu.inert = !open;
  document.getElementById('menuButton').setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('is-locked', open);
  if (open) document.getElementById('menuClose').focus();
}

document.getElementById('menuButton').addEventListener('click', () => setMenu(true));
document.getElementById('menuClose').addEventListener('click', () => setMenu(false));
document.getElementById('menuScrim').addEventListener('click', () => setMenu(false));
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxPrev').addEventListener('click', () => stepLightbox(-1));
document.getElementById('lightboxNext').addEventListener('click', () => stepLightbox(1));
document.getElementById('lightbox').addEventListener('click', (event) => {
  if (event.target.id === 'lightbox') closeLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeLightbox(); setMenu(false); }
  if (document.getElementById('lightbox').classList.contains('is-open')) {
    if (event.key === 'ArrowLeft') stepLightbox(-1);
    if (event.key === 'ArrowRight') stepLightbox(1);
  }
});
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(relayout, 180);
});
window.addEventListener('scroll', () => {
  if (!isLoading && loadedCount < photos.length && window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
    isLoading = true;
    requestAnimationFrame(renderBatch);
  }
}, { passive: true });

prepareFilmOpening();
prepareExposureMode();
prepareFilmAtmosphere();
calculateLayout();
loadPhotos();

function filmNoise(position, span, seed) {
  const progress = position / span;
  const index = Math.floor(progress);
  const fraction = progress - index;
  const eased = fraction * fraction * (3 - 2 * fraction);
  const randomAt = (point) => {
    const value = Math.sin((point + seed) * 12.9898) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  };
  return randomAt(index) + (randomAt(index + 1) - randomAt(index)) * eased;
}

// Keep the atmosphere behind the photographs and pause it when the page is hidden.
function prepareFilmAtmosphere() {
  const film = document.createElement('div');
  film.className = 'film-atmosphere';
  film.setAttribute('aria-hidden', 'true');
  film.innerHTML = '<div class="film-field"></div><div class="film-leak"></div><div class="film-bokeh"></div><div class="film-eclipse"></div><div class="film-grain"></div><div class="film-scratches"></div>';
  const dust = document.createElement('div');
  dust.className = 'film-dust';
  const particleCount = Math.min(72, Math.max(34, Math.round(window.innerWidth * window.innerHeight / 65000)));
  for (let i = 0; i < particleCount; i += 1) {
    const particle = document.createElement('i');
    const typeRoll = Math.random();
    particle.className = typeRoll > 0.9 ? 'is-flare' : typeRoll > 0.68 ? 'is-grain' : 'is-speck';
    particle.style.cssText = `--x:${Math.random() * 100}%;--y:${Math.random() * 100}%;--size:${0.7 + Math.random() * 3.8}px;--alpha:${0.16 + Math.random() * 0.48};--drift-x:${-46 + Math.random() * 82}px;--drift-y:${-70 - Math.random() * 110}px;--duration:${15 + Math.random() * 24}s;--delay:${-Math.random() * 39}s`;
    dust.appendChild(particle);
  }
  film.appendChild(dust);
  document.body.prepend(film);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const eclipse = film.querySelector('.film-eclipse');
  const ECLIPSE_SCROLL_RATE = 0.02;
  let targetScroll = window.scrollY;
  let renderedScroll = targetScroll;
  let velocity = 0;
  let lastScroll = targetScroll;
  let scrollFrame = 0;
  let eclipseMinY = 0;
  let eclipseLoopLength = 1;
  let eclipseStartOffset = 0;

  const measureEclipseLoop = () => {
    const eclipseStyle = window.getComputedStyle(eclipse);
    const baseTop = Number.parseFloat(eclipseStyle.top) || 0;
    const diameter = eclipse.offsetWidth;
    const halo = Math.min(diameter * .14, 180);
    const eclipseMaxY = window.innerHeight - baseTop + halo;

    eclipseMinY = -diameter - baseTop - halo;
    eclipseLoopLength = eclipseMaxY - eclipseMinY;
    eclipseStartOffset = -eclipseMinY;
  };

  measureEclipseLoop();

  const applyScrollAtmosphere = (position, currentVelocity) => {
    const impulse = Math.max(-2.4, Math.min(2.4, currentVelocity / 172));
    const setShift = (name, value) => film.style.setProperty(name, `${value.toFixed(3)}vmax`);
    const setScale = (name, value) => film.style.setProperty(name, value.toFixed(4));

    setShift('--field-scroll-x', filmNoise(position, 1000, 3) * 1.05 + impulse * .13);
    setShift('--field-scroll-y', filmNoise(position, 900, 11) * .85 - impulse * .09);
    setScale('--field-scroll-scale', 1 + filmNoise(position, 880, 19) * .01 + Math.abs(impulse) * .005);

    setShift('--leak-scroll-x', 0);
    setShift('--leak-scroll-y', 0);
    setScale('--leak-scroll-scale', 1 + filmNoise(position, 980, 43) * .01 + Math.abs(impulse) * .004);

    setShift('--bokeh-scroll-x', filmNoise(position, 920, 53) * 2.5 + impulse * .2);
    setShift('--bokeh-scroll-y', filmNoise(position, 710, 61) * 2.1 - impulse * .26);
    setScale('--bokeh-scroll-scale', 1 + filmNoise(position, 980, 67) * .04);

    const eclipseProgress = ((eclipseStartOffset + position * ECLIPSE_SCROLL_RATE) % eclipseLoopLength + eclipseLoopLength) % eclipseLoopLength;
    film.style.setProperty('--eclipse-scroll-y', `${(eclipseMinY + eclipseProgress).toFixed(2)}px`);

    setShift('--dust-scroll-x', filmNoise(position, 430, 97) * 1.4 + impulse * .28);
    setShift('--dust-scroll-y', filmNoise(position, 510, 101) * 1.15 - impulse * .34);
  };

  const renderScrollAtmosphere = () => {
    renderedScroll += (targetScroll - renderedScroll) * .16;
    velocity *= .84;
    applyScrollAtmosphere(renderedScroll, velocity);
    if (Math.abs(targetScroll - renderedScroll) > .2 || Math.abs(velocity) > .12) {
      scrollFrame = requestAnimationFrame(renderScrollAtmosphere);
    } else {
      renderedScroll = targetScroll;
      applyScrollAtmosphere(renderedScroll, 0);
      scrollFrame = 0;
    }
  };

  const handleAtmosphereScroll = () => {
    const nextScroll = window.scrollY;
    velocity += (nextScroll - lastScroll) * .38;
    targetScroll = nextScroll;
    lastScroll = nextScroll;
    if (!scrollFrame) scrollFrame = requestAnimationFrame(renderScrollAtmosphere);
  };

  applyScrollAtmosphere(targetScroll, 0);
  if (!reducedMotion.matches) window.addEventListener('scroll', handleAtmosphereScroll, { passive: true });
  window.addEventListener('resize', () => {
    measureEclipseLoop();
    applyScrollAtmosphere(renderedScroll, 0);
  }, { passive: true });
  const syncMotion = () => film.classList.toggle('is-paused', document.hidden);
  document.addEventListener('visibilitychange', syncMotion);
  syncMotion();
}
