<script setup>
import { RouterLink } from "vue-router";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import { ROUTES } from "@/app/routes";
import newbornFamily from "@/assets/images/landing/newborn-family.png";
import preparingNursery from "@/assets/images/landing/preparing-nursery.png";
import expectingParents from "@/assets/images/landing/expecting-parents.png";
import workingParent from "@/assets/images/landing/working-parent-at-home.jpg";
import "@/app/app.css";

defineOptions({ name: "LandingPage" });

const JOURNEYS = [
  { eyebrow: "Newly postpartum", title: "Just gave birth", description: "Coordinate feeds, sleep, handovers and rest while you both learn what your newborn needs.", action: "Start with shared care", image: newbornFamily, alt: "Two parents smiling with their newborn baby" },
  { eyebrow: "Preparing together", title: "Expecting a baby", description: "Build confidence before the birth with practical preparation and guided what-if scenarios.", action: "Prepare together", image: expectingParents, alt: "Expecting parents preparing clothes in a nursery" },
  { eyebrow: "Planning the transition", title: "Returning to work", description: "Plan childcare, workplace conversations and home routines without carrying it alone.", action: "Build the roadmap", image: preparingNursery, alt: "Parents assembling a cot together before their baby arrives" },
];
</script>

<template>
  <div class="landing-page">
    <header class="landing-header border-bottom">
      <div class="container-xl d-flex align-items-center justify-content-between py-4">
        <BrandLogo :to="ROUTES.LANDING" />
        <nav class="d-flex align-items-center gap-4 gap-lg-5" aria-label="Main navigation">
          <a class="d-none d-md-inline landing-nav-link" href="#how-it-works">How it works</a>
          <a class="d-none d-md-inline landing-nav-link" href="#for-parents">For both parents</a>
          <RouterLink class="landing-nav-link landing-nav-link--sign-in" :to="ROUTES.SIGN_IN">Sign in</RouterLink>
        </nav>
      </div>
    </header>

    <main>
      <section class="hero-section" aria-labelledby="landing-title">
        <div class="container-xl"><div class="row align-items-center g-5">
          <div class="col-lg-6">
            <p class="section-label">Shared care for the newborn stage</p>
            <h1 id="landing-title" class="hero-title">Share the care.<br /><span>Share the load.</span></h1>
            <p class="hero-copy">NurtureTrack helps couples stay connected through the newborn stage—from the next handover to the first day back at work.</p>
            <div class="d-flex flex-wrap align-items-center gap-4 mt-5">
              <RouterLink :to="ROUTES.JOURNEY" class="btn app-btn--primary landing-btn landing-btn--primary">Create your household <span aria-hidden="true">→</span></RouterLink>
              <a href="#how-it-works" class="landing-inline-link">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <div class="hero-note d-flex align-items-center mt-5 pt-2">
              <span class="initial initial--coral">D</span><span class="initial initial--mint">J</span>
              <p class="mb-0 ms-3"><strong>Made for both parents.</strong><br />No one has to carry the whole day alone.</p>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="handover-demo" aria-label="Example of an evening care handover">
              <div class="d-flex justify-content-between align-items-start gap-3 pb-4 border-bottom">
                <div><p class="section-label mb-2">Evening handover</p><h2 class="demo-heading mb-0">Here’s what changed.</h2></div>
                <p class="demo-time mb-0 text-nowrap">Today · 6:42 PM</p>
              </div>
              <div class="row g-0 demo-exchange">
                <div class="col-sm-6 demo-note demo-note--left">
                  <div class="d-flex align-items-center gap-2 mb-3"><span class="initial initial--coral">D</span><strong>Dylan</strong></div>
                  <p>Aria fed for 18 minutes and settled after her nap.</p><small>6:18 PM · Care log</small>
                </div>
                <div class="col-sm-6 demo-note demo-note--right">
                  <div class="d-flex align-items-center gap-2 mb-3"><span class="initial initial--mint">J</span><strong>Jocelyn</strong></div>
                  <p>I’ll take the next feed. You take the first rest block.</p><small>6:42 PM · Handover note</small>
                </div>
              </div>
              <div class="demo-next d-flex align-items-center justify-content-between gap-3"><div><small>Next shared step</small><strong>Review tonight’s sleep rota</strong></div><span aria-hidden="true">→</span></div>
            </div>
          </div>
        </div></div>
      </section>

      <section id="for-parents" class="journeys-section" aria-labelledby="journeys-title">
        <div class="container-xl">
          <div class="row align-items-end g-4 mb-5">
            <div class="col-lg-8"><p class="section-label">Who NurtureTrack is for</p><h2 id="journeys-title" class="section-title">Support for your <em>next chapter.</em></h2></div>
            <div class="col-lg-4"><p class="section-intro mb-0">Wherever you are in the transition, NurtureTrack helps both parents feel prepared, connected and supported.</p></div>
          </div>
          <div class="row g-4">
            <div v-for="journey in JOURNEYS" :key="journey.title" class="col-md-4">
              <article class="journey-card h-100"><img :src="journey.image" :alt="journey.alt" class="journey-card__image" /><div class="journey-card__body">
                <p class="section-label mb-3">{{ journey.eyebrow }}</p><h3>{{ journey.title }}</h3><p>{{ journey.description }}</p>
                <RouterLink :to="ROUTES.JOURNEY" class="journey-card__link">{{ journey.action }} <span aria-hidden="true">→</span></RouterLink>
              </div></article>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" class="support-section" aria-labelledby="support-title">
        <div class="container-xl">
          <div class="row align-items-end g-4 mb-5">
            <div class="col-lg-8"><p class="section-label section-label--dark">More than a care tracker</p><h2 id="support-title" class="section-title section-title--dark">Support for the <em>whole transition.</em></h2></div>
            <div class="col-lg-4"><p class="support-intro mb-0">New parenthood changes everything. Navigate the practical and emotional parts together.</p></div>
          </div>
          <div class="row g-4">
            <div class="col-lg-7"><article class="feature-story">
              <img :src="workingParent" alt="A parent balancing work and childcare at home" /><div class="feature-story__overlay">
                <p class="section-label section-label--dark">Plan ahead · Featured</p><h3>Return to work, together.</h3>
                <p>Prepare childcare, workplace conversations and handover tasks on one shared timeline.</p><RouterLink :to="ROUTES.RETURN_TO_WORK">Build your return-to-work roadmap →</RouterLink>
              </div>
            </article></div>
            <div class="col-lg-5 d-flex flex-column gap-4">
              <article class="support-item flex-fill"><span class="support-item__icon" aria-hidden="true">↔</span><p class="section-label section-label--dark">Make it fair</p><h3>Both parents count.</h3><p>Make invisible work visible with shared responsibilities, sleep rotations and protected rest.</p><RouterLink :to="ROUTES.ROTA">See shared care →</RouterLink></article>
              <article class="support-item flex-fill"><span class="support-item__icon" aria-hidden="true">♡</span><p class="section-label section-label--dark">Check in</p><h3>Care for the caregiver.</h3><p>Private wellbeing check-ins help each parent notice when they need rest, support or a conversation.</p><RouterLink :to="ROUTES.WELLNESS">Explore wellbeing →</RouterLink></article>
            </div>
          </div>
        </div>
      </section>

      <section class="final-cta" aria-labelledby="final-title"><div class="container-xl"><div class="row align-items-center g-4">
        <div class="col-lg-8"><p class="section-label">A better way to share the load</p><h2 id="final-title" class="section-title">Care feels lighter.<br /><em>When you carry it together.</em></h2></div>
        <div class="col-lg-4"><p>Bring care logs, handovers, responsibilities and wellbeing into one shared space for both parents.</p><RouterLink :to="ROUTES.JOURNEY" class="btn app-btn--primary landing-btn landing-btn--primary mt-3">Create your household <span aria-hidden="true">→</span></RouterLink></div>
      </div></div></section>
    </main>

    <footer class="landing-footer"><div class="container-xl d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-4"><BrandLogo :to="ROUTES.LANDING" /><p class="mb-0">Two parents. One shared load.</p><p class="mb-0">© 2026 NurtureTrack</p></div></footer>
  </div>
</template>

<style scoped>
.landing-page { --cream: #f7f1e8; --paper: #fffaf4; --plum: #30273b; --orange: #dc7648; --muted: #6d655f; background: var(--cream); color: var(--plum); font-family: Arial, Helvetica, sans-serif; }
.landing-header { background: var(--paper); border-color: rgba(48, 39, 59, .14) !important; }.landing-nav-link { color: var(--plum); font-weight: 600; text-decoration: none; }.landing-nav-link:hover { color: var(--orange); }.landing-nav-link--sign-in { border-bottom: 1px solid currentColor; }
.hero-section, .journeys-section, .support-section, .final-cta { padding: clamp(5rem, 9vw, 9rem) 0; }.hero-section { background: var(--paper); }
.section-label { display: flex; align-items: center; gap: .75rem; margin: 0 0 1.75rem; color: #9a5a3e; font-size: .75rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }.section-label::before { width: 2rem; height: 1px; background: var(--orange); content: ""; }
.hero-title { margin: 0; max-width: 700px; font-size: clamp(3.5rem, 6.5vw, 6.7rem); font-weight: 400; line-height: .96; letter-spacing: -.065em; }.hero-title span, .section-title em { color: var(--orange); font-style: normal; }
.hero-copy { max-width: 650px; margin: 2.5rem 0 0; color: var(--muted); font-size: clamp(1.1rem, 1.5vw, 1.4rem); line-height: 1.55; }.landing-btn { border-radius: 2px; padding: 1rem 1.5rem; font-weight: 700; }.landing-btn--primary { background: var(--plum); color: white; }.landing-btn--primary:hover { background: #17121e; color: white; }.landing-inline-link, .journey-card__link { color: var(--plum); font-weight: 700; text-underline-offset: 4px; }
.hero-note { color: var(--muted); font-size: .9rem; }.hero-note strong { color: var(--plum); }.initial { display: inline-grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 50%; color: var(--plum); font-size: .8rem; font-weight: 800; }.initial + .initial { margin-left: -.25rem; }.initial--coral { background: #efb092; }.initial--mint { background: #a7d1c8; }
.handover-demo { position: relative; padding: clamp(1.5rem, 3vw, 2.5rem); background: #fffdfa; border: 1px solid #d8cec4; box-shadow: 20px 22px 0 #e5ded3, 38px 38px 0 #dfe8e4; transform: rotate(.5deg); }.demo-heading, .section-title, .journey-card h3, .feature-story h3, .support-item h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; }.demo-heading { font-size: clamp(1.8rem, 3vw, 2.6rem); }.demo-time { color: var(--muted); font-size: .85rem; }
.demo-exchange { margin: 2rem 0; border: 1px solid #ded5cc; }.demo-note { min-height: 190px; padding: 1.5rem; }.demo-note--left { border-right: 1px solid #ded5cc; }.demo-note--right { background: #e3eeeb; }.demo-note p { color: #554d48; }.demo-note small { color: #81756c; }.demo-next { padding: 1.2rem 1.4rem; background: var(--plum); color: white; }.demo-next div { display: flex; flex-direction: column; }.demo-next small { font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.journeys-section { border-top: 1px solid #ded5cc; }.section-title { margin: 0; font-size: clamp(2.5rem, 5vw, 4.5rem); line-height: 1.05; letter-spacing: -.045em; }.section-intro, .support-intro, .final-cta p { color: var(--muted); font-size: 1.08rem; line-height: 1.55; }
.journey-card { background: var(--paper); border: 1px solid #d8cec4; }.journey-card__image { display: block; width: 100%; height: 250px; object-fit: cover; }.journey-card__body { padding: 1.75rem; }.journey-card h3 { margin-bottom: .75rem; font-size: 2rem; }.journey-card__body > p:not(.section-label) { min-height: 4.8rem; color: var(--muted); line-height: 1.55; }.journey-card__link { display: inline-block; margin-top: 1rem; text-decoration: none; }.journey-card__link:hover { color: var(--orange); }
.support-section { background: var(--plum); color: #fffaf4; }.section-label--dark { color: #dc8a61; }.section-title--dark em { color: #ef9a70; }.support-intro { color: #cec5d1; }.feature-story { position: relative; min-height: 625px; overflow: hidden; border: 1px solid #746b7b; }.feature-story > img { position: absolute; width: 100%; height: 100%; object-fit: cover; }.feature-story::after { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(31, 23, 38, .94), rgba(31, 23, 38, .02) 75%); content: ""; }.feature-story__overlay { position: absolute; z-index: 1; right: 0; bottom: 0; left: 0; padding: 2rem; }.feature-story h3 { font-size: clamp(2.4rem, 4vw, 4rem); }.feature-story p { max-width: 620px; }.feature-story a, .support-item a { color: #fff; font-weight: 700; text-decoration: none; }
.support-item { padding: clamp(1.7rem, 3vw, 2.5rem); border: 1px solid #6b6173; background: #3d3448; }.support-item__icon { display: grid; place-items: center; width: 3.5rem; height: 3.5rem; margin-bottom: 2rem; background: var(--paper); color: var(--plum); font-size: 1.6rem; }.support-item h3 { font-size: clamp(2rem, 3vw, 2.8rem); }.support-item > p:not(.section-label) { color: #d7cfda; }
.final-cta { background: var(--paper); }.landing-footer { background: #261f2e; color: #cec5d1; }.landing-footer :deep(.brand) { color: #fffaf4; }.landing-footer p { font-size: .85rem; }.landing-page a:focus-visible { outline: 3px solid var(--orange); outline-offset: 4px; }
@media (max-width: 991.98px) { .handover-demo { margin: 1rem 1.5rem 2.5rem 0; }.feature-story { min-height: 540px; } }
@media (max-width: 575.98px) { .hero-section, .journeys-section, .support-section, .final-cta { padding: 4.5rem 0; }.demo-note--left { border-right: 0; border-bottom: 1px solid #ded5cc; }.journey-card__body > p:not(.section-label) { min-height: 0; }.handover-demo { box-shadow: 10px 12px 0 #e5ded3; margin-right: .75rem; }.feature-story { min-height: 500px; } }
</style>
