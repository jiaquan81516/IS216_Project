<script setup>
defineProps({ modelValue: { type: Boolean, default: false }, label: { type: String, default: "" } });
defineEmits(["update:modelValue"]);
</script>

<template>
  <button
    type="button"
    role="switch"
    class="toggle"
    :class="{ 'toggle--on': modelValue }"
    :aria-checked="modelValue"
    :aria-label="label"
    @click="$emit('update:modelValue', !modelValue)"
  ><span class="toggle__knob" /></button>
</template>

<style scoped>
.toggle {
  position: relative;
  flex: none;
  width: 44px;
  height: 24px;
  padding: 0;
  background: #d1d5db;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.toggle--on { background: var(--nt-plum); }
.toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.15s;
}
.toggle--on .toggle__knob { transform: translateX(20px); }
</style>
