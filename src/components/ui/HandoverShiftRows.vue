<script setup>
import { RouterLink } from "vue-router";
import { ROUTES } from "@/shared/constants/routes";

defineProps({
  rows: { type: Array, required: true },
  editable: { type: Boolean, default: false },
  received: { type: Boolean, default: false },
});
</script>

<template>
  <div class="shift-rows">
    <template v-for="(row, i) in rows" :key="row.key">
      <hr v-if="i > 0" class="nt-rule" />
      <div class="shift-row">
        <p class="shift-row__label">{{ row.label }}</p>
        <div class="shift-row__body">
          <p class="shift-row__title">{{ row.title }}</p>
          <p class="shift-row__detail">{{ received && row.receivedDetail ? row.receivedDetail : row.detail }}</p>
        </div>
        <RouterLink
          v-if="editable"
          :to="ROUTES.CARE_LOG"
          class="nt-link shift-row__edit"
          :aria-label="`Edit ${row.label.toLowerCase()} in the care log`"
        >Edit</RouterLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.shift-rows {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.shift-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 14px 0;
}
.shift-row__label {
  flex: none;
  width: 110px;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--nt-muted);
}
.shift-row__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.shift-row__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}
.shift-row__detail {
  margin: 0;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.shift-row__edit {
  flex: none;
  font-size: 0.875rem;
}
@media (max-width: 575px) {
  .shift-row__label {
    width: 84px;
  }
}
</style>
