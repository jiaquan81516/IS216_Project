<script setup>
import "@/app/app.css";
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "@/app/components/Icon.vue";
import Tabs from "@/app/components/Tabs.vue";
import { SUPPORT_GUIDES, TRUSTED_RESOURCES } from "@/app/data/support";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "AdminSupportPage" });

const TABS = [
  { id: "guides", label: "Guides" },
  { id: "rooms", label: "Pumping rooms" },
  { id: "resources", label: "Trusted resources" },
];
const route = useRoute();
const router = useRouter();
const tab = ref(route.query.tab === "resources" ? "resources" : "guides");
// "Pumping rooms" is its own page; selecting the tab opens it.
watch(tab, (id) => {
  if (id === "rooms") {
    tab.value = "guides";
    router.push(ROUTES.ROOMS);
  }
});

// Links to the child care pages; the pages themselves live under /support/kids-care.
const CHILD_LINKS = [
  { id: "kids-emergency", name: "Kids emergency care", purpose: "Children's emergency departments and when to go.", to: "/support/kids-care", label: "See emergency care" },
  { id: "kids-clinics", name: "Clinics for a sick child", purpose: "Nearby CHAS clinics for illness that is not an emergency.", to: "/support/kids-care?view=clinics", label: "Find a clinic" },
];

// Guides accordion
const openGuides = ref(new Set());
function toggleGuide(slug) {
  const next = new Set(openGuides.value);
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  openGuides.value = next;
}
</script>

<template>
  <div class="sp">
    <header class="sp__head">
      <h1 class="nt-title sp__title">Support</h1>
      <p class="sp__sub">Guides and trusted contacts.</p>
    </header>

    <Tabs v-model="tab" :tabs="TABS" label="Support sections" id-base="support" />

    <!-- Guides -->
    <div v-if="tab === 'guides'" id="support-panel-guides" class="sp__guides" role="tabpanel" aria-labelledby="support-tab-guides">
      <ul class="sp__acc">
        <li v-for="g in SUPPORT_GUIDES" :key="g.slug" class="sp__acc-item">
          <h2 class="sp__acc-h">
            <button
              :id="`guide-btn-${g.slug}`"
              type="button"
              class="sp__acc-btn"
              :aria-expanded="openGuides.has(g.slug) ? 'true' : 'false'"
              :aria-controls="`guide-panel-${g.slug}`"
              @click="toggleGuide(g.slug)"
            >
              <span class="sp__acc-lead">
                <svg class="sp__ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" /><path d="M5 16a4 4 0 0 1 4-4h10" /></svg>
                <span>
                <span class="sp__acc-title">{{ g.title }}</span>
                <span class="sp__muted sp__acc-blurb">{{ g.blurb }}</span>
                </span>
              </span>
              <span class="sp__chev" :class="{ 'sp__chev--open': openGuides.has(g.slug) }"><Icon name="chevron-down" :size="20" /></span>
            </button>
          </h2>
          <div
            v-if="openGuides.has(g.slug)"
            :id="`guide-panel-${g.slug}`"
            class="sp__acc-panel"
            role="region"
            :aria-labelledby="`guide-btn-${g.slug}`"
          >
            <p class="sp__text">{{ g.intro }}</p>
            <ol class="sp__steps">
              <li v-for="s in g.steps" :key="s.title">
                <strong>{{ s.title }}.</strong> {{ s.body }}
              </li>
            </ol>
            <p class="sp__text sp__strong">Call your doctor if:</p>
            <ul class="sp__bullets">
              <li v-for="c in g.callIf" :key="c">{{ c }}</li>
            </ul>
          </div>
        </li>
      </ul>
      
      <div>
          <p class="sp__muted sp__guides-note">General guidance only, not medical advice.</p>
          <AppButton ref="addButton" variant="outline" size="sm" @click="openForm">Add a guide</AppButton>
      </div>

    </div>

    <!-- Trusted resources -->
    <div v-else id="support-panel-resources" class="sp__resources" role="tabpanel" aria-labelledby="support-tab-resources">
      <p class="sp__muted">Check numbers and hours before you rely on them.</p>
      <h2 class="sp__group">For your child</h2>
      <ul class="sp__res">
        <li v-for="c in CHILD_LINKS" :key="c.id" class="sp__res-item">
          <svg class="sp__ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z" /></svg>
          <div class="sp__res-body">
            <h3 class="sp__res-name">{{ c.name }}</h3>
            <p class="sp__text">{{ c.purpose }}</p>
          </div>
          <router-link class="app-link sp__res-link" :to="c.to">{{ c.label }}<span class="visually-hidden">: {{ c.name }}</span></router-link>
        </li>
      </ul>
      <h2 class="sp__group">Contacts</h2>
      <ul class="sp__res">
        <li v-for="r in TRUSTED_RESOURCES" :key="r.id" class="sp__res-item">
          <svg class="sp__ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>
          <div class="sp__res-body">
            <h2 class="sp__res-name">{{ r.name }}</h2>
            <p class="sp__text">{{ r.purpose }}</p>
          </div>
          <a v-if="r.tel" class="app-link sp__res-link" :href="r.tel">{{ r.telLabel }}</a>
        </li>
      </ul>

      <div>
        <p class="sp__muted">General guidance only, not medical advice.</p>
        <AppButton ref="addButton" variant="outline" size="sm" @click="openForm">Add a trusted resource</AppButton>
      </div>

    </div>
  </div>
</template>

<style scoped>
.sp { display: flex; flex-direction: column; gap: 24px; font-size: 1rem; }
.sp__head { display: flex; flex-direction: column; gap: 8px; }
.sp__title { font-size: 2.5rem; line-height: 1.2; }
.sp__sub { margin: 0; color: var(--nt-muted); }
.sp__muted { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--nt-muted); }
.sp__text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--nt-ink); }
.sp__strong { font-weight: 600; }
.sp__guides, .sp__resources { display: flex; flex-direction: column; gap: 16px; }
.sp__guides-note { padding-top: 4px; }

.sp__acc { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; margin: 0; padding: 0; list-style: none; }
.sp__acc-item { background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.sp__acc-lead { display: flex; align-items: flex-start; gap: 12px; }
.sp__ico { flex: none; margin-top: 2px; color: var(--nt-muted); }
.sp__acc-h { margin: 0; font-size: 1rem; }
.sp__acc-btn { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 20px 24px; background: none; border-radius: 12px; border: 0; font-family: inherit; text-align: left; color: var(--nt-ink); cursor: pointer; }
.sp__acc-btn:hover .sp__acc-title { color: var(--nt-plum); }
.sp__acc-btn:focus-visible { outline: 2px solid var(--nt-plum); outline-offset: 2px; border-radius: 4px; }
.sp__acc-title { display: block; font-size: 1rem; font-weight: 600; }
.sp__acc-blurb { display: block; margin-top: 2px; font-weight: 400; }
.sp__chev { display: inline-flex; flex: none; color: var(--nt-muted); }
.sp__chev--open { transform: rotate(180deg); }
.sp__acc-panel { display: flex; flex-direction: column; gap: 12px; margin: 0 24px; padding: 16px 0 20px; border-top: 1px solid var(--nt-line); }
.sp__steps { margin: 0; padding-left: 20px; font-size: 0.875rem; line-height: 1.5; }
.sp__steps li { margin-bottom: 8px; }
.sp__bullets { margin: 0; padding-left: 20px; font-size: 0.875rem; line-height: 1.5; }

.sp__res { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
.sp__res-item { display: grid; grid-template-columns: auto minmax(0, 1fr); align-content: start; gap: 12px; padding: 20px 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.sp__res-body { min-width: 0; }
.sp__res-link { grid-column: 2; font-weight: 600; }
.sp__res-name { margin: 0 0 4px; font-size: 1rem; font-weight: 600; }

.sp__group { margin: 8px 0 0; font-size: 1rem; font-weight: 600; color: var(--nt-ink); }

@media (max-width: 1099px) {
  .sp__res { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 991px) {
  .sp__acc { grid-template-columns: minmax(0, 1fr); }
  .sp__title { font-size: 2rem; }
}
@media (max-width: 575px) {
  .sp__res { grid-template-columns: minmax(0, 1fr); }
}
</style>
