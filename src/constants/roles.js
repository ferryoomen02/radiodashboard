/** @typedef {'SUPER_ADMIN' | 'STATION_ADMIN' | 'STAFF'} Role */

export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  STATION_ADMIN: "STATION_ADMIN",
  STAFF: "STAFF",
};

export function isSuperAdmin(user) {
  return user?.role === Role.SUPER_ADMIN;
}

export function isStationAdmin(user) {
  return user?.role === Role.STATION_ADMIN;
}

export function isStaff(user) {
  return user?.role === Role.STAFF;
}
