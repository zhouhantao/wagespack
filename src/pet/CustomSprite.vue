<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { pickFrames, type Action, type Character } from './character-pack';
const props = defineProps<{ character: Character; action: Action; reduced: boolean }>();
const frames = computed(() => pickFrames(props.character.manifest, props.action));
const index = ref(0);
const frame = computed(() => frames.value[index.value] ?? frames.value[0]);
const canvas = computed(() => {
  const { width, height, anchor: [x, y] } = props.character.manifest;
  return { x: -Math.max(x, width - x), width: Math.max(x, width - x) * 2, y: -y, height };
});
watch(() => [frames.value, props.reduced] as const, ([sequence, reduced], _, cleanup) => {
  index.value = 0;
  let timer: number;
  const queue = () => {
    timer = window.setTimeout(() => { index.value = (index.value + 1) % sequence.length; queue(); }, sequence[index.value].ms);
  };
  if (!reduced && sequence.length > 1) queue();
  cleanup(() => clearTimeout(timer));
}, { immediate: true });
</script>

<template>
  <svg class="sprite custom-sprite" aria-hidden="true" :viewBox="[canvas.x, canvas.y, canvas.width, canvas.height].join(' ')">
    <svg :x="-character.manifest.anchor[0]" :y="-character.manifest.anchor[1]" :width="character.manifest.width"
      :height="character.manifest.height" :viewBox="[frame.x, frame.y, character.manifest.width, character.manifest.height].join(' ')">
      <image :href="character.url" :width="character.width" :height="character.height" />
    </svg>
  </svg>
</template>
