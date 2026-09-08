<script setup>
defineOptions({ name: "ResourcesPage" });

import ResourceSearch from "@/pages/resources/components/ResourceSearch.vue";
import RecommendedResources from "@/pages/resources/components/RecommendedResources.vue";
</script>

<template>
  <div class="page">
    <h1>Resources</h1>
    <ResourceSearch /><RecommendedResources />
  </div>
</template>
