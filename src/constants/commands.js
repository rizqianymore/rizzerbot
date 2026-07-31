import { commands } from "@/src/core/loader.js";

export function getOwnerCommands() {
  const set = new Set();
  for (const [key, cmd] of commands.entries()) {
    if (cmd && (cmd.ownerOnly || cmd.category?.toLowerCase() === "owner")) {
      set.add(key);
    }
  }
  return set;
}

export function getPremiumCommands() {
  const set = new Set();
  for (const [key, cmd] of commands.entries()) {
    if (cmd && (cmd.premiumOnly || ["downloader", "media", "osint"].includes(cmd.category?.toLowerCase()))) {
      set.add(key);
    }
  }
  return set;
}

export function getUserCommands() {
  const set = new Set();
  for (const [key, cmd] of commands.entries()) {
    if (cmd && !cmd.ownerOnly && !cmd.premiumOnly && cmd.category?.toLowerCase() === "user") {
      set.add(key);
    }
  }
  return set;
}

export function getCaseCommands() {
  return new Set(commands.keys());
}

export function getAliasesMap() {
  const map = {};
  for (const [key, cmd] of commands.entries()) {
    if (cmd && cmd.name && cmd.name.toLowerCase() !== key) {
      map[key] = cmd.name.toLowerCase();
    }
  }
  return map;
}

export const ownerCommands = new Proxy(new Set(), {
  get(target, prop, receiver) {
    const set = getOwnerCommands();
    if (typeof set[prop] === "function") {
      return set[prop].bind(set);
    }
    return Reflect.get(set, prop, receiver);
  },
});

export const premiumCommands = new Proxy(new Set(), {
  get(target, prop, receiver) {
    const set = getPremiumCommands();
    if (typeof set[prop] === "function") {
      return set[prop].bind(set);
    }
    return Reflect.get(set, prop, receiver);
  },
});

export const userCommands = new Proxy(new Set(), {
  get(target, prop, receiver) {
    const set = getUserCommands();
    if (typeof set[prop] === "function") {
      return set[prop].bind(set);
    }
    return Reflect.get(set, prop, receiver);
  },
});

export const caseCommands = new Proxy(new Set(), {
  get(target, prop, receiver) {
    const set = getCaseCommands();
    if (typeof set[prop] === "function") {
      return set[prop].bind(set);
    }
    return Reflect.get(set, prop, receiver);
  },
});

export const aliasesMap = new Proxy({}, {
  get(target, prop, receiver) {
    const map = getAliasesMap();
    return Reflect.get(map, prop, receiver);
  },
});
