<script setup>
import AppBadge from "@/components/ui/AppBadge.vue";

// Schematic map: dots are positioned by their centre inside a 352 x 360 box.
defineProps({
  rooms: { type: Array, required: true },
  activeId: { type: String, default: "" },
  office: { type: Object, required: true },
});
const emit = defineEmits(["select", "hover"]);

const WIDTH = 352;
const dotStyle = (room, active) => {
  const size = active ? 22 : 16;
  return {
    left: `calc(${(room.map.x / WIDTH) * 100}% - ${size / 2}px)`,
    top: `${room.map.y - size / 2}px`,
  };
};
</script>

<template>
  <section class="nt-card" aria-label="Map">
    <h2 class="nt-heading nt-heading--sm">Map</h2>
    <p class="nt-small nt-muted mb-0">Schematic map, not to scale</p>
    <div class="map">
      <button
        v-for="r in rooms"
        :key="r.id"
        type="button"
        class="map__dot"
        :class="{
          'map__dot--on': r.id === activeId,
          'map__dot--check': r.status !== 'verified' && r.id !== activeId,
        }"
        :style="dotStyle(r, r.id === activeId)"
        :aria-label="r.name"
        :aria-pressed="r.id === activeId"
        @click="emit('select', r.id)"
        @mouseenter="emit('hover', r.id)"
        @mouseleave="emit('hover', '')"
        @focus="emit('hover', r.id)"
        @blur="emit('hover', '')"
      />
      <span
        class="map__office"
        role="img"
        :aria-label="`Mei's office, ${office.value}`"
        :style="{ left: `calc(${(office.x / WIDTH) * 100}% - 9px)`, top: `${office.y - 9}px` }"
      />
    </div>
    <ul class="legend">
      <li><span class="legend__dot legend__dot--room" />Room</li>
      <li><span class="legend__dot legend__dot--on" />Selected</li>
      <li><span class="legend__dot legend__dot--office" />Mei's office</li>
    </ul>
    <div class="d-flex flex-wrap gap-2">
      <AppBadge color="green">Verified in the last 30 days</AppBadge>
      <AppBadge color="yellow">Needs checking</AppBadge>
    </div>
  </section>
</template>

<style scoped>
.map {
  position: relative;
  height: 360px;
  overflow: hidden;
  background: var(--nt-gray);
  border-radius: 8px;
}
.map__dot {
  position: absolute;
  width: 16px;
  height: 16px;
  padding: 0;
  background: var(--nt-teal-t);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.map__dot--check {
  background: #d99a14;
}
.map__dot--on {
  width: 22px;
  height: 22px;
  background: var(--nt-plum);
  z-index: 1;
}
.map__dot:focus-visible {
  outline-offset: 3px;
}
.map__office {
  position: absolute;
  width: 18px;
  height: 18px;
  background: var(--nt-coral);
  border: 2px solid var(--nt-white);
  border-radius: 4px;
  transition: left 0.2s, top 0.2s;
}
.legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: 0.875rem;
  color: var(--nt-muted);
}
.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.legend__dot--room {
  background: var(--nt-teal-t);
}
.legend__dot--on {
  background: var(--nt-plum);
}
.legend__dot--office {
  border-radius: 2px;
  background: var(--nt-coral);
}
</style>
