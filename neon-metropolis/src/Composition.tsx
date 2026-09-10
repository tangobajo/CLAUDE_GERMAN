import {
  AbsoluteFill,
  Composition,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = {};

// Deterministic pseudo-random in [0, 1), seeded by index so layout is stable across frames/renders.
const seeded = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const BUILDING_COUNT_FAR = 14;
const BUILDING_COUNT_MID = 11;
const BUILDING_COUNT_NEAR = 7;
const RAINDROP_COUNT = 140;
const VEHICLE_COUNT = 16;
const FISH_COUNT = 3;

const SkylineLayer: React.FC<{
  count: number;
  seedBase: number;
  color: string;
  minHeight: number;
  maxHeight: number;
  windowColor: string;
}> = ({ count, seedBase, color, minHeight, maxHeight, windowColor }) => {
  const buildings = Array.from({ length: count }, (_, i) => i);
  const slotWidth = 100 / count;

  return (
    <>
      {buildings.map((i) => {
        const s = seeded(seedBase + i * 7.31);
        const h = minHeight + s * (maxHeight - minHeight);
        const w = slotWidth * (0.55 + seeded(seedBase + i * 3.1) * 0.4);
        const left = i * slotWidth + (slotWidth - w) / 2;
        const litWindows = seeded(seedBase + i * 5.77) > 0.4;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: 0,
              left: `${left}%`,
              width: `${w}%`,
              height: `${h}%`,
              backgroundColor: color,
              backgroundImage: litWindows
                ? `repeating-linear-gradient(0deg, transparent 0px, transparent 9px, ${windowColor} 9px, ${windowColor} 11px), repeating-linear-gradient(90deg, transparent 0px, transparent 13px, ${windowColor} 13px, ${windowColor} 15px)`
                : undefined,
              backgroundBlendMode: "screen",
              opacity: 0.55 + seeded(seedBase + i * 2.2) * 0.3,
            }}
          />
        );
      })}
    </>
  );
};

const RainLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drops = Array.from({ length: RAINDROP_COUNT }, (_, i) => i);

  return (
    <>
      {drops.map((i) => {
        const seed = i * 4.213;
        const x = seeded(seed) * width;
        const speed = 26 + seeded(seed + 1) * 22;
        const len = 40 + seeded(seed + 2) * 70;
        const startOffset = seeded(seed + 3) * (height + 200);
        const y =
          ((frame * speed + startOffset) % (height + 200)) - 100;
        const opacity = 0.15 + seeded(seed + 4) * 0.35;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 2,
              height: len,
              background:
                "linear-gradient(180deg, transparent, rgba(200,225,255,0.9), transparent)",
              transform: "rotate(-9deg)",
              opacity,
            }}
          />
        );
      })}
    </>
  );
};

const TrafficLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vehicles = Array.from({ length: VEHICLE_COUNT }, (_, i) => i);

  return (
    <>
      {vehicles.map((i) => {
        const seed = i * 8.91;
        const laneY = height * (0.12 + seeded(seed) * 0.5);
        const speed = 9 + seeded(seed + 1) * 16;
        const trailLength = 90 + seeded(seed + 2) * 140;
        const startOffset = seeded(seed + 3) * (width + trailLength * 2);
        const goingRight = seeded(seed + 4) > 0.5;
        const rawX =
          ((frame * speed + startOffset) % (width + trailLength * 2)) -
          trailLength;
        const x = goingRight ? rawX : width - rawX;
        const hue = seeded(seed + 5) > 0.5 ? "#5ef1ff" : "#ff5ef0";

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: laneY,
              width: trailLength,
              height: 3,
              background: `linear-gradient(${
                goingRight ? "90deg" : "270deg"
              }, transparent, ${hue})`,
              filter: "blur(1px)",
              boxShadow: `0 0 8px 2px ${hue}`,
              opacity: 0.85,
            }}
          />
        );
      })}
    </>
  );
};

const HolographicFish: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const seed = index * 17.3;
  const baseX = width * (0.2 + seeded(seed) * 0.6);
  const baseY = height * (0.18 + seeded(seed + 1) * 0.25);
  const phase = seeded(seed + 2) * durationInFrames;
  const size = 90 + seeded(seed + 3) * 70;

  const swimX = interpolate(
    (frame + phase) % durationInFrames,
    [0, durationInFrames * 0.25, durationInFrames * 0.5, durationInFrames * 0.75, durationInFrames],
    [0, 60, 0, -60, 0],
    { easing: Easing.inOut(Easing.ease) },
  );
  const swimY = interpolate(
    (frame + phase) % durationInFrames,
    [0, durationInFrames * 0.33, durationInFrames * 0.66, durationInFrames],
    [0, -30, 30, 0],
    { easing: Easing.inOut(Easing.ease) },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: baseX + swimX,
        top: baseY + swimY,
        width: size,
        height: size * 0.55,
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse at 35% 40%, rgba(255,215,120,0.95), rgba(255,170,40,0.35) 60%, transparent 75%)",
        filter: "blur(2px)",
        boxShadow: "0 0 40px 12px rgba(255,190,60,0.35)",
        opacity: 0.75,
      }}
    />
  );
};

export const NeonMetropolis: React.FC<Props> = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill name="Neon Metropolis" style={{ backgroundColor: "#050208", overflow: "hidden" }}>
      <Interactive.Div
        name="Camera Dolly"
        style={{
          position: "absolute",
          inset: 0,
          scale: interpolate(frame, [0, durationInFrames], [1, 1.14], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.linear,
            output: "perceptual-scale",
          }),
        }}
      >
        <Interactive.Div
          name="Dusk Sky"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, #1a0b2e 0%, #3a1250 22%, #7a1f5c 42%, #c23a5e 58%, #2a0e3a 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(255,120,200,0.18), transparent 55%), radial-gradient(ellipse at 75% 15%, rgba(90,220,255,0.14), transparent 50%)",
          }}
        />

        <Interactive.Div
          name="Skyline Far"
          style={{
            position: "absolute",
            left: 0,
            bottom: "18%",
            width: "130%",
            height: "48%",
            translate: interpolate(frame, [0, durationInFrames], ["0px 0px", "-90px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.linear,
            }),
            opacity: 0.55,
            filter: "brightness(0.7) blur(0.5px)",
          }}
        >
          <SkylineLayer
            count={BUILDING_COUNT_FAR}
            seedBase={11}
            color="#241333"
            minHeight={35}
            maxHeight={85}
            windowColor="rgba(255,200,120,0.5)"
          />
        </Interactive.Div>

        <Interactive.Div
          name="Skyline Mid"
          style={{
            position: "absolute",
            left: 0,
            bottom: "10%",
            width: "130%",
            height: "58%",
            translate: interpolate(frame, [0, durationInFrames], ["0px 0px", "-220px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.linear,
            }),
            opacity: 0.8,
          }}
        >
          <SkylineLayer
            count={BUILDING_COUNT_MID}
            seedBase={53}
            color="#170a20"
            minHeight={45}
            maxHeight={100}
            windowColor="rgba(120,230,255,0.55)"
          />
        </Interactive.Div>

        <div style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: FISH_COUNT }, (_, i) => (
            <HolographicFish key={i} index={i} />
          ))}
        </div>

        <div style={{ position: "absolute", inset: 0 }}>
          <TrafficLayer />
        </div>

        <Interactive.Div
          name="Skyline Near"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "140%",
            height: "38%",
            translate: interpolate(frame, [0, durationInFrames], ["0px 0px", "-420px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.linear,
            }),
          }}
        >
          <SkylineLayer
            count={BUILDING_COUNT_NEAR}
            seedBase={97}
            color="#0a0510"
            minHeight={60}
            maxHeight={100}
            windowColor="rgba(255,90,220,0.5)"
          />
        </Interactive.Div>

        <Interactive.Div
          name="Volumetric Fog"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "30%",
            background:
              "linear-gradient(0deg, rgba(120,60,180,0.35), transparent)",
            filter: "blur(18px)",
          }}
        />

        <div style={{ position: "absolute", inset: 0 }}>
          <RainLayer />
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Glass Droplets"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 15% 30%, rgba(255,255,255,0.14) 0%, transparent 3%), radial-gradient(circle at 22% 55%, rgba(255,255,255,0.1) 0%, transparent 2.5%), radial-gradient(circle at 8% 70%, rgba(255,255,255,0.12) 0%, transparent 2%), radial-gradient(circle at 85% 20%, rgba(255,255,255,0.1) 0%, transparent 3%), radial-gradient(circle at 90% 60%, rgba(255,255,255,0.12) 0%, transparent 2.5%)",
          filter: "blur(1.5px)",
          opacity: 0.8,
        }}
      />

      <Interactive.Div
        name="Color Grade"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,70,180,0.08), rgba(50,220,255,0.06))",
          mixBlendMode: "overlay",
        }}
      />

      <Interactive.Div
        name="Vignette"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="NeonMetropolis"
      component={NeonMetropolis}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
