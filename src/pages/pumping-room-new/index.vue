<script setup>
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import ChoiceChips from "@/components/ui/ChoiceChips.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import { ROUTES, path } from "@/shared/constants/routes";
import { FEATURES, addRoom, formatLevels, mallCatalogue, sortLevels } from "@/data/pumpingRooms";

defineOptions({ name: "pumping-room-newPage" });

const router = useRouter();
const malls = mallCatalogue();
const quickPicks = ["ION Orchard", "Raffles City", "Plaza Singapura"];
const levelOptions = ["B2", "B1", "1", "2", "3", "4", "5", "6"];
const answers = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

const mall = ref("Jem");
const levels = ref(["B1", "3"]);
const states = reactive({ power: "yes", lockable: "unsure", sink: "yes", stroller: "yes", fridge: "no" });
const note = ref("");

const info = computed(() => malls.find((m) => m.name === mall.value));
const previewLevels = computed(() => formatLevels(sortLevels(levels.value)));
const badgeFor = (s) =>
  s === "yes" ? { color: "green", text: "Yes" } : s === "no" ? { color: "red", text: "No" } : { color: "gray", text: "Not reported" };

function submit() {
  const created = addRoom({ name: mall.value, levels: levels.value, states: { ...states }, note: note.value });
  router.push(path(ROUTES.PUMPING_DETAIL, { id: created.id }));
}
</script>

<template>
  <form class="nt-stack" @submit.prevent="submit">
    <AppLink :to="ROUTES.PUMPING" muted class="align-self-start nt-small">All pumping rooms</AppLink>
    <PageHeader
      title="Add or update a room"
      subtitle="Pick a mall, a level and what is inside. Tap Not sure for anything you did not check."
    />

    <div class="nt-cols new-cols">
      <div class="nt-col new-main">
        <section class="group">
          <label class="group__title" for="mall">Which mall?</label>
          <select id="mall" v-model="mall" class="form-select">
            <option v-for="m in malls" :key="m.name" :value="m.name">{{ m.name }}</option>
          </select>
          <ChoiceChips v-model="mall" :options="quickPicks" aria-label="Quick picks" />
        </section>

        <section class="group">
          <h2 class="group__title">Which levels?</h2>
          <ChoiceChips v-model="levels" :options="levelOptions" multiple aria-label="Levels" />
          <p class="nt-small nt-muted mb-0">Tap more than one if the mall has several rooms.</p>
        </section>

        <section class="group">
          <h2 class="group__title">What is inside?</h2>
          <div v-for="f in FEATURES" :key="f.key" class="feature">
            <span class="feature__name">{{ f.form }}</span>
            <div class="feature__scale">
              <ChoiceChips v-model="states[f.key]" :options="answers" variant="scale" :aria-label="f.form" />
            </div>
          </div>
        </section>

        <section class="group">
          <label class="group__title" for="note">One more thing</label>
          <textarea
            id="note"
            v-model="note"
            class="form-control"
            rows="2"
            placeholder="Anything others should know? (optional)"
          />
        </section>

        <div class="d-flex align-items-center gap-4">
          <AppButton type="submit">Add this room</AppButton>
          <AppLink :to="ROUTES.PUMPING">Cancel</AppLink>
        </div>
      </div>

      <div class="nt-col">
        <AppCard title="What others will see" aria-live="polite">
          <p class="preview__name mb-0">{{ mall }}</p>
          <p class="nt-small nt-muted mb-0">{{ info?.address }}. {{ previewLevels }}</p>
          <hr class="nt-rule" />
          <div v-for="f in FEATURES" :key="f.key" class="d-flex align-items-center justify-content-between">
            <span>{{ f.form }}</span>
            <AppBadge :color="badgeFor(states[f.key]).color">{{ badgeFor(states[f.key]).text }}</AppBadge>
          </div>
        </AppCard>
        <p class="nt-small nt-muted mb-0">
          New rooms show as unverified until another parent taps Still correct. Your name is never shown.
        </p>
      </div>
    </div>
  </form>
</template>

<style scoped>
.new-cols {
  grid-template-columns: minmax(0, 700px) minmax(0, 1fr);
  gap: 40px;
}
@media (max-width: 991px) {
  .new-cols {
    grid-template-columns: minmax(0, 1fr);
  }
}
.group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.group__title {
  margin: 0;
  font-family: var(--bs-body-font-family);
  font-size: 1rem;
  font-weight: 500;
}
.feature {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--nt-white);
  border: 1px solid var(--nt-line);
  border-radius: 8px;
}
.feature__name {
  font-size: 1rem;
  font-weight: 500;
}
.feature__scale {
  width: 300px;
  max-width: 100%;
}
.feature__scale :deep(.chip) {
  padding-block: 12px;
}
.preview__name {
  font-size: 1.375rem;
  font-weight: 500;
}
</style>
