import { z } from 'zod';
import { sanitizeText } from './security.js';

// Helper to convert string "undefined", "null", empty strings to undefined
// This ensures MCP clients sending "undefined" as a string get it converted properly
const optionalString = () => {
  return z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((val) => {
      // Convert string "undefined", "null", or empty string to undefined
      if (val === 'undefined' || val === 'null' || val === '') {
        return undefined;
      }
      return val;
    });
};

// Sanitized string schema helper that also validates length
const sanitizedString = (maxLength: number = 10000, minLength: number = 0) => {
  let schema = z.string();
  if (minLength > 0) {
    schema = schema.min(minLength);
  }
  return schema.max(maxLength).transform((val) => sanitizeText(val, maxLength));
};

// Exercise Set Schema
export const ExerciseSetSchema = z.object({
  type: z.enum(['normal', 'warmup', 'dropset', 'failure']),
  weight_kg: z.number().optional().nullable(),
  reps: z.number().optional().nullable(),
  distance_meters: z.number().optional().nullable(),
  duration_seconds: z.number().optional().nullable(),
  rpe: z.number().min(1).max(10).optional().nullable(),
});

// Workout Exercise Schema
export const WorkoutExerciseSchema = z.object({
  exercise_template_id: z.string(),
  superset_id: optionalString().nullable(),
  notes: sanitizedString(5000).optional(),
  sets: z.array(ExerciseSetSchema),
});

// Create Workout Input Schema
export const CreateWorkoutInputSchema = z.object({
  title: sanitizedString(200, 1),
  description: sanitizedString(5000).optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  exercises: z.array(WorkoutExerciseSchema),
});

// Update Workout Input Schema
export const UpdateWorkoutInputSchema = z.object({
  title: sanitizedString(200, 1).optional(),
  description: sanitizedString(5000).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  exercises: z.array(WorkoutExerciseSchema).optional(),
});

// Routine Exercise Schema
export const RoutineExerciseSchema = z.object({
  exercise_template_id: z.string(),
  superset_id: optionalString().nullable(),
  notes: sanitizedString(5000).optional(),
  sets: z.array(ExerciseSetSchema),
});

// Create Routine Input Schema
export const CreateRoutineInputSchema = z.object({
  title: sanitizedString(200, 1),
  folder_id: optionalString(),
  exercises: z.array(RoutineExerciseSchema),
});

// Update Routine Input Schema
export const UpdateRoutineInputSchema = z.object({
  title: sanitizedString(200, 1).optional(),
  folder_id: optionalString(),
  exercises: z.array(RoutineExerciseSchema).optional(),
});

// Create Folder Input Schema
export const CreateFolderInputSchema = z.object({
  title: sanitizedString(200, 1),
});

// Pagination Params Schema
export const PaginationParamsSchema = z.object({
  page: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

// Workout Query Params Schema
export const WorkoutQueryParamsSchema = PaginationParamsSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Exercise Progress Params Schema
export const ExerciseProgressParamsSchema = z.object({
  exercise_template_id: z.string(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// Webhook Input Schema
export const CreateWebhookInputSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum([
      'workout.created',
      'workout.updated',
      'workout.deleted',
      'routine.created',
      'routine.updated',
      'routine.deleted',
    ])
  ),
});

// Helper function to validate and parse data
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

// Helper function to validate with error handling
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
