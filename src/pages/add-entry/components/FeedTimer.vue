<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { SAMPLE } from "@/shared/constants/appConstants";

const emit = defineEmits(["stop"]);

const running = ref(false);
const seconds = ref(0);
let startedAt = 0;
let timer = null;

const display = computed(() => {
  const m = String(Math.floor(seconds.value / 60)).padStart(2, "0");
  const s = String(seconds.value % 60).padStart(2, "0");
  return `${m}:${s}`;
});

function tick() {
  seconds.value = Math.floor((Date.now() - startedAt) / 1000);
}
function start() {
  startedAt = Date.now() - seconds.value * 1000;
  running.value = true;
  timer = setInterval(tick, 1000);
}
function stop() {
  if (!running.value) return;
  clearInterval(timer);
  timer = null;
  tick();
  running.value = false;
  emit("stop", seconds.value);
}
function toggle() {
  if (running.value) stop();
  else start();
}

onBeforeUnmount(() => clearInterval(timer));
defineExpose({ stop });
</script>

<template>
  <section class="nt-card" aria-label="Live feed timer">
    <h2 class="nt-heading nt-heading--sm">Live feed timer</h2>
    <p class="timer" role="timer" :aria-live="running ? 'off' : 'polite'">{{ display }}</p>
    <p class="nt-small nt-muted mb-0">
      Start the timer when the feed begins. Mei sees "{{ SAMPLE.me }} is feeding" on her phone until you stop it.
    </p>
    <div>
      <AppButton variant="outline" @click="toggle">{{ running ? "Stop timer" : "Start timer" }}</AppButton>
    </div>
  </section>
</template>

<style scoped>
.timer {
  margin: 0;
  font-family: var(--nt-serif);
  font-size: 3rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
</style>
