import assert from "node:assert/strict";
import test from "node:test";
import { recycleGridPosterImages } from "../js/ui/components/gridPosterRecycler.js";

function createMockCard({
  id = "1",
  index = 0,
  row = 0,
  col = 0,
  src = null,
  dataSrc = "https://example.com/poster.jpg",
  focused = false
} = {}) {
  const attributes = new Map();
  if (src) attributes.set("src", src);
  if (dataSrc) attributes.set("data-src", dataSrc);

  const classes = new Set(["seeall-card"]);
  if (focused) classes.add("focused");

  const image = {
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    removeAttribute(name) {
      attributes.delete(name);
    }
  };

  return {
    nodeType: 1,
    offsetWidth: 200,
    offsetHeight: 300,
    offsetLeft: col * 200,
    offsetTop: row * 300,
    classList: {
      contains(cls) {
        return classes.has(cls);
      }
    },
    querySelector(sel) {
      return sel === ".seeall-card-poster-image" ? image : null;
    },
    _image: image
  };
}

function createMockGrid({ cols = 4, rows = 10, focusedIndex = -1 } = {}) {
  const cards = [];
  let index = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cards.push(
        createMockCard({
          id: `card-${index}`,
          index,
          row: r,
          col: c,
          dataSrc: `https://example.com/poster-${index}.jpg`,
          focused: index === focusedIndex
        })
      );
      index += 1;
    }
  }

  const grid = {
    clientWidth: cols * 200,
    querySelectorAll(sel) {
      return sel === ".seeall-card" ? cards : [];
    }
  };

  return { grid, cards };
}

test("gridPosterRecycler hydrates cards within initial ±1.5 viewport window", () => {
  // 4 cols x 10 rows (40 cards total). Card height=300, row=0..9.
  // Viewport height = 600 (2 rows visible).
  // Initial scrollTop = 0.
  // Hydrate window: -900 to +1500 (covers top=0..1200, i.e. rows 0..4, cards 0..19).
  const { grid, cards } = createMockGrid({ cols: 4, rows: 10 });
  const shell = { clientHeight: 600, scrollTop: 0 };

  const result = recycleGridPosterImages({ shell, grid });
  assert.ok(result.hydrated > 0, "hydrated count should be > 0");

  // Rows 0..4 (indices 0..19) should have src set
  for (let i = 0; i < 20; i += 1) {
    assert.equal(
      cards[i]._image.getAttribute("src"),
      `https://example.com/poster-${i}.jpg`,
      `card ${i} should be hydrated`
    );
    assert.equal(cards[i]._image.getAttribute("data-src"), null);
  }

  // Row 8 (indices 32..35, top=2400) is far outside 1500 -> unhydrated
  assert.equal(cards[35]._image.getAttribute("src"), null);
  assert.equal(cards[35]._image.getAttribute("data-src"), "https://example.com/poster-35.jpg");
});

test("gridPosterRecycler releases distant cards when scrolled far down", () => {
  const { grid, cards } = createMockGrid({ cols: 4, rows: 20 });
  const shell = { clientHeight: 600, scrollTop: 0 };

  // Hydrate top portion first
  recycleGridPosterImages({ shell, grid });
  assert.ok(cards[0]._image.getAttribute("src"), "card 0 should initially have src");

  // Scroll down to row 16 (scrollTop = 4800).
  // Release threshold: 4800 - (600 * 2.5) = 3300.
  // Row 0..10 are below 3300 -> must be released (src removed, data-src restored).
  shell.scrollTop = 4800;
  const result = recycleGridPosterImages({ shell, grid });
  assert.ok(result.released > 0, "should have released distant cards");

  assert.equal(
    cards[0]._image.getAttribute("src"),
    null,
    "card 0 src must be removed on far scroll"
  );
  assert.equal(
    cards[0]._image.getAttribute("data-src"),
    "https://example.com/poster-0.jpg",
    "card 0 data-src must be restored"
  );
});

test("gridPosterRecycler always keeps focused card hydrated even when far outside viewport", () => {
  const { grid, cards } = createMockGrid({ cols: 4, rows: 20, focusedIndex: 0 });
  const shell = { clientHeight: 600, scrollTop: 4800 }; // shell scrolled far away

  recycleGridPosterImages({ shell, grid });

  // Card 0 is focused: must have src even though scrollTop is 4800
  assert.equal(
    cards[0]._image.getAttribute("src"),
    "https://example.com/poster-0.jpg",
    "focused card must remain hydrated"
  );
});

test("gridPosterRecycler handles null or missing arguments safely without throwing", () => {
  assert.deepEqual(recycleGridPosterImages(null), { hydrated: 0, released: 0 });
  assert.deepEqual(recycleGridPosterImages({ shell: null, grid: null }), {
    hydrated: 0,
    released: 0
  });
  assert.deepEqual(
    recycleGridPosterImages({
      shell: { clientHeight: 0, scrollTop: 0 },
      grid: { querySelectorAll: () => [] }
    }),
    { hydrated: 0, released: 0 }
  );
});
