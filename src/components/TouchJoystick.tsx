import { Box, CircleDot, MapPin, ScanLine, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

type TouchJoystickProps = {
  onInput: (moveX: number, moveZ: number, sprint: boolean) => void;
  mode?: "directional" | "steering";
  label?: string;
  moveLabel?: string;
  actionLabel?: string;
  onAltitudeInput?: (direction: number) => void;
  onDrop?: () => void;
  dropLabel?: string;
  onPrecisePlace?: () => void;
  precisePlaceLabel?: string;
  precisePlaceActive?: boolean;
  onPickUp?: () => void;
  pickUpDisabled?: boolean;
  onView?: () => void;
  viewLabel?: string;
  onRelease?: () => void;
  releasePending?: boolean;
};

export function TouchJoystick({
  onInput,
  mode = "directional",
  label = "Resident touch controls",
  moveLabel = "Move resident",
  actionLabel = "Brisk",
  onAltitudeInput,
  onDrop,
  dropLabel = "Place here",
  onPrecisePlace,
  precisePlaceLabel = "Choose spot",
  precisePlaceActive = false,
  onPickUp,
  pickUpDisabled = false,
  onView,
  viewLabel = "Their view",
  onRelease,
  releasePending = false
}: TouchJoystickProps) {
  const activePointer = useRef<number | undefined>(undefined);
  const vector = useRef({ x: 0, z: 0 });
  const sprinting = useRef(false);
  const keyboardDirections = useRef(new Set<string>());
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [sprintingState, setSprintingState] = useState(false);
  const [altitudeState, setAltitudeState] = useState(0);
  const instructionsId = useId();

  const emit = () => onInput(vector.current.x, vector.current.z, sprinting.current);
  const setSprint = (next: boolean) => {
    sprinting.current = next;
    setSprintingState(next);
    emit();
  };
  const setAltitude = (next: number) => {
    setAltitudeState(next);
    onAltitudeInput?.(next);
  };

  const updateKeyboardVector = () => {
    const pressed = keyboardDirections.current;
    const x = (pressed.has("ArrowRight") || pressed.has("KeyD") ? 1 : 0) - (pressed.has("ArrowLeft") || pressed.has("KeyA") ? 1 : 0);
    const z = (pressed.has("ArrowUp") || pressed.has("KeyW") ? 1 : 0) - (pressed.has("ArrowDown") || pressed.has("KeyS") ? 1 : 0);
    const magnitude = Math.hypot(x, z);
    vector.current = magnitude > 1 ? { x: x / magnitude, z: z / magnitude } : { x, z };
    setKnob({ x: vector.current.x * 44, y: -vector.current.z * 44 });
    emit();
  };

  const handleMoveKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) return;
    event.preventDefault();
    event.stopPropagation();
    keyboardDirections.current.add(event.code);
    updateKeyboardVector();
  };

  const handleMoveKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!keyboardDirections.current.has(event.code)) return;
    event.preventDefault();
    event.stopPropagation();
    keyboardDirections.current.delete(event.code);
    updateKeyboardVector();
  };

  const update = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = bounds.width * 0.36;
    let x = event.clientX - (bounds.left + bounds.width / 2);
    let y = event.clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(x, y);
    if (distance > radius) {
      x = x / distance * radius;
      y = y / distance * radius;
    }
    const normalizedDistance = Math.min(1, distance / radius);
    const magnitude = normalizedDistance < 0.12 ? 0 : (normalizedDistance - 0.12) / 0.88;
    const directionLength = Math.max(0.0001, Math.hypot(x, y));
    vector.current = { x: x / directionLength * magnitude, z: -y / directionLength * magnitude };
    setKnob({ x: magnitude ? x : 0, y: magnitude ? y : 0 });
    emit();
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = undefined;
    vector.current = { x: 0, z: 0 };
    setKnob({ x: 0, y: 0 });
    emit();
  };

  const callbacks = useRef({ onInput, onAltitudeInput });
  callbacks.current = { onInput, onAltitudeInput };

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      if (Math.hypot(vector.current.x, vector.current.z) <= 0.01) return;
      callbacks.current.onInput(vector.current.x, vector.current.z, sprinting.current);
    }, 180);
    return () => {
      window.clearInterval(heartbeat);
      activePointer.current = undefined;
      keyboardDirections.current.clear();
      vector.current = { x: 0, z: 0 };
      sprinting.current = false;
      callbacks.current.onInput(0, 0, false);
      callbacks.current.onAltitudeInput?.(0);
    };
  }, []);

  return (
    <div className={`touch-controls${onDrop ? " is-flight" : ""}${onPickUp && onRelease ? " is-grounded" : ""}${mode === "steering" ? " is-steering" : ""}`} role="group" aria-label={label}>
      <span id={instructionsId} className="sr-only">
        {mode === "steering"
          ? "Drag up or down to move forward or back. Drag left or right to turn. You can also use the arrow or WASD keys."
          : "Drag the movement pad in any direction, or focus it and use the arrow or WASD keys."}
      </span>
      <div
        className="touch-joystick"
        role="group"
        aria-label={moveLabel}
        aria-describedby={instructionsId}
        tabIndex={0}
        onPointerDown={(event) => {
          activePointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          update(event);
        }}
        onPointerMove={update}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={() => {
          activePointer.current = undefined;
          vector.current = { x: 0, z: 0 };
          setKnob({ x: 0, y: 0 });
          emit();
        }}
        onKeyDown={handleMoveKeyDown}
        onKeyUp={handleMoveKeyUp}
        onBlur={() => {
          keyboardDirections.current.clear();
          vector.current = { x: 0, z: 0 };
          setKnob({ x: 0, y: 0 });
          emit();
        }}
      >
        <span className="touch-joystick__cross" />
        {mode === "steering" && (
          <span className="touch-joystick__steering-labels" aria-hidden="true">
            <span className="is-forward">Forward</span>
            <span className="is-left">Turn</span>
            <span className="is-right">Turn</span>
            <span className="is-back">Back</span>
          </span>
        )}
        <span className="touch-joystick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <button
        type="button"
        className="touch-sprint"
        aria-pressed={sprintingState}
        aria-label={`${actionLabel} ${sprintingState ? "on" : "off"}`}
        title={`Tap to turn ${actionLabel.toLowerCase()} pace ${sprintingState ? "off" : "on"}`}
        onClick={() => setSprint(!sprinting.current)}
      >
        {sprintingState ? `${actionLabel} on` : actionLabel}
      </button>
      {onPickUp && onRelease && (
        <div className="touch-ground-actions" role="group" aria-label="Controlled citizen actions">
          <button type="button" className="touch-pick-up" disabled={pickUpDisabled} onClick={onPickUp}>
            <Box aria-hidden="true" />
            <span>Pick up</span>
          </button>
          {onView && (
            <button type="button" onClick={onView}>
              <ScanLine aria-hidden="true" />
              <span>{viewLabel}</span>
            </button>
          )}
          <button type="button" disabled={releasePending} onClick={() => onRelease()}>
            <CircleDot aria-hidden="true" />
            <span>{releasePending ? "Stopping…" : "Stop control"}</span>
          </button>
        </div>
      )}
      {onAltitudeInput && onDrop && (
        <div className="touch-flight-actions" role="group" aria-label="Lifted citizen flight and placement controls">
          <button
            type="button"
            aria-pressed={altitudeState === 1}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setAltitude(1); }}
            onPointerUp={() => setAltitude(0)}
            onPointerCancel={() => setAltitude(0)}
            onLostPointerCapture={() => setAltitude(0)}
            onKeyDown={(event) => {
              if (!["Enter", "Space"].includes(event.code) || event.repeat) return;
              event.preventDefault();
              event.stopPropagation();
              setAltitude(1);
            }}
            onKeyUp={(event) => {
              if (!["Enter", "Space"].includes(event.code)) return;
              event.preventDefault();
              event.stopPropagation();
              setAltitude(0);
            }}
          ><span>Raise</span></button>
          <button
            type="button"
            aria-pressed={altitudeState === -1}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setAltitude(-1); }}
            onPointerUp={() => setAltitude(0)}
            onPointerCancel={() => setAltitude(0)}
            onLostPointerCapture={() => setAltitude(0)}
            onKeyDown={(event) => {
              if (!["Enter", "Space"].includes(event.code) || event.repeat) return;
              event.preventDefault();
              event.stopPropagation();
              setAltitude(-1);
            }}
            onKeyUp={(event) => {
              if (!["Enter", "Space"].includes(event.code)) return;
              event.preventDefault();
              event.stopPropagation();
              setAltitude(0);
            }}
          ><span>Lower</span></button>
          <button type="button" className="touch-drop" onClick={onDrop}>
            <Box aria-hidden="true" />
            <span>{dropLabel}</span>
          </button>
          {onPrecisePlace && (
            <button
              type="button"
              className={`touch-precise-place${precisePlaceActive ? " is-active" : ""}`}
              aria-pressed={precisePlaceActive}
              onClick={onPrecisePlace}
            >
              {precisePlaceActive ? <X aria-hidden="true" /> : <MapPin aria-hidden="true" />}
              <span>{precisePlaceLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
