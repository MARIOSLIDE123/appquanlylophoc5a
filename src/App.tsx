import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Award,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  Mic,
  MicOff,
  RefreshCw,
  Layers,
  ShieldCheck,
  Search,
  PlusCircle,
  MinusCircle,
  UserCheck,
  Flame,
  BookOpen,
  ArrowUpRight,
  TrendingUp,
  MessageSquare,
  Users,
  Check,
  X,
  Volume2,
  Settings
} from "lucide-react";
import { INITIAL_STUDENTS, BEHAVIOR_PRESETS, BADGES } from "./data";
import { Student, BehaviorLog, Badge, SceaResponse } from "./types";
import { fetchStudentsFromCSV } from "./services/googleSheets";
import { generateStudentReport } from "./services/reportGenerator";
import { generateWeeklyHonorSlide } from "./services/presentationGenerator";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import { analyzeDataWithAI } from "./services/aiService";

export default function App() {
  // Application state
  const [sheetUrl, setSheetUrl] = useState("");
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem("scea_api_key") || "");
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("scea_ai_model") || "gemini-3-flash-preview");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem("scea_students");
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });
  
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    INITIAL_STUDENTS[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "present" | "absent" | "alert">("all");
  const [sortBy, setSortBy] = useState<"points" | "gpa" | "attendance" | "name">("points");

  // Custom logging states
  const [customLogNote, setCustomLogNote] = useState("");
  const [customLogPoints, setCustomLogPoints] = useState(10);
  const [customLogType, setCustomLogType] = useState<"merit" | "demerit">("merit");
  const [customCategory, setCustomCategory] = useState("Hoạt động khác");

  // Simulating Speech to Text (Voice Notes)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceInput, setVoiceInput] = useState("");
  
  // Simulated FaceID scanner active animations
  const [isFaceScanning, setIsFaceScanning] = useState(false);
  const [scannedStudentName, setScannedStudentName] = useState("");

  // AI response & engine loading states
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStage, setAiStage] = useState("");
  const [aiSuccessToast, setAiSuccessToast] = useState<string | null>(null);

  // LMS Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<string[]>([
    "08:00 AM - Đã kết nối với Cổng dữ liệu LMS Sở GD&ĐT thành công.",
    "09:15 AM - Đồng bộ hóa danh sách 5 học sinh hiện diện trực tuyến qua Camera FaceID lớp học."
  ]);

  // Save state on modification
  useEffect(() => {
    localStorage.setItem("scea_students", JSON.stringify(students));
  }, [students]);

  // Audio timer simulator for Voice Noting
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Current selected student reference
  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  // Global helper states
  const totalStudents = students.length;
  const presentCount = students.filter((s) => s.isPresentToday).length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
  
  // Calculate merits vs demerits sum
  const totalMeritsGroup = students.reduce((sum, s) => sum + s.meritCount, 0);
  const totalDemeritsGroup = students.reduce((sum, s) => sum + s.demeritCount, 0);

  // Sorting and Filtering algorithm
  const filteredStudents = students
    .filter((s) => {
      const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (filterType === "all") return matchSearch;
      if (filterType === "present") return matchSearch && s.isPresentToday;
      if (filterType === "absent") return matchSearch && !s.isPresentToday;
      if (filterType === "alert") return matchSearch && (s.gpa < 7.0 || s.demeritCount > 1);
      return matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === "points") return b.points - a.points;
      if (sortBy === "gpa") return b.gpa - a.gpa;
      if (sortBy === "attendance") return b.attendance - a.attendance;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  // Action: Simulating Voice Record ending and filling speech-to-text notes
  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      // Generate unique fun pedagogical phrases depending on selected student's history or randomly
      const feedbackSamples = [
        `Họ và tên: ${selectedStudent.name}. Hôm nay bạn rất nỗ lực hoạt động tập thể, đề xuất cộng điểm Merit. Tuy nhiên bài tập về nhà môn Toán làm còn hơi vội vàng, cần hướng dẫn thêm.`,
        `Thảo luận đề tài khoa học sáng tạo cho ${selectedStudent.name}, bạn đưa ra hai sáng kiến thú vị về bảo vệ môi trường, thiết kế sơ đồ tuyệt đẹp. Đề nghị tuyên dương trước lớp.`,
        `Ghi nhận nhanh hành vi của ${selectedStudent.name}: Thể hiện xuất sắc trong giao tiếp nhóm, tuy nhiên còn tranh luận hơi gay gắt với bạn kế bên dẫn đến mất trật tự nhẹ lúc 10h.`
      ];
      const randomNote = feedbackSamples[Math.floor(Math.random() * feedbackSamples.length)];
      setVoiceInput(randomNote);
      updateVoiceNotesForStudent(selectedStudent.id, randomNote);
      showToast("🎙️ Đã chuyển giọng nói thành văn bản thành công!");
    } else {
      setIsRecording(true);
      setVoiceInput("");
    }
  };

  const updateVoiceNotesForStudent = (id: string, text: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return { ...s, voiceNotes: text };
        }
        return s;
      })
    );
  };

  // Helper for toaster
  const showToast = (message: string) => {
    setAiSuccessToast(message);
    setTimeout(() => {
      setAiSuccessToast(null);
    }, 4000);
  };

  // Action: Run Simulated FaceID Camera Scan
  const triggerFaceID = (studentId: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    setIsFaceScanning(true);
    setScannedStudentName(targetStudent.name);

    setTimeout(() => {
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === studentId) {
            const nextPresent = !s.isPresentToday;
            // Adjust attendance percentage dynamically
            const nextAttendance = nextPresent
              ? Math.min(100, s.attendance + 2)
              : Math.max(0, s.attendance - 5);
            return {
              ...s,
              isPresentToday: nextPresent,
              attendance: Number(nextAttendance.toFixed(1))
            };
          }
          return s;
        })
      );
      setIsFaceScanning(false);
      showToast(`📸 FaceID: Đã xác thực gương mặt [${targetStudent.name}] thành công!`);
    }, 2200);
  };

  // Action: Manual points reward
  const addLogEntry = (type: "merit" | "demerit", category: string, points: number, note?: string) => {
    const timestampStr = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit"
    }) + " - Hôm nay";

    const newLog: BehaviorLog = {
      id: "log_" + Date.now(),
      type,
      category,
      points,
      timestamp: timestampStr,
      note: note || "Không có ghi chú thêm."
    };

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === selectedStudent.id) {
          const nextPoints = type === "merit" ? s.points + points : Math.max(0, s.points - points);
          const nextMeritCount = type === "merit" ? s.meritCount + 1 : s.meritCount;
          const nextDemeritCount = type === "demerit" ? s.demeritCount + 1 : s.demeritCount;
          return {
            ...s,
            points: nextPoints,
            meritCount: nextMeritCount,
            demeritCount: nextDemeritCount,
            logs: [newLog, ...s.logs]
          };
        }
        return s;
      })
    );

    // Also add to global LMS sync preview
    const logTypeLabel = type === "merit" ? "Cộng Merit" : "Trừ Demerit";
    setSyncHistory((prev) => [
      `${new Date().toLocaleTimeString("vi-VN")} - [${selectedStudent.name}] Nhận ${logTypeLabel} (+${points}đ) - ${category}`,
      ...prev
    ]);

    showToast(`✅ Đã ghi nhận hành vi thi đua cho ${selectedStudent.name}!`);
  };

  // Action: Custom Behavior Submit
  const handleCustomLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLogNote.trim()) return;
    addLogEntry(customLogType, customCategory, customLogPoints, customLogNote);
    setCustomLogNote("");
  };

  // Action: Add / Remove Badge
  const toggleBadge = (badgeId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === selectedStudent.id) {
          const hasBadge = s.badges.includes(badgeId);
          const nextBadges = hasBadge
            ? s.badges.filter((b) => b !== badgeId)
            : [...s.badges, badgeId];
          return { ...s, badges: nextBadges };
        }
        return s;
      })
    );
    showToast(`🏅 Cập nhật danh sách huy hiệu cho ${selectedStudent.name}!`);
  };

  // Call Gemini SCEA Diagnostic Tool
  const runSceaDiagnostic = async (type: "student_diagnostics" | "class_evaluation") => {
    if (!geminiApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setIsAiLoading(true);
    setAiResponse("");
    
    // Diagnostic visual stages simulating cognitive brain cycles
    const stages = [
      "🔄 Đang kết nối SCEA Cognitive Engine...",
      "🔍 Đang truy xuất lịch sử Merit/Demerit tiết học...",
      "📈 Đang tính toán xu hướng điểm học lực tích phân...",
      `🧠 Đang kích hoạt Mô hình ${selectedModel}...`,
      "🔮 Đang dự thảo văn bản nhận xét & khuyến nghị EdTech..."
    ];

    let currentStageIndex = 0;
    setAiStage(stages[0]);
    const stageInterval = setInterval(() => {
      currentStageIndex++;
      if (currentStageIndex < stages.length) {
        setAiStage(stages[currentStageIndex]);
      }
    }, 700);

    try {
      let promptText = "";
      if (type === "student_diagnostics") {
        promptText = `
Hãy thực hiện phân tích chẩn đoán cho học sinh sau đây:
Họ và tên: ${selectedStudent.name}
Điểm số trung bình môn hiện tại: ${selectedStudent.gpa}/10
Điểm thi đua hiện tại (Merit/Demerit): ${selectedStudent.points} (Hành vi tích cực: ${selectedStudent.meritCount}, Vi phạm: ${selectedStudent.demeritCount})
Tỉ lệ chuyên cần điểm danh: ${selectedStudent.attendance}%
Lịch sử hành vi gần đây: 
${JSON.stringify(selectedStudent.logs || [])}

Ghi chú nhanh giọng nói của Giáo viên (Speech-to-Text):
"${selectedStudent.voiceNotes || "Không có ghi chú"}"

Yêu cầu phân tích:
1. Đánh giá trạng thái học tập và kỷ luật hiện tại.
2. Đưa ra 1 Cảnh Cáo Sớm (Early Warning) nếu có rủi ro sa sút tâm lý/học tập HOẶC Phát hiện 1 Điểm Sáng Tiềm Năng (Inner Genius).
3. Viết 1 nhận xét cá nhân hóa (khoảng 3-4 câu) bằng tiếng Việt thật tinh tế và kiến tạo để giáo viên có thể gửi cho phụ huynh.
4. Đề xuất 1 huy hiệu đặc thù khuyến khích tinh thần đồng đội hoặc nỗ lực cá nhân của học sinh này.
`;
      } else {
        const alertCollection = students
          .filter((s) => s.gpa < 7.5 || s.demeritCount > 1)
          .map((s) => ({ name: s.name, issue: `GPA: ${s.gpa}, Demerits: ${s.demeritCount}` }));
          
        promptText = `
Hãy đánh giá bức tranh tổng quan của cả lớp học:
Số lượng học sinh: ${totalStudents}
Tỉ lệ hiện diện FaceID: ${attendanceRate}%
Tổng số hoạt động Merit trong ngày: ${totalMeritsGroup}
Tổng số vi phạm Demerit trong ngày: ${totalDemeritsGroup}
Nhóm học sinh cần lưu ý đặc biệt: ${JSON.stringify(alertCollection || [])}

Yêu cầu:
1. Đưa ra góc nhìn SCEA về bầu không khí học tập và kỷ luật chung của lớp hiện tại.
2. Dự báo xu hướng học tập (mức độ tiếp thu bài giảng, sự tập trung).
3. Dự thảo văn bản nhận xét tổng quát cuối ngày (Daily AI Briefing) gửi BGH hoặc Phụ huynh.
4. Đề xuất điều chỉnh bài giảng/tiết học tiếp theo sao cho hấp dẫn hơn (Gamified Teaching Strategy).
`;
      }

      const text = await analyzeDataWithAI(geminiApiKey, selectedModel, promptText);

      setAiResponse(text);
      showToast("🧠 SCEA Brain kết xuất báo cáo thành công!");
      setAiStage("Hoàn tất");
    } catch (error: any) {
      console.error(error);
      setAiResponse(`### ❌ Lỗi kết nối AI Chẩn đoán\n\n**Chi tiết:** ${error.message}`);
      setAiStage("Đã dừng do lỗi");
    } finally {
      clearInterval(stageInterval);
      setIsAiLoading(false);
      // Giữ thông báo lỗi nếu có lỗi
      if (aiStage !== "Đã dừng do lỗi") {
         setTimeout(() => setAiStage(""), 3000);
      }
    }
  };

  // Simulated Sync to LMS
  const triggerLmsSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const timeStr = new Date().toLocaleTimeString("vi-VN");
      const syncMsg = `${timeStr} - 🔄 [ĐỒNG BỘ LMS] Đã tải lên hệ thống School-Moodle ${students.length} hồ sơ học sinh, cập nhật điểm thi đua mới nhất.`;
      setSyncHistory((prev) => [syncMsg, ...prev]);
      setIsSyncing(false);
      showToast("☁️ Đồng bộ hóa dữ liệu cơ sở dữ liệu LMS hoàn tất!");
    }, 1500);
  };

  // Reset demo defaults helper
  const handleResetData = () => {
    if (window.confirm("Bạn có chắc chắn muốn cài đặt lại toàn bộ dữ liệu mẫu lớp học ban đầu?")) {
      setStudents(INITIAL_STUDENTS);
      setSelectedStudentId(INITIAL_STUDENTS[0].id);
      localStorage.removeItem("scea_students");
      showToast("♻️ Hệ thống đã khôi phục dữ liệu gốc.");
    }
  };

  const handleFetchGoogleSheets = async () => {
    if (!sheetUrl) {
      alert("Vui lòng nhập đường link public CSV của Google Sheets.");
      return;
    }
    setIsFetchingSheet(true);
    try {
      const newStudents = await fetchStudentsFromCSV(sheetUrl);
      if (newStudents.length > 0) {
        setStudents(newStudents);
        setSelectedStudentId(newStudents[0].id);
        showToast(`✅ Đã tải thành công ${newStudents.length} học sinh từ Google Sheets!`);
      } else {
        alert("Không tìm thấy học sinh nào. Vui lòng kiểm tra lại cấu trúc bảng tính.");
      }
    } catch (error) {
      alert("Lỗi khi tải dữ liệu. Vui lòng đảm bảo link là định dạng CSV (Publish to the web).");
    } finally {
      setIsFetchingSheet(false);
    }
  };

  return (
    <div id="scea-app-root" className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* Visual Scanning Overlay for Simulated FaceID camera */}
      {isFaceScanning && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex flex-col items-center justify-center backdrop-blur-md">
          <div className="relative w-80 h-80 rounded-3xl border-4 border-dashed border-emerald-400 flex items-center justify-center overflow-hidden animate-pulse">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 animate-bounce" style={{ duration: "1.5s" }} />
            <User className="w-40 h-40 text-emerald-400 opacity-80" />
            
            {/* Corner photo simulation brackets */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
          </div>
          <div className="mt-8 text-center px-4">
            <h3 className="text-xl font-display font-bold text-white text-emerald-400">
              [SCEA CAMERA DETECTING]
            </h3>
            <p className="text-slate-300 mt-2 text-sm max-w-sm">
              Đang phân tích FaceID sinh trắc học của học sinh <br />
              <span className="text-emerald-300 font-mono font-bold text-lg mt-1 block">
                "{scannedStudentName}"
              </span>
            </p>
            <div className="mt-4 flex gap-1 justify-center">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping delay-75" />
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping delay-150" />
            </div>
          </div>
        </div>
      )}

      {/* Header section styled elegantly */}
      <header id="scea-header" className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-md bg-white/95 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-3.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-200 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-xl tracking-tight text-slate-900">
                  QUẢN LÝ LỚP HỌC 5A - MARIO SLIDE
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-full uppercase">
                  VERSION 2.1
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Kiến trúc quản trị nề nếp thi đua, sinh trắc học FaceID & trí tuệ nhân tạo Gemini
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!geminiApiKey && (
              <span className="text-xs text-rose-500 font-bold animate-pulse">
                ⚠️ Lấy API key để sử dụng app
              </span>
            )}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-slate-600 shadow-sm transition-colors"
              title="Cài đặt AI"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Quick stats grid representing classroom overall live metrics */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-mono">
            <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <div className="text-left leading-none">
                <div className="text-[9px] text-slate-400 uppercase font-sans">Sĩ số lớp</div>
                <div className="text-sm font-bold text-slate-800">{presentCount}/{totalStudents}</div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <div className="text-left leading-none">
                <div className="text-[9px] text-slate-400 uppercase font-sans">Tỉ lệ chuyên cần</div>
                <div className="text-sm font-bold text-emerald-600">{attendanceRate}%</div>
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200/60 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-600 animate-pulse" />
              <div className="text-left leading-none">
                <div className="text-[9px] text-emerald-600 uppercase font-sans">Hành vi tốt</div>
                <div className="text-sm font-bold text-emerald-700">+{totalMeritsGroup}</div>
              </div>
            </div>

            <div className="bg-rose-50/50 border border-rose-200/60 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <div className="text-left leading-none">
                <div className="text-[9px] text-rose-600 uppercase font-sans font-semibold">Vi phạm</div>
                <div className="text-sm font-bold text-rose-700">-{totalDemeritsGroup}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main id="scea-workspace" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* TOP STATUS TOAST BANNER */}
        {aiSuccessToast && (
          <div id="scea-toast" className="col-span-12 bg-indigo-950 text-indigo-100 border-l-4 border-indigo-500 p-3.5 rounded-xl shadow-lg flex items-center justify-between gap-3 animate-fade-in transition-all">
            <div className="flex items-center gap-2 text-sm font-sans">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>{aiSuccessToast}</span>
            </div>
            <button onClick={() => setAiSuccessToast(null)} className="text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* COLUMN 1: LEFT SIDEBAR - LEADERBOARD & DIRECTORY (span 4/12) */}
        <section id="scea-student-column" className="lg:col-span-4 flex flex-col gap-4">
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold text-slate-900 text-md flex items-center gap-2">
                👥 Bộ lọc & Danh sách lớp
              </h2>
              <button 
                onClick={handleResetData}
                title="Khôi phục lại dữ liệu mặc định ban đầu"
                className="text-[10px] text-slate-400 hover:text-indigo-600 hover:underline flex items-center gap-1 font-mono uppercase bg-slate-100 px-2 py-0.5 rounded-sm"
              >
                Reset dữ liệu
              </button>
            </div>

            {/* Google Sheets Sync UI */}
            <div className="flex flex-col gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="Dán link Google Sheets (CSV) vào đây..."
                  className="flex-1 px-3 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <button
                  onClick={handleFetchGoogleSheets}
                  disabled={isFetchingSheet}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                >
                  {isFetchingSheet ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  Tải dữ liệu
                </button>
              </div>
              <p className="text-[10px] text-indigo-500/80 font-mono italic">
                * Mẹo: Vào Google Sheets {'->'} Tệp {'->'} Chia sẻ {'->'} Công bố lên web {'->'} Định dạng CSV
              </p>
            </div>

            {/* Live searching for parent educators */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm họ tên học sinh..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50"
              />
            </div>

            {/* Quick Filters */}
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              <button
                onClick={() => setFilterType("all")}
                className={`py-1.5 px-1 rounded-lg ${
                  filterType === "all"
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                TẤT CẢ
              </button>
              <button
                onClick={() => setFilterType("present")}
                className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-0.5 ${
                  filterType === "present"
                    ? "bg-emerald-600 text-white font-bold"
                    : "bg-emerald-55/60 text-emerald-700 hover:bg-emerald-100/70"
                }`}
              >
                Có mặt
              </button>
              <button
                onClick={() => setFilterType("absent")}
                className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-0.5 ${
                  filterType === "absent"
                    ? "bg-slate-800 text-white font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
                }`}
              >
                Vắng
              </button>
              <button
                onClick={() => setFilterType("alert")}
                className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-0.5 ${
                  filterType === "alert"
                    ? "bg-rose-600 text-white font-bold"
                    : "bg-rose-100/75 text-rose-700 hover:bg-rose-200"
                }`}
              >
                ⚠️ Lưu ý
              </button>
            </div>

            {/* Sorting criteria */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500 uppercase font-mono font-semibold">Sắp xếp theo:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="text-xs bg-slate-100 text-slate-700 border-none rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                <option value="points">Thi Đua (Merit)</option>
                <option value="gpa">Học Lực (GPA)</option>
                <option value="attendance">Chuyên Cần</option>
                <option value="name">Tên Bảng Chữ Cái</option>
              </select>
            </div>
          </div>

          {/* Student Leaderboard Feed */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex-1 flex flex-col gap-3 min-h-[400px]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono uppercase text-slate-500 font-bold tracking-wider">
                🏆 Bảng điểm thi đua và chuyên cần
              </h3>
              <span className="text-xs bg-slate-100 px-2 py-0.5 text-slate-500 rounded font-mono">
                {filteredStudents.length} Kết quả
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] pr-1" id="scea-student-list">
              {filteredStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                  <span className="text-3xl">📭</span>
                  <p className="text-xs font-mono mt-2">Không tìm thấy học sinh phù hợp.</p>
                </div>
              ) : (
                filteredStudents.map((stu, index) => {
                  const isSelected = stu.id === selectedStudentId;
                  
                  // Rank icon setup based on sort algorithm
                  let rankIcon = `No.${index + 1}`;
                  if (sortBy === "points" && index === 0) rankIcon = "🥇";
                  if (sortBy === "points" && index === 1) rankIcon = "🥈";
                  if (sortBy === "points" && index === 2) rankIcon = "🥉";

                  return (
                    <div
                      key={stu.id}
                      id={`student-card-${stu.id}`}
                      onClick={() => setSelectedStudentId(stu.id)}
                      className={`group p-3 rounded-xl border transition-all duration-250 cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? "bg-indigo-50/90 border-indigo-300 shadow-xs ring-1 ring-indigo-400"
                          : "bg-white border-slate-150 hover:border-slate-300 hover:bg-slate-50/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Rank Pill */}
                        <span className="text-xs font-mono font-bold text-slate-400 w-6 shrink-0 text-center">
                          {rankIcon}
                        </span>

                        {/* Profile Photo Avatar Frame */}
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black font-display text-white ${
                            stu.isPresentToday 
                              ? "bg-gradient-to-tr from-slate-700 to-indigo-800" 
                              : "bg-slate-400"
                          }`}>
                            {stu.name.split(" ").slice(-1)[0][0]}
                          </div>
                          
                          {/* Attendance Status Dot indicator */}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                            stu.isPresentToday ? "bg-emerald-500" : "bg-slate-400"
                          }`} title={stu.isPresentToday ? "Học sinh có mặt tại lớp" : "Vắng mặt hôm nay"}>
                            {stu.isPresentToday ? (
                              <Check className="w-1.5 h-1.5 text-white" />
                            ) : (
                              <div className="w-1 h-1 bg-white rounded-full" />
                            )}
                          </div>
                        </div>

                        {/* Text and badges info preview */}
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">
                            {stu.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500 font-mono">
                              GPA {stu.gpa.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-xs font-mono text-emerald-600 font-medium select-none">
                              {stu.attendance}% CC
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Display points badge pill & interaction */}
                      <div className="flex flex-col items-end shrink-0">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/70 px-2 py-1 rounded-lg">
                          <Award className={`w-3.5 h-3.5 text-amber-500`} />
                          <span className="text-xs font-mono font-bold text-slate-800">
                            {stu.points}đ
                          </span>
                        </div>
                        {/* Instant add quick points triggers to make manual grading faster */}
                        <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentId(stu.id);
                              addLogEntry("merit", "Hành động tích cực nhanh", 10, "Khen thưởng nhanh trực tiếp ngoài bảng điều khiển");
                            }}
                            className="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white p-1 rounded-sm text-[10px] font-bold"
                            title="Tặng nhanh 10đ thi đua"
                          >
                            +10
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentId(stu.id);
                              addLogEntry("demerit", "Lưu ý nhanh", 10, "Đánh dấu vi phạm nhanh trực tiếp ngoài bảng điều khiển");
                            }}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white p-1 rounded-sm text-[10px] font-bold"
                            title="Trừ nhanh 10đ thi đua"
                          >
                            -10
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* General Class Evaluator Trigger */}
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
              <button
                onClick={() => runSceaDiagnostic("class_evaluation")}
                disabled={isAiLoading}
                className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white py-2.5 px-4 rounded-xl text-xs font-mono font-bold tracking-tight flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                ĐÁNH GIÁ TIẾT HỌC LỚP CHUNG (AI)
              </button>
              <button
                onClick={() => generateWeeklyHonorSlide(students)}
                className="w-full bg-amber-500 border border-amber-600 hover:bg-amber-600 text-white py-2.5 px-4 rounded-xl text-xs font-mono font-bold tracking-tight flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Award className="w-4 h-4 shrink-0" />
                XUẤT SLIDE VINH DANH (PPTX)
              </button>
            </div>
          </div>
        </section>

        {/* COLUMN 2: CENTER WORKSPACE - INDIVIDUAL DIAGNOSTICS & CONTROLS (span 5/12) */}
        <section id="scea-profile-column" className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Active Student Detail Information */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4 relative">
            
            {/* Background geometric design accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent rounded-tr-2xl pointer-events-none" />

            {/* Profile detail heading */}
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-14 h-14 bg-indigo-600 text-white font-extrabold text-xl rounded-2xl flex items-center justify-center shadow-md">
                  {selectedStudent.name.split(" ").slice(-1)[0][0]}
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-900">
                    {selectedStudent.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    ID hồ sơ: {selectedStudent.id}
                  </p>
                  {/* Presence indicator with action toggle */}
                  <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-bold mt-1.5 px-2.5 py-0.5 rounded-full ${
                    selectedStudent.isPresentToday 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedStudent.isPresentToday ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {selectedStudent.isPresentToday ? "Đang có mặt ở lớp" : "Đang vắng học"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {/* simulated FaceID Attendance trigger button */}
                <button
                  onClick={() => triggerFaceID(selectedStudent.id)}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 font-medium shadow-xs"
                  title="Bấm để chụp & điểm danh sinh trắc học FaceID tự động"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  FaceID Điểm danh
                </button>
                <button
                  onClick={() => generateStudentReport(selectedStudent)}
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 font-medium shadow-xs"
                  title="Xuất phiếu liên lạc của học sinh này ra file Word"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Phiếu Liên Lạc (DOCX)
                </button>
              </div>
            </div>

            {/* Student Scores & Statistics cards */}
            <div className="grid grid-cols-3 gap-3 text-center border-y border-slate-100 py-3 mt-1">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Học Lực (GPA)</div>
                <div className="text-lg font-bold text-slate-900 mt-1">{selectedStudent.gpa}/10</div>
                <span className="text-[10px] px-1.5 py-0.5 font-mono font-bold bg-slate-100 rounded text-slate-600 block mt-1 w-max mx-auto">
                  {selectedStudent.gpa >= 9.0 ? "Xuất sắc" : selectedStudent.gpa >= 8.0 ? "Giỏi" : "Khá / TB"}
                </span>
              </div>
              
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Điểm Thi đua</div>
                <div className="text-lg font-bold text-amber-600 mt-1">{selectedStudent.points}đ</div>
                <span className="text-[10px] px-1.5 py-0.5 font-mono bg-amber-50 rounded text-amber-700 block mt-1 w-max mx-auto border border-amber-200/50">
                  Hạng {students.filter(s => s.points > selectedStudent.points).length + 1} lớp
                </span>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Điểm danh ngày</div>
                <div className="text-lg font-bold text-emerald-600 mt-1">{selectedStudent.attendance}%</div>
                <span className={`text-[10px] px-1.5 py-0.5 font-mono rounded block mt-1 w-max mx-auto ${
                  selectedStudent.attendance >= 95 ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
                }`}>
                  {selectedStudent.attendance >= 95 ? "Tối ưu" : "Cần cải thiện"}
                </span>
              </div>
            </div>

            {/* Badges Earned Container with badge awards view */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-extrabold uppercase text-slate-400">
                  🏅 Huy hiệu khen thưởng đang có:
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedStudent.badges.length} Vật phẩm
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                {selectedStudent.badges.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Chưa đạt được danh hiệu học đường nào. Hãy cộng điểm Merit để đạt giải thưởng!</span>
                ) : (
                  selectedStudent.badges.map((badgeId) => {
                    const badgeObj = BADGES.find((b) => b.id === badgeId);
                    if (!badgeObj) return null;
                    return (
                      <div
                        key={badgeId}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-white bg-gradient-to-tr ${badgeObj.color} shadow-sm group relative`}
                      >
                        <span>{badgeObj.icon}</span>
                        <span>{badgeObj.name}</span>
                        
                        {/* Remove badge interactive button */}
                        <button
                          onClick={() => toggleBadge(badgeId)}
                          className="ml-1 text-white/70 hover:text-white focus:outline-none text-[10px]"
                          title="Tịch thu hoặc bỏ chọn huy hiệu này"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Badges Directory for instant awarding */}
            <div className="bg-slate-50 border border-slate-250 p-3 rounded-xl">
              <span className="text-[10px] font-mono tracking-wider font-extrabold uppercase text-slate-500 block mb-2">
                Danh tuyển Huy Hiệu trường học (Bấm để tặng):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {BADGES.map((badge) => {
                  const hasBadge = selectedStudent.badges.includes(badge.id);
                  return (
                    <button
                      key={badge.id}
                      onClick={() => toggleBadge(badge.id)}
                      className={`text-[10.5px] px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-all ${
                        hasBadge
                          ? "bg-indigo-600 text-white font-bold"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                      title={badge.description}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Speech to text simulated note recorder */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Mic className={`w-4 h-4 ${isRecording ? "text-rose-400 animate-ping" : "text-indigo-400"}`} />
                  <span className="text-xs font-mono font-bold tracking-tight text-slate-300">
                    Speech-to-Text Microphone Simulator
                  </span>
                </div>
                {isRecording && (
                  <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded animate-pulse">
                    Đang ghi: {recordingSeconds}s
                  </span>
                )}
              </div>

              {/* Recording visual glowing animated sound waves when recording is active */}
              {isRecording ? (
                <div className="h-4 flex items-center justify-center gap-1 my-2">
                  <span className="w-1 h-3 bg-indigo-400 rounded-full animate-bounce delay-75" />
                  <span className="w-1 h-4 bg-indigo-300 rounded-full animate-bounce" />
                  <span className="w-1 h-2 bg-indigo-500 rounded-full animate-bounce delay-150" />
                  <span className="w-1 h-3 bg-indigo-300 rounded-full animate-bounce delay-100" />
                  <span className="w-1 h-4 bg-indigo-400 rounded-full animate-bounce" />
                </div>
              ) : (
                <div className="text-[11px] text-slate-330 italic text-slate-300">
                  Ghi chú nhanh giọng nói của Giáo viên: Trí tuệ nhân AI sẽ diễn giải ý nghĩa và chắt lọc điểm khen thưởng.
                </div>
              )}

              {/* Voice output string field */}
              <textarea
                value={selectedStudent.voiceNotes}
                onChange={(e) => updateVoiceNotesForStudent(selectedStudent.id, e.target.value)}
                placeholder="Nhấn nút Micro thu âm mô phỏng lời giáo viên nói, hoặc điền văn bản ghi chú tại đây..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 h-16 resize-none"
              />

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold font-mono flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                    isRecording
                      ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {isRecording ? "DỪNG & TRUNG CHUYỂN" : "🎙️ BẬT THIẾT BỊ THU ÂM MÔ PHỎNG"}
                </button>
              </div>
            </div>

          </div>

          {/* Behavior scoring presets block */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-1">
              📝 Đánh giá Thi Đua nhanh trong tiết học
            </h3>

            {/* Quick Presets for merit */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-extrabold uppercase text-emerald-600 flex items-center gap-1">
                🟢 Merit Presets (Thành tích cộng điểm)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {BEHAVIOR_PRESETS.merit.map((preset) => (
                  <button
                    key={preset.category}
                    onClick={() => addLogEntry("merit", preset.category, preset.points, "Hệ thống ghi điểm chuẩn")}
                    className="text-left text-xs bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200/50 p-2 rounded-xl text-emerald-800 transition-colors flex items-start gap-1 justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{preset.category}</div>
                      <div className="text-[9px] text-emerald-600 truncate">{preset.description}</div>
                    </div>
                    <span className="bg-emerald-600 text-white px-1 py-0.5 rounded-md font-mono font-bold text-[10px] shrink-0">
                      +{preset.points}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Presets for demerits */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
              <span className="text-[10px] font-mono font-extrabold uppercase text-rose-600 flex items-center gap-1">
                🔴 Demerit Presets (Lỗi vi phạm trừ điểm)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {BEHAVIOR_PRESETS.demerit.map((preset) => (
                  <button
                    key={preset.category}
                    onClick={() => addLogEntry("demerit", preset.category, preset.points, "Nhận diện vi phạm kỷ luật")}
                    className="text-left text-xs bg-rose-50/60 hover:bg-rose-100/80 border border-rose-200/50 p-2 rounded-xl text-rose-800 transition-colors flex items-start gap-1 justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{preset.category}</div>
                      <div className="text-[9px] text-rose-600 truncate">{preset.description}</div>
                    </div>
                    <span className="bg-rose-600 text-white px-1 py-0.5 rounded-md font-mono font-bold text-[10px] shrink-0">
                      -{preset.points}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom activity report form */}
            <form onSubmit={handleCustomLogSubmit} className="border-t border-slate-100 pt-3 flex flex-col gap-2">
              <span className="text-[10px] font-mono tracking-wider font-extrabold uppercase text-slate-500">
                Tạo hoạt động ghi nhận đặc thù:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[9px] font-mono uppercase text-slate-400">Loại thi đua</label>
                  <select
                    value={customLogType}
                    onChange={(e: any) => setCustomLogType(e.target.value)}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="merit">Merit (Khen thưởng)</option>
                    <option value="demerit">Demerit (Kỷ luật)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono uppercase text-slate-400 font-bold">Mức Điểm</label>
                  <input
                    type="number"
                    value={customLogPoints}
                    onChange={(e) => setCustomLogPoints(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400">Đầu mục hoạt động</label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Hùng biện tiếng Anh, Lau bảng, v.v..."
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-1">
                <input
                  type="text"
                  value={customLogNote}
                  onChange={(e) => setCustomLogNote(e.target.value)}
                  placeholder="Chi tiết hành động (VD: Hăng hái lau dọn bàn ghế)..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 rounded-lg flex items-center justify-center font-bold"
                >
                  Ghi sổ
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* COLUMN 3: RIGHT SIDEBAR - AI ANALYSIS OUTPUT & TIMELINES (span 4/12) */}
        <section id="scea-analysis-column" className="lg:col-span-4 flex flex-col gap-4">
          
          {/* AI Cognitive Engine Block */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4 flex-1">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-ping" />
                <h3 className="font-display font-extrabold text-slate-900 text-md flex items-center gap-1">
                  🧠 Phân tích AI Giáo dục (Gemini-3.5)
                </h3>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-50 text-amber-700 font-bold border border-amber-200/50 rounded uppercase">
                Offline + Cloud
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Nhận diện sớm các dấu hiệu sa sút từ việc liên kết lịch sử hành vi của học sinh <span className="font-semibold text-slate-800">[{selectedStudent.name}]</span> và nhận xét có ích cho Phụ huynh.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => runSceaDiagnostic("student_diagnostics")}
                disabled={isAiLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1 shadow-sm transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                CHẨN ĐOÁN AI CA NHÂN
              </button>

              <button
                onClick={() => runSceaDiagnostic("class_evaluation")}
                disabled={isAiLoading}
                className="bg-slate-900 hover:bg-slate-800 text-slate-100 py-2 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                ĐÁNH GIÁ CHUNG LỚP
              </button>
            </div>

            {/* Interactive display area for diagnostics result */}
            <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl p-3 max-h-[460px] overflow-y-auto font-sans text-xs relative">
              {isAiLoading ? (
                <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4">
                  <div className="relative mb-4">
                    <div className="w-14 h-14 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                    <Sparkles className="w-6 h-6 text-amber-500 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <p className="text-xs font-mono text-indigo-700 uppercase font-black tracking-wider animate-pulse">
                    {aiStage}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                    Gemini AI đang tổng hợp các bản ghi Speech-to-Text và Merit/Demerit...
                  </p>
                </div>
              ) : aiResponse ? (
                <div className="space-y-3 prose prose-slate max-w-none text-[11px] leading-relaxed">
                  
                  {/* Real visual layout container mapping SCEA response structures cleanly */}
                  <div className="bg-white border border-slate-200/60 p-3 rounded-lg shadow-2xs">
                    <div className="flex items-center gap-1.5 text-indigo-700 font-mono font-extrabold uppercase text-[10px] mb-1.5 border-b border-indigo-50 pb-1">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      Nhận định sinh kế sinh thái SCEA
                    </div>
                    {/* Render raw markdown from response efficiently */}
                    <div className="whitespace-pre-wrap text-slate-800 text-xs">
                      {aiResponse}
                    </div>
                  </div>

                  {/* Actions buttons dynamically mapped after AI is populated */}
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => showToast(`✉️ Đã sao chép & Gửi tin nhắn nhận xét tinh tế cho phụ huynh học sinh!`)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10.5px] py-1.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm uppercase"
                    >
                      <Send className="w-3 h-3" />
                      Gửi tin nhận xét cho Phụ Huynh
                    </button>
                    
                    <button
                      onClick={() => {
                        const timeStr = new Date().toLocaleTimeString("vi-VN");
                        setSyncHistory((prev) => [`${timeStr} - 📊 Đã chụp lưu trữ chẩn đoán giáo sư AI vào sổ cái bảo mật LMS.`, ...prev]);
                        showToast(`📊 Đã liên kết & lưu trữ dữ liệu SCEA thành công!`);
                      }}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-mono text-[9px] py-1 px-2 rounded-lg flex items-center justify-center gap-1 uppercase"
                    >
                      <ShieldCheck className="w-3 h-3 text-slate-500" />
                      Đồng kiểm bảo mật & Lưu trữ trực tuyến
                    </button>
                  </div>

                </div>
              ) : (
                <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-slate-400 py-10 text-center px-4">
                  <Sparkles className="w-10 h-10 text-indigo-300 animate-pulse mb-3" />
                  <p className="font-semibold text-xs text-slate-800">Chưa có kết quả chẩn đoán lý thuyết AI</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
                    Hãy chọn một học sinh và nhấn nút "CHẨN ĐOÁN AI CA NHÂN" hoặc phỏng vấn tiết học chung để chắt lọc dự báo nề nếp.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* SCEA School Logs & Live sync timeline widget */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-extrabold uppercase text-slate-500 flex items-center gap-1">
                ☁️ Nhật ký đồng bộ LMS nội bộ & API
              </span>
              <button
                onClick={triggerLmsSync}
                disabled={isSyncing}
                className={`p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 ${isSyncing ? "animate-spin" : ""}`}
                title="Yêu cầu đồng bộ dữ liệu thủ công về Cơ sở dữ liệu trường"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[10.5px] bg-slate-950 text-slate-200 font-mono p-3 rounded-lg h-36 overflow-y-auto space-y-1.5 text-left">
              {isSyncing ? (
                <div className="text-indigo-400 animate-pulse text-xs">☁️ Đang liên kết mạng EduNet Sở Giáo Dục & Đào tạo...</div>
              ) : (
                syncHistory.map((historyNote, i) => (
                  <div key={i} className="border-b border-slate-800 pb-1.5 last:border-0 italic text-slate-300">
                    {historyNote}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Trạng thái: ĐÃ GHI NHẬN</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>SSL BẢO MẬT 256-BIT</span>
              </div>
            </div>
          </div>

          {/* Student Activity History logs feed */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2 max-h-[220px] overflow-y-auto">
            <span className="text-[10.5px] font-mono font-extrabold uppercase text-slate-400 block pb-1 border-b border-slate-100">
              📜 Nhật ký hành vi của [{selectedStudent.name}]:
            </span>
            <div className="space-y-2">
              {selectedStudent.logs.length === 0 ? (
                <div className="text-xs text-slate-400 italic">Chưa có hành vi nào được ghi nhận trong ca học hôm nay.</div>
              ) : (
                selectedStudent.logs.map((log) => (
                  <div key={log.id} className="flex justify-between items-start text-xs border-b border-slate-100 pb-1.5 last:border-0">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${log.type === "merit" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="font-bold text-slate-800">{log.category}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5">
                        “{log.note || "Hành động tiêu chuẩn."}”
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-bold text-[10.5px] ${log.type === "merit" ? "text-emerald-600" : "text-rose-600"}`}>
                        {log.type === "merit" ? `+${log.points}đ` : `-${log.points}đ`}
                      </span>
                      <div className="text-[8px] text-slate-400 font-mono mt-0.5">{log.timestamp}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

        {/* FULL WIDTH WORKSPACE - ANALYTICS */}
        <section id="scea-analytics-column" className="lg:col-span-12 flex flex-col gap-4">
           <AnalyticsDashboard students={students} />
        </section>

      </main>

      {/* Styled Footer Frame */}
      <footer id="scea-footer" className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Mã hóa bảo mật thông tin học bạ & dữ liệu thi đua theo nghị định học đường</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Smart Classroom Ecosystem Architect • Bản Quyền Google AI Studio © 2026
          </div>
        </div>
      </footer>

      {/* AI Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Cài đặt AI & API Key
              </h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* API Key Input */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">
                  Google Gemini API Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                />
                <p className="text-xs text-slate-500">
                  Lấy API key miễn phí tại: <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">aistudio.google.com/api-keys</a>
                </p>
              </div>

              {/* Model Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">
                  Chọn Model AI (Ưu tiên)
                </label>
                
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", badge: "Default", desc: "Nhanh, hiệu quả cao cho tác vụ giáo dục" },
                    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", badge: "Advanced", desc: "Mô hình lập luận sâu, phân tích phức tạp" },
                    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", badge: "Legacy", desc: "Phiên bản cũ, siêu nhanh" }
                  ].map((model) => (
                    <div 
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`cursor-pointer rounded-xl border p-3 flex items-center justify-between transition-colors ${
                        selectedModel === model.id 
                          ? "border-indigo-600 bg-indigo-50/50" 
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${selectedModel === model.id ? "text-indigo-900" : "text-slate-700"}`}>
                            {model.name}
                          </span>
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${
                            model.badge === "Default" ? "bg-emerald-100 text-emerald-700" : 
                            model.badge === "Advanced" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {model.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{model.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedModel === model.id ? "border-indigo-600" : "border-slate-300"
                      }`}>
                        {selectedModel === model.id && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => {
                  localStorage.setItem("scea_api_key", geminiApiKey);
                  localStorage.setItem("scea_ai_model", selectedModel);
                  setIsSettingsOpen(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
