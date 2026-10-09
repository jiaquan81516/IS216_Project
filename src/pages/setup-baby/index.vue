<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import AppLink from "@/components/ui/AppLink.vue";
import ChoiceRow from "@/components/ui/ChoiceRow.vue";
import StepperBar from "@/components/ui/StepperBar.vue";
import { FEEDING_OPTIONS, formatAge, formatDate } from "@/data/setupBaby";
import { ROUTES } from "@/shared/constants/routes";
import { useHouseholdStore } from "@/stores/household";

defineOptions({ name: "setup-babyPage" });

const household = useHouseholdStore();
const router = useRouter();

const sentence = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const summary = computed(() => {
  const b = household.baby;
  const fed = FEEDING_OPTIONS.filter((o) => b.feeding.includes(o.value)).map((o) => o.short);
  return [
    { label: "Baby", value: b.name || "Not set" },
    { label: "Born", value: b.born ? formatDate(b.dob) : "Not yet" },
    { label: "Age", value: b.born ? formatAge(b.dob) : "Not born yet" },
    { label: "Fed by", value: fed.length ? sentence(fed.join(" and ")) : "Not set" },
  ];
});

function next() {
  router.push(ROUTES.SETUP_PARTNER);
}
</script>

<template>
  <div class="nt-cols nt-cols--onboarding">
    <form class="nt-col baby" novalidate @submit.prevent="next">
      <StepperBar :current="2" />
      <div class="baby__title">
        <h1 class="nt-title nt-title--xl">Tell us about your baby.</h1>
        <p class="nt-lead mb-0">Just the basics. You can change any of it later.</p>
      </div>

      <div class="baby__field">
        <label class="baby__label" for="baby-name">Baby’s name</label>
        <input id="baby-name" v-model="household.baby.name" class="form-control baby__input" type="text" />
      </div>

      <div class="baby__field baby__field--group" role="radiogroup" aria-labelledby="baby-here">
        <p id="baby-here" class="baby__label mb-0">Is baby here yet?</p>
        <div class="baby__pair">
          <ChoiceRow v-model="household.baby.born" name="born" :value="true" title="Yes, born" />
          <ChoiceRow v-model="household.baby.born" name="born" :value="false" title="Not yet" />
        </div>
      </div>

      <div class="baby__pair baby__pair--fields">
        <div class="baby__field">
          <label class="baby__label" for="baby-dob">Date of birth</label>
          <input
            id="baby-dob"
            v-model="household.baby.dob"
            class="form-control baby__input"
            type="date"
            :disabled="!household.baby.born"
          />
        </div>
        <div class="baby__field">
          <label class="baby__label" for="baby-weight">Birth weight (kg), optional</label>
          <input
            id="baby-weight"
            v-model="household.baby.weightKg"
            class="form-control baby__input"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="0"
            max="10"
            placeholder="3.2"
          />
        </div>
      </div>

      <div class="baby__field baby__field--group" role="group" aria-labelledby="baby-fed">
        <p id="baby-fed" class="baby__label mb-0">How is baby fed?</p>
        <ChoiceRow
          v-for="o in FEEDING_OPTIONS"
          :key="o.value"
          v-model="household.baby.feeding"
          type="checkbox"
          :value="o.value"
          :title="o.title"
          class="baby__check"
        />
      </div>

      <div>
        <AppLink>Add a note from the doctor</AppLink>
      </div>

      <div class="baby__actions">
        <AppButton type="submit">Continue</AppButton>
        <AppLink :to="ROUTES.SETUP_ABOUT">Back</AppLink>
      </div>
    </form>

    <aside class="nt-col">
      <AppCard title="So far">
        <dl class="baby__summary mb-0">
          <div v-for="row in summary" :key="row.label" class="baby__summary-row">
            <dt>{{ row.label }}</dt>
            <dd data-test="summary-value" :data-label="row.label">{{ row.value }}</dd>
          </div>
        </dl>
      </AppCard>
    </aside>
  </div>
</template>

<style scoped>
.baby {
  gap: 28px;
}
.baby__title {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.baby__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.baby__field--group {
  gap: 12px;
}
.baby__label {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--nt-ink);
}
.baby__input {
  padding: 20px;
  font-weight: 500;
}
.baby__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.baby__pair--fields {
  gap: 16px;
}
.baby__check.choice-row {
  align-items: center;
  padding-block: 14px;
}
.baby__actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.baby__summary {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.baby__summary-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 0.9375rem;
}
.baby__summary-row dt {
  font-weight: 400;
  color: var(--nt-muted);
}
.baby__summary-row dd {
  margin: 0;
  font-weight: 500;
  text-align: right;
}
@media (max-width: 575px) {
  .baby__pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
