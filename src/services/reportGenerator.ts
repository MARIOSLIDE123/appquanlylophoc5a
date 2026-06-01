import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { Student } from "../types";

export async function generateStudentReport(student: Student) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "PHIẾU LIÊN LẠC HỌC TẬP & THI ĐUA",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "---",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Họ và tên học sinh: ${student.name}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1. Thông tin chung:", bold: true, size: 28 }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            text: `- Điểm Học Lực (GPA): ${student.gpa}/10`,
            bullet: { level: 0 }
          }),
          new Paragraph({
            text: `- Điểm Thi Đua (Merit): ${student.points} điểm`,
            bullet: { level: 0 }
          }),
          new Paragraph({
            text: `- Tỉ lệ Chuyên Cần: ${student.attendance}%`,
            bullet: { level: 0 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "2. Hoạt động Thi đua chi tiết:", bold: true, size: 28 }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            text: `Tổng số lần khen thưởng (Merit): ${student.meritCount}`,
            bullet: { level: 0 }
          }),
          new Paragraph({
            text: `Tổng số lần nhắc nhở (Demerit): ${student.demeritCount}`,
            bullet: { level: 0 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3. Nhận xét của Giáo viên (AI Diagnostics):", bold: true, size: 28 }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            text: student.voiceNotes || "Chưa có nhận xét riêng cho học sinh trong tuần này.",
          }),
          new Paragraph({
            text: "---",
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
          }),
          new Paragraph({
            text: "Trân trọng,\nGiáo viên Chủ nhiệm.",
            alignment: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Phieu_Lien_Lac_${student.name.replace(/\s+/g, "_")}.docx`);
}
