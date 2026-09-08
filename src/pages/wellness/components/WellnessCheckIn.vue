<script setup>
import MoodSelector from "@/pages/wellness/components/MoodSelector.vue";
import ConcernSelector from "@/pages/wellness/components/ConcernSelector.vue";
import JournalForm from "@/pages/wellness/components/JournalForm.vue";
import JournalHistory from "@/pages/wellness/components/JournalHistory.vue";
</script>

<template>
  <section class="app-card">
    <MoodSelector /><ConcernSelector /><JournalForm /><JournalHistory />
  </section>
</template>
