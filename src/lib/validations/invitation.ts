import { z } from 'zod';

const userRoleEnum = z.enum(['admin', 'qa_engineer', 'sdet', 'viewer']);
const invitationStatusEnum = z.enum(['pending', 'accepted', 'expired', 'revoked']);

export const createInvitationSchema = z.object({
  email: z.string().trim().email('Must be a valid email').max(255),
  role: userRoleEnum,
});

export const updateInvitationSchema = z.object({
  status: invitationStatusEnum,
});

export const updateUserRoleSchema = z.object({
  role: userRoleEnum,
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateInvitationInput = z.infer<typeof updateInvitationSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
