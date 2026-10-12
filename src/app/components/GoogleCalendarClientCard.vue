<script setup>
import "@/app/app.css";
import { computed } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import Toggle from "@/app/components/Toggle.vue";
import { useCalendarStore } from "@/app/stores/calendar";
import { useRotaStore } from "@/app/stores/rota";
import {
  connectGoogle,
  disconnectGoogle,
  setGoogleToggle,
  syncGoogleNow,
  useGoogleCalendarClient,
} from "@/app/composables/useGoogleCalendarClient";

defineOptions({ name: "GoogleCalendarClientCard" });

const props = defineProps({
  householdId: { type: String, default: "" },
  uid: { type: String, default: "" },
});

// The shared stores are bound once by the app shell. Without Pinia (a lone test) the card
// still renders and syncs nothing.
function tryStore(use) {
  try {
    return use();
  } catch {
    return null;
  }
}
const rota = tryStore(useRotaStore);
const calendar = tryStore(useCalendarStore);

const { state, countsText } = useGoogleCalendarClient();

const lastSyncText = computed(() => {
  if (!state.lastSync) return "";
  const at = state.lastSync.at instanceof Date ? state.lastSync.at : new Date(state.lastSync.at);
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (state.lastSync.wanted === 0) {
    return `Last sync ${time}. Nothing to send yet. Add an appointment on the Calendar page, or set your nights in the rota, then sync again.`;
  }
  return `Last sync ${time}. ${countsText.value}.`;
});

function sync() {
  return syncGoogleNow({
    householdId: props.householdId || calendar?.householdId || "",
    uid: props.uid || rota?.meUid || "",
    rotaView: rota?.view ?? null,
    handoverTime: rota?.plan?.handoverTime ?? "07:00",
    events: calendar?.events ?? [],
  });
}
</script>

<template>
  <div class="gcc">
    <p v-if="state.connecting" class="gcc__text" role="status">Connecting to Google...</p>
    <p v-else-if="state.connected" class="gcc__text">
      {{ state.email ? `Connected as ${state.email}` : "Connected" }}
    </p>
    <p v-else class="gcc__muted">Not connected. Appointments stay inside NurtureTrack.</p>

    <div class="gcc__actions">
      <AppButton v-if="!state.connected" variant="outline" size="sm" :disabled="state.connecting" @click="connectGoogle">
        {{ state.connecting ? "Connecting..." : "Connect Google Calendar" }}
      </AppButton>
      <AppButton v-else variant="outline" size="sm" :disabled="state.syncing" @click="sync">
        {{ state.syncing ? "Syncing..." : "Sync now" }}
      </AppButton>
      <button v-if="state.connected" type="button" class="gcc__link" @click="disconnectGoogle">Disconnect</button>
    </div>

    <p v-if="state.error" class="app-error-text" role="alert">{{ state.error }}</p>

    <template v-if="state.connected">
      <p v-if="lastSyncText" class="gcc__muted" role="status" aria-live="polite">{{ lastSyncText }}</p>
      <div class="gcc__rows">
        <Toggle
          id="gcc-rota"
          label="Add my night duty"
          :model-value="state.toggles.rota"
          @update:model-value="setGoogleToggle('rota', $event)"
        />
        <Toggle
          id="gcc-appts"
          label="Add appointments"
          :model-value="state.toggles.appointments"
          @update:model-value="setGoogleToggle('appointments', $event)"
        />
        <Toggle
          id="gcc-show"
          label="Show Google events"
          hint="Your next 14 days from Google, read only, on the Calendar page."
          :model-value="state.toggles.show"
          @update:model-value="setGoogleToggle('show', $event)"
        />
      </div>
    </template>

    <p class="gcc__muted">
      Google access stays in this browser tab only. Close the tab and you connect again. Nothing about it is saved to NurtureTrack.
    </p>
  </div>
</template>

<style scoped>
.gcc { display: flex; flex-direction: column; gap: 14px; }
.gcc__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.gcc__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.gcc__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.gcc__rows { display: flex; flex-direction: column; gap: 16px; }
.gcc__link { padding: 4px 0; background: none; border: 0; font: inherit; font-size: 0.875rem; color: var(--nt-plum); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.gcc__link:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
</style>
