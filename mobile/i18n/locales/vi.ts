const vi = {
  // Tab labels
  tabs: {
    home: 'Trang chủ',
    library: 'Thư viện',
    insights: 'Thống kê',
    chat: 'Hỏi AI',
    profile: 'Cá nhân',
    capture: 'Lưu',
  },

  // Profile screen
  profile: {
    title: 'Cá nhân',
    subtitle: 'Quản lý cài đặt của bạn',

    // Recall toggle
    recall: {
      label: 'Cho phép nhắc lại khi phù hợp',
      description: 'Chỉ xuất hiện khi thực sự có lý do',
      info: 'Ứng dụng sẽ phân tích những gì bạn lưu và chỉ gợi ý lại khi có sự kiện liên quan (ví dụ: bạn lưu nhiều thứ cùng chủ đề, hoặc bạn hỏi về điều từng lưu).',
    },

    // Menu items
    menu: {
      account: {
        title: 'Tài khoản',
        subtitle: 'Email, mật khẩu, xóa tài khoản',
      },
      privacy: {
        title: 'Quyền riêng tư',
        subtitle: 'Dữ liệu của bạn luôn được bảo mật',
      },
      about: {
        title: 'Giới thiệu',
        subtitle: 'Phiên bản, điều khoản, liên hệ',
      },
    },

    dismissed: 'Đã bỏ qua',
    tagline: 'Ở đây để giúp bạn\nkhông quên những điều quan trọng',

    // AI feature toggles
    autoCategory: {
      label: 'Tự động phân loại',
      description: 'Tự động sắp xếp ký ức vào các danh mục',
    },
    autoSummarize: {
      label: 'Tự động tóm tắt',
      description: 'Tạo tóm tắt AI cho các ký ức mới',
    },
    streamingResponses: {
      label: 'Phản hồi theo luồng',
      description: 'Hiển thị câu trả lời AI từng từ khi được tạo',
    },
  },

  // Account modal
  account: {
    title: 'Tài khoản',
    email: 'Email',
    changeEmail: 'Đổi email',
    password: 'Mật khẩu',
    changePassword: 'Đổi mật khẩu',
    signOut: 'Đăng xuất',
    deleteWarning:
      '⚠️ Xóa tài khoản sẽ xóa vĩnh viễn toàn bộ dữ liệu của bạn. Hành động này không thể hoàn tác.',
    deleteAccount: 'Xóa tài khoản vĩnh viễn',
  },

  // Privacy modal
  privacy: {
    title: 'Quyền riêng tư',
    dataProtected: 'Dữ liệu của bạn được bảo vệ',
    dataProtectedDesc:
      'Tất cả nội dung bạn lưu được mã hóa đầu-cuối. Chỉ bạn mới có thể truy cập dữ liệu của mình.',
    dataStorage: 'Lưu trữ dữ liệu',
    storagePoint1: 'Dữ liệu được lưu trữ an toàn trên máy chủ đám mây với mã hóa AES-256',
    storagePoint2:
      'AI chỉ xử lý dữ liệu khi cần thiết và không lưu trữ lịch sử phân tích',
    storagePoint3: 'Bạn có thể tải xuống hoặc xóa toàn bộ dữ liệu bất cứ lúc nào',
    downloadData: 'Tải xuống dữ liệu của bạn',
    privacyPolicy: 'Chính sách bảo mật',
    deleteDataWarning:
      '⚠️ Xóa toàn bộ dữ liệu sẽ xóa vĩnh viễn mọi nội dung bạn đã lưu. Tài khoản vẫn được giữ lại.',
    deleteAllData: 'Xóa toàn bộ dữ liệu',
  },

  // About modal
  about: {
    title: 'Giới thiệu',
    version: 'Phiên bản 1.0.0',
    description:
      'Trợ lý AI giúp bạn lưu trữ và kết nối những gì quan trọng, theo triết lý "Lưu giữ là trọng tâm. Quên là bình thường."',
    philosophy: 'Triết lý',
    philosophyPoint1: 'Lưu giữ là trọng tâm. Bất cứ điều gì bạn thấy quan trọng.',
    philosophyPoint2: 'Quên là bình thường. Ứng dụng sẽ nhớ giúp bạn.',
    philosophyPoint3: 'Gợi ý xuất hiện khi có lý do. Không áp lực.',
    terms: 'Điều khoản sử dụng',
    privacyPolicy: 'Chính sách bảo mật',
    contactSupport: 'Liên hệ hỗ trợ',
    credits: 'Được xây dựng với ❤️\n© 2025 AI Living Memory',
  },

  // Home screen
  home: {
    greetingMorning: 'Chào buổi sáng',
    greetingAfternoon: 'Chào buổi chiều',
    greetingEvening: 'Chào buổi tối',
    subtitle: 'Đây là những điều bạn có thể muốn nhớ lại',
    noMemories: 'Chưa có gì để nhắc lại',
    noMemoriesSubtitle: 'Bắt đầu lưu suy nghĩ và ứng dụng sẽ nhắc lại khi phù hợp',
    createFirst: 'Tạo ký ức đầu tiên',
    recallReason: 'Lý do nhắc lại',
    statsTotal: 'Tổng',
    statsWeek: 'Tuần này',
    statsToday: 'Hôm nay',
    unreviewed: 'Cần chú ý',
    unreviewedHint: 'Chưa mở',
    recentRecall: 'Dành cho bạn',
    revisit: 'Nên xem lại',
    onThisDay: 'Ngày này',
    groupUncategorized: 'Khác',
    // New home page strings
    streak: 'Chuỗi {{count}} ngày',
    streakStart: 'Bắt đầu chuỗi ngày!',
    captureText: 'Văn bản',
    captureVoice: 'Giọng nói',
    captureLink: 'Liên kết',
    capturePhoto: 'Ảnh',
    quickCapture: 'Lưu nhanh',
    seeAll: 'Xem tất cả',
    focusTitle: 'Hôm nay nên làm gì',
    focusUnreviewed: 'Bạn có {{count}} ký ức chưa xem. Dành chút thời gian để xem lại và giữ ý tưởng tươi mới.',
    focusRevisit: 'Khám phá lại {{count}} ký ức từ trước. Chúng có thể gợi lên điều gì mới hôm nay.',
    focusStreak: 'Chuỗi {{count}} ngày liên tiếp! Giữ nhịp — hãy lưu điều gì đó ý nghĩa hôm nay.',
    focusKeepGoing: 'Lưu một suy nghĩ hôm nay để bắt đầu xây dựng chuỗi ngày.',
    focusGreat: 'Ngày tuyệt vời! Bạn đã lưu {{count}} ký ức hôm nay.',
    connectedIdeas: 'Ý tưởng liên quan',
    viewMemory: 'Xem',
    memoriesCount: '{{count}} ký ức',
  },

  // Library screen
  library: {
    title: 'Thư viện',
    searchPlaceholder: 'Tìm kiếm ký ức…',
    filterAll: 'Tất cả',
    allCategories: 'Tất cả danh mục',
    loading: 'Đang tải…',
    empty: 'Không tìm thấy ký ức nào',
    clearSearch: 'Xóa tìm kiếm',
  },

  // System category names (used in library, memory badges)
  categories: {
    Work: 'Công việc',
    Personal: 'Cá nhân',
    Ideas: 'Ý tưởng',
    Tasks: 'Nhiệm vụ',
    Research: 'Nghiên cứu',
    Entertainment: 'Giải trí',
    Health: 'Sức khỏe',
    Finance: 'Tài chính',
    Travel: 'Du lịch',
    Recipes: 'Công thức nấu ăn',
  },

  // Memory detail
  memory: {
    aiSummary: 'Tóm tắt AI',
    aiDescription: 'Mô tả AI',
    yourNote: 'Ghi chú của bạn',
    original: 'Bản gốc',
    generateSummary: 'Tạo tóm tắt AI',
    generatingSummary: 'Đang tạo…',
    summaryFailed: 'Không thể tạo tóm tắt',
    playAudio: 'Phát',
    pauseAudio: 'Dừng',
    noAudio: 'Không có âm thanh',
    created: 'Đã tạo',
    edit: 'Sửa',
    share: 'Chia sẻ',
    delete: 'Xóa',
    deleteTitle: 'Xóa ký ức',
    deleteMessage: 'Bạn có chắc muốn xóa ký ức này? Hành động này không thể hoàn tác.',
    transcription: 'Bản ghi âm',
    copied: 'Đã sao chép vào bộ nhớ tạm',
    editTitle: 'Sửa ký ức',
    savingEdit: 'Đang lưu…',
    saveEdit: 'Lưu',
    noAudioAlert: 'Không có âm thanh',
    noAudioMessage: 'Ghi âm này không có tệp âm thanh đính kèm.',
    playbackError: 'Lỗi phát lại',
    playbackErrorMessage: 'Không thể phát âm thanh. Vui lòng thử lại.',
    notFound: 'Không tìm thấy ký ức.',
    goBack: 'Quay lại',
    saveFailed: 'Không thể lưu thay đổi. Vui lòng thử lại.',
    copy: 'Sao chép',
    dismiss: 'Bỏ qua',
    openLink: 'Mở ↗',
    viaApp: '— qua Memory AI',
    contentPlaceholder: 'Nội dung ký ức…',
    typeText: 'Văn bản',
    typeVoice: 'Giọng nói',
    typeLink: 'Liên kết',
    typePhoto: 'Ảnh',
    relatedMemories: 'Ký ức liên quan',
    match: 'trùng khớp',
  },

  // Capture screen
  capture: {
    title: 'Ký ức mới',
    cancel: 'Hủy',
    save: 'Lưu',
    saving: 'Đang lưu…',
    modeText: 'Văn bản',
    modeVoice: 'Giọng nói',
    modeLink: 'Liên kết',
    modePhoto: 'Hình ảnh',
    modeTextDesc: 'Ghi chú, ý tưởng',
    modeVoiceDesc: 'Ghi âm & phiên dịch',
    modeLinkDesc: 'Lưu URL',
    modePhotoDesc: 'Tải lên & mô tả',
    textPlaceholder: 'Bạn đang nghĩ gì?',
    linkPlaceholder: 'Dán URL vào đây…',
    linkError: 'Vui lòng nhập URL hợp lệ bắt đầu bằng http:// hoặc https://',
    tapToRecord: 'Nhấn để bắt đầu ghi âm',
    recording: 'Đang ghi âm…',
    processingAudio: 'Đang xử lý âm thanh…',
    transcriptionReady: 'Bản ghi âm sẵn sàng ✓',
    recordingSaved: 'Ghi âm đã lưu ✓',
    tapToStop: 'Nhấn lại để dừng',
    clipboardDetected: 'Phát hiện URL trong bộ nhớ tạm',
    quickSave: 'Lưu liên kết',
    useLink: 'Dán',
    linkSaved: 'Đã lưu liên kết!',
    permissionRequired: 'Cần cấp quyền',
    microphonePermission: 'Cần quyền truy cập micro để ghi âm.',
    photoLibraryPermission: 'Cần quyền truy cập thư viện ảnh để tải lên hình ảnh.',
    chooseImage: 'Chọn hình ảnh',
    chooseImageSub: 'Chọn một ảnh từ thư viện của bạn',
    analyzingImage: 'AI đang phân tích hình ảnh…',
    imageAnalysis: 'Phân tích AI',
    imageAnalysisFailed: 'Hình ảnh đã lưu — phân tích AI không khả dụng',
    imageNote: 'Ký ức hình ảnh',
    photoNotePlaceholder: 'Thêm ghi chú về hình ảnh này… (tùy chọn)',
    changeImage: 'Thảy hình ảnh',
    recordingError: 'Lỗi ghi âm',
    recordingErrorMessage: 'Không thể bắt đầu ghi âm. Vui lòng thử lại.',
    voiceNote: 'Ghi âm',
    error: 'Lỗi',
    saveFailed: 'Không thể lưu ký ức. Vui lòng thử lại.',
    linkSaveFailed: 'Không thể lưu liên kết.',
    photoSaved: 'Hình ảnh đã lưu ✓',
    saved: 'Đã lưu!',
  },

  // Language switcher
  language: {
    title: 'Ngôn ngữ',
    en: 'Tiếng Anh',
    vi: 'Tiếng Việt',
  },

  // Appearance / theme
  appearance: {
    title: 'Giao diện',
    auto: 'Hệ thống',
    autoDesc: 'Theo cài đặt thiết bị của bạn',
    light: 'Sáng',
    lightDesc: 'Luôn dùng giao diện sáng',
    dark: 'Tối',
    darkDesc: 'Luôn dùng giao diện tối',
  },

  // Dismissed screen
  dismissed: {
    title: 'Đã bỏ qua',
    empty: 'Không có gì bị bỏ qua',
    emptySubtitle: 'Những ký ức bạn bỏ qua sẽ xuất hiện tại đây',
    restore: 'Khôi phục',
    restoreTitle: 'Khôi phục ký ức',
    restoreMessage: 'Ký ức này sẽ được chuyển lại vào thư viện.',
    restoreFailed: 'Không thể khôi phục ký ức',
    permanentTitle: 'Xóa vĩnh viễn',
    permanentMessage: 'Ký ức này sẽ bị xóa vĩnh viễn. Không thể hoàn tác.',
    permanentDelete: 'Xóa vĩnh viễn',
    deleteFailed: 'Không thể xóa ký ức',
  },

  // Common
  common: {
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    close: 'Đóng',
    save: 'Lưu',
    delete: 'Xóa',
    signOut: 'Đăng xuất',
    error: 'Lỗi',
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    justNow: 'Vừa xong',
    minutesAgo: '{{count}} phút trước',
    hoursAgo: '{{count}} giờ trước',
    daysAgo: '{{count}} ngày trước',
    weeksAgo: '{{count}} tuần trước',
  },

  // Alerts
  alerts: {
    signOutTitle: 'Đăng xuất',
    signOutMessage: 'Bạn có chắc muốn đăng xuất không?',
    deleteAccountTitle: 'Xóa tài khoản',
    deleteAccountMessage:
      'Bạn có chắc muốn xóa vĩnh viễn tài khoản? Hành động này không thể hoàn tác.',
    deleteDataTitle: 'Xóa toàn bộ dữ liệu',
    deleteDataMessage:
      'Bạn có chắc muốn xóa vĩnh viễn toàn bộ dữ liệu? Hành động này không thể hoàn tác.',
  },

  // Login screen
  login: {
    title: 'Memory AI',
    subtitle: 'Trợ lý ghi nhớ cá nhân của bạn',
    signIn: 'Đăng nhập',
    createAccount: 'Tạo tài khoản',
    namePlaceholder: 'Tên (tùy chọn)',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Mật khẩu',
    errorTitle: 'Lỗi',
    emailRequired: 'Vui lòng nhập email và mật khẩu',
    passwordMinLength: 'Mật khẩu phải có ít nhất 8 ký tự',
    loginFailed: 'Đăng nhập thất bại',
    registerFailed: 'Đăng ký thất bại',
    genericError: 'Đã xảy ra lỗi. Vui lòng thử lại.',
    continueWithGoogle: 'Tiếp tục với Google',
    orDivider: 'hoặc',
  },

  // Navigation titles
  nav: {
    memoryDetail: 'Chi tiết ký ức',
    quickCapture: 'Lưu nhanh',
    dismissed: 'Đã bỏ qua',
  },

  // Archive screen
  archive: {
    title: 'Kho lưu trữ',
    subtitle: 'Tìm kiếm và duyệt ký ức',
    searchPlaceholder: 'Tìm kiếm trong ký ức…',
    empty: 'Bắt đầu lưu ký ức để xem chúng ở đây',
  },

  // Insights screen
  insights: {
    title: 'Thống kê',
    subtitle: 'Xu hướng & mô hình từ ký ức của bạn',
    loading: 'Đang phân tích ký ức…',
    empty: 'Chưa có thống kê',
    emptySubtitle: 'Bắt đầu ghi nhớ và chúng tôi sẽ hiển thị xu hướng và mô hình theo thời gian.',
    startCapturing: 'Bắt đầu ghi nhớ',
    period7: '7 ngày',
    period30: '30 ngày',
    period90: '3 tháng',
    weeklyRecap: 'Tóm tắt tuần',
    generatingInsights: '✨ Đang tạo thống kê…',
    noRecap: 'Không có gì để tóm tắt tuần này. Bắt đầu lưu để có thống kê hàng tuần!',
    memories: 'Ký ức',
    topics: 'Chủ đề',
    types: 'Loại',
    highlights: 'Nổi bật',
    overview: 'Tổng quan',
    totalMemories: 'Tổng',
    activeDays: 'Ngày hoạt động',
    avgPerDay: 'TB/Ngày',
    longestStreak: 'Chuỗi tốt nhất',
    activity: 'Hoạt động',
    less: 'Ít',
    more: 'Nhiều',
    byType: 'Theo loại',
    byCategory: 'Theo danh mục',
    whenYouCapture: 'Thời gian ghi nhớ',
    peakHour: 'Giờ cao điểm',
    streakConsistency: 'Chuỗi & Kiên trì',
    consistency: 'Kiên trì',
    totalDays: 'Tổng số ngày',
    consistencyExcellent: 'Xuất sắc! Bạn đang xây dựng một kho ký ức tuyệt vời. Tiếp tục nào! 🌟',
    consistencyGood: 'Rất tốt! Bạn đang tích cực ghi lại những điều quan trọng.',
    consistencyBuilding: 'Bạn đang xây dựng thói quen tốt. Hãy thử ghi ít nhất một ký ức mỗi ngày!',
    consistencyStart: 'Mỗi hành trình bắt đầu từ một bước. Ghi nhớ điều gì đó hôm nay!',
    vsPrevious: 'so với kỳ trước',
  },

  // AI Chat screen
  chat: {
    title: 'Hỏi AI',
    subtitle: 'Trò chuyện với ký ức của bạn',
    placeholder: 'Hỏi về ký ức của bạn…',
    welcomeTitle: 'Hỏi tôi bất cứ điều gì',
    welcomeSubtitle: 'Tôi có thể tìm kiếm trong ký ức của bạn và trả lời các câu hỏi về những gì bạn đã lưu.',
    newChat: 'Cuộc trò chuyện mới',
    error: 'Xin lỗi, tôi không thể xử lý yêu cầu đó. Vui lòng thử lại.',
    fromMemories: 'Từ {{count}} ký ức',
    defaultSuggestion1: 'Tôi đã lưu gì tuần này?',
    defaultSuggestion2: 'Tóm tắt ghi chú gần đây của tôi',
    defaultSuggestion3: 'Chủ đề chính trong ký ức của tôi là gì?',
  },

  // Recall screen
  recall: {
    title: 'Nhắc lại',
    subtitle: 'Những gì bạn lưu có thể hữu ích trở lại',
    empty: 'Hiện chưa có nội dung nào cần nhắc.',
  },
} as const;

export default vi;
