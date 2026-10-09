<script setup>
import { RouterLink } from "vue-router";
import { ROUTES } from "@/shared/constants/routes";

defineProps({
  current: { type: String, default: "right-now" }, // right-now | reading
  modelValue: { type: String, default: "" },
});
defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="help-bar">
    <nav class="pill-tabs" aria-label="Help sections">
      <RouterLink
        :to="ROUTES.HELP"
        class="pill-tabs__tab"
        :class="{ 'pill-tabs__tab--on': current === 'right-now' }"
        :aria-current="current === 'right-now' ? 'page' : undefined"
      >Right now</RouterLink>
      <RouterLink
        :to="ROUTES.HELP_READING"
        class="pill-tabs__tab"
        :class="{ 'pill-tabs__tab--on': current === 'reading' }"
        :aria-current="current === 'reading' ? 'page' : undefined"
      >Reading</RouterLink>
    </nav>
    <div class="help-bar__search">
      <label for="help-search" class="visually-hidden">Search help</label>
      <input
        id="help-search"
        type="search"
        class="form-control"
        placeholder="Search help"
        autocomplete="off"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    </div>
  </div>
</template>

<style scoped>
.help-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.help-bar__search {
  width: 360px;
  max-width: 100%;
}
.pill-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: var(--nt-gray);
  border-radius: 8px;
}
.pill-tabs__tab {
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--nt-muted);
  text-decoration: none;
}
.pill-tabs__tab:hover {
  color: var(--nt-ink);
}
.pill-tabs__tab--on {
  background: var(--nt-white);
  color: var(--nt-ink);
  font-weight: 500;
}
</style>
