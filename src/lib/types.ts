export type Role = "admin" | "member";
export type NeedKind = "spende" | "leihgabe" | "material";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  calendar_token: string;
  admin_tour_done_at: string | null;
}

export interface PersonRef {
  full_name: string;
  username: string;
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  maps_url: string | null;
  notes: string | null;
  published: boolean;
  created_at: string;
}

export interface ShiftRow {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
}

export interface SignupRow {
  shift_id: string;
  user_id: string;
  created_at: string;
  attended: boolean | null;
  profiles: PersonRef | null;
}

export interface ShiftWithSignups extends ShiftRow {
  shift_signups: SignupRow[];
}

export interface NeedRow {
  id: string;
  event_id: string;
  kind: NeedKind;
  title: string;
  description: string | null;
  quantity_needed: number;
  unit: string | null;
}

export interface PledgeRow {
  id: string;
  need_id: string;
  user_id: string;
  quantity: number;
  note: string | null;
  delivered: boolean | null;
  created_at: string;
  profiles: PersonRef | null;
}

export interface NeedWithPledges extends NeedRow {
  need_pledges: PledgeRow[];
}

export interface ProductRow {
  id: string;
  event_id: string;
  name: string;
  price: number | null;
  description: string | null;
  sort_order: number;
}

export interface CommentRow {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: PersonRef | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  profiles: PersonRef | null;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Poll {
  id: string;
  question: string;
  description: string | null;
  allow_multiple: boolean;
  anonymous: boolean;
  closes_at: string | null;
  closed: boolean;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
}

export interface ShoppingItem {
  id: string;
  event_id: string;
  title: string;
  quantity: string | null;
  note: string | null;
  assigned_to: string | null;
  cost: number | null;
  bought_at: string | null;
  bought_by: string | null;
  created_at: string;
}

export interface OrganizerRow {
  user_id: string;
  permissions: string[];
  profiles: { full_name: string } | null;
}

export interface MemberRef {
  id: string;
  full_name: string;
  role: Role;
}

export type ActionState<T = undefined> = {
  ok?: boolean;
  error?: string;
  message?: string;
  data?: T;
} | null;

export const NEED_KIND_LABEL: Record<NeedKind, string> = {
  spende: "Spende",
  leihgabe: "Leihgabe",
  material: "Material",
};
