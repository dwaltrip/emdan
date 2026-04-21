interface StoreConfig<State, Derived = {}> {
  initialState: State;
  // NOTE: `derive` lives in the lib to enforce sequencing — derived state is
  // always fresh before onChange fires, without the caller having to manage it.
  derive?: (state: State) => Derived;
  onChange?: (merged: State & Derived) => void;
}

// NOTE: Calling multiple actions sequentially will run the full pipeline after each one.
// If we find this is a performance bottleneck, we can implement a way to batch updates.
function createStore<State, Derived = {}>(config: StoreConfig<State, Derived>) {
  let state = config.initialState;
  let derived = (config.derive ? config.derive(state) : {}) as Derived;
  let version = 0;
  const subscribers = new Set<() => void>();

  function getMerged(): State & Derived {
    return { ...state, ...derived } as State & Derived;
  }

  function runLifecycle(nextVersion: number): void {
    if (config.derive) {
      derived = config.derive(state);
      warnDerivedKeyCollisions(state, derived);
    }
    config.onChange?.(getMerged());
    version = nextVersion;
    for (const cb of subscribers) {
      cb();
    }
  }

  // TODO: Guard against re-entrancy — if a subscriber calls an action during
  // runLifecycle, it would recurse. The wrapper could warn/error if a cycle
  // is already in progress.
  function makeAction<Args extends unknown[], R>(
    fn: (state: State, ...args: Args) => R,
  ): (...args: Args) => R {
    return (...args: Args) => {
      const result = fn(state, ...args);
      runLifecycle(version + 1);
      return result;
    };
  }

  // TODO: Throw an error on state writes outside of mutate/makeAction.
  function mutate(fn: (state: State) => void): void {
    fn(state);
    runLifecycle(version + 1);
  }

  function subscribe(cb: () => void): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  function reset(newState: State): void {
    state = newState;
    runLifecycle(0);
  }

  return {
    get state() {
      return state;
    },
    get derived() {
      return derived;
    },
    get version() {
      return version;
    },
    makeAction,
    mutate,
    subscribe,
    reset,
  };
}

function warnDerivedKeyCollisions<State, Derived>(state: State, derived: Derived): void {
  if (derived && typeof derived === 'object') {
    const stateKeys = Object.keys(state as object);
    const derivedKeys = Object.keys(derived as object);
    for (const key of derivedKeys) {
      if (stateKeys.includes(key)) {
        console.warn(
          `[createStore] Derived key "${key}" collides with a state key. ` +
            `The derived value will overwrite the state value in the merged object.`,
        );
      }
    }
  }
}

export type { StoreConfig };
export { createStore };
