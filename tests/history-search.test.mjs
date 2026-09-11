import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import searchCore from "../search-core.js";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

// Run both real UI scripts with a minimal DOM and a controllable browser API.
class Element {
  constructor(tag = "div") {
    this.tagName = tag;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.value = "";
    this._text = "";
  }
  set textContent(value) { this._text = value; this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(" "); }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatchEvent(event) { return Promise.all((this.listeners[event.type] || []).map((cb) => cb(event))); }
  focus() {}
  scrollIntoView() {}
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
}
function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
async function setup(file) {
  const documentElement = new Element();
  const root = documentElement.appendChild(new Element());
  root.id = "search-root";
  const timers = new Map();
  let nextTimer = 0;
  const pending = [];
  const messages = [];
  let closed = false;
  const context = vm.createContext({
    console, URL, URLSearchParams, Event,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    document: {
      documentElement, head: new Element(),
      createElement: (tag) => new Element(tag),
      getElementById: (id) => descendants(documentElement).find((node) => node.id === id) || null
    },
    location: { search: "" },
    addEventListener() {},
    close() { closed = true; },
    chrome: {
      storage: { local: { get: async () => ({}) } },
      runtime: {
        getURL: (file) => `chrome-extension://test/${file}`,
        onMessage: { addListener() {} },
        sendMessage(message) {
          messages.push(message);
          if (["search-history", "preview-batch-tabs"].includes(message.type)) {
            return new Promise((resolve, reject) => pending.push({ message, resolve, reject }));
          }
          return Promise.resolve({ ok: true, tabs: [{ id: 1, title: "Open tab", url: "https://open.test" }] });
        }
      }
    }
  });
  context.window = context;
  for (const script of ["i18n.js", "search-core.js", file]) vm.runInContext(read(script), context, { filename: script });
  if (file === "content.js") await vm.runInContext("openTabSearch()", context);
  await flush();
  const nodes = () => descendants(documentElement);
  const input = nodes().find((node) => node.name === "ai-tab-organizer-search");
  assert.ok(input);
  const badge = nodes().find((node) => node.attributes["aria-label"] === "退出历史记录搜索");
  return {
    input, badge, pending, messages, nodes, context,
    text: () => documentElement.textContent,
    closed: () => closed || !nodes().includes(input),
    async type(value) { input.value = value; await input.dispatchEvent(new Event("input")); },
    async key(key) { await input.dispatchEvent({ type: "keydown", key, preventDefault() {}, stopPropagation() {} }); },
    async tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((cb) => cb()); await flush(); },
    async resolve(index, response) { pending[index].resolve(response); await flush(); }
  };
}

const result = (title, url = "https://history.test/page") => ({ ok: true, items: [{ id: "5", title, url, lastVisitTime: 100 }] });

test("history prefix requires a space and preserves pasted keywords", () => {
  assert.equal(searchCore.parseHistoryQuery("history"), null);
  assert.equal(searchCore.parseHistoryQuery("historybook test"), null);
  assert.equal(searchCore.parseHistoryQuery("https://example.com/history foo"), null);
  assert.equal(searchCore.parseHistoryQuery("history "), "");
  assert.equal(searchCore.parseHistoryQuery("HiStOrY  咖啡 docs"), "咖啡 docs");
});

test("history results are recent first, openable and have no tab mutation actions", () => {
  const entries = searchCore.buildHistoryEntries([
    { id: "1", url: "https://old.test", lastVisitTime: 1 },
    { id: "2", title: "Recent", url: "https://recent.test", lastVisitTime: 2 },
    { id: "3", url: "javascript:alert(1)" }
  ]);
  assert.deepEqual(entries.map((item) => item.id), ["history-2", "history-1"]);
  assert.equal(entries[1].title, "https://old.test");
  assert.equal(searchCore.supportsActions(entries[0]), false);
});

for (const file of ["content.js", "search.js"]) {
  test(`${file}: enter history, search, open result with Enter`, async () => {
    const ui = await setup(file);
    await ui.type("history");
    await ui.tick();
    assert.equal(ui.pending.length, 0);
    await ui.type("history ");
    assert.equal(ui.input.value, "");
    assert.equal(ui.badge.style.display, "inline-flex");
    assert.equal(ui.input.placeholder, "搜索历史记录");
    await ui.tick();
    assert.equal(ui.pending[0].message.query, "");
    await ui.resolve(0, result("Recent visit"));
    assert.match(ui.text(), /Recent visit/);
    await ui.type("咖啡");
    await ui.tick();
    assert.equal(ui.pending[1].message.query, "咖啡");
    await ui.resolve(1, result("Coffee history"));
    assert.doesNotMatch(ui.text(), /Recent visit|自然语言智能搜索|收藏并关闭/);
    await ui.key("Enter");
    assert.equal(ui.messages.at(-1).type, "open-url");
    assert.equal(ui.messages.at(-1).url, "https://history.test/page");
    assert.equal(ui.closed(), true);
  });

  test(`${file}: paste prefix, debounce and ignore out-of-order results`, async () => {
    const ui = await setup(file);
    await ui.type("history old");
    assert.equal(ui.input.value, "old");
    await ui.tick();
    await ui.type("new");
    await ui.type("newest");
    await ui.resolve(0, result("Stale result"));
    assert.doesNotMatch(ui.text(), /Stale result/);
    await ui.tick();
    assert.equal(ui.pending.length, 2);
    assert.equal(ui.pending[1].message.query, "newest");
    await ui.resolve(1, result("Current result"));
    assert.match(ui.text(), /Current result/);
    await ui.type("history pending");
    await ui.tick();
    await ui.key("Escape");
    await ui.resolve(2, result("Late result"));
    assert.equal(ui.badge.style.display, "none");
    assert.equal(ui.input.value, "history pending");
    assert.equal(ui.closed(), false);
    assert.doesNotMatch(ui.text(), /Late result/);
  });

  test(`${file}: empty/error states, retry, Backspace and badge exit`, async () => {
    const ui = await setup(file);
    await ui.type("history missing");
    await ui.tick();
    await ui.resolve(0, { ok: true, items: [] });
    assert.match(ui.text(), /没有匹配的历史记录/);
    await ui.key("Enter");
    assert.equal(ui.messages.at(-1).type, "search-history");
    await ui.type("error");
    await ui.tick();
    ui.pending[1].reject(new Error("Extension context invalidated"));
    await flush();
    assert.match(ui.text(), /历史记录搜索失败/);
    assert.ok(ui.nodes().find((node) => node.attributes.role === "alert"));
    await ui.type("retry");
    await ui.tick();
    await ui.resolve(2, result("Recovered"));
    assert.match(ui.text(), /Recovered/);
    await ui.badge.dispatchEvent(new Event("click"));
    assert.equal(ui.badge.style.display, "none");
    await ui.type("history ");
    await ui.key("Backspace");
    await ui.tick();
    assert.equal(ui.badge.style.display, "none");
    assert.match(ui.text(), /Open tab/);
    assert.equal(ui.pending.length, 3);
  });

  test(`${file}: pending natural search cannot overwrite history mode`, async () => {
    const ui = await setup(file);
    await ui.type("find pages");
    const natural = ui.nodes().find((node) => node.tagName === "div" && node._text === "自然语言智能搜索");
    const click = natural.parent.parent.parent.dispatchEvent(new Event("click"));
    await flush();
    assert.equal(ui.pending[0].message.type, "preview-batch-tabs");
    await ui.type("history docs");
    await ui.resolve(0, { ok: true, preview: { tabs: [{ id: 9, title: "Old AI response", url: "https://ai.test" }] } });
    await click;
    await ui.tick();
    await ui.resolve(1, result("History docs"));
    assert.equal(ui.badge.style.display, "inline-flex");
    assert.match(ui.text(), /History docs/);
    assert.doesNotMatch(ui.text(), /Old AI response/);
  });
}

test("background searches all retained history and propagates API failures", async () => {
  const noopEvent = { addListener() {} };
  const queries = [];
  const chrome = {
    runtime: { onInstalled: noopEvent, onStartup: noopEvent, onMessage: noopEvent },
    storage: { onChanged: noopEvent }, alarms: { onAlarm: noopEvent }, commands: { onCommand: noopEvent },
    history: { search: async (query) => { queries.push(query); return [{ id: "old", lastVisitTime: 1 }]; } }
  };
  const context = vm.createContext({ chrome, console, AITabI18n: { t: (_locale, key) => key } });
  vm.runInContext(read("background.js").replace(/^import[\s\S]*?;\n/gm, ""), context);
  const response = await vm.runInContext('handleRuntimeMessage({ type: "search-history", query: "  docs  " })', context);
  assert.equal(response.ok, true);
  assert.equal(response.items[0].id, "old");
  assert.equal(queries[0].text, "docs");
  assert.equal(queries[0].startTime, 0);
  assert.equal(queries[0].maxResults, 100);
  chrome.history.search = async () => { throw new Error("Permission denied"); };
  await assert.rejects(vm.runInContext('handleRuntimeMessage({ type: "search-history", query: "" })', context), /Permission denied/);
  assert.ok(JSON.parse(read("manifest.json")).permissions.includes("history"));
});
