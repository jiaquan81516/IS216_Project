import { computed, onBeforeUnmount, ref, watch } from "vue";
import { dateKey, useCheckinsStore } from "@/app/stores/checkins";
import { displayName } from "@/app/composables/useHome";
import { tonightDate } from "@/app/utils/homeSummary";
import { suggestionsFor } from "@/app/utils/chatHelpers";
import {
  buildNudges,
  feelingLevel,
  loadSignals,
  needsSupport,
  onDutyRun,
  partnerRecentLog,
  weeklyTogether,
} from "@/app/utils/loadHelpers";

// Key used by the layout to share the chat and its prompts with the pages.
export const NUDGES_KEY = Symbol("app-nudges");

// Which prompt lines you have already seen today, per account, so a line that is still true
// tomorrow pops up again.
const LINES_KEY = "nt.app.chat-lines";
function readLines(uid, day) {
  try {
    const value = JSON.parse(localStorage.getItem(`${LINES_KEY}:${uid}`) || "[]");
    return Array.isArray(value) ? value.filter((k) => typeof k === "string" && k.startsWith(`${day}:`)) : [];
  } catch {
    return [];
  }
}

// Things your partner did, sent or chose to share. These can pop up for a moment.
// A partner's hard day is deliberately not here: it shows quietly on Home, and never pops up.
const TOAST_KINDS = ["partner-logged", "partner-heavy"];

// The chat between the two parents, with the quiet prompts and suggested replies that go with
// it. Used by the chat button (panel, unread dot, pop up) and by Wellness (the weekly summary).
export function useNudges({ home, entries, shared }) {
  const team = shared.team;
  const chat = shared.chat;
  const checkins = useCheckinsStore();

  const now = ref(new Date());
  const clock = setInterval(() => {
    now.value = new Date();
  }, 60000);
  onBeforeUnmount(() => clearInterval(clock));
  // A log made a moment ago is stamped by the server after the last clock tick, so without this
  // it would count as "in the future" and be missed until the next minute.
  watch(
    () => [entries.entries.value, chat.messages, team.feelings],
    () => {
      now.value = new Date();
    },
  );

  const myUid = computed(() => home.me.value.uid);
  const partnerUid = computed(() => home.partner.value?.uid ?? "");
  const partnerFirst = computed(() => (home.partner.value ? displayName(home.partner.value.firstName) : ""));
  const todayKey = computed(() => dateKey(now.value));

  const rotaView = computed(() => (shared.rota?.settings ? shared.rota.view : null));
  const nightDate = computed(() => tonightDate(now.value, rotaView.value?.handoverTime));
  const signalsFor = (uid, who) =>
    loadSignals({
      entries: entries.entries.value,
      uid,
      now: now.value,
      run: onDutyRun({ view: rotaView.value, upTo: nightDate.value, who }),
    });
  const partnerSignals = computed(() => (partnerUid.value ? signalsFor(partnerUid.value, "partner") : null));

  const partnerToday = computed(() => checkins.partnerItems?.[todayKey.value] ?? null);

  // The quiet prompts at the top of the chat.
  const nudges = computed(() =>
    buildNudges({
      now: now.value,
      partnerName: partnerFirst.value || "Your partner",
      me: signalsFor(myUid.value, "me"),
      partner: partnerSignals.value,
      recentLog: partnerRecentLog({ entries: entries.entries.value, partnerUid: partnerUid.value, now: now.value }),
      checkedInToday: Boolean(checkins.forDate(todayKey.value)),
      // Your partner's check-in today is shared, so it speaks for itself.
      partnerFeeling: partnerToday.value
        ? { level: feelingLevel(partnerToday.value), date: todayKey.value }
        : team.partnerFeeling,
      supportNeeded: needsSupport(checkins.lastSeven(now.value), now.value),
      settings: home.settings?.value ?? null,
      dismissed: team.dismissed,
    }),
  );

  const suggestions = computed(() =>
    suggestionsFor({
      nudges: nudges.value,
      messages: chat.messages,
      uid: myUid.value,
      partnerLogs: partnerSignals.value?.logs ?? 0,
      now: now.value,
    }),
  );

  const together = computed(() =>
    home.partner.value
      ? weeklyTogether({
          entries: entries.entries.value,
          tasks: shared.rtw.tasks,
          chat: chat.messages,
          view: rotaView.value,
          uid: myUid.value,
          partnerUid: partnerUid.value,
          partnerName: partnerFirst.value || "Your partner",
          tonight: nightDate.value,
          now: now.value,
        })
      : null,
  );

  // Prompt lines you have not looked at yet today. They count toward the dot on the button.
  const seenLines = ref(readLines(myUid.value, todayKey.value));
  watch(myUid, (uid) => {
    seenLines.value = readLines(uid, todayKey.value);
  });
  const lineKey = (n) => `${todayKey.value}:${n.id}`;
  const unseenLines = computed(() => nudges.value.filter((n) => !seenLines.value.includes(lineKey(n))));
  function markLinesSeen() {
    const keys = nudges.value.map(lineKey);
    seenLines.value = [...new Set([...seenLines.value.filter((k) => k.startsWith(`${todayKey.value}:`)), ...keys])];
    try {
      localStorage.setItem(`${LINES_KEY}:${myUid.value}`, JSON.stringify(seenLines.value));
    } catch {
      // The dot then comes back next visit. Nothing else depends on this.
    }
  }

  // The panel. While it is open everything is read.
  const open = ref(false);
  function openChat() {
    open.value = true;
  }
  function closeChat() {
    open.value = false;
  }
  watch(
    () => [open.value, chat.messages, nudges.value],
    () => {
      if (!open.value) return;
      chat.markRead();
      markLinesSeen();
    },
  );

  function dismiss(nudge) {
    team.dismiss(nudge.id, todayKey.value);
    closeToast(nudge.id);
  }

  // Sends one message. When it answers a prompt, that prompt is hidden for the day.
  async function send(text, kind = "text", nudgeId = null) {
    const ok = await chat.send(text, kind);
    if (ok && nudgeId) team.dismiss(nudgeId, todayKey.value);
    return ok;
  }

  // Pop ups: only for things that appear after the app has loaded, never for what was already
  // there, and never while the panel is open. Everything they show is also in the chat.
  const toasts = ref([]);
  let known = new Set();
  const ready = computed(() => Boolean(home.householdId.value) && !entries.loading.value && !team.loading && !chat.loading);
  let armed = false;
  let armTimer = null;
  const candidates = () => [
    ...nudges.value.filter((n) => TOAST_KINDS.includes(n.kind)),
    ...chat.messages
      .filter((m) => m.from !== myUid.value)
      .map((m) => ({ id: `msg:${m.id}`, kind: "message", title: partnerFirst.value || "Your partner", text: m.text })),
  ];
  watch(
    ready,
    (isReady) => {
      clearTimeout(armTimer);
      armed = false;
      if (!isReady) return;
      // Wait a moment so the first snapshots of every listener are in before we start watching.
      armTimer = setTimeout(() => {
        // Messages already in the chat are covered by the unread dot. A prompt line you have
        // not seen yet still pops up once.
        known = new Set(candidates().filter((n) => n.id.startsWith("msg:") || seenLines.value.includes(lineKey(n))).map((n) => n.id));
        const fresh = candidates().filter((n) => !known.has(n.id));
        known = new Set(candidates().map((n) => n.id));
        armed = true;
        if (fresh.length && !open.value) toasts.value = fresh.slice(-3);
      }, 1500);
    },
    { immediate: true },
  );
  onBeforeUnmount(() => clearTimeout(armTimer));

  watch([nudges, () => chat.messages], () => {
    if (!armed) return;
    const list = candidates();
    const fresh = list.filter((n) => !known.has(n.id));
    known = new Set(list.map((n) => n.id));
    if (fresh.length && !open.value) toasts.value = [...toasts.value.filter((t) => !fresh.some((f) => f.id === t.id)), ...fresh].slice(-3);
  });
  function closeToast(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }
  // A pop up from outside the chat, for example a task your partner just gave you.
  function showToast(toast) {
    if (!toast?.id) return;
    toasts.value = [...toasts.value.filter((t) => t.id !== toast.id), toast].slice(-3);
  }

  return {
    nudges,
    suggestions,
    together,
    partnerFirst,
    messages: computed(() => chat.messages),
    unread: computed(() => chat.unread + unseenLines.value.length),
    writeError: computed(() => chat.writeError),
    open,
    openChat,
    closeChat,
    send,
    dismiss,
    toasts,
    closeToast,
    showToast,
  };
}
