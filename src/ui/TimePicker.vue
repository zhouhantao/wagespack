<script setup lang="ts">
const value = defineModel<string>({ required: true });
const props = defineProps<{ label: string; optional?: boolean }>();
const options = (length: number) => Array.from({ length }, (_, i) => String(i).padStart(2, '0'));
function change(part: 'hour' | 'minute', event: Event) {
  const selected = (event.target as HTMLSelectElement).value;
  if (!selected) { value.value = ''; return; }
  const [hour, minute] = (value.value || '00:00').split(':');
  value.value = part === 'hour' ? selected + ':' + minute : hour + ':' + selected;
}
</script>

<template>
  <div class="time-field">
    <span>{{ props.label }}</span>
    <div class="time-picker" role="group" :aria-label="props.label">
      <select :value="value.slice(0,2)" :aria-label="props.label + ' HH'" @change="change('hour', $event)">
        <option v-if="optional" value="">—</option>
        <option v-for="hour in options(24)" :key="hour">{{ hour }}</option>
      </select>
      <span aria-hidden="true">:</span>
      <select :value="value.slice(3)" :aria-label="props.label + ' MM'" @change="change('minute', $event)">
        <option v-if="optional" value="">—</option>
        <option v-for="minute in options(60)" :key="minute">{{ minute }}</option>
      </select>
    </div>
  </div>
</template>
