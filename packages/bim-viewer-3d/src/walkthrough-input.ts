/**
 * The keyboard and pointer half of walking: which keys mean "go", where the
 * mouse looks, and how the pointer gets out again.
 *
 * Kept apart from `Walker` (which is the arithmetic) and from the viewer (which
 * draws), because this is the only part a test without a browser cannot prove:
 * everything here is an event handler and a pointer lock.
 *
 * **Look with the pointer captured, not dragged.** A first-person view that
 * needs a held button feels like a model viewer; a captured pointer feels like
 * walking. Capture is asked for on the first click, and if the browser refuses
 * (it does, briefly, after Escape ends a capture) a drag still turns the head,
 * so the walkthrough is never stuck looking one way.
 */
import { type WalkKey, type Walker } from "./walkthrough";

/**
 * Keys by their physical position (`code`, not `key`): a walker on a Turkish
 * F-layout puts W at the same place as a walker on QWERTY, and the arrows work
 * for anybody who expects them.
 */
const KEY_OF: Readonly<Record<string, WalkKey>> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

/**
 * True when the key went to something a person is typing into. Walking never
 * steals a letter from a field: a properties panel left focused must still take
 * its W, and the walker simply stands still until the field is left.
 */
function typingIn(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export interface WalkthroughInputOptions {
  /** The element the pointer is captured on: the viewer's canvas. */
  readonly element: HTMLElement;
  readonly walker: Walker;
  /** Escape, or the pointer capture going away: leave walkthrough. */
  readonly onExit: () => void;
  /** Told when the pointer capture is granted or lost, so a hint can say "click to look". */
  readonly onLockChange?: (locked: boolean) => void;
}

export class WalkthroughInput {
  private readonly document: Document;
  private dragging = false;
  private disposed = false;
  private lastPointer: { readonly x: number; readonly y: number } | null = null;
  /** The capture state at the previous change, so "lost" can be told from "never had". */
  private wasLocked = false;

  constructor(private readonly options: WalkthroughInputOptions) {
    const element = options.element;
    this.document = element.ownerDocument;
    this.document.addEventListener("keydown", this.onKeyDown, true);
    this.document.addEventListener("keyup", this.onKeyUp, true);
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    this.document.addEventListener("pointerlockchange", this.onLockChange);
  }

  /** True while the pointer is captured: looking follows the pointer without a held button. */
  locked(): boolean {
    return this.document.pointerLockElement === this.options.element;
  }

  /** Ask for the pointer capture. Safe to call when the browser has none: it simply does nothing. */
  requestLock(): void {
    if (this.disposed || this.locked()) return;
    const element = this.options.element as HTMLElement & { requestPointerLock?: () => void };
    element.requestPointerLock?.();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const element = this.options.element;
    this.document.removeEventListener("keydown", this.onKeyDown, true);
    this.document.removeEventListener("keyup", this.onKeyUp, true);
    element.removeEventListener("pointerdown", this.onPointerDown);
    element.removeEventListener("pointermove", this.onPointerMove);
    element.removeEventListener("pointerup", this.onPointerUp);
    element.removeEventListener("pointercancel", this.onPointerUp);
    this.document.removeEventListener("pointerlockchange", this.onLockChange);
    this.options.walker.releaseAll();
    if (this.locked()) (this.document as Document & { exitPointerLock?: () => void }).exitPointerLock?.();
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      // Escape only arrives here when the pointer is not captured; a captured pointer gets its own way out below.
      event.preventDefault();
      this.options.onExit();
      return;
    }
    if (typingIn(event.target)) return;
    const key = KEY_OF[event.code];
    if (!key) return;
    // The walker owns the keyboard: nothing behind the canvas (a scroll view, a shortcut) also acts on W.
    event.preventDefault();
    this.options.walker.hold(key, true);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    const key = KEY_OF[event.code];
    if (key) this.options.walker.hold(key, false);
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    this.dragging = true;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    // The canvas must keep the pointer events it starts: the viewer's own controls are off while walking.
    event.preventDefault();
    this.requestLock();
  };

  private readonly onPointerUp = () => {
    this.dragging = false;
    this.lastPointer = null;
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.locked()) {
      // Captured: the browser reports the movement itself, without a button held.
      this.options.walker.look(event.movementX, event.movementY);
      return;
    }
    if (!this.dragging || this.lastPointer === null) return;
    // Not captured (a browser refusing the lock): a drag still turns the head, from the previous point.
    this.options.walker.look(event.clientX - this.lastPointer.x, event.clientY - this.lastPointer.y);
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };

  private readonly onLockChange = () => {
    const locked = this.locked();
    this.options.onLockChange?.(locked);
    // Escape ends the capture before any key event reaches the page; losing it is how the walker learns.
    if (!locked && this.wasLocked) {
      this.wasLocked = false;
      this.options.onExit();
      return;
    }
    this.wasLocked = locked;
  };
}
