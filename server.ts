import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI server-side with User-Agent header for telemetry
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("⚠️ GEMINI_API_KEY environment variable is not defined.");
}

// SCEA System Instruction Setup
const SCEA_SYSTEM_INSTRUCTION = `
Bạn là Smart Classroom Ecosystem Architect (SCEA) – Chuyên gia cấp cao về kiến trúc giáo dục số và phân tích dữ liệu học đường.
Bạn đóng vai trò là "bộ não" trung tâm kết nối dữ liệu giữa Giáo viên, Học sinh và Phụ huynh nhằm tối ưu hóa hiệu quả giảng dạy và quản trị nề nếp.

Nhiệm vụ cốt lõi:
1. Quản trị kỷ luật thông minh: Đề xuất điểm thi đua (merit/demerit) và hành động hỗ trợ công bằng.
2. Phân tích dự báo (Predictive Analytics): Nhận diện dấu hiệu sa sút sớm (Early Warning) hoặc tài năng thiên bẩm/tiềm năng của học sinh dựa trên lịch sử hoạt động, điểm số, và hành vi.
3. Tối ưu hóa năng suất giáo viên: Soạn nhận xét cá nhân hóa, đề xuất bài giảng, giúp giáo viên tiết kiệm thời gian.
4. Thúc đẩy động lực học tập: Thiết kế các hoạt động thi đua và huy hiệu Gamification sáng tạo.
5. Số hóa hạ tầng: Gợi ý các tích hợp công nghệ (như nhận diện giọng nói Speech-to-Text, điểm danh tự động).

Bạn phải xuất câu trả lời chuẩn xác bằng định dạng Markdown đẹp mắt, cấu trúc chặt chẽ gồm các phần:
1. ### 🏫 SCEA Dashboard AI Synthesis (Tóm tắt nhanh trạng thái dữ liệu)
2. ### 🧠 AI Insights & Early Warnings (Xu hướng, Cảnh báo sớm hỗ trợ và Tiềm năng)
3. ### 📝 Automated Action Options (Dự thảo nhận xét cá nhân hóa thân thiện, mang tính kiến tạo cho Giáo viên gửi Phụ huynh và Giáo án điều chỉnh)
4. ### 🏆 Gamification Recommendation (Đề xuất tặng huy hiệu thi đua)
5. ### ⚙️ LMS Sync & Security Note (Ghi chú đồng bộ hệ thống LMS trường học)

Ngôn ngữ phản hồi: Tiếng Việt (hoặc song ngữ Việt - Anh nếu được yêu cầu). Hãy viết chuyên nghiệp, nhạy bén, công tâm, tràn đầy tình cảm và mang tính kiến tạo giáo dục.
`;

// API endpoint for analyzing a single student or class context
app.post("/api/gemini/analyze", async (req, res) => {
  if (!ai) {
    return res.status(500).json({
      error: "Gemini API client is not initialized (missing API Key on server). Please verify your Secrets panel in Settings.",
    });
  }

  const { student, classSummary, type, customPrompt } = req.body;

  try {
    let promptText = "";

    if (type === "student_diagnostics") {
      promptText = `
Hãy thực hiện phân tích chẩn đoán cho học sinh sau đây:
Họ và tên: ${student.name}
Điểm số trung bình môn hiện tại: ${student.gpa}/10
Điểm thi đua hiện tại (Merit/Demerit): ${student.points} (Hành vi tích cực: ${student.meritCount}, Vi phạm: ${student.demeritCount})
Tỉ lệ chuyên cần điểm danh: ${student.attendance}%
Lịch sử hành vi gần đây: 
${JSON.stringify(student.logs || [])}

Ghi chú nhanh giọng nói của Giáo viên (Speech-to-Text):
"${student.voiceNotes || "Không có ghi chú"}"

Yêu cầu phân tích:
1. Đánh giá trạng thái học tập và kỷ luật hiện tại.
2. Đưa ra 1 Cảnh Cáo Sớm (Early Warning) nếu có rủi ro sa sút tâm lý/học tập HOẶC Phát hiện 1 Điểm Sáng Tiềm Năng (Inner Genius).
3. Viết 1 nhận xét cá nhân hóa (khoảng 3-4 câu) bằng tiếng Việt thật tinh tế và kiến tạo để giáo viên có thể gửi cho phụ huynh.
4. Đề xuất 1 huy hiệu đặc thù khuyến khích tinh thần đồng đội hoặc nỗ lực cá nhân của học sinh này.
`;
    } else if (type === "class_evaluation") {
      promptText = `
Hãy đánh giá bức tranh tổng quan của cả lớp học:
Số lượng học sinh: ${classSummary.totalStudents}
Tỉ lệ hiện diện FaceID: ${classSummary.attendanceRate}%
Tổng số hoạt động Merit trong ngày: ${classSummary.totalMerits}
Tổng số vi phạm Demerit trong ngày: ${classSummary.totalDemerits}
Nhóm học sinh cần lưu ý đặc biệt: ${JSON.stringify(classSummary.alertStudents || [])}

Yêu cầu:
1. Đưa ra góc nhìn SCEA về bầu không khí học tập và kỷ luật chung của lớp hiện tại.
2. Dự báo xu hướng học tập (mức độ tiếp thu bài giảng, sự tập trung).
3. Dự thảo văn bản nhận xét tổng quát cuối ngày (Daily AI Briefing) gửi BGH hoặc Phụ huynh.
4. Đề xuất điều chỉnh bài giảng/tiết học tiếp theo sao cho hấp dẫn hơn (Gamified Teaching Strategy).
`;
    } else {
      // Custom system assistant prompt
      promptText = customPrompt || "Gợi ý các chiến lược quản lý lớp học EdTech xuất sắc nhất hiện nay.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: SCEA_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error in /analyze:", error);
    res.status(500).json({ error: error.message || "Lỗi truy vấn Gemini API." });
  }
});

// Serve assets & support Vite dev server
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Smart Classroom SCEA Server running on port ${PORT}`);
});
