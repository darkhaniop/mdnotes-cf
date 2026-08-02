import { z } from 'zod';

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, 'Give the project a name')
  .max(120, 'Keep the name under 120 characters');

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: z.string().trim().max(2000).optional(),
});

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: 'Nothing to update',
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  documentCount: z.number().optional(),
  assetCount: z.number().optional(),
});

export type ProjectDto = z.infer<typeof projectDtoSchema>;
