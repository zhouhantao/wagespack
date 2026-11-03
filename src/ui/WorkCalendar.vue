<script setup lang="ts">
import { computed, ref } from 'vue';
import { Temporal } from '@js-temporal/polyfill';
import { translate } from './i18n';

const props = defineProps<{ today: string; selected: string; leave: Record<string, 'paid' | 'unpaid'>; language: string }>();
const emit = defineEmits<{ select: [date: string] }>();
const month = ref(Temporal.PlainDate.from(props.selected || props.today).with({ day: 1 }));
const days = computed(() => Array.from({ length: month.value.daysInMonth }, (_, i) => month.value.with({ day: i + 1 })));
const weekdays = computed(() => props.language === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : [...'一二三四五六日']);
function changeMonth(delta: number) { month.value = month.value.add({ months: delta }); }
</script>

<template>
  <div class="calendar">
    <header>
      <button type="button" :aria-label="translate(language, '上个月')" @click="changeMonth(-1)">‹</button>
      <strong>{{ month.toString().slice(0, 7) }}</strong>
      <button type="button" :aria-label="translate(language, '下个月')" @click="changeMonth(1)">›</button>
    </header>
    <div class="calendar-grid">
      <small v-for="(weekday, index) in weekdays" :key="index">{{ weekday }}</small>
      <span v-for="blank in month.dayOfWeek - 1" :key="'blank-' + blank"></span>
      <button v-for="day in days" :key="day.day" type="button"
        :aria-label="day.toString()" :aria-current="day.toString() === today ? 'date' : undefined"
        :aria-pressed="day.toString() === selected" :class="{ leave: leave[day.toString()] }"
        @click="emit('select', day.toString())">{{ day.day }}</button>
    </div>
  </div>
</template>
