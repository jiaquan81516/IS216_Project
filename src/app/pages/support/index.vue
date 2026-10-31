<script setup>
import "@/app/app.css";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "@/app/components/Icon.vue";
import Tabs from "@/app/components/Tabs.vue";
import { SUPPORT_GUIDES, TRUSTED_RESOURCES } from "@/app/data/support";
import { CHECK_QUESTIONS, CHECK_RESULTS, GUIDES, RIGHT_NOW, checkResult } from "@/app/data/supportGuides";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "SupportPage" });

const route = useRoute();
const router = useRouter();

// Tabs, kept in the address as ?tab= so other pages can link straight to one.
const TABS = [
  { id: "guides", label: "For you" },
  { id: "baby", label: "Baby care" },
  { id: "rooms", label: "Pumping rooms" },
  { id: "resources", label: "Who to call" },
];
const tabFrom = (value) => (["baby", "resources"].includes(value) ? value : "guides");
const tab = ref(tabFrom(route.query.tab));
watch(
  () => route.query.tab,
  (value) => {
    tab.value = tabFrom(value);
  },
);
watch(tab, (id) => {
  // "Pumping rooms" is its own page; selecting the tab opens it.
  if (id === "rooms") {
    tab.value = tabFrom(route.query.tab);
    router.push(ROUTES.ROOMS);
    return;
  }
  if (tabFrom(route.query.tab) !== id) router.replace({ path: ROUTES.SUPPORT, query: id === "guides" ? {} : { tab: id } });
});

// Right now: one tool open at a time.
const openTool = ref(null);
const tool = computed(() => RIGHT_NOW.find((t) => t.id === openTool.value) ?? null);
const toggleTool = (id) => {
  openTool.value = openTool.value === id ? null : id;
};

// The check. Answers live only in this component and are never saved.
const about = ref("me");
const answers = ref({});
const result = computed(() => checkResult(answers.value));
const answered = computed(() => Object.keys(answers.value).length > 0);
const answer = (id, value) => {
  answers.value = { ...answers.value, [id]: value };
};
const resetCheck = () => {
  answers.value = {};
};
watch(about, resetCheck);
const checkEl = ref(null);
function goToCheck() {
  openTool.value = null;
  checkEl.value?.querySelector("button")?.focus();
}

// Guides: ?guide=<id> opens one in place of the list.
const guide = computed(() => GUIDES.find((g) => g.id === route.query.guide) ?? null);
const nextGuide = computed(() => {
  if (!guide.value) return null;
  const i = GUIDES.indexOf(guide.value);
  return GUIDES[(i + 1) % GUIDES.length];
});
const guideTo = (id) => ({ path: ROUTES.SUPPORT, query: { guide: id } });
const guideHeading = ref(null);
watch(guide, async (value) => {
  if (!value) return;
  await nextTick();
  guideHeading.value?.focus();
});

// Baby care accordion (V2 help content).
const openBaby = ref(new Set());
function toggleBaby(slug) {
  const next = new Set(openBaby.value);
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  openBaby.value = next;
}

// Links to the child care pages; the pages themselves live under /support/kids-care.
const CHILD_LINKS = [
  { id: "kids-emergency", name: "Kids emergency care", purpose: "Children's emergency departments and when to go.", to: "/support/kids-care", label: "See emergency care" },
  { id: "kids-clinics", name: "Clinics for a sick child", purpose: "Nearby CHAS clinics for illness that is not an emergency.", to: "/support/kids-care?view=clinics", label: "Find a clinic" },
];
</script>

<template>
  <div class="sp">
    <header class="sp__head">
      <h1 class="nt-title sp__title">Support</h1>
      <p class="sp__sub">For the hard moments, and for knowing when it is more than tired.</p>
    </header>

    <p class="sp__talk">
      Need to talk to someone now? Samaritans of Singapore, any time:
      <a class="app-link" href="tel:1767">1767</a>.
      <button type="button" class="app-textbtn" @click="tab = 'resources'">More numbers</button>
    </p>

    <Tabs v-model="tab" :tabs="TABS" label="Support sections" id-base="support" />

    <!-- For you -->
    <div v-if="tab === 'guides'" id="support-panel-guides" class="sp__panel" role="tabpanel" aria-labelledby="support-tab-guides">
      <!-- One guide -->
      <article v-if="guide" class="sp__guide" :aria-labelledby="`guide-${guide.id}`">
        <router-link class="app-link sp__back" :to="ROUTES.SUPPORT">All guides</router-link>
        <h2 :id="`guide-${guide.id}`" ref="guideHeading" class="nt-heading sp__guide-title" tabindex="-1">{{ guide.title }}</h2>
        <p class="sp__lead">{{ guide.summary }}</p>

        <section class="sp__block">
          <h3 class="sp__h3">What is going on</h3>
          <ul class="sp__facts">
            <li v-for="f in guide.facts" :key="f">{{ f }}</li>
          </ul>
        </section>

        <section class="sp__block">
          <h3 class="sp__h3">What helps</h3>
          <ol class="sp__helps">
            <li v-for="h in guide.helps" :key="h.text">
              <span>{{ h.text }}</span>
              <router-link v-if="h.link" class="app-link sp__inline-link" :to="h.link.to">{{ h.link.label }}</router-link>
            </li>
          </ol>
        </section>

        <section class="sp__block">
          <h3 class="sp__h3">Words you can use</h3>
          <blockquote class="sp__script">{{ guide.script }}</blockquote>
        </section>

        <section v-if="guide.avoid" class="sp__block">
          <h3 class="sp__h3">Try not to say</h3>
          <ul class="sp__avoid">
            <li v-for="a in guide.avoid" :key="a">{{ a }}</li>
          </ul>
        </section>

        <section class="sp__block">
          <h3 class="sp__h3">Get help if</h3>
          <ul class="sp__gethelp">
            <li v-for="g in guide.getHelp" :key="g.text" :class="{ 'is-urgent': g.urgent }">{{ g.text }}</li>
          </ul>
        </section>

        <p class="sp__sources">
          Sources:
          <template v-for="(s, i) in guide.sources" :key="s.url">
            <a class="app-link" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.title }}, {{ s.publisher }}</a><span v-if="i < guide.sources.length - 1">; </span><span v-else>.</span>
          </template>
          General guidance only, not medical advice.
        </p>

        <router-link v-if="nextGuide" class="sp__next" :to="guideTo(nextGuide.id)">
          <span class="sp__muted">Next guide</span>
          <span class="sp__next-title">{{ nextGuide.title }}</span>
        </router-link>
      </article>

      <template v-else>
        <!-- Right now -->
        <section class="sp__section" aria-labelledby="sp-now">
          <h2 id="sp-now" class="nt-heading sp__h2">Right now</h2>
          <p class="sp__muted">For the next ten minutes. Pick the one closest to how you feel.</p>
          <div class="sp__tools">
            <button
              v-for="t in RIGHT_NOW"
              :id="`tool-btn-${t.id}`"
              :key="t.id"
              type="button"
              class="sp__tool"
              :aria-expanded="openTool === t.id ? 'true' : 'false'"
              aria-controls="tool-panel"
              @click="toggleTool(t.id)"
            >
              {{ t.label }}
            </button>
          </div>
          <div v-if="tool" id="tool-panel" class="sp__tool-panel" role="region" :aria-labelledby="`tool-btn-${tool.id}`">
            <ol class="sp__tool-steps">
              <li v-for="s in tool.steps" :key="s">{{ s }}</li>
            </ol>
            <p v-if="tool.note" class="sp__muted">{{ tool.note }}</p>
            <button v-if="tool.link?.check" type="button" class="app-textbtn" @click="goToCheck">{{ tool.link.label }}</button>
            <router-link v-else-if="tool.link" class="app-link" :to="tool.link.to">{{ tool.link.label }}</router-link>
          </div>
        </section>

        <!-- The check -->
        <section id="support-check" ref="checkEl" class="sp__card" aria-labelledby="sp-check">
          <h2 id="sp-check" class="nt-heading sp__h2">Is this more than tired?</h2>
          <p class="sp__muted">Five questions, one tap each. Nothing here is saved, and it is not a diagnosis.</p>

          <div class="sp__about">
            <span class="sp__label" id="sp-about">Who is this about?</span>
            <div class="sp__seg-group" role="radiogroup" aria-labelledby="sp-about">
              <button type="button" role="radio" class="sp__seg" :aria-checked="about === 'me' ? 'true' : 'false'" @click="about = 'me'">Me</button>
              <button type="button" role="radio" class="sp__seg" :aria-checked="about === 'partner' ? 'true' : 'false'" @click="about = 'partner'">My partner</button>
            </div>
          </div>

          <ol class="sp__questions">
            <li v-for="(q, i) in CHECK_QUESTIONS" :key="q.id" class="sp__question">
              <p :id="`q-${q.id}`" class="sp__q-text"><span class="sp__q-num">{{ i + 1 }}</span>{{ q[about] }}</p>
              <div class="sp__seg-group sp__seg-group--yn" role="radiogroup" :aria-labelledby="`q-${q.id}`">
                <button type="button" role="radio" class="sp__seg" :aria-checked="answers[q.id] === true ? 'true' : 'false'" @click="answer(q.id, true)">Yes</button>
                <button type="button" role="radio" class="sp__seg" :aria-checked="answers[q.id] === false ? 'true' : 'false'" @click="answer(q.id, false)">No</button>
              </div>
            </li>
          </ol>

          <div aria-live="polite">
            <div v-if="result === 'urgent'" class="sp__result sp__result--urgent">
              <h3 class="sp__result-title">Get help today</h3>
              <p>Please do not wait on this. It does not mean anyone has done anything wrong, and help works.</p>
              <ul class="sp__result-calls">
                <li><a class="app-link" href="tel:995">Call 995</a> or go to the nearest A&amp;E if anyone is in danger now.</li>
                <li><a class="app-link" href="tel:1767">Call 1767</a>, Samaritans of Singapore, to talk to someone any time.</li>
                <li><a class="app-link" href="tel:+6563892222">Call 6389 2222</a>, the IMH Mental Health Helpline.</li>
              </ul>
              <p v-if="about === 'partner'">Stay with them if you can, and make the call together.</p>
              <p v-else>If someone is nearby, tell them now. You do not have to explain it well.</p>
            </div>
            <div v-else-if="result" class="sp__result">
              <h3 class="sp__result-title">{{ CHECK_RESULTS[result].title }}</h3>
              <p>{{ CHECK_RESULTS[result].body }}</p>
              <blockquote v-if="CHECK_RESULTS[result].script" class="sp__script">{{ CHECK_RESULTS[result].script[about] }}</blockquote>
              <div class="sp__result-links">
                <router-link v-for="l in CHECK_RESULTS[result].links" :key="l.label" class="app-link" :to="l.to">{{ l.label }}</router-link>
              </div>
            </div>
          </div>

          <button v-if="answered" type="button" class="app-textbtn sp__reset" @click="resetCheck">Start again</button>
        </section>

        <!-- Guides -->
        <section class="sp__section" aria-labelledby="sp-guides">
          <h2 id="sp-guides" class="nt-heading sp__h2">Guides</h2>
          <p class="sp__muted">What is going on, what helps, what to say, and when to get help. A few minutes each.</p>
          <ul class="sp__list">
            <li v-for="g in GUIDES" :key="g.id">
              <router-link class="sp__row" :to="guideTo(g.id)">
                <span class="sp__row-body">
                  <span class="sp__row-title">{{ g.title }}</span>
                  <span class="sp__row-summary">{{ g.summary }}</span>
                </span>
                <span class="sp__row-chev" aria-hidden="true"><Icon name="chevron-down" :size="20" /></span>
              </router-link>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <!-- Baby care -->
    <div v-else-if="tab === 'baby'" id="support-panel-baby" class="sp__panel" role="tabpanel" aria-labelledby="support-tab-baby">
      <ul class="sp__acc">
        <li v-for="g in SUPPORT_GUIDES" :key="g.slug" class="sp__acc-item">
          <h2 class="sp__acc-h">
            <button
              :id="`guide-btn-${g.slug}`"
              type="button"
              class="sp__acc-btn"
              :aria-expanded="openBaby.has(g.slug) ? 'true' : 'false'"
              :aria-controls="`guide-panel-${g.slug}`"
              @click="toggleBaby(g.slug)"
            >
              <span>
                <span class="sp__acc-title">{{ g.title }}</span>
                <span class="sp__muted sp__acc-blurb">{{ g.blurb }}</span>
              </span>
              <span class="sp__chev" :class="{ 'sp__chev--open': openBaby.has(g.slug) }"><Icon name="chevron-down" :size="20" /></span>
            </button>
          </h2>
          <div v-if="openBaby.has(g.slug)" :id="`guide-panel-${g.slug}`" class="sp__acc-panel" role="region" :aria-labelledby="`guide-btn-${g.slug}`">
            <p class="sp__text">{{ g.intro }}</p>
            <ol class="sp__acc-steps">
              <li v-for="s in g.steps" :key="s.title"><strong>{{ s.title }}.</strong> {{ s.body }}</li>
            </ol>
            <p class="sp__text sp__strong">Call your doctor if:</p>
            <ul class="sp__bullets">
              <li v-for="c in g.callIf" :key="c">{{ c }}</li>
            </ul>
          </div>
        </li>
      </ul>
      <p class="sp__muted">General guidance only, not medical advice.</p>
    </div>

    <!-- Who to call -->
    <div v-else id="support-panel-resources" class="sp__panel" role="tabpanel" aria-labelledby="support-tab-resources">
      <p class="sp__muted">Check numbers and hours before you rely on them.</p>
      <h2 class="sp__group">For you</h2>
      <ul class="sp__res">
        <li v-for="r in TRUSTED_RESOURCES" :key="r.id" class="sp__res-item">
          <h3 class="sp__res-name">{{ r.name }}</h3>
          <p class="sp__text">{{ r.purpose }}</p>
          <a v-if="r.tel" class="app-link" :href="r.tel">Call {{ r.telLabel }}</a>
        </li>
      </ul>
      <h2 class="sp__group">For your child</h2>
      <ul class="sp__res">
        <li v-for="c in CHILD_LINKS" :key="c.id" class="sp__res-item">
          <h3 class="sp__res-name">{{ c.name }}</h3>
          <p class="sp__text">{{ c.purpose }}</p>
          <router-link class="app-link" :to="c.to">{{ c.label }}<span class="visually-hidden">: {{ c.name }}</span></router-link>
        </li>
      </ul>
      <p class="sp__muted">General guidance only, not medical advice.</p>
    </div>
  </div>
</template>

<style scoped>
.sp { display: flex; flex-direction: column; gap: 24px; max-width: 880px; font-size: 1rem; color: var(--nt-ink); }
.sp__head { display: flex; flex-direction: column; gap: 8px; }
.sp__sub { margin: 0; color: var(--nt-muted); }
.sp__muted { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-muted); }
.sp__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.sp__strong { font-weight: 600; }

.sp__talk { margin: 0; padding: 12px 16px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 8px; font-size: 0.9375rem; line-height: 1.5; }
.sp__talk .app-link { font-size: inherit; font-weight: 600; }
.sp__talk .app-textbtn { margin-left: 8px; }

.sp__panel { display: flex; flex-direction: column; gap: 32px; }
.sp__section { display: flex; flex-direction: column; gap: 8px; }
.sp__h2 { font-size: 1.5rem; line-height: 1.3; }
.sp__card { display: flex; flex-direction: column; gap: 12px; padding: 24px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; scroll-margin-top: 80px; }

/* Right now */
.sp__tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 8px; }
.sp__tool { min-height: 64px; padding: 14px 16px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 8px; font-family: inherit; font-size: 0.9375rem; font-weight: 500; line-height: 1.4; text-align: left; color: var(--nt-ink); cursor: pointer; transition: background-color 0.15s, border-color 0.15s; }
.sp__tool:hover { background: var(--nt-gray); }
.sp__tool[aria-expanded="true"] { background: var(--nt-gray); border-color: var(--nt-plum); color: var(--nt-plum); }
.sp__tool:focus-visible, .sp__seg:focus-visible, .sp__row:focus-visible, .sp__acc-btn:focus-visible, .sp__next:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; }
.sp__tool-panel { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; margin-top: 4px; padding: 20px 24px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.sp__tool-steps { display: flex; flex-direction: column; gap: 10px; margin: 0; padding-left: 20px; font-size: 0.9375rem; line-height: 1.55; }

/* The check */
.sp__about { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 4px; }
.sp__label { font-size: 0.9375rem; font-weight: 600; }
.sp__seg-group { display: inline-flex; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 8px; overflow: hidden; }
.sp__seg { min-width: 72px; min-height: 40px; padding: 8px 16px; background: var(--nt-surface, #fff); border: 0; border-left: 1px solid var(--nt-line); font-family: inherit; font-size: 0.875rem; font-weight: 500; color: var(--nt-muted); cursor: pointer; }
.sp__seg:first-child { border-left: 0; }
.sp__seg:hover { background: var(--nt-gray); color: var(--nt-ink); }
.sp__seg[aria-checked="true"] { background: var(--nt-gray); color: var(--nt-plum); font-weight: 600; box-shadow: inset 0 0 0 1.5px var(--nt-plum); }
.sp__questions { margin: 8px 0 0; padding: 0; list-style: none; }
.sp__question { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; padding: 14px 0; border-top: 1px solid var(--nt-line); }
.sp__q-text { display: flex; gap: 12px; margin: 0; font-size: 0.9375rem; line-height: 1.5; }
.sp__q-num { flex: none; width: 1.25rem; color: var(--nt-muted); }
.sp__seg-group--yn { flex: none; }
.sp__result { display: flex; flex-direction: column; gap: 10px; padding: 20px; background: var(--nt-gray); border-radius: 8px; font-size: 0.9375rem; line-height: 1.55; }
.sp__result p { margin: 0; }
.sp__result--urgent { background: var(--nt-red); border: 1px solid var(--nt-red-line); color: var(--nt-red-t); }
.sp__result--urgent .app-link { color: var(--nt-red-t); font-size: inherit; font-weight: 600; }
.sp__result-title { margin: 0; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 400; }
.sp__result-calls { display: flex; flex-direction: column; gap: 6px; margin: 0; padding-left: 20px; }
.sp__result-links { display: flex; flex-wrap: wrap; gap: 8px 20px; }
.sp__reset { align-self: flex-start; }

/* Guide list */
.sp__list { margin: 8px 0 0; padding: 0; list-style: none; border: 1px solid var(--nt-line); border-radius: 12px; background: var(--nt-surface, #fff); overflow: hidden; }
.sp__list li + li { border-top: 1px solid var(--nt-line); }
.sp__row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; color: var(--nt-ink); text-decoration: none; }
.sp__row:hover { background: var(--nt-gray); }
.sp__row-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sp__row-title { font-size: 1rem; font-weight: 600; }
.sp__row-summary { font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.sp__row-chev { flex: none; display: inline-flex; color: var(--nt-muted); transform: rotate(-90deg); }

/* One guide */
.sp__guide { display: flex; flex-direction: column; gap: 24px; max-width: 680px; }
.sp__back::before { content: "\2190\00a0"; }
.sp__guide-title { font-size: 2rem; line-height: 1.2; }
.sp__guide-title:focus { outline: none; }
.sp__lead { margin: -12px 0 0; font-size: 1.0625rem; line-height: 1.55; color: var(--nt-muted); }
.sp__block { display: flex; flex-direction: column; gap: 10px; }
.sp__h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.sp__facts, .sp__avoid, .sp__gethelp { display: flex; flex-direction: column; gap: 8px; margin: 0; padding-left: 20px; font-size: 0.9375rem; line-height: 1.6; }
.sp__helps { display: flex; flex-direction: column; gap: 12px; margin: 0; padding-left: 20px; font-size: 0.9375rem; line-height: 1.6; }
.sp__inline-link { display: inline-block; margin-left: 8px; }
.sp__script { margin: 0; padding: 14px 18px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-left: 3px solid var(--nt-plum); border-radius: 8px; font-size: 0.9375rem; line-height: 1.6; }
.sp__avoid { color: var(--nt-muted); }
.sp__gethelp li.is-urgent { margin-left: -20px; padding: 10px 14px; list-style: none; background: var(--nt-red); border: 1px solid var(--nt-red-line); border-radius: 8px; color: var(--nt-red-t); }
.sp__sources { margin: 0; padding-top: 16px; border-top: 1px solid var(--nt-line); font-size: 0.875rem; line-height: 1.6; color: var(--nt-muted); }
.sp__next { display: flex; flex-direction: column; gap: 2px; padding: 16px 20px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; color: var(--nt-ink); text-decoration: none; }
.sp__next:hover { background: var(--nt-gray); }
.sp__next-title { font-family: var(--nt-serif); font-size: 1.125rem; }

/* Baby care accordion */
.sp__acc { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; margin: 0; padding: 0; list-style: none; }
.sp__acc-item { background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.sp__acc-h { margin: 0; font-size: 1rem; }
.sp__acc-btn { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 20px 24px; background: none; border: 0; border-radius: 12px; font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; }
.sp__acc-title { display: block; font-size: 1rem; font-weight: 600; }
.sp__acc-blurb { display: block; margin-top: 2px; font-weight: 400; }
.sp__chev { display: inline-flex; flex: none; color: var(--nt-muted); }
.sp__chev--open { transform: rotate(180deg); }
.sp__acc-panel { display: flex; flex-direction: column; gap: 12px; margin: 0 24px; padding: 16px 0 20px; border-top: 1px solid var(--nt-line); }
.sp__acc-steps, .sp__bullets { margin: 0; padding-left: 20px; font-size: 0.875rem; line-height: 1.5; }
.sp__acc-steps li { margin-bottom: 8px; }

/* Who to call */
.sp__group { margin: 0 0 -16px; font-size: 1rem; font-weight: 600; }
.sp__res { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
.sp__res-item { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 20px 24px; background: var(--nt-surface, #fff); border: 1px solid var(--nt-line); border-radius: 12px; }
.sp__res-name { margin: 0; font-size: 1rem; font-weight: 600; }
.sp__res-item .app-link { margin-top: 4px; font-weight: 600; }

@media (max-width: 991px) {
  .sp__title { font-size: 2rem; }
  .sp__acc { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .sp__tools, .sp__res { grid-template-columns: minmax(0, 1fr); }
  .sp__question { flex-direction: column; align-items: flex-start; }
  .sp__seg-group--yn { margin-left: 32px; }
  .sp__card { padding: 20px 16px; }
  .sp__guide-title { font-size: 1.625rem; }
}
</style>
