import { Student, Badge } from "./types";

export const INITIAL_STUDENTS: Student[] = [
  {
    id: "stu_1",
    name: "Nguyễn Minh Hùng",
    gpa: 9.2,
    points: 140,
    meritCount: 16,
    demeritCount: 2,
    attendance: 98,
    isPresentToday: true,
    voiceNotes: "Hùng giải toán rất nhanh, sáng tạo nhưng đôi khi phấn khích quá mức nói leo trong giờ.",
    logs: [
      {
        id: "l_1",
        type: "merit",
        category: "Phát biểu xây dựng bài",
        points: 10,
        timestamp: "08:15 AM - Hôm nay",
        note: "Giải bài toán khó về đồ thị"
      },
      {
        id: "l_2",
        type: "demerit",
        category: "Nói chuyện riêng",
        points: 10,
        timestamp: "09:30 AM - Hôm nay",
        note: "Nói leo trong bài thuyết trình của bạn"
      }
    ],
    badges: ["toán_vuong_gia", "ngoi_sao_chuyen_can"]
  },
  {
    id: "stu_2",
    name: "Trần Thị Mai An",
    gpa: 9.6,
    points: 190,
    meritCount: 19,
    demeritCount: 0,
    attendance: 100,
    isPresentToday: true,
    voiceNotes: "Mai An cực kỳ tập trung, trầm tính, làm bài tập về nhà rất chỉnh chu. Tiềm năng lãnh đạo tốt.",
    logs: [
      {
        id: "l_3",
        type: "merit",
        category: "Làm bài tập đầy đủ",
        points: 15,
        timestamp: "08:00 AM - Hôm nay",
        note: "Chuẩn bị bài viết luận tiếng Anh xuất sắc"
      },
      {
        id: "l_4",
        type: "merit",
        category: "Hỗ trợ giúp đỡ bạn học",
        points: 10,
        timestamp: "10:15 AM - Hôm nay",
        note: "Giảng lại bài lý thuyết cho Tuấn Anh"
      }
    ],
    badges: ["ngoi_sao_chuyen_can", "chuyen_gia_ho_tro"]
  },
  {
    id: "stu_3",
    name: "Phạm Tuấn Anh",
    gpa: 6.5,
    points: 50,
    meritCount: 7,
    demeritCount: 2,
    attendance: 90,
    isPresentToday: true,
    voiceNotes: "Tuấn Anh vẽ rất đẹp, tư duy không gian tốt nhưng gần đây hay xao nhãng môn Toán và quên làm bài tập Toán.",
    logs: [
      {
        id: "l_5",
        type: "demerit",
        category: "Thiếu bài tập về nhà",
        points: 15,
        timestamp: "08:05 AM - Hôm nay",
        note: "Quên tập vở soạn toán lượng giác"
      },
      {
        id: "l_6",
        type: "merit",
        category: "Tham gia tích cực hoạt động nhóm",
        points: 10,
        timestamp: "11:00 AM - Hôm nay",
        note: "Thiết kế poster sơ đồ tư duy cho nhóm 2 rất đẹp"
      }
    ],
    badges: ["nha_sang_tao_tre"]
  },
  {
    id: "stu_4",
    name: "Lê Hoàng Nam",
    gpa: 7.8,
    points: 150,
    meritCount: 16,
    demeritCount: 1,
    attendance: 95,
    isPresentToday: false,
    voiceNotes: "Hoàng Nam là lớp phó lao động rất gương mẫu, hay giúp bạn nhưng hôm nay xin phép nghỉ do bị sốt nhẹ.",
    logs: [
      {
        id: "l_7",
        type: "merit",
        category: "Ý thức giữ gìn vệ sinh chung",
        points: 10,
        timestamp: "Chiều qua",
        note: "Chủ động sắp xếp lại bàn ghế ngăn nắp sau giờ học"
      }
    ],
    badges: ["chuyen_gia_ho_tro", "hiep_si_nhan_nai"]
  },
  {
    id: "stu_5",
    name: "Vũ Thùy Chi",
    gpa: 8.4,
    points: 110,
    meritCount: 12,
    demeritCount: 1,
    attendance: 96,
    isPresentToday: true,
    voiceNotes: "Chi nói trước công chúng tự tin, có khiếu hùng biện giỏi, nhưng đôi khi rụt rè trước các vấn đề lý thuyết khó.",
    logs: [
      {
        id: "l_8",
        type: "merit",
        category: "Phát biểu xây dựng bài",
        points: 10,
        timestamp: "10:45 AM - Hôm nay",
        note: "Phát biểu mạch lạc tóm tắt tác phẩm Văn học"
      }
    ],
    badges: ["nha_sang_tao_tre"]
  }
];

export const BEHAVIOR_PRESETS = {
  merit: [
    { category: "Phát biểu xây dựng bài", points: 10, description: "Cá nhân tự tin đóng góp thảo luận chất lượng" },
    { category: "Hỗ trợ giúp đỡ bạn học", points: 10, description: "Giảng bài hoặc giúp bạn cùng tiến bộ" },
    { category: "Làm bài tập đầy đủ", points: 15, description: "Hoàn thiện 100% bài chuẩn bị trước giờ học" },
    { category: "Tham gia tích cực hoạt động nhóm", points: 10, description: "Tính hợp tác cao và điều phối nhóm hiệu quả" },
    { category: "Ý thức giữ gìn vệ sinh chung", points: 10, description: "Nhặt rác, xếp bàn ghế, đóng góp không gian chung" }
  ],
  demerit: [
    { category: "Nói chuyện riêng", points: 10, description: "Gây ồn ào ảnh hưởng tập trung của tập thể" },
    { category: "Thiếu bài tập về nhà", points: 15, description: "Không làm hoặc thiếu vở ghi chú yêu cầu" },
    { category: "Sử dụng thiết bị ngoài giờ học", points: 10, description: "Xem điện thoại hay máy tính ngoài bài học" },
    { category: "Đi học muộn", points: 10, description: "Vào lớp trễ hơn giờ quy định" },
    { category: "Thiếu hợp tác nhóm", points: 10, description: "Lười biếng, đùn đẩy công việc cho thành viên khác" }
  ]
};

export const BADGES: Badge[] = [
  {
    id: "toán_vuong_gia",
    name: "Toán Học Vương Giả",
    description: "Tích cực giải các bài toán nâng cao và có tư duy logic sắc bén.",
    icon: "🧮",
    color: "from-blue-500 to-indigo-600"
  },
  {
    id: "hiep_si_nhan_nai",
    name: "Hiệp Sĩ Nhẫn Nại",
    description: "Duy trì kỷ luật tối ưu, kiên trì tự khắc phục khuyết điểm bứt phá.",
    icon: "🛡️",
    color: "from-amber-500 to-orange-600"
  },
  {
    id: "chuyen_gia_ho_tro",
    name: "Chuyên Gia Hỗ Trợ",
    description: "Đại sứ kết nối, nhiệt tình đồng hành chia sẻ kiến thức cùng bạn học.",
    icon: "🤝",
    color: "from-emerald-500 to-teal-600"
  },
  {
    id: "ngoi_sao_chuyen_can",
    name: "Ngôi Sao Chuyên Cần",
    description: "Hiện diện 100% thời gian, luôn chủ động chuẩn bị bài học sớm nhất.",
    icon: "⭐",
    color: "from-yellow-400 to-amber-500"
  },
  {
    id: "nha_sang_tao_tre",
    name: "Nhà Sáng Tạo Trẻ",
    description: "Nảy sinh nhiều ý tưởng nghệ thuật, đồ họa hoặc sáng kiến độc đáo.",
    icon: "💡",
    color: "from-purple-500 to-pink-600"
  }
];
