<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import "@/app/app.css";
import AppButton from "@/components/ui/AppButton.vue";
import Icon from "@/app/components/Icon.vue";
import { usePrefs } from "@/app/composables/usePrefs";
import { toDate } from "@/app/utils/entryHelpers";
import { CHAT_TEXT_MAX } from "@/api/chat";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "ChatDock" });

// A small chat button on every page. It opens a panel with your partner: the messages, a few
// quiet prompts (when the app notices something) and one tap replies. No solid button here, so
// a page keeps its one solid action.
const props = defineProps({
  chat: { type: Object, required: true }, // from useNudges()
  me: { type: String, default: "" },
});

const router = useRouter();
const { formatTime } = usePrefs();

const partnerName = computed(() => props.chat.partnerFirst.value);
const open = computed(() => props.chat.open.value);
const draft = ref("");
const thread = ref(null);
const input = ref(null);
const fab = ref(null);

// The most important line sits last, next to the replies and the box.
const lines = computed(() => [...props.chat.nudges.value].reverse());

// Replies that answer a line sit inside that line. The rest go in the row above the box.
const repliesFor = (nudge) => props.chat.suggestions.value.filter((s) => s.nudgeId === nudge.id);
const general = computed(() => props.chat.suggestions.value.filter((s) => !s.nudgeId));

const ACTION_ROUTES = { wellness: ROUTES.WELLNESS, support: ROUTES.SUPPORT };
const rows = computed(() =>
  props.chat.messages.value.map((m) => ({
    id: m.id,
    mine: m.from === props.me,
    thanks: m.kind === "thanks",
    text: m.text,
    time: formatTime(toDate(m.createdAt) ?? new Date()),
  })),
);

function scrollDown() {
  nextTick(() => {
    if (thread.value) thread.value.scrollTop = thread.value.scrollHeight;
  });
}
watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  input.value?.focus();
  scrollDown();
});
watch(() => [rows.value.length, lines.value.length], () => open.value && scrollDown());

function close() {
  props.chat.closeChat();
  fab.value?.focus();
}
function toggle() {
  if (open.value) close();
  else props.chat.openChat();
}
function onAction(nudge) {
  props.chat.closeChat();
  router.push(ACTION_ROUTES[nudge.action?.to] ?? ROUTES.HOME);
}
async function sendDraft() {
  const text = draft.value.trim();
  if (!text) return;
  if (await props.chat.send(text, "text")) draft.value = "";
}
function sendSuggestion(s) {
  return props.chat.send(s.text, s.kind, s.nudgeId);
}
</script>

<template>
  <div v-if="partnerName" class="cd">
    <section
      v-show="open"
      id="chat-panel"
      class="cd__panel"
      role="dialog"
      aria-modal="false"
      :aria-label="`Chat with ${partnerName}`"
      @keydown.esc="close"
    >
      <header class="cd__head">
        <h2 class="cd__title">{{ partnerName }}</h2>
        <button type="button" class="cd__close" aria-label="Close chat" @click="close"><Icon name="close" :size="18" /></button>
      </header>

      <div ref="thread" class="cd__thread">
        <ul class="cd__msgs" role="log" aria-live="polite" aria-label="Messages">
          <li v-for="row in rows" :key="row.id" class="cd__msg" :class="{ 'cd__msg--mine': row.mine }">
            <p class="cd__bubble">
              <Icon v-if="row.thanks" name="heart" :size="14" class="cd__heart" />
              {{ row.text }}
            </p>
            <span class="cd__time">{{ row.time }}</span>
          </li>
        </ul>
        <p v-if="!rows.length && !lines.length" class="cd__empty">Say something kind. A short note is enough.</p>

        <ul v-if="lines.length" class="cd__lines" aria-label="Right now">
          <li
            v-for="nudge in lines"
            :key="nudge.id"
            class="cd__line"
            :class="{ 'cd__line--bold': nudge.kind === 'partner-heavy', 'cd__line--care': ['partner-feeling', 'support', 'heavy-self'].includes(nudge.kind) }"
          >
            <p class="cd__line-title">{{ nudge.title }}</p>
            <p class="cd__line-text">{{ nudge.text }}</p>
            <div class="cd__line-actions">
              <template v-for="s in repliesFor(nudge)" :key="s.text">
                <button v-if="nudge.kind === 'partner-heavy'" type="button" class="cd__reply" @click="sendSuggestion(s)">{{ s.label }}</button>
                <AppButton v-else variant="outline" size="sm" @click="sendSuggestion(s)">{{ s.label }}</AppButton>
              </template>
              <AppButton v-if="nudge.action" variant="outline" size="sm" @click="onAction(nudge)">{{ nudge.action.label }}</AppButton>
              <button type="button" class="cd__link" @click="chat.dismiss(nudge)">Hide</button>
            </div>
          </li>
        </ul>

      </div>

      <div v-if="general.length" class="cd__sugg" aria-label="Suggestions">
        <AppButton v-for="s in general" :key="s.text" variant="outline" size="sm" @click="sendSuggestion(s)">
          {{ s.label }}
        </AppButton>
      </div>

      <p v-if="chat.writeError.value" class="app-error-text cd__error" role="alert">{{ chat.writeError.value }}</p>

      <form class="cd__form" @submit.prevent="sendDraft">
        <input
          ref="input"
          v-model="draft"
          class="cd__input"
          type="text"
          :maxlength="CHAT_TEXT_MAX"
          :placeholder="`Message ${partnerName}`"
          :aria-label="`Message ${partnerName}`"
          autocomplete="off"
        />
        <button type="submit" class="cd__send" :disabled="!draft.trim()">Send</button>
      </form>
    </section>

    <button
      ref="fab"
      type="button"
      class="cd__fab"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="chat-panel"
      :aria-label="`Chat with ${partnerName}`"
      @click="toggle"
    >
      <Icon name="chat" :size="22" />
      <span v-if="chat.unread.value > 0 && !open" class="cd__dot" aria-hidden="true"></span>
      <span v-if="chat.unread.value > 0 && !open" class="visually-hidden">{{ chat.unread.value }} unread</span>
    </button>
  </div>
</template>

<style scoped>
.cd { position: fixed; right: 24px; bottom: 24px; z-index: 30; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.cd__fab { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; padding: 0; background: var(--nt-white, #fff); border: 1px solid var(--nt-plum); border-radius: 12px; color: var(--nt-plum); cursor: pointer; }
.cd__fab:hover { background: var(--nt-gray, #f5f5f5); }
.cd__fab:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.cd__dot { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; background: var(--nt-coral, #c0553b); border: 2px solid #fff; border-radius: 50%; }

.cd__panel { display: flex; flex-direction: column; width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100vh - 120px)); background: var(--nt-white, #fff); border: 1px solid var(--nt-line); border-radius: 12px; overflow: hidden; }
.cd__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--nt-line); }
.cd__title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }
.cd__close { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; background: transparent; border: 0; border-radius: 8px; color: var(--nt-muted); cursor: pointer; }
.cd__close:hover { color: var(--nt-ink); }
.cd__close:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.cd__thread { display: flex; flex: 1; flex-direction: column; gap: 12px; min-height: 0; padding: 12px 16px; overflow-y: auto; }
.cd__lines, .cd__msgs { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.cd__thread > :first-child { margin-top: auto; }
.cd__empty { margin: 0; font-size: 0.875rem; text-align: center; color: var(--nt-muted); }

.cd__line { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: var(--nt-white, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.cd__line--care { border-left: 3px solid var(--nt-coral, #c0553b); }
.cd__line-title { margin: 0; font-size: 0.9375rem; font-weight: 600; line-height: 1.35; color: var(--nt-ink); }
.cd__line-text { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-ink); }
.cd__line-actions { display: flex; align-items: center; gap: 8px 12px; padding-top: 4px; }
.cd__link { padding: 4px 0; background: transparent; border: 0; font-family: inherit; font-size: 0.875rem; color: var(--nt-muted); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.cd__link:hover { color: var(--nt-ink); }
.cd__link:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
/* A long stretch for your partner: plum, white text, first in the list. */
.cd__line--bold { background: var(--nt-plum, #3b2f3f); border-color: var(--nt-plum, #3b2f3f); }
.cd__line--bold .cd__line-title, .cd__line--bold .cd__line-text { color: #fff; }
.cd__line--bold .cd__link { color: #e9e1ec; }
.cd__line--bold .cd__link:hover { color: #fff; }
.cd__line--bold .cd__link:focus-visible, .cd__line--bold .cd__reply:focus-visible { outline-color: #fff; }
.cd__reply { padding: 8px 14px; background: transparent; border: 1px solid #fff; border-radius: 8px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: #fff; cursor: pointer; }
.cd__reply:hover { background: rgba(255, 255, 255, 0.12); }

.cd__msg { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.cd__msg--mine { align-items: flex-end; }
.cd__bubble { max-width: 85%; margin: 0; padding: 8px 12px; background: var(--nt-gray, #f5f5f5); border: 1px solid var(--nt-line); border-radius: 12px; font-size: 0.9375rem; line-height: 1.4; color: var(--nt-ink); overflow-wrap: anywhere; }
.cd__msg--mine .cd__bubble { background: var(--nt-white, #fff); border-color: var(--nt-plum); }
.cd__heart { margin-right: 4px; vertical-align: -2px; color: var(--nt-coral, #c0553b); }
.cd__time { font-size: 0.875rem; color: var(--nt-muted); }

.cd__sugg { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 16px 0; border-top: 1px solid var(--nt-line); }
.cd__error { margin: 8px 16px 0; }
.cd__form { display: flex; gap: 8px; padding: 12px 16px; }
.cd__input { flex: 1; min-width: 0; padding: 8px 12px; background: var(--nt-white, #fff); border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; font-size: 0.9375rem; color: var(--nt-ink); }
.cd__input:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 1px; }
.cd__send { padding: 8px 14px; background: var(--nt-white, #fff); border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-ink); cursor: pointer; }
.cd__send:disabled { opacity: 0.5; cursor: default; }
.cd__send:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

@media (max-width: 575px) {
  .cd { right: 16px; bottom: 16px; }
  .cd__panel { height: min(560px, calc(100vh - 96px)); }
}
</style>
