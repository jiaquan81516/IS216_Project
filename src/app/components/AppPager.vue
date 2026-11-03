<script setup>
import { computed, ref } from "vue";

defineOptions({ name: "AppPager" });
// Bootstrap pagination in the app's look. It only appears when the list needs more than one page.
const props = defineProps({
  total: { type: Number, required: true },
  pageSize: { type: Number, default: 25 },
  label: { type: String, default: "Pages" },
});
const page = defineModel({ type: Number, default: 1 });
const root = ref(null);

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
// 1 … 4 5 6 … 24: the first, the last and the pages around the current one.
const items = computed(() => {
  const last = pageCount.value;
  const keep = [...new Set([1, page.value - 1, page.value, page.value + 1, last])].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  return keep.flatMap((n, i) => (i && n - keep[i - 1] > 1 ? [`gap${n}`, n] : [n]));
});
const from = computed(() => (page.value - 1) * props.pageSize + 1);
const to = computed(() => Math.min(page.value * props.pageSize, props.total));

function goTo(n) {
  page.value = Math.min(pageCount.value, Math.max(1, n));
  // Bring the top of the list back into view; the list is the element just before the pager.
  root.value?.previousElementSibling?.scrollIntoView?.({ block: "start", behavior: "smooth" });
}
</script>

<template>
  <nav v-if="total > pageSize" ref="root" class="pgr" :aria-label="label">
    <ul class="pagination">
      <li class="page-item" :class="{ disabled: page === 1 }">
        <button type="button" class="page-link" :disabled="page === 1" aria-label="Previous page" @click="goTo(page - 1)">&lsaquo;</button>
      </li>
      <template v-for="item in items" :key="item">
        <li v-if="typeof item === 'string'" class="page-item disabled" aria-hidden="true"><span class="page-link">&hellip;</span></li>
        <li v-else class="page-item" :class="{ active: item === page }">
          <button type="button" class="page-link" :aria-current="item === page ? 'page' : undefined" :aria-label="`Page ${item}`" @click="goTo(item)">{{ item }}</button>
        </li>
      </template>
      <li class="page-item" :class="{ disabled: page === pageCount }">
        <button type="button" class="page-link" :disabled="page === pageCount" aria-label="Next page" @click="goTo(page + 1)">&rsaquo;</button>
      </li>
    </ul>
    <p class="pgr__note">Showing {{ from }} to {{ to }} of {{ total }}</p>
  </nav>
</template>

<style scoped>
.pgr { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.pgr .pagination { justify-content: center; flex-wrap: wrap; gap: 6px; margin: 0; }
.pgr .page-link { display: flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; padding: 4px 12px; background: #fff; border: 1.5px solid #e9d9b8; border-bottom-width: 3px; border-radius: 999px !important; color: #243560; font-weight: 600; box-shadow: none; transition: background-color 150ms, border-color 150ms, color 150ms; }
.pgr .page-item:not(.disabled):not(.active) .page-link:hover { background: #fdf9f0; border-color: #243560; }
.pgr .page-item.active .page-link { background: #243560; border-color: #243560; color: #fff; }
.pgr .page-item.disabled .page-link { background: transparent; border-color: transparent; color: #6b7392; }
.pgr .page-link:focus-visible { outline: 2px solid #243560; outline-offset: 2px; }
.pgr__note { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: #6b7392; }
</style>
