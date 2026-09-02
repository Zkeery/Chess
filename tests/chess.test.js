const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function createRuntime(loadPlay) {
  const context = {
    console,
    clearTimeout,
    setTimeout,
    alert() {},
    confirm() { return true; },
    Image: function Image() {},
    window: {},
    document: {
      cookie: "",
      getElementById() {
        return { getContext() { return {}; } };
      },
      getElementsByTagName() {
        return [{ style: {} }];
      }
    },
    play: {}
  };
  vm.createContext(context);
  const common = fs.readFileSync(path.join(root, "js/common.js"), "utf8")
    .replace(/com\.init\(\);\s*$/, "");
  vm.runInContext(common, context, { filename: "common.js" });
  if (loadPlay) {
    vm.runInContext(fs.readFileSync(path.join(root, "js/play.js"), "utf8"), context, {
      filename: "play.js"
    });
  }
  return context;
}

function emptyMap() {
  return Array.from({ length: 10 }, () => Array(9));
}

test("horse-leg checks use the searched board, not play.map", () => {
  const context = createRuntime(false);
  const { com, play } = context;
  com.mans = {};
  com.childList = [];
  com.createMans(com.initMap);

  play.map = com.arr2Clone(com.initMap);
  play.map[1][1] = "blocker";
  com.mans.blocker = { my: -1 };

  const moves = com.bylaw.m(1, 0, com.arr2Clone(com.initMap), -1);
  assert.deepEqual(Array.from(moves, point => Array.from(point)), [[2, 2], [0, 2]]);
});

test("a move exposing flying generals is rejected", () => {
  const context = createRuntime(false);
  const { com, play } = context;
  const map = emptyMap();
  map[9][4] = "j0";
  map[0][4] = "J0";
  map[5][4] = "c0";

  com.mans = {
    j0: new com.class.Man("j0"),
    J0: new com.class.Man("J0"),
    c0: new com.class.Man("c0")
  };
  play.map = map;
  for (const [key, x, y] of [["j0", 4, 9], ["J0", 4, 0], ["c0", 4, 5]]) {
    com.mans[key].x = x;
    com.mans[key].y = y;
  }

  const moves = com.getLegalMoves(map, "c0", 4, 5);
  assert.equal(moves.some(point => point[0] === 3 && point[1] === 5), false);
  assert.equal(map[5][4], "c0", "legality checking must restore the board");
});

test("regret rebuilds a challenge from its own initial map", () => {
  const context = createRuntime(true);
  const { com, play } = context;
  const challenge = emptyMap();
  challenge[0][4] = "J0";
  challenge[5][4] = "c0";
  challenge[9][4] = "j0";

  com.mans = {};
  com.childList = [];
  com.createMans(challenge);
  com.pane = { isShow: false };
  com.show = function () {};
  play.nowMap = challenge;
  play.map = com.arr2Clone(challenge);
  play.pace = [];
  play.isThinking = false;

  assert.doesNotThrow(() => play.regret());
  assert.deepEqual(JSON.parse(JSON.stringify(play.map)), JSON.parse(JSON.stringify(challenge)));
});

test("pending AI work locks input and can be cancelled", () => {
  const { play } = createRuntime(true);
  play.gameId = 1;
  play.isPlay = true;
  play.scheduleAI();
  assert.equal(play.isThinking, true);
  assert.ok(play.pendingAI);
  play.cancelPendingAI();
  assert.equal(play.isThinking, false);
  assert.equal(play.pendingAI, null);
});
