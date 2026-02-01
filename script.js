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

// 和色データベース（後で差し替え）
const wairoDatabase = [];

async function init() {
  try {
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

// 色の距離を計算（CIE76 簡易版）
function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

// 最も近い和色を検索
function findClosestWairo(r, g, b) {
  if (wairoDatabase.length === 0) {
    return null;
  }

  let closest = null;
  let minDistance = Infinity;

  for (const wairo of wairoDatabase) {
    const distance = colorDistance(r, g, b, wairo.r, wairo.g, wairo.b);
    if (distance < minDistance) {
      minDistance = distance;
      closest = wairo;
    }
  }

  return closest;
}

function showColorInfo(r, g, b) {
  const hex = rgbToHex(r, g, b);
  const hsl = rgbToHsl(r, g, b);

  colorPreview.style.backgroundColor = hex;
  hexValue.textContent = hex;
  rgbValue.textContent = `${r}, ${g}, ${b}`;
  hslValue.textContent = `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`;

  // 和色を検索
  const wairo = findClosestWairo(r, g, b);
  if (wairo) {
    wairoName.textContent = wairo.name;
    wairoReading.textContent = wairo.reading || '';
    wairoDescription.textContent = wairo.description || '';
    wairoDescription.style.display = wairo.description ? 'block' : 'none';
  } else {
    wairoName.textContent = '－';
    wairoReading.textContent = '和色データ準備中';
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
