import { defineLocale } from './define-locale'

export const ja = defineLocale({
  common: {
    copied: 'コピーしました',
    copy: 'コピー',
    copyFailed: 'コピーに失敗しました',
    failed: '失敗'
  },
  language: {
    label: '言語',
    description: 'デスクトップ UI の表示言語を選択します。',
    saving: '言語を保存中…',
    saveError: '言語の更新に失敗しました',
    switchTo: '言語を切り替える',
    searchPlaceholder: '言語を検索…',
    noResults: '言語が見つかりません'
  },
  composer: {
    lookupLoading: '検索中…',
    lookupNoMatches: '一致する項目はありません。',
    lookupTry: '試す',
    lookupOr: 'または'
  },
  sidebar: {
    allPinned: 'ここにあるチャットはすべてピン留め済みです。ピンを外すと最近のチャットに表示されます。',
    allProfiles: 'すべての Profile',
    artifacts: 'Artifacts',
    clearSearch: '検索をクリア',
    createProfile: 'Profile を作成',
    cronJobs: 'Cron',
    defaultProfile: 'デフォルト Profile',
    manageProfiles: 'Profile を管理',
    messaging: 'Messaging',
    newSession: '新しいセッション',
    newSessionIn: label => `${label} で新しいセッション`,
    noMatch: query => `“${query}” に一致するセッションはありません。`,
    noSessions: 'まだチャットはありません。新しいセッションを開始するとここに表示されます。',
    pinned: 'ピン留め',
    profiles: 'Profiles',
    results: '結果',
    searchAria: 'セッションを検索',
    searchPlaceholder: 'セッションを検索…',
    sessions: 'セッション',
    shiftClickHint: 'Shift クリックでピン留め · ドラッグで並べ替え',
    showMoreIn: (count, label) => `${label} でさらに ${count} 件表示`,
    skills: 'Skills & Tools',
    workspaceGroup: 'ワークスペースでグループ化',
    workspaceUngroup: 'グループ化を解除'
  },
  profiles: {
    copySetup: 'setup をコピー',
    copying: 'コピー中...',
    create: 'Profile を作成',
    default: 'デフォルト',
    delete: '削除',
    env: 'env',
    loading: 'Profiles を読み込み中...',
    manage: 'Profiles を管理',
    newProfile: '新しい Profile',
    noProfiles: 'Profile はまだありません。',
    profileCount: count => `${count} Profile`,
    rename: '名前を変更',
    selectPrompt: 'Profile を選択すると詳細が表示されます。',
    soulDescription: 'この Profile に組み込まれているシステムプロンプトとペルソナ設定。',
    soulEmpty: 'SOUL.md は空です。ここからペルソナを書き始められます...',
    soulLoading: 'SOUL.md を読み込み中...',
    soulSaved: 'SOUL.md を保存しました',
    soulUnsaved: '未保存の変更があります'
  },
  settings: {
    nav: {
      gateway: 'ゲートウェイ',
      apiKeys: 'API キー',
      mcp: 'MCP',
      archivedChats: 'アーカイブ済みチャット',
      about: 'About'
    },
    sections: {
      advanced: '詳細',
      appearance: '外観',
      chat: 'チャット',
      memory: 'メモリ',
      model: 'モデル',
      safety: '安全性',
      voice: '音声',
      workspace: 'ワークスペース'
    },
    shell: {
      desktopEyebrow: 'Desktop',
      settingsTitle: '設定',
      settingsIntro: 'モデル、ワークスペース、認証情報、デスクトップ専用の挙動をここで管理します。',
      configurationEyebrow: 'Configuration',
      quickSearch: 'クイック検索',
      back: '戻る'
    },
    appearance: {
      title: '外観'
    },
    gateway: {
      title: 'ゲートウェイ接続'
    }
  }
})
