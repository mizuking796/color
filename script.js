const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const crosshair = document.getElementById('crosshair');
const colorPopup = document.getElementById('color-popup');
const colorPreview = document.getElementById('color-preview');
const hexValue = document.getElementById('hex-value');
const rgbValue = document.getElementById('rgb-value');
const hslValue = document.getElementById('hsl-value');
const wairoName = document.getElementById('wairo-name');
const wairoReading = document.getElementById('wairo-reading');
const wairoDescription = document.getElementById('wairo-description');
const closePopup = document.getElementById('close-popup');
const statusEl = document.getElementById('status');

// 和色データベース
let wairoDatabase = [];

// 和色データを読み込み
async function loadWairoDatabase() {
  try {
    const response = await fetch('./wairo.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    wairoDatabase = await response.json();
    console.log(`和色データ読み込み完了: ${wairoDatabase.length}色`);
  } catch (e) {
    console.error('和色データ読み込みエラー:', e);
    wairoDatabase = [];
  }
}

async function init() {
  try {
    // 和色データを先に読み込む
    await loadWairoDatabase();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    statusEl.classList.add('hidden');
    setupTouchHandlers();

  } catch (e) {
    statusEl.textContent = 'カメラエラー: ' + e.message;
  }
}

function setupTouchHandlers() {
  const container = document.querySelector('.camera-container');

  container.addEventListener('click', handleTap);
  container.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleTap({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: false });
}

function handleTap(e) {
  const rect = video.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Show crosshair
  crosshair.style.left = e.clientX + 'px';
  crosshair.style.top = e.clientY + 'px';
  crosshair.style.display = 'block';

  // Map to video coordinates
  const videoX = (x / rect.width) * video.videoWidth;
  const videoY = (y / rect.height) * video.videoHeight;

  // Draw current frame and get pixel
  ctx.drawImage(video, 0, 0);
  const pixel = ctx.getImageData(Math.round(videoX), Math.round(videoY), 1, 1).data;

  const r = pixel[0];
  const g = pixel[1];
  const b = pixel[2];

  showColorInfo(r, g, b);
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// RGB → LAB 変換
function rgbToLab(r, g, b) {
  // RGB → XYZ
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

  rr *= 100;
  gg *= 100;
  bb *= 100;

  const x = rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375;
  const y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750;
  const z = rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041;

  // XYZ → LAB (D65 illuminant)
  let xx = x / 95.047;
  let yy = y / 100.000;
  let zz = z / 108.883;

  xx = xx > 0.008856 ? Math.pow(xx, 1/3) : (7.787 * xx) + (16 / 116);
  yy = yy > 0.008856 ? Math.pow(yy, 1/3) : (7.787 * yy) + (16 / 116);
  zz = zz > 0.008856 ? Math.pow(zz, 1/3) : (7.787 * zz) + (16 / 116);

  const L = (116 * yy) - 16;
  const a = 500 * (xx - yy);
  const bVal = 200 * (yy - zz);

  return { L, a, b: bVal };
}

// LAB色空間での距離（Delta E CIE76）
function deltaE(L1, a1, b1, L2, a2, b2) {
  return Math.sqrt(
    Math.pow(L1 - L2, 2) +
    Math.pow(a1 - a2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

// 最も近い和色を検索（LAB距離使用）
function findClosestWairo(r, g, b) {
  if (wairoDatabase.length === 0) {
    return null;
  }

  const lab = rgbToLab(r, g, b);
  let closest = null;
  let minDistance = Infinity;

  for (const wairo of wairoDatabase) {
    const distance = deltaE(lab.L, lab.a, lab.b, wairo.L, wairo.a, wairo.b);
    if (distance < minDistance) {
      minDistance = distance;
      closest = wairo;
    }
  }

  return { wairo: closest, distance: minDistance };
}

function showColorInfo(r, g, b) {
  const hex = rgbToHex(r, g, b);
  const hsl = rgbToHsl(r, g, b);

  colorPreview.style.backgroundColor = hex;
  hexValue.textContent = hex;
  rgbValue.textContent = `${r}, ${g}, ${b}`;
  hslValue.textContent = `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`;

  // 和色を検索（LAB距離）
  const result = findClosestWairo(r, g, b);
  if (result && result.wairo) {
    const wairo = result.wairo;
    wairoName.textContent = wairo.name;
    wairoReading.textContent = wairo.reading || '';
    wairoDescription.textContent = wairo.memo || '';
    wairoDescription.style.display = wairo.memo ? 'block' : 'none';
  } else {
    wairoName.textContent = '－';
    wairoReading.textContent = wairoDatabase.length === 0 ? '読み込みエラー' : '該当なし';
    wairoDescription.textContent = '';
    wairoDescription.style.display = 'none';
  }

  colorPopup.classList.remove('hidden');
}

// Copy buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const text = document.getElementById(targetId).textContent;
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = '済';
      setTimeout(() => btn.textContent = original, 1000);
    });
  });
});

// Close popup
closePopup.addEventListener('click', () => {
  colorPopup.classList.add('hidden');
  crosshair.style.display = 'none';
});

init();
