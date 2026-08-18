import assert from "node:assert/strict";
import test from "node:test";

globalThis.HTMLElement = globalThis.HTMLElement || class HTMLElement {};

import { CatalogSeeAllScreen } from "./catalogSeeAllScreen.js";

function createMockClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add(cls) {
      classes.add(cls);
    },
    remove(cls) {
      classes.delete(cls);
    },
    contains(cls) {
      return classes.has(cls);
    }
  };
}

function createMockCard(id, row, col, index) {
  const card = Object.create(globalThis.HTMLElement.prototype);
  Object.assign(card, {
    nodeType: 1,
    dataset: {
      action: "openDetail",
      focusKey: `item:${id}`,
      itemId: id,
      itemIndex: String(index),
      navRow: String(row),
      navCol: String(col)
    },
    classList: createMockClassList(["seeall-card", "focusable"]),
    focusCalled: 0,
    focus() {
      this.focusCalled += 1;
    },
    isConnected: true,
    offsetLeft: col * 200,
    offsetWidth: 180,
    offsetTop: row * 200,
    offsetHeight: 180
  });
  return card;
}

function createMockShell() {
  const shell = Object.create(globalThis.HTMLElement.prototype);
  Object.assign(shell, {
    scrollHeight: 1000,
    clientHeight: 500,
    scrollTop: 0
  });
  return shell;
}

test("CatalogSeeAllScreen focusNode updates focused element without full DOM scans", () => {
  const card1 = createMockCard("m1", 0, 0, 0);
  const card2 = createMockCard("m2", 0, 1, 1);
  const shell = createMockShell();
  const allCards = [card1, card2];

  const container = {
    contains(node) {
      return allCards.includes(node);
    },
    querySelector(selector) {
      if (selector === ".seeall-shell") {
        return shell;
      }
      if (selector === ".seeall-card.focusable.focused") {
        return allCards.find((c) => c.classList.contains("focused")) || null;
      }
      return null;
    }
  };

  CatalogSeeAllScreen.container = container;
  CatalogSeeAllScreen.focusedElement = null;

  CatalogSeeAllScreen.focusNode(card1);
  assert.equal(card1.classList.contains("focused"), true);
  assert.equal(CatalogSeeAllScreen.focusedElement, card1);
  assert.equal(CatalogSeeAllScreen.lastFocusedKey, "item:m1");

  CatalogSeeAllScreen.focusNode(card2);
  assert.equal(card1.classList.contains("focused"), false);
  assert.equal(card2.classList.contains("focused"), true);
  assert.equal(CatalogSeeAllScreen.focusedElement, card2);
  assert.equal(CatalogSeeAllScreen.lastFocusedKey, "item:m2");
});

test("CatalogSeeAllScreen handleGridDpad respects boundaries and navigates grid", () => {
  const r0c0 = createMockCard("a", 0, 0, 0);
  const r0c1 = createMockCard("b", 0, 1, 1);
  const r1c0 = createMockCard("c", 1, 0, 2);
  const r1c1 = createMockCard("d", 1, 1, 3);
  const shell = createMockShell();
  const allCards = [r0c0, r0c1, r1c0, r1c1];

  const container = {
    contains(node) {
      return allCards.includes(node);
    },
    querySelector(selector) {
      if (selector === ".seeall-shell") {
        return shell;
      }
      if (selector === ".seeall-card.focusable.focused") {
        return allCards.find((c) => c.classList.contains("focused")) || null;
      }
      return null;
    }
  };

  CatalogSeeAllScreen.container = container;
  CatalogSeeAllScreen.focusedElement = null;
  CatalogSeeAllScreen.navModel = {
    rows: [
      [r0c0, r0c1],
      [r1c0, r1c1]
    ]
  };

  CatalogSeeAllScreen.focusNode(r0c0);

  // Press Left at col 0 -> should not move
  let handled = CatalogSeeAllScreen.handleGridDpad({ keyCode: 37, preventDefault() {} });
  assert.equal(handled, true);
  assert.equal(CatalogSeeAllScreen.focusedElement, r0c0);

  // Press Right -> moves to r0c1
  handled = CatalogSeeAllScreen.handleGridDpad({ keyCode: 39, preventDefault() {} });
  assert.equal(handled, true);
  assert.equal(CatalogSeeAllScreen.focusedElement, r0c1);

  // Press Down -> moves to r1c1
  handled = CatalogSeeAllScreen.handleGridDpad({ keyCode: 40, preventDefault() {} });
  assert.equal(handled, true);
  assert.equal(CatalogSeeAllScreen.focusedElement, r1c1);

  // Press Up -> moves back to r0c1
  handled = CatalogSeeAllScreen.handleGridDpad({ keyCode: 38, preventDefault() {} });
  assert.equal(handled, true);
  assert.equal(CatalogSeeAllScreen.focusedElement, r0c1);

  // A previously visited destination column must not pull vertical focus
  // sideways. Up/Down remains aligned with the card currently focused.
  CatalogSeeAllScreen.focusNode(r1c0);
  CatalogSeeAllScreen.focusNode(r0c1);
  handled = CatalogSeeAllScreen.handleGridDpad({ keyCode: 40, preventDefault() {} });
  assert.equal(handled, true);
  assert.equal(CatalogSeeAllScreen.focusedElement, r1c1);
});
