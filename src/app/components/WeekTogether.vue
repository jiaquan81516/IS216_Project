<script setup>
import { computed } from "vue";
import "@/app/app.css";

defineOptions({ name: "WeekTogether" });

// The last seven days, side by side. It shows who covered what, not who is winning.
const props = defineProps({
  summary: { type: Object, required: true }, // from weeklyTogether()
  myName: { type: String, default: "You" },
  partnerName: { type: String, default: "Your partner" },
});

const rows = computed(() => [
  { key: "nights", label: "Nights on duty", me: props.summary.me.nights, partner: props.summary.partner.nights },
  { key: "logs", label: "Care logs", me: props.summary.me.logs, partner: props.summary.partner.logs },
  { key: "tasks", label: "Tasks done", me: props.summary.me.tasks, partner: props.summary.partner.tasks },
  { key: "thanks", label: "Thank yous sent", me: props.summary.me.thanks, partner: props.summary.partner.thanks },
]);
</script>

<template>
  <section class="wt" aria-labelledby="wt-title">
    <h2 id="wt-title" class="wt__title">This week, together</h2>
    <table class="wt__table">
      <caption class="visually-hidden">Last seven days for each of you</caption>
      <thead>
        <tr>
          <th scope="col"><span class="visually-hidden">What</span></th>
          <th scope="col">{{ myName }}</th>
          <th scope="col">{{ partnerName }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <th scope="row">{{ row.label }}</th>
          <td>{{ row.me }}</td>
          <td>{{ row.partner }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="summary.sharedNights" class="wt__muted">
      {{ summary.sharedNights }} shared {{ summary.sharedNights === 1 ? "night" : "nights" }} not counted above.
    </p>
    <p v-if="summary.line" class="wt__line">{{ summary.line }}</p>
    <p class="wt__prompt"><span class="wt__label">Talk about it</span>{{ summary.prompt }}</p>
  </section>
</template>

<style scoped>
.wt { display: flex; flex-direction: column; gap: 12px; padding: 20px; background: var(--nt-white, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.wt__title { margin: 0; font-family: Inter, system-ui, sans-serif; font-size: 1rem; font-weight: 600; line-height: 1.3; color: var(--nt-ink); }
.wt__table { width: 100%; border-collapse: collapse; font-size: 0.875rem; color: var(--nt-ink); }
.wt__table th, .wt__table td { padding: 8px 0; border-top: 1px solid var(--nt-line); text-align: right; font-weight: 500; }
.wt__table thead th { border-top: 0; padding-top: 0; color: var(--nt-muted); font-weight: 500; }
.wt__table tbody th { text-align: left; font-weight: 400; color: var(--nt-muted); }
.wt__muted { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }
.wt__line { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.wt__prompt { margin: 0; padding-top: 12px; border-top: 1px solid var(--nt-line); font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.wt__label { display: block; margin-bottom: 4px; font-size: 0.875rem; color: var(--nt-muted); }
</style>
