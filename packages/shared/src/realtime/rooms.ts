/** `friends:<userId>` is a player's own board of friends; only that player joins it. */
export const ROOM_TYPES = ['community', 'group', 'thread', 'friends'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

/** Room ids are `<type>:<id>`; ids are uuids or slugs. */
const ROOM_RE = /^(community|group|thread|friends):([a-z0-9-]{1,64})$/;

export function parseRoom(room: string): { type: RoomType; id: string } | null {
  const m = ROOM_RE.exec(room);
  return m ? { type: m[1] as RoomType, id: m[2]! } : null;
}

export function roomName(type: RoomType, id: string): string {
  const room = `${type}:${id}`;
  if (!parseRoom(room)) throw new Error(`invalid room: ${room}`);
  return room;
}
