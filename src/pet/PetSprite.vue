<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = defineProps<{ variant: 'boy' | 'girl'; action: 'idle' | 'open' | 'working' | 'break'; reduced: boolean; gesture?: number }>();
const seated = computed(() => props.action === 'working' || props.action === 'break');
const assets = import.meta.glob<string>('../../private-assets/*.png', { eager: true, import: 'default', query: '?url' });
const asset = (pose: string) => assets[`../../private-assets/${props.variant}-${pose}.png`];
const index = ref(0);
const poses = {
  boy: ['open-0', 'phone', 'point', 'walk', 'break-1', 'working-0'],
  girl: ['open-0', 'look', 'think', 'walk', 'break-1', 'working-0']
};
const frame = computed(() => {
  const gesture = props.action === 'open' && props.gesture !== undefined ? poses[props.variant][props.gesture % 6] : undefined;
  return (gesture && asset(gesture)) || asset(`${props.action}-${index.value}`) || asset('idle');
});
watch(() => [props.variant, props.action, props.reduced] as const, ([, action, reduced], _, cleanup) => {
  index.value = 0;
  if (reduced || action === 'idle' || (action === 'open' && props.gesture !== undefined) || !asset(`${action}-1`)) return;
  const timer = window.setInterval(() => { index.value = 1 - index.value; },
    action === 'break' ? 800 : action === 'working' ? 360 : 260);
  cleanup(() => window.clearInterval(timer));
}, { immediate: true });
</script>

<template>
  <img v-if="frame" class="sprite reference-sprite" :src="frame" :class="[action, { reduced }]" alt="" draggable="false">
  <svg v-else viewBox="0 0 52 66" class="sprite" :class="[action, { reduced }]" aria-hidden="true" shape-rendering="crispEdges">
    <g :transform="seated ? 'translate(0 7) scale(1 .89)' : ''">
      <path v-if="variant === 'girl'" fill="#342421" d="M10 8h30v6h6v28H6V19h4z"/>
      <g v-if="seated">
        <path fill="#503124" d="M8 45h29v7h-5v11h-4V52H15v11h-4V52H8z"/>
        <path fill="#a27047" d="M9 46h27v3H9zm3 6h2v9h-2zm17 0h2v8h-2z"/>
        <path fill="#754a32" d="M14 56h15v2H14z"/>
      </g>
      <g v-if="variant === 'boy'">
        <g v-if="seated">
          <path fill="#28252c" d="M15 41h19v4h7v6h-5v7h6v5H28v-9h-4v4h1v5H13v-5h2z"/>
          <path fill="#45414a" d="M17 44h16v2h5v4h-7v8h-3V49H17z"/>
          <path fill="#e1c6a2" d="M14 59h12v4H13zm16-1h9v2h4v3H29z"/>
          <path fill="#fff0d6" d="M16 59h7v2h-7zm16-1h6v2h-6z"/>
        </g>
        <g v-else>
          <path fill="#28252c" d="M14 41h23v18h2v4H27V51h-4v12H10v-5h4z"/>
          <path fill="#45414a" d="M16 43h8v7h-3v8h-6zm11 0h8v15h-6V49h-2z"/>
          <path fill="#e1c6a2" d="M11 58h11v5H9v-3h2zm18 0h8v2h3v3H28z"/>
          <path fill="#fff0d6" d="M13 58h8v2h-8zm16 0h6v2h-6z"/>
        </g>
        <path fill="#3b3a29" d="M12 28h27v5h3v11h-5v4H12v-4H8V33h4z"/>
        <path fill="#777653" d="M14 30h8v14h-8v-5h-4v-5h4zm15 0h8v5h3v7h-5v3h-6z"/>
        <path fill="#f1dec0" d="M22 30h7v14h-7z"/>
        <path fill="#a79a64" d="M14 34h5v4h-5zm19 0h4v4h-4z"/>
      </g>
      <g v-else>
        <path fill="#563626" :d="seated ? 'M23 51h8v7h3v5H22v-6h1zm12 0h7v7h4v5H34v-6h1z' : 'M15 51h7v7h3v5H13v-6h2zm15 0h7v7h4v5H29v-7h1z'"/>
        <path fill="#965d3a" :d="seated ? 'M24 57h7v4h-7zm13 0h5v3h3v1h-8z' : 'M15 57h7v4h-7zm16 0h6v3h3v1h-9z'"/>
        <path fill="#21342e" :d="seated ? 'M16 39h19v5h7v6h4v6H19v-4h-6v-6h3z' : 'M17 38h18v7h3v6h4v5H9v-5h4v-6h4z'"/>
        <path fill="#3a5141" :d="seated ? 'M18 42h15v4h7v5h3v3H23v-4h-7v-4h2z' : 'M21 40h6v14H13v-3h4v-5h4zm8 0h4v6h3v6h3v2h-7z'"/>
        <path fill="#9c7f64" d="M13 28h24v4h4v11H29v-3h-8v3H9V32h4z"/>
        <path fill="#f4dec1" d="M14 30h9v9h-6v3h-6v-8h3zm14 0h8v4h3v7h-7v-3h-4z"/>
        <path fill="#9c653c" d="M30 28h3v4h-3v4h-4v4h-4v4h-3v5H8v-7h9v-3h4v-4h4v-4h5z"/>
        <path fill="#c48b54" d="M10 43h8v3h-8z"/>
      </g>
      <g class="head">
        <path fill="#3b2821" d="M12 10h5V6h18v3h5v4h4v15h-4v4H15v-4h-5v-5H7v-9h5z"/>
        <path :fill="variant === 'boy' ? '#78492f' : '#50342e'" d="M13 12h5V8h16v3h5v4h3v9h-5v-6h-5v-4h-6v4h-6v4H11v-4H9v-3h4z"/>
        <path :fill="variant === 'boy' ? '#a36b43' : '#754c3d'" d="M16 11h7V9h8v2h-7v3h-6v3h-5v-3h3zm16 1h5v3h3v4h-3v-3h-5z"/>
        <path fill="#db906a" d="M17 21h5v-4h6v-3h5v4h4v5h3v5h-4v4H21v-3h-5v-4h-3v-4z"/>
        <path fill="#ffca99" d="M21 22h3v-4h6v-2h2v4h4v7h-3v4h-9v-3h-4z"/>
        <path class="eyes" fill="#3c2928" d="M22 22h3v3h-3zm9 0h3v3h-3z"/>
        <path fill="#b75f55" d="M26 28h5v1h-5z"/>
        <rect v-if="variant === 'girl'" x="16" y="26" width="2" height="2" fill="#fff0d2"/>
      </g>
      <g v-if="action === 'open'" class="wave">
        <path fill="#382923" d="M5 23h6v4h3v7h-3v7H7v-6H4V25h1z"/>
        <path fill="#f3ae83" d="M6 24h3v4h3v4H6z"/>
        <path :fill="variant === 'boy' ? '#777653' : '#f4dec1'" d="M7 32h6v5h-3v4H7z"/>
      </g>
      <g v-if="action === 'working'" class="hands">
        <path fill="#e5a077" d="M33 34h9v3h5v4h-7v-3h-7z"/>
        <path fill="#665653" d="M29 41h20v3H29z"/>
        <path fill="#b9a293" d="M32 41h3v1h-3zm5 0h3v1h-3zm5 0h3v1h-3z"/>
      </g>
      <g v-if="action === 'break'" class="cup">
        <path fill="#344a40" d="M34 34h13v7h-3v3h-8v-3h-2z"/>
        <path fill="#9db29a" d="M35 35h9v5h-2v2h-5v-2h-2z"/>
        <path fill="#f3ae83" d="M32 38h4v4h-4zm12 0h4v4h-4z"/>
      </g>
    </g>
  </svg>
</template>
