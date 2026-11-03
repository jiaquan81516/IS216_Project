<script setup>
import { RouterLink } from "vue-router";
import BrandLogo from "@/components/ui/BrandLogo.vue";
import Icon from "@/app/components/Icon.vue";
import { ROUTES } from "@/app/routes";
import "@/app/app.css";

defineOptions({ name: "LandingPage" });

const FEATURES = [
  { icon: "feed", text: "Log feeds, sleep and nappies in a tap" },
  { icon: "moon", text: "Take turns fairly with the night rota" },
  { icon: "heart", text: "Check in on how each of you is doing" },
];
</script>

<template>
  <div class="lp">
    <!-- Shapes reused by the speech bubbles: a cloud with a tail below, and one with the tail above. -->
    <svg width="0" height="0" style="position: absolute" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="lp-cloud" viewBox="0 0 220 112">
          <g fill="currentColor"><circle cx="48" cy="46" r="26" /><circle cx="82" cy="34" r="30" /><circle cx="122" cy="30" r="32" /><circle cx="160" cy="38" r="28" /><circle cx="188" cy="52" r="22" /><rect x="26" y="46" width="184" height="26" rx="13" /><path d="M50 66C50 86 40 98 22 108C58 108 84 94 96 68z" /></g>
        </symbol>
        <symbol id="lp-cloud-up" viewBox="0 0 220 112">
          <g fill="currentColor"><circle cx="48" cy="46" r="26" /><circle cx="82" cy="34" r="30" /><circle cx="122" cy="30" r="32" /><circle cx="160" cy="38" r="28" /><circle cx="188" cy="52" r="22" /><rect x="26" y="46" width="184" height="26" rx="13" /><path d="M150 34C154 12 170 0 196 -12C150 -10 120 4 110 36z" /></g>
        </symbol>
      </defs>
    </svg>

    <div class="lp__sheet">
      <!-- Background accents -->
      <i class="lp__blob lp__blob--1" aria-hidden="true"></i>
      <i class="lp__blob lp__blob--2" aria-hidden="true"></i>
      <i class="lp__blob lp__blob--3" aria-hidden="true"></i>
      <i class="lp__dots lp__dots--1" aria-hidden="true"></i>
      <svg class="lp__deco lp__squiggle" width="150" height="26" viewBox="0 0 150 26" aria-hidden="true"><path d="M3 13q9-14 18 0t18 0 18 0 18 0 18 0 18 0 18 0" fill="none" stroke="#f2a477" stroke-width="4" stroke-linecap="round" opacity=".55" /></svg>

      <!-- Doodles -->
      <svg class="lp__deco lp__moon" width="70" height="70" viewBox="0 0 70 70" aria-hidden="true"><path d="M44 8a26 26 0 1 0 18 38A22 22 0 0 1 44 8z" fill="#f2a477" /></svg>
      <svg class="lp__deco lp__star lp__star--1" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="#f6d1b3" /></svg>
      <svg class="lp__deco lp__star lp__star--2" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="#f2a477" /></svg>
      <svg class="lp__deco lp__star lp__star--3" width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="#f6d1b3" /></svg>
      <svg class="lp__deco lp__planet" width="120" height="100" viewBox="0 0 120 100" aria-hidden="true">
        <ellipse cx="60" cy="52" rx="56" ry="14" fill="none" stroke="#f2a477" stroke-width="7" transform="rotate(-14 60 52)" />
        <circle cx="60" cy="52" r="34" fill="#c9a08a" />
        <ellipse cx="60" cy="52" rx="56" ry="14" fill="none" stroke="#f2a477" stroke-width="7" stroke-dasharray="0 60 100 200" transform="rotate(-14 60 52)" />
        <circle cx="48" cy="50" r="2.6" fill="#243560" /><circle cx="72" cy="50" r="2.6" fill="#243560" />
        <path d="M54 60q6 5 12 0" stroke="#243560" stroke-width="2.4" fill="none" stroke-linecap="round" />
        <circle cx="42" cy="58" r="5" fill="#e98e72" opacity=".5" /><circle cx="78" cy="58" r="5" fill="#e98e72" opacity=".5" />
      </svg>
      <svg class="lp__deco lp__cloud" width="130" height="80" viewBox="0 0 130 80" aria-hidden="true">
        <path d="M28 66a20 20 0 0 1 3-39 26 26 0 0 1 50-6 22 22 0 0 1 21 45z" fill="#e7ddf3" />
        <circle cx="52" cy="48" r="2.6" fill="#243560" /><circle cx="76" cy="48" r="2.6" fill="#243560" />
        <path d="M58 56q6 5 12 0" stroke="#243560" stroke-width="2.4" fill="none" stroke-linecap="round" />
        <circle cx="46" cy="55" r="5" fill="#f2a477" opacity=".45" /><circle cx="82" cy="55" r="5" fill="#f2a477" opacity=".45" />
      </svg>

      <header class="lp__nav">
        <BrandLogo :to="ROUTES.LANDING" />
      </header>

      <main>
        <section class="lp__hero" aria-labelledby="landing-title">
          <div class="lp__copy">
            <h1 id="landing-title" class="lp__title">Share the care.<em>Share the load.</em></h1>
            <p class="lp__lead">A shared place for parents who are taking<br />care of their babies.</p>
            <div class="lp__cta">
              <RouterLink :to="ROUTES.JOURNEY" class="lp__btn">Create your household</RouterLink>
              <RouterLink :to="ROUTES.SIGN_IN" class="lp__ghost">Sign in</RouterLink>
            </div>
          </div>

          <div class="lp__photo" aria-hidden="true">
            <div class="lp__ring"></div>
            <div class="lp__frame">
              <svg viewBox="0 0 360 360" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
                <defs><linearGradient id="lp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3f73" /><stop offset="1" stop-color="#8c9cc9" /></linearGradient></defs>
                <rect width="360" height="360" fill="url(#lp-sky)" />
                <g fill="#fdf9f0" opacity=".9"><circle cx="60" cy="70" r="2.4" /><circle cx="130" cy="38" r="1.8" /><circle cx="300" cy="64" r="2.6" /><circle cx="262" cy="120" r="1.8" /><circle cx="90" cy="150" r="1.8" /><circle cx="330" cy="170" r="2" /></g>
                <path d="M222 62a64 64 0 1 0 44 98A54 54 0 0 1 222 62z" fill="#f6d9a8" />
                <path d="M-10 300q60-50 130-20t130-10q60-26 120 10V360H-10z" fill="#6f81b4" />
                <path d="M-10 330q80-40 150-10t120-6q60-24 110 6V360H-10z" fill="#4a5c92" />
                <g transform="translate(92 210)"><path d="M28 78a26 26 0 0 1 4-52 34 34 0 0 1 66-8 28 28 0 0 1 26 60z" fill="#fdf9f0" /><path d="M48 52q6 6 12 0M82 52q6 6 12 0" stroke="#243560" stroke-width="3" fill="none" stroke-linecap="round" /><path d="M62 64q8 6 16 0" stroke="#243560" stroke-width="3" fill="none" stroke-linecap="round" /><circle cx="44" cy="62" r="6" fill="#f2a477" opacity=".5" /><circle cx="98" cy="62" r="6" fill="#f2a477" opacity=".5" /></g>
                <path d="M286 214l4 9 10 1-7.5 6.5 2.5 9.8L286 235l-9 5.3 2.5-9.8L272 224l10-1z" fill="#f2a477" />
                <text x="214" y="236" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#fdf9f0" opacity=".85">z</text>
                <text x="232" y="216" font-family="Georgia, serif" font-size="16" font-weight="700" fill="#fdf9f0" opacity=".7">z</text>
              </svg>
            </div>
            <div class="lp__bubble lp__bubble--1 lp__bubble--flip"><svg><use href="#lp-cloud" /></svg><span>Night duty planned</span></div>
            <div class="lp__bubble lp__bubble--2"><svg><use href="#lp-cloud" /></svg><span>Your turn to rest 💤</span></div>
            <div class="lp__bubble lp__bubble--3"><svg><use href="#lp-cloud-up" /></svg><span>Handover done ✓</span></div>
          </div>
        </section>

        <section class="lp__more" aria-labelledby="more-title">
          <i class="lp__dots lp__dots--2" aria-hidden="true"></i>
          <div class="lp__band">
            <div>
              <h2 id="more-title" class="lp__h2">More than a care tracker</h2>
              <p class="lp__bandtext">Practical tools for the days, and a quiet check-in for the hard moments.</p>
            </div>
            <ul class="lp__features">
              <li v-for="f in FEATURES" :key="f.text"><span class="lp__ficon" aria-hidden="true"><Icon :name="f.icon" :size="18" /></span>{{ f.text }}</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.lp { min-height: 100vh; padding: 24px 20px 40px; background: radial-gradient(circle at 8% 12%, #fbe3d3 0, transparent 38%), radial-gradient(circle at 94% 30%, #dde4f5 0, transparent 40%), radial-gradient(circle at 50% 100%, #e4efe3 0, transparent 45%), #f6efe2; color: var(--ink, #1f2a52); }
.lp__sheet { position: relative; max-width: 1120px; margin: 0 auto; overflow: hidden; background: #fffdf8; border-bottom: 6px solid var(--sand, #e9d9b8); border-radius: 36px; box-shadow: 0 24px 50px rgb(36 53 96 / 10%); }
.lp__deco { position: absolute; pointer-events: none; }

/* Background accents */
.lp__blob { position: absolute; z-index: 0; border-radius: 50%; filter: blur(2px); pointer-events: none; }
.lp__blob--1 { width: 460px; height: 460px; left: -140px; top: -120px; background: radial-gradient(circle at 40% 40%, #fbe3d3, #fdf1e6 60%, transparent 72%); animation: lp-blob 14s ease-in-out infinite; }
.lp__blob--2 { width: 520px; height: 520px; right: -170px; top: 140px; background: radial-gradient(circle at 50% 50%, #e3e9f8, #eef1fa 55%, transparent 70%); animation: lp-blob 17s ease-in-out -6s infinite; }
.lp__blob--3 { width: 420px; height: 420px; left: -120px; top: 690px; background: radial-gradient(circle at 50% 50%, #e4efe3, #f0f6ee 55%, transparent 70%); animation: lp-blob 16s ease-in-out -3s infinite; }
.lp__dots { position: absolute; z-index: 0; pointer-events: none; background-image: radial-gradient(rgb(36 53 96 / 14%) 1.6px, transparent 1.6px); background-size: 20px 20px; }
.lp__dots--1 { right: 34px; top: 96px; width: 150px; height: 110px; -webkit-mask: linear-gradient(135deg, #000, transparent 80%); mask: linear-gradient(135deg, #000, transparent 80%); }
.lp__dots--2 { left: 40px; bottom: 12px; width: 170px; height: 120px; -webkit-mask: linear-gradient(45deg, #000, transparent 80%); mask: linear-gradient(45deg, #000, transparent 80%); }
.lp__squiggle { left: 44%; top: 640px; z-index: 0; }

/* Doodles */
.lp__moon { left: 46%; top: 96px; transform-origin: 50% 0; animation: lp-sway 6s ease-in-out infinite; }
.lp__star--1 { left: 20%; top: 600px; animation: lp-twinkle 3.2s ease-in-out infinite; }
.lp__star--2 { left: 44%; top: 330px; animation: lp-twinkle 2.6s ease-in-out 0.8s infinite; }
.lp__star--3 { right: 5%; top: 130px; animation: lp-twinkle 3.8s ease-in-out 1.4s infinite; }
.lp__planet { left: 3%; top: 540px; animation: lp-wobble 7s ease-in-out infinite; }
.lp__cloud { right: 4%; top: 520px; animation: lp-drift 11s ease-in-out infinite; }

.lp__nav { position: relative; z-index: 2; display: flex; align-items: center; padding: 26px 48px; }

/* Hero */
.lp__hero { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; padding: 30px 48px 70px; }
.lp__title { margin: 0 0 16px; font-family: var(--nt-serif); font-size: 3.875rem; font-weight: 700; line-height: 1; color: var(--navy, #243560); }
.lp__title em { display: block; font-style: normal; color: #f2a477; }
.lp__lead { margin: 0 0 28px; max-width: 460px; font-size: 1.125rem; line-height: 1.55; color: var(--mut, #5b6692); }
.lp__cta { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
.lp__btn { display: inline-flex; padding: 16px 30px; background: #f2a477; border-bottom: 4px solid #d78251; border-radius: 999px; color: var(--navy, #243560); font-size: 1rem; font-weight: 700; text-decoration: none; transition: transform 0.12s; }
.lp__btn:hover { transform: translateY(-1px); background: #f5ad84; }
.lp__ghost { display: inline-flex; padding: 10px 34px; background: rgb(255 255 255 / 55%); border: 1.5px solid var(--navy, #243560); border-radius: 999px; color: var(--navy, #243560); font-size: 0.875rem; font-weight: 700; text-decoration: none; }
.lp__ghost:hover { background: #fff; }
.lp__btn:focus-visible, .lp__ghost:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 3px; }

/* Illustration */
.lp__photo { position: relative; display: grid; place-items: center; height: 430px; }
.lp__ring { position: absolute; right: 10px; top: 10px; width: 400px; height: 400px; border-radius: 50% 50% 50% 50% / 55% 45% 55% 45%; background: #fbe3d3; animation: lp-breathe 7s ease-in-out infinite; }
.lp__frame { position: relative; display: grid; place-items: center; width: 360px; height: 360px; overflow: hidden; background: linear-gradient(135deg, #b9c6e3, #e7c6a8); border: 6px solid #fffdf8; border-radius: 58% 42% 52% 48% / 50% 55% 45% 50%; box-shadow: 0 14px 30px rgb(36 53 96 / 18%); }
.lp__bubble { position: absolute; width: 184px; height: 96px; filter: drop-shadow(0 10px 14px rgb(36 53 96 / 14%)); animation: lp-float 5s ease-in-out infinite; }
.lp__bubble svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.lp__bubble--flip svg { transform: scaleX(-1); }
.lp__bubble span { position: absolute; left: 0; right: 0; top: 17px; display: grid; place-items: center; height: 40px; padding: 0 20px; text-align: center; font-family: var(--nt-serif); font-size: 0.84rem; font-weight: 700; line-height: 1.15; color: var(--navy, #243560); }
.lp__bubble--1 { left: -22px; top: 26px; color: #fffdf8; transform: rotate(-4deg); }
.lp__bubble--1 svg { filter: drop-shadow(0 0 0 transparent); }
.lp__bubble--1::before { content: ""; position: absolute; inset: 12px 6px 30px; border: 2px solid var(--sand, #e9d9b8); border-radius: 30px; opacity: 0; }
.lp__bubble--2 { right: -26px; top: 186px; color: #fbe3d3; transform: rotate(3deg); animation-delay: -2s; }
.lp__bubble--3 { left: -2px; bottom: -4px; color: #d9ebdf; transform: rotate(-2deg); animation-delay: -3.5s; }
.lp__bubble--3 span { top: 19px; }

/* Band */
.lp__more { position: relative; z-index: 1; padding: 10px 0 56px; }
.lp__band { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 30px; align-items: center; margin: 0 48px; padding: 44px; background: var(--navy, #243560); border-bottom: 6px solid #182246; border-radius: 32px; color: #fff; }
.lp__h2 { margin: 0 0 10px; font-family: var(--nt-serif); font-size: 2.25rem; font-weight: 700; line-height: 1.1; color: #fff; }
.lp__bandtext { margin: 0; line-height: 1.55; color: #dfe5f7; }
.lp__features { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.lp__features li { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: rgb(255 255 255 / 10%); border-radius: 18px; font-size: 0.9375rem; }
.lp__ficon { display: inline-grid; place-items: center; flex: none; width: 34px; height: 34px; background: #f2a477; border-radius: 50%; color: var(--navy, #243560); }

/* Gentle motion */
@keyframes lp-blob { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(18px, 22px) scale(1.05); } }
@keyframes lp-sway { 0%, 100% { transform: rotate(-8deg) translateY(0); } 50% { transform: rotate(8deg) translateY(-10px); } }
@keyframes lp-twinkle { 0%, 100% { transform: scale(1) rotate(0); opacity: 1; } 50% { transform: scale(1.35) rotate(18deg); opacity: 0.55; } }
@keyframes lp-drift { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(26px); } }
@keyframes lp-wobble { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-16px) rotate(6deg); } }
@keyframes lp-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -9px; } }
@keyframes lp-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@media (prefers-reduced-motion: reduce) {
  .lp__blob, .lp__deco, .lp__bubble, .lp__ring { animation: none !important; }
}

@media (max-width: 820px) {
  .lp { padding: 12px 12px 28px; }
  .lp__sheet { border-radius: 28px; }
  .lp__nav { padding: 20px 22px; }
  .lp__hero { grid-template-columns: minmax(0, 1fr); padding: 10px 22px 50px; }
  .lp__title { font-size: 2.75rem; }
  .lp__photo { height: 360px; }
  .lp__ring { right: auto; width: 320px; height: 320px; }
  .lp__frame { width: 290px; height: 290px; }
  .lp__bubble { width: 160px; height: 84px; }
  .lp__bubble span { top: 14px; height: 36px; font-size: 0.75rem; padding: 0 16px; }
  .lp__bubble--3 span { top: 17px; }
  .lp__bubble--1 { left: -6px; }
  .lp__bubble--2 { right: -6px; }
  .lp__band { grid-template-columns: minmax(0, 1fr); margin: 0 22px; padding: 28px; }
  .lp__h2 { font-size: 1.75rem; }
  .lp__star--2, .lp__squiggle, .lp__star--1, .lp__planet { display: none; }
}
</style>
