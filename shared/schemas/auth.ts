import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'That password is too long');

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type Credentials = z.infer<typeof credentialsSchema>;

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  isGuest: z.boolean(),
  createdAt: z.number(),
});

export type UserDto = z.infer<typeof userDtoSchema>;

export const authResponseSchema = z.object({
  user: userDtoSchema,
  accessToken: z.string(),
  expiresIn: z.number(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
