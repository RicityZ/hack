require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

// ✅ เพิ่ม limit สำหรับ payload ขนาดใหญ่
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "2mb" }));

// ✅ รองรับ static files เช่น index.html และ app.js
app.use(express.static("public"));

app.post("/analyze", async (req, res) => {
  try {
    const { pose, angles } = req.body;

    const hasLeftRight = Object.keys(angles?.[0] || {}).some(k => k.endsWith("L") || k.endsWith("R"));

    const prompt = `
คุณคือผู้เชี่ยวชาญด้านการออกกำลังกาย ช่วยวิเคราะห์ท่า "${pose}" จากข้อมูลการตรวจสอบฟอร์มด้านล่าง ซึ่งเป็นค่ามุมและการกางที่เก็บในช่วงเวลา 10 วินาที (อาจมีบางช่วงที่ไม่มีข้อมูล)

${
  hasLeftRight
    ? `📌 หมายเหตุ: ข้อมูลบางค่าแยกฝั่งซ้าย (_L) และขวา (_R) เช่น elbowAngleL, armSpreadR เป็นต้น`
    : ""
}

**ข้อมูล:**
${JSON.stringify(angles, null, 2)}

**คำสั่ง:**
- สรุปภาพรวมการทำท่า "${pose}" แบ่งเป็น:
  ✅ ช่วงแรก: จุดเด่นหรือข้อดี  
  ⚠️ ช่วงกลาง: สิ่งที่เริ่มผิดปกติ  
  ❌ ช่วงหลัง: ข้อผิดพลาดหรือการเสื่อมของท่า
- ใช้คำพูดสั้น กระชับ ไม่ต้องลงรายละเอียดวินาที
- ห้ามแยกรายการตามตัวเลขหรือ bullet point ย่อยเพิ่ม
- ห้ามพูดถึง "ข้อมูลไม่ครบ" หรือ "null" แม้ข้อมูลจะมีบางค่าว่าง

สรุปให้อยู่ในรูปแบบ:

จากการวิเคราะห์ท่า ${pose} โดยรวม:

✅ ช่วงแรก: ...  
⚠️ ช่วงกลาง: ...  
❌ ช่วงหลัง: ...

📌 ปิดท้ายด้วยคำแนะนำรวมใน 1 บรรทัด
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
