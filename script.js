// DOM Elements
const introScreen = document.getElementById('intro-screen');
const mainScreen = document.getElementById('main-screen');
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

// ローマ字→ひらがな変換マップ
const romajiToHiragana = {
  'A': 'あ', 'I': 'い', 'U': 'う', 'E': 'え', 'O': 'お',
  'KA': 'か', 'KI': 'き', 'KU': 'く', 'KE': 'け', 'KO': 'こ',
  'SA': 'さ', 'SI': 'し', 'SU': 'す', 'SE': 'せ', 'SO': 'そ',
  'SHI': 'し', 'SHA': 'しゃ', 'SHU': 'しゅ', 'SHO': 'しょ',
  'TA': 'た', 'TI': 'ち', 'TU': 'つ', 'TE': 'て', 'TO': 'と',
  'CHI': 'ち', 'TSU': 'つ', 'CHA': 'ちゃ', 'CHU': 'ちゅ', 'CHO': 'ちょ',
  'NA': 'な', 'NI': 'に', 'NU': 'ぬ', 'NE': 'ね', 'NO': 'の',
  'HA': 'は', 'HI': 'ひ', 'HU': 'ふ', 'HE': 'へ', 'HO': 'ほ',
  'FU': 'ふ',
  'MA': 'ま', 'MI': 'み', 'MU': 'む', 'ME': 'め', 'MO': 'も',
  'YA': 'や', 'YU': 'ゆ', 'YO': 'よ',
  'RA': 'ら', 'RI': 'り', 'RU': 'る', 'RE': 'れ', 'RO': 'ろ',
  'WA': 'わ', 'WO': 'を', 'N': 'ん',
  'GA': 'が', 'GI': 'ぎ', 'GU': 'ぐ', 'GE': 'げ', 'GO': 'ご',
  'ZA': 'ざ', 'ZI': 'じ', 'ZU': 'ず', 'ZE': 'ぜ', 'ZO': 'ぞ',
  'JI': 'じ', 'JA': 'じゃ', 'JU': 'じゅ', 'JO': 'じょ',
  'DA': 'だ', 'DI': 'ぢ', 'DU': 'づ', 'DE': 'で', 'DO': 'ど',
  'BA': 'ば', 'BI': 'び', 'BU': 'ぶ', 'BE': 'べ', 'BO': 'ぼ',
  'PA': 'ぱ', 'PI': 'ぴ', 'PU': 'ぷ', 'PE': 'ぺ', 'PO': 'ぽ',
  'KYA': 'きゃ', 'KYU': 'きゅ', 'KYO': 'きょ',
  'GYA': 'ぎゃ', 'GYU': 'ぎゅ', 'GYO': 'ぎょ',
  'NYA': 'にゃ', 'NYU': 'にゅ', 'NYO': 'にょ',
  'HYA': 'ひゃ', 'HYU': 'ひゅ', 'HYO': 'ひょ',
  'BYA': 'びゃ', 'BYU': 'びゅ', 'BYO': 'びょ',
  'PYA': 'ぴゃ', 'PYU': 'ぴゅ', 'PYO': 'ぴょ',
  'MYA': 'みゃ', 'MYU': 'みゅ', 'MYO': 'みょ',
  'RYA': 'りゃ', 'RYU': 'りゅ', 'RYO': 'りょ',
  'OH': 'おお', 'OO': 'おお', 'OU': 'おう',
  'EI': 'えい', 'AI': 'あい', 'AU': 'あう',
  'SYA': 'しゃ', 'SYU': 'しゅ', 'SYO': 'しょ',
  'TYA': 'ちゃ', 'TYU': 'ちゅ', 'TYO': 'ちょ',
};

function convertRomajiToHiragana(romaji) {
  let result = '';
  let i = 0;
  const upper = romaji.toUpperCase();

  while (i < upper.length) {
    let matched = false;

    // 3文字、2文字、1文字の順でマッチを試みる
    for (let len = 3; len >= 1; len--) {
      const chunk = upper.substring(i, i + len);
      if (romajiToHiragana[chunk]) {
        result += romajiToHiragana[chunk];
        i += len;
        matched = true;
        break;
      }
    }

    // 促音（っ）の処理
    if (!matched && i < upper.length - 1) {
      const current = upper[i];
      const next = upper[i + 1];
      if (current === next && 'KSTPGZDBHFMR'.includes(current)) {
        result += 'っ';
        i++;
        matched = true;
      }
    }

    if (!matched) {
      i++;
    }
  }

  return result;
}

// シード付き乱数生成（決定的）
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 文字列からハッシュを生成
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// 今日の日付文字列
function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

// 日付+色IDベースで決定的な表示文を生成
function generateLoreText(color) {
  const seed = hashString(color.id + getTodayString());
  const rand = seededRandom(seed);

  const loreCore = color.lore_core || '';
  const loreDetails = color.lore_details || [];
  const isDisputed = color.lore_status === 'disputed';

  if (!loreCore) {
    // lore_coreがない場合はcore_factとromanceを使用
    return color.romance || color.core_fact || '';
  }

  // パターン選択（0-5）
  const pattern = Math.floor(rand * 6);

  let text = '';

  if (isDisputed) {
    // disputed（諸説あり）の場合
    switch (pattern) {
      case 0:
        text = `諸説あります。${loreCore}`;
        break;
      case 1:
        text = `${loreCore}（※解釈には諸説あります）`;
        break;
      case 2:
        text = loreCore;
        if (loreDetails.length > 0) {
          text += ` ${loreDetails[0]}`;
        }
        break;
      case 3:
        text = `一説によると、${loreCore}`;
        break;
      case 4:
        text = `古くから、${loreCore}`;
        break;
      default:
        text = loreCore;
    }
  } else {
    // theory（一般的説明）の場合
    switch (pattern) {
      case 0:
        text = loreCore;
        break;
      case 1:
        text = loreCore;
        if (loreDetails.length > 0) {
          text += ` ${loreDetails[0]}`;
        }
        break;
      case 2:
        text = `一説によると、${loreCore}`;
        break;
      case 3:
        text = `古くから、${loreCore}`;
        break;
      case 4:
        if (loreDetails.length > 0) {
          text = `${loreCore} ${loreDetails[0]}`;
        } else {
          text = loreCore;
        }
        break;
      default:
        text = loreCore;
    }
  }

  return text;
}

// 和色データを読み込み
async function loadWairoDatabase() {
  try {
    const response = await fetch('./wairo-data.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    // 色データを変換（HEXからRGB、LABを計算）
    wairoDatabase = data.colors.map(color => {
      const rgb = hexToRgb(color.hex);
      const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
      return {
        ...color,
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        L: lab.L,
        a: lab.a,
        b_lab: lab.b
      };
    });

    console.log(`和色データ読み込み完了: ${wairoDatabase.length}色`);
  } catch (e) {
    console.error('和色データ読み込みエラー:', e);
    wairoDatabase = [];
  }
}

// HEX → RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
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
    const distance = deltaE(lab.L, lab.a, lab.b, wairo.L, wairo.a, wairo.b_lab);
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

  const result = findClosestWairo(r, g, b);
  if (result && result.wairo) {
    const wairo = result.wairo;
    wairoName.textContent = wairo.name_ja;

    // ひらがな読みを使用
    wairoReading.textContent = wairo.reading_hiragana || '';

    // 日付ベースの表示文を生成
    const loreText = generateLoreText(wairo);
    wairoDescription.textContent = loreText;
    wairoDescription.style.display = loreText ? 'block' : 'none';
  } else {
    wairoName.textContent = '－';
    wairoReading.textContent = wairoDatabase.length === 0 ? '読み込みエラー' : '該当なし';
    wairoDescription.textContent = '';
    wairoDescription.style.display = 'none';
  }

  colorPopup.classList.remove('hidden');
}

// 同意画面のタップ処理
function handleIntroTap(e) {
  // リンククリックの場合は遷移を許可
  if (e.target.tagName === 'A') {
    return;
  }

  e.preventDefault();
  introScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  initCamera();
}

// カメラ初期化
async function initCamera() {
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

  crosshair.style.left = e.clientX + 'px';
  crosshair.style.top = e.clientY + 'px';
  crosshair.style.display = 'block';

  const videoX = (x / rect.width) * video.videoWidth;
  const videoY = (y / rect.height) * video.videoHeight;

  ctx.drawImage(video, 0, 0);
  const pixel = ctx.getImageData(Math.round(videoX), Math.round(videoY), 1, 1).data;

  const r = pixel[0];
  const g = pixel[1];
  const b = pixel[2];

  showColorInfo(r, g, b);
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

// 初期化
async function init() {
  // 和色データを先に読み込む
  await loadWairoDatabase();

  // 同意画面のタップイベント
  introScreen.addEventListener('click', handleIntroTap);
  introScreen.addEventListener('touchstart', handleIntroTap, { passive: false });
}

init();
