import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const apiUrl = import.meta.env.VITE_API_URL;
const REMINDERS_KEY = "courtRemindersV2";
const META_KEY = "courtReminderMetaV2";

const parseJson = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
};

const loadReminders = () => {
  const parsed = parseJson(REMINDERS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
};

const loadMeta = () => {
  const parsed = parseJson(META_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
};

const saveReminders = (items) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(items));
};

const saveMeta = (meta) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(META_KEY, JSON.stringify(meta));
};

const normalizeDate = (dateString) => {
  if (!dateString) return null;
  const parsed = dateString.includes("T")
    ? new Date(dateString)
    : new Date(`${dateString}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDaysAway = (dateString) => {
  const target = normalizeDate(dateString);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
};

const formatDisplayDate = (dateString) => {
  const parsed = normalizeDate(dateString);
  if (!parsed) return dateString || "";
  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const getDateLabel = (daysAway) => {
  if (daysAway < 0) return { text: "Overdue", tone: "red" };
  if (daysAway === 0) return { text: "Today", tone: "amber" };
  if (daysAway === 1) return { text: "Tomorrow", tone: "amber" };
  if (daysAway <= 7) return { text: `In ${daysAway} days`, tone: "amber" };
  return { text: `In ${daysAway} days`, tone: "blue" };
};

const getToneClasses = (tone) => {
  switch (tone) {
    case "red":
      return "text-red-200 bg-red-500/10 border-red-500/30";
    case "amber":
      return "text-amber-200 bg-amber-500/10 border-amber-500/30";
    default:
      return "text-blue-200 bg-blue-500/10 border-blue-500/30";
  }
};

const getPriorityClasses = (priority) => {
  if (priority === "high") return "text-red-200 border-red-500/40 bg-red-500/10";
  if (priority === "medium") return "text-amber-200 border-amber-500/40 bg-amber-500/10";
  return "text-blue-200 border-blue-500/40 bg-blue-500/10";
};

const toServerReminder = (item) => ({
  id: item.id,
  title: item.title,
  date: item.date,
  time: item.time || "10:00 AM",
  location: item.location || "Court",
  type: item.type || "Hearing",
});

const parseQuickReminder = (input, fallbackTime) => {
  const text = input.trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const now = new Date();
  let target = null;

  if (lower.includes("tomorrow")) {
    target = new Date(now);
    target.setDate(target.getDate() + 1);
  } else if (lower.includes("next week")) {
    target = new Date(now);
    target.setDate(target.getDate() + 7);
  } else {
    const match = lower.match(/in\s+(\d+)\s+day/);
    if (match) {
      target = new Date(now);
      target.setDate(target.getDate() + Number(match[1]));
    }
  }

  if (!target) return null;

  const cleanedTitle = text
    .replace(/tomorrow/gi, "")
    .replace(/next week/gi, "")
    .replace(/in\s+\d+\s+day[s]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: cleanedTitle || "Court Reminder",
    date: toDateValue(target),
    time: fallbackTime || "10:00 AM",
  };
};

const looksLikeAssistantPrompt = (text) => {
  const value = (text || "").toLowerCase();
  return (
    value.includes("act as my self-lawyer coach") ||
    value.includes("use this case profile") ||
    value.includes("respond in malayalam") ||
    value.includes("respond in hindi") ||
    value.includes("respond in tamil") ||
    value.includes("respond in telugu") ||
    value.includes("respond in kannada")
  );
};

const sanitizeCaseSummary = (summary) => {
  const trimmed = (summary || "").trim();
  if (!trimmed) return "";
  if (looksLikeAssistantPrompt(trimmed)) return "";
  return trimmed.slice(0, 600);
};

const defaultForm = {
  title: "",
  date: "",
  time: "10:00 AM",
  location: "Court",
  type: "Hearing",
  priority: "medium",
  repeat: "none",
  alertBefore: "1 day",
};

const SmartReminder = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [savedCaseSummary, setSavedCaseSummary] = useState("");
  const [caseSummary, setCaseSummary] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortBy, setSortBy] = useState("date");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [form, setForm] = useState(defaultForm);
  const [reminders, setReminders] = useState([]);

  const persistReminders = async (items) => {
    const metaById = {};
    items.forEach((item) => {
      metaById[item.id] = {
        priority: item.priority || "medium",
        repeat: item.repeat || "none",
        alertBefore: item.alertBefore || "1 day",
        completed: Boolean(item.completed),
      };
    });
    saveReminders(items.map(toServerReminder));
    saveMeta(metaById);
    setReminders(items);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await fetch(`${apiUrl}/user/reminders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": user.id,
      },
      body: JSON.stringify({
        reminders: items.map(toServerReminder),
        replace: true,
      }),
    });
  };

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const localMeta = loadMeta();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          const local = loadReminders().map((item) => {
            const meta = localMeta[item.id] || {};
            return {
              ...item,
              priority: meta.priority || "medium",
              repeat: meta.repeat || "none",
              alertBefore: meta.alertBefore || "1 day",
              completed: Boolean(meta.completed),
            };
          });
          setReminders(local);
          setIsLoading(false);
          return;
        }

        const res = await fetch(`${apiUrl}/user/reminders`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": user.id,
          },
        });

        const data = res.ok ? await res.json() : { reminders: [] };
        const source = Array.isArray(data.reminders) && data.reminders.length > 0
          ? data.reminders
          : loadReminders();

        const enriched = source.map((item) => {
          const meta = localMeta[item.id] || {};
          return {
            ...item,
            priority: meta.priority || "medium",
            repeat: meta.repeat || "none",
            alertBefore: meta.alertBefore || "1 day",
            completed: Boolean(meta.completed),
          };
        });
        setReminders(enriched);

        const caseRes = await fetch(`${apiUrl}/user/current-case?source=smart-reminder`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": user.id,
          },
        });
        if (caseRes.ok) {
          const caseData = await caseRes.json();
          setSavedCaseSummary(sanitizeCaseSummary(caseData.case?.summary || ""));
        }
      } catch (error) {
        const local = loadReminders();
        const localMeta = loadMeta();
        setReminders(
          local.map((item) => {
            const meta = localMeta[item.id] || {};
            return {
              ...item,
              priority: meta.priority || "medium",
              repeat: meta.repeat || "none",
              alertBefore: meta.alertBefore || "1 day",
              completed: Boolean(meta.completed),
            };
          }),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchReminders();
  }, []);

  const enrichedReminders = useMemo(() => {
    return reminders
      .map((item) => ({
        ...item,
        daysAway: getDaysAway(item.date),
      }))
      .filter((item) => item.daysAway !== null);
  }, [reminders]);

  const stats = useMemo(() => {
    return {
      overdue: enrichedReminders.filter((item) => item.daysAway < 0 && !item.completed).length,
      today: enrichedReminders.filter((item) => item.daysAway === 0 && !item.completed).length,
      upcoming: enrichedReminders.filter((item) => item.daysAway > 0 && !item.completed).length,
    };
  }, [enrichedReminders]);

  const smartSuggestions = useMemo(() => {
    const nearest = enrichedReminders
      .filter((item) => !item.completed)
      .sort((a, b) => a.daysAway - b.daysAway)[0];

    if (!nearest) {
      return [
        "Add your next hearing date first to unlock preparation suggestions.",
      ];
    }

    if (nearest.daysAway <= 1) {
      return [
        "Keep documents and ID proof ready now.",
        "Set a travel buffer reminder to avoid delays.",
      ];
    }
    if (nearest.daysAway <= 7) {
      return [
        "Create a 24-hour pre-hearing checklist reminder.",
        "Set a follow-up reminder for outcome notes.",
      ];
    }
    return [
      "Add an evidence-review reminder 7 days before hearing.",
      "Set a draft-submission checkpoint to stay ahead.",
    ];
  }, [enrichedReminders]);

  const displayReminders = useMemo(() => {
    const filteredByStatus = enrichedReminders.filter((item) => {
      if (statusFilter === "active") return !item.completed;
      if (statusFilter === "completed") return item.completed;
      if (statusFilter === "overdue") return item.daysAway < 0 && !item.completed;
      return true;
    });

    const filteredByPriority = filteredByStatus.filter((item) => {
      if (priorityFilter === "all") return true;
      return item.priority === priorityFilter;
    });

    const sorted = [...filteredByPriority].sort((a, b) => {
      if (sortBy === "priority") {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      if (sortBy === "created") {
        return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      }
      return a.daysAway - b.daysAway;
    });

    return sorted;
  }, [enrichedReminders, priorityFilter, sortBy, statusFilter]);

  const saveCaseSummary = async (summary) => {
    const cleanSummary = sanitizeCaseSummary(summary);
    if (!cleanSummary) {
      setFormError("Please enter a plain case summary (not assistant instructions).");
      return false;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    await fetch(`${apiUrl}/user/current-case`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": user.id,
      },
      body: JSON.stringify({
        summary: cleanSummary,
        service: "Smart Reminder",
        source: "smart-reminder",
      }),
    });
    setSavedCaseSummary(cleanSummary);
    return true;
  };

  const handleAddReminder = async (preset = null) => {
    const source = preset || form;
    if (!source.title.trim() || !source.date || !normalizeDate(source.date)) {
      setFormError("Please enter a valid title and date.");
      return;
    }
    setFormError("");
    setIsSaving(true);
    try {
      if (caseSummary.trim()) {
        const didSaveSummary = await saveCaseSummary(caseSummary);
        if (!didSaveSummary) return;
      }
      const nextItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        title: source.title.trim(),
        date: source.date,
        time: source.time || "10:00 AM",
        location: source.location || "Court",
        type: source.type || "Hearing",
        priority: source.priority || "medium",
        repeat: source.repeat || "none",
        alertBefore: source.alertBefore || "1 day",
        completed: false,
        updated_at: new Date().toISOString(),
      };
      const next = [nextItem, ...reminders];
      await persistReminders(next);
      setForm(defaultForm);
      setQuickInput("");
    } catch (error) {
      setFormError("Could not save reminder. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAdd = async () => {
    const parsed = parseQuickReminder(quickInput, form.time);
    if (!parsed) {
      setFormError("Use phrases like 'Hearing tomorrow' or 'Docs in 3 days'.");
      return;
    }
    await handleAddReminder({
      ...form,
      ...parsed,
      priority: "high",
      type: "Quick Reminder",
    });
  };

  const updateReminder = async (id, updateFn) => {
    setIsSaving(true);
    setFormError("");
    try {
      const next = reminders.map((item) => {
        if (item.id !== id) return item;
        return {
          ...updateFn(item),
          updated_at: new Date().toISOString(),
        };
      });
      await persistReminders(next);
    } catch (error) {
      setFormError("Could not update reminder right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteReminder = async (id) => {
    setIsSaving(true);
    setFormError("");
    try {
      const next = reminders.filter((item) => item.id !== id);
      await persistReminders(next);
    } catch (error) {
      setFormError("Could not delete reminder right now.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="hidden xl:block fixed right-6 top-28 z-40">
      <div className="flex flex-col items-end gap-3 h-[calc(100vh-7rem)]">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold backdrop-blur-md hover:bg-white/20 transition"
        >
          Smart Reminder+
          {!isOpen && stats.today + stats.overdue > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-amber-400 text-slate-900 text-[11px] font-bold flex items-center justify-center">
              {stats.today + stats.overdue}
            </span>
          )}
        </button>

        <div
          className={`w-96 flex-1 min-h-0 transition-all duration-300 origin-top-right ${
            isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
          }`}
        >
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl h-full flex flex-col min-h-0">
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Smart Reminder</p>
              <h3 className="text-lg font-semibold text-white mt-1">Advanced Court Planner</h3>
              <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-200">
                  Overdue: {stats.overdue}
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
                  Today: {stats.today}
                </div>
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-200">
                  Upcoming: {stats.upcoming}
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto overscroll-y-contain pr-1 min-h-0">
              <div className="space-y-3 border border-white/10 rounded-xl p-4 bg-white/5">
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-300">Case summary</label>
                  <textarea
                    rows={2}
                    value={caseSummary}
                    onChange={(e) => setCaseSummary(e.target.value)}
                    className="mt-2 w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder={savedCaseSummary || "Short case context for reminders"}
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-300">Quick add</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={quickInput}
                      onChange={(e) => setQuickInput(e.target.value)}
                      className="w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="e.g. Evidence review tomorrow"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAdd}
                      disabled={isSaving}
                      className="px-3 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600 transition disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-300">Title</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="mt-2 w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Next hearing"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-300">Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                      className="mt-2 w-full rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-300">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                      className="lexassist-select mt-2 w-full appearance-none rounded-lg bg-slate-900/70 border border-white/20 px-3 pr-8 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-300">Repeat</label>
                    <select
                      value={form.repeat}
                      onChange={(e) => setForm((prev) => ({ ...prev, repeat: e.target.value }))}
                      className="lexassist-select mt-2 w-full appearance-none rounded-lg bg-slate-900/70 border border-white/20 px-3 pr-8 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-300">Alert</label>
                    <select
                      value={form.alertBefore}
                      onChange={(e) => setForm((prev) => ({ ...prev, alertBefore: e.target.value }))}
                      className="lexassist-select mt-2 w-full appearance-none rounded-lg bg-slate-900/70 border border-white/20 px-3 pr-8 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="30 min">30 min</option>
                      <option value="1 hour">1 hour</option>
                      <option value="1 day">1 day</option>
                      <option value="2 days">2 days</option>
                    </select>
                  </div>
                </div>

                {formError && <p className="text-xs text-amber-200">{formError}</p>}

                <button
                  type="button"
                  onClick={() => handleAddReminder()}
                  disabled={isSaving}
                  className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save reminder"}
                </button>
              </div>

              <div className="space-y-3 border border-white/10 rounded-xl p-4 bg-white/5">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Smart Suggestions</p>
                <ul className="space-y-2">
                  {smartSuggestions.map((tip, idx) => (
                    <li key={`tip-${idx}`} className="text-xs text-slate-200">
                      - {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="lexassist-select flex-1 appearance-none rounded-lg bg-slate-900/70 border border-white/20 px-3 pr-8 py-2 text-xs text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="active">Active</option>
                    <option value="overdue">Overdue</option>
                    <option value="completed">Completed</option>
                    <option value="all">All</option>
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="lexassist-select flex-1 appearance-none rounded-lg bg-slate-900/70 border border-white/20 px-3 pr-8 py-2 text-xs text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="all">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="lexassist-select flex-1 appearance-none rounded-lg bg-slate-900/70 border border-white/20 px-3 pr-8 py-2 text-xs text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="date">Sort: Date</option>
                    <option value="priority">Sort: Priority</option>
                    <option value="created">Sort: Recent</option>
                  </select>
                </div>

                {isLoading ? (
                  <div className="text-sm text-slate-300">Loading reminders...</div>
                ) : displayReminders.length === 0 ? (
                  <div className="text-sm text-slate-300">No reminders match your filters.</div>
                ) : (
                  displayReminders.map((reminder) => {
                    const label = getDateLabel(reminder.daysAway);
                    const toneClasses = getToneClasses(label.tone);
                    return (
                      <div
                        key={reminder.id}
                        className={`border border-white/10 rounded-xl p-4 bg-white/5 ${
                          reminder.completed ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-semibold ${
                              reminder.completed ? "line-through text-slate-400" : "text-white"
                            }`}
                          >
                            {reminder.title}
                          </p>
                          <span className={`text-[11px] px-2 py-1 rounded-full border ${toneClasses}`}>
                            {label.text}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-200">
                          {formatDisplayDate(reminder.date)} · {reminder.time || "10:00 AM"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{reminder.location || "Court"}</div>
                        {savedCaseSummary ? (
                          <div className="mt-1 text-xs text-slate-300">Case: {savedCaseSummary}</div>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2 text-[11px]">
                          <span className={`px-2 py-1 rounded-full border ${getPriorityClasses(reminder.priority)}`}>
                            {reminder.priority || "medium"} priority
                          </span>
                          <span className="px-2 py-1 rounded-full border border-white/20 text-slate-300">
                            {reminder.repeat || "none"}
                          </span>
                          <span className="px-2 py-1 rounded-full border border-white/20 text-slate-300">
                            alert {reminder.alertBefore || "1 day"}
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded-md bg-emerald-600/70 text-white hover:bg-emerald-500/80 transition"
                            onClick={() =>
                              updateReminder(reminder.id, (item) => ({
                                ...item,
                                completed: !item.completed,
                              }))
                            }
                          >
                            {reminder.completed ? "Mark active" : "Mark done"}
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-600 transition"
                            onClick={() =>
                              updateReminder(reminder.id, (item) => {
                                const current = normalizeDate(item.date);
                                if (!current) return item;
                                current.setDate(current.getDate() + 1);
                                return { ...item, date: toDateValue(current) };
                              })
                            }
                          >
                            Snooze 1 day
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded-md bg-red-600/70 text-white hover:bg-red-500/80 transition"
                            onClick={() => deleteReminder(reminder.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SmartReminder;
