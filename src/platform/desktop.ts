interface DesktopBridge {
  core: { invoke: (command: string, args?: Record<string, unknown>) => Promise<void> };
  window: { getCurrentWindow: () => { startDragging: () => Promise<void> } };
  event: { listen: <T>(name: string, callback: (event: { payload: T }) => void) => Promise<() => void> };
}
const bridge = (window as Window & { __TAURI__?: DesktopBridge }).__TAURI__;
const surface = new URLSearchParams(location.search).get('surface');
export const desktopPet = !!bridge && surface === 'pet';
export const desktopPanel = !!bridge && surface === 'panel';
export const panel = (close: boolean) => bridge?.core.invoke('toggle_panel', { close });
export const setTopmost = (enabled: boolean) => bridge?.core.invoke('set_topmost', { enabled });
export const dragPet = () => bridge?.window.getCurrentWindow().startDragging();
export const resizePet = (scale: number) => bridge?.core.invoke('set_pet_size', { scale });
export const setStartup = (enabled: boolean) => bridge?.core.invoke('set_startup', { enabled });
export const openPetMenu = () => bridge?.core.invoke('open_pet_menu');
export const onDesktopEvent = <T>(name: string, callback: (value: T) => void) =>
  bridge?.event.listen<T>(name, event => callback(event.payload));
