import { Workout, ExerciseTemplate, Routine, ExerciseSet, LiftProgressionResult, WorkoutSummaryItem } from '../hevy/types.js';

// Capitalize first letter of each word in a title
function capitalizeTitle(title: string | undefined | null): string {
  // Defensive check: return empty string if title is missing
  if (!title) {
    return '';
  }

  return title
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Format workout for display
export function formatWorkout(workout: Workout): string {
  const lines: string[] = [];

  const title = capitalizeTitle(workout.title) || 'Untitled Workout';
  lines.push(`# ${title}`);
  if (workout.description) {
    lines.push(`${workout.description}`);
  }
  lines.push(`**Started:** ${formatDateTime(workout.start_time)}`);
  lines.push(`**Ended:** ${formatDateTime(workout.end_time)}`);
  lines.push(`**Duration:** ${calculateDuration(workout.start_time, workout.end_time)}`);
  lines.push('');

  lines.push('## Exercises');

  // Defensive check: ensure exercises exists and is an array
  if (!workout.exercises || !Array.isArray(workout.exercises)) {
    lines.push('No exercises recorded.');
  } else {
    workout.exercises.forEach((exercise, idx) => {
      lines.push(`### ${idx + 1}. Exercise ID: ${exercise.exercise_template_id}`);
      if (exercise.superset_id) {
        lines.push(`   *Superset ID: ${exercise.superset_id}*`);
      }
      if (exercise.notes) {
        lines.push(`   *Notes: ${exercise.notes}*`);
      }

      lines.push('   **Sets:**');
      // Defensive check for sets array
      if (exercise.sets && Array.isArray(exercise.sets)) {
        exercise.sets.forEach((set, setIdx) => {
          lines.push(`   ${setIdx + 1}. ${formatSet(set)}`);
        });
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

// Format a single set
export function formatSet(set: ExerciseSet): string {
  const parts: string[] = [set.type];

  if (set.weight_kg !== null && set.weight_kg !== undefined) {
    // Round to 2 decimal places for cleaner display
    const weight = Math.round(set.weight_kg * 100) / 100;
    parts.push(`${weight}kg`);
  }
  if (set.reps !== null && set.reps !== undefined) {
    parts.push(`${set.reps} reps`);
  }
  if (set.distance_meters !== null && set.distance_meters !== undefined) {
    parts.push(`${set.distance_meters}m`);
  }
  if (set.duration_seconds !== null && set.duration_seconds !== undefined) {
    parts.push(`${formatDuration(set.duration_seconds)}`);
  }
  if (set.rpe !== null && set.rpe !== undefined) {
    parts.push(`RPE ${set.rpe}`);
  }

  return parts.join(' • ');
}

// Format routine for display
export function formatRoutine(routine: Routine): string {
  const lines: string[] = [];

  const title = capitalizeTitle(routine.title) || 'Untitled Routine';
  lines.push(`# ${title}`);
  if (routine.folder_id) {
    lines.push(`**Folder ID:** ${routine.folder_id}`);
  }
  lines.push('');

  lines.push('## Exercises');

  // Defensive check: ensure exercises exists and is an array
  if (!routine.exercises || !Array.isArray(routine.exercises)) {
    lines.push('No exercises defined.');
  } else {
    routine.exercises.forEach((exercise, idx) => {
      lines.push(`### ${idx + 1}. Exercise ID: ${exercise.exercise_template_id}`);
      if (exercise.superset_id) {
        lines.push(`   *Superset ID: ${exercise.superset_id}*`);
      }
      if (exercise.notes) {
        lines.push(`   *Notes: ${exercise.notes}*`);
      }

      lines.push(`   **${exercise.sets.length} sets planned**`);
      lines.push('');
    });
  }

  return lines.join('\n');
}

// Format exercise template
export function formatExerciseTemplate(exercise: ExerciseTemplate): string {
  const lines: string[] = [];

  lines.push(`**${exercise.title}**${exercise.is_custom ? ' (Custom)' : ''}`);
  lines.push(`Primary: ${exercise.primary_muscle_group}`);

  if (exercise.secondary_muscle_groups && exercise.secondary_muscle_groups.length > 0) {
    lines.push(`Secondary: ${exercise.secondary_muscle_groups.join(', ')}`);
  }

  if (exercise.equipment) {
    lines.push(`Equipment: ${exercise.equipment}`);
  }

  return lines.join('\n');
}

// Format date and time
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format duration in seconds to human readable
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// Calculate duration between two ISO timestamps
export function calculateDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  const durationSeconds = Math.floor(durationMs / 1000);
  return formatDuration(durationSeconds);
}

// Format workout list
export function formatWorkoutList(workouts: Workout[]): string {
  if (workouts.length === 0) {
    return 'No workouts found.';
  }

  const lines: string[] = [`Found ${workouts.length} workout(s):\n`];

  workouts.forEach((workout, idx) => {
    lines.push(`${idx + 1}. **${capitalizeTitle(workout.title)}**`);
    lines.push(`   ID: ${workout.id}`);
    lines.push(`   Date: ${formatDateTime(workout.start_time)}`);
    lines.push(`   Exercises: ${workout.exercises.length}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Format routine list
export function formatRoutineList(routines: Routine[]): string {
  if (routines.length === 0) {
    return 'No routines found.';
  }

  const lines: string[] = [`Found ${routines.length} routine(s):\n`];

  routines.forEach((routine, idx) => {
    lines.push(`${idx + 1}. **${capitalizeTitle(routine.title)}**`);
    lines.push(`   ID: ${routine.id}`);
    lines.push(`   Exercises: ${routine.exercises.length}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Format exercise template list
export function formatExerciseTemplateList(exercises: ExerciseTemplate[]): string {
  if (exercises.length === 0) {
    return 'No exercise templates found.';
  }

  const lines: string[] = [`Found ${exercises.length} exercise(s):\n`];

  exercises.forEach((exercise, idx) => {
    lines.push(`${idx + 1}. **${exercise.title}**${exercise.is_custom ? ' (Custom)' : ''}`);
    lines.push(`   ID: ${exercise.id}`);
    lines.push(`   Primary: ${exercise.primary_muscle_group}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Format workout summary for aggregated view
export function formatWorkoutSummary(summaries: WorkoutSummaryItem[]): string {
  if (summaries.length === 0) {
    return 'No workouts found.';
  }

  const lines: string[] = [`# Recent Workouts (${summaries.length})\n`];

  summaries.forEach((workout) => {
    const date = new Date(workout.date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    lines.push(`## ${workout.title}`);
    lines.push(`**${date}** | ${workout.duration}`);
    lines.push('');

    workout.exercises.forEach((ex) => {
      const setsStr = ex.sets
        .filter((s) => s.type !== 'warmup')
        .map((s) => {
          if (s.weight_kg && s.reps) {
            return `${s.weight_kg}kg x ${s.reps}`;
          }
          return null;
        })
        .filter(Boolean)
        .join(', ');

      const bestStr = ex.bestSet
        ? ` | Best: **${ex.bestSet.weight_kg}kg x ${ex.bestSet.reps}**`
        : '';

      lines.push(`- **${ex.name}**: ${setsStr}${bestStr}`);
    });

    lines.push('');
  });

  return lines.join('\n');
}

// Format lift progression report
export function formatLiftProgression(results: LiftProgressionResult[]): string {
  if (results.length === 0) {
    return 'No lift progression data available.';
  }

  const lines: string[] = ['# Lift Progression Report\n'];

  results.forEach((result) => {
    lines.push(`## ${result.exerciseName}`);

    if (result.exerciseId === 'NOT_FOUND') {
      lines.push('*Exercise not found in templates. Check the exercise name.*');
      lines.push('');
      return;
    }

    // Goal and progress line
    if (result.goalKg) {
      const current = result.currentEstimated1RM
        ? `${Math.round(result.currentEstimated1RM * 10) / 10} kg`
        : 'N/A';
      const progress = result.progressPercent ? `${result.progressPercent}%` : 'N/A';
      lines.push(`- **Goal:** ${result.goalKg} kg | **Current 1RM:** ${current} | **Progress:** ${progress}`);

      if (result.remainingKg !== undefined && result.remainingKg > 0) {
        lines.push(`- **Remaining:** ${result.remainingKg} kg to goal`);
      } else if (result.remainingKg === 0) {
        lines.push(`- **Goal reached!**`);
      }
    } else if (result.currentEstimated1RM) {
      lines.push(`- **Current Estimated 1RM:** ${Math.round(result.currentEstimated1RM * 10) / 10} kg`);
    }

    // PRs
    if (result.personalRecords.length > 0) {
      const weightPR = result.personalRecords.find((pr) => pr.type === 'weight');
      if (weightPR) {
        const prDate = new Date(weightPR.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        lines.push(`- **Weight PR:** ${weightPR.value} ${weightPR.unit} (${prDate})`);
      }
    }

    // Trend
    const trendEmoji = {
      improving: '📈',
      plateau: '➡️',
      declining: '📉',
      insufficient_data: '❓',
    }[result.trend];

    const trendText = {
      improving: 'Improving',
      plateau: 'Plateau',
      declining: 'Declining',
      insufficient_data: 'Insufficient data',
    }[result.trend];

    const deltaStr = result.trendDeltaKg
      ? ` (${result.trendDeltaKg > 0 ? '+' : ''}${result.trendDeltaKg} kg)`
      : '';

    lines.push(`- **Trend:** ${trendEmoji} ${trendText}${deltaStr}`);

    // Recent sessions
    if (result.recentSessions.length > 0) {
      lines.push('');
      lines.push('**Recent Sessions:**');
      result.recentSessions.forEach((session) => {
        const sessionDate = new Date(session.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const setsStr = session.topSets.map((s) => `${s.weight_kg}kg x ${s.reps}`).join(', ');
        lines.push(`- ${sessionDate}: ${setsStr || 'No working sets'}`);
      });
    }

    lines.push('');
  });

  return lines.join('\n');
}
