<script setup lang="ts">
defineProps<{ text: string }>();
</script>

<template>
  <span class="rolling-value"><span class="sr-only">{{ text }}</span><span aria-hidden="true" class="rolling-digits">
    <span v-for="(digit, index) in text" :key="index" class="digit-window">
      <span :key="digit" :class="{ 'digit-tick': /[0-9]/.test(digit) }">{{ digit }}</span>
    </span>
  </span></span>
</template>
