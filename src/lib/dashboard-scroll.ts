/** Desktop keeps nested `.dashboard-main` scroll; mobile uses the document. */
export function usesNestedDashboardScroll() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

export function scrollDashboardMainToTop() {
  if (usesNestedDashboardScroll()) {
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (main) main.scrollTop = 0;
    return;
  }
  window.scrollTo(0, 0);
}

export function scrollDashboardElementIntoView(
  el: HTMLElement,
  behavior: ScrollBehavior = "smooth"
) {
  const header =
    document.querySelector<HTMLElement>(".dashboard-main header") ??
    document.querySelector<HTMLElement>("header");
  const headerHeight = header?.offsetHeight ?? 0;

  if (usesNestedDashboardScroll()) {
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    if (!main) {
      el.scrollIntoView({ behavior, block: "start" });
      return;
    }
    const mainRect = main.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop =
      main.scrollTop + (elRect.top - mainRect.top) - headerHeight - 8;
    main.scrollTo({ top: Math.max(0, targetTop), behavior });
    return;
  }

  const elRect = el.getBoundingClientRect();
  const targetTop = window.scrollY + elRect.top - headerHeight - 8;
  window.scrollTo({ top: Math.max(0, targetTop), behavior });
}
