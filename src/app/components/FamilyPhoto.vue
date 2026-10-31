<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { CAPTION_MAX, PHOTO_MAX_CHARS, removeFamilyPhoto, saveFamilyPhoto, subscribeFamilyPhoto } from "@/api/familyPhoto";

defineOptions({ name: "FamilyPhoto" });

// A polaroid for your family photo. Either parent can add, change or remove it, and both see it.
const props = defineProps({
  householdId: { type: String, default: "" },
  uid: { type: String, default: "" },
});

const photo = ref(null);
const caption = ref("");
const busy = ref(false);
const problem = ref("");
// Set when the shared photo store cannot be reached or is not switched on for this household. Uploading
// still works then: the photo is kept on this device, with a quiet note. No backend message is shown.
const unavailable = ref(false);

const localKey = () => `nt.app.family-photo:${props.householdId || props.uid || "anon"}`;
function readLocal() {
  try {
    const value = JSON.parse(localStorage.getItem(localKey()) || "null");
    return value && typeof value.image === "string" ? { image: value.image, caption: String(value.caption ?? "") } : null;
  } catch {
    return null;
  }
}
function writeLocal(value) {
  try {
    localStorage.setItem(localKey(), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function clearLocal() {
  try {
    localStorage.removeItem(localKey());
  } catch {
    // Nothing to clear.
  }
}
const fileInput = ref(null);
let stop = null;

watch(
  () => props.householdId,
  (id) => {
    stop?.();
    stop = null;
    photo.value = null;
    const local = readLocal();
    if (local) {
      photo.value = local;
      caption.value = local.caption;
    }
    if (!id) return;
    stop = subscribeFamilyPhoto(
      id,
      (data) => {
        if (!data) {
          // Nothing shared yet. A photo kept on this device is moved into the shared store when it can be.
          const kept = readLocal();
          if (kept) {
            photo.value = kept;
            caption.value = kept.caption;
            saveFamilyPhoto(id, props.uid, kept).then(clearLocal).catch(() => {});
            return;
          }
        }
        photo.value = data;
        caption.value = data?.caption ?? "";
      },
      (error) => {
        if (error?.code === "permission-denied") unavailable.value = true;
      },
    );
  },
  { immediate: true },
);
onBeforeUnmount(() => stop?.());

// Shrink the picture in the browser: at most 900 pixels on the long side, as a JPEG.
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}
async function toJpeg(file) {
  const img = await loadImage(file);
  let longSide = 900;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scale = Math.min(1, longSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= PHOTO_MAX_CHARS) return data;
    }
    longSide = Math.round(longSide * 0.8);
  }
  throw new Error("too-large");
}

function pick() {
  problem.value = "";
  fileInput.value?.click();
}
async function onFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    problem.value = "Choose a picture, such as a JPG or PNG.";
    return;
  }
  busy.value = true;
  problem.value = "";
  let image;
  try {
    image = await toJpeg(file);
  } catch (error) {
    problem.value = error?.message === "unreadable" ? "That picture could not be read. Try a JPG or PNG." : "We could not use that photo. Try a smaller one.";
    busy.value = false;
    return;
  }
  const entry = { image, caption: caption.value.trim().slice(0, CAPTION_MAX) };
  try {
    if (!props.householdId) throw Object.assign(new Error("no household"), { code: "permission-denied" });
    await saveFamilyPhoto(props.householdId, props.uid, entry);
    clearLocal();
  } catch (error) {
    if (error?.code === "permission-denied") {
      // The shared store is not available yet, so keep it on this device.
      unavailable.value = true;
      if (writeLocal(entry)) {
        photo.value = entry;
      } else {
        problem.value = "We could not save that photo. Try a smaller one.";
      }
    } else {
      problem.value = "We could not save that photo. Try again.";
    }
  } finally {
    busy.value = false;
  }
}
async function saveCaption() {
  if (!photo.value || caption.value.trim() === photo.value.caption) return;
  const entry = { image: photo.value.image, caption: caption.value.trim().slice(0, CAPTION_MAX) };
  if (unavailable.value || !props.householdId) {
    photo.value = entry;
    writeLocal(entry);
    return;
  }
  try {
    await saveFamilyPhoto(props.householdId, props.uid, entry);
  } catch {
    problem.value = "We could not save the caption.";
  }
}
async function remove() {
  busy.value = true;
  problem.value = "";
  try {
    clearLocal();
    if (unavailable.value || !props.householdId) {
      photo.value = null;
      caption.value = "";
    } else {
      await removeFamilyPhoto(props.householdId);
    }
  } catch {
    problem.value = "We could not remove the photo.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <figure class="fp">
      <!-- The frame is the NurtureTrack logo: the plum crescent moon, with the photo as the apricot sun in its curve -->
      <button type="button" class="fp__logo" :disabled="busy" :aria-label="photo ? 'Change the family photo' : 'Add a family photo'" @click="pick">
        <svg class="fp__moon" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16.33 3.00022C13.9309 2.9398 11.5619 3.54466 9.48537 4.7478C7.40886 5.95094 5.70593 7.70541 4.5652 9.81684C3.42447 11.9283 2.89048 14.3143 3.02237 16.7105C3.15425 19.1068 3.94688 21.4198 5.31244 23.3932C6.678 25.3667 8.56319 26.9237 10.7592 27.8917C12.9552 28.8597 15.3763 29.2009 17.7543 28.8776C20.1323 28.5542 22.3744 27.5789 24.2322 26.0597C26.09 24.5405 27.491 22.5367 28.28 20.2702C25.9899 21.8549 23.164 22.4649 20.4241 21.966C17.6842 21.4672 15.2547 19.9004 13.67 17.6102C12.0853 15.3201 11.4753 12.4942 11.9742 9.75431C12.473 7.01441 14.0399 4.58488 16.33 3.00022Z" fill="#3B2F3F" /></svg>
        <span class="fp__hole">
          <img v-if="photo" class="fp__img" :src="photo.image" alt="Your family" />
          <span v-else class="fp__empty">
            <svg class="fp__art" width="40" height="36" viewBox="0 0 64 56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="56" height="44" rx="6" /><circle cx="44" cy="19" r="5" /><path d="M4 40l16-16 12 12 8-8 20 20" /></svg>
            <span class="fp__title">{{ busy ? "Saving..." : "Add your family photo" }}</span>
            <span class="visually-hidden">{{ unavailable ? "Saved on this device for now" : "You will both see it here" }}</span>
          </span>
        </span>
      </button>
      <figcaption v-if="photo" class="fp__caption">
        <label class="visually-hidden" for="fp-caption">Caption</label>
        <input id="fp-caption" v-model="caption" class="fp__caption-input" type="text" :maxlength="CAPTION_MAX" placeholder="Our family" @blur="saveCaption" @keydown.enter.prevent="$event.target.blur()" />
      </figcaption>
      <p v-if="photo" class="fp__tools">
        <button type="button" class="fp__tool" :disabled="busy" @click="pick">Change photo</button>
        <button type="button" class="fp__tool" :disabled="busy" @click="remove">Remove</button>
      </p>
      <p v-if="photo && unavailable" class="fp__note">Saved on this device for now.</p>
      <p v-if="problem" class="fp__problem" role="alert">{{ problem }}</p>
      <input ref="fileInput" class="fp__file" type="file" accept="image/*" tabindex="-1" aria-hidden="true" @change="onFile" />
  </figure>
</template>

<style scoped>
/* The frame is the NurtureTrack logo. The plum crescent moon hugs a round photo, which sits where the logo's apricot sun is. */
.fp { position: relative; width: 100%; max-width: 460px; margin: 0; }
.fp__logo { position: relative; display: block; width: 100%; aspect-ratio: 1; padding: 0; background: none; border: 0; font-family: inherit; color: #55627a; cursor: pointer; }
.fp__logo:focus-visible { outline: 2px solid #1f3a68; outline-offset: 4px; border-radius: 12px; }
.fp__logo:disabled { opacity: 0.7; cursor: default; }
.fp__moon { position: absolute; inset: 0; width: 100%; height: 100%; }
.fp__hole { position: absolute; left: 28.5%; top: 9%; width: 65.6%; height: 65.6%; overflow: hidden; background: #fff; border: 5px solid #e3a584; border-radius: 50%; }
.fp__img { display: block; width: 100%; height: 100%; object-fit: cover; background: #e6edf6; }
.fp__empty { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: 100%; height: 100%; padding: 14%; background: #fbf3e6; text-align: center; color: #3b2f3f; transition: background-color 0.2s; }
.fp__logo:hover:not(:disabled) .fp__empty { background: #f6e6d3; }
.fp__art { color: #3b2f3f; opacity: 0.85; }
.fp__title { margin: 0; font-size: 0.875rem; font-weight: 600; line-height: 1.3; }

.fp__caption { margin: 12px 0 0; }
.fp__caption-input { width: 100%; padding: 0; background: transparent; border: 0; border-bottom: 1px solid transparent; font-family: var(--serif, "Literata", Georgia, serif); font-size: 1.125rem; font-size: 1.125rem; font-weight: 500; line-height: 1.5; text-align: center; color: #16233b; }
.fp__caption-input::placeholder { color: #6b7790; }
.fp__caption-input:hover, .fp__caption-input:focus { outline: none; border-bottom-color: #8fa0bd; }
.fp__tools { display: flex; justify-content: center; gap: 16px; margin: 4px 0 0; }
.fp__tool { padding: 0; background: none; border: 0; font-family: inherit; font-size: 0.875rem; font-weight: 500; color: #55627a; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.fp__tool:hover:not(:disabled) { color: #16233b; }
.fp__tool:disabled { opacity: 0.6; cursor: default; }
.fp__note { margin: 4px 0 0; font-size: 0.75rem; line-height: 1.4; text-align: center; color: #55627a; }
.fp__problem { margin: 8px 0 0; font-size: 0.875rem; line-height: 1.4; color: #b5532f; }
.fp__file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
