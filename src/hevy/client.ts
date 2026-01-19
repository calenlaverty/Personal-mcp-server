import {
  HevyConfig,
  Workout,
  CreateWorkoutInput,
  UpdateWorkoutInput,
  WorkoutCountResponse,
  WorkoutEvent,
  Routine,
  CreateRoutineInput,
  UpdateRoutineInput,
  ExerciseTemplate,
  ExerciseProgress,
  ExerciseStats,
  ExerciseProgressParams,
  RoutineFolder,
  CreateFolderInput,
  WebhookSubscription,
  CreateWebhookInput,
  PaginationParams,
  WorkoutQueryParams,
  LiftGoal,
  LiftProgressionResult,
  WorkoutSummaryItem,
} from './types.js';

export class HevyClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: HevyConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.hevyapp.com';
  }

  /**
   * Clean payload by removing only undefined values
   * Keeps null values as they are semantically meaningful to the API
   * (e.g., folder_id: null means "no folder")
   */
  private cleanPayload<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Create abort controller for timeout (60 seconds for API requests)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorBody = await response.text();
          // Try to parse as JSON first
          try {
            const errorJson = JSON.parse(errorBody);
            // Extract error message from common API error formats
            errorMessage = errorJson.error?.message ||
                          errorJson.message ||
                          errorJson.error ||
                          JSON.stringify(errorJson);
          } catch {
            // If not JSON, use the text as is
            errorMessage = errorBody || errorMessage;
          }
        } catch {
          // If we can't read the body, just use statusText
        }

        throw new Error(
          `Hevy API error (${response.status}): ${errorMessage}`
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Hevy API request timed out');
        }
        throw error;
      }
      throw new Error(`Hevy API request failed: ${String(error)}`);
    }
  }

  // ===== Workout Methods =====

  async getWorkouts(params: WorkoutQueryParams = {}): Promise<Workout[]> {
    const { page = 0, pageSize = 10, startDate, endDate } = params;

    const queryParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (startDate) {
      queryParams.append('startDate', startDate);
    }
    if (endDate) {
      queryParams.append('endDate', endDate);
    }

    const endpoint = `/v1/workouts?${queryParams.toString()}`;
    const response = await this.request<{ workouts: Workout[] }>(endpoint);
    return response.workouts || [];
  }

  async getWorkout(id: string): Promise<Workout> {
    return this.request<Workout>(`/v1/workouts/${encodeURIComponent(id)}`);
  }

  async createWorkout(data: CreateWorkoutInput): Promise<Workout> {
    const response = await this.request<{ workout: Workout[] }>('/v1/workouts', {
      method: 'POST',
      body: JSON.stringify({ workout: this.cleanPayload(data) }),
    });
    // API returns { workout: [{ ... }] }, extract first element
    return response.workout[0];
  }

  async updateWorkout(id: string, data: UpdateWorkoutInput): Promise<Workout> {
    const response = await this.request<{ workout: Workout[] }>(`/v1/workouts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ workout: this.cleanPayload(data) }),
    });
    // API returns { workout: [{ ... }] }, extract first element
    return response.workout[0];
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.request(`/v1/workouts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async getWorkoutCount(): Promise<WorkoutCountResponse> {
    return this.request<WorkoutCountResponse>('/v1/workouts/count');
  }

  async getWorkoutEvents(sinceDate: string): Promise<WorkoutEvent[]> {
    const queryParams = new URLSearchParams({ since: sinceDate });
    const response = await this.request<{ events: WorkoutEvent[] }>(
      `/v1/workouts/events?${queryParams.toString()}`
    );
    return response.events || [];
  }

  // ===== Routine Methods =====

  async getRoutines(params: PaginationParams = {}): Promise<Routine[]> {
    const { page = 0, pageSize = 50 } = params;
    const queryParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await this.request<{ routines: Routine[] }>(
      `/v1/routines?${queryParams.toString()}`
    );
    return response.routines || [];
  }

  async getRoutine(id: string): Promise<Routine> {
    return this.request<Routine>(`/v1/routines/${encodeURIComponent(id)}`);
  }

  async createRoutine(data: CreateRoutineInput): Promise<Routine> {
    const response = await this.request<{ routine: Routine[] }>('/v1/routines', {
      method: 'POST',
      body: JSON.stringify({ routine: this.cleanPayload(data) }),
    });
    // API returns { routine: [{ ... }] }, extract first element
    return response.routine[0];
  }

  async updateRoutine(id: string, data: UpdateRoutineInput): Promise<Routine> {
    const response = await this.request<{ routine: Routine[] }>(`/v1/routines/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ routine: this.cleanPayload(data) }),
    });
    // API returns { routine: [{ ... }] }, extract first element
    return response.routine[0];
  }

  async deleteRoutine(id: string): Promise<void> {
    await this.request(`/v1/routines/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ===== Exercise Methods =====

  async getExerciseTemplates(params: PaginationParams = {}): Promise<ExerciseTemplate[]> {
    const { page = 0, pageSize = 50 } = params;
    const queryParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await this.request<{ exercise_templates: ExerciseTemplate[] }>(
      `/v1/exercise_templates?${queryParams.toString()}`
    );
    return response.exercise_templates || [];
  }

  async getExerciseTemplate(id: string): Promise<ExerciseTemplate> {
    return this.request<ExerciseTemplate>(`/v1/exercise_templates/${encodeURIComponent(id)}`);
  }

  async getExerciseProgress(params: ExerciseProgressParams): Promise<ExerciseProgress[]> {
    const { exercise_template_id, start_date, end_date, limit = 50 } = params;

    const queryParams = new URLSearchParams({
      limit: String(limit),
    });

    if (start_date) {
      queryParams.append('start_date', start_date);
    }
    if (end_date) {
      queryParams.append('end_date', end_date);
    }

    const endpoint = `/v1/exercises/${encodeURIComponent(exercise_template_id)}/progress?${queryParams.toString()}`;
    const response = await this.request<{ progress: ExerciseProgress[] }>(endpoint);
    return response.progress || [];
  }

  async getExerciseStats(exerciseTemplateId: string): Promise<ExerciseStats> {
    return this.request<ExerciseStats>(
      `/v1/exercises/${encodeURIComponent(exerciseTemplateId)}/stats`
    );
  }

  // ===== Folder Methods =====

  async getRoutineFolders(): Promise<RoutineFolder[]> {
    const response = await this.request<{ folders: RoutineFolder[] }>(
      '/v1/routine_folders'
    );
    return response.folders || [];
  }

  async getRoutineFolder(id: string): Promise<RoutineFolder> {
    return this.request<RoutineFolder>(`/v1/routine_folders/${encodeURIComponent(id)}`);
  }

  async createRoutineFolder(data: CreateFolderInput): Promise<RoutineFolder> {
    const response = await this.request<{ folder: RoutineFolder[] }>('/v1/routine_folders', {
      method: 'POST',
      body: JSON.stringify({ folder: this.cleanPayload(data) }),
    });
    // API returns { folder: [{ ... }] }, extract first element
    return response.folder[0];
  }

  async updateRoutineFolder(id: string, data: CreateFolderInput): Promise<RoutineFolder> {
    const response = await this.request<{ folder: RoutineFolder[] }>(`/v1/routine_folders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ folder: this.cleanPayload(data) }),
    });
    // API returns { folder: [{ ... }] }, extract first element
    return response.folder[0];
  }

  async deleteRoutineFolder(id: string): Promise<void> {
    await this.request(`/v1/routine_folders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ===== Webhook Methods =====

  async getWebhookSubscription(): Promise<WebhookSubscription | null> {
    try {
      return await this.request<WebhookSubscription>('/v1/webhooks/subscription');
    } catch (error) {
      // Return null if no subscription exists (404)
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createWebhookSubscription(data: CreateWebhookInput): Promise<WebhookSubscription> {
    const response = await this.request<{ webhook: WebhookSubscription[] }>('/v1/webhooks/subscription', {
      method: 'POST',
      body: JSON.stringify({ webhook: this.cleanPayload(data) }),
    });
    // API returns { webhook: [{ ... }] }, extract first element
    return response.webhook[0];
  }

  async deleteWebhookSubscription(): Promise<void> {
    await this.request('/v1/webhooks/subscription', {
      method: 'DELETE',
    });
  }

  // ===== Aggregation Methods (Optimized for AI assistants) =====

  // Cache for exercise templates to avoid repeated API calls
  private exerciseTemplateCache: ExerciseTemplate[] | null = null;

  /**
   * Ensure exercise templates are cached and return a Map of ID -> title
   * Useful for resolving exercise names in workout responses
   */
  async getExerciseNameMap(): Promise<Map<string, string>> {
    if (!this.exerciseTemplateCache) {
      await this.searchExerciseTemplates('');
    }
    return new Map(this.exerciseTemplateCache!.map((t) => [t.id, t.title]));
  }

  /**
   * Search exercise templates by name (case-insensitive)
   * Caches all templates on first call for fast subsequent searches
   */
  async searchExerciseTemplates(query: string): Promise<ExerciseTemplate[]> {
    // Load and cache all exercise templates if not already cached
    if (!this.exerciseTemplateCache) {
      const allTemplates: ExerciseTemplate[] = [];
      let page = 0;
      const pageSize = 100; // Max allowed
      let hasMore = true;

      while (hasMore) {
        const templates = await this.getExerciseTemplates({ page, pageSize });
        allTemplates.push(...templates);
        hasMore = templates.length === pageSize;
        page++;
      }

      this.exerciseTemplateCache = allTemplates;
    }

    // Filter by query (case-insensitive)
    const lowerQuery = query.toLowerCase();
    return this.exerciseTemplateCache.filter(
      (t) => t.title.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get recent workouts with full details (exercises and sets)
   * Fetches workout list and then details in parallel
   */
  async getRecentWorkoutsWithDetails(count: number = 10): Promise<Workout[]> {
    // Fetch workout list (may need multiple pages)
    const pageSize = 10; // Hevy API max is 10
    const pages = Math.ceil(count / pageSize);
    const workoutLists: Workout[][] = [];

    for (let page = 0; page < pages; page++) {
      const workouts = await this.getWorkouts({ page, pageSize });
      workoutLists.push(workouts);
      if (workouts.length < pageSize) break;
    }

    const workoutSummaries = workoutLists.flat().slice(0, count);

    // Fetch full details for each workout in parallel
    const detailedWorkouts = await Promise.all(
      workoutSummaries.map((w) => this.getWorkout(w.id))
    );

    return detailedWorkouts;
  }

  /**
   * Get workout summaries with exercise names resolved
   */
  async getWorkoutSummaries(
    count: number = 10,
    exerciseFilter?: string
  ): Promise<WorkoutSummaryItem[]> {
    // Ensure exercise templates are cached
    if (!this.exerciseTemplateCache) {
      await this.searchExerciseTemplates('');
    }

    const workouts = await this.getRecentWorkoutsWithDetails(count);
    const templateMap = new Map(
      this.exerciseTemplateCache!.map((t) => [t.id, t.title])
    );

    const summaries: WorkoutSummaryItem[] = workouts.map((workout) => {
      // Calculate duration
      const start = new Date(workout.start_time);
      const end = new Date(workout.end_time);
      const durationMs = end.getTime() - start.getTime();
      const durationMins = Math.round(durationMs / 60000);
      const hours = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      const exercises = workout.exercises.map((ex) => {
        const name = templateMap.get(ex.exercise_template_id) || ex.exercise_template_id;

        // Find best set (highest weight with successful reps)
        let bestSet: { weight_kg: number; reps: number } | undefined;
        for (const set of ex.sets) {
          if (set.weight_kg && set.reps && set.type !== 'warmup') {
            if (!bestSet || set.weight_kg > bestSet.weight_kg) {
              bestSet = { weight_kg: set.weight_kg, reps: set.reps };
            }
          }
        }

        return {
          name,
          exerciseId: ex.exercise_template_id,
          sets: ex.sets,
          bestSet,
        };
      });

      // Apply exercise filter if provided
      const filteredExercises = exerciseFilter
        ? exercises.filter((e) =>
            e.name.toLowerCase().includes(exerciseFilter.toLowerCase())
          )
        : exercises;

      return {
        id: workout.id,
        title: workout.title,
        date: workout.start_time,
        duration,
        exercises: filteredExercises,
      };
    });

    // If filtering, only return workouts that have matching exercises
    return exerciseFilter
      ? summaries.filter((s) => s.exercises.length > 0)
      : summaries;
  }

  /**
   * Calculate estimated 1RM using Brzycki formula
   */
  private calculate1RM(weight: number, reps: number): number {
    if (reps === 1) return weight;
    if (reps > 12) return weight * (1 + reps / 30); // Rough estimate for high reps
    return weight * (36 / (37 - reps));
  }

  /**
   * Get lift progression data for specific exercises with optional goals
   */
  async getLiftProgression(
    exercises: LiftGoal[],
    lookbackDays: number = 90
  ): Promise<LiftProgressionResult[]> {
    // Ensure exercise templates are cached
    if (!this.exerciseTemplateCache) {
      await this.searchExerciseTemplates('');
    }

    const results: LiftProgressionResult[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    const startDateStr = startDate.toISOString().split('T')[0];

    for (const goal of exercises) {
      // Find matching exercise template
      const matches = this.exerciseTemplateCache!.filter(
        (t) => t.title.toLowerCase().includes(goal.name.toLowerCase())
      );

      if (matches.length === 0) {
        results.push({
          exerciseName: goal.name,
          exerciseId: 'NOT_FOUND',
          goalKg: goal.goalKg,
          personalRecords: [],
          trend: 'insufficient_data',
          recentSessions: [],
        });
        continue;
      }

      // Use first (best) match
      const template = matches[0];

      // Get exercise stats for PRs and 1RM
      let stats: ExerciseStats | null = null;
      try {
        stats = await this.getExerciseStats(template.id);
      } catch {
        // Stats might not be available
      }

      // Get exercise progress for trend analysis
      let progress: ExerciseProgress[] = [];
      try {
        progress = await this.getExerciseProgress({
          exercise_template_id: template.id,
          start_date: startDateStr,
          limit: 100,
        });
      } catch {
        // Progress might not be available
      }

      // Calculate trend from progress data
      let trend: 'improving' | 'plateau' | 'declining' | 'insufficient_data' = 'insufficient_data';
      let trendDeltaKg: number | undefined;

      if (progress.length >= 2) {
        // Calculate best 1RM from first half vs second half
        const midpoint = Math.floor(progress.length / 2);
        const firstHalf = progress.slice(midpoint);
        const secondHalf = progress.slice(0, midpoint);

        const getMax1RM = (sessions: ExerciseProgress[]) => {
          let max = 0;
          for (const session of sessions) {
            for (const set of session.sets) {
              if (set.weight_kg && set.reps && set.type !== 'warmup') {
                const e1rm = this.calculate1RM(set.weight_kg, set.reps);
                if (e1rm > max) max = e1rm;
              }
            }
          }
          return max;
        };

        const firstMax = getMax1RM(firstHalf);
        const secondMax = getMax1RM(secondHalf);

        if (firstMax > 0 && secondMax > 0) {
          const delta = secondMax - firstMax;
          trendDeltaKg = Math.round(delta * 10) / 10;

          if (delta > 2.5) trend = 'improving';
          else if (delta < -2.5) trend = 'declining';
          else trend = 'plateau';
        }
      }

      // Format recent sessions (last 5)
      const recentSessions = progress.slice(0, 5).map((p) => {
        const topSets = p.sets
          .filter((s) => s.weight_kg && s.reps && s.type !== 'warmup')
          .sort((a, b) => (b.weight_kg || 0) - (a.weight_kg || 0))
          .slice(0, 3)
          .map((s) => ({ weight_kg: s.weight_kg!, reps: s.reps! }));

        return {
          date: p.date,
          workoutId: p.workout_id,
          topSets,
        };
      });

      // Calculate progress toward goal
      const current1RM = stats?.one_rep_max_kg;
      let progressPercent: number | undefined;
      let remainingKg: number | undefined;

      if (goal.goalKg && current1RM) {
        progressPercent = Math.round((current1RM / goal.goalKg) * 100);
        remainingKg = Math.max(0, Math.round((goal.goalKg - current1RM) * 10) / 10);
      }

      results.push({
        exerciseName: template.title,
        exerciseId: template.id,
        goalKg: goal.goalKg,
        currentEstimated1RM: current1RM,
        progressPercent,
        remainingKg,
        personalRecords: stats?.personal_records || [],
        trend,
        trendDeltaKg,
        recentSessions,
      });
    }

    return results;
  }
}
