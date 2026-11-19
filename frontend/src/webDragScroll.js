/**
 * Web only: lets a desktop mouse "swipe" the app like a phone.
 *  - click + drag scrolls the nearest scroll area in the drag direction (vertical lists AND sideways rows)
 *  - releasing keeps a little momentum, then paged carousels snap into place
 *  - a drag never counts as a tap, so products don't open by accident
 * Touch screens and the mouse wheel / trackpad keep their normal browser behaviour.
 */
export function enableDragScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  let drag = null; // current drag state
  let momentum = null; // requestAnimationFrame id
  let suppressClick = false;

  const canScroll = (el, axis) => {
    const cs = getComputedStyle(el);
    if (axis === 'y') return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    return /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
  };

  const findScroller = (start, axis) => {
    for (let el = start; el && el !== document.body; el = el.parentElement) {
      if (el instanceof HTMLElement && canScroll(el, axis)) return el;
    }
    return null;
  };

  const stopMomentum = () => {
    if (momentum) cancelAnimationFrame(momentum);
    momentum = null;
  };

  const restoreSnap = (el, snap) => {
    if (el) el.style.scrollSnapType = snap;
  };

  const onDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    stopMomentum();
    drag = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, lastT: performance.now(),
      vx: 0, vy: 0, target: e.target, axis: null, el: null, snap: '' };
  };

  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;

    if (!drag.axis) {
      const tx = e.clientX - drag.startX;
      const ty = e.clientY - drag.startY;
      if (Math.abs(tx) < 6 && Math.abs(ty) < 6) return; // still a tap
      const axis = Math.abs(tx) > Math.abs(ty) ? 'x' : 'y';
      const el = findScroller(drag.target, axis);
      if (!el) {
        drag = null;
        return;
      }
      drag.axis = axis;
      drag.el = el;
      drag.snap = el.style.scrollSnapType; // inline value to restore later
      drag.paged = getComputedStyle(el).scrollSnapType !== 'none'; // banner / image carousels
      el.style.scrollSnapType = 'none'; // follow the mouse freely, snap again on release
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    }

    const now = performance.now();
    const dt = Math.max(1, now - drag.lastT);
    if (drag.axis === 'x') {
      drag.el.scrollLeft -= dx;
      drag.vx = 0.8 * (-dx / dt) + 0.2 * drag.vx;
    } else {
      drag.el.scrollTop -= dy;
      drag.vy = 0.8 * (-dy / dt) + 0.2 * drag.vy;
    }
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastT = now;
    e.preventDefault();
  };

  const onUp = () => {
    if (!drag) return;
    const { el, axis, snap, paged } = drag;
    // px per ms, capped so a quick flick glides nicely but never flies off
    let v = Math.max(-2.5, Math.min(2.5, axis === 'x' ? drag.vx : drag.vy));
    const moved = !!axis;
    drag = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    if (!moved) return;

    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);

    restoreSnap(el, snap); // always give the element its own snapping back
    // paged carousels (banners, product images): let them snap to the nearest page instead of gliding
    if (paged) return;
    let last = performance.now();
    const step = (now) => {
      const dt = now - last;
      last = now;
      if (axis === 'x') el.scrollLeft += v * dt;
      else el.scrollTop += v * dt;
      v *= Math.pow(0.95, dt / 16); // friction
      if (Math.abs(v) > 0.02) momentum = requestAnimationFrame(step);
      else momentum = null;
    };
    if (Math.abs(v) > 0.05) momentum = requestAnimationFrame(step);
  };

  // A drag must not trigger the tap/press under the mouse
  const onClickCapture = (e) => {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const onWheel = () => stopMomentum();

  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, { capture: true, passive: false });
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
  window.addEventListener('click', onClickCapture, true);
  window.addEventListener('wheel', onWheel, { passive: true });

  return () => {
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    window.removeEventListener('click', onClickCapture, true);
    window.removeEventListener('wheel', onWheel);
    stopMomentum();
  };
}
