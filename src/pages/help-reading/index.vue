<script setup>
import { computed } from "vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import HelpTabs from "@/pages/help/components/HelpTabs.vue";
import HelpAside from "@/pages/help/components/HelpAside.vue";
import { ARTICLE_GROUPS, filterArticles, helpQuery } from "@/data/help";

defineOptions({ name: "helpReadingPage" });

const groups = computed(() => {
  const found = filterArticles(helpQuery.value);
  return ARTICLE_GROUPS.map((name) => ({ name, items: found.filter((a) => a.group === name) })).filter(
    (g) => g.items.length,
  );
});
</script>

<template>
  <div class="nt-stack">
    <PageHeader title="Help" subtitle="What to do right now, and reading for later." />
    <HelpTabs v-model="helpQuery" current="reading" />
    <div class="nt-cols">
      <section class="nt-card reading" aria-label="Reading">
        <div v-for="g in groups" :key="g.name" class="reading__group">
          <h2 class="nt-heading reading__heading">{{ g.name }}</h2>
          <ul class="reading__items">
            <li v-for="a in g.items" :key="a.id" class="reading__item">
              <span class="reading__row">
                <span class="reading__title">{{ a.title }}</span>
                <span class="reading__meta">
                  <AppBadge color="gray">Reading</AppBadge>
                  <span class="nt-muted reading__min">{{ a.minutes }} min read</span>
                </span>
              </span>
              <span class="nt-muted reading__blurb">{{ a.blurb }}</span>
            </li>
          </ul>
        </div>
        <p v-if="!groups.length" class="nt-muted mb-3" role="status">No articles match "{{ helpQuery }}".</p>
      </section>
      <HelpAside />
    </div>
  </div>
</template>

<style scoped>
.reading {
  padding-bottom: 8px;
  gap: 0;
}
.reading__group + .reading__group {
  margin-top: 8px;
}
.reading__heading {
  font-size: 1.375rem;
  margin-bottom: 8px;
}
.reading__items {
  margin: 0;
  padding: 0;
  list-style: none;
}
.reading__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 0;
  border-bottom: 1px solid var(--nt-line);
}
.reading__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.reading__title {
  font-size: 1.125rem;
  font-weight: 500;
}
.reading__meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.reading__min {
  font-size: 0.875rem;
}
.reading__blurb {
  font-size: 0.9375rem;
}
</style>
