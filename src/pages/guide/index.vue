<script setup>
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import PageHeader from "@/components/ui/PageHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppLink from "@/components/ui/AppLink.vue";
import AppCard from "@/components/ui/AppCard.vue";
import StepMarker from "@/components/ui/StepMarker.vue";
import { findGuide, guides } from "@/data/help";
import { SAMPLE } from "@/shared/constants/appConstants";
import { ROUTES, path } from "@/shared/constants/routes";

defineOptions({ name: "guidePage" });

const route = useRoute();
const guide = computed(() => findGuide(route.params.topic));
</script>

<template>
  <div class="nt-stack">
    <div>
      <AppLink :to="ROUTES.HELP" muted>Help, Right now</AppLink>
    </div>
    <PageHeader title="What should we do next" subtitle="Plain steps for the moments nobody warned you about." />
    <div class="guide-cols">
      <nav class="guide-topics" aria-label="Guide topics">
        <p class="guide-topics__label">What is happening?</p>
        <ul class="guide-topics__list">
          <li v-for="g in guides" :key="g.slug">
            <RouterLink
              :to="path(ROUTES.GUIDE, { topic: g.slug })"
              class="guide-topics__link"
              :class="{ 'guide-topics__link--on': g.slug === guide.slug }"
              :aria-current="g.slug === guide.slug ? 'page' : undefined"
            >{{ g.title }}</RouterLink>
          </li>
        </ul>
      </nav>
      <div class="nt-col">
        <section class="nt-card guide-card" :aria-labelledby="'guide-title'">
          <h2 id="guide-title" class="guide-card__title">{{ guide.title }}</h2>
          <p class="guide-card__intro">{{ guide.intro }}</p>
          <ol class="guide-steps">
            <li v-for="(s, i) in guide.steps" :key="s.title" class="guide-steps__item">
              <StepMarker :n="i + 1" state="now" />
              <div class="guide-steps__text">
                <p class="guide-steps__title">{{ s.title }}</p>
                <p class="guide-steps__body">{{ s.body }}</p>
              </div>
            </li>
          </ol>
          <div class="guide-banner">
            <div>
              <p class="guide-banner__title">{{ SAMPLE.partner }} has had no unbroken sleep since 6 PM.</p>
              <p class="guide-banner__sub">Take over tonight so she can rest.</p>
            </div>
            <AppButton variant="outline" size="md" :to="ROUTES.ROTA">Take over tonight</AppButton>
          </div>
          <div class="guide-actions">
            <AppButton variant="primary" size="lg" :to="ROUTES.ADD_ENTRY">Log what we tried</AppButton>
            <AppLink :to="ROUTES.HOME">Back to Home</AppLink>
          </div>
        </section>
        <AppCard variant="danger" title="Call your doctor or emergency number if">
          <ul class="guide-call">
            <li v-for="c in guide.callIf" :key="c"><span aria-hidden="true" class="nt-muted">&ndash;</span>{{ c }}</li>
          </ul>
        </AppCard>
        <p class="nt-muted nt-small mb-0">General guidance only, not medical advice.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guide-cols {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}
.guide-topics__label {
  margin: 0 0 20px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--nt-muted);
}
.guide-topics__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.guide-topics__link {
  display: block;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9375rem;
  color: var(--nt-muted);
  text-decoration: none;
}
.guide-topics__link:hover {
  color: var(--nt-ink);
}
.guide-topics__link--on {
  background: var(--nt-gray);
  color: var(--nt-ink);
  font-weight: 600;
}
.guide-card {
  gap: 20px;
}
.guide-card__title {
  margin: 0;
  font-family: var(--nt-serif);
  font-weight: 400;
  font-size: 1.75rem;
  letter-spacing: -0.01em;
}
.guide-card__intro {
  margin: 0;
  font-size: 1.0625rem;
  line-height: 1.5;
  color: var(--nt-muted);
}
.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.guide-steps__item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.guide-steps__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.guide-steps__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 500;
}
.guide-steps__body {
  margin: 0;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--nt-muted);
}
.guide-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 16px 20px;
  background: var(--nt-powder);
  border-radius: 10px;
}
.guide-banner__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}
.guide-banner__sub {
  margin: 2px 0 0;
  font-size: 0.875rem;
}
.guide-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
}
.guide-call {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
  line-height: 1.45;
}
.guide-call li {
  display: flex;
  gap: 10px;
}
@media (max-width: 991px) {
  .guide-cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}
</style>
