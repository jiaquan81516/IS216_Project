<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import ChoiceRow from "@/components/ui/ChoiceRow.vue";
import StepperBar from "@/components/ui/StepperBar.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import {
  ALERT_ROWS,
  NIGHT_ENDS,
  NIGHT_STARTS,
  WEEK_DAYS,
  WHO_NAMES,
} from "@/data/setupNights";
import { ROUTES } from "@/shared/constants/routes";
import { useHouseholdStore } from "@/stores/household";

defineOptions({ name: "setup-nightsPage" });

const household = useHouseholdStore();
const router = useRouter();

// One radio group over two store fields: "manual" is a mode, D and M set who goes first.
const onCall = computed({
  get: () => (household.nights.mode === "manual" ? "manual" : household.nights.first),
  set: (v) => {
    if (v === "manual") {
      household.nights.mode = "manual";
    } else {
      household.nights.mode = "alternate";
      household.nights.first = v;
    }
  },
});

const withCurrent = (list, current) => (list.includes(current) ? list : [current, ...list]);
const starts = computed(() => withCurrent(NIGHT_STARTS, household.nights.start));
const ends = computed(() => withCurrent(NIGHT_ENDS, household.nights.end));

const week = computed(() => {
  const other = household.nights.first === "D" ? "M" : "D";
  return WEEK_DAYS.map((day, i) => {
    const who = i % 2 === 0 ? household.nights.first : other;
    return { day, who, name: WHO_NAMES[who] };
  });
});

// Push notifications.
const perm = ref(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
const permText = computed(
  () =>
    ({
      default: "Not allowed yet on this device.",
      granted: "Allowed on this device.",
      denied: "Blocked in your browser settings.",
      unsupported: "Not supported on this device.",
    })[perm.value],
);
async function allowNotifications() {
  try {
    perm.value = await Notification.requestPermission();
  } catch {
    perm.value = "denied";
  }
}

// Google Calendar placeholder.
const calendarConnected = ref(false);

function finish() {
  household.completeOnboarding();
  router.push(ROUTES.HOME);
}
</script>

<template>
  <div class="nt-cols nt-cols--onboarding">
    <form class="nt-col nights" novalidate @submit.prevent="finish">
      <StepperBar :current="4" />
      <div class="nights__title">
        <h1 class="nt-title nt-title--xl">Set your nights and alerts.</h1>
        <p class="nt-lead mb-0">Decide who is on call first. You can swap or override any night later.</p>
      </div>

      <div class="nights__group" role="radiogroup" aria-labelledby="nights-who">
        <p id="nights-who" class="nights__label mb-0">Who is on call tonight?</p>
        <ChoiceRow v-model="onCall" name="oncall" value="D" title="Me, Daniel" />
        <ChoiceRow
          v-model="onCall"
          name="oncall"
          value="M"
          title="Mei"
          description="Alternate every night after this."
        />
        <ChoiceRow v-model="onCall" name="oncall" value="manual" title="We will decide each night" />
      </div>

      <div class="nights__pair">
        <div class="nights__field">
          <label class="nights__label" for="night-start">Night starts</label>
          <select id="night-start" v-model="household.nights.start" class="form-select nights__select">
            <option v-for="t in starts" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="nights__field">
          <label class="nights__label" for="night-end">Night ends</label>
          <select id="night-end" v-model="household.nights.end" class="form-select nights__select">
            <option v-for="t in ends" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>

      <p class="nt-small nt-muted mb-0">
        Swaps need your partner to say yes. Either of you can override a night, and the other is told straight away.
      </p>

      <div>
        <h2 class="nights__label mb-0">Alerts</h2>
        <ul class="nights__rows">
          <li v-for="a in ALERT_ROWS" :key="a.key" class="nights__row">
            <div class="nights__row-text">
              <span class="nights__row-title">{{ a.title }}</span>
              <span class="nights__row-desc">{{ a.description }}</span>
            </div>
            <ToggleSwitch v-model="household.alerts[a.key]" :label="a.title" />
          </li>
          <li class="nights__row">
            <div class="nights__row-text">
              <span class="nights__row-title">Push notifications</span>
              <span class="nights__row-desc" aria-live="polite">{{ permText }}</span>
            </div>
            <AppButton variant="outline" size="md" :disabled="perm !== 'default'" @click="allowNotifications">
              Allow notifications
            </AppButton>
          </li>
          <li class="nights__row">
            <div class="nights__row-text">
              <span class="nights__row-title">Google Calendar</span>
              <span class="nights__row-desc">
                {{
                  calendarConnected ? "Connected (demo)" : "Put nights and appointments on your calendar."
                }}
              </span>
            </div>
            <AppButton
              variant="outline"
              size="md"
              :disabled="calendarConnected"
              @click="calendarConnected = true"
            >
              {{ calendarConnected ? "Connected (demo)" : "Connect" }}
            </AppButton>
          </li>
        </ul>
      </div>

      <div class="nights__actions">
        <AppButton type="submit">Finish and open Home</AppButton>
        <AppLink :to="ROUTES.SETUP_PARTNER">Back</AppLink>
      </div>
    </form>

    <aside class="nt-col">
      <AppCard title="Your first week">
        <ol class="week">
          <li v-for="d in week" :key="d.day" class="week__row">
            <span class="week__day">{{ d.day }}</span>
            <span class="week__bar" :class="`nt-who--${d.who}`">{{ d.name }}</span>
          </li>
        </ol>
        <p class="nt-small nt-muted mb-0">Each bar is one night, 6 PM to 6 AM. We start with alternating nights.</p>
      </AppCard>
    </aside>
  </div>
</template>

<style scoped>
.nights {
  gap: 28px;
}
.nights__title {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.nights__group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.nights__label {
  display: block;
  font-size: 1rem;
  font-weight: 500;
  color: var(--nt-ink);
}
.nights__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.nights__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nights__field .nights__label {
  font-size: 0.9375rem;
}
.nights__select {
  padding: 12px 14px;
  font-size: 0.9375rem;
}
.nights__rows {
  margin: 0;
  padding: 0;
  list-style: none;
}
.nights__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
}
.nights__row + .nights__row {
  border-top: 1px solid var(--nt-line);
}
.nights__row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.nights__row-title {
  font-size: 1rem;
  font-weight: 500;
}
.nights__row-desc {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.nights__actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.week {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.week__row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.week__day {
  width: 56px;
  flex: none;
  font-size: 0.875rem;
  font-weight: 500;
}
.week__bar {
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 28px;
  border-radius: 6px;
}
@media (max-width: 575px) {
  .nights__pair {
    grid-template-columns: minmax(0, 1fr);
  }
  .nights__row {
    flex-wrap: wrap;
  }
}
</style>
