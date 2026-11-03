<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { Decimal } from 'decimal.js';
import { averageMonth, estimate, projectWorkFinish, typicalShiftHours, validateSchedule, type Schedule } from '../core/earnings';
import { currentSchedule, periodTotal, queueSchedule, type Version } from '../core/history';
import { readLocal, writeLocal } from '../platform/storage';
import { desktopPet, desktopPanel, panel as nativePanel, dragPet, setTopmost, resizePet, setStartup, openPetMenu, onDesktopEvent } from '../platform/desktop';
import PetSprite from '../pet/PetSprite.vue';
import CustomSprite from '../pet/CustomSprite.vue';
import { loadCharacter, type Character } from '../pet/character-pack';
import { translate } from './i18n';
import WorkCalendar from './WorkCalendar.vue';
import TimePicker from './TimePicker.vue';
import RollingAmount from './RollingAmount.vue';

const currencies = { CNY: '￥', USD: '$', EUR: '€', JPY: '¥', GBP: '£', HKD: 'HK$', TWD: 'NT$', KRW: '₩' } as const;
const languages = { zh: '简体中文', 'zh-TW': '繁體中文', en: 'English', ja: '日本語' };
const themes = { paper: '森林', night: '深夜', ember: '落日余烬', frost: '冰川', orchid: '紫雾' };

const defaultSchedule: Schedule = {
  rate: '0', basis: 'month', zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00', exceptions: {}
};
const defaultPrefs = { character: 'boy' as 'boy' | 'girl', currency: 'CNY', precision: 2, reduced: false, private: false, topmost: true, theme: 'paper', average: false, custom: false, mini: false, language: 'zh', scale: 100, startup: false, idleChat: true };
const versions = ref(readLocal<Version[]>('versions', [{ from: 0, schedule: readLocal('schedule', defaultSchedule) }]));
const prefs = ref({ ...defaultPrefs, ...readLocal('prefs', defaultPrefs) });
const tr = (label: string) => translate(prefs.value.language, label);
watchEffect(() => { document.documentElement.lang = prefs.value.language === 'zh' ? 'zh-CN' : prefs.value.language; });
const editing = ref(false);
const onboarding = ref(!readLocal('welcomed', false));
const draft = ref<Schedule>(structuredClone(defaultSchedule));
const draftPrefs = ref({ ...defaultPrefs });
const open = ref(false);
const waving = ref(false);
const idleChat = ref(false);
const idleTurn = ref(-1);
let nextIdleAt = Date.now() + 28000;
const gesture = ref(-1);
const previewGesture = ref(0);
const petName = computed(() => prefs.value.custom && custom.value ? custom.value.manifest.name : prefs.value.character === 'boy' ? '小周' : '小祖');
const gestures = ['嗨，我在这儿！', '给你打个气！', '又前进了一小步。', '我陪你走走。', '记得喝口水。', '一起专注一会儿。'];
const error = ref('');
const now = ref(Date.now());
const schedule = computed(() => currentSchedule(versions.value, now.value));
const custom = ref(readLocal<Character | null>('character', null));
const customDraft = ref<Character | null>(null);
const imageFile = ref<File>();
const manifestFile = ref<File>();
const importing = ref(false);
const leaveDate = ref('');
const leaveKind = ref<'paid' | 'unpaid'>('unpaid');
type Goal = { name: string; amount: string; share?: number; from?: string; baseline?: string; currency?: string };
const goals = ref(readLocal<Goal[]>('goals', []));
const goalName = ref('');
const goalAmount = ref('');
const goalShare = ref(20);
const goalError = ref('');
const toolsOpen = ref(false);
const earned = computed(() => {
  try { return estimate(schedule.value, now.value); }
  catch { return estimate(defaultSchedule, now.value); }
});
const action = computed(() => waving.value ? 'open' : !open.value ? 'idle' : earned.value.state === 'working' ? 'working'
  : earned.value.state === 'break' ? 'break' : 'idle');
const reduced = computed(() => prefs.value.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches);
const monthly = computed(() => periodTotal(versions.value, earned.value.date.slice(0, 7) + '-01', earned.value.date, now.value));
const forecastTick = computed(() => Math.floor(now.value / 60000) * 60000);
const forecastDay = computed(() => earned.value.date);
const forecastRate = computed(() => estimate(schedule.value, forecastTick.value).nominalPerSecond.mul(3600));
const goalCards = computed(() => goals.value.map(goal => {
  const target = new Decimal(goal.amount);
  const share = (goal.share ?? 100) / 100;
  const currency = goal.currency ?? prefs.value.currency;
  const compatible = currency === prefs.value.currency;
  const accrual = goal.from ? periodTotal(versions.value, goal.from, forecastDay.value, forecastTick.value).minus(goal.baseline ?? '0') : monthly.value;
  const saved = Decimal.max(0, accrual).mul(share);
  const remaining = Decimal.max(0, target.minus(saved));
  const shiftHours = typicalShiftHours(schedule.value);
  const hourly = schedule.value.basis === 'day' && shiftHours > 0 ? new Decimal(schedule.value.rate).div(shiftHours) : forecastRate.value;
  const rate = hourly.mul(share);
  const hours = compatible && rate.gt(0) && schedule.value.days.length > 0 ? remaining.div(rate).toNumber() : null;
  const shifts = hours !== null && shiftHours > 0 ? Math.ceil(hours / shiftHours) : null;
  const finish = hours !== null ? projectWorkFinish(schedule.value, forecastTick.value, hours) : null;
  return { goal, target, saved, hours, shifts, finish, currency, compatible, progress: Decimal.min(1, saved.div(target)).toNumber() };
}));
const draftEstimate = computed(() => {
  try { return estimate(draft.value, now.value); }
  catch { return null; }
});
const zones = computed(() => [...new Set([draft.value.zone, 'Asia/Shanghai', 'UTC', ...Intl.supportedValuesOf('timeZone')])]);
const selectedTotal = computed(() => {
  if (!leaveDate.value) return null;
  try { return periodTotal(versions.value, leaveDate.value, leaveDate.value, now.value); }
  catch { return null; }
});
const average = computed(() => prefs.value.average ? averageMonth(schedule.value, now.value) : null);
const states = { waiting: '待上班', working: '工作中', break: '休息中', finished: '已下班', off: '无排班', paid: '带薪假', unpaid: '无薪假' };
const lines = { waiting: '等你开工！', working: '今天也一起加油！', break: '喝口水，歇一歇。', finished: '收工啦，辛苦了！', off: '今天自由活动！', paid: '好好休息吧！', unpaid: '好好休息吧！' };
const dialogue = computed(() => {
  if (idleChat.value) {
    if (prefs.value.private) return tr(lines[earned.value.state]);
    switch (idleTurn.value % 3) {
      case 0: return tr('今日估算') + ' ' + money(earned.value.amount);
      case 1: return tr('每秒估算') + ' ' + money(earned.value.perSecond, 5);
      default: return tr('每小时计薪') + ' ' + money(earned.value.nominalPerSecond.mul(3600));
    }
  }
  return tr(waving.value ? gestures[gesture.value] : !open.value ? '嗨，我在这儿！' : lines[earned.value.state]);
});
const leftSeconds = (target: number) => Math.max(0, Math.ceil((target - now.value) / 1000));
function goalCountdown(target: number) {
  const seconds = leftSeconds(target);
  const days = Math.floor(seconds / 86400);
  const time = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
  return (days ? days + ' ' + tr('天') + ' ' : '') + time;
}
const countdown = computed(() => {
  const target = earned.value.state === 'waiting' || earned.value.state === 'off' || earned.value.state === 'finished'
    ? earned.value.next : earned.value.end;
  if (target === undefined) return '—';
  const seconds = Math.max(0, Math.ceil((target - now.value) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(n => String(n).padStart(2, '0')).join(':');
});

function chooseCharacter(character: 'boy' | 'girl') {
  prefs.value.character = character;
  finishWelcome();
}
function finishWelcome() {
  writeLocal('prefs', prefs.value);
  writeLocal('welcomed', true);
  onboarding.value = false;
}
function edit() {
  const latest = versions.value.at(-1)?.schedule ?? schedule.value;
  draft.value = { ...latest, days: [...latest.days], exceptions: { ...latest.exceptions } };
  draftPrefs.value = { ...prefs.value };
  customDraft.value = custom.value;
  imageFile.value = undefined;
  manifestFile.value = undefined;
  editing.value = true;
  previewGesture.value = 0;
  error.value = '';
}
async function save() {
  try {
    validateSchedule(draft.value);
    if (desktopPanel && prefs.value.startup !== draftPrefs.value.startup) await setStartup(draftPrefs.value.startup);
    if (desktopPanel && prefs.value.scale !== draftPrefs.value.scale) await resizePet(draftPrefs.value.scale);
    const configured = readLocal('configured', false);
    const hasScheduleChanges = JSON.stringify(draft.value) !== JSON.stringify(versions.value.at(-1)?.schedule);
    const next = !configured ? [{ from: 0, schedule: draft.value }]
      : hasScheduleChanges ? queueSchedule(versions.value, draft.value, Date.now()) : versions.value;
    writeLocal('character', customDraft.value);
    writeLocal('versions', next);
    writeLocal('configured', true);
    writeLocal('prefs', draftPrefs.value);
    custom.value = customDraft.value;
    versions.value = next;
    prefs.value = draftPrefs.value;
    setTopmost(prefs.value.topmost)?.catch(console.error);
    editing.value = false;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '保存失败';
  }
}
function fileChanged(event: Event, manifest: boolean) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (manifest) manifestFile.value = file;
  else imageFile.value = file;
}
async function importCharacter() {
  if (!imageFile.value) return;
  importing.value = true;
  error.value = '';
  try {
    customDraft.value = await loadCharacter(imageFile.value, manifestFile.value);
    draftPrefs.value.custom = true;
  } catch { error.value = '无法导入角色，请检查图像、清单和尺寸限制。'; }
  finally { importing.value = false; }
}
function setLeave(remove = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveDate.value)) return;
  const stamp = leaveDate.value;
  const changed = versions.value.map(version => {
    const exceptions = { ...version.schedule.exceptions };
    if (remove) delete exceptions[stamp];
    else exceptions[stamp] = leaveKind.value;
    return { ...version, schedule: { ...version.schedule, exceptions } };
  });
  writeLocal('versions', changed);
  versions.value = changed;
}
function updateGoals(next: typeof goals.value) { writeLocal('goals', next); goals.value = next; }
function addGoal() {
  goalError.value = '';
  if (!goalName.value.trim() || !/^\d{1,12}(?:\.\d{1,4})?$/.test(goalAmount.value) || Number(goalAmount.value) === 0) {
    goalError.value = '请输入大于零的目标金额。';
    return;
  }
  updateGoals([...goals.value, {
    name: goalName.value.trim(), amount: goalAmount.value, share: goalShare.value,
    from: earned.value.date, baseline: earned.value.amount.toString(), currency: prefs.value.currency
  }]);
  goalName.value = ''; goalAmount.value = '';
}
function close() {
  editing.value = false;
  open.value = false;
  if (desktopPanel) nativePanel(true)?.catch(console.error);
}
let waveTimer: number;
function showGesture(automatic = false) {
  nextIdleAt = Date.now() + (automatic ? 44000 : 28000);
  idleChat.value = automatic;
  if (automatic) idleTurn.value++;
  gesture.value = (gesture.value + 1) % gestures.length;
  waving.value = !automatic || !reduced.value;
  clearTimeout(waveTimer);
  waveTimer = window.setTimeout(() => { waving.value = false; idleChat.value = false; }, automatic ? 4200 : 1100);
}
function togglePet() {
  showGesture();
  if (desktopPet) nativePanel(false)?.catch(console.error);
  else if (open.value) close();
  else open.value = true;
}
let down: { x: number; y: number } | undefined;
function pointerDown(event: PointerEvent) {
  if (!desktopPet || event.button !== 0) return;
  down = { x: event.screenX, y: event.screenY };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function pointerMove(event: PointerEvent) {
  if (!down || Math.hypot(event.screenX - down.x, event.screenY - down.y) < 6) return;
  down = undefined;
  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  dragPet()?.catch(console.error);
}
function pointerUp() {
  if (down) togglePet();
  down = undefined;
}
function contextMenu() {
  if (desktopPet) openPetMenu()?.catch(console.error);
  else if (!open.value) togglePet();
}
function storageChanged(event: StorageEvent) {
  if (event.key === 'wagespark.prefs') prefs.value = { ...defaultPrefs, ...readLocal('prefs', defaultPrefs) };
  if (event.key === 'wagespark.versions') versions.value = readLocal('versions', versions.value);
  if (event.key === 'wagespark.character') custom.value = readLocal('character', null);
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') close(); }
function symbol(currency: string) { return currencies[currency as keyof typeof currencies] ?? currency + ' '; }
function money(value: { toFixed: (places: number) => string }, places = prefs.value.precision, currency = prefs.value.currency) {
  return prefs.value.private ? '••••' : symbol(currency) + value.toFixed(places).replace(/\B(?=(\d{3})+\.)/g, ',');
}
let timer: number;
const unlisten: (() => void)[] = [];
onMounted(() => {
  if (desktopPet) {
    setTopmost(prefs.value.topmost)?.catch(console.error);
    if (prefs.value.scale !== 100) resizePet(prefs.value.scale)?.catch(console.error);
  }
  if (desktopPet || desktopPanel) onDesktopEvent<boolean>('panel-visible', value => { open.value = value; })?.then(stop => { unlisten.push(stop); }).catch(console.error);
  if (desktopPanel) onDesktopEvent('show-settings', edit)?.then(stop => { unlisten.push(stop); }).catch(console.error);
  timer = window.setInterval(() => {
    if (document.hidden) return;
    now.value = Date.now();
    if (!desktopPanel && (!onboarding.value || desktopPet) && prefs.value.idleChat && !prefs.value.mini
        && !open.value && !down && now.value >= nextIdleAt) showGesture(true);
  }, 1000);
  window.addEventListener('keydown', onKey);
  window.addEventListener('storage', storageChanged);
});
onUnmounted(() => {
  clearInterval(timer);
  clearTimeout(waveTimer);
  unlisten.forEach(stop => stop());
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('storage', storageChanged);
});
</script>

<template>
  <main class="stage" :data-theme="prefs.theme" :class="{ 'desktop-pet': desktopPet, 'desktop-panel': desktopPanel, 'reduce-motion': reduced }">
    <section v-if="onboarding && !desktopPet" class="panel intro" :class="{ 'panel-entering': !desktopPanel || open }" :aria-label="tr('选择角色')">
      <div class="eyebrow"><i class="block-icon" aria-hidden="true"></i> wagespack</div>
      <h1>{{ tr('选一位上班搭子') }}</h1>
      <p>{{ tr('陪你工作、休息，等到下班。') }}</p>
      <div class="choices">
        <button type="button" @click="chooseCharacter('boy')"><PetSprite variant="boy" action="idle" reduced />小周</button>
        <button type="button" @click="chooseCharacter('girl')"><PetSprite variant="girl" action="idle" reduced />小祖</button>
      </div>
      <button type="button" class="quiet" @click="finishWelcome">{{ tr('跳过') }}</button>
    </section>
    <template v-else>
      <div v-if="!desktopPanel" class="pet-slot" :class="{ 'is-speaking': open || waving || idleChat }">
      <div v-if="!prefs.mini" class="pet-dialogue" role="status" :aria-label="tr('桌宠对话')"><span :key="dialogue"><b>{{ petName }}</b> · {{ dialogue }}</span></div>
      <span v-if="waving && !prefs.mini" :key="gesture" class="pet-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <button type="button" class="pet-button" :aria-label="tr('桌宠信息')" :aria-expanded="open"
        @click="!desktopPet || $event.detail === 0 ? togglePet() : undefined"
        @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="down = undefined"
        @contextmenu.prevent="contextMenu">
        <span v-if="prefs.mini" class="mini">{{ money(earned.amount) }}<small>{{ tr('今日估算') }}</small></span>
        <CustomSprite v-else-if="prefs.custom && custom" :character="custom" :action="action" :reduced="reduced" />
        <PetSprite v-else :variant="prefs.character" :action="action" :gesture="gesture" :reduced="reduced" />
      </button>
      </div>
      <section v-if="!desktopPet && (desktopPanel || open)" class="panel dashboard" :class="{ 'panel-entering': open }" :aria-label="tr('工资面板')">
        <header class="panel-bar"><div class="eyebrow"><i class="block-icon" aria-hidden="true"></i> wagespack <small>{{ earned.date }}</small></div><button type="button" :aria-label="tr('收起面板')" @click="close">×</button></header>
        <template v-if="!editing">
          <div class="earnings">
          <div class="status" :data-state="earned.state">{{ tr(states[earned.state]) }}</div>
          <p class="subtle earnings-label">{{ tr('今日估算') }}</p>
          <h1><RollingAmount :text="money(earned.amount)" /></h1>
          <p class="subtle rate">{{ money(earned.perSecond, 5) }} / {{ tr('秒') }}</p>
          </div>
          <details class="rate-details">
            <summary>{{ tr('收入怎么算') }}</summary>
            <p>{{ money(new Decimal(schedule.rate)) }} ÷ {{ earned.basisHours.toFixed(2) }} h = {{ money(earned.nominalPerSecond.mul(3600), 2) }} / h</p>
            <p>{{ money(earned.nominalPerSecond.mul(60), 4) }} / min · {{ money(earned.nominalPerSecond, 5) }} / {{ tr('秒') }}</p>
            <p>{{ tr('按净工作时间计入，休息时实时速率为零。') }}</p>
          </details>
          <div class="metrics">
            <div><small>{{ earned.state === 'waiting' || !earned.end || earned.state === 'finished' ? tr('距离上班') : tr('距离下班') }}</small><strong>{{ countdown }}</strong></div>
            <div><small>{{ tr('工作进度') }}</small><strong>{{ Math.floor(earned.progress * 100) }}%</strong></div>
          </div>
          <progress :aria-label="tr('工作进度')" :value="earned.progress" max="1"></progress>
          <p v-if="earned.state === 'break'" class="subtle">{{ tr('休息一下，喝点水。') }}</p>
          <p v-if="average" class="subtle">{{ tr('全天平均 · 娱乐演示') }} {{ money(average) }}</p>
          <div v-for="(card, index) in goalCards" :key="index" class="goal">
            <div class="goal-top">
              <strong>{{ card.goal.name }}</strong>
              <button v-if="toolsOpen" type="button" :aria-label="tr('删除') + ' ' + card.goal.name" @click="updateGoals(goals.filter((_, i) => i !== index))">{{ tr('删除') }}</button>
            </div>
            <template v-if="!prefs.private && card.compatible">
              <div class="goal-amount"><span>{{ money(card.saved, 2, card.currency) }} / {{ money(card.target, 2, card.currency) }}</span><span>{{ Math.floor(card.progress * 100) }}%</span></div>
              <progress :aria-label="card.goal.name" :value="card.progress" max="1"></progress>
              <p class="goal-eta" v-if="card.progress >= 1">{{ tr('已达成') }}</p>
              <p class="goal-eta" v-else-if="card.hours !== null">{{ tr('预计还需') }} <strong>{{ card.hours < 1 ? Math.ceil(card.hours * 60) + ' min' : card.hours.toFixed(1) + ' h' }}</strong> · {{ tr('净工作时间') }}</p>
              <p class="goal-eta" v-else>{{ tr('设置薪资和排班后可估算进度时间。') }}</p>
              <div v-if="card.progress < 1 && card.finish !== null" class="goal-countdown">
                <span>{{ tr('预计天数') }} <strong>{{ Math.ceil(leftSeconds(card.finish) / 86400) }} {{ tr('天') }}</strong></span>
                <span>{{ tr('倒计时') }} <strong>{{ goalCountdown(card.finish) }}</strong></span>
              </div>
              <p v-if="card.progress < 1 && card.shifts !== null" class="goal-eta">{{ tr('约需班次') }} {{ card.shifts }} · {{ card.goal.share ?? 100 }}%</p>
            </template>
            <p v-else-if="!prefs.private" class="goal-eta">{{ tr('此愿望的币种与当前设置不同。') }}</p>
          </div>
          <footer><button type="button" @click="edit">{{ tr('设置') }}</button><button type="button" :aria-expanded="toolsOpen" @click="toolsOpen = !toolsOpen">{{ tr('愿望 / 日历') }}</button></footer>
          <section v-if="toolsOpen" class="tools">
            <h2>{{ tr('本月估算') }}</h2><strong>{{ money(monthly) }}</strong>
            <form class="goal-form" @submit.prevent="addGoal">
              <h2>{{ tr('愿望清单') }}</h2>
              <div class="fields">
                <label>{{ tr('愿望') }}<input v-model="goalName" maxlength="60" required></label>
                <label>{{ tr('目标金额') }}<span class="money-field"><span aria-hidden="true">{{ symbol(prefs.currency) }}</span><input v-model="goalAmount" inputmode="decimal" required></span></label>
                <label>{{ tr('收入投入比例') }}<select v-model="goalShare"><option v-for="share in [5,10,20,30,50,75,100]" :key="share" :value="share">{{ share }}%</option></select></label>
              </div>
              <p v-if="goalError" role="alert">{{ tr(goalError) }}</p>
              <button>{{ tr('添加愿望') }}</button><p class="subtle">{{ tr('新愿望从创建时开始累计，完成时间按当前排班和投入比例估算。') }}</p>
            </form>
            <h2>{{ tr('排班日历') }}</h2>
            <WorkCalendar :today="earned.date" :selected="leaveDate" :leave="schedule.exceptions" :language="prefs.language" @select="leaveDate = $event" />
            <label>{{ tr('休假日期') }}<input v-model="leaveDate" type="date"></label>
            <p v-if="selectedTotal" class="subtle">{{ tr('该日估算') }} · {{ money(selectedTotal) }}</p>
            <label>{{ tr('休假类型') }}<select v-model="leaveKind"><option value="unpaid">{{ tr('无薪假') }}</option><option value="paid">{{ tr('带薪假') }}</option></select></label>
            <button type="button" @click="setLeave()">{{ tr('保存休假') }}</button>
            <button type="button" @click="setLeave(true)">{{ tr('清除休假') }}</button>
            <ul><li v-for="(kind, date) in schedule.exceptions" :key="date">{{ date }} · {{ tr(states[kind]) }}</li></ul>
          </section>
        </template>
        <form v-else class="settings-form" @submit.prevent="save">
          <h2>{{ tr('薪资与排班') }}</h2>
          <fieldset class="settings-group"><legend>{{ tr('收入设置') }}</legend>
          <div class="fields">
            <label>{{ tr('薪资金额') }}<span class="money-field"><span aria-hidden="true">{{ symbol(draftPrefs.currency) }}</span><input v-model.trim="draft.rate" inputmode="decimal" maxlength="17" required></span></label>
            <label>{{ tr('计薪方式') }}<select v-model="draft.basis"><option value="month">{{ tr('月薪') }}</option><option value="day">{{ tr('日薪') }}</option><option value="hour">{{ tr('时薪') }}</option></select></label>
            <label>{{ tr('币种') }}<select v-model="draftPrefs.currency"><option v-for="(sign, code) in currencies" :key="code" :value="code">{{ sign }} · {{ code }}</option></select></label>
            <label>{{ tr('小数位') }}<select v-model="draftPrefs.precision"><option :value="2">{{ tr('2 位') }}</option><option :value="4">{{ tr('4 位') }}</option></select></label>
          </div>
          <div v-if="draftEstimate" class="rate-preview"><small>{{ tr('每秒估算') }}</small><strong>{{ money(draftEstimate.nominalPerSecond, 5, draftPrefs.currency) }}</strong><small>{{ draftEstimate.basisHours.toFixed(2) }} h · {{ tr('计薪基数') }}</small></div>
          </fieldset>
          <fieldset class="settings-group"><legend>{{ tr('工作时间') }}</legend>
            <div class="fields">
              <TimePicker v-model="draft.start" :label="tr('上班')" />
              <TimePicker v-model="draft.end" :label="tr('下班')" />
              <TimePicker v-model="draft.breakStart" :label="tr('午休开始')" optional />
              <TimePicker v-model="draft.breakEnd" :label="tr('午休结束')" optional />
              <label class="full-field">{{ tr('时区') }}<select v-model="draft.zone"><option v-for="zone in zones" :key="zone">{{ zone }}</option></select></label>
            </div>
            <div class="weekday-picker" role="group" :aria-label="tr('工作日')"><label v-for="(label, i) in (prefs.language === 'en' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : [...'一二三四五六日'])" :key="label"><input v-model="draft.days" :value="i + 1" type="checkbox"><span>{{ label }}</span></label></div>
          </fieldset>
          <fieldset class="settings-group"><legend>{{ tr('桌宠与界面') }}</legend>
          <div class="settings-character">
            <CustomSprite v-if="draftPrefs.custom && customDraft" :character="customDraft" action="idle" :reduced="reduced" />
            <PetSprite v-else :variant="draftPrefs.character" action="open" :gesture="previewGesture" :reduced="reduced" />
            <div>
              <label>{{ tr('角色') }}<select v-model="draftPrefs.character" @change="draftPrefs.custom = false"><option value="boy">小周</option><option value="girl">小祖</option></select></label>
              <button v-if="!draftPrefs.custom || !customDraft" type="button" @click="previewGesture = (previewGesture + 1) % gestures.length">{{ tr('预览动作') }}</button>
            </div>
          </div>
          <div class="settings-toggles">
          <label><input v-model="draftPrefs.reduced" type="checkbox">{{ tr('关闭动画') }}</label>
          <label><input v-model="draftPrefs.idleChat" type="checkbox">{{ tr('空闲自动互动') }}</label>
          <label><input v-model="draftPrefs.private" type="checkbox">{{ tr('隐藏金额') }}</label>
          <label v-if="desktopPanel"><input v-model="draftPrefs.topmost" type="checkbox">{{ tr('窗口置顶') }}</label>
          <label v-if="desktopPanel"><input v-model="draftPrefs.startup" type="checkbox">{{ tr('开机自启') }}</label>
          <label v-if="desktopPanel">{{ tr('角色大小') }}<select v-model="draftPrefs.scale"><option :value="75">75%</option><option :value="100">100%</option><option :value="125">125%</option><option :value="150">150%</option></select></label>
          <label><input v-model="draftPrefs.mini" type="checkbox">{{ tr('金额迷你模式') }}</label>
          <label v-if="draft.basis === 'month'"><input v-model="draftPrefs.average" type="checkbox">{{ tr('全天平均（娱乐）') }}</label>
          </div>
          <div class="fields">
          <label>{{ tr('主题') }}<select v-model="draftPrefs.theme"><option v-for="(name, theme) in themes" :key="theme" :value="theme">{{ tr(name) }}</option></select></label>
          <label>{{ tr('语言') }}<select v-model="draftPrefs.language"><option v-for="(name, locale) in languages" :key="locale" :value="locale">{{ name }}</option></select></label>
          </div>
          <details>
            <summary>{{ tr('角色管理器') }}</summary>
            <label><input v-model="draftPrefs.custom" type="checkbox" :disabled="!customDraft">{{ tr('使用导入角色') }}</label>
            <label>PNG / WebP<input type="file" accept=".png,.webp,image/png,image/webp" @change="fileChanged($event, false)"></label>
            <label>{{ tr('动作清单（可选）') }}<input type="file" accept=".json,application/json" @change="fileChanged($event, true)"></label>
            <button type="button" :disabled="importing || !imageFile" @click="importCharacter">{{ tr('预览导入') }}</button>
            <div v-if="customDraft" class="character-preview">
              <CustomSprite :character="customDraft" action="idle" :reduced="reduced" />
              <p>{{ customDraft.manifest.name }} · {{ customDraft.manifest.author }} · {{ customDraft.manifest.license }}</p>
              <button type="button" @click="customDraft = null; draftPrefs.custom = false">{{ tr('删除并恢复内置角色') }}</button>
            </div>
          </details>
          </fieldset>
          <p v-if="error" role="alert">{{ error }}</p>
          <footer class="settings-footer"><button type="submit" :disabled="importing">{{ tr('保存') }}</button><button type="button" @click="editing = false">{{ tr('返回') }}</button></footer>
        </form>
      </section>
    </template>
  </main>
</template>
