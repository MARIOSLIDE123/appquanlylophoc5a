import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import os from "os";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Configure multer for file uploads in a serverless-safe tmp folder
const upload = multer({
  dest: path.join(os.tmpdir(), "uploads"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ file PDF, DOC hoặc DOCX."));
    }
  }
});

// Initialize Gemini SDK with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ Warning: GEMINI_API_KEY environment variable is not defined!");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ai = getGeminiClient();

// System prompt to enforce standard Vietnamese pedagogical tone
const SYSTEM_PEDAGOGICAL_PROMPT = `Bạn là cố vấn chuyên môn viết Sáng kiến kinh nghiệm (SKKN) và Nghiên cứu khoa học sư phạm ứng dụng cấp Quốc gia. Có kiến thức uyên thâm, tuân thủ chặt chẽ các thông tư, quy định mới nhất của Bộ Giáo dục và Đào tạo Việt Nam (đặc biệt là căn lề chuẩn theo Nghị định 30/2020/NĐ-CP). Hãy sử dụng thuật ngữ sư phạm chuẩn mực như: "biện pháp", "minh chứng", "khả năng nhân rộng", "tính cấp thiết", "thực nghiệm đối chứng", "kế hoạch bài dạy". Không sử dụng từ ngữ sáo rỗng, luôn hướng dẫn thực tiễn, cụ thể và khoa học.`;

// 0. API: Upload & Analyze Criteria Document
app.post("/api/upload-criteria", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Vui lòng chọn file công văn hoặc tiêu chí đánh giá." });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    let extractedText = "";

    try {
      if (mimeType === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
      } else {
        // .doc or .docx
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      }
    } finally {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    }

    if (!extractedText || extractedText.trim().length < 20) {
      return res.status(400).json({ error: "Không thể trích xuất nội dung từ file. File có thể bị hỏng hoặc chỉ chứa hình ảnh." });
    }

    // Truncate if too long (keep first 8000 chars for AI context)
    const textForAI = extractedText.substring(0, 8000);

    const prompt = `Phân tích công văn/tài liệu hướng dẫn viết Sáng kiến kinh nghiệm dưới đây. Trích xuất ra:
1. Danh sách các tiêu chí đánh giá chấm điểm (tên tiêu chí, thang điểm tối đa, mô tả yêu cầu chi tiết)
2. Các yêu cầu bắt buộc từ công văn (quy định cấu trúc, hình thức trình bày, nội dung bắt buộc...)
3. Các gợi ý trọng tâm mà giáo viên cần lưu ý khi viết SKKN
4. Tóm tắt tổng quan nội dung công văn

Nội dung công văn/tài liệu:
---
${textForAI}
---

Trả về JSON chính xác theo cấu trúc sau:
{
  "criteriaList": [
    { "name": "Tên tiêu chí 1", "maxScore": 20, "description": "Mô tả chi tiết yêu cầu của tiêu chí" },
    { "name": "Tên tiêu chí 2", "maxScore": 15, "description": "Mô tả chi tiết yêu cầu của tiêu chí" }
  ],
  "requirements": [
    "Yêu cầu bắt buộc 1: Cấu trúc bài viết gồm 3 phần...",
    "Yêu cầu bắt buộc 2: Trình bày theo chuẩn Nghị định 30..."
  ],
  "focusPoints": [
    "Tập trung vào tính mới và sáng tạo của giải pháp",
    "Cần có số liệu minh chứng thuyết phục"
  ],
  "aiSummary": "Tóm tắt tổng quan nội dung công văn trong 2-3 câu."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    res.json({
      fileName: originalName,
      uploadedAt: new Date().toISOString(),
      rawTextPreview: extractedText.substring(0, 200) + "...",
      ...result
    });
  } catch (error: any) {
    console.error("Error processing criteria file:", error);
    res.status(500).json({ error: error.message || "Lỗi xử lý file công văn tiêu chí." });
  }
});

// 1. API: Generate Outline
app.post("/api/gemini/generate-outline", async (req, res) => {
  try {
    const { title, subject, grade, level, context, criteriaContext } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Vui lòng cung cấp tên đề tài SKKN." });
    }

    const criteriaBlock = criteriaContext ? `\n\nLƯU Ý QUAN TRỌNG - TIÊU CHÍ ĐÁNH GIÁ TỪ CÔNG VĂN:\n${criteriaContext}\nHãy đảm bảo nội dung sinh ra tuân thủ chặt chẽ các tiêu chí đánh giá và yêu cầu nêu trên.` : "";

    const prompt = `Căn cứ vào dữ liệu sau:
Tên đề tài SKKN: "${title}"
Môn học: "${subject || "Tự chọn"}"
Lớp/Khối: "${grade || "Tự chọn"}"
Cấp học: "${level || "Tự chọn"}"
Bối cảnh/Thực trạng sơ khởi: "${context || "Chưa cung cấp"}"

Hãy lập một dàn ý chi tiết cấu trúc 3 phần tiêu chuẩn của một Sáng kiến kinh nghiệm đạt chuẩn chấm giải cấp Tỉnh/Thành phố.
Yêu cầu trả về định dạng JSON phù hợp với giao diện ứng dụng.
Hãy trả về JSON theo cấu trúc chính xác sau:
{
  "analyticalRating": {
    "newness": 85,
    "urgency": 90,
    "feasibility": 88,
    "comment": "Đề tài mang tính thực tiễn cao, cần tập trung làm nổi bật tính mới trong các biện pháp."
  },
  "outline": [
    { "section": "I. ĐẶT VẤN ĐỀ", "details": ["1. Tính cấp thiết của đề tài", "2. Mục đích nghiên cứu", "3. Đối tượng nghiên cứu", "4. Giới hạn phạm vi nghiên cứu"] },
    { "section": "II. GIẢI QUYẾT VẤN ĐỀ", "details": ["1. Cơ sở lý luận", "2. Cơ sở thực tiễn (Nêu rõ ưu điểm, hạn chế và nguyên nhân)", "3. Thiết kế và thực hiện các biện pháp tác động (Nêu chi tiết ít nhất 3 biện pháp cụ thể)", "4. Hiệu quả của sáng kiến kinh nghiệm"] },
    { "section": "III. KẾT LUẬN, KIẾN NGHỊ", "details": ["1. Kết luận rút ra được từ sáng kiến", "2. Kiến nghị, đề xuất đối với các cấp quản lý giáo dục"] }
  ]
}` + criteriaBlock;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error generating outline:", error);
    res.status(500).json({ error: error.message || "Lỗi hệ thống khi tạo dàn ý." });
  }
});

// 2. API: Generate Survey Data
app.post("/api/gemini/generate-survey", async (req, res) => {
  try {
    const { title, subject, grade, criteriaContext } = req.body;
    
    const criteriaBlock = criteriaContext ? `\n\nLƯU Ý QUAN TRỌNG - TIÊU CHÍ ĐÁNH GIÁ TỪ CÔNG VĂN:\n${criteriaContext}\nHãy đảm bảo nội dung sinh ra tuân thủ chặt chẽ các tiêu chí đánh giá và yêu cầu nêu trên.` : "";

    const prompt = `Dựa trên đề tài SKKN: "${title}" dành cho môn "${subject}" khối "${grade}".
Hãy tạo dữ liệu khảo sát thực trạng thực tế (số liệu giả định khoa học) trước khi tiến hành thực nghiệm để vẽ biểu đồ so sánh.
Khảo sát này đo lường các tiêu chí như: "Độ tích cực tham gia", "Kết quả học tập đạt Yêu cầu trở lên", "Lòng ham thích môn học", hoặc "Khả năng vận dụng thực tiễn" cụ thể của học sinh.
Hãy tạo 4 chỉ số khảo sát, mỗi chỉ số gồm số lượng Học sinh Đạt (số lượng và tỷ lệ %) và Chưa Đạt (số lượng và tỷ lệ %) trong tổng mẫu khảo sát là 40 học sinh.

Yêu cầu trả về định dạng JSON chính xác như sau:
{
  "totalQty": 40,
  "surveyRows": [
    { "criteria": "Ý thức chủ động tham gia bài học", "achievedCount": 12, "achievedRate": 30, "notAchievedCount": 28, "notAchievedRate": 70 },
    { "criteria": "Hứng thú và lòng say mê học tập", "achievedCount": 10, "achievedRate": 25, "notAchievedCount": 30, "notAchievedRate": 75 },
    { "criteria": "Kỹ năng thực hành/vận dụng thực tế", "achievedCount": 8, "achievedRate": 20, "notAchievedCount": 32, "notAchievedRate": 80 },
    { "criteria": "Kết quả kiểm tra khảo sát chất lượng", "achievedCount": 15, "achievedRate": 37.5, "notAchievedCount": 25, "notAchievedRate": 62.5 }
  ],
  "pedagogicalComment": "Thực trạng cho thấy phần lớn học sinh vẫn thụ động, thiếu cơ hội thực hành thảo luận nhóm, phương pháp giảng dạy cũ chưa khơi gợi được hứng thú khám phá."
}` + criteriaBlock;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
        responseMimeType: "application/json",
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error generating survey data:", error);
    res.status(500).json({ error: error.message || "Lỗi tạo dữ liệu khảo sát." });
  }
});

// 3. API: Generate Solutions
app.post("/api/gemini/generate-solutions", async (req, res) => {
  try {
    const { title, subject, grade, solutionCount, options, criteriaContext } = req.body;
    const count = parseInt(solutionCount) || 3;
    const includeTables = options?.tables ? "Có tích hợp bảng biểu thống kê chi tiết" : "Không cần bảng";
    const includeEvidence = options?.evidence ? "Có mô tả minh chứng hoạt động của giáo viên và học sinh" : "Mô tả ngắn gọn";
    const includeInfographic = options?.infographic ? "Có ý tưởng thiết kế Infographic tóm tắt sơ đồ giải pháp" : "Không cần";

    const criteriaBlock = criteriaContext ? `\n\nLƯU Ý QUAN TRỌNG - TIÊU CHÍ ĐÁNH GIÁ TỪ CÔNG VĂN:\n${criteriaContext}\nHãy đảm bảo nội dung sinh ra tuân thủ chặt chẽ các tiêu chí đánh giá và yêu cầu nêu trên.` : "";

    const prompt = `Dựa trên đề tài: "${title}" (${subject} - lớp ${grade}).
Hãy đề xuất chính xác ${count} biện pháp/giải pháp thực hiện cốt lõi để nâng cao hiệu quả giảng dạy.
Cách tiếp cận: Cụ thể, mang tính đổi mới, sáng tạo, ứng dụng chuyển đổi số hoặc phương pháp dạy học tích cực (nhóm, dự án, stem, trải nghiệm).
Yêu cầu đính kèm tiêu chuẩn:
- ${includeTables}
- ${includeEvidence}
- ${includeInfographic}

Yêu cầu trả về định dạng JSON chính xác như sau:
{
  "solutions": [
    {
      "index": 1,
      "title": "Tên biện pháp 1 (VD: Ứng dụng mô hình trò chơi học tập bằng công cụ số hóa)",
      "purpose": "Mục tiêu giảng dạy cần đạt của biện pháp này",
      "steps": [
        "Bước 1: Chuẩn bị học liệu và công cụ tương tác nhóm",
        "Bước 2: Tổ chức hoạt động thực hành trên lớp",
        "Bước 3: Đánh giá và ghi nhận kết quả"
      ],
      "pedagogicalAdvice": "Lưu ý giáo viên cần phân nhóm học sinh đồng đều, tránh thiên vị học sinh khá giỏi.",
      "evidenceDescription": "Bảng kiểm đánh giá thái độ học tập và link phiếu câu hỏi trực tuyến.",
      "infographicConcept": "Sơ đồ 3 nhánh vòng tròn khép kín tương tác giữa Giáo viên - Học sinh - Học liệu số."
    }
  ]
}` + criteriaBlock;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
        responseMimeType: "application/json",
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error generating solutions:", error);
    res.status(500).json({ error: error.message || "Lỗi tạo biện pháp giảng dạy." });
  }
});

// 4. API: Generate Experiment pedagogical comparison
app.post("/api/gemini/generate-experiment", async (req, res) => {
  try {
    const { title, subject, grade, solutionsDraft, criteriaContext } = req.body;

    const criteriaBlock = criteriaContext ? `\n\nLƯU Ý QUAN TRỌNG - TIÊU CHÍ ĐÁNH GIÁ TỪ CÔNG VĂN:\n${criteriaContext}\nHãy đảm bảo nội dung sinh ra tuân thủ chặt chẽ các tiêu chí đánh giá và yêu cầu nêu trên.` : "";

    const prompt = `Từ sáng kiến kinh nghiệm: "${title}" (${subject} - lớp ${grade}).
Hãy tạo dữ liệu thực nghiệm sư phạm đối chứng giữa Nhóm Thực nghiệm (áp dụng giải pháp) và Nhóm Đối chứng (phương pháp truyền thống) để chứng minh hiệu quả vượt trội.
Mỗi nhóm gồm 40 học sinh. Hãy cung cấp số liệu cải thiện cụ thể trước tác động và sau tác động về các mức độ: "Hoàn thành tốt / Giỏi", "Hoàn thành / Khá", "Chưa hoàn thành / Trung bình yếu".

Yêu cầu trả về JSON chính xác theo dạng sau:
{
  "comparisonData": [
    { "category": "Giỏi / Xuất sắc (Hoàn thành tốt)", "controlGroup": 10, "experimentalGroup": 24 },
    { "category": "Khá (Hoàn thành đạt năng lực)", "controlGroup": 18, "experimentalGroup": 13 },
    { "category": "Trung bình (Đạt cơ bản)", "controlGroup": 10, "experimentalGroup": 3 },
    { "category": "Yếu / Chưa hoàn thành", "controlGroup": 2, "experimentalGroup": 0 }
  ],
  "statisticalAnalysis": "Phân tích giá trị trung bình cộng cho thấy điểm kiểm tra của lớp thực nghiệm đạt 8.24, tăng vượt bậc so với lớp đối chứng chỉ đạt 6.95. Hệ số chênh lệch có ý nghĩa thống kê khoa học chặt chẽ.",
  "conclusion": "Biện pháp sư phạm mới đã kích thích tư duy giải quyết vấn đề, nâng cao tỉ lệ đạt mức xuất sắc vượt mong đợi."
}` + criteriaBlock;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
        responseMimeType: "application/json",
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error generating experiment metrics:", error);
    res.status(500).json({ error: error.message || "Lỗi phân tích thực nghiệm." });
  }
});

// 5. API: Text Helper (Write continue, polish, summarize, Vietnamese professional tone)
app.post("/api/gemini/refine-text", async (req, res) => {
  try {
    const { text, action, criteriaContext } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Vui lòng nhập văn bản cần xử lý." });
    }

    const criteriaBlock = criteriaContext ? `\n\nLƯU Ý QUAN TRỌNG - TIÊU CHÍ ĐÁNH GIÁ TỪ CÔNG VĂN:\n${criteriaContext}\nHãy đảm bảo nội dung sinh ra tuân thủ chặt chẽ các tiêu chí đánh giá và yêu cầu nêu trên.` : "";

    let prompt = "";
    if (action === "continue") {
      prompt = `Hãy viết tiếp nội dung sư phạm học thuật tiếp theo một cách mạch lạc, phong phú từ đoạn văn sau:\n"${text}"` + criteriaBlock;
    } else if (action === "polish") {
      prompt = `Hãy trau chuốt, biên tập lại đoạn văn sau theo chuẩn giọng điệu văn phong nghiên cứu khoa học sư phạm chính thống của Việt Nam cực kỳ trang trọng và chuyên nghiệp:\n"${text}"` + criteriaBlock;
    } else if (action === "simplify") {
      prompt = `Hãy cô đọng, rút gọn đoạn văn dài này thành các luận điểm súc tích để đưa vào slide thuyết trình hoặc báo cáo tóm tắt:\n"${text}"` + criteriaBlock;
    } else {
      prompt = `Hãy sửa lỗi diễn đạt và cấu trúc lại giúp đoạn văn sư phạm sau thêm hấp dẫn:\n"${text}"` + criteriaBlock;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
      },
    });

    res.json({ refinedText: response.text });
  } catch (error: any) {
    console.error("Error in text helper api:", error);
    res.status(500).json({ error: error.message || "Lỗi xử lý văn bản AI." });
  }
});

// 6. API: Evaluate & Criticize (AI Phản biện)
app.post("/api/gemini/evaluate", async (req, res) => {
  try {
    const { title, subject, grade, outline, solutions, criteriaContext } = req.body;

    const criteriaBlock = criteriaContext ? `\n\nLƯU Ý QUAN TRỌNG - TIÊU CHÍ ĐÁNH GIÁ TỪ CÔNG VĂN:\n${criteriaContext}\nHãy đảm bảo nội dung sinh ra tuân thủ chặt chẽ các tiêu chí đánh giá và yêu cầu nêu trên.` : "";

    const prompt = `Bạn là chủ tịch hội đồng giám khảo cấp Tỉnh đánh giá Sáng kiến kinh nghiệm năm 2026.
Hãy phản biện sắc bén và đánh giá trung thực sáng kiến kinh nghiệm sau để định hướng chỉnh sửa đạt giải cao nhất:
Đề tài: "${title}"
Môn học: "${subject}"
Lớp: "${grade}"
Dàn ý: ${JSON.stringify(outline || [])}
Tóm tắt các giải pháp áp dụng: ${JSON.stringify(solutions || [])}

Hãy chấm điểm và nhận xét cực kỳ chi tiết theo đúng cấu trúc JSON sau:
{
  "scores": {
    "novelty": 82,
    "practicality": 88,
    "scientificValue": 85,
    "presentation": 90,
    "total": 86
  },
  "pros": [
    "Đề tài chạm trúng thực trạng nóng hổi của trường học hiện đại tại Việt Nam.",
    "Bố cục chặt chẽ theo thông tư hướng dẫn của ngành giáo dục.",
    "Các biện pháp đề xuất có áp dụng chuyển đổi số thực tế và khả thi cao."
  ],
  "cons": [
    "Cần làm rõ hơn cách giáo viên phân hóa học sinh tiếp cận trong biện pháp số 2.",
    "Số liệu khảo sát đầu năm còn thiếu sự phân bổ theo học lực của đối tượng cá biệt.",
    "Phần cơ sở thực tiễn cần nhấn mạnh các khó khăn thực tế địa phương đang gặp phải."
  ],
  "suggestions": [
    "Bổ sung thêm 1 bảng biểu khảo sát nhu cầu hứng thú của học sinh trước tác động để tăng tính khách quan.",
    "Viết sâu thêm về giải pháp bồi dưỡng học sinh yếu kém ở phần kế hoạch hành động.",
    "Đính kèm hướng dẫn sử dụng công cụ dạy học ở danh mục phụ lục minh chứng."
  ]
}` + criteriaBlock;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
        responseMimeType: "application/json",
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error in evaluating SKKN:", error);
    res.status(500).json({ error: error.message || "Lỗi đánh giá SKKN từ chuyên gia AI." });
  }
});

// 7. API: Spell proof-read standard Nghị định 30
app.post("/api/gemini/proof-read", async (req, res) => {
  try {
    const { content, criteriaContext } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Không tìm thấy nội dung để soát lỗi." });
    }

    const criteriaBlock = criteriaContext ? `\n\nLƯU Ý QUAN TRỌNG - TIÊU CHÍ ĐÁNH GIÁ TỪ CÔNG VĂN:\n${criteriaContext}\nHãy đảm bảo nội dung sinh ra tuân thủ chặt chẽ các tiêu chí đánh giá và yêu cầu nêu trên.` : "";

    const prompt = `Soat lỗi chính tả tiếng Việt, lỗi dấu câu, lỗi lặp từ và định dạng hành văn trong văn bản sư phạm sau. 
Đồng thời kiểm tra xem cách trình bày có hợp chuẩn mực Thể thức văn bản hành chính theo Nghị định 30/2020/NĐ-CP của Chính phủ hay không (Fonts chữ, cỡ chữ, căn lề, bố trí tiêu mục).
Nhận xét và gợi ý từ ngữ sửa hoàn hảo. Trả về dưới định dạng JSON sau:
{
  "totalErrorsCount": 2,
  "errorsList": [
    { "original": "sử dụng phầm mềm để giạy học", "corrected": "sử dụng phần mềm để dạy học", "reason": "Sai chính tả phụ âm 'm' thành 'm' thừa dấu sắc, và sai 'giạy' thành 'dạy' chuẩn tiếng Việt" }
  ],
  "govComplianceComment": "Văn bản đã tuân thủ định dạng cơ bản của Nghị định 30/2020/NĐ-CP. Nên lưu ý viết hoa các danh từ riêng như 'Bộ Giáo dục và Đào tạo' và điều chỉnh dòng khoảng cách đoạn (Line spacing) từ 1.15 thành 1.5.",
  "improvedParagraph": "Bao gồm văn bản đã được bạn sửa đổi lý tưởng, sẵn sàng để sao chép."
}` + criteriaBlock;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
        responseMimeType: "application/json",
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error in spelling API:", error);
    res.status(500).json({ error: error.message || "Lỗi soát lỗi chính tả." });
  }
});

// 8. API: Generate PowerPoint Slides structure
app.post("/api/gemini/generate-slides", async (req, res) => {
  try {
    const { title, subject, grade, solutions, criteriaContext } = req.body;

    const criteriaBlock = criteriaContext ? `\n\nLƯU Ý QUAN TRỌNG - TIÊU CHÍ ĐÁNH GIÁ TỪ CÔNG VĂN:\n${criteriaContext}\nHãy đảm bảo nội dung sinh ra tuân thủ chặt chẽ các tiêu chí đánh giá và yêu cầu nêu trên.` : "";

    const prompt = `Từ thông tin đề tài SKKN: "${title}" (${subject} - lớp ${grade})
Hãy xây dựng cấu trúc hoàn hảo của 6 slide thuyết trình bảo vệ đề tài trước hội đồng chấm giải cấp Huyện/Tỉnh.
Cấu trúc chuẩn sư phọng khoa học chuyên nghiệp. 

Trả về JSON định dạng chính xác sau:
{
  "presentationTheme": "Màu sắc đề xuất chủ đạo: Xanh ngọc lục bảo kết hợp Trắng xám sang trọng khoa học",
  "slides": [
    { "slideIndex": 1, "title": "Báo Cáo Sáng Kiến Kinh Nghiệm 2026", "subtitle": "Đề tài: ${title}", "bullets": ["Người thực hiện: [Tên tác giả]", "Đơn vị công tác: [Đơn vị]", "Môn giảng dạy: ${subject} lớp ${grade}"] },
    { "slideIndex": 2, "title": "Tính cấp thiết và Thực trạng trước tác động", "bullets": ["Thiếu hứng thú chủ trì học tập ở học sinh.", "Tỷ lệ thực hành sáng tạo chiếm dưới 30%.", "Phương pháp truyền thống thiếu tính đối thoại và trải nghiệm trực tiếp."] },
    { "slideIndex": 3, "title": "Biện pháp cốt lõi 1", "bullets": ["Chi tiết giải pháp triển khai thực tế hành động.", "Thay đổi cách thức tương tác của giáo viên và học sinh.", "Minh chứng áp dụng cụ thể: Bảng đánh giá năng lực tích cực."] },
    { "slideIndex": 4, "title": "Biện pháp cốt lõi 2 & 3", "bullets": ["Triển khai ứng dụng chuyển đổi số nâng cao kết quả học tập.", "Thực hiện đa dạng hóa hình thức tự học, trải nghiệm ngoại khóa.", "Công cụ hỗ trợ hữu ích: Phiếu trắc nghiệm điểm số tức thời."] },
    { "slideIndex": 5, "title": "Kết quả thực nghiệm sư phạm đạt được", "bullets": ["Tỷ lệ học sinh Khá Giỏi tăng vượt bậc rõ rệt.", "Mức độ hăng say học bài cải thiện đáng mừng.", "Được tập thể giáo viên trong tổ chuyên môn công nhận nhân rộng."] },
    { "slideIndex": 6, "title": "Lời cảm ơn & Cam kết", "bullets": ["Xin trân trọng cảm ơn quý Hội đồng Giám khảo lắng nghe.", "Cam kết tính trung thực tuyệt đối của sáng kiến kinh nghiệm.", "Rất mong nhận được phản hồi đóng ý kiến quý giá."] }
  ]
}` + criteriaBlock;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PEDAGOGICAL_PROMPT,
        responseMimeType: "application/json",
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error creating slides structure:", error);
    res.status(500).json({ error: error.message || "Lỗi tạo cấu trúc slide." });
  }
});
const USERS_FILE_PATH = path.join(process.cwd(), "users.json");

// Helper to load authorized users
const loadUsers = (): string[] => {
  try {
    if (!fs.existsSync(USERS_FILE_PATH)) {
      const defaultUsers = ["giaovien@gmail.com", "thayco@gmail.com"];
      fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(defaultUsers, null, 2));
      return defaultUsers;
    }
    const data = fs.readFileSync(USERS_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading users.json:", error);
    return [];
  }
};

// Helper to save authorized users
const saveUsers = (users: string[]) => {
  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("Error writing users.json:", error);
  }
};

// 9. API: Login endpoint
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const trimmedEmail = (email || "").trim().toLowerCase();
  const trimmedPassword = (password || "").trim();

  if (!trimmedEmail || !trimmedPassword) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ email và mật khẩu!" });
  }

  // Admin Verification
  if (trimmedEmail === "marioslide.animation@gmail.com" && trimmedPassword === "MARIS2026") {
    return res.json({ success: true, email: trimmedEmail, role: "admin" });
  }

  // Standard User Verification
  const users = loadUsers();
  if (users.map(u => u.toLowerCase()).includes(trimmedEmail) && trimmedPassword === "MARIS2026") {
    return res.json({ success: true, email: trimmedEmail, role: "user" });
  }

  return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác, hoặc chưa được cấp quyền truy cập. Vui lòng liên hệ Maris Slide để được cấp tài khoản." });
});

// 10. API: Get authorized users list (Admin only)
app.get("/api/admin/users", (req, res) => {
  const users = loadUsers();
  res.json(users);
});

// 11. API: Add authorized email
app.post("/api/admin/users/add", (req, res) => {
  const { email } = req.body;
  const trimmedEmail = (email || "").trim().toLowerCase();

  if (!trimmedEmail) {
    return res.status(400).json({ error: "Vui lòng cung cấp email cần cấp phép!" });
  }

  const users = loadUsers();
  if (users.includes(trimmedEmail)) {
    return res.status(400).json({ error: "Email này đã được cấp quyền truy cập từ trước!" });
  }

  if (trimmedEmail === "marioslide.animation@gmail.com") {
    return res.status(400).json({ error: "Email này là tài khoản quản trị tối cao, không cần cấp phép thêm!" });
  }

  const updated = [...users, trimmedEmail];
  saveUsers(updated);
  res.json({ success: true, users: updated });
});

// 12. API: Remove authorized email
app.post("/api/admin/users/remove", (req, res) => {
  const { email } = req.body;
  const trimmedEmail = (email || "").trim().toLowerCase();

  if (!trimmedEmail) {
    return res.status(400).json({ error: "Vui lòng cung cấp email cần thu hồi!" });
  }

  const users = loadUsers();
  const updated = users.filter(u => u !== trimmedEmail);
  saveUsers(updated);
  res.json({ success: true, users: updated });
});



async function startServer() {
  // Serve React build in production, or mount Vite dev server in development
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
    console.log(`🚀 VIẾT SÁNG KIẾN KINH NGHIỆM CÙNG MARIS SLIDE server running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
