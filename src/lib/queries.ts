// Wiederverwendete Select-Strings für verschachtelte Supabase-Abfragen

export const SIGNUP_FIELDS = "shift_id, user_id, created_at, attended, profiles(full_name, username)";
export const SHIFT_SELECT = `id, event_id, title, description, starts_at, ends_at, capacity, shift_signups(${SIGNUP_FIELDS})`;

export const PLEDGE_FIELDS = "id, need_id, user_id, quantity, note, delivered, created_at, profiles(full_name, username)";
export const NEED_SELECT = `id, event_id, kind, title, description, quantity_needed, unit, need_pledges(${PLEDGE_FIELDS})`;

export const EVENT_FIELDS =
  "id, title, description, starts_at, ends_at, location_name, address, maps_url, notes, published, created_at";
