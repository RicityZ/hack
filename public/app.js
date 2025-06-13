const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const feedback = document.getElementById('feedback');
const poseSelect = document.getElementById('poseSelect');
const startBtn = document.getElementById('startBtn');

let detector, recording = false, poseLog = [], currentPose = "pushup";

// skeleton connections สำหรับ MoveNet 17 จุด
const skeletonConnections = [
  [0, 1], [1, 3], [0, 2], [2, 4],          // head
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], // arms
  [5, 11], [6, 12], [11, 12],               // torso
  [11, 13], [13, 15], [12, 14], [14, 16]    // legs
];

function isValid(kp) {
  return kp && kp.score > 0.3;
}

function drawSkeleton(keypoints) {
  ctx.save();
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";

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
    video: { facingMode: 'user', width: 480, height: 360 },
    audio: false
  });
  video.srcObject = stream;

  await new Promise(resolve => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  console.log("✅ กล้องพร้อม", canvas.width, canvas.height);
}

async function loadPoseDetector() {
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
  });
  console.log("✅ โหลด MoveNet สำเร็จ");
}

async function detectPose() {
  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (poses.length > 0) {
    const keypoints = poses[0].keypoints;
    console.log(`✅ ตรวจเจอ ${keypoints.length} keypoints`);

    drawSkeleton(keypoints);
    drawKeypoints(keypoints);

    // ตัวอย่างการบันทึกข้อมูลมุม
    if (recording) {
      // ตัวอย่าง keypoints ของ MoveNet ใช้ index 5=ไหล่ซ้าย, 6=ไหล่ขวา, 7=ศอกซ้าย, 8=ศอกขวา, 9=ข้อมือซ้าย, 10=ข้อมือขวา, 11=สะโพกซ้าย, 12=สะโพกขวา, 13=เข่าซ้าย, 14=เข่าขวา, 15=ข้อเท้าซ้าย, 16=ข้อเท้าขวา
      const R = {
        shoulder: keypoints[6],
        elbow: keypoints[8],
        wrist: keypoints[10],
        hip: keypoints[12],
        knee: keypoints[14],
        ankle: keypoints[16]
      };
      const L = {
        shoulder: keypoints[5],
        elbow: keypoints[7],
        wrist: keypoints[9],
        hip: keypoints[11],
        knee: keypoints[13],
        ankle: keypoints[15]
      };

      // บันทึกมุม
      const frameData = { second: poseLog.length + 1 };

      if (isValid(R.shoulder) && isValid(R.hip) && isValid(R.ankle)) {
        frameData.bodyAngle = +getAngle(R.shoulder, R.hip, R.ankle).toFixed(1);
      } else {
        frameData.bodyAngle = null;
      }

      if (currentPose === "pushup") {
        if (isValid(R.shoulder) && isValid(R.elbow) && isValid(R.wrist)) {
          frameData.elbowAngle = +getAngle(R.shoulder, R.elbow, R.wrist).toFixed(1);
          frameData.armSpread = +Math.abs(R.elbow.x - R.shoulder.x).toFixed(1);
        } else {
          frameData.elbowAngle = null;
          frameData.armSpread = null;
        }
      }

      if (currentPose === "squat") {
        if (isValid(R.hip) && isValid(R.knee) && isValid(R.ankle)) {
          frameData.kneeAngle = +getAngle(R.hip, R.knee, R.ankle).toFixed(1);
        } else {
          frameData.kneeAngle = null;
        }
        if (isValid(R.ankle) && isValid(L.ankle)) {
          frameData.legSpread = +getDistance(R.ankle, L.ankle).toFixed(1);
        } else {
          frameData.legSpread = null;
        }
      }

      poseLog.push(frameData);
    }
  } else {
    console.warn("❌ ไม่เจอคนในกล้อง");
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
      feedback.textContent = "📤 กำลังส่งข้อมูลไปยัง AI...";

      const res = await fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pose: currentPose,
          angles: poseLog
        })
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
  const angle = Math.acos(dot / (magAB * magCB));
  return angle * (180 / Math.PI);
}

function getDistance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 480, height: 360 },
    audio: false
  });
  video.srcObject = stream;

  await new Promise(resolve => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  console.log("✅ กล้องพร้อม", canvas.width, canvas.height);
}

async function loadPoseDetector() {
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
  });
  console.log("✅ โหลด MoveNet สำเร็จ");
}

async function start() {
  await setupCamera();
  await loadPoseDetector();
  detectPose();
}

start();
