<script setup>
import InsightCard from "@/pages/insights/components/InsightCard.vue";
import FeedingChart from "@/pages/insights/components/FeedingChart.vue";
import NextFeedPrediction from "@/pages/insights/components/NextFeedPrediction.vue";
</script>

<template>
  <div class="page-grid">
    <InsightCard><h2>Pattern summary</h2></InsightCard
    ><FeedingChart /><NextFeedPrediction />
  </div>
</template>
