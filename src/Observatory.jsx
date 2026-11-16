import { useCallback, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { SITE_IDS } from "./scene/cinematic";

gsap.registerPlugin(ScrollTrigger);
const CHAPTERS = [
  {
    name: "观测站",
    english: "THE OBSERVATORY",
    title: (
      <>
        沿着光，
        <br />
        看见宇宙。
      </>
    ),
    copy: "从恒星的表面，到星系之间的暗处。五次观测，带你亲手探索光、物质与引力。",
    side: "left",
  },
  {
    name: "恒星",
    english: "LIGHT & TEMPERATURE",
    title: (
      <>
        光的
        <br />
        诞生。
      </>
    ),
    copy: "恒星是由引力束缚的等离子体。核心的核聚变持续释放能量，最终成为抵达我们的光。改变温度，观察星光的颜色。",
    side: "left",
    source: "https://science.nasa.gov/sun/facts/",
  },
  {
    name: "冰环",
    english: "ICE IN ORBIT",
    title: (
      <>
        冰的
        <br />
        轨道。
      </>
    ),
    copy: "看似完整的环，由无数冰粒、尘埃与岩屑独立绕行。改变观察的倾角，看一条细线如何展开成一片冰的海洋。",
    side: "right",
    source: "https://science.nasa.gov/mission/cassini/faq/",
  },
  {
    name: "星云",
    english: "INSIDE THE NURSERY",
    title: (
      <>
        照亮
        <br />
        暗处。
      </>
    ),
    copy: "新恒星从气体与尘埃聚集的云中诞生。明亮的气体与遮住星光的暗尘，构成同一片云的两种面貌。",
    side: "left",
    source: "https://science.nasa.gov/universe/stars/",
  },
  {
    name: "引力",
    english: "AT THE EVENT HORIZON",
    title: (
      <>
        看见
        <br />
        引力。
      </>
    ),
    copy: "黑洞周围的时空改变了光的路径。背景的光被扭曲、放大，炽热的吸积物质勾勒出我们无法直接看见的边界。",
    side: "left",
    source: "https://science.nasa.gov/universe/black-holes/",
  },
  {
    name: "深空",
    english: "A CONNECTED UNIVERSE",
    title: (
      <>
        宇宙
        <br />
        没有孤岛。
      </>
    ),
    copy: "把视野放到足够远，星系、星系团与巨大的空洞会显现为丝状的网络。此刻，一条旋臂只是其中一个节点。",
    side: "right",
    source:
      "https://science.nasa.gov/universe/galaxies/large-scale-structures/",
  },
];

function OrbitIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="8.5" stroke="currentColor" strokeWidth=".8" />
      <ellipse
        cx="16"
        cy="16"
        rx="15"
        ry="4.5"
        transform="rotate(-35 16 16)"
        stroke="currentColor"
        strokeWidth=".8"
      />
      <circle cx="24" cy="10" r="1.25" fill="currentColor" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  left,
  right,
}) {
  return (
    <div className="instrument">
      <div className="instrument-title">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="range-ends">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

export default function Observatory({ journey, audioEnabled, onToggleAudio }) {
  const root = useRef(),
    panels = useRef([]),
    smooth = useRef(),
    progressLine = useRef(),
    drag = useRef(null);
  const [active, setActive] = useState(
      Math.round(journey.current.site.progress),
    ),
    [menu, setMenu] = useState(false),
    [cinema, setCinema] = useState(false),
    [selection, setSelection] = useState(0);
  const [params, setParams] = useState(() => ({
    ...journey.current.site.params,
  }));
  const activeRef = useRef(active);
  const change = useCallback(
    (key, value) => {
      journey.current.site.params[key] = value;
      setParams((p) => ({ ...p, [key]: value }));
    },
    [journey],
  );
  const go = useCallback(
    (index) => {
      const target = document.getElementById(SITE_IDS[index]);
      smooth.current?.scrollTo(target, {
        duration: journey.current.reduced ? 0 : 2.2,
        immediate: journey.current.reduced,
      });
      history.replaceState(null, "", `#${SITE_IDS[index]}`);
      setMenu(false);
    },
    [journey],
  );
  useLayoutEffect(() => {
    const j = journey.current,
      site = j.site;
    const lenis = new Lenis({
      duration: j.reduced ? 0.1 : 1.35,
      smoothWheel: !j.reduced,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.1,
    });
    smooth.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time) => {
      lenis.raf(time * 1000);
      update();
    };
    gsap.ticker.add(tick);
    const update = () => {
      const p = site.progress,
        index = Math.round(p);
      progressLine.current?.style.setProperty("--progress", p / 5);
      panels.current.forEach((panel, i) => {
        if (!panel) return;
        const d = Math.abs(p - i),
          opacity = 1 - gsap.utils.clamp(0, 1, (d - 0.12) / 0.58);
        panel.style.opacity = String(opacity);
        panel.style.transform = `translateY(${gsap.utils.clamp(-28, 28, (i - p) * 36)}px)`;
        panel.style.pointerEvents = opacity > 0.6 ? "auto" : "none";
        panel.inert = opacity < 0.08;
      });
      if (index !== activeRef.current) {
        activeRef.current = index;
        setActive(index);
      }
    };
    const tween = gsap.fromTo(
      site,
      { progress: 0 },
      {
        progress: 5,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom bottom",
          scrub: j.reduced ? true : 1.35,
          invalidateOnRefresh: true,
        },
        onUpdate: update,
      },
    );
    const hashIndex = SITE_IDS.indexOf(location.hash.slice(1));
    ScrollTrigger.refresh();
    if (hashIndex > 0) {
      lenis.scrollTo(document.getElementById(SITE_IDS[hashIndex]), {
        immediate: true,
        force: true,
      });
      tween.progress(hashIndex / 5);
    } else {
      lenis.scrollTo(0, { immediate: true });
      site.progress = 0;
    }
    update();
    site.onSelection = (index) => setSelection(index);
    const visibility = () => (document.hidden ? lenis.stop() : lenis.start());
    const escape = (event) => {
      if (event.key === "Escape") {
        setMenu(false);
        setCinema(false);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", escape);
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.ticker.remove(tick);
      lenis.destroy();
      site.onSelection = null;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", escape);
    };
  }, [journey]);
  const selectNode = () => {
    const site = journey.current.site,
      nodes = site.nodes ?? [];
    if (!nodes.length) return;
    const index = (site.selection + 1) % nodes.length;
    site.selection = index;
    site.selectedPosition.copy(nodes[index]);
    setSelection(index);
  };
  const resetView = () => {
    const site = journey.current.site;
    site.selection = 0;
    site.selectedPosition.set(120, 0, -100);
    setSelection(0);
    for (const [key, value] of Object.entries({
      orbitYaw: 0,
      orbitPitch: 0,
      zoom: 1,
    }))
      change(key, value);
  };
  const pointerDown = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: 0,
    };
  };
  const pointerMove = (event) => {
    if (!drag.current) return;
    const d = drag.current,
      dx = event.clientX - d.lastX,
      dy = event.clientY - d.lastY;
    d.lastX = event.clientX;
    d.lastY = event.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    journey.current.site.params.orbitYaw += dx * 0.004;
    journey.current.site.params.orbitPitch = gsap.utils.clamp(
      -0.5,
      0.5,
      journey.current.site.params.orbitPitch + dy * 0.0025,
    );
  };
  const pointerUp = (event) => {
    if (drag.current && drag.current.moved < 6)
      journey.current.site.request = {
        x: (event.clientX / innerWidth) * 2 - 1,
        y: 1 - (event.clientY / innerHeight) * 2,
      };
    drag.current = null;
  };
  return (
    <div
      ref={root}
      className={`observatory ${cinema ? "is-cinema" : ""}`}
      data-chapter={active}
    >
      <header className="site-header" inert={cinema}>
        <a
          className="site-brand"
          href="#observatory"
          onClick={(e) => {
            e.preventDefault();
            go(0);
          }}
        >
          <OrbitIcon />
          <span>
            COSMOS<span className="brand-divider">/</span>观测站
          </span>
        </a>
        <nav
          className={`site-nav ${menu ? "is-open" : ""}`}
          aria-label="观测章节"
        >
          {CHAPTERS.map((chapter, i) => (
            <a
              key={chapter.name}
              href={`#${SITE_IDS[i]}`}
              aria-current={active === i ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(i);
              }}
            >
              {chapter.name}
              <span>0{i + 1}</span>
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="text-button cinema-button"
            onClick={() => setCinema(true)}
          >
            只看宇宙
          </button>
          <button
            className={`audio-button ${audioEnabled ? "is-on" : ""}`}
            aria-pressed={audioEnabled}
            onClick={onToggleAudio}
            aria-label={audioEnabled ? "关闭氛围音" : "开启氛围音"}
          >
            <span />
            <span />
            <span />
          </button>
          <button
            className="menu-button"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            章节 <span>{menu ? "−" : "+"}</span>
          </button>
        </div>
      </header>
      {CHAPTERS.map((chapter, i) => (
        <section
          className={`observation chapter-${i}`}
          id={SITE_IDS[i]}
          key={chapter.name}
          aria-label={chapter.name}
        >
          <div
            ref={(node) => {
              panels.current[i] = node;
            }}
            className={`chapter-panel panel-${chapter.side}`}
            aria-hidden={active !== i}
          >
            <div className="chapter-shade" />
            <article className="chapter-copy">
              <div className="chapter-eyebrow">
                <span>{i === 0 ? "序" : "0" + i}</span>
                <i />
                <span>{chapter.english}</span>
              </div>
              {i === 0 ? <h1>{chapter.title}</h1> : <h2>{chapter.title}</h2>}
              <p className="chapter-description">{chapter.copy}</p>
              {i === 0 && (
                <>
                  <button className="observe-link" onClick={() => go(1)}>
                    开始五次观测 <Arrow />
                  </button>
                  <p className="hero-note">以光为线索，以滚动改变尺度。</p>
                </>
              )}
              {i === 1 && (
                <div className="chapter-instruments">
                  <div className="spectrum-strip" aria-hidden="true" />
                  <RangeControl
                    id="temperature"
                    label="恒星表面温度"
                    value={params.temperature}
                    min={3500}
                    max={12000}
                    step={100}
                    onChange={(value) => change("temperature", value)}
                    display={`${params.temperature.toLocaleString()} K`}
                    left="暖红"
                    right="蓝白"
                  />
                  <p className="instrument-note">
                    拖动温度，改变眼前的星光。颜色为视觉示意。
                  </p>
                </div>
              )}
              {i === 2 && (
                <div className="chapter-instruments">
                  <RangeControl
                    id="ring-angle"
                    label="观测倾角"
                    value={params.ringTilt}
                    min={-0.34}
                    max={0.34}
                    step={0.01}
                    onChange={(value) => change("ringTilt", value)}
                    display={`${Math.round((params.ringTilt * 180) / Math.PI)}°`}
                    left="掠过环面"
                    right="俯瞰冰海"
                  />
                  <div className="material-notes">
                    <span>水冰</span>
                    <i />
                    <span>尘埃</span>
                    <i />
                    <span>岩屑</span>
                  </div>
                </div>
              )}
              {i === 3 && (
                <div className="chapter-instruments">
                  <div
                    className="choice-row"
                    role="group"
                    aria-label="星云照明"
                  >
                    <button
                      aria-pressed={Boolean(params.probe)}
                      className={params.probe ? "selected" : ""}
                      onClick={() => change("probe", 1)}
                    >
                      探照
                    </button>
                    <button
                      aria-pressed={!params.probe}
                      className={!params.probe ? "selected" : ""}
                      onClick={() => change("probe", 0)}
                    >
                      自然光
                    </button>
                  </div>
                  <p className="instrument-note">
                    移动光标，把光投向尘柱。手机可轻触画面探照。
                  </p>
                  <div className="probe-swatch">
                    <span />
                    <p>在暗处，仍有正在诞生的恒星。</p>
                  </div>
                </div>
              )}
              {i === 4 && (
                <div className="chapter-instruments">
                  <RangeControl
                    id="lensing"
                    label="光线弯折强度"
                    value={params.lens}
                    min={0.65}
                    max={1.4}
                    step={0.01}
                    onChange={(value) => change("lens", value)}
                    display={`${params.lens.toFixed(2)}×`}
                    left="较弱"
                    right="较强"
                  />
                  <p className="instrument-note">
                    调整光路，观察吸积盘上下方的弯折影像。此处为视觉实验。
                  </p>
                </div>
              )}
              {i === 5 && (
                <div className="chapter-instruments">
                  <div
                    className="choice-row"
                    role="group"
                    aria-label="观测尺度"
                  >
                    <button
                      aria-pressed={!params.depth}
                      className={!params.depth ? "selected" : ""}
                      onClick={() => change("depth", 0)}
                    >
                      星系
                    </button>
                    <button
                      aria-pressed={Boolean(params.depth)}
                      className={params.depth ? "selected" : ""}
                      onClick={() => change("depth", 1)}
                    >
                      宇宙网
                    </button>
                  </div>
                  <p className="instrument-note">
                    在画面上拖动以环绕观察。展开宇宙网后，可点亮节点。
                  </p>
                  <div className="map-actions">
                    <button onClick={selectNode} disabled={!params.depth}>
                      下一个节点{" "}
                      <span>{String(selection).padStart(2, "0")}</span>
                    </button>
                    <button onClick={resetView}>视角归中</button>
                  </div>
                  <button className="return-link" onClick={() => go(0)}>
                    回到观测站 <Arrow />
                  </button>
                </div>
              )}
              {chapter.source && (
                <a
                  className="source-link"
                  href={chapter.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  观测笔记 / NASA <span>↗</span>
                </a>
              )}
            </article>
            {i === 0 && (
              <div className="hero-vertical">
                A JOURNEY THROUGH LIGHT & GRAVITY
              </div>
            )}
            {i === 5 && (
              <>
                <div
                  className="orbit-surface"
                  role="application"
                  tabIndex={0}
                  aria-label="拖动旋转星系，方向键也可调整视角"
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                  onKeyDown={(e) => {
                    if (
                      [
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      const key =
                        e.key.includes("Left") || e.key.includes("Right")
                          ? "orbitYaw"
                          : "orbitPitch";
                      journey.current.site.params[key] +=
                        e.key === "ArrowRight" || e.key === "ArrowDown"
                          ? 0.06
                          : -0.06;
                    }
                  }}
                />
                <p className="site-disclaimer">
                  空间关系与光效为艺术化示意 · 科普介绍参考 NASA
                </p>
              </>
            )}
          </div>
        </section>
      ))}
      <div className="site-bottom" inert={cinema}>
        <span className="chapter-caption">
          {String(active + 1).padStart(2, "0")} <i /> {CHAPTERS[active].name}
        </span>
        <div ref={progressLine} className="site-progress">
          <span />
        </div>
        <button onClick={() => go(active === 5 ? 0 : active + 1)}>
          {active === 5 ? "回到观测站" : "向下观测"}
          <svg viewBox="0 0 12 18" fill="none" aria-hidden="true">
            <path
              d="M6 1v15m-4-4 4 4 4-4"
              stroke="currentColor"
              strokeWidth=".8"
            />
          </svg>
        </button>
      </div>
      {cinema && (
        <button className="restore-copy" onClick={() => setCinema(false)}>
          返回介绍
        </button>
      )}
      <div className="sr-only" aria-live="polite">
        当前章节：{CHAPTERS[active].name}
      </div>
    </div>
  );
}
