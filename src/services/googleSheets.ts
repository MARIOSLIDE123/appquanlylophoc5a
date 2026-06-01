import { Student } from "../types";

// Danh sách CORS proxy để thử khi bị chặn
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => url, // Thử trực tiếp (hoạt động nếu server cho phép CORS)
];

export async function fetchStudentsFromCSV(csvUrl: string): Promise<Student[]> {
  let lastError: any = null;

  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxiedUrl = proxyFn(csvUrl);
      console.log(`[Google Sheets] Đang thử tải từ: ${proxiedUrl.substring(0, 80)}...`);

      const response = await fetch(proxiedUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const csvText = await response.text();

      // Kiểm tra xem có phải HTML (trang lỗi) thay vì CSV không
      if (csvText.trim().startsWith("<!") || csvText.trim().startsWith("<html")) {
        throw new Error("Nhận được trang HTML thay vì CSV. Link có thể chưa được Publish to web đúng cách.");
      }

      const students = parseCSVToStudents(csvText);
      if (students.length > 0) {
        return students;
      }
    } catch (error: any) {
      console.warn(`[Google Sheets] Proxy thất bại:`, error.message);
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "Không thể tải dữ liệu từ Google Sheets. Vui lòng thử tải file trực tiếp.");
}

// Hàm parse file CSV được tải lên từ máy tính (không cần proxy)
export function parseCSVFileToStudents(csvText: string): Student[] {
  return parseCSVToStudents(csvText);
}

function parseCSVToStudents(csvText: string): Student[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const students: Student[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line);

    // Find index of headers flexibly
    const findIndex = (keywords: string[]) => {
      return headers.findIndex(h => keywords.some(k => h.includes(k)));
    };

    const idIndex = findIndex(['id', 'mã', 'stt', 'số thứ tự']);
    const nameIndex = findIndex(['họ tên', 'tên', 'name', 'học sinh', 'họ và tên']);
    const gpaIndex = findIndex(['gpa', 'học lực', 'điểm tb', 'điểm trung bình']);
    const pointsIndex = findIndex(['thi đua', 'points', 'điểm thi đua']);
    const meritIndex = findIndex(['khen', 'merit', 'khen thưởng']);
    const demeritIndex = findIndex(['nhắc nhở', 'demerit', 'phạt', 'vi phạm']);
    const attendanceIndex = findIndex(['chuyên cần', 'điểm danh', 'attendance']);

    const id = idIndex !== -1 && values[idIndex] ? values[idIndex].trim() : `stu_online_${i}`;
    const name = nameIndex !== -1 && values[nameIndex] ? values[nameIndex].trim() : "";
    const gpa = gpaIndex !== -1 && values[gpaIndex] ? parseFloat(values[gpaIndex]) || 0 : 0;
    const points = pointsIndex !== -1 && values[pointsIndex] ? parseInt(values[pointsIndex], 10) || 0 : 0;
    const meritCount = meritIndex !== -1 && values[meritIndex] ? parseInt(values[meritIndex], 10) || 0 : 0;
    const demeritCount = demeritIndex !== -1 && values[demeritIndex] ? parseInt(values[demeritIndex], 10) || 0 : 0;
    const attendance = attendanceIndex !== -1 && values[attendanceIndex] ? parseInt(values[attendanceIndex], 10) || 100 : 100;

    // Nếu không tìm thấy cột tên, thử dùng cột đầu tiên hoặc cột thứ 2
    let finalName = name;
    if (!finalName && values.length >= 2) {
      // Nếu cột đầu là số (STT), lấy cột thứ 2 làm tên
      const firstVal = values[0]?.trim();
      const secondVal = values[1]?.trim();
      if (firstVal && !isNaN(Number(firstVal)) && secondVal) {
        finalName = secondVal;
      } else if (firstVal && isNaN(Number(firstVal))) {
        finalName = firstVal;
      }
    }

    if (!finalName) continue;

    students.push({
      id,
      name: finalName,
      gpa,
      points,
      meritCount,
      demeritCount,
      attendance,
      isPresentToday: true,
      voiceNotes: "",
      logs: [],
      badges: []
    });
  }

  return students;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
