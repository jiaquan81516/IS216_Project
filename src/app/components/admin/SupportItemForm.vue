<script setup>
import AppButton from "@/components/ui/AppButton.vue";
import Field from "@/app/components/Field.vue";
import "@/app/app.css";

// The form an administrator fills in to add or edit one guide or contact on the Support page.
const props = defineProps({
  kind: { type: String, required: true },
  editor: { type: Object, required: true },
});

const isGuides = props.kind === "guides";
const draft = () => props.editor.editing.value.draft;
const id = (name) => `sf-${props.kind}-${name}`;
const addStep = () => draft().steps.push({ title: "", body: "" });
const removeStep = (i) => draft().steps.splice(i, 1);
</script>

<template>
  <form class="sf" @submit.prevent="editor.save()">
    <h3 class="sf__title">{{ editor.editing.value.index < 0 ? (isGuides ? "New guide" : "New contact") : (isGuides ? "Edit guide" : "Edit contact") }}</h3>
    <template v-if="isGuides">
      <Field :id="id('title')" v-model="draft().title" label="Title" />
      <Field :id="id('blurb')" v-model="draft().blurb" label="Short description" />
      <div class="app-field">
        <label class="app-field__label" :for="id('intro')">Introduction</label>
        <textarea :id="id('intro')" v-model="draft().intro" class="form-control" rows="2" maxlength="400"></textarea>
      </div>
      <fieldset class="sf__steps">
        <legend class="app-field__label">Steps</legend>
        <div v-for="(step, i) in draft().steps" :key="i" class="sf__step">
          <Field :id="id(`step-${i}-title`)" v-model="step.title" :label="`Step ${i + 1} title`" />
          <div class="app-field">
            <label class="app-field__label" :for="id(`step-${i}-body`)">Step {{ i + 1 }} details</label>
            <textarea :id="id(`step-${i}-body`)" v-model="step.body" class="form-control" rows="2" maxlength="500"></textarea>
          </div>
          <AppButton variant="outline" size="sm" @click="removeStep(i)">Remove step {{ i + 1 }}</AppButton>
        </div>
        <AppButton variant="outline" size="sm" @click="addStep">Add step</AppButton>
      </fieldset>
      <div class="app-field">
        <label class="app-field__label" :for="id('callif')">Call your doctor if (one per line)</label>
        <textarea :id="id('callif')" v-model="draft().callIfText" class="form-control" rows="4"></textarea>
      </div>
    </template>
    <template v-else>
      <Field :id="id('name')" v-model="draft().name" label="Name" />
      <div class="app-field">
        <label class="app-field__label" :for="id('purpose')">What it is for</label>
        <textarea :id="id('purpose')" v-model="draft().purpose" class="form-control" rows="2" maxlength="200"></textarea>
      </div>
      <Field :id="id('number')" v-model="draft().telLabel" label="Phone number (optional)" type="tel" hint="Shown as a call link on phones." />
    </template>
    <p v-if="editor.error.value" class="app-error-text" role="alert">{{ editor.error.value }}</p>
    <div class="sf__actions">
      <AppButton variant="outline" size="sm" :disabled="editor.busy.value" @click="editor.cancel()">Cancel</AppButton>
      <AppButton type="submit" size="sm" :disabled="editor.busy.value">{{ editor.busy.value ? "Saving..." : "Save" }}</AppButton>
    </div>
  </form>
</template>

<style scoped>
/* The same cream card as the rest of the page, with the app's inputs and pill buttons. */
.sf { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 14px; padding: 22px 26px 24px; background: #fdf9f0; border: 1px solid #e9d9b8; border-bottom-width: 4px; border-radius: 24px; color: #1f2a52; }
.sf__title { margin: 0; padding-bottom: 12px; border-bottom: 1px solid #e9d9b8; font-family: var(--nt-serif); font-size: 1.5rem; font-weight: 700; color: #1f2a52; }
.sf :deep(label), .sf :deep(.app-field__label) { font-size: 0.9375rem; font-weight: 600; color: #1f2a52; }
.sf :deep(input), .sf :deep(textarea), .sf :deep(.form-control) { background: #fff; border: 1.5px solid #e9d9b8; border-radius: 14px; color: #1f2a52; font-size: 1rem; box-shadow: none; transition: border-color 0.18s ease, box-shadow 0.18s ease; }
.sf :deep(input:focus), .sf :deep(textarea:focus), .sf :deep(.form-control:focus) { outline: 0; border-color: #243560; box-shadow: 0 0 0 3px rgb(242 164 119 / 45%); }
.sf :deep(textarea) { resize: vertical; }
.sf :deep(.app-field__hint), .sf :deep(small) { color: #6b7392; font-size: 0.875rem; }
.sf__steps { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; margin: 0; padding: 0; border: 0; }
.sf__step { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; width: 100%; padding: 14px 18px 16px; background: #fffdf8; border: 1px solid #e9d9b8; border-radius: 18px; }
.sf__step .app-field { width: 100%; }
.sf__actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
.sf :deep(.btn) { min-height: 40px; padding: 7px 24px; border-radius: 999px; font-size: 0.9375rem; font-weight: 700; transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease; }
.sf :deep(.btn-primary) { background: #243560; border: 0; border-bottom: 3px solid #182246; color: #fff; }
.sf :deep(.btn-primary:hover:not(:disabled)) { background: #2c4175; transform: translateY(-1px); }
.sf :deep(.btn-outline) { background: #fff; border: 1.5px solid #e9d9b8; border-bottom-width: 3px; color: #243560; }
.sf :deep(.btn-outline:hover:not(:disabled)) { background: #fff; border-color: #243560; color: #243560; transform: translateY(-1px); }
.sf :deep(.btn:active:not(:disabled)) { transform: none; }
.sf :deep(.btn:focus-visible) { outline: 3px solid #f2a477; outline-offset: 2px; }
@media (max-width: 575px) { .sf { padding: 18px 16px 20px; } .sf__actions { justify-content: stretch; } .sf__actions :deep(.btn) { flex: 1; } }
@media (prefers-reduced-motion: reduce) { .sf :deep(input), .sf :deep(textarea), .sf :deep(.btn) { transition: none; } }
</style>
