<script setup>
import Collapse from "@/app/components/Collapse.vue";
import "@/app/app.css";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "@/app/components/Icon.vue";
import PageHero from "@/app/components/PageHero.vue";
import SegToggle from "@/app/components/SegToggle.vue";
import AppButton from "@/components/ui/AppButton.vue";
import SupportItemActions from "@/app/components/admin/SupportItemActions.vue";
import SupportItemForm from "@/app/components/admin/SupportItemForm.vue";
import { useAdmin } from "@/composables/useAdmin";
import { useSupportEditor } from "@/app/composables/useSupportEditor";
import { useSupportContent } from "@/app/composables/useSupportContent";
import PumpingRooms from "@/app/pages/pumping-rooms/index.vue";
import { TRUSTED_RESOURCES, contactHref } from "@/app/data/support";
import { CHECK_QUESTIONS, CHECK_RESULTS, GUIDES, RIGHT_NOW, checkResult } from "@/app/data/supportGuides";
import { ROUTES } from "@/app/routes";

defineOptions({ name: "SupportPage" });

// Baby care guides and the contact list: what an administrator saved, or the built-in defaults.
const { guides, contacts } = useSupportContent();
const { isAdmin } = useAdmin();
const guideEditor = useSupportEditor("guides", guides);
const contactEditor = useSupportEditor("contacts", contacts);

// An older saved list may still have one "Local emergency number" card. Show it as two, ambulance and
// police, each with its own call button. An administrator still sees the saved list as it is, so edits
// line up with what is stored.
const shownContacts = computed(() => {
  if (isAdmin.value) return contacts.value;
  const split = TRUSTED_RESOURCES.filter((c) => c.id === "emergency" || c.id === "police").map((c) => ({ ...c, tel: contactHref(c) }));
  return contacts.value.flatMap((c) => (/local emergency/i.test(c.name ?? "") ? split : [c]));
});

const route = useRoute();
const router = useRouter();

// Tabs, kept in the address so links and the back button work. Pumping rooms is a tab of this
// page too (/support/rooms), so changing tab never reloads the page.
const ALL_TABS = [
  { id: "guides", label: "For you" },
  { id: "baby", label: "Baby care" },
  { id: "rooms", label: "Pumping rooms" },
  { id: "resources", label: "Who to call" },
];
// Administrators manage rooms on their own page, so the rooms tab is left out for them.
const TABS = computed(() => (isAdmin.value ? ALL_TABS.filter((t) => t.id !== "rooms") : ALL_TABS));
function tabFromRoute() {
  if (route.path === ROUTES.ROOMS && !isAdmin.value) return "rooms";
  return ["baby", "resources"].includes(route.query.tab) ? route.query.tab : "guides";
}
const tab = ref(tabFromRoute());
const targetFor = (id) =>
  id === "rooms" ? ROUTES.ROOMS : id === "guides" ? ROUTES.SUPPORT : { path: ROUTES.SUPPORT, query: { tab: id } };
// (On the administrator's workspace the same page sits inside /admin and keeps that address.)
const ownsAddress = () => route.path.startsWith(ROUTES.SUPPORT);
watch(tab, (id) => {
  if (ownsAddress() && tabFromRoute() !== id) router.push(targetFor(id));
});
watch(
  () => [route.path, route.query.tab],
  () => {
    if (!ownsAddress()) return;
    const next = tabFromRoute();
    if (next !== tab.value) tab.value = next;
  },
);

// Right now: one tool open at a time.
const openTool = ref(null);
const tool = computed(() => RIGHT_NOW.find((t) => t.id === openTool.value) ?? null);
const TOOL_ICON = { crying: "heart", spiral: "chat", snapping: "lifebuoy", "cant-sleep": "moon" };
const GUIDE_ICONS = ["heart", "moon", "chat", "lifebuoy"];
const toggleTool = (id) => {
  openTool.value = openTool.value === id ? null : id;
};

// The check. Answers live only in this component and are never saved.
const about = ref("me");
const answers = ref({});
const result = computed(() => checkResult(answers.value));
const answered = computed(() => Object.keys(answers.value).length > 0);
const answeredCount = computed(() => Object.keys(answers.value).length);
const answer = (id, value) => {
  answers.value = { ...answers.value, [id]: value };
};
const RESULT_ICON = { urgent: "lifebuoy", doctor: "stethoscope", ordinary: "sun" };
const LINK_ICON = { [ROUTES.CALENDAR]: "calendar", [ROUTES.ROTA]: "moon" };
const resultEl = ref(null);
const copied = ref(false);
async function copyScript(text) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1800);
  } catch {
    copied.value = false;
  }
}
watch(result, async (value) => {
  if (!value) return;
  await nextTick();
  resultEl.value?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
const resetCheck = () => {
  answers.value = {};
};
watch(about, resetCheck);
const checkEl = ref(null);
function goToCheck() {
  openTool.value = null;
  checkEl.value?.querySelector("button")?.focus();
}

// Guides: ?guide=<id> opens one inside the Guides card, in place of the list.
const guide = computed(() => GUIDES.find((g) => g.id === route.query.guide) ?? null);
const guideIndex = computed(() => (guide.value ? GUIDES.indexOf(guide.value) : -1));
const nextGuide = computed(() => (guide.value ? GUIDES[(guideIndex.value + 1) % GUIDES.length] : null));
const prevGuide = computed(() => (guide.value ? GUIDES[(guideIndex.value - 1 + GUIDES.length) % GUIDES.length] : null));
const guideTo = (id) => ({ path: ROUTES.SUPPORT, query: { guide: id } });
const GUIDE_SECTIONS = [
  { id: "going", label: "What is going on", show: (g) => g.facts.length > 1 },
  { id: "helps", label: "What helps", show: () => true },
  { id: "say", label: "What to say", show: () => true },
  { id: "help", label: "Get help if", show: () => true },
];
const gsec = ref("helps");
const guideHeading = ref(null);
watch(guide, async (value) => {
  gsec.value = value && value.facts.length > 1 ? "going" : "helps";
  await nextTick();
  if (value) guideHeading.value?.focus({ preventScroll: true });
});

// Your own doctor's number. Kept on this device only, so it never leaves the phone it was typed on.
const DOCTOR_KEY = "nurturetrack.doctorNumber";
function readDoctor() {
  try {
    return localStorage.getItem(DOCTOR_KEY) ?? "";
  } catch {
    return "";
  }
}
const doctorNumber = ref(readDoctor());
const doctorEditing = ref(false);
const doctorDraft = ref("");
const doctorHref = computed(() => {
  const digits = doctorNumber.value.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
});
const doctorValid = computed(() => doctorDraft.value.replace(/\D/g, "").length === 8);
// Digits only, at most 8, shown as "6123 4567".
function formatDoctor(value) {
  const d = String(value).replace(/\D/g, "").slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 4)} ${d.slice(4)}` : d;
}
function startDoctor() {
  doctorDraft.value = doctorNumber.value;
  doctorEditing.value = true;
}
function saveDoctor() {
  if (!doctorValid.value) return;
  doctorNumber.value = doctorDraft.value.trim();
  try {
    localStorage.setItem(DOCTOR_KEY, doctorNumber.value);
  } catch {
    // Not saved across visits, but it still shows for now.
  }
  doctorEditing.value = false;
}
function removeDoctor() {
  doctorNumber.value = "";
  try {
    localStorage.removeItem(DOCTOR_KEY);
  } catch {
    // Nothing to clear.
  }
  doctorEditing.value = false;
}

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
    <PageHero eyebrow="Here for you both" title="Support" lead="For the hard moments, and for knowing when it is more than tired.">
    </PageHero>

    <SegToggle v-model="tab" :options="TABS.map((t) => ({ value: t.id, label: t.label }))" label="Support sections" class="sp__tabs" />

    <Transition name="sp-swap" mode="out-in">
    <!-- For you -->
    <div v-if="tab === 'guides'" key="guides" id="support-panel-guides" class="sp__panel">
        <!-- Right now -->
        <section class="sp__card" aria-labelledby="sp-now">
          <h2 id="sp-now" class="sp__h2">Right now</h2>
          <p class="sp__muted">For the next ten minutes. Pick the one closest to how you feel.</p>
          <ul class="sp__tools">
            <li v-for="t in RIGHT_NOW" :key="t.id">
              <button
                :id="`tool-btn-${t.id}`"
                type="button"
                class="sp__tool"
                :aria-expanded="openTool === t.id ? 'true' : 'false'"
                aria-controls="tool-panel"
                @click="toggleTool(t.id)"
              >
                <span class="sp__tool-ico" aria-hidden="true"><Icon :name="TOOL_ICON[t.id] || 'heart'" :size="20" /></span>
                <span class="sp__tool-label">{{ t.label }}</span>
              </button>
            </li>
          </ul>
          <Collapse>
            <div v-if="tool" id="tool-panel" class="sp__tool-panel" role="region" :aria-labelledby="`tool-btn-${tool.id}`">
              <ol class="sp__tool-steps">
                <li v-for="s in tool.steps" :key="s">{{ s }}</li>
              </ol>
              <p v-if="tool.note" class="sp__muted">{{ tool.note }}</p>
              <button v-if="tool.link?.check" type="button" class="app-textbtn" @click="goToCheck">{{ tool.link.label }}</button>
              <router-link v-else-if="tool.link" class="app-link" :to="tool.link.to">{{ tool.link.label }}</router-link>
            </div>
          </Collapse>
        </section>

        <!-- The check -->
        <section id="support-check" ref="checkEl" class="sp__card" aria-labelledby="sp-check">
          <h2 id="sp-check" class="sp__h2">Is this more than tired?</h2>
          <p class="sp__muted">Five questions, one tap each. Nothing here is saved, and it is not a diagnosis.</p>

          <div class="sp__about">
            <span class="sp__label" id="sp-about">Who is this about?</span>
            <SegToggle v-model="about" :options="[{ value: 'me', label: 'Me' }, { value: 'partner', label: 'My partner' }]" label="Who is this about?" class="sp__about-toggle" />
          </div>
          <div class="sp__progwrap">
            <div class="sp__prog" role="progressbar" aria-label="Questions answered" :aria-valuenow="answeredCount" aria-valuemin="0" :aria-valuemax="CHECK_QUESTIONS.length">
              <i :style="{ width: `${(answeredCount / CHECK_QUESTIONS.length) * 100}%` }"></i>
            </div>
            <span class="sp__progtxt">{{ answeredCount }} of {{ CHECK_QUESTIONS.length }}</span>
          </div>

          <ol class="sp__questions">
            <li v-for="(q, i) in CHECK_QUESTIONS" :key="q.id" class="sp__question" :class="{ 'is-done': answers[q.id] !== undefined }">
              <p :id="`q-${q.id}`" class="sp__q-text"><span class="sp__q-num">{{ answers[q.id] !== undefined ? "✓" : i + 1 }}</span>{{ q[about] }}</p>
              <div class="sp__yn" role="radiogroup" :aria-labelledby="`q-${q.id}`">
                <button type="button" role="radio" :aria-checked="answers[q.id] === true" class="sp__ans sp__ans--yes" :class="{ on: answers[q.id] === true }" @click="answer(q.id, true)">Yes</button>
                <button type="button" role="radio" :aria-checked="answers[q.id] === false" class="sp__ans sp__ans--no" :class="{ on: answers[q.id] === false }" @click="answer(q.id, false)">No</button>
              </div>
            </li>
          </ol>

          <div aria-live="polite">
            <div v-if="result" ref="resultEl" class="sp__result" :class="`sp__result--${result}`">
              <div class="sp__result-head">
                <span class="sp__result-ico" aria-hidden="true"><Icon :name="RESULT_ICON[result]" :size="22" /></span>
                <h3 class="sp__result-title">{{ result === "urgent" ? "Get help today" : CHECK_RESULTS[result].title }}</h3>
              </div>

              <template v-if="result === 'urgent'">
                <p>Please do not wait on this. It does not mean anyone has done anything wrong, and help works.</p>
                <ul class="sp__result-calls">
                  <li><a class="sp__call sp__call--urgent" href="tel:995"><span class="sp__call-ico"><Icon name="cross" :size="18" /></span><strong>995</strong><span class="sp__call-txt">If anyone is in danger now, or go to the nearest A&amp;E</span></a></li>
                  <li><a class="sp__call" href="tel:1767"><span class="sp__call-ico"><Icon name="chat" :size="18" /></span><strong>1767</strong><span class="sp__call-txt">Samaritans of Singapore, any time</span></a></li>
                  <li><a class="sp__call" href="tel:+6563892222"><span class="sp__call-ico"><Icon name="phone" :size="18" /></span><strong>6389 2222</strong><span class="sp__call-txt">IMH Mental Health Helpline</span></a></li>
                </ul>
                <p class="sp__result-note">{{ about === "partner" ? "Stay with them if you can, and make the call together." : "If someone is nearby, tell them now. You do not have to explain it well." }}</p>
              </template>
              <template v-else>
                <p>{{ CHECK_RESULTS[result].body }}</p>
                <figure v-if="CHECK_RESULTS[result].script" class="sp__say">
                  <figcaption><Icon name="chat" :size="16" /> You could say</figcaption>
                  <blockquote class="sp__script">{{ CHECK_RESULTS[result].script[about] }}</blockquote>
                  <button type="button" class="sp__copy" @click="copyScript(CHECK_RESULTS[result].script[about])"><Icon :name="copied ? 'check' : 'copy'" :size="14" /> {{ copied ? "Copied" : "Copy" }}</button>
                </figure>
                <div class="sp__result-links">
                  <router-link v-for="l in CHECK_RESULTS[result].links" :key="l.label" class="sp__pill" :to="l.to"><Icon :name="LINK_ICON[l.to] ?? 'chevron'" :size="16" />{{ l.label }}</router-link>
                </div>
              </template>
            </div>
          </div>

          <p v-if="!result" class="sp__muted sp__hint">Answer all five and we will suggest a next step.</p>
          <button v-if="answered" type="button" class="app-textbtn sp__reset" @click="resetCheck">Start again</button>
        </section>

        <!-- Guides: the list and one open guide share this card -->
        <section id="support-guides" class="sp__card" aria-labelledby="sp-guides">
          <template v-if="!guide">
            <h2 id="sp-guides" class="sp__h2">Guides</h2>
            <p class="sp__muted">What is going on, what helps, what to say, and when to get help. A few minutes each.</p>
            <ul class="sp__list">
              <li v-for="(g, i) in GUIDES" :key="g.id">
                <router-link class="sp__row" :to="guideTo(g.id)">
                  <span class="sp__row-ico" aria-hidden="true"><Icon :name="GUIDE_ICONS[i % GUIDE_ICONS.length]" :size="22" /></span>
                  <span class="sp__row-body">
                    <span class="sp__row-title">{{ g.title }}</span>
                    <span class="sp__row-summary">{{ g.summary }}</span>
                  </span>
                </router-link>
              </li>
            </ul>
          </template>

          <template v-else>
            <div class="sp__gtop">
              <router-link class="sp__gback" :to="ROUTES.SUPPORT"><Icon name="chevron-left" :size="16" />All guides</router-link>
              <span class="sp__muted">{{ guideIndex + 1 }} of {{ GUIDES.length }}</span>
            </div>

            <header class="sp__ghead">
              <span class="sp__row-ico sp__row-ico--lg" aria-hidden="true"><Icon :name="GUIDE_ICONS[guideIndex % GUIDE_ICONS.length]" :size="26" /></span>
              <div>
                <h2 id="sp-guides" ref="guideHeading" class="sp__guide-title" tabindex="-1">{{ guide.title }}</h2>
                <p class="sp__lead">{{ guide.summary }}</p>
              </div>
            </header>

            <p class="sp__short"><strong>In short</strong>{{ guide.facts[0] }}</p>

            <SegToggle v-model="gsec" :options="GUIDE_SECTIONS.filter((x) => x.show(guide)).map((x) => ({ value: x.id, label: x.label }))" label="Guide sections" class="sp__gtabs" />

            <Transition name="sp-swap" mode="out-in">
              <ul v-if="gsec === 'going'" key="going" class="sp__facts">
                <li v-for="f in guide.facts.slice(1)" :key="f">{{ f }}</li>
              </ul>

              <ol v-else-if="gsec === 'helps'" key="helps" class="sp__steps">
                <li v-for="(h, i) in guide.helps" :key="h.text">
                  <span class="sp__stepnum">{{ i + 1 }}</span>
                  <span class="sp__steptxt">
                    {{ h.text }}
                    <router-link v-if="h.link" class="sp__pill sp__pill--sm" :to="h.link.to"><Icon :name="LINK_ICON[h.link.to] ?? 'chevron'" :size="14" />{{ h.link.label }}</router-link>
                  </span>
                </li>
              </ol>

              <div v-else-if="gsec === 'say'" key="say" class="sp__say-wrap">
                <figure class="sp__say">
                  <figcaption><Icon name="chat" :size="16" /> You could say</figcaption>
                  <blockquote class="sp__script">{{ guide.script }}</blockquote>
                  <button type="button" class="sp__copy" @click="copyScript(guide.script)"><Icon :name="copied ? 'check' : 'copy'" :size="14" /> {{ copied ? "Copied" : "Copy" }}</button>
                </figure>
                <div v-if="guide.avoid" class="sp__avoidbox">
                  <h3 class="sp__h3">Try not to say</h3>
                  <ul class="sp__avoid">
                    <li v-for="a in guide.avoid" :key="a"><Icon name="x" :size="14" />{{ a }}</li>
                  </ul>
                </div>
              </div>

              <ul v-else key="help" class="sp__gethelp">
                <li v-for="g in guide.getHelp" :key="g.text" :class="{ 'is-urgent': g.urgent }">{{ g.text }}</li>
              </ul>
            </Transition>

            <footer class="sp__gfoot">
              <p class="sp__danger"><Icon name="lifebuoy" :size="18" /><span>In danger now? Call <a href="tel:995">995</a>. To talk to someone, call Samaritans <a href="tel:1767">1767</a>.</span></p>

              <p class="sp__sources">
                Sources:
                <template v-for="(s, i) in guide.sources" :key="s.url">
                  <a class="app-link" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.title }}, {{ s.publisher }}</a><span v-if="i < guide.sources.length - 1">; </span><span v-else>.</span>
                </template>
                General guidance only, not medical advice.
              </p>

              <div class="sp__gnav">
                <router-link v-if="prevGuide" class="sp__next" :to="guideTo(prevGuide.id)">
                  <span class="sp__muted"><Icon name="chevron-left" :size="13" /> Previous</span>
                  <span class="sp__next-title">{{ prevGuide.title }}</span>
                </router-link>
                <router-link v-if="nextGuide" class="sp__next sp__next--r" :to="guideTo(nextGuide.id)">
                  <span class="sp__muted">Next <Icon name="chevron" :size="13" /></span>
                  <span class="sp__next-title">{{ nextGuide.title }}</span>
                </router-link>
              </div>
            </footer>
          </template>
        </section>
    </div>

    <!-- Baby care -->
    <div v-else-if="tab === 'baby'" key="baby" id="support-panel-baby" class="sp__panel">
      <div v-if="isAdmin" class="sp__admin-bar">
        <AppButton v-if="!guideEditor.editing.value" variant="outline" size="sm" :disabled="guideEditor.atLimit()" @click="guideEditor.start(-1)">Add guide</AppButton>
        <p v-if="!guideEditor.editing.value && guideEditor.error.value" class="app-error-text" role="alert">{{ guideEditor.error.value }}</p>
      </div>
      <ul class="sp__acc">
        <SupportItemForm v-if="isAdmin && guideEditor.editing.value?.index === -1" kind="guides" :editor="guideEditor" />
        <template v-for="(g, i) in guides" :key="g.slug">
        <SupportItemForm v-if="isAdmin && guideEditor.editing.value?.index === i" kind="guides" :editor="guideEditor" />
        <li v-else class="sp__acc-item">
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
                <span class="sp__muted sp__acc-blurb">{{ g.blurb }}<template v-if="g.minutes"> About {{ g.minutes }} min read.</template></span>
              </span>
              <span class="sp__chev" :class="{ 'sp__chev--open': openBaby.has(g.slug) }"><Icon name="chevron-down" :size="20" /></span>
            </button>
          </h2>
          <Collapse>
            <div v-if="openBaby.has(g.slug)" :id="`guide-panel-${g.slug}`" class="sp__acc-panel" role="region" :aria-labelledby="`guide-btn-${g.slug}`">
              <p class="sp__text">{{ g.intro }}</p>
              <ol class="sp__acc-steps">
                <li v-for="s in g.steps" :key="s.title"><strong>{{ s.title }}.</strong> {{ s.body }}</li>
              </ol>
              <template v-if="g.callIf?.length">
                <p class="sp__text sp__strong">Call your doctor if:</p>
                <ul class="sp__bullets">
                  <li v-for="c in g.callIf" :key="c">{{ c }}</li>
                </ul>
              </template>
            </div>
          </Collapse>
          <SupportItemActions v-if="isAdmin" class="sp__item-actions" :editor="guideEditor" :index="i" :name="g.title" />
        </li>
        </template>
      </ul>
      <p class="sp__muted">General guidance only, not medical advice.</p>
    </div>

    <div v-else-if="tab === 'rooms'" key="rooms" id="support-panel-rooms" class="sp__card">
      <PumpingRooms embedded />
    </div>

    <!-- Who to call -->
    <div v-else key="resources" id="support-panel-resources" class="sp__card">
      <p class="sp__muted">Check numbers and hours before you rely on them.</p>
      <div class="sp__group-row">
        <h2 class="sp__group">For you</h2>
        <AppButton v-if="isAdmin && !contactEditor.editing.value" variant="outline" size="sm" :disabled="contactEditor.atLimit()" @click="contactEditor.start(-1)">Add contact</AppButton>
      </div>
      <p v-if="isAdmin && !contactEditor.editing.value && contactEditor.error.value" class="app-error-text" role="alert">{{ contactEditor.error.value }}</p>
      <ul class="sp__res">
        <SupportItemForm v-if="isAdmin && contactEditor.editing.value?.index === -1" kind="contacts" :editor="contactEditor" />
        <template v-for="(r, i) in shownContacts" :key="r.id">
        <SupportItemForm v-if="isAdmin && contactEditor.editing.value?.index === i" kind="contacts" :editor="contactEditor" />
        <li v-else class="sp__res-item">
          <h3 class="sp__res-name">{{ r.name }}</h3>
          <p class="sp__text">{{ r.purpose }}</p>
          <template v-if="r.id === 'doctor' && !r.tel">
            <form v-if="doctorEditing" class="sp__docform" @submit.prevent="saveDoctor">
              <label class="sp__doclabel" for="doctor-number">Clinic or doctor's number</label>
              <input id="doctor-number" v-model="doctorDraft" class="sp__docinput" type="tel" inputmode="numeric" autocomplete="tel" maxlength="9" placeholder="e.g. 6123 4567" @input="doctorDraft = formatDoctor(doctorDraft)" />
              <div class="sp__docbtns">
                <button type="submit" class="sp__docbtn sp__docbtn--main" :disabled="!doctorValid">Save</button>
                <button type="button" class="sp__docbtn" @click="doctorEditing = false">Cancel</button>
                <button v-if="doctorNumber" type="button" class="sp__docbtn sp__docbtn--danger" @click="removeDoctor">Remove</button>
              </div>
              <p class="sp__muted">8 digits. Saved on this device only.</p>
            </form>
            <template v-else-if="doctorNumber">
              <div class="sp__docrow">
                <a class="app-link" :href="doctorHref">Call {{ doctorNumber }}</a>
                <button type="button" class="sp__docbtn" @click="startDoctor"><Icon name="edit" :size="14" /> Edit</button>
              </div>
            </template>
            <button v-else type="button" class="sp__docbtn sp__docbtn--main" @click="startDoctor"><Icon name="plus" :size="14" /> Add number</button>
          </template>
          <a v-else-if="r.tel" class="app-link" :href="r.tel">Call {{ r.telLabel }}</a>
          <SupportItemActions v-if="isAdmin" class="sp__item-actions" :editor="contactEditor" :index="i" :name="r.name" />
        </li>
        </template>
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
    </Transition>
  </div>
</template>

<style scoped>
.sp { display: flex; flex-direction: column; gap: 20px; max-width: 1040px; margin: 0 auto; font-size: 1rem; color: var(--ink, #1f2a52); }
.sp__muted { margin: 0; font-size: 0.9063rem; line-height: 1.5; color: var(--mut, #5b6692); }
.sp__text { margin: 0; font-size: 0.9375rem; line-height: 1.55; color: var(--ink, #1f2a52); }
.sp__strong { font-weight: 600; }
.sp__tabs { align-self: flex-start; max-width: 100%; }
.sp__tabs :deep(.sg__btn) { padding: 10px 20px; white-space: nowrap; }

.sp__panel { display: flex; flex-direction: column; gap: 20px; }
.sp__card { display: flex; flex-direction: column; gap: 14px; padding: 22px 24px 26px; background: var(--cream, #fdf9f0); border: 1px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 24px; scroll-margin-top: 80px; }
.sp__h2 { margin: 0; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; line-height: 1.25; }
.sp__tool:focus-visible, .sp__row:focus-visible, .sp__acc-btn:focus-visible, .sp__next:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }

/* Right now */
.sp__tools { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.sp__tool { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; width: 100%; height: 100%; min-height: 132px; padding: 14px; background: #f6e3d0; border: 0; border-bottom: 4px solid rgb(31 42 82 / 18%); border-radius: 20px; font-family: inherit; text-align: left; color: var(--ink, #1f2a52); cursor: pointer; transition: transform 0.15s ease, background-color 0.2s ease, color 0.2s ease; }
.sp__tool:hover { transform: translateY(-2px); }
.sp__tool-ico { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: #a8532f; color: #fff; }
.sp__tool-label { font-family: var(--nt-serif); font-size: 1.0625rem; font-weight: 700; line-height: 1.25; }
.sp__tool[aria-expanded="true"] { background: var(--navy, #243560); color: #fff; }
.sp__tool[aria-expanded="true"] .sp__tool-ico { background: #f2a477; color: #1f2a52; }
.sp__tool-panel { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 16px 20px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 16px; }
.sp__tool-steps { display: flex; flex-direction: column; gap: 8px; margin: 0; padding-left: 20px; font-size: 0.9688rem; line-height: 1.55; }

/* The check */
.sp__about { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.sp__label { font-size: 0.9375rem; font-weight: 600; }
.sp__about-toggle { min-width: 220px; }
.sp__progwrap { display: flex; align-items: center; gap: 12px; }
.sp__prog { flex: 1; height: 8px; background: #e2d2ae; border-radius: 999px; overflow: hidden; }
.sp__prog i { display: block; height: 100%; background: var(--navy, #243560); border-radius: 999px; transition: width 0.3s ease; }
.sp__progtxt { font-size: 0.8125rem; font-weight: 600; color: var(--mut, #6b7392); white-space: nowrap; }
.sp__questions { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.sp__question { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; padding: 12px 14px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 16px; }
.sp__q-text { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 0.9688rem; line-height: 1.4; }
.sp__q-num { display: inline-grid; place-items: center; flex: none; width: 26px; height: 26px; border-radius: 50%; background: var(--sand, #e9d9b8); font-size: 0.8125rem; font-weight: 700; }
.sp__yn { display: flex; flex: none; gap: 8px; }
.sp__ans { min-width: 76px; padding: 9px 18px; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; background: #fff; color: var(--navy, #243560); font: inherit; font-size: 0.9375rem; font-weight: 600; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s; }
.sp__ans:hover { border-color: var(--navy, #243560); }
.sp__ans:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.sp__ans--yes.on { background: #fbe3d3; border-color: #c4642f; color: #8a3f14; }
.sp__ans--no.on { background: #d9ebdf; border-color: #2f5d43; color: #245038; }
.sp__question.is-done { border-color: #d8c79f; }
.sp__question.is-done .sp__q-num { background: var(--navy, #243560); color: #fff; }
.sp__hint { font-size: 0.875rem; }
.sp__result { --acc: #f2a477; --tint: #fcdcc6; --edge: #f2a477; display: flex; flex-direction: column; gap: 14px; padding: 20px 22px 22px; background: var(--tint); border: 1.5px solid var(--edge); border-bottom-width: 4px; border-radius: 22px; color: var(--navy, #243560); font-size: 0.9688rem; line-height: 1.55; }
.sp__result--doctor { --acc: #e9c46a; --tint: #fbeec4; --edge: #e9c46a; }
.sp__result--ordinary { --acc: #9fcdb0; --tint: #dcefe2; --edge: #9fcdb0; }
.sp__result p { margin: 0; color: var(--navy, #243560); }
.sp__result-head { display: flex; align-items: center; gap: 12px; }
.sp__result-ico { display: inline-grid; place-items: center; flex: none; width: 42px; height: 42px; border-radius: 50%; background: var(--acc); color: var(--navy, #243560); }
.sp__result-title { margin: 0; font-family: var(--nt-serif); font-size: 1.35rem; font-weight: 700; line-height: 1.25; color: var(--navy, #243560); }
.sp__result-calls { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.sp__call { display: flex; align-items: center; gap: 12px; padding: 10px 16px 10px 10px; background: var(--cream, #fdf9f0); border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; box-shadow: 0 3px 0 rgb(0 0 0 / 12%); color: var(--navy, #243560); text-decoration: none; transition: transform 0.12s; }
.sp__call:hover { transform: translateY(-1px); }
.sp__call:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.sp__call-ico { display: inline-grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 50%; background: var(--sand, #e9d9b8); }
.sp__call strong { min-width: 96px; font-size: 1.125rem; }
.sp__call-txt { font-size: 0.9rem; color: #4a5683; }
.sp__call--urgent { background: var(--navy, #243560); border-color: var(--navy, #243560); color: #fff; }
.sp__call--urgent .sp__call-ico { background: #f2a477; color: var(--navy, #243560); }
.sp__call--urgent .sp__call-txt { color: #dfe5f5; }
.sp__result .sp__result-note { font-weight: 600; }
.sp__say { position: relative; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.sp__say figcaption { display: flex; align-items: center; gap: 6px; font-size: 0.875rem; font-weight: 700; color: var(--navy, #243560); }
.sp__say .sp__script { padding-right: 96px; background: var(--cream, #fdf9f0); border-color: var(--sand, #e9d9b8); border-left-color: var(--navy, #243560); color: var(--navy, #243560); }
.sp__copy { position: absolute; right: 10px; bottom: 10px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; background: #fff; color: var(--navy, #243560); font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
.sp__copy:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.sp__result-links { display: flex; flex-wrap: wrap; gap: 8px; }
.sp__pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px 8px 12px; background: var(--cream, #fdf9f0); border-radius: 999px; border: 1.5px solid var(--sand, #e9d9b8); box-shadow: 0 3px 0 rgb(0 0 0 / 12%); color: var(--navy, #243560); font-size: 0.9rem; font-weight: 600; text-decoration: none; }
.sp__pill:hover { background: #fff; }
.sp__pill:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.sp__reset { align-self: flex-start; }

/* Guide list */
.sp__list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.sp__row { display: flex; align-items: center; gap: 12px; height: 100%; padding: 14px 16px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 18px; color: var(--ink, #1f2a52); text-decoration: none; transition: border-color 0.15s ease, transform 0.15s ease; }
.sp__row:hover { border-color: var(--navy, #243560); transform: translateY(-1px); }
.sp__row-ico { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 44px; height: 44px; border-radius: 14px; background: #cfe3d4; color: #2f5d43; }
.sp__row-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sp__row-title { font-family: var(--nt-serif); font-size: 1.0625rem; font-weight: 700; line-height: 1.25; }
.sp__row-summary { font-size: 0.875rem; line-height: 1.4; color: var(--mut, #5b6692); }

/* One guide */
.sp__gtop { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sp__gback { display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px 6px 8px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; color: var(--navy, #243560); font-size: 0.9rem; font-weight: 600; text-decoration: none; }
.sp__gback:hover { border-color: var(--navy, #243560); }
.sp__gback:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.sp__ghead { display: flex; align-items: center; gap: 16px; }
.sp__row-ico--lg { width: 56px; height: 56px; border-radius: 18px; }
.sp__guide-title { margin: 0; font-family: var(--nt-serif); font-size: 1.875rem; font-weight: 700; line-height: 1.2; }
.sp__guide-title:focus { outline: none; }
.sp__lead { margin: 4px 0 0; font-size: 1rem; line-height: 1.5; color: var(--mut, #5b6692); }
.sp__short { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 12px 18px; background: #fdf0e3; border: 1.5px solid #f2c9a6; border-left: 5px solid #f2a477; border-radius: 16px; font-size: 1rem; line-height: 1.55; }
.sp__short strong { font-size: 0.8125rem; color: #a4541f; }
.sp__gtabs { align-self: flex-start; max-width: 100%; overflow-x: auto; }
.sp__gtabs :deep(.sg__btn) { padding: 9px 16px; white-space: nowrap; font-size: 0.9rem; }
.sp__h3 { margin: 0; font-family: var(--nt-serif); font-size: 1.1875rem; font-weight: 700; }
.sp__facts, .sp__steps, .sp__gethelp { margin: 0; padding: 0; list-style: none; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 18px; overflow: hidden; }
.sp__facts li, .sp__steps li, .sp__gethelp li { padding: 14px 18px; font-size: 0.9688rem; line-height: 1.55; }
.sp__facts li + li, .sp__steps li + li, .sp__gethelp li + li { border-top: 1.5px dashed var(--sand, #e9d9b8); }
.sp__facts li { position: relative; padding-left: 42px; }
.sp__facts li::before { content: ""; position: absolute; left: 18px; top: 21px; width: 9px; height: 9px; border-radius: 50%; background: #f2a477; }
.sp__steps li { display: flex; align-items: flex-start; gap: 14px; }
.sp__stepnum { display: inline-grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--navy, #243560); color: #fff; font-size: 0.875rem; font-weight: 700; }
.sp__steptxt { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding-top: 2px; }
.sp__pill--sm { padding: 5px 12px 5px 9px; font-size: 0.8125rem; box-shadow: none; }
.sp__say-wrap { display: flex; flex-direction: column; gap: 14px; }
.sp__script { margin: 0; padding: 14px 18px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-left: 4px solid var(--navy, #243560); border-radius: 14px; font-size: 0.9688rem; line-height: 1.6; }
.sp__avoidbox { display: flex; flex-direction: column; gap: 8px; }
.sp__avoid { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 0.9375rem; line-height: 1.5; color: var(--mut, #5b6692); }
.sp__avoid li { display: flex; align-items: flex-start; gap: 8px; }
.sp__avoid li svg { flex: none; margin-top: 4px; color: #c4642f; }
.sp__gethelp li.is-urgent { background: #fdeee6; color: #7a2e12; font-weight: 600; }
.sp__gfoot { display: flex; flex-direction: column; gap: 14px; padding-top: 18px; border-top: 1.5px dashed var(--sand, #e9d9b8); }
.sp__danger { display: flex; align-items: center; gap: 10px; margin: 0; padding: 10px 16px; background: #fdeee6; border-radius: 14px; font-size: 0.9rem; color: #7a2e12; }
.sp__danger svg { flex: none; }
.sp__danger a { color: inherit; font-weight: 700; }
.sp__sources { margin: 0; font-size: 0.8125rem; line-height: 1.6; color: var(--mut, #5b6692); }
.sp__gnav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.sp__next { display: flex; flex-direction: column; gap: 2px; padding: 10px 16px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 18px; color: var(--ink, #1f2a52); text-decoration: none; }
.sp__next--r { text-align: right; grid-column: 2; }
.sp__next:hover { border-color: var(--navy, #243560); }
.sp__muted svg { vertical-align: -2px; }
.sp__next-title { font-family: var(--nt-serif); font-size: 1rem; font-weight: 700; line-height: 1.25; }

/* Baby care accordion */
.sp__acc { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; margin: 0; padding: 0; list-style: none; }
.sp__acc-item { background: var(--cream, #fdf9f0); border: 1px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 22px; }
.sp__acc-h { margin: 0; font-size: 1rem; }
.sp__acc-btn { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 18px 22px; background: none; border: 0; border-radius: 22px; font-family: inherit; text-align: left; color: var(--ink, #1f2a52); cursor: pointer; }
.sp__acc-title { display: block; font-family: var(--nt-serif); font-size: 1.1875rem; font-weight: 700; line-height: 1.25; }
.sp__acc-blurb { display: block; margin-top: 3px; font-weight: 400; }
.sp__chev { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--sand, #e9d9b8); color: var(--navy, #243560); transition: transform 0.25s ease; }
.sp__chev--open { transform: rotate(180deg); }
.sp__acc-panel { display: flex; flex-direction: column; gap: 12px; margin: 0 22px; padding: 14px 0 20px; border-top: 1.5px dashed var(--sand, #e9d9b8); }
.sp__acc-steps, .sp__bullets { margin: 0; padding-left: 20px; font-size: 0.9063rem; line-height: 1.55; }
.sp__acc-steps li { margin-bottom: 8px; }

/* Who to call */
.sp__group { margin: 6px 0 -4px; font-family: var(--nt-serif); font-size: 1.25rem; font-weight: 700; color: var(--ink, #1f2a52); }
.sp__res { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.sp__res-item { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 16px 18px; background: #fffdf8; border: 1.5px solid var(--sand, #e9d9b8); border-bottom-width: 4px; border-radius: 20px; }
.sp__res-item > .app-link, .sp__res-item > .sp__docrow, .sp__res-item > .sp__docbtn, .sp__res-item > .sp__docform { margin-top: auto; }
.sp__res-item .sp__text { margin-bottom: 8px; }
.sp__docform { display: flex; flex-direction: column; gap: 8px; align-self: stretch; }
.sp__doclabel { font-size: 0.875rem; font-weight: 600; }
.sp__docinput { padding: 10px 14px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 12px; font: inherit; color: var(--ink, #1f2a52); }
.sp__docinput:focus { outline: 3px solid var(--navy, #243560); outline-offset: 1px; border-color: var(--navy, #243560); }
.sp__docbtns, .sp__docrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.sp__docbtn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #fff; border: 1.5px solid var(--sand, #e9d9b8); border-radius: 999px; color: var(--navy, #243560); font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
.sp__docbtn:hover:not(:disabled) { border-color: var(--navy, #243560); }
.sp__docbtn:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }
.sp__docbtn:disabled { opacity: 0.5; cursor: not-allowed; }
.sp__docbtn--main { background: var(--navy, #243560); border-color: var(--navy, #243560); color: #fff; }
.sp__docbtn--danger { color: #a4541f; }
.sp__res-name { margin: 0; font-family: var(--nt-serif); font-size: 1.1875rem; font-weight: 700; }
.sp__res-item .app-link { padding: 9px 18px; background: var(--navy, #243560); border-bottom: 3px solid #182246; border-radius: 12px; font-size: 0.9063rem; font-weight: 600; color: #fff; text-decoration: none; }
.sp__res-item .app-link:hover { background: #1b2a4f; color: #fff; }
.sp__res-item .app-link:focus-visible { outline: 3px solid var(--navy, #243560); outline-offset: 2px; }

@media (max-width: 991px) {
  .sp__acc { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 767.98px) {
  .sp__tabs {
    align-self: stretch;
    min-width: 0;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  }
  .sp__tabs :deep(.sg__btn) {
    min-width: 0;
    min-height: 48px;
    padding: 8px 6px;
    font-size: 0.875rem;
    line-height: 1.25;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
@media (max-width: 640px) {
  .sp__question { flex-direction: column; align-items: stretch; }
  .sp__yn { width: 100%; }
  .sp__ans { flex: 1; }
  .sp__card { padding: 18px 16px 22px; }
  .sp__guide-title { font-size: 1.5rem; }
  .sp__gnav { grid-template-columns: minmax(0, 1fr); }
  .sp__next--r { grid-column: auto; }
  .sp__list, .sp__res { grid-template-columns: minmax(0, 1fr); }
}
.sp__admin-bar { display: flex; align-items: center; gap: 12px; }
.sp__group-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; }
.sp__group-row .sp__group { margin: 0; }
.sp__acc-item .sp__item-actions { padding: 0 22px 16px; }
.sp__res-item .sp__item-actions { padding-top: 4px; }
.sp-swap-enter-active, .sp-swap-leave-active { transition: opacity 160ms ease; }
.sp-swap-enter-from, .sp-swap-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .sp-swap-enter-active, .sp-swap-leave-active, .sp__chev, .sp__tool, .sp__row { transition: none; } }
</style>
