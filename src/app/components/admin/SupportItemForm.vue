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
.sf { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 12px; padding: 20px 24px; background: #fff; border: 1px solid var(--nt-line); border-radius: 12px; }
.sf__title { margin: 0; font-size: 1rem; font-weight: 600; }
.sf__steps { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; margin: 0; padding: 0; border: 0; }
.sf__step { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; width: 100%; padding: 12px 16px; border: 1px solid var(--nt-line); border-radius: 8px; }
.sf__step .app-field { width: 100%; }
.sf__actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
