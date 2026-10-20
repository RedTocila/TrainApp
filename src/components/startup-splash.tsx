"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

/**
 * Paints the brand splash from the first HTML bytes and removes it when the
 * real screen is in the document — without waiting for the React bundle.
 * On the native shell it also hides the Capacitor splash at that moment.
 */
const SPLASH_BOOT = `(function(){
  if(document.getElementById("startup-splash"))return;
  var splash=document.createElement("div");
  splash.id="startup-splash";
  splash.setAttribute("aria-hidden","true");
  splash.style.cssText="position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:#f80213;pointer-events:none;opacity:1";
  var mark=document.createElement("img");
  mark.src="/brand/mark.png";
  mark.alt="";
  mark.style.cssText="width:min(46vw,12.5rem);height:auto;display:block";
  splash.appendChild(mark);
  document.documentElement.appendChild(splash);
  var revealed=false;
  var observer=null;
  function nativeCap(){
    try{
      var cap=window.Capacitor;
      if(!cap||!cap.isNativePlatform||!cap.isNativePlatform())return null;
      return cap;
    }catch(e){return null}
  }
  function hideNative(){
    var cap=nativeCap();
    if(!cap||typeof cap.nativePromise!=="function")return;
    cap.nativePromise("SplashScreen","hide",{fadeOutDuration:200}).catch(function(){});
  }
  function reveal(force){
    if(revealed)return;
    var ready=document.querySelector("[data-app-ready]");
    var parsed=document.readyState!=="loading";
    if(!force&&!ready&&!parsed)return;
    revealed=true;
    if(observer)observer.disconnect();
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var native=!!nativeCap()||/RutinaApp/.test(navigator.userAgent||"");
        if(native){
          splash.remove();
          hideNative();
          var tries=0;
          var timer=setInterval(function(){
            hideNative();
            if(++tries>20)clearInterval(timer);
          },100);
          return;
        }
        var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if(reduce){splash.remove();return}
        splash.style.transition="opacity 280ms cubic-bezier(0.22,1,0.36,1)";
        splash.style.opacity="0";
        setTimeout(function(){splash.remove()},280);
      });
    });
  }
  observer=new MutationObserver(function(){reveal(false)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){reveal(false)});
  else reveal(false);
  setTimeout(function(){reveal(true)},12000);
})();`;

export function StartupSplash() {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: SPLASH_BOOT }} />;
  });

  return null;
}
