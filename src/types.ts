export interface BehaviorLog {
  id: string;
  type: "merit" | "demerit";
  category: string;
  points: number;
  timestamp: string;
  note?: string;
}

export interface Student {
  id: string;
  name: string;
  gpa: number; // Out of 10
  points: number; // Merit - Demerit score
  meritCount: number;
  demeritCount: number;
  attendance: number; // Attendance rate %
  isPresentToday: boolean;
  voiceNotes: string;
  logs: BehaviorLog[];
  badges: string[]; // Badge IDs
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  color: string; // Tailwind class color
}

export interface ClassSummary {
  totalStudents: number;
  attendanceRate: number;
  totalMerits: number;
  totalDemerits: number;
  alertStudents: { name: string; issue: string }[];
}

export interface SceaResponse {
  dashboardBrief?: string;
  insights?: string;
  warnings?: string;
  commentDraft?: string;
  recomBadge?: string;
  lmsStatus?: string;
}
