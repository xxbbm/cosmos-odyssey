import { useCallback, useEffect, useRef, useState } from "react";

// Entire score is synthesized locally. A user gesture creates the AudioContext.
export function useAmbientAudio(journey) {
  const audio = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const desired = useRef(false);
  const toggle = useCallback(async () => {
    try {
      if (!audio.current) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) throw new Error("Audio unsupported");
        const ctx = new Context();
        const master = ctx.createGain();
        master.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 420;
        const compressor = ctx.createDynamicsCompressor();
        filter.connect(compressor);
        compressor.connect(master);
        master.connect(ctx.destination);
        const nodes = [];
        [41.203, 61.735, 82.407, 123.471, 164.814].forEach((frequency, i) => {
          const osc = ctx.createOscillator(),
            gain = ctx.createGain(),
            pan = ctx.createStereoPanner();
          osc.type = i < 3 ? "sine" : "triangle";
          osc.frequency.value = frequency;
          osc.detune.value = i % 2 ? -5 : 4;
          gain.gain.value = i < 2 ? 0.19 : 0.035;
          pan.pan.value = (i - 2) * 0.3;
          osc.connect(gain);
          gain.connect(pan);
          pan.connect(filter);
          osc.start();
          nodes.push(osc);
        });
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < data.length; i++) {
          previous = (previous + (Math.random() * 2 - 1) * 0.025) / 1.025;
          data[i] = previous * 2;
        }
        const air = ctx.createBufferSource(),
          airGain = ctx.createGain();
        air.buffer = buffer;
        air.loop = true;
        airGain.gain.value = 0.11;
        air.connect(airGain);
        airGain.connect(filter);
        air.start();
        nodes.push(air);
        const lfo = ctx.createOscillator(),
          depth = ctx.createGain();
        lfo.frequency.value = 0.07;
        depth.gain.value = 90;
        lfo.connect(depth);
        depth.connect(filter.frequency);
        lfo.start();
        nodes.push(lfo);
        audio.current = { ctx, master, filter, nodes };
      }
      const { ctx, master } = audio.current;
      const next = !desired.current;
      desired.current = next;
      if (next) await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(next ? 0.38 : 0, ctx.currentTime, 0.65);
      setEnabled(next);
    } catch {
      setUnavailable(true);
      setEnabled(false);
      desired.current = false;
    }
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => {
      const a = audio.current;
      if (a && desired.current && !document.hidden)
        a.filter.frequency.setTargetAtTime(
          230 + Math.sin(journey.current.progress * Math.PI) * 450,
          a.ctx.currentTime,
          2,
        );
    }, 500);
    const visibility = () => {
      if (!audio.current) return;
      if (document.hidden) audio.current.ctx.suspend();
      else if (desired.current) audio.current.ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      audio.current?.nodes.forEach((n) => n.stop());
      audio.current?.ctx.close();
    };
  }, [journey]);
  return { enabled, unavailable, toggle };
}
