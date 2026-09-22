/**
 * Phase 4: surgical workout edit tests.
 * Run: npx tsx --test src/lib/ai/__tests__/workout-surgical-edits.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addWorkoutExercise,
  adjustWorkoutDifficulty,
  removeWorkoutExercise,
  replaceWorkoutExercise,
  SurgicalEditError,
} from "../workout-surgical-edits";
import type { AiGeneratedWorkoutPlan } from "../plan-builder-types";
import type { Profile } from "../../types";

function samplePlan(): AiGeneratedWorkoutPlan {
  return {
    kind: "strength",
    title: "Test Plan",
    description: "",
    days_per_week: 2,
    days: [
      {
        title: "Push",
        exercises: [
          { name: "Push-up", sets: 3, reps: "10-12", rest_seconds: 60 },
          { name: "Dumbbell Bench Press", sets: 3, reps: "8-10", rest_seconds: 90 },
          { name: "Walking Lunge", sets: 3, reps: "10", rest_seconds: 60 },
        ],
      },
      {
        title: "Pull",
        exercises: [
          { name: "Pull-up", sets: 3, reps: "6-8", rest_seconds: 90 },
          { name: "Bodyweight Standing Row", sets: 3, reps: "12", rest_seconds: 60 },
        ],
      },
    ],
    coach_notes: [],
  };
}

function fakeProfile(equipmentAccess?: string[]): Profile {
  return {
    id: "test",
    gender: "male",
    intake_responses: {
      equipment_access: equipmentAccess ?? ["full_gym"],
      training_experience: "intermediate",
    },
  } as Profile;
}

describe("removeWorkoutExercise", () => {
  it("removes exercise 2 and leaves others intact", () => {
    const plan = samplePlan();
    const before = plan.days[0]!.exercises.map((e) => e.name);
    const { plan: next, summary } = removeWorkoutExercise(plan, {
      dayNumber: 1,
      exerciseNumber: 2,
    });
    assert.equal(next.days[0]!.exercises.length, 2);
    assert.equal(next.days[0]!.exercises[0]!.name, before[0]);
    assert.equal(next.days[0]!.exercises[1]!.name, before[2]);
    assert.equal(next.days[1]!.exercises.length, 2); // other day untouched
    assert.match(summary, /Removed/i);
  });

  it("removes by name", () => {
    const { plan: next } = removeWorkoutExercise(samplePlan(), {
      dayNumber: 1,
      exerciseName: "walking lunge",
    });
    assert.ok(!next.days[0]!.exercises.some((e) => /lunge/i.test(e.name)));
  });

  it("refuses to remove the last exercise", () => {
    const plan: AiGeneratedWorkoutPlan = {
      ...samplePlan(),
      days: [
        {
          title: "Solo",
          exercises: [
            { name: "Push-up", sets: 3, reps: "10", rest_seconds: 60 },
          ],
        },
      ],
    };
    assert.throws(
      () => removeWorkoutExercise(plan, { exerciseNumber: 1 }),
      (err: unknown) =>
        err instanceof SurgicalEditError && err.code === "empty_day"
    );
  });
});

describe("replaceWorkoutExercise", () => {
  it("replaces only the targeted exercise and keeps sets/reps", () => {
    const plan = samplePlan();
    const original = plan.days[0]!.exercises[2]!;
    const { plan: next } = replaceWorkoutExercise(plan, fakeProfile(), {
      dayNumber: 1,
      exerciseNumber: 3,
      replacementName: "push-ups",
    });
    assert.equal(next.days[0]!.exercises.length, 3);
    assert.equal(next.days[0]!.exercises[0]!.name, "Push-up");
    assert.equal(next.days[0]!.exercises[1]!.name, "Dumbbell Bench Press");
    assert.match(next.days[0]!.exercises[2]!.name, /push-up/i);
    assert.equal(next.days[0]!.exercises[2]!.sets, original.sets);
    assert.equal(next.days[0]!.exercises[2]!.reps, original.reps);
    assert.equal(next.days[0]!.exercises[2]!.rest_seconds, original.rest_seconds);
  });

  it("auto-picks a different replacement when name omitted", () => {
    const { plan: next } = replaceWorkoutExercise(
      samplePlan(),
      fakeProfile(["bodyweight"]),
      {
        dayNumber: 1,
        exerciseName: "Walking Lunge",
      }
    );
    const names = next.days[0]!.exercises.map((e) => e.name.toLowerCase());
    assert.ok(!names.includes("walking lunge"));
    assert.equal(next.days[0]!.exercises.length, 3);
  });
});

describe("addWorkoutExercise", () => {
  it("adds a named exercise", () => {
    const { plan: next } = addWorkoutExercise(samplePlan(), fakeProfile(), {
      dayNumber: 1,
      exerciseName: "front plank with twist",
    });
    assert.equal(next.days[0]!.exercises.length, 4);
    assert.match(
      next.days[0]!.exercises[3]!.name.toLowerCase(),
      /plank/
    );
  });

  it("adds by target muscle when name omitted", () => {
    const { plan: next } = addWorkoutExercise(
      samplePlan(),
      fakeProfile(["bodyweight"]),
      {
        dayNumber: 2,
        targetMuscle: "core",
      }
    );
    assert.equal(next.days[1]!.exercises.length, 3);
  });
});

describe("adjustWorkoutDifficulty", () => {
  it("makes plan harder without changing exercise names", () => {
    const plan = samplePlan();
    const namesBefore = plan.days.flatMap((d) => d.exercises.map((e) => e.name));
    const { plan: next } = adjustWorkoutDifficulty(plan, "harder");
    const namesAfter = next.days.flatMap((d) => d.exercises.map((e) => e.name));
    assert.deepEqual(namesAfter, namesBefore);
    assert.ok(next.days[0]!.exercises[0]!.sets > plan.days[0]!.exercises[0]!.sets);
  });

  it("makes a single day easier", () => {
    const plan = samplePlan();
    const pullSetsBefore = plan.days[1]!.exercises[0]!.sets;
    const { plan: next } = adjustWorkoutDifficulty(plan, "easier", {
      dayNumber: 2,
    });
    assert.equal(next.days[0]!.exercises[0]!.sets, plan.days[0]!.exercises[0]!.sets);
    assert.ok(next.days[1]!.exercises[0]!.sets < pullSetsBefore);
  });
});
