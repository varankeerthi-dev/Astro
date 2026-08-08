// Role → capability matrix (design doc §7). Checked in middleware/endpoints;
// Postgres RLS is the backstop underneath.
export type Role = 'marketing_editor' | 'publisher' | 'administrator';

export type Capability =
  | 'content.create'
  | 'content.edit'
  | 'content.preview'
  | 'content.duplicate'
  | 'content.reorder'
  | 'content.publish'
  | 'content.schedule'
  | 'content.unpublish'
  | 'content.archive'
  | 'content.delete'
  | 'content.restore'
  | 'content.hard_delete'
  | 'settings.manage'
  | 'users.manage'
  | 'scripts.manage'
  | 'audit.view'
  | 'kb.moderate';

const ALL_EDITORS: Role[] = ['marketing_editor', 'publisher', 'administrator'];
const PUBLISHERS: Role[] = ['publisher', 'administrator'];
const ADMINS: Role[] = ['administrator'];

const MATRIX: Record<Capability, Role[]> = {
  'content.create': ALL_EDITORS,
  'content.edit': ALL_EDITORS,
  'content.preview': ALL_EDITORS,
  'content.duplicate': ALL_EDITORS,
  'content.reorder': ALL_EDITORS,
  'content.publish': PUBLISHERS,
  'content.schedule': PUBLISHERS,
  'content.unpublish': PUBLISHERS,
  'content.archive': PUBLISHERS,
  'content.delete': PUBLISHERS,
  'content.restore': PUBLISHERS,
  'content.hard_delete': ADMINS,
  'settings.manage': ADMINS,
  'users.manage': ADMINS,
  'scripts.manage': ADMINS,
  'audit.view': PUBLISHERS,
  'kb.moderate': ALL_EDITORS,
};

export const can = (role: Role | null | undefined, cap: Capability): boolean =>
  !!role && MATRIX[cap].includes(role);

export const ROLE_LABELS: Record<Role, string> = {
  marketing_editor: 'Marketing Editor',
  publisher: 'Publisher',
  administrator: 'Administrator',
};
