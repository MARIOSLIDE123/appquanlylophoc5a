import PptxGenJS from "pptxgenjs";
import { Student } from "../types";

export async function generateWeeklyHonorSlide(students: Student[]) {
  const pptx = new PptxGenJS();
  
  // Sort students by points and get top 3
  const topStudents = [...students]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  // Add a master slide
  pptx.layout = "LAYOUT_16x9";

  const slide = pptx.addSlide();
  slide.background = { color: "1E1B4B" }; // Deep indigo background

  // Title
  slide.addText("🌟 VINH DANH HỌC SINH XUẤT SẮC TUẦN 🌟", {
    x: 0,
    y: 0.5,
    w: "100%",
    h: 1,
    align: "center",
    fontSize: 44,
    bold: true,
    color: "FBBF24", // Amber color
  });

  // Top Students layout
  if (topStudents.length > 0) {
    topStudents.forEach((student, index) => {
      // Calculate positions for 3 columns
      const widthPerStudent = 10 / 3; // 10 is max width in inches roughly
      const xPos = index * widthPerStudent + 0.1;
      
      let rankIcon = "🥇 HẠNG 1";
      if (index === 1) rankIcon = "🥈 HẠNG 2";
      if (index === 2) rankIcon = "🥉 HẠNG 3";

      // Rank Label
      slide.addText(rankIcon, {
        x: xPos,
        y: 2.2,
        w: widthPerStudent,
        h: 0.5,
        align: "center",
        fontSize: 28,
        bold: true,
        color: index === 0 ? "FBBF24" : index === 1 ? "9CA3AF" : "D97706",
      });

      // Student Name
      slide.addText(student.name, {
        x: xPos,
        y: 3.0,
        w: widthPerStudent,
        h: 0.8,
        align: "center",
        fontSize: 32,
        bold: true,
        color: "FFFFFF",
      });

      // GPA
      slide.addText(`GPA: ${student.gpa}`, {
        x: xPos,
        y: 4.0,
        w: widthPerStudent,
        h: 0.5,
        align: "center",
        fontSize: 20,
        color: "34D399",
      });

      // Points
      slide.addText(`Điểm Thi Đua: ${student.points}`, {
        x: xPos,
        y: 4.5,
        w: widthPerStudent,
        h: 0.5,
        align: "center",
        fontSize: 20,
        color: "60A5FA",
      });
      
      // Box decoration
      slide.addShape(pptx.ShapeType.rect, {
        x: xPos + 0.2,
        y: 2.0,
        w: widthPerStudent - 0.4,
        h: 3.2,
        fill: { color: "312E81", transparency: 50 },
        line: { color: "4F46E5", width: 2 },
      });
    });
  } else {
    slide.addText("Chưa có dữ liệu học sinh", {
      x: 0,
      y: 3,
      w: "100%",
      h: 1,
      align: "center",
      fontSize: 24,
      color: "FFFFFF",
    });
  }

  // Footer
  slide.addText("Phần mềm Quản lý Lớp học - Mario Slide", {
    x: 0,
    y: 6.8,
    w: "100%",
    h: 0.5,
    align: "center",
    fontSize: 14,
    color: "9CA3AF",
  });

  await pptx.writeFile({ fileName: "Vinh_Danh_Tuan.pptx" });
}
