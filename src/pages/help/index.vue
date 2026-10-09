<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import PageHeader from "@/components/ui/PageHeader.vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import HelpTabs from "./components/HelpTabs.vue";
import HelpAside from "./components/HelpAside.vue";
import { filterGuides, helpQuery } from "@/data/help";
import { ROUTES, path } from "@/shared/constants/routes";

defineOptions({ name: "helpPage" });

const visible = computed(() => filterGuides(helpQuery.value));
</script>

<template>
  <div class="nt-stack">
    <PageHeader title="Help" subtitle="What to do right now, and reading for later." />
    <HelpTabs v-model="helpQuery" current="right-now" />
    <div class="nt-cols">
      <section class="nt-card help-list" aria-labelledby="help-pick">
        <h2 id="help-pick" class="nt-heading">Pick what is happening</h2>
        <ul class="help-list__items" data-testid="guide-list">
          <li v-for="(g, i) in visible" :key="g.slug" class="help-list__item">
            <RouterLink :to="path(ROUTES.GUIDE, { topic: g.slug })" class="help-list__link">
              <AppBadge v-if="g.slug === 'settle'" color="green" class="align-self-start">
                Suggested now: the last feed was 3 hours ago
              </AppBadge>
              <span class="help-list__row">
                <span class="help-list__title">{{ g.title }}</span>
                <span class="help-list__meta">
                  <AppBadge color="blue">Guide</AppBadge>
                  <span class="nt-muted help-list__min">{{ g.minutes }} min</span>
                </span>
              </span>
              <span class="help-list__blurb nt-muted">{{ g.blurb }}</span>
            </RouterLink>
          </li>
        </ul>
        <p v-if="!visible.length" class="nt-muted mb-3" role="status">No guides match "{{ helpQuery }}".</p>
      </section>
      <HelpAside />
    </div>
  </div>
</template>

<style scoped>
.help-list {
  padding-bottom: 8px;
}
.help-list__items {
  margin: 0;
  padding: 0;
  list-style: none;
}
.help-list__item + .help-list__item {
  border-top: 1px solid var(--nt-line);
}
.help-list__link {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 0;
  color: inherit;
  text-decoration: none;
}
.help-list__link:hover .help-list__title {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.help-list__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.help-list__title {
  font-size: 1.125rem;
  font-weight: 500;
}
.help-list__meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.help-list__min {
  font-size: 0.875rem;
}
.help-list__blurb {
  font-size: 0.9375rem;
}
</style>
