import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import Universe from "./scene/Universe";
import { useEvolution } from "./hooks/useEvolution";
import { useAmbientAudio } from "./hooks/useAmbientAudio";
import { CHAPTER_NAMES } from "./scene/cinematic";
import Observatory from "./Observatory";

class SpaceBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error) {
    console.error("WebGL initialization failed", error);
    this.props.onError();
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

export default function App() {
  const { journey, snapshot, hidden } = useEvolution();
  const [failed, setFailed] = useState(false);
  const { toggle, enabled } = useAmbientAudio(journey);
  const handleReady = useCallback(() => {
    journey.current.ready = true;
  }, [journey]);
  const handleError = useCallback(() => {
    journey.current.ready = false;
    setFailed(true);
  }, [journey]);
  useEffect(() => {
    journey.current.contextLost = handleError;
    const mute = (event) => {
      if (event.code === "KeyM" && !event.repeat) toggle();
    };
    window.addEventListener("keydown", mute);
    return () => window.removeEventListener("keydown", mute);
  }, [journey, handleError, toggle]);
  useLayoutEffect(() => {
    const mode = snapshot.site ? "site" : "intro";
    document.body.dataset.experience = mode;
    document.documentElement.dataset.experience = mode;
  }, [snapshot.site]);
  return (
    <main
      className={`experience ${snapshot.site ? "experience-site" : "immersive-stage"}`}
      aria-label="Cosmos Odyssey 宇宙观测站"
      aria-busy={snapshot.busy}
      data-stage={snapshot.stage}
      data-experience={snapshot.site ? "site" : "intro"}
      data-transitioning={snapshot.busy}
    >
      <div className="universe-layer">
        <SpaceBoundary onError={handleError}>
          <Universe journey={journey} onReady={handleReady} paused={hidden} />
        </SpaceBoundary>
      </div>
      {!snapshot.site && (
        <>
          <div className="sr-only" aria-live="polite">
            {CHAPTER_NAMES[snapshot.stage]}
          </div>
          <p className="sr-only">
            点击、Enter 或空格推进序章。银河阶段向下滚动，进入正式观测站。
          </p>
        </>
      )}
      {snapshot.site && (
        <Observatory
          journey={journey}
          audioEnabled={enabled}
          onToggleAudio={toggle}
        />
      )}
      {failed && (
        <div className="render-error" role="alert">
          <p>
            WebGL 2 is unavailable. Enable browser hardware acceleration and
            reload.
          </p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}
      <noscript>
        This visual experience requires JavaScript and WebGL 2.
      </noscript>
    </main>
  );
}
