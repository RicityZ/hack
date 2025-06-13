// ✅ app.js - แอปตรวจจับท่า Squat / Push-Up / Plank ด้วย MoveNet

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const feedback = document.getElementById("feedback");
const poseSelect = document.getElementById("poseSelect");
const startBtn = document.getElementById("startBtn");

let detector, recording = false, poseLog = [], currentPose = "pushup";

const skeletonConnections = [
  [0, 1], [1, 3], [0, 2], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16]
];

function isValid(kp) {
  return kp && kp.score > 0.3;
}

function drawSkeleton(keypoints) {
  ctx.save();
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 4;
  skeletonConnections.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    if (isValid(kp1) && isValid(kp2)) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawKeypoints(keypoints) {
  keypoints.forEach(kp => {
    if (isValid(kp)) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 7, 0, 2 * Math.PI);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: 720, height: 540 },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise(resolve => video.onloadedmetadata = resolve);
  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

async function loadPoseDetector() {
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
  });
}

async function detectPose() {
  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (poses.length > 0) {
    const keypoints = poses[0].keypoints;
    drawSkeleton(keypoints);
    drawKeypoints(keypoints);

    if (recording) {
      const R = {
        shoulder: keypoints[6], elbow: keypoints[8], wrist: keypoints[10],
        hip: keypoints[12], knee: keypoints[14], ankle: keypoints[16],
        ear: keypoints[4]
      };
      const L = {
        shoulder: keypoints[5], elbow: keypoints[7], wrist: keypoints[9],
        hip: keypoints[11], knee: keypoints[13], ankle: keypoints[15],
        ear: keypoints[3]
      };

      const frameData = { second: poseLog.length + 1 };

      frameData.bodyAngleR = isValid(R.shoulder) && isValid(R.hip) && isValid(R.ankle)
        ? +getAngle(R.shoulder, R.hip, R.ankle).toFixed(1) : null;
      frameData.bodyAngleL = isValid(L.shoulder) && isValid(L.hip) && isValid(L.ankle)
        ? +getAngle(L.shoulder, L.hip, L.ankle).toFixed(1) : null;

      if (currentPose === "pushup") {
        frameData.elbowAngleR = isValid(R.shoulder) && isValid(R.elbow) && isValid(R.wrist)
          ? +getAngle(R.shoulder, R.elbow, R.wrist).toFixed(1) : null;
        frameData.armSpreadR = isValid(R.elbow) && isValid(R.shoulder)
          ? +Math.abs(R.elbow.x - R.shoulder.x).toFixed(1) : null;

        frameData.elbowAngleL = isValid(L.shoulder) && isValid(L.elbow) && isValid(L.wrist)
          ? +getAngle(L.shoulder, L.elbow, L.wrist).toFixed(1) : null;
        frameData.armSpreadL = isValid(L.elbow) && isValid(L.shoulder)
          ? +Math.abs(L.elbow.x - L.shoulder.x).toFixed(1) : null;
      }

      if (currentPose === "squat") {
        frameData.kneeAngleR = isValid(R.hip) && isValid(R.knee) && isValid(R.ankle)
          ? +getAngle(R.hip, R.knee, R.ankle).toFixed(1) : null;
        frameData.kneeAngleL = isValid(L.hip) && isValid(L.knee) && isValid(L.ankle)
          ? +getAngle(L.hip, L.knee, L.ankle).toFixed(1) : null;

        frameData.ankleSpread = isValid(R.ankle) && isValid(L.ankle)
          ? +getDistance(R.ankle, L.ankle).toFixed(1) : null;
        frameData.kneeSpread = isValid(R.knee) && isValid(L.knee)
          ? +getDistance(R.knee, L.knee).toFixed(1) : null;
        frameData.shoulderWidth = isValid(R.shoulder) && isValid(L.shoulder)
          ? +getDistance(R.shoulder, L.shoulder).toFixed(1) : null;
      }

      if (currentPose === "plank") {
        frameData.neckAngleR = isValid(R.ear) && isValid(R.shoulder) && isValid(R.hip)
          ? +getAngle(R.ear, R.shoulder, R.hip).toFixed(1) : null;
        frameData.neckAngleL = isValid(L.ear) && isValid(L.shoulder) && isValid(L.hip)
          ? +getAngle(L.ear, L.shoulder, L.hip).toFixed(1) : null;

        frameData.shoulderElbowXDiffR = isValid(R.shoulder) && isValid(R.elbow)
          ? +Math.abs(R.shoulder.x - R.elbow.x).toFixed(1) : null;
        frameData.shoulderElbowXDiffL = isValid(L.shoulder) && isValid(L.elbow)
          ? +Math.abs(L.shoulder.x - L.elbow.x).toFixed(1) : null;
      }

      poseLog.push(frameData);
    }
  }

  requestAnimationFrame(detectPose);
}

startBtn.addEventListener("click", async () => {
  currentPose = poseSelect.value;
  poseLog = [];
  recording = false;
  startBtn.disabled = true;

  feedback.textContent = "⏳ เตรียมตัวใน 5 วินาที...";
  for (let i = 5; i > 0; i--) {
    feedback.textContent = `⏳ เริ่มใน ${i}...`;
    await new Promise(r => setTimeout(r, 1000));
  }

  feedback.textContent = "✅ เริ่มตรวจจับ...";
  recording = true;

  let counter = 0;
  const interval = setInterval(async () => {
    counter++;
    if (counter >= 10) {
      clearInterval(interval);
      recording = false;
      feedback.textContent = "📤 ส่งข้อมูลไปยัง AI...";

      const res = await fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pose: currentPose, angles: poseLog })
      });

      const data = await res.json();
      feedback.textContent = data.message || "❌ วิเคราะห์ไม่สำเร็จ";
      startBtn.disabled = false;
    }
  }, 1000);
});

function getAngle(A, B, C) {
  const AB = [A.x - B.x, A.y - B.y];
  const CB = [C.x - B.x, C.y - B.y];
  const dot = AB[0] * CB[0] + AB[1] * CB[1];
  const magAB = Math.hypot(...AB);
  const magCB = Math.hypot(...CB);
  return Math.acos(dot / (magAB * magCB)) * (180 / Math.PI);
}

function getDistance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

async function start() {
  await setupCamera();
  await loadPoseDetector();
  detectPose();
}

start();
