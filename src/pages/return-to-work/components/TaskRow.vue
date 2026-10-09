<script setup>
// One task: a checkbox that toggles done, and a separate button (title area) that selects the task.
defineProps({
  task: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  detail: { type: String, default: "" },
});
const emit = defineEmits(["toggle", "select"]);
</script>

<template>
  <div class="task" :class="{ 'task--on': task.done || selected, 'task--selected': selected }">
    <input
      class="form-check-input task__check"
      type="checkbox"
      :checked="task.done"
      :aria-label="`Mark done: ${task.title}`"
      @change="emit('toggle', task.id)"
    />
    <button type="button" class="task__main" :aria-pressed="selected" @click="emit('select', task.id)">
      <span class="task__title">{{ task.title }}</span>
      <span class="task__desc">{{ detail }}</span>
    </button>
  </div>
</template>

<style scoped>
.task {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 16px;
  background: var(--nt-white);
  border: 1px solid var(--nt-line);
  border-radius: 8px;
}
.task--on {
  border: 2px solid var(--nt-plum);
  padding: 0 15px;
}
.task__check {
  flex: none;
  margin: 0;
  cursor: pointer;
}
.task__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 14px 0;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
.task__title {
  font-weight: 500;
  font-size: 1rem;
  color: var(--nt-ink);
}
.task__desc {
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.task__main:focus-visible {
  outline-offset: 0;
  border-radius: 4px;
}
</style>
