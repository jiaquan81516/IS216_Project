<script setup>
import { ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppCard from "@/components/ui/AppCard.vue";
import { DUE_OPTIONS, REMINDER_OPTIONS, ownerOptions } from "@/data/returnToWork";

const props = defineProps({
  task: { type: Object, required: true },
  viewer: { type: String, required: true }, // "you" | "mei"
});
const emit = defineEmits(["save"]);

const draft = ref({});
const saved = ref(false);

watch(
  () => props.task,
  (task) => {
    draft.value = { due: task.due, owner: task.owner, reminder: task.reminder, notes: task.notes };
    saved.value = false;
  },
  { immediate: true },
);

function save() {
  emit("save", props.task.id, { ...draft.value });
  saved.value = true;
}

const otherOwner = () => (props.viewer === "you" ? "mei" : "daniel");
const otherName = () => ownerOptions(props.viewer).find((o) => o.value === otherOwner()).label;

function reassign() {
  draft.value.owner = otherOwner();
  emit("save", props.task.id, { ...draft.value });
  saved.value = true;
}
</script>

<template>
  <AppCard :title="task.title" aria-live="polite">
    <div>
      <label class="form-label" for="task-due">Due</label>
      <select id="task-due" v-model="draft.due" class="form-select" @change="saved = false">
        <option v-for="o in DUE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div>
      <label class="form-label" for="task-owner">Assigned to</label>
      <select id="task-owner" v-model="draft.owner" class="form-select" @change="saved = false">
        <option v-for="o in ownerOptions(viewer)" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div>
      <label class="form-label" for="task-reminder">Reminder</label>
      <select id="task-reminder" v-model="draft.reminder" class="form-select" @change="saved = false">
        <option v-for="o in REMINDER_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <div>
      <label class="form-label" for="task-notes">Notes</label>
      <textarea
        id="task-notes"
        v-model="draft.notes"
        class="form-control"
        rows="3"
        placeholder="Add a note (optional)"
        @input="saved = false"
      />
    </div>
    <div class="d-flex flex-wrap gap-3">
      <AppButton @click="save">Save task</AppButton>
      <AppButton variant="outline" @click="reassign">Reassign to {{ otherName() }}</AppButton>
    </div>
    <p v-if="saved" class="nt-small nt-muted mb-0" role="status">Saved.</p>
  </AppCard>
</template>
