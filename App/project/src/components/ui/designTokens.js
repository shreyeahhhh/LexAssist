export const uiSurface = {
  glassCard: "bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-lg",
  glassCardStrong: "bg-white/15 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl",
  sidebarCard: "bg-slate-950/70 border border-white/10 rounded-2xl",
  panelCard: "bg-slate-950/60 border border-white/10 rounded-2xl shadow-xl",
};

export const uiText = {
  title: "text-lg font-semibold text-white",
  sectionTitle: "text-sm font-semibold text-white",
  body: "text-sm text-white/75",
  muted: "text-xs text-white/60",
  subtle: "text-xs text-white/50",
  label: "text-xs text-white/70",
};

export const uiField = {
  input:
    "w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300",
  select:
    "lexassist-select w-full appearance-none bg-indigo-900/45 border border-indigo-200/35 rounded-xl px-3 py-2.5 pr-9 text-sm text-slate-100 shadow-inner shadow-indigo-950/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300",
  selectCompact:
    "lexassist-select w-full appearance-none bg-indigo-900/45 border border-indigo-200/35 rounded-lg px-3 py-2 pr-8 text-xs text-slate-100 shadow-inner shadow-indigo-950/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300",
  textarea:
    "w-full bg-white/5 border border-white/20 rounded-xl p-3 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300",
  composerInput:
    "bg-transparent flex-1 focus:outline-none text-white placeholder-white/50 text-sm focus-visible:ring-2 focus-visible:ring-amber-300 rounded-md",
};

export const uiButton = {
  ghost:
    "bg-white/10 text-white border border-white/20 hover:bg-white/20 transition duration-300 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
  ghostPill: "px-3.5 py-2 rounded-xl text-sm",
  ghostRound: "px-5 py-2.5 rounded-full",
  chip: "px-3 py-1.5 rounded-full text-xs bg-white/10 border border-white/20 hover:bg-white/20 transition",
  primary:
    "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition duration-300 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
  warmPrimary:
    "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
};

export const uiChat = {
  userBubble: "bg-gradient-to-r from-indigo-600/90 to-blue-500/90 text-white",
  userBubbleAssist: "bg-indigo-600/80 text-white",
  botBubble: "bg-white/15 border border-white/20 text-white",
  botBubbleAssist: "bg-white/10 border border-white/15 text-white",
};
