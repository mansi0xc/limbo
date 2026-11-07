export const THEME_KEY = "limbo-theme";

/** Runs before paint (inlined in <head>) so the saved theme never flashes. Dark is the default. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})();`;
