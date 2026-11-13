import type { PackClass } from "@permitzip/bim-pack/runtime";

/**
 * The building classes, moved out of the kernel (round 13). Ids, hints and
 * order unchanged, so every classified record keeps its class and
 * recognition answers as before. The kernel lists them just ahead of its
 * fallback `gen.building_element`, so with this add-on on they win, and with
 * it off the element still classifies, draws and bounds.
 */

export const ARCHITECTURE_CLASSES: readonly PackClass[] = [
  { id: "arch.wall", label: "Walls", discipline: "architecture", ifc: { entity: "IfcWall", typeEntity: "IfcWallType" }, recognize: { elementKinds: ["wall"] } },
  { id: "arch.slab", label: "Floors and slabs", discipline: "architecture", ifc: { entity: "IfcSlab", typeEntity: "IfcSlabType" }, recognize: { elementKinds: ["slab"] } },
  { id: "arch.door", label: "Doors", discipline: "architecture", ifc: { entity: "IfcDoor", typeEntity: "IfcDoorType" }, recognize: { elementKinds: ["opening"], where: [{ path: "openingType", op: "equals", value: "door" }] } },
  { id: "arch.window", label: "Windows", discipline: "architecture", ifc: { entity: "IfcWindow", typeEntity: "IfcWindowType" }, recognize: { elementKinds: ["opening"], where: [{ path: "openingType", op: "equals", value: "window" }] } },
  { id: "arch.room", label: "Rooms", discipline: "architecture", ifc: { entity: "IfcSpace", predefinedType: "INTERNAL" }, recognize: { elementKinds: ["room"] } },
  { id: "arch.component", label: "Components", discipline: "architecture", ifc: { entity: "IfcFurnishingElement" }, recognize: { elementKinds: ["component"] } },
  {
    id: "arch.ceiling",
    label: "Ceilings",
    discipline: "architecture",
   
    ifc: { entity: "IfcCovering", predefinedType: "CEILING" },
    recognize: { elementKinds: ["ceiling"] },
    description: "Typed horizontal surfaces: flat, sloped, clouds, soffits and open to structure, with what they are made of as an element type.",
  },
  {
    id: "arch.finish",
    label: "Floor finishes",
    discipline: "architecture",
    // A screed, a topping or a finish floor over the structural slab: a thin horizontal plate with a
    // plan area and a thickness, which is what the slab kind holds and measures (m2 to price, m3 to pour).
    ifc: { entity: "IfcCovering", predefinedType: "FLOORING", import: { rule: "kernel.slab" } },
    description: "Screeds, toppings and finish floors, measured by area and by volume apart from the slab they sit on.",
  },
  { id: "arch.roof", label: "Roofs", discipline: "architecture", ifc: { entity: "IfcRoof", predefinedType: "FLAT_ROOF", typeEntity: "IfcRoofType" }, recognize: { elementKinds: ["architecture.roof"] } },
  { id: "arch.stair", label: "Stairs", discipline: "architecture", ifc: { entity: "IfcStair", predefinedType: "STRAIGHT_RUN_STAIR", typeEntity: "IfcStairType" }, recognize: { elementKinds: ["architecture.stair"] } },
  // The envelope's glazed sheet and the framing lines between them. No
  // `predefinedType` on either: a façade exports its glass as `CURTAIN_PANEL`
  // and just as often as the plain `SHEET` (this repo's own sample model does),
  // and its framing as `MULLION` or as `TRANSOM` — all of them are a sheet and a
  // member. A class that names a predefined type is a closer match, so a
  // structural class of steel plates (`BASE_PLATE`) outranks this one.
  { id: "arch.curtain_panel", label: "Curtain wall panels", discipline: "architecture", ifc: { entity: "IfcPlate", typeEntity: "IfcPlateType" }, recognize: { elementKinds: ["architecture.curtain_panel"] }, description: "Glazed sheets in a curtain wall: the m² a façade is priced by." },
  { id: "arch.curtain_member", label: "Mullions and transoms", discipline: "architecture", ifc: { entity: "IfcMember", typeEntity: "IfcMemberType" }, recognize: { elementKinds: ["architecture.curtain_member"] }, description: "Curtain-wall framing: mullions, transoms and studs, priced by length and by profile size." },
];
