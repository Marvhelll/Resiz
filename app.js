/* ── État ───────────────────────────────────────────────────────────────── */
const state = {
  items: [],          // [{ img: HTMLImageElement, name: string }]
  currentIndex: 0,
  zoomPercent: 100,
  exportSize: 1080,
  PREVIEW_SIZE: 480,
  THUMB_SIZE: 68,
};

/* ── Éléments DOM ───────────────────────────────────────────────────────── */
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const btnPick       = document.getElementById('btn-pick');
const editor        = document.getElementById('editor');
const thumbList     = document.getElementById('thumb-list');
const btnAdd        = document.getElementById('btn-add');
const fileInputAdd  = document.getElementById('file-input-add');
const btnPrev       = document.getElementById('btn-prev');
const btnNext       = document.getElementById('btn-next');
const carouselCount = document.getElementById('carousel-counter');
const carouselNav   = document.getElementById('carousel-nav');
const canvas        = document.getElementById('preview');
const ctx           = canvas.getContext('2d');
const zoomSlider    = document.getElementById('zoom-slider');
const zoomLabel     = document.getElementById('zoom-label');
const btnResetZoom  = document.getElementById('btn-reset-zoom');
const exportSelect  = document.getElementById('export-size');
const customWrapper = document.getElementById('custom-size-wrapper');
const customInput   = document.getElementById('custom-size');
const btnZip        = document.getElementById('btn-zip');
const btnZipLabel   = document.getElementById('btn-zip-label');
const btnSingle     = document.getElementById('btn-single');
const exportInfo    = document.getElementById('export-info');
const btnInstall    = document.getElementById('btn-install');

/* ── Chargement des fichiers ────────────────────────────────────────────── */
async function loadFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;

  const newItems = await Promise.all(files.map(file => new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ img, name: file.name });
    };
    img.src = url;
  })));

  const wasEmpty = state.items.length === 0;
  const startIndex = state.items.length;
  state.items.push(...newItems);

  newItems.forEach((item, i) => appendThumb(item, startIndex + i));

  if (wasEmpty) {
    state.currentIndex = 0;
    showEditor();
  }

  updateCarousel();
  renderPreview();
  updateZipLabel();
}

/* ── Rendu des vignettes ────────────────────────────────────────────────── */
function appendThumb(item, index) {
  const div = document.createElement('div');
  div.className = 'thumb-item';
  div.dataset.index = index;

  const tc = document.createElement('canvas');
  tc.width = state.THUMB_SIZE;
  tc.height = state.THUMB_SIZE;
  renderThumbCanvas(item.img, tc);

  const rm = document.createElement('button');
  rm.className = 'thumb-remove';
  rm.innerHTML = '✕';
  rm.title = 'Retirer';
  rm.addEventListener('click', e => { e.stopPropagation(); removeItem(Number(div.dataset.index)); });

  div.appendChild(tc);
  div.appendChild(rm);
  div.addEventListener('click', () => goTo(Number(div.dataset.index)));
  thumbList.appendChild(div);
  updateActiveThumb();
}

function renderThumbCanvas(img, tc) {
  const size = state.THUMB_SIZE;
  const c = tc.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, size, size);
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  c.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

function rebuildThumbs() {
  thumbList.innerHTML = '';
  state.items.forEach((item, i) => appendThumb(item, i));
}

function updateActiveThumb() {
  Array.from(thumbList.children).forEach((el, i) => {
    el.classList.toggle('active', i === state.currentIndex);
    el.dataset.index = i;
  });
}

/* ── Suppression d'une image ────────────────────────────────────────────── */
function removeItem(index) {
  state.items.splice(index, 1);

  if (!state.items.length) {
    showDropZone();
    return;
  }

  if (state.currentIndex >= state.items.length) {
    state.currentIndex = state.items.length - 1;
  }

  rebuildThumbs();
  updateCarousel();
  renderPreview();
  updateZipLabel();
}

/* ── Navigation carousel ────────────────────────────────────────────────── */
function goTo(index) {
  state.currentIndex = Math.max(0, Math.min(index, state.items.length - 1));
  updateCarousel();
  renderPreview();
  updateActiveThumb();
  const thumb = thumbList.children[state.currentIndex];
  if (thumb) thumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function updateCarousel() {
  const total = state.items.length;
  carouselCount.textContent = `${state.currentIndex + 1} / ${total}`;
  btnPrev.disabled = state.currentIndex === 0;
  btnNext.disabled = state.currentIndex === total - 1;
  carouselNav.style.visibility = total > 1 ? 'visible' : 'hidden';
}

/* ── Rendu canvas principal ─────────────────────────────────────────────── */
function fitScale(img, size) {
  return Math.min(size / img.naturalWidth, size / img.naturalHeight);
}

function renderPreview() {
  const size = state.PREVIEW_SIZE;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  if (!state.items.length) return;
  const { img } = state.items[state.currentIndex];
  const scale = fitScale(img, size) * (state.zoomPercent / 100);
  const drawW = img.naturalWidth  * scale;
  const drawH = img.naturalHeight * scale;
  ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
}

/* ── Rendu haute résolution (offscreen) ─────────────────────────────────── */
function renderToBlob(img, size, format) {
  return new Promise(resolve => {
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const c = off.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, size, size);
    const scale = fitScale(img, size) * (state.zoomPercent / 100);
    const drawW = img.naturalWidth  * scale;
    const drawH = img.naturalHeight * scale;
    c.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
    const mime    = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = format === 'jpg' ? 0.92 : undefined;
    off.toBlob(resolve, mime, quality);
  });
}

/* ── Export ZIP ─────────────────────────────────────────────────────────── */
async function exportZip() {
  if (!state.items.length || !window.JSZip) return;
  const format = getFormat();
  const size   = state.exportSize;

  btnZip.disabled = true;

  const zip = new JSZip();

  for (let i = 0; i < state.items.length; i++) {
    const { img, name } = state.items[i];
    btnZipLabel.textContent = `${i + 1} / ${state.items.length}…`;
    const blob     = await renderToBlob(img, size, format);
    const baseName = name.replace(/\.[^.]+$/, '');
    zip.file(`${baseName}-${size}px.${format}`, blob);
  }

  btnZipLabel.textContent = 'Compression…';
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  download(zipBlob, `instagram-${size}px.zip`);

  btnZip.disabled = false;
  updateZipLabel();
}

/* ── Export image en cours ──────────────────────────────────────────────── */
async function exportSingle() {
  if (!state.items.length) return;
  const format = getFormat();
  const size   = state.exportSize;
  const { img, name } = state.items[state.currentIndex];
  const blob     = await renderToBlob(img, size, format);
  const baseName = name.replace(/\.[^.]+$/, '');
  download(blob, `${baseName}-${size}px.${format}`);
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function getFormat() {
  return document.querySelector('input[name="format"]:checked')?.value || 'jpg';
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function setZoom(value) {
  state.zoomPercent    = value;
  zoomSlider.value     = value;
  zoomLabel.textContent = `${value}%`;
}

function updateZipLabel() {
  const n = state.items.length;
  btnZipLabel.textContent = n > 1 ? `Télécharger ZIP (${n} photos)` : 'Télécharger ZIP (1 photo)';
}

function updateExportInfo() {
  exportInfo.textContent = `Export : ${state.exportSize} × ${state.exportSize} px`;
}

function showEditor() {
  dropZone.hidden = true;
  editor.hidden   = false;
}

function showDropZone() {
  state.items        = [];
  state.currentIndex = 0;
  thumbList.innerHTML = '';
  editor.hidden   = true;
  dropZone.hidden = false;
}

/* ── Drag & drop sur le drop zone ───────────────────────────────────────── */
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  loadFiles(e.dataTransfer.files);
});
btnPick.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', () => loadFiles(fileInput.files));

/* ── Drag & drop sur l'éditeur (ajout au batch) ─────────────────────────── */
editor.addEventListener('dragover', e => { e.preventDefault(); });
editor.addEventListener('drop', e => { e.preventDefault(); loadFiles(e.dataTransfer.files); });

/* ── Ajout de photos depuis l'éditeur ──────────────────────────────────── */
btnAdd.addEventListener('click', () => fileInputAdd.click());
fileInputAdd.addEventListener('change', () => loadFiles(fileInputAdd.files));

/* ── Carousel ───────────────────────────────────────────────────────────── */
btnPrev.addEventListener('click', () => goTo(state.currentIndex - 1));
btnNext.addEventListener('click', () => goTo(state.currentIndex + 1));

document.addEventListener('keydown', e => {
  if (editor.hidden) return;
  if (e.key === 'ArrowLeft')  goTo(state.currentIndex - 1);
  if (e.key === 'ArrowRight') goTo(state.currentIndex + 1);
});

/* ── Zoom ────────────────────────────────────────────────────────────────── */
zoomSlider.addEventListener('input', () => {
  setZoom(parseInt(zoomSlider.value, 10));
  renderPreview();
});
btnResetZoom.addEventListener('click', () => { setZoom(100); renderPreview(); });

/* ── Taille d'export ────────────────────────────────────────────────────── */
exportSelect.addEventListener('change', () => {
  if (exportSelect.value === 'custom') {
    customWrapper.hidden = false;
    const v = parseInt(customInput.value, 10);
    if (v >= 100 && v <= 5000) state.exportSize = v;
  } else {
    customWrapper.hidden = true;
    state.exportSize = parseInt(exportSelect.value, 10);
  }
  updateExportInfo();
});

customInput.addEventListener('input', () => {
  const v = parseInt(customInput.value, 10);
  if (v >= 100 && v <= 5000) { state.exportSize = v; updateExportInfo(); }
});

/* ── Téléchargement ─────────────────────────────────────────────────────── */
btnZip.addEventListener('click', exportZip);
btnSingle.addEventListener('click', exportSingle);

/* ── Init ────────────────────────────────────────────────────────────────── */
updateExportInfo();
updateZipLabel();

/* ── PWA install ─────────────────────────────────────────────────────────── */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e; btnInstall.hidden = false;
});
btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null; btnInstall.hidden = true;
});
window.addEventListener('appinstalled', () => { btnInstall.hidden = true; deferredPrompt = null; });
