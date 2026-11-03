const { invoke } = window.__TAURI__.core;
const toggle = (close = false) => invoke('toggle_panel', { close }).catch(console.error);
const pet = document.querySelector('.pet');
let down;
pet?.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    down = { x: event.screenX, y: event.screenY };
    pet.setPointerCapture(event.pointerId);
});
pet?.addEventListener('pointermove', event => {
    if (!down || Math.hypot(event.screenX - down.x, event.screenY - down.y) < 6) return;
    down = undefined;
    pet.releasePointerCapture(event.pointerId);
    window.__TAURI__.window.getCurrentWindow().startDragging().catch(console.error);
});
pet?.addEventListener('pointerup', () => {
    if (down) toggle();
    down = undefined;
});
pet?.addEventListener('pointercancel', () => { down = undefined; });
pet?.addEventListener('click', event => { if (event.detail === 0) toggle(); });
document.querySelector('.close')?.addEventListener('click', () => toggle(true));
window.addEventListener('keydown', event => { if (event.key === 'Escape') toggle(true); });
