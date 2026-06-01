import { Student } from "../types";
import { analyzeDataWithAI } from "./aiService";

/**
 * Đọc file được tải lên (CSV, TXT, DOCX) và trích xuất danh sách học sinh.
 * - CSV/TXT: Parse trực tiếp trên trình duyệt.
 * - DOCX/DOC/các định dạng khác: Dùng AI Gemini để đọc hiểu nội dung.
 */
export async function parseUploadedFile(
  file: File,
  geminiApiKey: string,
  selectedModel: string
): Promise<Student[]> {
  const fileName = file.name.toLowerCase();

  // CSV: đọc text và parse trực tiếp
  if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
    const text = await file.text();
    const { parseCSVFileToStudents } = await import("./googleSheets");
    const students = parseCSVFileToStudents(text);
    return students;
  }

  // DOCX / DOC / XLSX / bất kỳ: Đọc nội dung dạng text, gửi cho AI phân tích
  const textContent = await extractTextFromFile(file);

  if (!geminiApiKey) {
    throw new Error("Vui lòng nhập API Key Gemini trong phần Cài đặt (Settings) để AI có thể đọc file Word.");
  }

  const prompt = `
Bạn là trợ lý xử lý dữ liệu giáo dục. Tôi sẽ cung cấp cho bạn nội dung từ một tài liệu chứa danh sách học sinh.
Hãy trích xuất danh sách học sinh và trả về dưới dạng JSON array.

MỖI HỌC SINH phải có đúng các trường sau (nếu thiếu thông tin thì dùng giá trị mặc định):
- "name": Họ và tên đầy đủ (BẮT BUỘC)
- "gpa": Điểm trung bình (mặc định: 0)
- "points": Điểm thi đua (mặc định: 0)
- "meritCount": Số lần khen (mặc định: 0)
- "demeritCount": Số lần nhắc nhở (mặc định: 0)
- "attendance": Tỉ lệ chuyên cần % (mặc định: 100)

CHỈ TRẢ VỀ JSON ARRAY, KHÔNG giải thích thêm. Ví dụ:
[{"name":"Nguyễn Văn A","gpa":8.5,"points":100,"meritCount":5,"demeritCount":0,"attendance":95}]

NỘI DUNG TÀI LIỆU:
---
${textContent.substring(0, 8000)}
---
`;

  const aiResult = await analyzeDataWithAI(geminiApiKey, selectedModel, prompt);

  // Trích xuất JSON từ kết quả AI
  return parseAIResponseToStudents(aiResult);
}

/**
 * Trích xuất text từ file. Với DOCX thì đọc nội dung XML bên trong.
 */
async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".docx")) {
    // DOCX là file ZIP chứa XML. Đọc nội dung bằng cách giải nén
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // Tìm file word/document.xml trong ZIP
      const textContent = extractTextFromDocxBytes(uint8);
      if (textContent.trim()) return textContent;
    } catch (e) {
      console.warn("Không thể đọc DOCX theo cách thông thường, thử đọc raw text...");
    }
  }

  // Fallback: đọc dạng text thuần
  try {
    return await file.text();
  } catch {
    throw new Error("Không thể đọc nội dung file. Vui lòng thử file CSV hoặc TXT.");
  }
}

/**
 * Trích xuất text thô từ bytes của file DOCX (ZIP containing XML).
 * Đây là phương pháp đơn giản không cần thư viện ZIP.
 */
function extractTextFromDocxBytes(bytes: Uint8Array): string {
  // Chuyển bytes thành string để tìm nội dung XML
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const rawStr = decoder.decode(bytes);

  // Tìm tất cả nội dung giữa các thẻ <w:t> trong XML
  const textParts: string[] = [];
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = regex.exec(rawStr)) !== null) {
    if (match[1]) textParts.push(match[1]);
  }

  if (textParts.length > 0) {
    return textParts.join(" ");
  }

  // Nếu không tìm thấy w:t, trả về tất cả text giữa các thẻ XML
  return rawStr.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").substring(0, 10000);
}

/**
 * Parse kết quả AI thành mảng Student
 */
function parseAIResponseToStudents(aiResponse: string): Student[] {
  // Tìm JSON array trong response
  const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI không trả về dữ liệu hợp lệ. Vui lòng thử lại hoặc dùng file CSV.");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Danh sách rỗng.");
    }

    return parsed.map((item: any, index: number) => ({
      id: `stu_ai_${index + 1}`,
      name: item.name || `Học sinh ${index + 1}`,
      gpa: Number(item.gpa) || 0,
      points: Number(item.points) || 0,
      meritCount: Number(item.meritCount) || 0,
      demeritCount: Number(item.demeritCount) || 0,
      attendance: Number(item.attendance) || 100,
      isPresentToday: true,
      voiceNotes: "",
      logs: [],
      badges: [],
    }));
  } catch (e: any) {
    throw new Error(`Lỗi phân tích dữ liệu từ AI: ${e.message}`);
  }
}
