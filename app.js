/* ── État applicatif ────────────────────────────────────────────────────── */
const state = {
  image: null,
  zoomPercent: 100,
  fitScale: 1,
  exportSize: 1080,
  PREVIEW_SIZE: 480,
};

/* ── Éléments DOM ───────────────────────────────────────────────────────── */
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const btnPick        = document.getElementById('btn-pick');
const editor         = document.getElementById('editor');
const canvas         = document.getElementById('preview');
const ctx            = canvas.getContext('2d');
const btnChange      = document.getElementById('btn-change');
const zoomSlider     = document.getElementById('zoom-slider');
const zoomLabel      = document.getElementById('zoom-label');
const btnResetZoom   = document.getElementById('btn-reset-zoom');
const exportSelect   = document.getElementById('export-size');
const customWrapper  = document.getElementById('custom-size-wrapper');
const customInput    = document.getElementById('custom-size');
const btnJpg         = document.getElementById('btn-jpg');
const btnPng         = document.getElementById('btn-png');
const exportInfo     = document.getElementById('export-info');
const btnInstall     = document.getElementById('btn-install');

/* ── Import image ───────────────────────────────────────────────────────── */
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    URL.revokeObjectURL(url);
    computeFitScale();
    setZoom(100);
    showEditor();
    renderPreview();
  };
  img.src = url;
}

/* Drag & drop */
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  loadFile(e.dataTransfer.files[0]);
});

/* Clic sur le bouton "Choisir une image" */
btnPick.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

/* Input file (clic sur le drop-zone ou le bouton) */
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

/* Changer d'image depuis l'éditeur */
btnChange.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

/* ── Affichage / masquage ───────────────────────────────────────────────── */
function showEditor() {
  dropZone.hidden = true;
  editor.hidden = false;
}

function showDropZone() {
  editor.hidden = true;
  dropZone.hidden = false;
}

/* ── Calcul du fitScale (cover) ─────────────────────────────────────────── */
function computeFitScale() {
  const scaleX = state.PREVIEW_SIZE / state.image.naturalWidth;
  const scaleY = state.PREVIEW_SIZE / state.image.naturalHeight;
  /* contain : le côté le plus long touche le bord, image entière visible */
  state.fitScale = Math.min(scaleX, scaleY);
}

/* ── Rendu du canvas de prévisualisation ────────────────────────────────── */
function renderPreview() {
  canvas.width  = state.PREVIEW_SIZE;
  canvas.height = state.PREVIEW_SIZE;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, state.PREVIEW_SIZE, state.PREVIEW_SIZE);

  if (!state.image) return;

  const effective = state.fitScale * (state.zoomPercent / 100);
  const drawW     = state.image.naturalWidth  * effective;
  const drawH     = state.image.naturalHeight * effective;
  const offsetX   = (state.PREVIEW_SIZE - drawW) / 2;
  const offsetY   = (state.PREVIEW_SIZE - drawH) / 2;

  ctx.drawImage(state.image, offsetX, offsetY, drawW, drawH);
}

/* ── Zoom ───────────────────────────────────────────────────────────────── */
function setZoom(value) {
  state.zoomPercent    = value;
  zoomSlider.value     = value;
  zoomLabel.textContent = `${value}%`;
}

zoomSlider.addEventListener('input', () => {
  setZoom(parseInt(zoomSlider.value, 10));
  renderPreview();
});

btnResetZoom.addEventListener('click', () => {
  setZoom(100);
  renderPreview();
});

/* ── Taille d'export ────────────────────────────────────────────────────── */
function updateExportInfo() {
  exportInfo.textContent = `Export : ${state.exportSize} × ${state.exportSize} px`;
}

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
  if (v >= 100 && v <= 5000) {
    state.exportSize = v;
    updateExportInfo();
  }
});

/* ── Export haute résolution ────────────────────────────────────────────── */
function exportImage(format) {
  if (!state.image) return;

  const size       = state.exportSize;
  const offscreen  = document.createElement('canvas');
  offscreen.width  = size;
  offscreen.height = size;
  const offCtx     = offscreen.getContext('2d');

  offCtx.fillStyle = '#ffffff';
  offCtx.fillRect(0, 0, size, size);

  /* Recalcul du fitScale pour la résolution d'export */
  const scaleX      = size / state.image.naturalWidth;
  const scaleY      = size / state.image.naturalHeight;
  const exportFit   = Math.min(scaleX, scaleY);
  const effective   = exportFit * (state.zoomPercent / 100);
  const drawW       = state.image.naturalWidth  * effective;
  const drawH       = state.image.naturalHeight * effective;
  const offsetX     = (size - drawW) / 2;
  const offsetY     = (size - drawH) / 2;

  offCtx.drawImage(state.image, offsetX, offsetY, drawW, drawH);

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality  = format === 'jpg' ? 0.92 : undefined;

  offscreen.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `instagram-${size}px.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, mimeType, quality);
}

btnJpg.addEventListener('click', () => exportImage('jpg'));
btnPng.addEventListener('click', () => exportImage('png'));

/* ── Initialisation ─────────────────────────────────────────────────────── */
updateExportInfo();

/* ── PWA : bouton "Installer l'app" ─────────────────────────────────────── */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.hidden = false;
});

btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt  = null;
  btnInstall.hidden = true;
});

window.addEventListener('appinstalled', () => {
  btnInstall.hidden = true;
  deferredPrompt    = null;
});
