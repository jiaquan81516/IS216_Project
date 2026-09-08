<script setup>
defineProps({ id: { type: String, required: true } });
</script>

<template>
  <div class="page">
    <h1>Resource details</h1>
    <p>Resource {{ id }}</p>
  </div>
</template>
