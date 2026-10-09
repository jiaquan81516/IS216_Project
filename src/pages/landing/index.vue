<script setup>
import { RouterLink } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import { DIFFERENCES } from "@/data/landing";
import { ROUTES } from "@/shared/constants/routes";

defineOptions({ name: "LandingPage" });
</script>

<template>
  <div class="landing">
    <header class="landing__bar">
      <div class="nt-container landing__bar-inner">
        <BrandLogo :to="ROUTES.LANDING" />
        <nav class="landing__nav" aria-label="Main">
          <a class="landing__nav-link" href="#how">How it works</a>
          <a class="landing__nav-link" href="#dads">For dads</a>
          <RouterLink class="landing__signin" :to="ROUTES.SIGN_IN">Sign in</RouterLink>
        </nav>
      </div>
    </header>

    <main>
      <div class="landing__hero-bg">
        <section class="nt-container landing__hero" aria-labelledby="hero-title">
          <div class="landing__hero-copy">
            <h1 id="hero-title" class="landing__headline">Look after the baby together. Look after each other too.</h1>
            <p class="landing__sub">
              A shared care log, a night rota that is fair to both of you, and a private check-in for each. Neither of
              you has to be the default parent.
            </p>
            <div class="landing__cta">
              <AppButton :to="ROUTES.SIGN_UP" size="lg">Create your household</AppButton>
              <a href="#how" class="nt-link landing__see">See how it works</a>
            </div>
            <p class="nt-small nt-muted mb-0">Sign in with Google. Setup takes about four minutes.</p>
          </div>
        </section>
      </div>

      <section id="how" class="nt-container landing__how" aria-labelledby="how-title">
        <h2 id="how-title" class="landing__h2">What is different when you both use it</h2>
        <div class="landing__rows">
          <div v-for="d in DIFFERENCES" :key="d.title" class="landing__row">
            <h3 class="landing__row-title">{{ d.title }}</h3>
            <p class="landing__row-text">{{ d.text }}</p>
          </div>
        </div>
        <YoursAlone class="landing__private">
          <p class="landing__private-text">
            Private check-ins. Your mood and stress answers are private to whoever writes them. Not even your partner
            can open them.
          </p>
        </YoursAlone>
      </section>

      <section id="dads" class="landing__dads" aria-labelledby="dads-title">
        <div class="nt-container landing__dads-inner">
          <div class="landing__dads-copy">
            <h2 id="dads-title" class="landing__dads-title">
              Not sure how to help? Open the app and it tells you what to do next.
            </h2>
            <p class="landing__dads-text">
              Simple suggestions based on the last feed, the time of night and who is on call. General guidance only,
              not medical advice.
            </p>
          </div>
          <RouterLink class="landing__dads-link" :to="ROUTES.SIGN_UP">Create your household</RouterLink>
        </div>
      </section>
    </main>

    <footer class="landing__footer">
      <div class="nt-container landing__footer-inner">
        <p class="mb-0">NurtureTrack helps you plan and reflect. It is not medical advice.</p>
        <p class="mb-0">Terms</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing__bar-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 90px; }
.landing__nav { display: flex; align-items: center; gap: 32px; font-size: 0.875rem; }
.landing__nav-link { color: var(--nt-muted); font-weight: 500; text-decoration: none; }
.landing__nav-link:hover { color: var(--nt-ink); }
.landing__signin { color: var(--nt-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }

.landing__hero-bg {
  background:
    radial-gradient(ellipse 45% 70% at 8% 12%, rgba(246, 216, 198, 0.95), transparent 70%),
    radial-gradient(ellipse 40% 60% at 92% 30%, rgba(220, 230, 242, 0.95), transparent 70%),
    radial-gradient(ellipse 50% 45% at 40% 100%, rgba(245, 231, 184, 0.85), transparent 70%),
    #fbf8f4;
}
.landing__hero { padding-top: 56px; padding-bottom: 112px; }
.landing__hero-copy { display: flex; flex-direction: column; gap: 28px; align-items: flex-start; max-width: 760px; }
.landing__headline { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 68px; line-height: 82px; color: var(--nt-ink); }
.landing__sub { margin: 0; max-width: 560px; font-size: 1.25rem; line-height: 1.5; color: var(--nt-muted); }
.landing__cta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; }
.landing__see { font-size: 0.875rem; }

.landing__how { display: flex; flex-direction: column; gap: 32px; padding-top: 80px; padding-bottom: 96px; scroll-margin-top: 16px; }
.landing__h2 { margin: 0; max-width: 760px; font-family: var(--nt-serif); font-weight: 400; font-size: 44px; line-height: 53px; letter-spacing: -0.02em; color: var(--nt-ink); }
.landing__rows { display: flex; flex-direction: column; gap: 20px; }
.landing__row { display: flex; gap: 24px; align-items: flex-start; }
.landing__row-title { flex: none; width: 260px; margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 22px; line-height: 26px; color: var(--nt-ink); }
.landing__row-text { flex: 1; min-width: 0; margin: 0; font-size: 1.125rem; line-height: 27px; color: var(--nt-muted); }
.landing__private { max-width: 760px; gap: 4px; padding: 20px 28px 22px; border-radius: 0; }
.landing__private :deep(.nt-yours-alone__label) { color: var(--nt-ink); }
.landing__private-text { margin: 0; font-size: 1.125rem; line-height: 27px; color: var(--nt-ink); }

.landing__dads { background: var(--nt-plum); scroll-margin-top: 0; }
.landing__dads-inner { display: flex; align-items: flex-end; justify-content: space-between; gap: 64px; padding-top: 80px; padding-bottom: 80px; }
.landing__dads-copy { display: flex; flex-direction: column; gap: 20px; max-width: 900px; }
.landing__dads-title { margin: 0; font-family: var(--nt-serif); font-weight: 400; font-size: 48px; line-height: 58px; letter-spacing: -0.02em; color: #fbf8f4; }
.landing__dads-text { margin: 0; font-size: 1.125rem; line-height: 27px; color: #e5dce5; }
.landing__dads-link { flex: none; font-size: 1rem; font-weight: 600; color: #fbf8f4; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
.landing__dads-link:hover { color: #fff; }
.landing__dads-link:focus-visible, .landing__nav-link:focus-visible, .landing__signin:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 2px; }

.landing__footer { border-top: 1px solid var(--nt-line); font-size: 0.875rem; color: var(--nt-muted); }
.landing__footer-inner { display: flex; align-items: center; gap: 24px; padding-top: 28px; padding-bottom: 28px; }
.landing__footer-inner p { flex: 1; }

@media (max-width: 991px) {
  .landing__hero { padding-bottom: 64px; }
  .landing__headline { font-size: 44px; line-height: 1.2; }
  .landing__h2 { font-size: 34px; line-height: 1.2; }
  .landing__dads-title { font-size: 34px; line-height: 1.2; }
  .landing__dads-inner { flex-direction: column; align-items: flex-start; gap: 32px; }
  .landing__row { flex-direction: column; gap: 6px; }
  .landing__row-title { width: auto; }
  .landing__how { padding-top: 56px; padding-bottom: 64px; }
}
@media (max-width: 575px) {
  .landing__nav { gap: 16px; }
  .landing__nav-link:first-child { display: none; }
  .landing__footer-inner { flex-direction: column; align-items: flex-start; gap: 8px; }
}
</style>
