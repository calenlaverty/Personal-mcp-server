import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HevyClient } from '../hevy/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatWorkout, formatWorkoutList, formatWorkoutSummary, formatLiftProgression } from '../utils/formatters.js';
import {
  CreateWorkoutInputSchema,
  UpdateWorkoutInputSchema,
  WorkoutQueryParamsSchema,
  safeValidateInput,
} from '../utils/validators.js';

// Export workout tool definitions
export function getWorkoutTools() {
  return [
    {
      name: 'get-workouts',
      description:
        'Get a list of workouts with optional date filtering and pagination. Returns workout summaries (title, ID, date, exercise count) but NOT full details. Use get-workout for full details of a specific workout, or get-workout-summary for recent workouts with all details in one call.',
      inputSchema: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'ISO 8601 date string (YYYY-MM-DD) for filtering workouts from this date',
          },
          endDate: {
            type: 'string',
            description: 'ISO 8601 date string (YYYY-MM-DD) for filtering workouts until this date',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (default: 0)',
            default: 0,
          },
          pageSize: {
            type: 'number',
            description: 'Number of workouts per page (default: 10, max: 100)',
            default: 10,
          },
        },
      },
    },
    {
      name: 'get-workout',
      description:
        'Get detailed information about a specific workout by ID. Returns full workout details including exercise names, sets, weights, reps, and notes. Exercise names are automatically resolved.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique workout ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'create-workout',
      description:
        'Create a new workout with exercises and sets. Requires start time, end time, and at least one exercise with sets.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Workout title (e.g., "Push Day", "Leg Workout")',
          },
          description: {
            type: 'string',
            description: 'Optional workout description',
          },
          start_time: {
            type: 'string',
            description: 'ISO 8601 datetime string when workout started',
          },
          end_time: {
            type: 'string',
            description: 'ISO 8601 datetime string when workout ended',
          },
          exercises: {
            type: 'array',
            description: 'Array of exercises performed in this workout',
            items: {
              type: 'object',
              properties: {
                exercise_template_id: {
                  type: 'string',
                  description: 'ID of the exercise template',
                },
                superset_id: {
                  type: 'string',
                  description: 'Optional superset ID to group exercises',
                },
                notes: {
                  type: 'string',
                  description: 'Optional notes for this exercise',
                },
                sets: {
                  type: 'array',
                  description: 'Array of sets performed',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['normal', 'warmup', 'dropset', 'failure'],
                        description: 'Type of set',
                      },
                      weight_kg: {
                        type: 'number',
                        description: 'Weight in kilograms',
                      },
                      reps: {
                        type: 'number',
                        description: 'Number of repetitions',
                      },
                      distance_meters: {
                        type: 'number',
                        description: 'Distance in meters (for cardio)',
                      },
                      duration_seconds: {
                        type: 'number',
                        description: 'Duration in seconds (for cardio/timed exercises)',
                      },
                      rpe: {
                        type: 'number',
                        description: 'Rate of Perceived Exertion (1-10)',
                      },
                    },
                    required: ['type'],
                  },
                },
              },
              required: ['exercise_template_id', 'sets'],
            },
          },
        },
        required: ['title', 'start_time', 'end_time', 'exercises'],
      },
    },
    {
      name: 'update-workout',
      description:
        'Update an existing workout. You can update title, description, times, or exercises. Only provide fields you want to change.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique workout ID to update',
          },
          title: {
            type: 'string',
            description: 'New workout title',
          },
          description: {
            type: 'string',
            description: 'New workout description',
          },
          start_time: {
            type: 'string',
            description: 'New ISO 8601 datetime for start time',
          },
          end_time: {
            type: 'string',
            description: 'New ISO 8601 datetime for end time',
          },
          exercises: {
            type: 'array',
            description: 'New exercises array (replaces all existing exercises)',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-workout-count',
      description: 'Get the total count of all workouts in your account. Useful for stats and tracking progress.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get-workout-events',
      description:
        'Get workout update/delete events since a specific date. Useful for syncing or tracking changes.',
      inputSchema: {
        type: 'object',
        properties: {
          sinceDate: {
            type: 'string',
            description: 'ISO 8601 date string (YYYY-MM-DD) to get events from',
          },
        },
        required: ['sinceDate'],
      },
    },
    {
      name: 'get-workout-summary',
      description:
        'RECOMMENDED for viewing recent training history. Returns multiple recent workouts with full details (exercise names, sets, weights, reps) in a single call. More efficient than get-workouts + get-workout when you need to see several recent workouts at once.',
      inputSchema: {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: 'Number of recent workouts to fetch (default: 10, max: 30)',
            default: 10,
          },
          exerciseFilter: {
            type: 'string',
            description: 'Optional filter to only show specific exercises (e.g., "bench", "squat")',
          },
        },
      },
    },
    {
      name: 'get-lift-progression',
      description:
        'Track progression on specific lifts with optional goal targets. Returns estimated 1RM, progress percentage toward goals, PRs, trends, and recent session history. Perfect for checking progress toward strength goals like "100kg bench".',
      inputSchema: {
        type: 'object',
        properties: {
          exercises: {
            type: 'array',
            description: 'Array of exercises to track with optional goals',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Exercise name to search for (e.g., "Bench Press (Barbell)", "Squat", "Deadlift")',
                },
                goalKg: {
                  type: 'number',
                  description: 'Optional target weight in kg to track progress toward',
                },
              },
              required: ['name'],
            },
          },
          lookbackDays: {
            type: 'number',
            description: 'How many days back to analyze for trends (default: 90)',
            default: 90,
          },
        },
        required: ['exercises'],
      },
    },
  ];
}

// Handle workout tool calls
export async function handleWorkoutToolCall(request: any, client: HevyClient) {
  try {
    switch (request.params.name) {
        case 'get-workouts': {
          const validation = safeValidateInput(
            WorkoutQueryParamsSchema,
            request.params.arguments || {}
          );

          if (!validation.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Validation error: ${validation.error.message}`,
                },
              ],
              isError: true,
            };
          }

          const workouts = await client.getWorkouts(validation.data);
          return {
            content: [
              {
                type: 'text',
                text: formatWorkoutList(workouts),
              },
            ],
          };
        }

        case 'get-workout': {
          const { id } = request.params.arguments as { id: string };
          if (!id) {
            return {
              content: [{ type: 'text', text: 'Error: workout ID is required' }],
              isError: true,
            };
          }

          // Fetch workout and exercise name map in parallel
          const [workout, exerciseNameMap] = await Promise.all([
            client.getWorkout(id),
            client.getExerciseNameMap(),
          ]);
          return {
            content: [
              {
                type: 'text',
                text: formatWorkout(workout, exerciseNameMap),
              },
            ],
          };
        }

        case 'create-workout': {
          const validation = safeValidateInput(
            CreateWorkoutInputSchema,
            request.params.arguments || {}
          );

          if (!validation.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Validation error: ${validation.error.message}`,
                },
              ],
              isError: true,
            };
          }

          const workout = await client.createWorkout(validation.data);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Workout created successfully!\n\n${formatWorkout(workout)}`,
              },
            ],
          };
        }

        case 'update-workout': {
          const { id, ...updateData } = request.params.arguments as any;
          if (!id) {
            return {
              content: [{ type: 'text', text: 'Error: workout ID is required' }],
              isError: true,
            };
          }

          const validation = safeValidateInput(UpdateWorkoutInputSchema, updateData);

          if (!validation.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Validation error: ${validation.error.message}`,
                },
              ],
              isError: true,
            };
          }

          const workout = await client.updateWorkout(id, validation.data);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Workout updated successfully!\n\n${formatWorkout(workout)}`,
              },
            ],
          };
        }

        case 'get-workout-count': {
          const result = await client.getWorkoutCount();
          return {
            content: [
              {
                type: 'text',
                text: `Total workouts: ${result.workout_count}`,
              },
            ],
          };
        }

        case 'get-workout-events': {
          const { sinceDate } = request.params.arguments as { sinceDate: string };
          if (!sinceDate) {
            return {
              content: [{ type: 'text', text: 'Error: sinceDate is required' }],
              isError: true,
            };
          }

          const events = await client.getWorkoutEvents(sinceDate);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(events, null, 2),
              },
            ],
          };
        }

        case 'get-workout-summary': {
          const { count = 10, exerciseFilter } = request.params.arguments as {
            count?: number;
            exerciseFilter?: string;
          };

          // Limit count to 30 max
          const limitedCount = Math.min(count, 30);

          const summaries = await client.getWorkoutSummaries(limitedCount, exerciseFilter);
          return {
            content: [
              {
                type: 'text',
                text: formatWorkoutSummary(summaries),
              },
            ],
          };
        }

        case 'get-lift-progression': {
          const { exercises, lookbackDays = 90 } = request.params.arguments as {
            exercises: { name: string; goalKg?: number }[];
            lookbackDays?: number;
          };

          if (!exercises || exercises.length === 0) {
            return {
              content: [{ type: 'text', text: 'Error: exercises array is required' }],
              isError: true,
            };
          }

          const results = await client.getLiftProgression(exercises, lookbackDays);
          return {
            content: [
              {
                type: 'text',
                text: formatLiftProgression(results),
              },
            ],
          };
        }

        default:
          return null; // Tool not handled by this module
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: handleToolError(error),
          },
        ],
        isError: true,
      };
    }
}
