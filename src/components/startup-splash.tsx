import { PLATFORM_NAME } from "@/lib/brand";

/**
 * Inline dismiss: reveal the SSR page as soon as it can paint.
 * No React/hydration dependency and no artificial minimum display time.
 * Place at the end of <body> so the document (including page content) is already parsed.
 */
export const STARTUP_SPLASH_DISMISS_SCRIPT = `(function(){var s=document.getElementById("startup-splash");if(!s)return;function hide(){if(!s||s.dataset.done)return;s.dataset.done="1";s.classList.add("startup-splash--hide");var done=function(){if(s&&s.parentNode)s.parentNode.removeChild(s)};s.addEventListener("transitionend",done,{once:true});setTimeout(done,400)}requestAnimationFrame(function(){requestAnimationFrame(hide)})})();`;

/**
 * Startup splash is server-rendered into the first HTML byte stream with critical
 * CSS from the root layout. Display does not wait on JS.
 */
export function StartupSplash() {
  const rut = PLATFORM_NAME.slice(0, 3);
  const ina = PLATFORM_NAME.slice(3);

  return (
    <div id="startup-splash" className="startup-splash" aria-hidden="true">
      <div className="startup-splash__mark">
        <span className="startup-splash__word">
          {rut}
          <span className="startup-splash__accent">{ina}</span>
        </span>
        <span className="startup-splash__loader" />
      </div>
    </div>
  );
}
