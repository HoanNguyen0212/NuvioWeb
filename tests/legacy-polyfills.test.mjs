import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../nuvio-legacy-polyfills.js", import.meta.url), "utf8");

test("legacy polyfills cover the Chrome 53 startup requirements", () => {
  const context = {
    clearTimeout,
    console,
    MutationObserver: undefined,
    Promise,
    setTimeout,
    Symbol
  };
  context.window = context;
  context.document = {
    documentElement: {
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 1, height: 1 };
      }
    },
    addEventListener() {}
  };

  // Model Chrome 53: URLSearchParams exists, but a plain record is not accepted.
  context.URLSearchParams = function FakeURLSearchParams() {
    this.items = [];
  };
  context.URLSearchParams.prototype.append = function append(key, value) {
    this.items.push([String(key), String(value)]);
  };
  context.URLSearchParams.prototype.get = function get(key) {
    const match = this.items.find((entry) => entry[0] === key);
    return match ? match[1] : null;
  };

  vm.createContext(context);
  vm.runInContext(
    "delete Object.fromEntries; delete Array.prototype.flat; delete Array.prototype.flatMap;" +
      "delete String.prototype.replaceAll; delete String.prototype.trimStart;" +
      "delete String.prototype.trimEnd; this.globalThis = undefined;",
    context
  );
  vm.runInContext(source, context);

  const results = vm.runInContext(
    `(() => {
      const iterable = {};
      iterable[Symbol.iterator] = () => {
        let index = 0;
        const values = [["a", 1], ["b", 2]];
        return { next: () => index < values.length
          ? { done: false, value: values[index++] }
          : { done: true } };
      };
      const params = new URLSearchParams({ a: "1", b: "two" });
      return {
        globalThis: globalThis === window,
        entries: Object.fromEntries(iterable).b === 2,
        flat: JSON.stringify([1, [2, [3]]].flat(2)) === "[1,2,3]",
        flatMap: JSON.stringify([1, 2].flatMap((value) => [value, value + 1])) === "[1,2,2,3]",
        replaceAll: "a-b-a".replaceAll("a", "x") === "x-b-x",
        trim: "  x  ".trimStart().trimEnd() === "x",
        params: params.get("a") === "1" && params.get("b") === "two",
        instance: params instanceof URLSearchParams
      };
    })()` ,
    context
  );

  assert.deepEqual({ ...results }, {
    globalThis: true,
    entries: true,
    flat: true,
    flatMap: true,
    replaceAll: true,
    trim: true,
    params: true,
    instance: true
  });
});
