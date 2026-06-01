import { Student } from "../types";

export async function fetchStudentsFromCSV(csvUrl: string): Promise<Student[]> {
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    return parseCSVToStudents(csvText);
  } catch (error) {
    console.error("Error fetching Google Sheets CSV:", error);
    throw error;
  }
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

    const idIndex = findIndex(['id', 'mã']);
    const nameIndex = findIndex(['họ tên', 'tên', 'name', 'học sinh']);
    const gpaIndex = findIndex(['gpa', 'học lực', 'điểm']);
    const pointsIndex = findIndex(['thi đua', 'points']);
    const meritIndex = findIndex(['khen', 'merit']);
    const demeritIndex = findIndex(['nhắc nhở', 'demerit', 'phạt']);
    const attendanceIndex = findIndex(['chuyên cần', 'điểm danh']);
    
    const id = idIndex !== -1 && values[idIndex] ? values[idIndex] : `stu_online_${i}`;
    const name = nameIndex !== -1 && values[nameIndex] ? values[nameIndex] : `Học sinh ${i}`;
    const gpa = gpaIndex !== -1 && values[gpaIndex] ? parseFloat(values[gpaIndex]) || 0 : 0;
    const points = pointsIndex !== -1 && values[pointsIndex] ? parseInt(values[pointsIndex], 10) || 0 : 0;
    const meritCount = meritIndex !== -1 && values[meritIndex] ? parseInt(values[meritIndex], 10) || 0 : 0;
    const demeritCount = demeritIndex !== -1 && values[demeritIndex] ? parseInt(values[demeritIndex], 10) || 0 : 0;
    const attendance = attendanceIndex !== -1 && values[attendanceIndex] ? parseInt(values[attendanceIndex], 10) || 100 : 100;

    if (!name || name === `Học sinh ${i}`) continue;

    students.push({
      id,
      name,
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
