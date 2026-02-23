import { z } from "zod";

export const AvatarDirectionSchema = z.enum(["up", "down", "left", "right"]);
export type AvatarDirection = z.infer<typeof AvatarDirectionSchema>;

export const AvatarPositionSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  color: z.string(),
  x: z.number(),
  y: z.number(),
  direction: AvatarDirectionSchema,
});
export type AvatarPosition = z.infer<typeof AvatarPositionSchema>;

// Peer is structurally identical to AvatarPosition at the data layer.
// The alias carries semantic meaning at the store level.
export const PeerSchema = AvatarPositionSchema;
export type Peer = z.infer<typeof PeerSchema>;

export const RoomSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Room = z.infer<typeof RoomSchema>;
