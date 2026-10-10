"use client";

import { ArrowBigUp, ChevronDown, CornerDownLeft, Delete } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDevicePrefs } from "@/hooks/use-device-prefs";
import { cn } from "@/lib/utils";

/**
 * Built-in German (QWERTZ) on-screen keyboard for the wall display. The system
 * keyboards on Raspberry Pi OS don't reliably appear in a fullscreen Chromium,
 * so the app brings its own. It types into whatever text field has focus.
 */

type Editable = HTMLInputElement | HTMLTextAreaElement;
type Layer = "letters" | "symbols" | "digits";
type ShiftState = "off" | "once" | "lock";

const TEXT_TYPES = new Set(["text", "search", "email", "url", "tel", "number", "password", ""]);

function isEditable(el: Element | null): el is Editable {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    return TEXT_TYPES.has(el.type) && !el.readOnly && !el.disabled && el.dataset.osk !== "off";
  }
  return false;
}

function setNativeValue(el: Editable, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function selection(el: Editable): [number, number] {
  try {
    if (el.selectionStart !== null && el.selectionEnd !== null) return [el.selectionStart, el.selectionEnd];
  } catch {
    // e.g. type="email" has no selection API
  }
  return [el.value.length, el.value.length];
}

function moveCaret(el: Editable, position: number) {
  try {
    el.setSelectionRange(position, position);
  } catch {
    // not supported for this input type
  }
}

function insertText(el: Editable, text: string) {
  const [start, end] = selection(el);
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  if (el.maxLength > 0 && next.length > el.maxLength) return;
  setNativeValue(el, next);
  moveCaret(el, start + text.length);
}

function deleteBackward(el: Editable) {
  const [start, end] = selection(el);
  if (start === 0 && end === 0) return;
  const from = start === end ? start - 1 : start;
  setNativeValue(el, el.value.slice(0, from) + el.value.slice(end));
  moveCaret(el, from);
}

const LETTERS = [
  ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ü"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ö", "ä"],
  ["y", "x", "c", "v", "b", "n", "m", "ß", "-"],
];
const SYMBOLS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["@", "#", "€", "&", "(", ")", "/", ":", ";", '"'],
  ["%", "+", "=", "*", "?", "!", "'", "_", "–"],
];
const DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

function Key({
  children,
  onPress,
  className,
  repeat = false,
  label,
  active = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  className?: string;
  repeat?: boolean;
  label?: string;
  active?: boolean;
}) {
  const timers = useRef<{ delay?: number; interval?: number }>({});

  const stop = () => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.interval);
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
        if (repeat) {
          timers.current.delay = window.setTimeout(() => {
            timers.current.interval = window.setInterval(onPress, 70);
          }, 420);
        }
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "flex h-full min-w-0 flex-1 items-center justify-center rounded-xl text-[1.35rem] font-medium shadow-[0_1px_0_0_rgb(0_0_0/0.18)] transition-[transform,background-color] duration-75 select-none active:scale-[0.94]",
        active ? "bg-accent text-accent-fg" : "bg-surface-hover text-fg active:bg-accent-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function OnScreenKeyboard() {
  const [prefs] = useDevicePrefs();
  const [target, setTarget] = useState<Editable | null>(null);
  const [layer, setLayer] = useState<Layer>("letters");
  const [shift, setShift] = useState<ShiftState>("off");
  const lastShiftTap = useRef(0);
  const panel = useRef<HTMLDivElement>(null);

  const enabled = prefs.keyboard;
  const activeTarget = enabled ? target : null;

  useEffect(() => {
    if (!enabled) return;

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (!isEditable(el)) return;
      if (el.getAttribute("inputmode") !== "none") {
        el.dataset.oskInputmode = el.getAttribute("inputmode") ?? "";
        el.setAttribute("inputmode", "none");
      }
      const numeric = el.dataset.oskInputmode === "numeric" || el.type === "number" || el.type === "tel";
      setLayer(numeric ? "digits" : "letters");
      setShift(el.value.length === 0 && el.type !== "email" && el.type !== "url" ? "once" : "off");
      setTarget(el);
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isEditable(document.activeElement)) setTarget(null);
      }, 60);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    if (isEditable(document.activeElement)) onFocusIn({ target: document.activeElement } as unknown as FocusEvent);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [enabled]);

  // Reserve space so content (and sheets) move above the keyboard.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const target = activeTarget;
    if (!target || !panel.current) {
      root.style.setProperty("--osk-height", "0px");
      root.style.setProperty("--sheet-bottom", "var(--keyboard-inset, 0px)");
      return;
    }
    const update = () => {
      const h = panel.current?.offsetHeight ?? 0;
      root.style.setProperty("--osk-height", `${h}px`);
      root.style.setProperty("--sheet-bottom", `${h}px`);
    };
    update();
    const id = window.setTimeout(() => target.scrollIntoView({ block: "nearest", behavior: "smooth" }), 220);
    return () => window.clearTimeout(id);
  }, [activeTarget, layer]);

  const type = useCallback(
    (text: string) => {
      if (!target) return;
      const out = shift !== "off" && layer === "letters" && text !== "ß" ? text.toUpperCase() : text;
      insertText(target, out);
      if (shift === "once") setShift("off");
    },
    [target, shift, layer],
  );

  const enter = useCallback(() => {
    if (!target) return;
    if (target instanceof HTMLTextAreaElement) {
      insertText(target, "\n");
      return;
    }
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
    );
    if (target.form) target.form.requestSubmit();
  }, [target]);

  const hide = useCallback(() => target?.blur(), [target]);

  const toggleShift = () => {
    const now = Date.now();
    if (now - lastShiftTap.current < 350) setShift("lock");
    else setShift((s) => (s === "off" ? "once" : "off"));
    lastShiftTap.current = now;
  };

  // Note: no DOM classes during render – this component is also rendered on the server.
  const isEmail = activeTarget?.type === "email";

  return (
    <AnimatePresence>
      {activeTarget && (
        <motion.div
          ref={panel}
          data-osk
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 520, damping: 44 }}
          className="fixed inset-x-0 bottom-0 z-[100] rounded-t-(--radius-card) border-b-0 px-3 pt-3 pb-4 glass-strong select-none"
          style={{ pointerEvents: "auto" }}
          onPointerDown={(e) => e.preventDefault()}
        >
          <div className={cn("mx-auto flex flex-col gap-2", layer === "digits" ? "max-w-md" : "max-w-5xl")}>
            {layer === "digits" ? (
              <>
                {DIGITS.map((row, i) => (
                  <div key={i} className="flex h-16 gap-2">
                    {row.map((k) => (
                      <Key key={k} onPress={() => type(k)}>
                        {k}
                      </Key>
                    ))}
                  </div>
                ))}
                <div className="flex h-16 gap-2">
                  <Key onPress={() => setLayer("letters")} label="Letters" className="text-base">
                    ABC
                  </Key>
                  <Key onPress={() => type("0")}>0</Key>
                  <Key onPress={() => target && deleteBackward(target)} repeat label="Delete">
                    <Delete className="size-6" />
                  </Key>
                </div>
                <div className="flex h-14 gap-2">
                  <Key onPress={hide} label="Hide keyboard">
                    <ChevronDown className="size-6" />
                  </Key>
                  <Key onPress={enter} label="Enter" className="flex-[2] bg-accent text-accent-fg">
                    <CornerDownLeft className="size-6" />
                  </Key>
                </div>
              </>
            ) : (
              <>
                {(layer === "letters" ? LETTERS : SYMBOLS).map((row, i) => (
                  <div key={i} className="flex h-16 gap-2">
                    {i === 2 && layer === "letters" && (
                      <Key
                        onPress={toggleShift}
                        label="Shift"
                        active={shift !== "off"}
                        className={cn(
                          "flex-[1.5]",
                          shift === "lock" && "ring-2 ring-accent ring-offset-2 ring-offset-transparent",
                        )}
                      >
                        <ArrowBigUp className={cn("size-7", shift !== "off" && "fill-current")} />
                      </Key>
                    )}
                    {i === 2 && layer === "symbols" && <div className="flex-[1.5]" />}
                    {row.map((k) => (
                      <Key key={k} onPress={() => type(k)}>
                        {shift !== "off" && layer === "letters" && k !== "ß" ? k.toUpperCase() : k}
                      </Key>
                    ))}
                    {i === 2 && (
                      <Key
                        onPress={() => target && deleteBackward(target)}
                        repeat
                        label="Delete"
                        className="flex-[1.5]"
                      >
                        <Delete className="size-6" />
                      </Key>
                    )}
                  </div>
                ))}
                <div className="flex h-16 gap-2">
                  <Key
                    onPress={() => setLayer(layer === "letters" ? "symbols" : "letters")}
                    label="Switch layout"
                    className="flex-[1.5] text-base"
                  >
                    {layer === "letters" ? "123" : "ABC"}
                  </Key>
                  {isEmail ? (
                    <>
                      <Key onPress={() => type("@")}>@</Key>
                      <Key onPress={() => type(".")}>.</Key>
                      <Key onPress={() => type(".de")} className="text-base">
                        .de
                      </Key>
                      <Key onPress={() => type(".com")} className="text-base">
                        .com
                      </Key>
                    </>
                  ) : (
                    <>
                      <Key onPress={() => type(",")}>,</Key>
                      <Key onPress={() => type(" ")} label="Space" className="flex-[5]">
                        <span className="h-1 w-16 rounded-full bg-current opacity-30" />
                      </Key>
                      <Key onPress={() => type(".")}>.</Key>
                    </>
                  )}
                  <Key onPress={hide} label="Hide keyboard">
                    <ChevronDown className="size-6" />
                  </Key>
                  <Key onPress={enter} label="Enter" className="flex-[1.75] bg-accent text-accent-fg active:bg-accent">
                    <CornerDownLeft className="size-6" />
                  </Key>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
