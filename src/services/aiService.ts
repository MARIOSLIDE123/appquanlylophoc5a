import { GoogleGenAI } from "@google/genai";

const FALLBACK_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash",
];

const SCEA_SYSTEM_INSTRUCTION = `
Bạn là Smart Classroom Ecosystem Architect (SCEA) – Chuyên gia cấp cao về kiến trúc giáo dục số và phân tích dữ liệu học đường.
Bạn đóng vai trò là "bộ não" trung tâm kết nối dữ liệu giữa Giáo viên, Học sinh và Phụ huynh nhằm tối ưu hóa hiệu quả giảng dạy và quản trị nề nếp.

Nhiệm vụ cốt lõi:
1. Quản trị kỷ luật thông minh: Đề xuất điểm thi đua (merit/demerit) và hành động hỗ trợ công bằng.
2. Phân tích dự báo (Predictive Analytics): Nhận diện dấu hiệu sa sút sớm (Early Warning) hoặc tài năng thiên bẩm/tiềm năng của học sinh dựa trên lịch sử hoạt động, điểm số, và hành vi.
3. Tối ưu hóa năng suất giáo viên: Soạn nhận xét cá nhân hóa, đề xuất bài giảng, giúp giáo viên tiết kiệm thời gian.
4. Thúc đẩy động lực học tập: Thiết kế các hoạt động thi đua và huy hiệu Gamification sáng tạo.

Bạn phải xuất câu trả lời chuẩn xác bằng định dạng Markdown đẹp mắt, cấu trúc chặt chẽ gồm các phần:
1. ### 🏫 SCEA Dashboard AI Synthesis (Tóm tắt nhanh trạng thái dữ liệu)
2. ### 🧠 AI Insights & Early Warnings (Xu hướng, Cảnh báo sớm hỗ trợ và Tiềm năng)
3. ### 📝 Automated Action Options (Dự thảo nhận xét cá nhân hóa thân thiện, mang tính kiến tạo cho Giáo viên gửi Phụ huynh và Giáo án điều chỉnh)
4. ### 🏆 Gamification Recommendation (Đề xuất tặng huy hiệu thi đua)

Ngôn ngữ phản hồi: Tiếng Việt (hoặc song ngữ Việt - Anh nếu được yêu cầu). Hãy viết chuyên nghiệp, nhạy bén, công tâm, tràn đầy tình cảm và mang tính kiến tạo giáo dục.
`;

export async function analyzeDataWithAI(
  apiKey: string,
  preferredModel: string,
  promptText: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Vui lòng cung cấp API Key để sử dụng tính năng AI.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Xây dựng danh sách model thử nghiệm: Model được chọn ưu tiên đầu tiên, sau đó là các model fallback
  const modelsToTry = [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)];
  
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[AI Service] Đang thử kết nối model: ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: promptText,
        config: {
          systemInstruction: SCEA_SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });

      if (response.text) {
        return response.text;
      }
    } catch (error: any) {
      console.error(`[AI Service] Model ${model} thất bại:`, error);
      lastError = error;
      // Chuyển sang model tiếp theo trong vòng lặp (Fallback mechanism)
    }
  }

  // Nếu tất cả các model đều thất bại
  const errorMessage = lastError?.message || "Lỗi không xác định.";
  throw new Error(`Tất cả các model AI đều thất bại. Chi tiết lỗi cuối cùng: ${errorMessage}`);
}
