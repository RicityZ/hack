require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

// ✅ รองรับ fetch สำหรับ Node ทุกเวอร์ชัน
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

app.post("/analyze", async (req, res) => {
  try {
    const { pose, angles } = req.body;
    const prompt = `
คุณคือผู้เชี่ยวชาญด้านฟอร์มการออกกำลังกาย ช่วยวิเคราะห์ท่าทางของผู้ใช้ในท่า "${pose}" โดยดูจากข้อมูลมุมข้อ (angle) และระยะการกาง (spread) ต่อวินาทีในเวลา 10 วินาที

ข้อมูลมีรูปแบบดังนี้:
${JSON.stringify(angles, null, 2)}

วิเคราะห์ว่าท่านี้ถูกต้องหรือไม่ และแนะนำว่าควรปรับตรงไหนบ้างให้เหมาะสม (สั้น กระชับ ชัดเจน)
`;

    console.log("📤 ส่งไปยัง Gemini ด้วย prompt:", prompt);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();
    console.log("📥 ตอบกลับจาก Gemini:", JSON.stringify(data, null, 2));

    const candidate = data?.candidates?.[0];
    const message = candidate?.content?.parts?.[0]?.text;

    if (!message) {
      return res.status(500).json({ message: "❌ Gemini ไม่ตอบกลับหรือรูปแบบข้อมูลไม่ตรง" });
    }

    res.json({ message: message.trim() });

  } catch (err) {
    console.error("🔥 เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini:", err);
    res.status(500).json({ message: "❌ เกิดข้อผิดพลาดระหว่างส่งข้อมูลไปยัง Gemini" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server ready at http://localhost:${PORT}`);
});
