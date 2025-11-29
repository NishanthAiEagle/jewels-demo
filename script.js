const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

let earringImg = null;
let necklaceImg = null;

let currentType = '';
let smoothedFaceLandmarks = null;
let camera;
let smoothedFacePoints = {};

// ================== LOAD FROM GITHUB FOLDERS ==================
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// folder structure:
// gold_earrings/gold_earrings1.png
// diamond_necklaces/diamond_necklaces3.png
function generateImageList(type, count = 20) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push(`${type}/${type}${i}.png`);
  }
  return list;
}

function changeJewelry(type, src) {
  loadImage(src).then(img => {
    if (type.includes("earrings")) {
      earringImg = img;
      necklaceImg = null;
    } else {
      necklaceImg = img;
      earringImg = null;
    }
  });
}

// ================== CATEGORY SELECTION ==================
function toggleCategory(category) {
  document.getElementById('subcategory-buttons').style.display = "flex";
  document.getElementById('jewelry-options').style.display = "none";
  currentType = category;
}

function selectJewelryType(mainType, subType) {
  const type = `${subType}_${mainType}`; // e.g., gold_earrings
  currentType = type;

  document.getElementById('subcategory-buttons').style.display = "none";

  const container = document.getElementById('jewelry-options');
  container.style.display = "flex";
  container.innerHTML = "";

  const images = generateImageList(type, 20);

  images.forEach((src) => {
    const btn = document.createElement("button");
    const img = document.createElement("img");
    img.src = src;
    btn.appendChild(img);
    btn.onclick = () => changeJewelry(type, src);
    container.appendChild(btn);
  });
}

// ================== MEDIAPIPE ==================
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});

faceMesh.onResults((results) => {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks?.length) {
    const newLandmarks = results.multiFaceLandmarks[0];

    if (!smoothedFaceLandmarks) {
      smoothedFaceLandmarks = newLandmarks;
    } else {
      const s = 0.2;
      smoothedFaceLandmarks = smoothedFaceLandmarks.map((prev, i) => ({
        x: prev.x * (1 - s) + newLandmarks[i].x * s,
        y: prev.y * (1 - s) + newLandmarks[i].y * s,
        z: prev.z * (1 - s) + newLandmarks[i].z * s,
      }));
    }

    drawJewelry(smoothedFaceLandmarks, canvasCtx);
  }
});

// camera start
document.addEventListener("DOMContentLoaded", () => startCamera("user"));

videoElement.addEventListener("loadedmetadata", () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});

async function startCamera(facingMode) {
  if (camera) camera.stop();

  camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 1280,
    height: 720,
    facingMode,
  });

  camera.start();
}

// smoothing helper
function smoothPoint(prev, curr, factor = 0.4) {
  if (!prev) return curr;
  return {
    x: prev.x * (1 - factor) + curr.x * factor,
    y: prev.y * (1 - factor) + curr.y * factor,
  };
}

// ================== DRAW JEWELRY ==================
function drawJewelry(face, ctx) {
  if (!face) return;

  const vw = canvasElement.width;
  const vh = canvasElement.height;

  const Leye = face[33];
  const Reye = face[263];
  const dx = (Reye.x - Leye.x) * vw;
  const dy = (Reye.y - Leye.y) * vh;
  const eyeDist = Math.hypot(dx, dy);

  // ----- Earrings -----
  const leftEar = face[132];
  const rightEar = face[361];

  const leftPos = { x: leftEar.x * vw, y: leftEar.y * vh };
  const rightPos = { x: rightEar.x * vw, y: rightEar.y * vh };

  smoothedFacePoints.leftEar = smoothPoint(smoothedFacePoints.leftEar, leftPos);
  smoothedFacePoints.rightEar = smoothPoint(smoothedFacePoints.rightEar, rightPos);

  if (earringImg) {
    const w = eyeDist * 0.42;
    const h = w * (earringImg.height / earringImg.width);

    ctx.drawImage(
      earringImg,
      smoothedFacePoints.leftEar.x - w / 2,
      smoothedFacePoints.leftEar.y,
      w,
      h
    );

    ctx.drawImage(
      earringImg,
      smoothedFacePoints.rightEar.x - w / 2,
      smoothedFacePoints.rightEar.y,
      w,
      h
    );
  }

  // ----- Necklace -----
  const neck = face[152];
  const neckPos = { x: neck.x * vw, y: neck.y * vh };
  smoothedFacePoints.neck = smoothPoint(smoothedFacePoints.neck, neckPos);

  if (necklaceImg) {
    const w = eyeDist * 1.4;
    const h = w * (necklaceImg.height / necklaceImg.width);

    const yOffset = eyeDist * 0.9;

    ctx.drawImage(
      necklaceImg,
      smoothedFacePoints.neck.x - w / 2,
      smoothedFacePoints.neck.y + yOffset,
      w,
      h
    );
  }
}
