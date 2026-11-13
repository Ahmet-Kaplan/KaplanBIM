/**
 * Presentation in a headset (`src/xr/presentation.ts`), tested against browsers
 * that do not have one.
 *
 * There is no headset here and jest's jsdom has no `navigator.xr`, so what is
 * tested is exactly the half a device is not needed for: the three states a
 * browser can be in and what is offered in each, the arguments the browser is
 * asked with, what a refusal leaves behind (a walker that is not moving and no
 * half-started session), what ending a session gives back, and how a
 * controller's thumbstick becomes the walker's four keys.
 *
 * What a headset actually shows — the stereo frame, the head pose three.js
 * applies, whether the floor is where the runtime says — cannot be tested here
 * and is not claimed. It is listed in the task report.
 */
import { buildColliderWorld, type ColliderBox } from "@permitzip/bim-geometry";
import { WALK_EYE_HEIGHT_M, Walker } from "../src/walkthrough";
import {
  Presentation,
  XR_MODE,
  XR_REFERENCE_SPACE,
  XR_SESSION_INIT,
  XR_THUMBSTICK_DEADZONE,
  createPresentationEntry,
  presentationSupported,
  thumbstickKeys,
  xrSystem,
  type PresentationEntry,
  type PresentationHost,
  type Translate,
  type XrInputSourceLike,
  type XrSessionLike,
  type XrSystemLike,
} from "../src/xr/presentation";

/** A slab 16 m across at y = 0: somewhere to stand while a controller drives the walker. */
const SLAB: ColliderBox = { center: [0, -0.1, 0], half: [8, 0.1, 8], yaw: 0, floor: true };

function walkerAt(x = 0, z = 0, yaw = 0): Walker {
  const walker = new Walker({ x, z, yaw, eyeY: WALK_EYE_HEIGHT_M });
  walker.setScene({ collider: buildColliderWorld([SLAB]), groundY: 0 });
  return walker;
}

/** A session the browser would hand back, with a hand controller whose axes a test can set. */
class FakeSession implements XrSessionLike {
  inputSources: readonly XrInputSourceLike[] = [];
  readonly spacesAsked: string[] = [];
  ended = false;
  /** What `requestReferenceSpace` does: resolve a floor, or refuse one. */
  referenceSpaceFails = false;
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  requestReferenceSpace(type: string): Promise<unknown> {
    this.spacesAsked.push(type);
    return this.referenceSpaceFails ? Promise.reject(new Error("this browser has no floor")) : Promise.resolve({ type });
  }

  end(): Promise<void> {
    this.ended = true;
    for (const listener of this.listeners.get("end") ?? []) listener();
    return Promise.resolve();
  }

  /** The headset taken off, or its own menu used: the browser ends the session without being asked. */
  endFromDevice(): void {
    this.ended = true;
    for (const listener of this.listeners.get("end") ?? []) listener();
  }
}

/** A browser that can be asked, answering however the test wants. */
function fakeXr(options: { supported?: boolean; refuseSupport?: boolean; refuseSession?: boolean; session?: FakeSession } = {}): {
  xr: XrSystemLike;
  sessions: FakeSession[];
  asked: { mode: string; init: unknown }[];
} {
  const sessions: FakeSession[] = [];
  const asked: { mode: string; init: unknown }[] = [];
  const xr: XrSystemLike = {
    isSessionSupported: () =>
      options.refuseSupport === true ? Promise.reject(new Error("no answer")) : Promise.resolve(options.supported === true),
    requestSession: (mode: string, init?: unknown) => {
      asked.push({ mode, init });
      if (options.refuseSession === true) return Promise.reject(new Error("User denied permission"));
      const session = options.session ?? new FakeSession();
      sessions.push(session);
      return Promise.resolve(session);
    },
  };
  return { xr, sessions, asked };
}

interface FakeHost extends PresentationHost {
  readonly calls: string[];
  readonly released: { eye: { x: number; y: number; z: number } | null; yaw: number | null }[];
  headYawValue: number | null;
  attachFails: boolean;
}

/** What the viewer implements, recorded: the session handed over, the flat view taken back. */
function fakeHost(walker: Walker | null): FakeHost {
  const host: FakeHost = {
    calls: [],
    released: [],
    headYawValue: null,
    attachFails: false,
    walker: () => walker,
    attach: async () => {
      if (host.attachFails) throw new Error("setSession refused");
      host.calls.push("attach");
    },
    headYaw: () => host.headYawValue,
    release: () => {
      host.calls.push("release");
      // The viewer's own `release`: the flat camera goes back to the walker's head and turn.
      host.released.push({ eye: walker?.eye() ?? null, yaw: walker?.yaw() ?? null });
    },
  };
  return host;
}

/** The translator a host passes: English at the call site, the key recorded so a test can name it. */
function recorder(): Translate & { keys: string[] } {
  const keys: string[] = [];
  const t = ((key: string, english: string) => {
    keys.push(key);
    return english;
  }) as Translate & { keys: string[] };
  t.keys = keys;
  return t;
}

/** Let the microtask queue and one timer run: a start() goes through three awaits before it is done. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function entryFor(presentation: Presentation, t: Translate = recorder()): PresentationEntry {
  return createPresentationEntry({ presentation, t, document });
}

describe("a browser with no XR at all", () => {
  it("is a browser with no XR, not an error", () => {
    expect(xrSystem({})).toBeNull();
    expect(xrSystem(null)).toBeNull();
    expect(xrSystem({ xr: {} })).toBeNull();
    expect(xrSystem({ xr: { isSessionSupported: () => Promise.resolve(true) } })).toBeNull();
  });

  it("offers no entry: a button that cannot work is worse than no button", async () => {
    const presentation = new Presentation({ host: fakeHost(walkerAt()), navigator: () => ({}) });
    const entry = entryFor(presentation);

    await expect(entry.ready).resolves.toBe(false);
    expect(entry.element.querySelector("button")).toBeNull();
    expect(entry.element.children).toHaveLength(0);
    expect(entry.element.hidden).toBe(true);
    entry.dispose();
  });

  it("answers 'not available' when asked to start: no throw, and nothing left half-started", async () => {
    const walker = walkerAt();
    const host = fakeHost(walker);
    const presentation = new Presentation({ host, navigator: () => ({}) });

    await expect(presentation.start()).resolves.toBe("not-available");
    expect(presentation.state()).toBe("unsupported");
    expect(host.calls).toEqual([]);
    expect(walker.state()).toMatchObject({ x: 0, z: 0 });
  });

  it("is not available when nobody is walking: a headset has no origin to stand on", async () => {
    const { xr } = fakeXr({ supported: true });
    const host = fakeHost(null);
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });

    await expect(presentation.start()).resolves.toBe("not-available");
    expect(host.calls).toEqual([]);
  });
});

describe("a browser with XR that cannot give an immersive session", () => {
  it("offers no entry either", async () => {
    const { xr } = fakeXr({ supported: false });
    const presentation = new Presentation({ host: fakeHost(walkerAt()), navigator: () => ({ xr }) });
    const entry = entryFor(presentation);

    await expect(entry.ready).resolves.toBe(false);
    expect(entry.element.querySelector("button")).toBeNull();
    entry.dispose();
  });

  it("answers 'not available' when asked to start", async () => {
    const { xr, asked } = fakeXr({ supported: false });
    const host = fakeHost(walkerAt());
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });

    await expect(presentation.start()).resolves.toBe("not-available");
    expect(presentation.state()).toBe("unsupported");
    expect(asked).toEqual([]);
    expect(host.calls).toEqual([]);
  });

  it("treats a browser that cannot answer as a browser that cannot present", async () => {
    const { xr } = fakeXr({ refuseSupport: true });
    await expect(presentationSupported(xr)).resolves.toBe(false);
    const presentation = new Presentation({ host: fakeHost(walkerAt()), navigator: () => ({ xr }) });
    await expect(presentation.start()).resolves.toBe("not-available");
  });
});

describe("a browser that can present", () => {
  it("offers one button, in the theme's own words, keyed for the Turkish file", async () => {
    const { xr } = fakeXr({ supported: true });
    const t = recorder();
    const presentation = new Presentation({ host: fakeHost(walkerAt()), navigator: () => ({ xr }) });
    const entry = entryFor(presentation, t);

    await expect(entry.ready).resolves.toBe(true);
    const button = entry.element.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("Present in a headset");
    expect(t.keys).toContain("walk.present");
    entry.dispose();
  });

  it("asks for an immersive session with the reference space the walker needs", async () => {
    const { xr, sessions, asked } = fakeXr({ supported: true });
    const host = fakeHost(walkerAt());
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });

    await expect(presentation.start()).resolves.toBe("presenting");
    expect(asked).toEqual([{ mode: XR_MODE, init: XR_SESSION_INIT }]);
    expect(XR_MODE).toBe("immersive-vr");
    expect(XR_SESSION_INIT.optionalFeatures).toContain(XR_REFERENCE_SPACE);
    expect(XR_REFERENCE_SPACE).toBe("local-floor");
    // The floor is asked for before the renderer is trusted with the session.
    expect(sessions[0]?.spacesAsked).toEqual(["local-floor"]);
    expect(host.calls).toEqual(["attach"]);
    expect(presentation.state()).toBe("presenting");
  });

  it("starts from its own button, and hides while the headset has it", async () => {
    const { xr, sessions } = fakeXr({ supported: true });
    const presentation = new Presentation({ host: fakeHost(walkerAt()), navigator: () => ({ xr }) });
    const entry = entryFor(presentation);
    await entry.ready;

    entry.element.querySelector("button")?.click();
    await flush();
    expect(sessions).toHaveLength(1);
    expect(presentation.state()).toBe("presenting");
    // Nobody at the flat screen is clicking a button while a headset is on.
    expect(entry.element.querySelector("button")).toBeNull();

    await sessions[0]?.end();
    expect(entry.element.querySelector("button")).not.toBeNull();
    entry.dispose();
  });
});

describe("a session the browser refuses", () => {
  it("leaves the state not-running, the walker not moving, and nothing attached", async () => {
    const { xr, asked } = fakeXr({ supported: true, refuseSession: true });
    const walker = walkerAt();
    const host = fakeHost(walker);
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });

    await expect(presentation.start()).resolves.toBe("refused");
    expect(asked).toHaveLength(1);
    expect(presentation.state()).toBe("available");
    expect(host.calls).toEqual([]);

    // The normal case on most devices: the page is not thrown, and the walker stands still.
    for (let frame = 0; frame < 30; frame++) walker.advance(1 / 60);
    expect(walker.state()).toMatchObject({ x: 0, z: 0 });
  });

  it("ends a session whose floor the browser will not give, rather than keeping half of one", async () => {
    const session = new FakeSession();
    session.referenceSpaceFails = true;
    const { xr } = fakeXr({ supported: true, session });
    const host = fakeHost(walkerAt());
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });

    await expect(presentation.start()).resolves.toBe("refused");
    expect(session.ended).toBe(true);
    expect(host.calls).toEqual([]);
    expect(presentation.state()).toBe("available");
  });

  it("ends a session the renderer will not take", async () => {
    const session = new FakeSession();
    const { xr } = fakeXr({ supported: true, session });
    const host = fakeHost(walkerAt());
    host.attachFails = true;
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });

    await expect(presentation.start()).resolves.toBe("refused");
    expect(session.ended).toBe(true);
    expect(presentation.state()).toBe("available");
  });

  it("ends a session that arrives after the presenter gave up", async () => {
    const session = new FakeSession();
    const { xr } = fakeXr({ supported: true, session });
    const presentation = new Presentation({ host: fakeHost(walkerAt()), navigator: () => ({ xr }) });

    const started = presentation.start();
    presentation.end();
    await flush();
    await started;
    expect(session.ended).toBe(true);
    expect(presentation.state()).not.toBe("presenting");
  });

  it("leaves no unhandled rejection behind, whichever way the browser says no", async () => {
    // A rejection nobody catches is what takes a page down in production, so the
    // three ways this browser can refuse are watched by node's own reporter.
    const unhandled: unknown[] = [];
    const watch = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", watch);
    try {
      for (const refusing of [{ supported: false }, { refuseSupport: true }, { supported: true, refuseSession: true }]) {
        const { xr } = fakeXr(refusing);
        const presentation = new Presentation({ host: fakeHost(walkerAt()), navigator: () => ({ xr }) });
        const entry = entryFor(presentation);
        await entry.ready;
        await presentation.start();
        entry.dispose();
      }
      await flush();
      await flush();
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", watch);
    }
  });
});

describe("what drives the walker in a headset", () => {
  it("reads the xr-standard thumbstick pair, with a deadzone a hand can rest in", () => {
    expect(XR_THUMBSTICK_DEADZONE).toBeGreaterThan(0);
    expect(thumbstickKeys([0, 0, 0, -1])).toEqual(["forward"]);
    expect(thumbstickKeys([0, 0, 0, 1])).toEqual(["back"]);
    expect(thumbstickKeys([0, 0, 1, 0])).toEqual(["right"]);
    expect(thumbstickKeys([0, 0, -1, -1])).toEqual(["forward", "left"]);
    expect(thumbstickKeys([0, 0, XR_THUMBSTICK_DEADZONE / 2, -XR_THUMBSTICK_DEADZONE / 2])).toEqual([]);
    expect(thumbstickKeys(null)).toEqual([]);
    expect(thumbstickKeys([1, 1])).toEqual([]);
  });

  it("walks the same walker the keyboard walks, at the same pace and past the same solids", async () => {
    const session = new FakeSession();
    session.inputSources = [{ handedness: "right", gamepad: { axes: [0, 0, 0, -1] } }];
    const { xr } = fakeXr({ supported: true, session });
    const walker = walkerAt(0, 0, 0);
    const presentation = new Presentation({ host: fakeHost(walker), navigator: () => ({ xr }) });
    await presentation.start();

    for (let frame = 0; frame < 60; frame++) {
      presentation.update();
      walker.advance(1 / 60);
    }
    // Yaw 0 looks along -Z, so a pushed thumbstick walks north.
    expect(walker.state().z).toBeLessThan(-1.2);
    expect(walker.state().x).toBeCloseTo(0, 6);
  });

  it("does not also walk on a keyboard: the headset owns the walker while it runs", async () => {
    const { xr } = fakeXr({ supported: true });
    const walker = walkerAt();
    const presentation = new Presentation({ host: fakeHost(walker), navigator: () => ({ xr }) });
    await presentation.start();

    // A key left down by the flat walkthrough, and no thumbstick at all.
    walker.hold("forward", true);
    for (let frame = 0; frame < 30; frame++) {
      presentation.update();
      walker.advance(1 / 60);
    }
    expect(walker.state()).toMatchObject({ x: 0, z: 0 });
  });

  it("turns the body to wherever the head looks, so forward means forward", async () => {
    const { xr } = fakeXr({ supported: true });
    const walker = walkerAt();
    const host = fakeHost(walker);
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });
    await presentation.start();

    host.headYawValue = Math.PI / 2;
    presentation.update();
    expect(walker.yaw()).toBeCloseTo(Math.PI / 2, 6);
    presentation.end();
  });
});

describe("the session ends", () => {
  it("gives the flat view back where the person left it, and stops the walker", async () => {
    const session = new FakeSession();
    session.inputSources = [{ gamepad: { axes: [0, 0, 0, -1] } }];
    const { xr } = fakeXr({ supported: true, session });
    const walker = walkerAt();
    const host = fakeHost(walker);
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });
    await presentation.start();

    for (let frame = 0; frame < 30; frame++) {
      presentation.update();
      walker.advance(1 / 60);
    }
    host.headYawValue = 0.5;
    presentation.update();
    const where = walker.eye();

    presentation.end();

    expect(host.calls).toEqual(["attach", "release"]);
    expect(presentation.state()).toBe("available");
    expect(host.released).toHaveLength(1);
    expect(host.released[0]?.eye).toEqual(where);
    expect(host.released[0]?.yaw).toBeCloseTo(0.5, 6);

    // The thumbstick's last frame held "forward": nothing may still be walking.
    const stopped = walker.state();
    for (let frame = 0; frame < 30; frame++) walker.advance(1 / 60);
    expect(walker.state().z).toBeCloseTo(stopped.z, 9);
  });

  it("does the same when the headset ends it on its own", async () => {
    const session = new FakeSession();
    const { xr } = fakeXr({ supported: true, session });
    const host = fakeHost(walkerAt());
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });
    await presentation.start();

    session.endFromDevice();

    expect(host.calls).toEqual(["attach", "release"]);
    expect(presentation.state()).toBe("available");
  });

  it("ends once, however many ways it is told", async () => {
    const session = new FakeSession();
    const { xr } = fakeXr({ supported: true, session });
    const host = fakeHost(walkerAt());
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });
    await presentation.start();

    presentation.end();
    presentation.end();
    session.endFromDevice();

    expect(host.calls).toEqual(["attach", "release"]);
  });

  it("gives the flat view back when the viewer itself is disposed", async () => {
    const session = new FakeSession();
    const { xr } = fakeXr({ supported: true, session });
    const host = fakeHost(walkerAt());
    const presentation = new Presentation({ host, navigator: () => ({ xr }) });
    await presentation.start();

    presentation.dispose();

    expect(session.ended).toBe(true);
    expect(host.calls).toEqual(["attach", "release"]);
  });
});
