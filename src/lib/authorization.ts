export const TEACHER_EMAILS = [
  'aymankareem548@gmail.com',
  'mariam@masria.academy',
] as const;

export function isTeacherEmail(email?: string | null): boolean {
  if (!email) return false;
  return TEACHER_EMAILS.includes(email.trim().toLowerCase() as (typeof TEACHER_EMAILS)[number]);
}
