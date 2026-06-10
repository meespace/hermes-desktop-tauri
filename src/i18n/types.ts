export type Locale = 'en' | 'zh' | 'zh-hant' | 'ja'

interface ModeOptionCopy {
  label: string
  description: string
}

export interface Translations {
  common: {
    back: string
    cancel: string
    change: string
    choose: string
    clear: string
    close: string
    copied: string
    copy: string
    copyFailed: string
    delete: string
    docs: string
    error: string
    failed: string
    export: string
    import: string
    loading: string
    refresh: string
    remove: string
    reset: string
    retry: string
    save: string
    saving: string
    set: string
    update: string
  }
  chat: {
    actions: {
      branchInNewChat: string
      copy: string
      moreActions: string
      readAloud: string
      readAloudFailed: string
      refresh: string
      stopReading: string
      preparingAudio: string
    }
    loading: {
      response: string
      session: string
    }
    thinking: string
    speakers: {
      you: string
    }
    timestamp: {
      today: (time: string) => string
      yesterday: (time: string) => string
    }
    user: {
      editMessage: string
      goForward: string
      restoreCheckpoint: string
      stop: string
    }
  }
  commandPalette: {
    title: string
    searchPlaceholder: string
    empty: string
    active: string
    groups: {
      appearance: string
      goTo: string
      recentSessions: string
      settings: string
    }
    actions: {
      newChat: string
      settings: string
      providers: string
      apiKeys: string
      skills: string
      messaging: string
      artifacts: string
      cronJobs: string
      profiles: string
      lightMode: string
      darkMode: string
      systemMode: string
    }
  }
  commandCenter: {
    sections: {
      sessions: string
      system: string
      usage: string
    }
    descriptions: {
      sessions: string
      system: string
      usage: string
    }
    navigation: {
      navigate: string
      newSession: string
      newSessionDetail: string
      settings: string
      settingsDetail: string
      skills: string
      skillsDetail: string
      messaging: string
      messagingDetail: string
      artifacts: string
      artifactsDetail: string
      sessionsPanel: string
      sessionsPanelDetail: string
      systemPanel: string
      systemPanelDetail: string
      usagePanel: string
      usagePanelDetail: string
    }
    system: {
      actionPending: string
      gatewayRunning: string
      gatewayStopped: string
      activeSessions: (count: number) => string
      restartMessaging: string
      actionRunning: string
      actionDone: string
      actionFailed: string
      loadingStatus: string
      recentLogs: string
      noLogs: string
    }
    usagePanel: {
      sessions: string
      apiCalls: string
      tokensInOut: string
      estimatedCost: string
      actualCost: (value: string) => string
      loading: string
      noUsage: (days: number) => string
      retry: string
      dailyTokens: string
      input: string
      output: string
      noDailyActivity: string
      topModels: string
      noModelUsage: string
      topSkills: string
      noSkillActivity: string
      actions: (count: number) => string
    }
  }
  modelPicker: {
    addProvider: string
    couldNotLoad: string
    filterPlaceholder: string
    free: string
    freeTier: string
    inputOutputPrice: string
    noAuthenticatedProviders: string
    noModels: string
    persistGlobal: string
    persistGlobalSession: string
    pro: string
    switchModel: string
  }
  notifications: {
    copyDetail: string
    copyDetailFailed: string
    details: string
    dismiss: string
    hideMore: (count: number) => string
    notifications: string
    showMore: (count: number) => string
  }
  promptOverlays: {
    gatewayDisconnected: string
    secretDefaultDescription: string
    secretPlaceholder: string
    secretRequired: string
    sendSecretFailed: string
    sendSudoFailed: string
    submit: string
    sudoDescription: string
    sudoPassword: string
    sudoTitle: string
  }
  shell: {
    appControls: string
    agents: string
    closeAgents: string
    closeCommandCenter: string
    contextUsage: string
    currentTurnElapsed: string
    gateway: string
    gatewayStatus: string
    hideRightSidebar: string
    hideSidebar: string
    muteHaptics: string
    openAgents: string
    openCommandCenter: string
    openCronJobs: string
    openModelPicker: string
    openSettings: string
    paneControls: string
    running: string
    runtimeSessionElapsed: string
    search: string
    searchTitle: string
    session: string
    showRightSidebar: string
    showSidebar: string
    switchModel: string
    workspaceModeLabel: string
    workspacePathLabel: string
    unmuteHaptics: string
    windowControls: string
  }
  boot: {
    failure: {
      title: string
      description: string
      remoteTitle: string
      remoteDescription: string
      retry: string
      repairInstall: string
      useLocalGateway: string
      openLogs: string
      repairHint: string
      remoteSignInHint: string
      hideRecentLogs: string
      showRecentLogs: string
      signedInTitle: string
      signedInMessage: string
      signInIncompleteTitle: string
      signInIncompleteMessage: string
      signInFailed: string
      signInToRemoteGateway: string
      signInWithProvider: (provider: string) => string
      identityProvider: string
    }
  }
  language: {
    label: string
    description: string
    saving: string
    saveError: string
    switchTo: string
    searchPlaceholder: string
    noResults: string
  }
  keybinds: {
    title: string
    subtitle: (open: string) => string
    rebind: string
    reset: string
    resetAll: string
    pressKey: string
    set: string
    conflictWith: (label: string) => string
    categories: Record<string, string>
    actions: Record<string, string>
  }
  composer: {
    lookupLoading: string
    lookupNoMatches: string
    lookupTry: string
    lookupOr: string
    controls: {
      connectingModel: string
      disabledPlaceholder: string
      placeholder: string
      queueHint: string
      sendHint: string
      stopHint: string
      startVoiceConversation: string
      queueMessage: string
      send: string
      stop: string
      speaking: string
      transcribing: string
      thinking: string
      muted: string
      listening: string
      muteMicrophone: string
      unmuteMicrophone: string
      stopListeningAndSend: string
      endVoiceConversation: string
      end: string
      stopDictation: string
      transcribingDictation: string
      voiceDictation: string
    }
    help: {
      commonCommands: string
      hotkeys: string
      helpFooter: string
      commandDescriptions: Record<string, string>
      hotkeyDescriptions: Record<string, string>
    }
    meta: {
      contextSuggestions: (count: number) => string
      quickModels: (count: number) => string
      editingQueuedTurn: string
    }
    queue: {
      queued: (count: number) => string
      attachmentOnly: string
      empty: string
      attachments: (count: number) => string
      editing: string
      edit: string
      sendNow: string
      delete: string
    }
    voice: {
      dictating: string
      transcribing: string
      preparingAudio: string
      speakingResponse: string
      readingAloud: string
      noSpeechTitle: string
      noSpeechMessage: string
      transcriptionFailed: string
      unavailableTitle: string
      unavailableMessage: string
      recordingFailed: string
      microphoneFailed: string
      startSessionFailed: string
      playbackFailed: string
      configureStt: string
      permissionDenied: string
      noMicrophone: string
      microphoneInUse: string
      constraintsUnsupported: string
      unsupportedRuntime: string
      startRecordingFailed: string
    }
  }
  appLoader: {
    label: string
    description: string
  }
  artifacts: {
    all: string
    images: string
    files: string
    links: string
    searchPlaceholder: string
    refreshing: string
    refresh: string
    indexing: string
    emptyTitle: string
    emptyDescription: string
    imageSection: string
    fileSection: string
    linkSection: string
    fileAndLinkSection: string
    openFailed: string
    chat: string
    copyUrl: string
    copyPath: string
    columns: {
      linkTitle: string
      name: string
      titleOrName: string
      url: string
      path: string
      location: string
      session: string
    }
    pageRange: (start: number, end: number, total: number) => string
    itemLabels: {
      images: string
      files: string
      links: string
      items: string
    }
    goToPage: (itemLabel: string, page: number) => string
  }
  preview: {
    appFailedToBoot: string
    serverNotFound: string
    failedToLoad: string
    tryAgain: string
    hermesRestarting: string
    askRestartServer: string
    restartingServer: string
    restartingMessage: string
    restartFailed: string
    showConsole: string
    hideConsole: string
    openDevtools: string
    hideDevtools: string
    serverRestarted: string
    serverRestartedMessage: string
    restartFailedTitle: string
    restartFailedMessage: string
    workspaceChangedReloading: string
    loadingPreview: string
    previewUnavailable: string
    previewAnyway: string
    binaryTitle: string
    largeTitle: string
    binaryBody: (label: string) => string
    largeBody: (label: string, size: string) => string
    showingFirst: string
    previewLabel: string
    sourceLabel: string
    noInlinePreview: string
    noInlinePreviewBody: (mimeType: string) => string
  }
  onboarding: {
    close: string
    preparingInstall: string
    starting: string
    title: string
    description: string
    collapse: string
    otherProviders: string
    lookingUpProviders: string
    apiKeyCta: string
    chooseLater: string
    recommended: string
    featuredPitch: string
    apiKeyDefaultDescription: string
    localEndpointName: string
    apiOptions: Record<string, { description: string; short: string }>
    flowSubtitles: Record<string, string>
    pasteApiKey: string
    connecting: string
    connect: string
    saveCredentialFailed: string
    backToSignIn: string
    startingSignIn: (provider: string) => string
    verifyingCode: (provider: string) => string
    connectedPickingModel: (provider: string) => string
    providerConnected: (provider: string) => string
    signInFailed: string
    pickDifferentProvider: string
    signInWith: (provider: string) => string
    stepOpenBrowser: (provider: string) => string
    stepAuthorize: string
    stepPasteCode: string
    pasteAuthorizationCode: string
    continue: string
    reopenSignInPage: string
    waitingForAuthorization: string
    browserSigninDescription: (provider: string) => string
    externalSigninDescription: (provider: string) => string
    signedIn: string
    reopenVerificationPage: string
    enterCodeThere: (provider: string) => string
    reopenAuthorizationPage: string
    copy: string
    cancel: string
    connected: string
    defaultModel: string
    getKey: string
    freeTier: string
    free: string
    pro: string
    startChatting: string
    pricePerMtok: (input: string, output: string) => string
  }
  messagingView: {
    states: Record<string, string>
    hints: Record<string, string>
    unknown: string
    failedToLoad: string
    configured: string
    needsSetup: string
    gatewayStopped: string
    getCredentialsTitle: string
    openSetupGuide: string
    required: string
    noTokenNeeded: string
    recommended: string
    advanced: (count: number) => string
    enabled: string
    disabled: string
    unsavedChanges: string
    savingChanges: string
    saveChanges: string
    searchPlaceholder: string
    loadingPlatforms: string
    toggleUpdatedTitle: (name: string, enabled: boolean) => string
    toggleUpdatedMessage: string
    updateFailed: (name: string) => string
    setupSavedTitle: (name: string) => string
    setupSavedMessage: string
    saveFailed: (name: string) => string
    clearedTitle: (key: string) => string
    setupUpdatedMessage: (name: string) => string
    clearFailed: (key: string) => string
    saved: string
    replaceCurrentValue: string
    openDocs: string
    clearField: (key: string) => string
    enablePlatform: (name: string) => string
    disablePlatform: (name: string) => string
    platformIntro: Record<string, string>
    fields: Record<string, { label: string; help?: string; placeholder?: string }>
  }
  sidebar: {
    allPinned: string
    allProfiles: string
    artifacts: string
    clearSearch: string
    createProfile: string
    cronJobs: string
    defaultProfile: string
    manageProfiles: string
    messaging: string
    newSession: string
    newSessionIn: (label: string) => string
    noMatch: (query: string) => string
    noSessions: string
    pinned: string
    profiles: string
    results: string
    searchAria: string
    searchPlaceholder: string
    sessions: string
    shiftClickHint: string
    showMoreIn: (count: number, label: string) => string
    skills: string
    workspaceGroup: string
    workspaceUngroup: string
    workspaceNone: string
    gatewayLocal: string
    gatewayStarting: string
    gatewayOffline: string
    loadMore: string
    loadMoreCount: (count: number) => string
  }
  rightSidebar: {
    fileSystem: string
    terminal: string
    noFolderSelected: string
    changeWorkingDirectory: string
    previewUnavailable: string
    rightSidebar: string
    clickToChangeFolder: string
    openFolder: string
    openDifferentFolder: string
    collapseAllFolders: string
    refreshTree: string
    noProject: string
    noProjectDescription: string
    unreadable: string
    unreadableDescription: (error: string) => string
    empty: string
    emptyDescription: string
    treeError: string
    treeErrorDescription: string
    tryAgain: string
    loadingFileTree: string
    loadingFiles: string
  }
  skills: {
    skills: string
    toolsets: string
    all: string
    searchSkills: string
    searchToolsets: string
    refreshingSkills: string
    refreshSkills: string
    loadingCapabilities: string
    noSkillsFound: string
    noSkillsFoundDescription: string
    noToolsetsFound: string
    noToolsetsFoundDescription: string
    noDescription: string
    configured: string
    needsKeys: string
    configure: (label: string) => string
    toggleToolset: (label: string) => string
    enabledSummary: (enabled: number, total: number) => string
    skillEnabled: string
    skillDisabled: string
    toolsetEnabled: string
    toolsetDisabled: string
    appliesToNewSessions: (label: string) => string
    skillsFailedToLoad: string
    toolsetsFailedToRefresh: string
    failedToUpdate: (label: string) => string
  }
  cron: {
    fallbackTitle: string
    searchPlaceholder: string
    refreshing: string
    refresh: string
    loading: string
    createFirst: string
    emptyTitle: string
    emptyDescription: string
    noMatchesTitle: string
    noMatchesDescription: string
    activeSummary: (enabled: number, total: number) => string
    newCron: string
    deleteTitle: string
    deleteDescription: (title: string) => string
    deleting: string
    pause: string
    resume: string
    triggerNow: string
    edit: string
    last: string
    next: string
    optional: string
    promptScheduleRequired: string
    saveFailed: string
    loadFailed: string
    updateFailed: string
    triggerFailed: string
    deleteFailed: string
    resumed: string
    paused: string
    triggered: string
    deleted: string
    created: string
    updated: string
    editTitle: string
    createTitle: string
    editDescription: string
    createDescription: string
    name: string
    namePlaceholder: string
    prompt: string
    promptPlaceholder: string
    frequency: string
    deliverTo: string
    customSchedule: string
    customSchedulePlaceholder: string
    customScheduleHint: string
    saveChanges: string
    createCron: string
    states: Record<string, string>
    delivery: Record<string, string>
    scheduleOptions: Record<string, { hint: string; label: string }>
    scheduleSummary: {
      daily: (time: string) => string
      weekdays: (time: string) => string
      weekly: (day: string, time: string) => string
      monthly: (day: string, time: string) => string
      hourlyTop: string
      hourlyAt: (minute: string) => string
      day: (value: string) => string
      days: Record<string, string>
    }
  }
  updates: {
    stages: Record<string, string>
    looking: string
    checkFailed: string
    tryAgain: string
    close: string
    notAvailable: string
    notAvailableBody: string
    connectionHint: string
    bundledReady: string
    bundledReadyBody: string
    updateNow: string
    latestBody: string
    allSet: string
    newAvailable: string
    newAvailableBody: string
    maybeLater: string
    moreChanges: (count: number) => string
    manualTitle: string
    manualBody: string
    copied: string
    copy: string
    manualHint: string
    done: string
    applyingBody: string
    applyingHint: string
    errorTitle: string
    errorBody: string
    notNow: string
    doneBody: string
    complete: string
  }
  desktopInstall: {
    states: Record<string, string>
    logDirectory: string
    unsupportedTitle: string
    unsupportedDescription: (platform: string) => string
    installCommand: string
    copyCommand: string
    viewDocs: string
    willInstallTo: string
    retryAfterInstall: string
    failedTitle: string
    activeTitle: string
    finishingTitle: string
    failedDescription: string
    setupDescription: string
    stepsComplete: (completed: number, total: number) => string
    now: string
    fetchingManifest: string
    error: string
    hideOutput: string
    showOutput: string
    outputLines: (count: number) => string
    noOutput: string
    cancelling: string
    cancelInstall: string
    transcriptSavedTo: string
    copiedOutput: string
    copyOutput: string
    openLogs: string
    reloadAndRetry: string
  }
  sessionActions: {
    actionsFor: (title: string) => string
    archive: string
    archiveFailed: string
    archived: string
    copyId: string
    copyIdFailed: string
    delete: string
    export: string
    pin: string
    rename: string
    renameDescription: string
    renameFailed: string
    renamePlaceholder: string
    renameTitle: string
    renamed: string
    sessionActions: string
    sessionRunning: string
    unpin: string
  }
  sessionFlow: {
    branch: string
    branchFailed: string
    branchNoText: string
    branchNoTextTitle: string
    branchUnavailable: string
    branchUnavailableTitle: string
    deleteFailed: string
    resumeFailed: string
    sessionBusy: string
    sessionBusyTitle: string
  }
  profiles: {
    copySetup: string
    copying: string
    create: string
    default: string
    delete: string
    env: string
    loading: string
    manage: string
    newProfile: string
    noProfiles: string
    profileCount: (count: number) => string
    rename: string
    selectPrompt: string
    soulDescription: string
    soulEmpty: string
    soulLoading: string
    soulSaved: string
    soulUnsaved: string
  }
  settings: {
    closeSettings: string
    exportConfig: string
    importConfig: string
    resetToDefaults: string
    resetConfirm: string
    exportFailed: string
    resetFailed: string
    nav: {
      providers: string
      gateway: string
      apiKeys: string
      mcp: string
      archivedChats: string
      updateSources: string
      about: string
    }
    sections: Record<'advanced' | 'appearance' | 'chat' | 'memory' | 'model' | 'safety' | 'voice' | 'workspace', string>
    searchPlaceholder: Record<
      'about' | 'config' | 'gateway' | 'keys' | 'mcp' | 'providers' | 'sessions' | 'updateSources',
      string
    >
    modeOptions: Record<'dark' | 'light' | 'system', ModeOptionCopy>
    shell: {
      desktopEyebrow: string
      settingsTitle: string
      settingsIntro: string
      configurationEyebrow: string
      quickSearch: string
      back: string
    }
    sectionDescriptions: Record<'advanced' | 'appearance' | 'chat' | 'memory' | 'model' | 'safety' | 'voice' | 'workspace', string>
    viewTitles: {
      about: string
      gateway: string
      keys: string
      mcp: string
      providers: string
      sessions: string
      updateSources: string
    }
    viewDescriptions: {
      about: string
      gateway: string
      keys: string
      mcp: string
      providers: string
      sessions: string
      updateSources: string
    }
    providers: {
      loading: string
      title: string
      intro: string
      connectAccount: string
      addOrSwitch: string
      apiKeys: string
      apiKeysDesc: string
      connected: string
      connectAnother: string
      collapse: string
      notConnected: string
      noProviders: string
      otherProviders: string
      docs: string
      statusError: string
      sectionMeta: (configured: number, total: number) => string
      oauthSectionTitle: string
      oauthSectionDescription: string
      apiKeySectionTitle: string
      apiKeySectionDescription: string
      localSectionTitle: string
      localSectionDescription: string
      kindOauth: string
      kindApiKey: string
      kindLocal: string
      configured: string
      needsSetup: string
      notConfigured: string
      openInKeys: string
      connect: string
      localEndpointName: string
      localEndpointDescription: string
    }
    keys: {
      openDocs: string
      hideValue: string
      revealValue: string
      replace: string
      set: string
      notSet: string
      clearValue: string
      replaceCurrent: string
      enterValue: string
      otherProviders: string
      configuredMeta: (configured: number, total: number) => string
      setMeta: (set: number, total: number) => string
      loading: string
      llmProviders: string
      apiKeyCustomGroup: string
      localGroup: string
      categories: Record<string, string>
    }
    toolsets: {
      credentialSaved: string
      credentialUpdated: (key: string) => string
      credentialRemoved: string
      credentialRemovedMessage: (key: string) => string
      removeConfirm: (key: string) => string
      saveFailed: (key: string) => string
      removeFailed: (key: string) => string
      revealFailed: (key: string) => string
      loadFailed: string
      providerSelected: string
      providerActive: (provider: string) => string
      selectFailed: (provider: string) => string
      noProviderOptions: string
      noProviders: string
      loadingConfiguration: string
    }
    models: {
      loading: string
      mainModel: string
      mainModelDescription: string
      auxiliaryModels: string
      auxiliaryDescription: string
      resetAllToMain: string
      setToMain: string
      change: string
      apply: string
      applying: string
      provider: string
      model: string
      autoUseMain: string
      providerDefault: string
      tasks: Record<string, { hint: string; label: string }>
    }
    about: {
      version: (version: string) => string
      versionUnavailable: string
      updates: string
      unsupported: string
      bundled: string
      serverError: string
      installing: string
      updateReady: (count: number) => string
      latest: string
      checkHint: string
      lastChecked: (time: string) => string
      never: string
      justNow: string
      minutesAgo: (count: number) => string
      hoursAgo: (count: number) => string
      daysAgo: (count: number) => string
      checking: string
      checkNow: string
      openUpdater: string
      seeWhatsNew: string
      releaseNotes: string
      manualUpdates: string
      manualDescription: string
      openRepository: string
      branchCommit: (branch: string, sha: string) => string
      unknown: string
      contactSection: string
      wechatTitle: string
      wechatDescription: string
      officialAccountTitle: string
      officialAccountDescription: string
    }
    updateSources: {
      title: string
      intro: string
      manualBadge: string
      managedBadge: string
      loading: string
      save: string
      saving: string
      reset: string
      loadFailed: string
      saveFailed: string
      savedTitle: string
      savedMessage: string
      emptyTitle: string
      emptyDescription: string
      startupPanelTitle: string
      startupPanelDescription: string
      startupSave: string
      startupSaveTitle: string
      startupSaveMessage: string
      startupSaveFailed: string
      startupLoading: string
      managerTitle: string
      managerDescription: string
      managerStatusInstalled: string
      managerStatusNotInstalled: string
      managerStatusUpdateAvailable: string
      managerStatusLabel: string
      managerSourceLabel: string
      managerBranchLabel: string
      managerVersionLabel: string
      managerCommitLabel: string
      managerUnknownValue: string
      managerCheck: string
      managerRepair: string
      managerInstall: string
      managerUpdate: string
      managerCheckFailed: string
      managerActionSuccessTitle: string
      managerActionWarningTitle: string
      managerActionFailed: string
      managerUnavailableMessage: string
      managerProgressTitle: string
      managerProgressRunningHint: string
      managerProgressDoneHint: string
      managerProgressErrorHint: string
      managerProgressLatestLog: string
      agentTitle: string
      agentDescription: string
      githubGit: string
      githubGitDescription: string
      giteeGit: string
      giteeGitDescription: string
      gitcodeGit: string
      gitcodeGitDescription: string
      customMirror: string
      customMirrorDescription: string
      pythonTitle: string
      pythonDescription: string
      pypi: string
      pypiDescription: string
      tsinghua: string
      tsinghuaDescription: string
      aliyun: string
      aliyunDescription: string
      custom: string
      customPythonDescription: string
      npmTitle: string
      npmDescription: string
      npmjs: string
      npmjsDescription: string
      npmmirror: string
      npmmirrorDescription: string
      customNpmDescription: string
      desktopTitle: string
      desktopDescription: string
      desktopHint: string
      manualOnly: string
      openRepository: string
    }
    appearance: {
      title: string
      intro: string
      colorMode: string
      colorModeDesc: string
      toolViewTitle: string
      toolViewDesc: string
      product: string
      productDesc: string
      technical: string
      technicalDesc: string
      themeTitle: string
      themeDesc: string
    }
    configFields: {
      labels: Record<string, string>
      descriptions: Record<string, string>
      on: string
      off: string
      none: string
      noneOption: string
      notSet: string
      commaSeparated: string
      loadingConfiguration: string
      resultCount: (count: number) => string
      emptyTitle: string
      emptyDescription: string
      loadFailed: string
      autosaveFailed: string
      imported: string
      invalidJson: string
      saving: string
    }
    gateway: {
      loading: string
      unavailableTitle: string
      unavailableDesc: string
      title: string
      envOverride: string
      intro: string
      appliesTo: string
      allProfiles: string
      defaultConnection: string
      profileConnection: (profile: string) => string
      envOverrideTitle: string
      envOverrideDesc: string
      localTitle: string
      localDesc: string
      remoteTitle: string
      remoteDesc: string
      remoteUrlTitle: string
      remoteUrlDesc: string
      probing: string
      probeError: string
      signedIn: string
      signIn: string
      signOut: string
      signInWith: (provider: string) => string
      authTitle: string
      authSignedInPassword: string
      authSignedInOauth: string
      authNeedsPassword: string
      authNeedsOauth: (provider: string) => string
      tokenTitle: string
      tokenDesc: string
      existingToken: (value: string) => string
      savedToken: string
      pasteSessionToken: string
      testRemote: string
      saveForRestart: string
      saveAndReconnect: string
      diagnostics: string
      diagnosticsDesc: string
      openLogs: string
      incompleteTitle: string
      incompleteSignIn: string
      incompleteToken: string
      incompleteSignInTest: string
      incompleteTokenTest: string
      enterUrlFirst: string
      restartingTitle: string
      savedTitle: string
      restartingMessage: string
      savedMessage: string
      connectedTo: (baseUrl: string, version?: string) => string
      reachableTitle: string
      signedOutTitle: string
      signedOutMessage: string
      failedLoad: string
      signInFailed: string
      signOutFailed: string
      testFailed: string
      applyFailed: string
      saveFailed: string
      oauthUnsupportedTitle: string
      oauthUnsupportedDesc: string
    }
  }
}
