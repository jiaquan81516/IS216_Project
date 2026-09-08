<script setup>
import ResourceFilter from "@/pages/resources/components/ResourceFilter.vue";
</script>

<template>
  <form class="app-card" role="search" @submit.prevent>
    <label>Search resources <input type="search" /></label><ResourceFilter />
  </form>
</template>
