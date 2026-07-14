/**
 * Scroll an element horizontally inside its overflow-x parent only.
 * Avoids Element.scrollIntoView, which also scrolls vertical ancestors
 * (e.g. .dashboard-main) and lands users mid-page.
 */
export function scrollElementIntoHorizontalView(
  element: HTMLElement,
  options?: {
    behavior?: ScrollBehavior;
    inline?: "start" | "center" | "end";
    scroller?: HTMLElement | null;
  }
) {
  const scroller =
    options?.scroller ??
    element.closest<HTMLElement>(
      "[data-horizontal-scroll], .overflow-x-auto, .overflow-x-scroll"
    );
  if (!scroller) return;

  const behavior = options?.behavior ?? "smooth";
  const inline = options?.inline ?? "center";

  const scrollerRect = scroller.getBoundingClientRect();
  const elRect = element.getBoundingClientRect();
  let nextLeft = scroller.scrollLeft + (elRect.left - scrollerRect.left);

  if (inline === "center") {
    nextLeft -= (scroller.clientWidth - elRect.width) / 2;
  } else if (inline === "end") {
    nextLeft -= scroller.clientWidth - elRect.width;
  }

  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  scroller.scrollTo({
    left: Math.max(0, Math.min(nextLeft, max)),
    behavior,
  });
}
