/**
 * @jest-environment node
 *
 * Daylight: where the sun is, what colour it is, which of the scene's lights it
 * is (and that it is not a second one), and how much of it a room receives.
 *
 * Everything here is arithmetic on the CPU — a direction, a colour temperature,
 * a ratio of areas. Nothing is rasterised. What this file cannot prove: that a
 * sunlit interior looks right, that the shadow reads the way a person expects,
 * or what a frame costs on a GPU. The daylight reuses the lights the viewer
 * already had (no extra draw call, no shadow map), so the frame cost it claims
 * is zero rather than measured; `tools/perf` on a machine with a GPU is where
 * that would be checked, and it is reported as unverified instead.
 */
import {
  DEFAULT_SUN,
  FILL_INTENSITY,
  LEGACY_KEY_COLOR,
  LEGACY_KEY_POSITION,
  SKY_INTENSITY,
  SUN_INTENSITY,
  colorTemperatureRgb,
  sceneLightRig,
  sunColor,
  sunColorTemperatureK,
  sunDirection,
  type SceneDirection,
} from "../src/atmosphere/daylight";
import {
  ASSUMED_CEILING_M,
  DAYLIGHT_TRANSMITTANCE,
  DOOR_TRANSMITTANCE,
  daylightAt,
  roomDaylight,
  type DaylightModel,
  type DaylightOpening,
  type DaylightRoom,
  type DaylightWall,
  type RoomDaylight,
} from "../src/atmosphere/room-daylight";

/** Kernel plan (x east, y north) metres-or-millimetres -> scene (x east, y up, z south). */
function planToScene(dx: number, dy: number): SceneDirection {
  return [dx, 0, -dy];
}

function dot(a: SceneDirection, b: SceneDirection): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function only(rooms: readonly RoomDaylight[]): RoomDaylight {
  const room = rooms[0];
  if (room === undefined) throw new Error("no room daylight returned");
  return room;
}

describe("the sun's direction", () => {
  it("gives a known vector for a known pair of angles", () => {
    // Scene axes: X east, Y up, Z south. Azimuth counts clockwise from north.
    const straightUp = sunDirection({ azimuthDeg: 0, altitudeDeg: 90 });
    expect(straightUp[0]).toBeCloseTo(0, 6);
    expect(straightUp[1]).toBeCloseTo(1, 6);
    expect(straightUp[2]).toBeCloseTo(0, 6);

    const northHorizon = sunDirection({ azimuthDeg: 0, altitudeDeg: 0 });
    expect(northHorizon[0]).toBeCloseTo(0, 6);
    expect(northHorizon[1]).toBeCloseTo(0, 6);
    expect(northHorizon[2]).toBeCloseTo(-1, 6);

    const east = sunDirection({ azimuthDeg: 90, altitudeDeg: 0 });
    expect(east[0]).toBeCloseTo(1, 6);
    expect(east[2]).toBeCloseTo(0, 6);

    const southHorizon = sunDirection({ azimuthDeg: 180, altitudeDeg: 0 });
    expect(southHorizon[2]).toBeCloseTo(1, 6);

    const west = sunDirection({ azimuthDeg: 270, altitudeDeg: 0 });
    expect(west[0]).toBeCloseTo(-1, 6);

    // The default sun: 35° up, 30° east of due south.
    const sun = sunDirection({ azimuthDeg: 150, altitudeDeg: 35 });
    expect(sun[0]).toBeCloseTo(0.4096, 3);
    expect(sun[1]).toBeCloseTo(0.5736, 3);
    expect(sun[2]).toBeCloseTo(0.7094, 3);
  });

  it("is a unit vector, so a dot with it is a cosine", () => {
    for (const altitudeDeg of [0, 15, 35, 60, 90]) {
      for (const azimuthDeg of [0, 45, 150, 250, 359]) {
        const d = sunDirection({ azimuthDeg, altitudeDeg });
        expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 12);
      }
    }
    expect(DEFAULT_SUN).toEqual({ azimuthDeg: 150, altitudeDeg: 35 });
  });
});

describe("the sun's colour temperature", () => {
  it("is the documented value at each documented altitude", () => {
    expect(sunColorTemperatureK(0)).toBe(1900);
    expect(sunColorTemperatureK(10)).toBe(2700);
    expect(sunColorTemperatureK(30)).toBe(4500);
    expect(sunColorTemperatureK(60)).toBe(5500);
    expect(sunColorTemperatureK(90)).toBe(6000);
  });

  it("rises with altitude, between the points and across the whole sky", () => {
    expect(sunColorTemperatureK(5)).toBeGreaterThan(1900);
    expect(sunColorTemperatureK(5)).toBeLessThan(2700);
    expect(sunColorTemperatureK(20)).toBeGreaterThan(2700);
    expect(sunColorTemperatureK(20)).toBeLessThan(4500);
    expect(sunColorTemperatureK(45)).toBeGreaterThan(4500);
    expect(sunColorTemperatureK(45)).toBeLessThan(5500);
    for (let altitudeDeg = 0; altitudeDeg < 90; altitudeDeg += 1) {
      expect(sunColorTemperatureK(altitudeDeg + 1)).toBeGreaterThanOrEqual(sunColorTemperatureK(altitudeDeg));
    }
    // Below the horizon and past the zenith clamp to the ends rather than run on.
    expect(sunColorTemperatureK(-20)).toBe(1900);
    expect(sunColorTemperatureK(120)).toBe(6000);
  });

  it("is a warm colour low down and a near-neutral one high up", () => {
    const red = (rgb: number): number => (rgb >> 16) & 0xff;
    const blue = (rgb: number): number => rgb & 0xff;
    const spread = (rgb: number): number => red(rgb) - blue(rgb);
    const low = sunColor({ azimuthDeg: 150, altitudeDeg: 5 });
    const high = sunColor({ azimuthDeg: 150, altitudeDeg: 70 });
    // A low sun has had its blue scattered out of it: red is well ahead of blue.
    expect(spread(low)).toBeGreaterThan(100);
    expect(red(low)).toBe(255);
    // A high sun is near neutral, and warmer than sRGB's own white point.
    expect(spread(high)).toBeLessThan(35);
    expect(spread(high)).toBeLessThan(spread(low) / 3);
    expect(red(high)).toBe(255);
    expect(blue(high)).toBeGreaterThan(200);
    // The approximation's white is 6600 K, which is why the 6000 K zenith
    // point still reads a shade warm against a white sRGB pixel.
    expect(colorTemperatureRgb(6600)).toBe(0xffffff);
    expect(colorTemperatureRgb(1900)).toBe(sunColor({ azimuthDeg: 0, altitudeDeg: 0 }));
  });
});

describe("the scene's lights are one place", () => {
  /** Every light the rig hands the scene, whatever kind it is. */
  function lightsOf(rig: ReturnType<typeof sceneLightRig>) {
    return [rig.hemisphere, rig.key, rig.fill];
  }

  function ambientOf(rig: ReturnType<typeof sceneLightRig>): number {
    return rig.hemisphere.intensity;
  }

  function directionalOf(rig: ReturnType<typeof sceneLightRig>) {
    return [rig.key, rig.fill];
  }

  it("with daylight off, hands back exactly the rig the viewer always had", () => {
    const rig = sceneLightRig(null);
    expect(rig.hemisphere).toMatchObject({ skyColor: 0xffffff, groundColor: 0x7d8794, intensity: SKY_INTENSITY });
    expect(rig.key).toMatchObject({ color: LEGACY_KEY_COLOR, intensity: SUN_INTENSITY, position: LEGACY_KEY_POSITION });
    expect(rig.fill).toMatchObject({ color: 0xdfe8ff, intensity: FILL_INTENSITY, position: [-50, 30, -40] });
    expect(SKY_INTENSITY).toBe(0.95);
    expect(SUN_INTENSITY).toBe(2.3);
    expect(FILL_INTENSITY).toBe(0.45);
  });

  it("turning daylight on does not add a second sun or a second ambient", () => {
    const off = sceneLightRig(null);
    const on = sceneLightRig(DEFAULT_SUN);
    // Same number of lights, same total intensity: the sun replaces the key
    // light, it does not join it. A second ambient here is a washed-out interior.
    expect(lightsOf(on)).toHaveLength(lightsOf(off).length);
    expect(ambientOf(on)).toBe(ambientOf(off));
    expect(directionalOf(on)).toHaveLength(directionalOf(off).length);
    const total = (rig: ReturnType<typeof sceneLightRig>): number =>
      directionalOf(rig).reduce((sum, light) => sum + light.intensity, 0);
    expect(total(on)).toBe(total(off));
  });

  it("puts the key light where the sun maths says, still in the rig's units", () => {
    const rig = sceneLightRig(DEFAULT_SUN);
    const [x, y, z] = rig.key.position;
    const length = Math.hypot(x, y, z);
    const direction = sunDirection(DEFAULT_SUN);
    expect(x / length).toBeCloseTo(direction[0], 12);
    expect(y / length).toBeCloseTo(direction[1], 12);
    expect(z / length).toBeCloseTo(direction[2], 12);
    // Same intensity as the light it replaced: a second scale would blow the
    // exposure (a sun in lux is ~100 000 against this rig's 2.3).
    expect(rig.key.intensity).toBe(SUN_INTENSITY);
    expect(y).toBeGreaterThan(0);
  });

  it("casts no shadow: a shadow map that resolves a reveal is not free", () => {
    expect(sceneLightRig(DEFAULT_SUN).key.castsShadow).toBe(false);
    expect(sceneLightRig(null).key.castsShadow).toBe(false);
  });
});

// A 4 m x 4 m room, 3 m high, in kernel millimetres: x east, y north.
const ROOM_OUTLINE = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 4000 },
  { x: 0, y: 4000 },
];

const SOUTH_WALL: DaylightWall = { id: "w-south", start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 200 };
const NORTH_WALL: DaylightWall = { id: "w-north", start: { x: 4000, y: 4000 }, end: { x: 0, y: 4000 }, thickness: 200 };


function room(overrides: Partial<DaylightRoom> = {}): DaylightRoom {
  return { id: "r1", number: "101", name: "Office", outline: ROOM_OUTLINE, areaSqM: 16, ceilingHeightMm: 3000, ...overrides };
}

/** The same 4 m x 4 m room, moved to elsewhere in the plan. */
function roomAt(dx: number, dy: number, overrides: Partial<DaylightRoom> = {}): DaylightRoom {
  return room({ outline: ROOM_OUTLINE.map((point) => ({ x: point.x + dx, y: point.y + dy })), ...overrides });
}

function windowIn(hostId: string, position: { x: number; y: number }, width: number, height: number, id = "o1", openingType = "window"): DaylightOpening {
  return { id, hostId, position, width, height, openingType };
}

function model(rooms: readonly DaylightRoom[], walls: readonly DaylightWall[], openings: readonly DaylightOpening[]): DaylightModel {
  return { rooms, walls, openings };
}

describe("how much daylight reaches a room", () => {
  it("measures a 1.2 x 1.5 m window in a 4 x 4 m room against what that room has to fill", () => {
    const rooms = roomDaylight(
      model([room()], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 1200, 1500)]),
      DEFAULT_SUN,
    );
    const r = only(rooms);
    expect(r.roomId).toBe("r1");
    expect(r.ceilingHeightM).toBe(3);
    expect(r.heightAssumed).toBe(false);
    // Floor 16 + ceiling 16 + walls 16 m x 3 m = 80 m² of enclosing surface.
    expect(r.surfaceAreaSqM).toBeCloseTo(80, 6);
    expect(r.openingAreaSqM).toBeCloseTo(1.8, 6);
    // 1.8 m² x 0.6 transmittance x cos(incidence) against the default sun,
    // whose dot with a south-facing opening is 0.7094.
    expect(r.litAreaSqM).toBeCloseTo(1.8 * DAYLIGHT_TRANSMITTANCE * 0.7094, 3);
    expect(r.daylightFactorPct).toBeCloseTo((100 * 1.8 * DAYLIGHT_TRANSMITTANCE * 0.7094) / 80, 2);
    expect(r.daylightFactorPct).toBeGreaterThan(0.5);
    expect(r.daylightFactorPct).toBeLessThan(2);
  });

  it("gives a room with more opening area more daylight", () => {
    const small = only(roomDaylight(model([room()], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 1200, 1500)]), DEFAULT_SUN));
    const large = only(roomDaylight(model([room()], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 2400, 1500)]), DEFAULT_SUN));
    expect(large.daylightFactorPct).toBeGreaterThan(small.daylightFactorPct);
    // Twice the glass, twice the daylight: nothing else changed.
    expect(large.daylightFactorPct).toBeCloseTo(2 * small.daylightFactorPct, 2);
  });

  it("gives a room facing away from the sun nothing, while its neighbour gets some", () => {
    const south = room({ id: "south", number: "101", name: "South office" });
    // A second room ten metres east, so the two do not share a wall.
    const north = roomAt(10_000, 0, { id: "north", number: "102", name: "North office" });
    const northFacingWall: DaylightWall = { id: "w-north", start: { x: 14_000, y: 4000 }, end: { x: 10_000, y: 4000 }, thickness: 200 };
    const rooms = roomDaylight(
      model(
        [south, north],
        [SOUTH_WALL, northFacingWall],
        [windowIn("w-south", { x: 2000, y: 0 }, 1200, 1500, "o-south"), windowIn("w-north", { x: 12_000, y: 4000 }, 1200, 1500, "o-north")],
      ),
      DEFAULT_SUN,
    );
    const byId = new Map(rooms.map((r) => [r.roomId, r]));
    expect(byId.get("south")?.daylightFactorPct).toBeGreaterThan(0);
    // The default sun is to the south, so the north window faces away: it has an
    // aperture, and it receives none of the sun.
    expect(byId.get("north")?.openingAreaSqM).toBeCloseTo(1.8, 6);
    expect(byId.get("north")?.daylightFactorPct).toBe(0);
  });

  it("gives a room with no openings exactly nothing, not a documented minimum", () => {
    const r = only(roomDaylight(model([room()], [SOUTH_WALL], []), DEFAULT_SUN));
    expect(r.openingAreaSqM).toBe(0);
    expect(r.litAreaSqM).toBe(0);
    expect(r.daylightFactorPct).toBe(0);
  });

  it("treats a door as a door, not as a window", () => {
    const viaWindow = only(roomDaylight(model([room()], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 1200, 2100)]), DEFAULT_SUN));
    const viaDoor = only(roomDaylight(model([room()], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 1200, 2100, "o1", "door")]), DEFAULT_SUN));
    expect(viaDoor.daylightFactorPct).toBeGreaterThan(0);
    expect(viaDoor.daylightFactorPct).toBeCloseTo((viaWindow.daylightFactorPct * DOOR_TRANSMITTANCE) / DAYLIGHT_TRANSMITTANCE, 6);
  });

  it("says so when the room does not state a height and one is assumed", () => {
    const stated = only(roomDaylight(model([room()], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 1200, 1500)]), DEFAULT_SUN));
    const assumed = only(roomDaylight(model([room({ ceilingHeightMm: undefined })], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 1200, 1500)]), DEFAULT_SUN));
    expect(assumed.heightAssumed).toBe(true);
    expect(assumed.ceilingHeightM).toBe(ASSUMED_CEILING_M);
    // A lower ceiling is less surface to fill, so the same window reads brighter.
    expect(assumed.daylightFactorPct).toBeGreaterThan(stated.daylightFactorPct);
  });

  it("counts an opening between two rooms as interior, not as daylight", () => {
    const a = room({ id: "a", number: "101", name: "Inner", outline: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }] });
    const b = room({ id: "b", number: "102", name: "Outer", outline: [{ x: 0, y: 4000 }, { x: 4000, y: 4000 }, { x: 4000, y: 8000 }, { x: 0, y: 8000 }] });
    const rooms = roomDaylight(model([a, b], [NORTH_WALL], [windowIn("w-north", { x: 2000, y: 4000 }, 1200, 2100, "o-door", "door")]), DEFAULT_SUN);
    expect(rooms.every((r) => r.daylightFactorPct === 0)).toBe(true);
  });

  it("carries the pairing a revision comparison left on the room", () => {
    const r = only(roomDaylight(model([room({ continuesId: "r-earlier" })], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 1200, 1500)]), DEFAULT_SUN));
    expect(r.continuesId).toBe("r-earlier");
  });
});

describe("Review Focus 1: daylight on the façade, light in the room", () => {
  // A 4 m x 4 m x 3 m room with one 1.2 x 1.5 m window in its south wall, and
  // the façade that same south wall presents to the street. Same orientation,
  // two sides of the same wall: the outside of it faces the sun, the inside is
  // whatever comes through the glass.
  const modelOfThisScene = model([room()], [SOUTH_WALL], [windowIn("w-south", { x: 2000, y: 0 }, 1200, 1500)]);
  const toSun = sunDirection(DEFAULT_SUN);
  // The window's outward direction: the south wall runs west to east, so its
  // outward normal is plan south, which is scene +Z.
  const facadeNormal = planToScene(0, -1);
  const incidence = dot(facadeNormal, toSun);

  it("applies no room daylight to a point on the façade, which is in no room", () => {
    // 600 mm outside the south wall, on the street.
    expect(daylightAt(modelOfThisScene, { x: 2000, y: -600 }, DEFAULT_SUN)).toBeNull();
    // And 600 mm inside, behind the glass, it is room r1's daylight.
    expect(daylightAt(modelOfThisScene, { x: 2000, y: 600 }, DEFAULT_SUN)?.roomId).toBe("r1");
  });

  it("lights the interior less than the exterior at the same orientation", () => {
    const inside = only(roomDaylight(modelOfThisScene, DEFAULT_SUN));
    // The façade's own share of the sun and sky: unchanged by anything the room
    // model says, because the room model has nothing to say about open air.
    const exterior = SUN_INTENSITY * incidence + SKY_INTENSITY * 0.5;
    // The same orientation, one room deep: the daylight factor is exactly the
    // fraction of that which arrives.
    const interior = exterior * (inside.daylightFactorPct / 100);

    expect(incidence).toBeCloseTo(0.7094, 3);
    expect(exterior).toBeCloseTo(2.3 * 0.7094 + 0.475, 4);
    expect(interior).toBeCloseTo(exterior * 0.009578, 4);

    // The failure this test exists for: an interior as bright as the façade, or
    // a façade carrying a room's shading, would flatten this gap.
    expect(interior).toBeLessThan(exterior);
    expect(interior).toBeLessThan(exterior * 0.02);

    // And the façade is not darkened: no term of the room model reaches it.
    expect(daylightAt(modelOfThisScene, { x: 2000, y: -600 }, DEFAULT_SUN)).toBeNull();
  });
});
