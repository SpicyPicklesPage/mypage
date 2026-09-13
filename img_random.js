const gallery = document.getElementById('gallery');
const loading = document.getElementById('loading');

// --- 配置参数 ---
const IDEAL_COL_WIDTH = 480;  // 480px 左右通常在电脑上显示 4 栏
const BATCH_SIZE = 20;        // 每次渲染 20 张
const MAX_HEIGHT_DIFF = 50;   // 填缝高度容差

// --- 填充素材配置 ---
const FILLER_GIFS_NORMAL = [
  'assets/Cinematic_3d_animation_202602132254.gif',
  'assets/Constraint_use_the_202602132217.gif',
  'assets/Constraint_use_the_202602132242.gif',
  'assets/Constraint_use_the_202602132249.gif',
  'assets/veiled_virgin.gif',
  'assets/veiled_virgin.gif',
  'assets/veiled_virgin.gif',
];

// 【扁平缝隙】专用素材 (横构图)
// 比如一个卧倒的石膏像，或者流动的纹理，适合高度较小的缝隙
const FILLER_GIF_FLAT = [
  'assets/Cinematic_3d_animation_202602132259.gif',
  'assets/veiled_virgin.gif',
  'assets/trident.gif',
  'assets/Constraint_use_the_202602132217.gif',
];
const FLAT_GAP_THRESHOLD = 0.6;

// 状态变量
let photosData = [];
let loadedCount = 0;
let colHeights = [];
let colCount = 0;
let colWidth = 0;
let gaps = [];

function init() {
  createLightboxDOM();
  calculateLayout();
  window.addEventListener('resize', debounce(() => {
    calculateLayout();
    repositionAll();
  }, 200));
  window.addEventListener('scroll', handleScroll);
  loadPhotos();
}

function calculateLayout() {
  const w = gallery.clientWidth;
  colCount = Math.max(1, Math.floor(w / IDEAL_COL_WIDTH));
  colWidth = w / colCount;

  if (colHeights.length !== colCount) {
    colHeights = new Array(colCount).fill(0);
    gaps = [];
  }
}

// --- 【核心修改】按颜色/标签分组排序函数 ---
function organizeByTag(allPhotos) {
  const groups = {};

  // 颜色优先级：我们希望优先按这些强烈的颜色分组，而不是按 "High Key" 这种氛围分组
  const colorPriority = ['Red', 'Orange', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple', 'Magenta', 'B&W'];

  allPhotos.forEach(photo => {
    let bestTag = 'Others'; // 默认分组

    if (photo.tags && photo.tags.length > 0) {
      // 策略：尝试在 tags 里找有没有上面的优先颜色
      const priorityTag = photo.tags.find(t => colorPriority.includes(t));

      if (priorityTag) {
        bestTag = priorityTag; // 如果有颜色，就用颜色分组
      } else {
        bestTag = photo.tags[0]; // 如果没有颜色（比如只有 Cool），就用第一个标签
      }
    }

    if (!groups[bestTag]) {
      groups[bestTag] = [];
    }
    groups[bestTag].push(photo);
  });

  // 1. 组间打乱 (随机决定先看蓝色组，还是先看红色组)
  const groupNames = Object.keys(groups);
  groupNames.sort(() => Math.random() - 0.5);

  console.log("本次加载顺序:", groupNames); // 调试用，看看这次随到了什么顺序

  // 2. 组内打乱 (蓝色组里的照片也要随机排序) 并合并
  let organizedPhotos = [];
  groupNames.forEach(key => {
    const photosInGroup = groups[key].sort(() => Math.random() - 0.5);
    organizedPhotos = organizedPhotos.concat(photosInGroup);
  });

  return organizedPhotos;
}

async function loadPhotos() {
  if (loading.getAttribute('data-loading') === 'true') return;
  loading.setAttribute('data-loading', 'true');
  loading.style.display = 'block';

  try {
    if (photosData.length === 0) {
      // 加上时间戳防止缓存
      const res = await fetch('./photos_info.json');
      let rawData = await res.json();

      // --- 【核心修改】调用分组排序 ---
      photosData = organizeByTag(rawData);
    }
    renderBatch();
  } catch (e) {
    console.error("加载失败:", e);
    loading.innerText = '加载出错';
  } finally {
    if (loadedCount >= photosData.length) {
      loading.innerText = '--- End ---';
      fillAllRemainingGaps();
    } else {
      loading.style.display = 'none';
      loading.setAttribute('data-loading', 'false');
    }
  }
}

function renderBatch() {
  const end = Math.min(loadedCount + BATCH_SIZE, photosData.length);
  if (loadedCount >= end) return;

  const batch = photosData.slice(loadedCount, end);

  batch.forEach(photo => {
    let w = photo.width;
    let h = photo.height;
    if (!w || !h) { w = 3000; h = 2000; }

    const ratio = w / h;
    const isWide = ratio > 1.6;

    const item = {
      data: photo,
      ratio: ratio,
      isWide: isWide,
      element: createItemElement(photo, ratio, isWide)
    };

    placeItem(item);
  });

  loadedCount += batch.length;

  // 每次加载完一批，立刻尝试用 GIF 填缝
  fillAllRemainingGaps();

  if (Math.min(...colHeights) < window.innerHeight) {
    requestAnimationFrame(renderBatch);
  }
}

// --- 填缝逻辑 (保持不变) ---
function fillAllRemainingGaps() {
  if (gaps.length === 0) return;

  for (let i = gaps.length - 1; i >= 0; i--) {
    const gap = gaps[i];
    if (gap.height > 0) {
      const div = document.createElement('div');
      div.className = 'image-container filler-item';

      let selectedSrc = '';
      const gapRatio = gap.height / colWidth;

      if (gapRatio < FLAT_GAP_THRESHOLD) {
        // 扁缝隙
        const randomIndex1 = Math.floor(Math.random() * FILLER_GIF_FLAT.length);
        selectedSrc = FILLER_GIF_FLAT[randomIndex1];
      } else {
        // 普通缝隙，随机选一个
        const randomIndex = Math.floor(Math.random() * FILLER_GIFS_NORMAL.length);
        selectedSrc = FILLER_GIFS_NORMAL[randomIndex];
      }

      // 注意：这里需要 onerror 处理，防止 GIF 链接失效导致报错
      div.innerHTML = `
                <div class="image-content-wrapper">
                    <img src="${selectedSrc}" alt="decoration" 
                         style="width: 100%; height: 100%; object-fit: contain;"
                         onerror="this.style.display='none'"> 
                </div>
            `;

      setStyles(div, gap.col * colWidth, gap.top, colWidth, gap.height);
      gaps.splice(i, 1);
    }
  }
}

// --- 排版逻辑 (保持不变) ---
function placeItem(item) {
  let bestGapIndex = -1;
  let minGapDiff = Infinity;

  // 不再剔除扁缝隙，留给 GIF
  if (!item.isWide && gaps.length > 0) {
    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i];
      const imgIdealHeight = colWidth / item.ratio;
      const diff = Math.abs(imgIdealHeight - gap.height);

      if (diff <= MAX_HEIGHT_DIFF) {
        if (diff < minGapDiff) {
          minGapDiff = diff;
          bestGapIndex = i;
        }
      }
    }
  }

  if (bestGapIndex !== -1) {
    const gap = gaps[bestGapIndex];
    setStyles(item.element, gap.col * colWidth, gap.top, colWidth, gap.height);
    gaps.splice(bestGapIndex, 1);
  } else {
    placeAtBottom(item);
  }
}

function placeAtBottom(item) {
  let span = (item.isWide && colCount > 1) ? 2 : 1;
  let targetCol = 0;
  let targetTop = 0;

  if (span === 1) {
    let minH = Math.min(...colHeights);
    targetCol = colHeights.indexOf(minH);
    targetTop = minH;

    const h = colWidth / item.ratio;
    colHeights[targetCol] += h;
    setStyles(item.element, targetCol * colWidth, targetTop, colWidth, h);

  } else {
    let minPairH = Infinity;
    let idx = 0;
    for (let i = 0; i < colCount - 1; i++) {
      const maxH = Math.max(colHeights[i], colHeights[i + 1]);
      if (maxH < minPairH) { minPairH = maxH; idx = i; }
    }
    targetCol = idx;
    targetTop = minPairH;

    if (Math.floor(colHeights[targetCol]) < Math.floor(targetTop)) {
      gaps.push({ col: targetCol, top: colHeights[targetCol], height: targetTop - colHeights[targetCol] });
    }
    if (Math.floor(colHeights[targetCol + 1]) < Math.floor(targetTop)) {
      gaps.push({ col: targetCol + 1, top: colHeights[targetCol + 1], height: targetTop - colHeights[targetCol + 1] });
    }

    const h = (colWidth * 2) / item.ratio;
    colHeights[targetCol] = targetTop + h;
    colHeights[targetCol + 1] = targetTop + h;
    setStyles(item.element, targetCol * colWidth, targetTop, colWidth * 2, h);
  }

  gallery.style.height = Math.max(...colHeights) + 'px';
}

function setStyles(el, x, y, w, h) {
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  el.style.left = 0;
  el.style.top = 0;
  if (!el.isConnected) gallery.appendChild(el);
  requestAnimationFrame(() => el.style.opacity = 1);
}

function createItemElement(data, ratio, isWide) {
  const div = document.createElement('div');
  div.className = 'image-container';
  div.dataset.ratio = ratio;
  div.dataset.isWide = isWide;
  const imgSrc = `photos/${data.filename}`;

  // 使用 tags 里的第一个标签作为图片说明的一部分，可选
  const tagText = (data.tags && data.tags.length > 0) ? ` - ${data.tags.join(', ')}` : '';

  div.innerHTML = `
        <div class="image-content-wrapper" style="background-color: #eee;">
            <img src="${imgSrc}" loading="lazy" alt="${(data.title || '') + tagText}" style="opacity:0;transition:opacity 0.5s ease;" onload="this.style.opacity=1" onerror="this.parentElement.style.backgroundColor='#f8d7da'">
        </div>`;
  div.addEventListener('click', () => openLightbox(data, imgSrc));
  return div;
}

// --- 灯箱逻辑 (保持不变) ---
function createLightboxDOM() {
  if (document.getElementById('lightbox')) return;
  const lightbox = document.createElement('div');
  lightbox.id = 'lightbox';
  lightbox.innerHTML = `<div id="lightbox-close">&times;</div><img src="" alt=""><div id="lightbox-info"><h3 id="lb-title"></h3><p id="lb-meta"></p></div>`;
  document.body.appendChild(lightbox);
  lightbox.addEventListener('click', (e) => { if (e.target !== lightbox.querySelector('img')) closeLightbox(); });
}
function openLightbox(data, src) {
  const lightbox = document.getElementById('lightbox');
  const img = lightbox.querySelector('img');
  const title = document.getElementById('lb-title');
  const meta = document.getElementById('lb-meta');
  img.src = src;
  title.innerText = data.title || '';
  const metaParts = [];
  if (data.CameraModel) metaParts.push(data.CameraModel.trim());
  if (data.FocalLength) metaParts.push(data.FocalLength.trim());
  if (data.Aperture) metaParts.push(data.Aperture.trim());
  if (data.ExposureTime) metaParts.push(data.ExposureTime.trim());
  if (data.ISO) metaParts.push("ISO " + data.ISO.trim());

  // 在灯箱里也显示标签
  if (data.tags && data.tags.length > 0) {
    metaParts.push(data.tags.join(', '));
  }

  meta.innerText = metaParts.join('  |  ');
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

function repositionAll() {
  colHeights = new Array(colCount).fill(0);
  gaps = [];
  const els = Array.from(document.querySelectorAll('.image-container'));
  els.forEach(el => {
    if (el.classList.contains('filler-item')) { el.remove(); return; }
    const ratio = parseFloat(el.dataset.ratio);
    const isWide = el.dataset.isWide === 'true';
    const item = { element: el, ratio: ratio, isWide: isWide };
    placeAtBottom(item);
  });
  gallery.style.height = Math.max(...colHeights) + 'px';
}

function debounce(fn, t) {
  let timer;
  return () => { clearTimeout(timer); timer = setTimeout(fn, t); }
}

function handleScroll() {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 800) {
    loadPhotos();
  }
}

init();
