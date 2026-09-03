const HYDRATE_MARGIN_VIEWPORTS = 1.5;
const RELEASE_MARGIN_VIEWPORTS = 2.5;

function number(value, fallback = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isFocused(card) {
  return Boolean(card?.classList?.contains?.("focused"));
}

function sourceForImage(image) {
  return String(
    image?.getAttribute?.("data-src") ||
      image?.getAttribute?.("data-lazy-src") ||
      image?.getAttribute?.("src") ||
      ""
  ).trim();
}

function measureGrid(grid, cards) {
  const first = cards[0] || null;
  if (!first) return null;
  const cardWidth = number(first.offsetWidth);
  const cardHeight = number(first.offsetHeight);
  if (!cardWidth || !cardHeight) return null;

  const second = cards[1] || null;
  const horizontalPitch = Math.abs(number(second?.offsetLeft) - number(first.offsetLeft));
  const columnPitch = horizontalPitch > cardWidth / 2 ? horizontalPitch : cardWidth;
  const columns = Math.max(1, Math.round(number(grid.clientWidth) / columnPitch));
  const nextRow = cards[columns] || null;
  const measuredRowPitch = Math.abs(number(nextRow?.offsetTop) - number(first.offsetTop));
  return {
    columns,
    cardHeight,
    firstTop: number(first.offsetTop),
    rowPitch: measuredRowPitch > cardHeight / 2 ? measuredRowPitch : cardHeight
  };
}

/**
 * Keeps images near a uniform poster grid decoded and returns remote cards to
 * data-src. It reads only constant grid geometry; it deliberately does not
 * call getBoundingClientRect() for every card on each scroll event.
 */
export function recycleGridPosterImages(options = {}) {
  const {
    shell,
    grid,
    cardSelector = ".seeall-card",
    imageSelector = ".seeall-card-poster-image"
  } = options || {};
  if (!shell || !grid || typeof grid.querySelectorAll !== "function") {
    return { hydrated: 0, released: 0 };
  }
  const cards = Array.from(grid.querySelectorAll(cardSelector));
  const metrics = measureGrid(grid, cards);
  const viewportHeight = number(shell.clientHeight);
  if (!metrics || !viewportHeight) {
    return { hydrated: 0, released: 0 };
  }

  const scrollTop = number(shell.scrollTop);
  const hydrateStart = scrollTop - viewportHeight * HYDRATE_MARGIN_VIEWPORTS;
  const hydrateEnd = scrollTop + viewportHeight * (1 + HYDRATE_MARGIN_VIEWPORTS);
  const releaseStart = scrollTop - viewportHeight * RELEASE_MARGIN_VIEWPORTS;
  const releaseEnd = scrollTop + viewportHeight * (1 + RELEASE_MARGIN_VIEWPORTS);
  let hydrated = 0;
  let released = 0;

  cards.forEach((card, index) => {
    const image = card.querySelector?.(imageSelector) || null;
    const source = sourceForImage(image);
    if (!image || !source) return;
    const row = Math.floor(index / metrics.columns);
    const top = metrics.firstTop + row * metrics.rowPitch;
    const bottom = top + metrics.cardHeight;
    const nearby = isFocused(card) || (bottom >= hydrateStart && top <= hydrateEnd);
    if (nearby) {
      if (!image.getAttribute("src")) {
        image.setAttribute("src", source);
        image.setAttribute("data-lazy-src", source);
        image.removeAttribute("data-src");
        hydrated += 1;
      }
      return;
    }
    const distant = bottom < releaseStart || top > releaseEnd;
    if (distant && image.getAttribute("src")) {
      image.removeAttribute("src");
      image.setAttribute("data-src", source);
      released += 1;
    }
  });

  return { hydrated, released };
}
