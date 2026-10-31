<script setup>
// Opens and closes whatever is inside (put a v-if on one element) by easing its height, instead
// of the content snapping in and out. With reduced motion it is instant.
defineOptions({ name: "Collapse" });
const props = defineProps({ ms: { type: Number, default: 260 } });

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ease = "cubic-bezier(0.22, 0.61, 0.36, 1)";

function settle(el) {
  el.style.height = "";
  el.style.overflow = "";
  el.style.opacity = "";
  el.style.transition = "";
}
function onEnter(el, done) {
  if (reduced()) return done();
  el.style.overflow = "hidden";
  el.style.height = "0px";
  el.style.opacity = "0";
  void el.offsetHeight;
  el.style.transition = `height ${props.ms}ms ${ease}, opacity ${props.ms - 60}ms ease`;
  el.style.height = `${el.scrollHeight}px`;
  el.style.opacity = "1";
  setTimeout(done, props.ms);
}
function onLeave(el, done) {
  if (reduced()) return done();
  el.style.overflow = "hidden";
  el.style.height = `${el.scrollHeight}px`;
  void el.offsetHeight;
  el.style.transition = `height ${props.ms - 40}ms ease, opacity ${props.ms - 80}ms ease`;
  el.style.height = "0px";
  el.style.opacity = "0";
  setTimeout(done, props.ms - 40);
}
</script>

<template>
  <Transition :css="false" @enter="onEnter" @after-enter="settle" @leave="onLeave" @after-leave="settle">
    <slot />
  </Transition>
</template>
