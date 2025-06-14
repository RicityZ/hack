require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const app = express();

// ✅ แปลชื่อฟิลด์เป็นภาษาไทย
function translateFieldNames(dataArray) {
  const map = {
    second: "วินาที",
    bodyAngleL: "แนวลำตัวซ้าย",
    bodyAngleR: "แนวลำตัวขวา",
    elbowAngleL: "มุมข้อศอกซ้าย",
    elbowAngleR: "มุมข้อศอกขวา",
    armSpreadL: "ระยะกางแขนซ้าย",
    armSpreadR: "ระยะกางแขนขวา",
    kneeAngleL: "มุมเข่าซ้าย",
    kneeAngleR: "มุมเข่าขวา",
    kneeSpread: "ระยะห่างเข่าซ้าย–ขวา",
    legSpread: "ระยะห่างข้อเท้าซ้าย–ขวา",
    ankleSpread: "ระยะห่างปลายเท้า", // ✅ เพิ่มตรงนี้
    shoulderWidth: "ความกว้างไหล่",
    neckAngleL: "มุมคอซ้าย",
    neckAngleR: "มุมคอขวา",
    shoulderElbowXDiffL: "ระยะไหล่–ศอกซ้ายแนวตรง",
    shoulderElbowXDiffR: "ระยะไหล่–ศอกขวาแนวตรง",
    elbowToTorsoDistL: "ระยะข้อศอกซ้ายห่างลำตัว",
elbowToTorsoDistR: "ระยะข้อศอกขวาห่างลำตัว",

  };

  return dataArray.map(entry => {
    const translated = {};
    for (const key in entry) {
      translated[map[key] || key] = entry[key];
    }
    return translated;
  });
}

app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.static("public"));

app.post("/analyze", async (req, res) => {
  try {
   const { pose, angles, bmi } = req.body;
    const hasLeftRight = Object.keys(angles?.[0] || {}).some(k => k.endsWith("L") || k.endsWith("R"));
    const translatedAngles = translateFieldNames(angles);

    const prompt = `
คุณคือผู้เชี่ยวชาญด้านการออกกำลังกายระดับมืออาชีพ  
ช่วยวิเคราะห์ท่า "${pose}" จากข้อมูลการตรวจสอบฟอร์มด้านล่าง ซึ่งเป็นค่ามุมและระยะห่างของข้อต่อในร่างกายที่บันทึกไว้ตลอดช่วงเวลา 10 วินาที ซึ่งรวมถึงค่ามุมร่างกายและ BMI ของผู้ใช้งาน

📌 BMI ของผู้ใช้: ${bmi}
${
  hasLeftRight
    ? `📌 หมายเหตุ: ข้อมูลบางค่าแยกฝั่งซ้าย (_L) และขวา (_R) เช่น elbowAngleL, armSpreadR เป็นต้น`
    : ""
}

**ฟิลด์ที่สามารถใช้วิเคราะห์ได้:**
- \`bodyAngle\`: แนวไหล่–สะโพก–ข้อเท้า ใช้วัดความตรงของลำตัว (ทุกท่า)
- \`elbowAngle\`, \`armSpread\`: สำหรับ Push-Up ใช้วัดการงอข้อศอกและการกางแขน
- \`kneeAngle\`, \`legSpread\`, \`kneeSpread\`, \`shoulderWidth\`: สำหรับ Squat ใช้วัดความลึกในการย่อเข่า และตรวจความสมดุลของขาเทียบกับไหล่
- \`ankleSpread\`: ระยะห่างปลายเท้า ใช้วิเคราะห์ว่าชิดหรือกว้างเกินไป (Squat)
- \`neckAngle\`, \`shoulderElbowXDiff\`: สำหรับ Plank ใช้ตรวจแนวคอและแนวไหล่ตรงกับข้อศอกหรือไม่

**คำแนะนำพิเศษตามค่า BMI:**
${pose === "squat" ? (
  bmi >= 27 ? "- ผู้ใช้มี BMI สูง ควรแนะนำให้ไม่ย่อลึกเกินไปเพื่อลดแรงกดเข่า\n"
  : bmi <= 18.5 ? "- ผู้ใช้มี BMI ต่ำ ต้องระวังการทรงตัวและควบคุมเข่าไม่ให้บิดเข้าด้านใน\n"
  : "- BMI อยู่ในช่วงปกติ ทำท่า squat ได้เต็มรูปแบบ\n"
) : pose === "pushup" ? (
  bmi >= 27 ? "- ผู้ใช้มี BMI สูง ควรแนะนำให้เริ่มจาก knee push-up หรือ incline push-up ก่อน\n"
  : bmi <= 18.5 ? "- ผู้ใช้มี BMI ต่ำ ควรเน้นความมั่นคงและควบคุมลำตัว\n"
  : "- BMI ปกติ สามารถทำ push-up ได้\n"
) : pose === "plank" ? (
  bmi >= 27 ? "- ผู้ใช้มี BMI สูง ระวังหลังแอ่นเพราะ core อ่อนแอ ควรให้กระจกหรือ AI เช็คหลัง\n"
  : bmi <= 18.5 ? "- ผู้ใช้มี BMI ต่ำ เสี่ยงหลังแอ่นเพราะ core อ่อนแรง\n"
  : "- BMI ปกติ สามารถ plank ได้\n"
) : pose === "bicep" ? (
  bmi >= 27 ? "- ผู้ใช้มี BMI สูง ควรนั่งทำ Bicep Curl เพื่อลดการโยกลำตัว และใช้ดัมเบลน้ำหนักพอดี\n"
  : bmi <= 18.5 ? "- ผู้ใช้มี BMI ต่ำ ควรระวังการควบคุมข้อศอกให้แนบลำตัว ไม่เหวี่ยงแขน\n"
  : "- BMI ปกติ สามารถทำ Bicep Curl ได้เต็มช่วง\n"
) : ""

}


**ข้อมูลจริง:**
${JSON.stringify(translatedAngles, null, 2)}

---

**คำสั่ง (ขึ้นกับชื่อท่า):**

- ถ้าเป็นท่า **Squat**:
  - วิเคราะห์ \`kneeAngleL/R\` ว่าซ้าย-ขวางอลึกต่างกันหรือไม่
  - วิเคราะห์ \`kneeSpread\` เปรียบเทียบกับ \`shoulderWidth\` ว่ากว้างเกินไปไหม
  - วิเคราะห์ \`ankleSpread\` ว่าชิดหรือกว้างเกินไป
  - วิเคราะห์ \`bodyAngle\` ว่าลำตัวเอนหน้าหรือหลัง
  - วิเคราะห์ \`ankleSpread\` เปรียบเทียบกับ \`shoulderWidth\` ว่ากว้างเกินไปไหม

- ถ้าเป็นท่า **Push-Up**:
  - วิเคราะห์ \`elbowAngleL/R\` ว่าลึกไม่เท่ากันไหม
  - วิเคราะห์ \`armSpreadL/R\` ว่ากางแขนเท่ากันหรือกว้างเกินไปไหม
  - วิเคราะห์ \`ankleSpread\` เทียบกับ \`shoulderWidth\` ว่าเท้าชิดเกินไปไหม
  - วิเคราะห์ \`bodyAngle\` ว่าลำตัวตรงหรือแอ่น

- ถ้าเป็นท่า **Plank**:
  - วิเคราะห์ \`neckAngleL/R\` ว่าคอตรงหรือเอียง
  - วิเคราะห์ \`shoulderElbowXDiffL/R\` ว่าไหล่ตรงกับศอกไหม
  - วิเคราะห์ \`bodyAngle\` ว่าลำตัวหย่อนหรือแอ่น

---

**รูปแบบการตอบกลับ:**
- สรุปภาพรวมการทำท่า "${pose}" ตลอดช่วงเวลาเดียว
- วิเคราะห์ประเด็นสำคัญจาก field ที่เกี่ยวข้อง
- ใช้ bullet point หรือแบ่งข้อย่อย
- เขียนให้อ่านง่าย สั้น กระชับ 
- ปิดท้ายด้วยคำแนะนำ
- ห้ามพูดถึง "ข้อมูลไม่ครบ" หรือ "null" แม้ข้อมูลจะมีบางค่าว่าง
- ไม่ต้องบอกองศา แค่บอกมาเลยว่าใกล้เคียงหรือไกล
- มีอิโมจิ ทำให้น่าอ่านขึ้น
- สร้างคะแนนรวมจาก 0–100 ตามความถูกต้องของฟอร์ม โดยใช้คำว่า "คะแนนรวม: xx/100" เช่นคะแนนรายตัว: ลำตัว (bodyAngle): 91.67 เข่าซ้าย (kneeAngleL): 88.89
- ห้ามละเว้น คะแนนรายตัว: เด็ดขาด มิฉะนั้นระบบจะไม่สามารถแสดงผลได้

**ตอบกลับในรูปแบบนี้:**

จากการวิเคราะห์ท่า ${pose} โดยรวม:

... (เนื้อหาสรุป 3–5 บรรทัด) ...

📌 คำแนะนำ: ...
`;

    console.log("📤 ส่ง prompt ไปยัง Gemini:\n", prompt);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Gemini API error:", text);
      return res.status(500).json({ message: `❌ Gemini API error ${response.status}` });
    }

    const data = await response.json();
    const message = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!message) {
      return res.status(500).json({ message: "❌ Gemini ไม่ตอบกลับ หรือไม่มีข้อความวิเคราะห์" });
    }

    res.json({ message: message.trim() });
  } catch (err) {
    console.error("🔥 เกิดข้อผิดพลาด:", err);
    res.status(500).json({ message: "❌ ไม่สามารถเชื่อมต่อ Gemini หรือวิเคราะห์ข้อมูลได้" });
  }
});

// ✅ Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server ready at http://localhost:${PORT}`);
});
