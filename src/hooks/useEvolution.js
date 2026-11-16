import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { createJourney, makeFlight, TRANSITIONS } from "../scene/cinematic";

export function useEvolution() {
  const journey = useRef(
    createJourney(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  );
  const timeline = useRef(null);
  const suppressClick = useRef(0);
  const [snapshot, setSnapshot] = useState({
    stage: journey.current.stage,
    busy: false,
    site: journey.current.experience === "site",
  });
  const [hidden, setHidden] = useState(document.hidden);
  const evolve = useCallback((warp = false) => {
    const j = journey.current;
    if (!j.ready || j.busy || document.hidden || j.experience !== "intro")
      return false;
    if (j.stage === 4 && !warp) return false;
    if (warp && j.stage !== 4) return false;
    const to = j.stage + 1;
    const { mode, duration } = TRANSITIONS[j.stage];
    Object.assign(j, {
      from: j.stage,
      to,
      phase: 0,
      busy: true,
      mode,
      flight: makeFlight(j.stage, to, mode, j.posePosition, j.poseTarget),
    });
    if (warp) j.experience = "handoff";
    setSnapshot({ stage: j.stage, busy: true, site: false });
    timeline.current = gsap.to(j, {
      phase: 1,
      duration: j.reduced ? 2.2 : duration,
      ease: "none",
      onComplete: () => {
        Object.assign(j, {
          stage: to,
          from: to,
          to,
          busy: false,
          phase: 0,
          mode: "idle",
          warp: 0,
          sceneTime: 0,
        });
        if (to === 5) j.experience = "site";
        setSnapshot({ stage: to, busy: false, site: to === 5 });
      },
    });
    return true;
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => {
      journey.current.reduced = media.matches;
    };
    const click = (event) => {
      if (event.button === 0 && performance.now() > suppressClick.current)
        evolve();
    };
    const key = (event) => {
      if (journey.current.experience === "site") return;
      if (["Enter", "Space", "NumpadEnter"].includes(event.code)) {
        event.preventDefault();
        if (!event.repeat) evolve();
      }
    };
    const wheel = (event) => {
      if (journey.current.experience === "site") return;
      if (event.ctrlKey) return;
      event.preventDefault();
      if (event.deltaY > 0) evolve(true);
    };
    let touchY = 0;
    const touchStart = (event) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const touchEnd = (event) => {
      if (journey.current.experience === "site") return;
      const delta = touchY - (event.changedTouches[0]?.clientY ?? touchY);
      if (Math.abs(delta) > 25) suppressClick.current = performance.now() + 600;
      if (delta > 40) evolve(true);
    };
    const pointer = (event) => {
      journey.current.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      journey.current.pointer.y = 1 - (event.clientY / window.innerHeight) * 2;
    };
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) timeline.current?.pause();
      else timeline.current?.resume();
    };
    window.addEventListener("click", click);
    window.addEventListener("keydown", key);
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("pointerdown", pointer, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    return () => {
      timeline.current?.kill();
      window.removeEventListener("click", click);
      window.removeEventListener("keydown", key);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("pointerdown", pointer);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
    };
  }, [evolve]);
  return { journey, snapshot, hidden };
}
