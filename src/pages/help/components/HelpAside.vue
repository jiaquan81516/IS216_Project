<script setup>
import AppCard from "@/components/ui/AppCard.vue";
import AppButton from "@/components/ui/AppButton.vue";
import YoursAlone from "@/components/ui/YoursAlone.vue";
import { ROUTES } from "@/shared/constants/routes";
</script>

<template>
  <aside class="nt-col" aria-label="Get help">
    <AppCard variant="danger" title="Get help now">
      <p class="mb-0 help-aside__text">
        If you or your partner feel unsafe, or are thinking about self-harm, call your local emergency number straight away.
      </p>
      <hr class="nt-rule" />
      <div class="help-aside__item">
        <p class="help-aside__name">Your doctor or clinic</p>
        <p class="help-aside__detail">For mood, sleep or feeding concerns that last more than two weeks.</p>
      </div>
      <hr class="nt-rule" />
      <div class="help-aside__item">
        <p class="help-aside__name">Samaritans of Singapore</p>
        <p class="help-aside__detail">24-hour helpline, <a href="tel:1767" class="help-aside__tel">1767</a>.</p>
      </div>
      <hr class="nt-rule" />
      <div class="help-aside__item">
        <p class="help-aside__name">IMH Mental Health Helpline</p>
        <p class="help-aside__detail"><a href="tel:+6563892222" class="help-aside__tel">6389 2222</a>.</p>
      </div>
    </AppCard>
    <YoursAlone>
      <p class="mb-0 help-aside__text">Not sure how you are doing? A one-minute check-in is private to you.</p>
      <div>
        <AppButton variant="outline" size="lg" :to="ROUTES.CHECK_IN">Start your check-in</AppButton>
      </div>
    </YoursAlone>
    <p class="nt-muted nt-small mb-0">General guidance only, not medical advice.</p>
  </aside>
</template>

<style scoped>
.help-aside__text {
  font-size: 0.9375rem;
  line-height: 1.45;
  color: var(--nt-ink);
}
.help-aside__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.help-aside__name {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
}
.help-aside__detail {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
}
.help-aside__tel {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
