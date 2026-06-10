import { defineLocale } from './define-locale'

export const zhHant = defineLocale({
  common: {
    copied: '已複製',
    copy: '複製',
    copyFailed: '複製失敗',
    failed: '失敗'
  },
  language: {
    label: '語言',
    description: '選擇桌面介面的顯示語言。',
    saving: '正在儲存語言…',
    saveError: '語言更新失敗',
    switchTo: '切換語言',
    searchPlaceholder: '搜尋語言…',
    noResults: '找不到語言'
  },
  composer: {
    lookupLoading: '查找中…',
    lookupNoMatches: '沒有匹配項。',
    lookupTry: '試試',
    lookupOr: '或'
  },
  sidebar: {
    allPinned: '這裡的對話都已置頂。取消置頂後會顯示在最近對話裡。',
    allProfiles: '全部 Profile',
    artifacts: 'Artifacts',
    clearSearch: '清除搜尋',
    createProfile: '新增 Profile',
    cronJobs: 'Cron',
    defaultProfile: '預設 Profile',
    manageProfiles: '管理 Profile',
    messaging: 'Messaging',
    newSession: '新對話',
    newSessionIn: label => `在 ${label} 中新增對話`,
    noMatch: query => `沒有匹配「${query}」的對話。`,
    noSessions: '還沒有對話。新增對話後會顯示在這裡。',
    pinned: '置頂',
    profiles: 'Profiles',
    results: '結果',
    searchAria: '搜尋對話',
    searchPlaceholder: '搜尋對話…',
    sessions: '對話',
    shiftClickHint: 'Shift 點擊對話可置頂 · 可拖拽排序',
    showMoreIn: (count, label) => `在 ${label} 中再顯示 ${count} 條`,
    skills: 'Skills & Tools',
    workspaceGroup: '依工作區分組',
    workspaceUngroup: '取消分組'
  },
  profiles: {
    copySetup: '複製 setup',
    copying: '複製中...',
    create: '建立 Profile',
    default: '預設',
    delete: '刪除',
    env: 'env',
    loading: '正在載入 Profiles...',
    manage: '管理 Profiles',
    newProfile: '新增 Profile',
    noProfiles: '還沒有 Profile。',
    profileCount: count => `${count} 個 Profile`,
    rename: '重新命名',
    selectPrompt: '選擇一個 Profile 查看詳情。',
    soulDescription: '這個 Profile 內建的系統提示詞和角色設定。',
    soulEmpty: 'SOUL.md 為空，可以從這裡開始寫角色設定...',
    soulLoading: '正在載入 SOUL.md...',
    soulSaved: 'SOUL.md 已儲存',
    soulUnsaved: '有未儲存修改'
  },
  settings: {
    nav: {
      gateway: '閘道',
      apiKeys: 'API 金鑰',
      mcp: 'MCP',
      archivedChats: '已封存對話',
      about: '關於'
    },
    sections: {
      advanced: '進階',
      appearance: '外觀',
      chat: '對話',
      memory: '記憶',
      model: '模型',
      safety: '安全',
      voice: '語音',
      workspace: '工作區'
    },
    shell: {
      desktopEyebrow: '桌面端',
      settingsTitle: '設定',
      settingsIntro: '模型、工作區路由、憑證與桌面端專屬行為都在這裡管理。',
      configurationEyebrow: '設定',
      quickSearch: '快速搜尋',
      back: '返回'
    },
    appearance: {
      title: '外觀'
    },
    gateway: {
      title: '閘道連線'
    }
  }
})
