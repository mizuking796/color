import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const signalCanvas = document.getElementById("signal-canvas");
const signalCtx = signalCanvas.getContext("2d");
const statusEl = document.getElementById("status");
const bpmEl = document.getElementById("bpm");
const heartEl = document.getElementById("heart");
const confidenceEl = document.getElementById("confidence-fill");
const confidenceValueEl = document.getElementById("confidence-value");
const samplesEl = document.getElementById("samples");
const samplesFillEl = document.getElementById("samples-fill");
const roiBox = document.getElementById("roi-box");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const eyeFatigueEl = document.getElementById("eye-fatigue");

// Settings
const BUFFER_SIZE = 128;
const HIGH_CONFIDENCE = 0.6;
const MID_CONFIDENCE = 0.4;
const LOW_CONFIDENCE = 0.2;
const MEASUREMENT_INTERVAL = 10000;

// State
const signalBuffer = [];
let allSamples = [];  // {bpm, confidence}
let displayedBPM = null;
let fps = 30;
let lastTime = 0;
let intervalStart = 0;
let faceLandmarker = null;
let faceDetected = false;

// Eye fatigue tracking (PERCLOS)
let earHistory = [];           // EAR values over time
const PERCLOS_WINDOW = 60;     // 60秒間のウィンドウ
const EAR_THRESHOLD = 0.2;     // 目が80%閉じている = EAR < 0.2 (通常の20%以下)
let baselineEAR = null;        // 個人のベースラインEAR
let calibrationFrames = [];    // キャリブレーション用

async function init() {
  statusEl.textContent = "モデル読み込み中...";

  try {
    // Load MediaPipe FaceLandmarker
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1
    });

    statusEl.textContent = "カメラを起動中...";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 }
    });

    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    signalCanvas.width = signalCanvas.offsetWidth * 2;
    signalCanvas.height = signalCanvas.offsetHeight * 2;

    statusEl.textContent = "測定中...";
    intervalStart = performance.now();
    requestAnimationFrame(process);

  } catch (e) {
    statusEl.textContent = "エラー: " + e.message;
    progressText.textContent = "カメラへのアクセスを許可してください";
  }
}

function getForeheadFromLandmarks(landmarks) {
  // Forehead points (between eyebrows and hairline)
  const leftBrow = landmarks[70];
  const rightBrow = landmarks[300];
  const foreheadTop = landmarks[10];

  const x = Math.min(leftBrow.x, rightBrow.x) * video.videoWidth;
  const y = foreheadTop.y * video.videoHeight;
  const width = Math.abs(rightBrow.x - leftBrow.x) * video.videoWidth;
  const height = (leftBrow.y - foreheadTop.y) * video.videoHeight * 0.8;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(Math.max(height, 20))
  };
}

function calculateEyeAspectRatio(landmarks) {
  // Left eye landmarks
  const leftEye = {
    top: landmarks[159],
    bottom: landmarks[145],
    left: landmarks[33],
    right: landmarks[133]
  };

  // Right eye landmarks
  const rightEye = {
    top: landmarks[386],
    bottom: landmarks[374],
    left: landmarks[362],
    right: landmarks[263]
  };

  function getEAR(eye) {
    const vertical = Math.abs(eye.top.y - eye.bottom.y);
    const horizontal = Math.abs(eye.right.x - eye.left.x);
    return vertical / (horizontal + 0.001);
  }

  const leftEAR = getEAR(leftEye);
  const rightEAR = getEAR(rightEye);

  return (leftEAR + rightEAR) / 2;
}

function updateEyeFatigue(ear) {
  // Calibration: collect first 90 frames (~3 sec) to establish baseline
  if (baselineEAR === null) {
    calibrationFrames.push(ear);
    eyeFatigueEl.textContent = `目の疲労度: 20%`;
    eyeFatigueEl.style.color = "#4ade80";
    if (calibrationFrames.length >= 90) {
      calibrationFrames.sort((a, b) => b - a);
      baselineEAR = calibrationFrames[Math.floor(calibrationFrames.length * 0.2)];
    }
    return;
  }

  // Store EAR with timestamp
  const now = performance.now();
  earHistory.push({ ear, time: now });

  // Keep only last 60 seconds
  const windowStart = now - (PERCLOS_WINDOW * 1000);
  earHistory = earHistory.filter(e => e.time >= windowStart);

  // Calculate PERCLOS
  const closedThreshold = baselineEAR * 0.2;
  const closedFrames = earHistory.filter(e => e.ear < closedThreshold).length;
  const perclos = earHistory.length > 0 ? (closedFrames / earHistory.length) : 0;

  // Convert to fatigue percentage (20% base + PERCLOS contribution)
  // PERCLOS 0% → 疲労度 20%
  // PERCLOS 40%+ → 疲労度 100%
  const baseFatigue = 20;
  const fatigue = Math.min(100, Math.round(baseFatigue + perclos * 200));

  // Color based on fatigue level
  let color;
  if (fatigue < 40) {
    color = "#4ade80"; // 緑
  } else if (fatigue < 60) {
    color = "#feca57"; // 黄
  } else if (fatigue < 80) {
    color = "#f97316"; // オレンジ
  } else {
    color = "#ff6b6b"; // 赤
  }

  eyeFatigueEl.textContent = `目の疲労度: ${fatigue}%`;
  eyeFatigueEl.style.color = color;
}

function showROI(roi) {
  const videoRect = video.getBoundingClientRect();
  const scaleX = videoRect.width / video.videoWidth;
  const scaleY = videoRect.height / video.videoHeight;

  // Mirror for selfie view
  const mirroredX = video.videoWidth - roi.x - roi.width;

  roiBox.style.left = `${mirroredX * scaleX}px`;
  roiBox.style.top = `${roi.y * scaleY}px`;
  roiBox.style.width = `${roi.width * scaleX}px`;
  roiBox.style.height = `${roi.height * scaleY}px`;
  roiBox.classList.add("visible");
}

function extractSignal(roi) {
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
  const data = imageData.data;

  let g = 0;
  const len = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    g += data[i + 1];
  }
  return g / len;
}

function calculateBPM() {
  if (signalBuffer.length < 64) return { bpm: 0, confidence: 0 };

  const signal = signalBuffer.slice(-BUFFER_SIZE);
  const n = signal.length;

  const mean = signal.reduce((a, b) => a + b) / n;
  const detrended = signal.map(v => v - mean);

  const minLag = Math.round(fps / 4);
  const maxLag = Math.round(fps / 0.75);

  let maxCorr = 0;
  let bestLag = minLag;
  const variance = detrended.reduce((a, b) => a + b * b, 0);

  if (variance === 0) return { bpm: 0, confidence: 0 };

  for (let lag = minLag; lag <= Math.min(maxLag, n - 1); lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += detrended[i] * detrended[i + lag];
    }
    corr /= variance;

    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  const bpm = Math.round((fps / bestLag) * 60);
  const confidence = Math.max(0, Math.min(1, maxCorr));

  return { bpm, confidence };
}

function drawSignal() {
  const w = signalCanvas.width;
  const h = signalCanvas.height;

  signalCtx.fillStyle = "#16162a";
  signalCtx.fillRect(0, 0, w, h);

  if (signalBuffer.length < 2) return;

  const display = signalBuffer.slice(-100);
  const min = Math.min(...display);
  const max = Math.max(...display);
  const range = max - min || 1;

  signalCtx.strokeStyle = "#ff6b6b";
  signalCtx.lineWidth = 2;
  signalCtx.beginPath();

  display.forEach((v, i) => {
    const x = (i / display.length) * w;
    const y = h - ((v - min) / range) * h * 0.8 - h * 0.1;
    i === 0 ? signalCtx.moveTo(x, y) : signalCtx.lineTo(x, y);
  });

  signalCtx.stroke();
}

function updateUI(bpm, confidence) {
  const pct = Math.round(confidence * 100);
  confidenceEl.style.width = pct + "%";
  confidenceValueEl.textContent = pct + "%";

  // Store all samples with confidence
  if (bpm >= 45 && bpm <= 180) {
    allSamples.push({ bpm, confidence });
  }

  // Progress
  const elapsed = performance.now() - intervalStart;
  const timePct = Math.min(1, elapsed / MEASUREMENT_INTERVAL);
  progressFill.style.width = (timePct * 100) + "%";

  const remaining = Math.ceil((MEASUREMENT_INTERVAL - elapsed) / 1000);
  const highCount = allSamples.filter(s => s.confidence >= HIGH_CONFIDENCE).length;
  const midCount = allSamples.filter(s => s.confidence >= MID_CONFIDENCE).length;
  progressText.textContent = `次の更新: ${remaining}秒 (高:${highCount} 中:${midCount})`;

  samplesEl.textContent = `${allSamples.length} 個収集中`;
  samplesFillEl.style.width = (timePct * 100) + "%";

  // Display BPM
  if (displayedBPM !== null) {
    bpmEl.textContent = displayedBPM;
    bpmEl.style.opacity = "1";
    heartEl.classList.add("beating");
    heartEl.style.animationDuration = (60 / displayedBPM) + "s";
    statusEl.textContent = "測定中 (10秒ごとに更新)";
  } else if (faceDetected) {
    bpmEl.textContent = "60";
    bpmEl.style.opacity = "0.3";
    heartEl.classList.remove("beating");
    statusEl.textContent = "初回測定中...";
  } else {
    bpmEl.textContent = "--";
    bpmEl.style.opacity = "0.5";
    heartEl.classList.remove("beating");
    statusEl.textContent = "顔を検出してください";
  }
}

function finalizeMeasurement() {
  if (!faceDetected && allSamples.length === 0) {
    displayedBPM = 60; // Default when face detected but no data
    allSamples = [];
    intervalStart = performance.now();
    return;
  }

  // Tiered selection: high > mid > low > any
  let selected = allSamples.filter(s => s.confidence >= HIGH_CONFIDENCE);

  if (selected.length === 0) {
    selected = allSamples.filter(s => s.confidence >= MID_CONFIDENCE);
    console.log("中信頼サンプルを使用");
  }

  if (selected.length === 0) {
    selected = allSamples.filter(s => s.confidence >= LOW_CONFIDENCE);
    console.log("低信頼サンプルを使用");
  }

  if (selected.length === 0 && allSamples.length > 0) {
    // Use highest confidence ones available
    allSamples.sort((a, b) => b.confidence - a.confidence);
    selected = allSamples.slice(0, Math.min(5, allSamples.length));
    console.log("最高信頼度のサンプルを使用");
  }

  if (selected.length > 0) {
    const avg = Math.round(selected.reduce((a, b) => a + b.bpm, 0) / selected.length);
    displayedBPM = avg;
    console.log(`${selected.length}サンプル → 平均: ${avg} BPM`);
  } else if (faceDetected) {
    displayedBPM = 60;
    console.log("サンプルなし → デフォルト: 60 BPM");
  }

  allSamples = [];
  intervalStart = performance.now();
}

async function process(time) {
  if (lastTime > 0) {
    const delta = time - lastTime;
    fps = fps * 0.9 + (1000 / delta) * 0.1;
  }
  lastTime = time;

  // Detect face with MediaPipe
  if (faceLandmarker) {
    const results = faceLandmarker.detectForVideo(video, time);

    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      faceDetected = true;
      const landmarks = results.faceLandmarks[0];

      // Get forehead ROI from landmarks
      const roi = getForeheadFromLandmarks(landmarks);
      showROI(roi);

      // Extract PPG signal
      const value = extractSignal(roi);
      signalBuffer.push(value);
      if (signalBuffer.length > BUFFER_SIZE) signalBuffer.shift();

      // Calculate eye fatigue
      const ear = calculateEyeAspectRatio(landmarks);
      updateEyeFatigue(ear);

      // Calculate BPM
      const { bpm, confidence } = calculateBPM();
      updateUI(bpm, confidence);
      drawSignal();
    } else {
      faceDetected = false;
      updateUI(0, 0);
      eyeFatigueEl.textContent = "目の疲労度: --%";
    }
  }

  requestAnimationFrame(process);
}

setInterval(finalizeMeasurement, MEASUREMENT_INTERVAL);

init();
