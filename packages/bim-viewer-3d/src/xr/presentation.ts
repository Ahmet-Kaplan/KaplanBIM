/**
 * Presenting the model in a headset, where the browser offers one — and nothing
 * at all where it does not.
 *
 * WebXR is a browser API, not a dependency: `navigator.xr` may be absent
 * (Safari, Firefox), present and unable to give an immersive session (every
 * phone, most desktops: `isSessionSupported("immersive-vr")` answers false), or
 * present and able. All three states are handled here, and the entry is drawn
 * in **one** of them: a button that cannot work is worse than no button, the
 * rule `ThemeToggle` follows in `bim-ui`.
 *
 * **The walker carries the headset; the headset does not drive the walker.**
 * The flat walkthrough's `Walker` is the origin a session is drawn from: its
 * feet are the floor the reference space calls y = 0, and it stands where the
 * colliders say a person may stand. The head's own pose (looking around,
 * ducking, a step across the play area) is added on top of that origin by the
 * renderer. Walking is the hand controllers' thumbstick, pressed through the
 * **same** `Walker.advance` the keyboard presses — same pace, same walls, same
 * stairs, same doors (`walkthrough.ts`, `walkthrough-stairs.ts`,
 * `walkthrough-mechanisms.ts`). The head's yaw becomes the walker's yaw each
 * frame, because "forward" has to mean where the person is looking.
 *
 * Why not the other way round — head position drives the walker and the walker
 * follows? Because a headset pose is a physical person in a room the app cannot
 * refuse: one step forward is one step forward, through a wall if a wall is
 * there. Collision, gravity and the stair would all become decoration, and the
 * model could only be crossed inside a two-metre play area. So the walker holds
 * the origin, and only the walker's own movement (the thumbstick) is subject to
 * the model.
 *
 * Nothing here renders a headset frame and nothing here touches three.js: the
 * host (`ModelViewer3D`) hands over the session, says where the head points and
 * takes the flat view back. That is also why this file can be tested without a
 * device — see `__tests__/xr-presentation.test.ts` — and why what a headset
 * actually shows is still unverified.
 */
import { type WalkKey, type Walker } from "../walkthrough";

/** The session mode asked for: a headset, not a phone held up at the model. */
export const XR_MODE = "immersive-vr";

/**
 * The reference space the walker needs: y = 0 is the floor the person stands
 * on, so the headset's own y is their eye above it. "local", the other space
 * every session has, puts y = 0 at the head as the session started, which would
 * sink the model a head's height into the ground.
 */
export const XR_REFERENCE_SPACE = "local-floor";

/**
 * What `requestSession` is asked for. `local-floor` is only guaranteed to a
 * session that asks for it — for `immersive-vr` it is an optional feature — so
 * the mode is requested with it named rather than hoped for.
 */
export const XR_SESSION_INIT = { optionalFeatures: [XR_REFERENCE_SPACE] } as const;

/**
 * How far a thumbstick must be pushed before the walker believes it. A stick at
 * rest reports a few hundredths; a quarter of the way over is deliberate.
 */
export const XR_THUMBSTICK_DEADZONE = 0.25;

/** The four keys a thumbstick can hold, in the walkthrough's own vocabulary. */
export const XR_WALK_KEYS: readonly WalkKey[] = ["forward", "back", "left", "right"];

/**
 * The namespace the Turkish for these words lives in:
 * `packages/bim-editor/locales/tr/editor.json`, beside the walkthrough's own
 * captions. Written as a literal `ns:` at every call site — `tools/i18n`'s
 * review list reads the namespace out of the call, and a key it cannot place
 * looks like a translation nobody uses.
 */
export const XR_NAMESPACE = "editor";

/**
 * The one thing this module needs from a translator: `t('key', 'English')`,
 * with i18next's options so the namespace travels with the call.
 */
export type Translate = (key: string, english: string, options?: { readonly ns?: string }) => string;

/** The English for a key here; the Turkish is the locale file's. */
function words(t: Translate, key: string, english: string): string {
  return t(key, english, { ns: XR_NAMESPACE });
}

// ------------------------------------------------------------------ what the browser says

/** A gamepad as far as a walker cares: the `xr-standard` axes, thumbstick last two of the pair. */
export interface XrGamepadLike {
  readonly axes?: readonly number[] | null;
}

/** A hand controller, or a tracked hand: only what a thumbstick needs. */
export interface XrInputSourceLike {
  readonly handedness?: string;
  readonly gamepad?: XrGamepadLike | null;
}

/**
 * A session, structurally. The DOM's WebXR types (`XRSession`) are not part of
 * the TypeScript `lib` this repo compiles against, and a browser that hands back
 * something stranger than the spec must not crash the page: every field is
 * optional and every call is guarded.
 */
export interface XrSessionLike {
  readonly inputSources?: readonly XrInputSourceLike[] | null;
  requestReferenceSpace(type: string): Promise<unknown>;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  end(): Promise<void>;
}

/** `navigator.xr`, structurally: the two methods a presenter uses. */
export interface XrSystemLike {
  isSessionSupported(mode: string): Promise<boolean>;
  requestSession(mode: string, init?: { readonly optionalFeatures?: readonly string[] }): Promise<XrSessionLike>;
}

/**
 * `navigator.xr` when the browser has one that can be *asked* — every property
 * read guarded, because a browser without WebXR is the normal case and an
 * exception in a viewer's constructor is not.
 */
export function xrSystem(nav: unknown = typeof navigator === "undefined" ? null : navigator): XrSystemLike | null {
  if (typeof nav !== "object" || nav === null) return null;
  const xr = (nav as { readonly xr?: unknown }).xr;
  if (typeof xr !== "object" || xr === null) return null;
  const candidate = xr as Partial<XrSystemLike>;
  // Either method missing is a browser that cannot be asked: no XR, not an error.
  if (typeof candidate.isSessionSupported !== "function" || typeof candidate.requestSession !== "function") return null;
  return candidate as XrSystemLike;
}

/** Can this browser present? Never rejects: a browser that cannot answer cannot present. */
export async function presentationSupported(xr: XrSystemLike | null): Promise<boolean> {
  if (xr === null) return false;
  try {
    return (await xr.isSessionSupported(XR_MODE)) === true;
  } catch {
    return false;
  }
}

/**
 * The walker keys one controller's axes hold, in `xr-standard`'s thumbstick
 * pair (axes 2 and 3; pushed away from you is y = -1). Anything shorter than
 * four axes is a controller with no stick, which holds nothing.
 */
export function thumbstickKeys(axes: readonly number[] | null | undefined, deadzone: number = XR_THUMBSTICK_DEADZONE): WalkKey[] {
  if (!axes) return [];
  const x = axes[2] ?? 0;
  const y = axes[3] ?? 0;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  const keys: WalkKey[] = [];
  if (y <= -deadzone) keys.push("forward");
  if (y >= deadzone) keys.push("back");
  if (x <= -deadzone) keys.push("left");
  if (x >= deadzone) keys.push("right");
  return keys;
}

// ------------------------------------------------------------------ what the viewer gives

/**
 * What the headset needs from the viewer, and what the viewer must give back.
 * The viewer owns three.js; this module owns the session.
 */
export interface PresentationHost {
  /** The walker the headset drives; null when nobody is walking, which is nobody to present. */
  walker(): Walker | null;
  /**
   * Hand the renderer the session and the reference space. May reject: a browser
   * is allowed to refuse a session it has already granted, and that must end the
   * session rather than leave half of one behind.
   */
  attach(session: XrSessionLike, space: unknown): void | Promise<void>;
  /** Where the head is pointing, radians about the up axis (0 looks along -Z); null before the first pose. */
  headYaw(): number | null;
  /** The headset is gone: draw the flat view again, camera at the walker's head, facing the walker's way. */
  release(): void;
}

/** What asking for a session ended in. */
export type PresentationOutcome =
  /** A session is running; the headset has the walker. */
  | "presenting"
  /** This browser cannot present, or nobody is walking: no session was asked for. */
  | "not-available"
  /** A session was asked for and refused, or could not be finished starting: nothing is running. */
  | "refused";

/** Where a presentation is, for a host that draws it. */
export type PresentationState =
  /** Nobody has asked the browser yet. */
  | "unknown"
  /** Asked, and this browser cannot give an immersive session. */
  | "unsupported"
  /** This browser can present; nothing is running. */
  | "available"
  /** `requestSession` is in flight. */
  | "starting"
  /** A session is running and the headset has the walker. */
  | "presenting";

export interface PresentationOptions {
  readonly host: PresentationHost;
  /**
   * The browser to ask, read on every call so a test (or a host with its own
   * `navigator`) can swap it. Defaults to the page's `navigator`, guarded.
   */
  readonly navigator?: () => unknown;
}

/** Ending a session that is already gone is not an error; neither is a browser that refuses to end one. */
async function endQuietly(session: XrSessionLike): Promise<void> {
  try {
    await session.end();
  } catch {
    // The session is over either way, which is what the caller wanted.
  }
}

/**
 * One presentation: ask for a headset session, drive the walker from the hand
 * controllers while it runs, and give the flat view back when it ends.
 *
 * Every promise is caught. A refused `requestSession` is the normal case on most
 * devices, so it returns `"refused"` and leaves the walker standing still rather
 * than throwing into a render loop.
 */
export class Presentation {
  private readonly listeners = new Set<(state: PresentationState) => void>();
  private readonly options: PresentationOptions;
  private status: PresentationState = "unknown";
  /** The running session, once the host has taken it. */
  private active: { readonly session: XrSessionLike; readonly onEnd: () => void } | null = null;
  /** True once the host has been given a session and has not yet given the flat view back. */
  private attached = false;
  /**
   * How many times a session has been asked for or given up: a `start()` that
   * comes back to find the number changed was abandoned while it was waiting
   * (`end()` was called), and the session it was given must be ended, not kept.
   * A boolean cannot do this — the start would clear the very flag that
   * abandoned it.
   */
  private askId = 0;
  private disposed = false;

  constructor(options: PresentationOptions) {
    this.options = options;
  }

  state(): PresentationState {
    return this.status;
  }

  /** Hear where the presentation is, so a host can draw it. Returns the way to stop hearing. */
  onChange(listener: (state: PresentationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The walker the headset would drive; null when nobody is walking. */
  walker(): Walker | null {
    return this.options.host.walker();
  }

  /**
   * Ask the browser whether it can present, and settle `state()` on the answer.
   * Never rejects: `false` covers no WebXR, no headset and a browser that will
   * not answer.
   */
  async supported(): Promise<boolean> {
    if (this.disposed) return false;
    const can = await presentationSupported(xrSystem(this.readNavigator()));
    if (this.disposed) return false;
    if (!can) {
      this.setStatus("unsupported");
      return false;
    }
    if (this.active === null) this.setStatus("available");
    return true;
  }

  /**
   * Ask for an immersive session and give it the walker.
   *
   * `"not-available"` without asking the browser when nobody is walking or the
   * browser has no WebXR; `"refused"` when the browser or the renderer says no.
   * In both cases nothing is attached, no key is held and no session is left
   * running — the walker simply stands where it was.
   */
  async start(): Promise<PresentationOutcome> {
    if (this.disabled()) return "not-available";
    if (this.active !== null) return "presenting";
    // Taken before the first await, so an `end()` that arrives while the browser
    // is deciding whether it can present still abandons this ask.
    const ask = ++this.askId;
    const xr = xrSystem(this.readNavigator());
    if (xr === null) {
      this.setStatus("unsupported");
      return "not-available";
    }
    if (!(await presentationSupported(xr))) {
      if (!this.disabled()) this.setStatus("unsupported");
      return "not-available";
    }
    if (this.disabled()) return "not-available";
    // A headset with nobody walking has no origin to stand on.
    if (this.options.host.walker() === null) {
      this.setStatus("available");
      return "not-available";
    }
    this.setStatus("starting");
    /** The walker was given a session to keep only while nobody has taken it back. */
    const abandoned = () => this.disabled() || this.askId !== ask;

    let session: XrSessionLike;
    try {
      session = await xr.requestSession(XR_MODE, XR_SESSION_INIT);
    } catch {
      // The normal case on most devices: a refusal, not an exception to report.
      if (!this.disabled()) this.setStatus("available");
      return "refused";
    }

    const onEnd = () => {
      if (this.active?.session === session) this.finish();
    };
    let space: unknown;
    try {
      session.addEventListener("end", onEnd);
      // The floor, before anything is drawn from the session: without it the
      // model stands a head too high or too low.
      space = await session.requestReferenceSpace(XR_REFERENCE_SPACE);
    } catch {
      session.removeEventListener("end", onEnd);
      await endQuietly(session);
      if (!this.disabled()) this.setStatus("available");
      return "refused";
    }
    if (abandoned()) {
      session.removeEventListener("end", onEnd);
      await endQuietly(session);
      if (!this.disabled()) this.setStatus("available");
      return "not-available";
    }

    try {
      await this.options.host.attach(session, space);
    } catch {
      session.removeEventListener("end", onEnd);
      await endQuietly(session);
      if (!this.disabled()) this.setStatus("available");
      return "refused";
    }

    this.active = { session, onEnd };
    this.attached = true;
    this.setStatus("presenting");
    return "presenting";
  }

  /**
   * One frame of a running session: the hand controllers' thumbsticks become the
   * walker's four keys — set every frame, so a key the flat walkthrough was
   * holding is let go: in a headset the headset is what moves the person — and
   * the head's turn becomes the body's turn.
   */
  update(): void {
    const active = this.active;
    if (active === null) return;
    const walker = this.options.host.walker();
    if (walker === null) return;
    const held = new Set<WalkKey>();
    try {
      for (const source of active.session.inputSources ?? []) {
        for (const key of thumbstickKeys(source.gamepad?.axes)) held.add(key);
      }
    } catch {
      // A browser whose input sources misbehave for a frame leaves the walker
      // standing still for that frame, which is survivable; an exception thrown
      // into the render loop every frame is not.
    }
    for (const key of XR_WALK_KEYS) walker.hold(key, held.has(key));
    const yaw = (() => {
      try {
        return this.options.host.headYaw();
      } catch {
        return null;
      }
    })();
    if (yaw !== null && Number.isFinite(yaw)) walker.face(yaw);
  }

  /**
   * End the session and give the flat view back — or, when a session is still
   * being asked for, make sure the one that arrives is ended instead of started.
   * Safe to call twice, and safe to call when there is no session.
   */
  end(): void {
    // Anything still being asked for is not wanted any more.
    this.askId++;
    const active = this.active;
    if (active === null) return;
    // Ask first, then give the view back now: the browser's own "end" event comes
    // a frame later, and the person at the flat screen should not wait for it.
    void endQuietly(active.session);
    this.finish();
  }

  /** The viewer is going away: end the session and hear no more. */
  dispose(): void {
    this.end();
    this.disposed = true;
    this.listeners.clear();
  }

  /** `end()`, or a session the browser finished by itself (the headset taken off, its own menu used). */
  private finish(): void {
    const active = this.active;
    this.active = null;
    if (active !== null) active.session.removeEventListener("end", active.onEnd);
    // The headset owned the walker while it ran: nothing it was holding may still be held.
    this.options.host.walker()?.releaseAll();
    if (this.attached) {
      this.attached = false;
      try {
        this.options.host.release();
      } catch {
        // A host that cannot give the flat view back must not take the page with it.
      }
    }
    if (!this.disposed) this.setStatus("available");
  }

  private disabled(): boolean {
    return this.disposed;
  }

  private readNavigator(): unknown {
    if (this.options.navigator) return this.options.navigator();
    return typeof navigator === "undefined" ? null : navigator;
  }

  private setStatus(status: PresentationState): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

// ------------------------------------------------------------------ the way in

export interface PresentationEntryOptions {
  readonly presentation: Presentation;
  /** The translator: English at the call site, Turkish from `editor.json`. */
  readonly t: Translate;
  /** The document to build the button in; the page's when absent. */
  readonly document?: Document;
}

/** The entry point, and the two things a host needs to know about it. */
export interface PresentationEntry {
  /**
   * The element a host puts on screen. It is **empty and hidden** unless the
   * browser can present and somebody is walking — nothing to click, nothing to
   * focus, nothing to mislead. An empty container is how "renders null" looks in
   * a package with no React.
   */
  readonly element: HTMLElement;
  /** Resolves true when this browser can present. Never rejects. */
  readonly ready: Promise<boolean>;
  /** Ask again whether the entry belongs on screen: a walkthrough started or ended. */
  refresh(): void;
  dispose(): void;
}

/**
 * A button that starts a headset session, in the theme's own words and its own
 * colours — or nothing at all.
 *
 * `bim-viewer-3d` has no React, so this is a plain element rather than a
 * `bim-ui` primitive; what it keeps is the part the theme rule is about, that
 * every colour, the radius and the font come from a `--mutiny-*` variable and
 * none is picked here. It is drawn only where the browser answered that it can
 * present **and** a walker is standing: a button that cannot work is worse than
 * no button, which is the rule `ThemeToggle` follows in `bim-ui`.
 *
 * A host with its own chrome has an alternative and is welcome to it: draw a
 * `bim-ui` `Button` and call `viewer.enterPresentation()`, listening to
 * `Presentation.onChange` for the label. What a host must **not** do is draw a
 * button of its own before asking `supported()` — that is the button this file
 * exists to keep off the screen.
 */
export function createPresentationEntry(options: PresentationEntryOptions): PresentationEntry {
  const doc = options.document ?? document;
  const presentation = options.presentation;
  const element = doc.createElement("div");
  element.dataset.mutiny = "xr-presentation";
  element.hidden = true;
  let supported = false;
  let disposed = false;

  const render = (): void => {
    if (disposed) return;
    const belongs = supported && presentation.walker() !== null && presentation.state() !== "presenting";
    element.hidden = !belongs;
    element.replaceChildren();
    if (!belongs) return;
    element.append(buildButton(doc, options.t, presentation));
  };

  const stopWatching = presentation.onChange(render);
  const ready = presentation.supported().then((can) => {
    supported = can;
    render();
    return can;
  });

  return {
    element,
    ready,
    refresh: render,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stopWatching();
      element.remove();
    },
  };
}

/**
 * The button itself. Colours, radius and font from the theme's variables; only
 * the box around the words is decided here.
 */
function buildButton(doc: Document, t: Translate, presentation: Presentation): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = words(t, "walk.present", "Present in a headset");
  const style = button.style;
  style.display = "inline-flex";
  style.alignItems = "center";
  style.gap = "0.375rem";
  style.height = "1.75rem";
  style.padding = "0 0.625rem";
  style.fontFamily = "var(--mutiny-font-body)";
  style.fontSize = "0.8rem";
  style.borderRadius = "var(--mutiny-radius)";
  style.border = "1px solid var(--mutiny-border)";
  style.background = "var(--mutiny-panel)";
  style.color = "var(--mutiny-text)";
  style.cursor = "pointer";
  button.addEventListener("click", () => {
    // A refusal is answered in `state()`, not thrown at a click handler.
    void presentation.start();
  });
  return button;
}
