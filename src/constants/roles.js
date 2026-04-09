/** @typedef {'SUPER_ADMIN' | 'STATION_ADMIN' | 'USER'} Role */

export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  STATION_ADMIN: "STATION_ADMIN",
  USER: "USER",
};

export function isSuperAdmin(user) {
  return user?.role === Role.SUPER_ADMIN;
}

export function isStationAdmin(user) {
  return user?.role === Role.STATION_ADMIN;
}

export function isUserRole(user) {
  return user?.role === Role.USER;
}
