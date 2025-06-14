  // ✅ app.js - แอปตรวจจับท่า Squat / Push-Up / Plank ด้วย MoveNet

  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const feedback = document.getElementById("feedback");
  const scoreBox = document.getElementById("scoreBox");
  const scoreSummary = document.getElementById("scoreSummary");
  const scoreDetail = document.getElementById("scoreDetail");
  const detailToggle = document.getElementById("detailToggle");
  const poseSelect = document.getElementById("poseSelect");
  const startBtn = document.getElementById("startBtn");
  const weightInput = document.getElementById("weight");
  const heightInput = document.getElementById("height");

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
 if (!recording) {
    provideRealTimeFeedback(keypoints);
  }
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

      const frameData = {
    second: poseLog.length + 1,
    bodyAngleR: 0,
    bodyAngleL: 0,
    elbowAngleR: 0,
    elbowAngleL: 0,
    armSpreadR: 0,
    armSpreadL: 0,
    kneeAngleR: 0,
    kneeAngleL: 0,
    ankleSpread: 0,
    kneeSpread: 0,
    shoulderWidth: 0,
    neckAngleR: 0,
    neckAngleL: 0,
    shoulderElbowXDiffR: 0,
    shoulderElbowXDiffL: 0,
  };

  if (isValid(R.shoulder) && isValid(R.hip) && isValid(R.ankle))
    frameData.bodyAngleR = +getAngle(R.shoulder, R.hip, R.ankle).toFixed(1);
  if (isValid(L.shoulder) && isValid(L.hip) && isValid(L.ankle))
    frameData.bodyAngleL = +getAngle(L.shoulder, L.hip, L.ankle).toFixed(1);

  if (currentPose === "pushup") {
    if (isValid(R.shoulder) && isValid(R.elbow) && isValid(R.wrist))
      frameData.elbowAngleR = +getAngle(R.shoulder, R.elbow, R.wrist).toFixed(1);
    if (isValid(R.elbow) && isValid(R.shoulder))
      frameData.armSpreadR = +Math.abs(R.elbow.x - R.shoulder.x).toFixed(1);

    if (isValid(L.shoulder) && isValid(L.elbow) && isValid(L.wrist))
      frameData.elbowAngleL = +getAngle(L.shoulder, L.elbow, L.wrist).toFixed(1);
    if (isValid(L.elbow) && isValid(L.shoulder))
      frameData.armSpreadL = +Math.abs(L.elbow.x - L.shoulder.x).toFixed(1);
  }

  if (currentPose === "squat") {
    if (isValid(R.hip) && isValid(R.knee) && isValid(R.ankle))
      frameData.kneeAngleR = +getAngle(R.hip, R.knee, R.ankle).toFixed(1);
    if (isValid(L.hip) && isValid(L.knee) && isValid(L.ankle))
      frameData.kneeAngleL = +getAngle(L.hip, L.knee, L.ankle).toFixed(1);

    if (isValid(R.ankle) && isValid(L.ankle))
      frameData.ankleSpread = +getDistance(R.ankle, L.ankle).toFixed(1);
    if (isValid(R.knee) && isValid(L.knee))
      frameData.kneeSpread = +getDistance(R.knee, L.knee).toFixed(1);
    if (isValid(R.shoulder) && isValid(L.shoulder))
      frameData.shoulderWidth = +getDistance(R.shoulder, L.shoulder).toFixed(1);
  }

  if (currentPose === "plank") {
    if (isValid(R.ear) && isValid(R.shoulder) && isValid(R.hip))
      frameData.neckAngleR = +getAngle(R.ear, R.shoulder, R.hip).toFixed(1);
    if (isValid(L.ear) && isValid(L.shoulder) && isValid(L.hip))
      frameData.neckAngleL = +getAngle(L.ear, L.shoulder, L.hip).toFixed(1);

    if (isValid(R.shoulder) && isValid(R.elbow))
      frameData.shoulderElbowXDiffR = +Math.abs(R.shoulder.x - R.elbow.x).toFixed(1);
    if (isValid(L.shoulder) && isValid(L.elbow))
      frameData.shoulderElbowXDiffL = +Math.abs(L.shoulder.x - L.elbow.x).toFixed(1);
  }

  poseLog.push(frameData);
      }
    }

    requestAnimationFrame(detectPose);
  }
  
  function extractScores(message) {
    const summaryMatch = message.match(/คะแนนรวม: .*\/100/);
    const detailMatch = message.match(/คะแนนรายตัว:[\s\S]*?(?=\n\n|$)/);
    return {
      summary: summaryMatch ? summaryMatch[0].trim() : "คะแนนรวม: -",
      detail: detailMatch ? detailMatch[0].trim() : ""
    };
  }

  startBtn.addEventListener("click", async () => {
    currentPose = poseSelect.value;
    poseLog = [];
    recording = false;
    startBtn.disabled = true;

    const weight = parseFloat(weightInput.value);
    const heightCm = parseFloat(heightInput.value);
    const heightM = heightCm / 100;

    if (!weight || !heightCm || weight <= 0 || heightCm <= 0) {
      feedback.textContent = "❌ กรุณากรอกน้ำหนักและส่วนสูงให้ถูกต้อง";
      return;
    }

    const bmi = +(weight / (heightM * heightM)).toFixed(1);

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
          body: JSON.stringify({
            pose: currentPose,
            angles: poseLog,
            bmi: bmi
          })
        });

        const data = await res.json();
        const message = data.message || "❌ วิเคราะห์ไม่สำเร็จ";
  const { summary, detail } = extractScores(message);

  scoreSummary.textContent = summary;
  scoreDetail.innerText = detail;
  scoreBox.style.display = "block";
  scoreDetail.style.display = "none"; // ซ่อนตอนเริ่ม
  feedback.textContent = message
    .replace(summary, "")
    .replace(detail, "")
    .trim();

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
function drawLine(p1, p2, color = "yellow", width = 4) {
  if (isValid(p1) && isValid(p2)) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
  async function start() {
    await setupCamera();
    await loadPoseDetector();
    detectPose();
  }

  start();
  detailToggle.addEventListener("click", () => {
    if (scoreDetail.style.display === "none") {
      scoreDetail.style.display = "block";
      detailToggle.textContent = "ซ่อนรายละเอียด";
    } else {
      scoreDetail.style.display = "none";
      detailToggle.textContent = "ดูรายละเอียด";
    }
  });
function provideRealTimeFeedback(keypoints) {
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

  ctx.save();
  ctx.fillStyle = "yellow";
  ctx.font = "18px Arial";

  if (currentPose === "squat") {
    // ขวา
    if (isValid(R.hip) && isValid(R.knee) && isValid(R.ankle)) {
      const angleR = getAngle(R.hip, R.knee, R.ankle);
      if (angleR > 130) {
        ctx.fillText("❌ ย่อลงอีก (ขวา)", R.knee.x + 10, R.knee.y);
        drawLine(R.hip, R.knee);
        drawLine(R.knee, R.ankle);
      } else if (angleR < 60) {
        ctx.fillText("⚠️ ย่อลึกเกิน (ขวา)", R.knee.x + 10, R.knee.y);
        drawLine(R.hip, R.knee, "orange");
        drawLine(R.knee, R.ankle, "orange");
      } else {
        ctx.fillText("✅ ลึกดี (ขวา)", R.knee.x + 10, R.knee.y);
      }
    }

    // ซ้าย
    if (isValid(L.hip) && isValid(L.knee) && isValid(L.ankle)) {
      const angleL = getAngle(L.hip, L.knee, L.ankle);
      if (angleL > 130) {
        ctx.fillText("❌ ย่อลงอีก (ซ้าย)", L.knee.x + 10, L.knee.y);
        drawLine(L.hip, L.knee);
        drawLine(L.knee, L.ankle);
      } else if (angleL < 60) {
        ctx.fillText("⚠️ ย่อลึกเกิน (ซ้าย)", L.knee.x + 10, L.knee.y);
        drawLine(L.hip, L.knee, "orange");
        drawLine(L.knee, L.ankle, "orange");
      } else {
        ctx.fillText("✅ ลึกดี (ซ้าย)", L.knee.x + 10, L.knee.y);
      }
    }
  }

  // ========== PUSH-UP ==========
  if (currentPose === "pushup") {
    // ขวา
    if (isValid(R.shoulder) && isValid(R.elbow) && isValid(R.wrist)) {
      const angleR = getAngle(R.shoulder, R.elbow, R.wrist);
      if (angleR > 160) {
        ctx.fillText("❌ ศอกตรง (ขวา)", R.elbow.x + 10, R.elbow.y);
        drawLine(R.shoulder, R.elbow);
        drawLine(R.elbow, R.wrist);
      } else if (angleR < 60) {
        ctx.fillText("⚠️ งอลึกเกิน (ขวา)", R.elbow.x + 10, R.elbow.y);
        drawLine(R.shoulder, R.elbow, "orange");
        drawLine(R.elbow, R.wrist, "orange");
      } else {
        ctx.fillText("✅ ศอกดี (ขวา)", R.elbow.x + 10, R.elbow.y);
      }
    }

    // ซ้าย
    if (isValid(L.shoulder) && isValid(L.elbow) && isValid(L.wrist)) {
      const angleL = getAngle(L.shoulder, L.elbow, L.wrist);
      if (angleL > 160) {
        ctx.fillText("❌ ศอกตรง (ซ้าย)", L.elbow.x + 10, L.elbow.y);
        drawLine(L.shoulder, L.elbow);
        drawLine(L.elbow, L.wrist);
      } else if (angleL < 60) {
        ctx.fillText("⚠️ งอลึกเกิน (ซ้าย)", L.elbow.x + 10, L.elbow.y);
        drawLine(L.shoulder, L.elbow, "orange");
        drawLine(L.elbow, L.wrist, "orange");
      } else {
        ctx.fillText("✅ ศอกดี (ซ้าย)", L.elbow.x + 10, L.elbow.y);
      }
    }

    // ระยะแขน
    if (isValid(R.elbow) && isValid(R.shoulder)) {
      const spreadR = Math.abs(R.elbow.x - R.shoulder.x);
      if (spreadR < 40) {
        ctx.fillText("❌ แขนแคบ (ขวา)", R.elbow.x + 10, R.elbow.y + 30);
        drawLine(R.shoulder, R.elbow, "yellow");
      } else {
        ctx.fillText("✅ ระยะแขนดี (ขวา)", R.elbow.x + 10, R.elbow.y + 30);
      }
    }

    if (isValid(L.elbow) && isValid(L.shoulder)) {
      const spreadL = Math.abs(L.elbow.x - L.shoulder.x);
      if (spreadL < 40) {
        ctx.fillText("❌ แขนแคบ (ซ้าย)", L.elbow.x + 10, L.elbow.y + 30);
        drawLine(L.shoulder, L.elbow, "yellow");
      } else {
        ctx.fillText("✅ ระยะแขนดี (ซ้าย)", L.elbow.x + 10, L.elbow.y + 30);
      }
    }
  }

  // ========== PLANK ==========
  if (currentPose === "plank") {
    if (isValid(R.ear) && isValid(R.shoulder) && isValid(R.hip)) {
      const angleR = getAngle(R.ear, R.shoulder, R.hip);
      if (angleR < 150) {
        ctx.fillText("❌ หลังแอ่น (ขวา)", R.hip.x + 10, R.hip.y);
        drawLine(R.ear, R.shoulder);
        drawLine(R.shoulder, R.hip);
      } else if (angleR > 170) {
        ctx.fillText("⚠️ หลังห้อย (ขวา)", R.hip.x + 10, R.hip.y);
        drawLine(R.ear, R.shoulder, "orange");
        drawLine(R.shoulder, R.hip, "orange");
      } else {
        ctx.fillText("✅ ลำตัวตรง (ขวา)", R.hip.x + 10, R.hip.y);
      }
    }

    if (isValid(L.ear) && isValid(L.shoulder) && isValid(L.hip)) {
      const angleL = getAngle(L.ear, L.shoulder, L.hip);
      if (angleL < 150) {
        ctx.fillText("❌ หลังแอ่น (ซ้าย)", L.hip.x + 10, L.hip.y);
        drawLine(L.ear, L.shoulder);
        drawLine(L.shoulder, L.hip);
      } else if (angleL > 170) {
        ctx.fillText("⚠️ หลังห้อย (ซ้าย)", L.hip.x + 10, L.hip.y);
        drawLine(L.ear, L.shoulder, "orange");
        drawLine(L.shoulder, L.hip, "orange");
      } else {
        ctx.fillText("✅ ลำตัวตรง (ซ้าย)", L.hip.x + 10, L.hip.y);
      }
    }

    // ศอกใกล้ลำตัว
    if (isValid(R.shoulder) && isValid(R.elbow)) {
      const dx = Math.abs(R.shoulder.x - R.elbow.x);
      if (dx < 20) {
        ctx.fillText("❌ ศอกชิด (ขวา)", R.elbow.x + 10, R.elbow.y);
        drawLine(R.shoulder, R.elbow, "yellow");
      } else {
        ctx.fillText("✅ ศอกดี (ขวา)", R.elbow.x + 10, R.elbow.y);
      }
    }

    if (isValid(L.shoulder) && isValid(L.elbow)) {
      const dx = Math.abs(L.shoulder.x - L.elbow.x);
      if (dx < 20) {
        ctx.fillText("❌ ศอกชิด (ซ้าย)", L.elbow.x + 10, L.elbow.y);
        drawLine(L.shoulder, L.elbow, "yellow");
      } else {
        ctx.fillText("✅ ศอกดี (ซ้าย)", L.elbow.x + 10, L.elbow.y);
      }
    }
  }

  ctx.restore();
}