<script setup>
defineOptions({ name: "DashboardPage" });

import LastFeedingCard from "@/pages/dashboard/components/LastFeedingCard.vue";
import NextFeedCard from "@/pages/dashboard/components/NextFeedCard.vue";
import FeedingTimeline from "@/pages/dashboard/components/FeedingTimeline.vue";
import WellnessCheckInCard from "@/pages/dashboard/components/WellnessCheckInCard.vue";
import SharedCareCard from "@/pages/dashboard/components/SharedCareCard.vue";
</script>

<template>
  <div class="page">
    <h2>testing</h2>
    <p>
      Visit
      <a href="https://vuejs.org/" target="_blank" rel="noopener">vuejs.org</a>
      to read the documentation
    </p>
    <div class="page-grid">
      <LastFeedingCard />
      <NextFeedCard />
      <FeedingTimeline />
      <WellnessCheckInCard />
      <SharedCareCard />
    </div>
  </div>
</template>
