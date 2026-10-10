<script setup>
import { RouterLink } from "vue-router";
import Header from "@/app/components/Header.vue";
import Icon from "@/app/components/Icon.vue";
import TonightTimeline from "@/app/components/TonightTimeline.vue";
import AppLink from "@/components/ui/AppLink.vue";
import { ROUTES } from "@/app/routes";
import "@/app/app.css";

defineOptions({ name: "LandingPage" });

// Fixed sample for the decorative preview: Tuesday 6 October, 9:40 PM.
const PREVIEW_NOW = new Date(2026, 9, 6, 21, 40);

const TILES = [
  { id: "preparing", title: "Expecting", line: "Set up your household before the baby arrives." },
  { id: "newborn", title: "New at home", line: "Share feeds, sleep and night shifts from week one." },
  { id: "return", title: "Going back to work", line: "Plan childcare and handovers before the first day." },
];
</script>

<template>
  <div class="landing">
    <Header :bordered="false">
      <AppLink :to="ROUTES.SIGN_IN" class="app-text-link--sm">Sign in</AppLink>
    </Header>

    <main class="landing__main">
      <section class="app-container landing__hero" aria-labelledby="landing-title">
        <div class="landing__copy">
          <h1 id="landing-title" class="landing__headline">Who is up tonight? Now you both know.</h1>
          <p class="landing__sub">
            NurtureTrack keeps feeds, naps and night shifts in one place, so neither of you has to ask or guess.
          </p>
          <RouterLink :to="ROUTES.JOURNEY" class="app-btn app-btn--primary">Get started</RouterLink>
          <p class="landing__caption">Use your email or Google. Setup takes about four minutes.</p>
        </div>

        <div class="landing__preview" aria-hidden="true">
          <div class="landing__panel">
            <p class="landing__panel-title">Tonight</p>
            <p class="landing__panel-date">Tuesday 6 October, 6 PM to 6 AM</p>
            <TonightTimeline me-name="Daniel" partner-name="Mei" :now="PREVIEW_NOW" />
            <p class="landing__panel-note">Last feed 9:05 PM, logged by Daniel</p>
            <p class="landing__panel-note landing__panel-note--muted">Next feed due about 12 AM</p>
          </div>
        </div>
      </section>

      <section class="landing__bridge" aria-labelledby="bridge-title">
        <div class="app-container landing__bridge-inner">
          <h2 id="bridge-title" class="landing__h2">Where are you right now?</h2>
          <ul class="landing__tiles">
            <li v-for="tile in TILES" :key="tile.id">
              <RouterLink :to="ROUTES.JOURNEY" class="landing__tile">
                <span class="landing__tile-text">
                  <span class="landing__tile-title">{{ tile.title }}</span>
                  <span class="landing__tile-line">{{ tile.line }}</span>
                </span>
                <Icon name="chevron" :size="20" />
              </RouterLink>
            </li>
          </ul>
        </div>
      </section>

      <section class="app-container landing__final" aria-labelledby="final-title">
        <div class="landing__final-copy">
          <h2 id="final-title" class="landing__h2">Built for the 3 AM handover.</h2>
          <p class="landing__muted">Log a feed and your partner sees it straight away.</p>
          <p class="landing__muted">How you are feeling stays with you. Check-ins are not shared.</p>
        </div>
        <div class="landing__final-cta">
          <RouterLink :to="ROUTES.JOURNEY" class="app-btn app-btn--outline">Set up your household</RouterLink>
        </div>
      </section>
    </main>

    <footer class="app-container landing__footer">
      <p class="mb-0">NurtureTrack is a support tool, not medical advice. For anything urgent, contact your doctor.</p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle 560px at 220px 180px, rgba(246, 216, 198, 0.95), rgba(246, 216, 198, 0) 100%),
    radial-gradient(circle 520px at 1210px 390px, rgba(220, 230, 242, 0.95), rgba(220, 230, 242, 0) 100%),
    radial-gradient(circle 560px at 800px 940px, rgba(245, 231, 184, 0.95), rgba(245, 231, 184, 0) 100%),
    #fbf8f4;
}
.landing__main { flex: 1; }

.landing__hero { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; padding-top: 24px; padding-bottom: 64px; }
.landing__copy { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }
.landing__headline { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 56px; line-height: 64px; letter-spacing: -1.12px; color: var(--nt-plum); }
.landing__sub { margin: 0; font-size: 18px; line-height: 28px; color: var(--nt-muted); }
.landing__caption { margin: 0; font-size: 0.875rem; color: var(--nt-muted); }

.landing__preview { min-width: 0; align-self: center; }
.landing__panel { display: flex; flex-direction: column; gap: 12px; width: 100%; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.landing__panel-title { margin: 0; font-family: var(--nt-serif); font-size: 24px; line-height: 1.2; color: var(--nt-ink); }
.landing__panel-date { margin: -6px 0 4px; font-size: 0.875rem; color: var(--nt-muted); }
.landing__panel-note { margin: 0; font-size: 14px; line-height: 20px; color: var(--nt-ink); }
.landing__panel-note--muted { margin-top: -8px; color: var(--nt-muted); }

.landing__bridge { background: rgba(255, 255, 255, 0.7); border-top: 1px solid var(--nt-line); }
.landing__bridge-inner { padding-top: 48px; padding-bottom: 48px; display: flex; flex-direction: column; gap: 24px; }
.landing__h2 { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 32px; line-height: 40px; color: var(--nt-ink); }
.landing__tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 0; padding: 0; list-style: none; }
.landing__tile { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 100%; padding: 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; color: var(--nt-muted); text-decoration: none; transition: background-color 0.15s, color 0.15s; }
.landing__tile:hover { background: var(--nt-gray); color: var(--nt-ink); }
.landing__tile-text { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.landing__tile-title { font-family: var(--nt-serif); font-size: 20px; line-height: 1.25; color: var(--nt-ink); }
.landing__tile-line { font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }

.landing__final { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; padding-top: 48px; padding-bottom: 64px; border-top: 1px solid var(--nt-line); }
.landing__final-copy { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.landing__muted { margin: 0; font-size: 1rem; line-height: 24px; color: var(--nt-muted); }
.landing__final-cta { display: flex; justify-content: flex-end; }

.landing a:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }

.landing__footer { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 32px; font-size: 0.875rem; color: var(--nt-muted); }

@media (max-width: 991px) {
  .landing__hero { grid-template-columns: 1fr; padding-bottom: 48px; }
  .landing__headline { font-size: 44px; line-height: 1.15; }
}
@media (max-width: 767px) {
  .landing__tiles { grid-template-columns: 1fr; }
  .landing__final { grid-template-columns: 1fr; gap: 24px; }
  .landing__final-cta { justify-content: flex-start; }
}
@media (max-width: 575px) {
  .landing__footer { flex-direction: column; align-items: flex-start; gap: 8px; }
  .landing__panel { padding: 20px; }
}
</style>
