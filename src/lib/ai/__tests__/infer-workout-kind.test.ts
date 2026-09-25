/**
 * Run: npx tsx --test src/lib/ai/__tests__/infer-workout-kind.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAmbiguousWorkoutVsPlanRequest,
  looksLikeNamedFocusSession,
  looksLikeSingleSessionRequest,
  looksLikeWeekPlanRequest,
} from "../infer-workout-kind";

describe("looksLikeWeekPlanRequest", () => {
  it("treats plan / workout plan as a full week", () => {
    assert.equal(looksLikeWeekPlanRequest("make me a plan"), true);
    assert.equal(looksLikeWeekPlanRequest("create a workout plan"), true);
    assert.equal(looksLikeWeekPlanRequest("I need a training plan"), true);
    assert.equal(looksLikeWeekPlanRequest("build me a new plan"), true);
    assert.equal(looksLikeWeekPlanRequest("4-day split"), true);
    assert.equal(looksLikeWeekPlanRequest("PPL week"), true);
    assert.equal(looksLikeWeekPlanRequest("build me a program"), true);
    assert.equal(looksLikeWeekPlanRequest("hypertrophy split"), true);
    assert.equal(looksLikeWeekPlanRequest("push/pull/legs"), true);
  });

  it("does not treat meal plans or single days as week plans", () => {
    assert.equal(looksLikeWeekPlanRequest("nutrition plan"), false);
    assert.equal(looksLikeWeekPlanRequest("meal plan for today"), false);
    assert.equal(looksLikeWeekPlanRequest("push day"), false);
    assert.equal(looksLikeWeekPlanRequest("make me a push day"), false);
    assert.equal(looksLikeWeekPlanRequest("push day plan"), false);
    assert.equal(looksLikeWeekPlanRequest("build me push"), false);
    assert.equal(looksLikeWeekPlanRequest("I plan to train tomorrow"), false);
  });
});

describe("looksLikeSingleSessionRequest", () => {
  it("detects clear one-session requests", () => {
    assert.equal(looksLikeSingleSessionRequest("push day"), true);
    assert.equal(looksLikeSingleSessionRequest("push"), true);
    assert.equal(looksLikeSingleSessionRequest("one workout for today"), true);
    assert.equal(looksLikeSingleSessionRequest("HIIT session"), true);
    assert.equal(looksLikeSingleSessionRequest("chest workout"), true);
  });

  it("does not treat bare make-me-a-workout as a clear single session", () => {
    assert.equal(looksLikeSingleSessionRequest("make me a workout"), false);
    assert.equal(looksLikeSingleSessionRequest("build me a workout"), false);
    assert.equal(looksLikeSingleSessionRequest("I need a workout"), false);
  });

  it("yields to plan / week language", () => {
    assert.equal(looksLikeSingleSessionRequest("make me a plan"), false);
    assert.equal(looksLikeSingleSessionRequest("workout plan"), false);
    assert.equal(looksLikeSingleSessionRequest("3 day week program"), false);
    assert.equal(looksLikeSingleSessionRequest("push/pull/legs"), false);
  });
});

describe("isAmbiguousWorkoutVsPlanRequest", () => {
  it("flags vague workout asks", () => {
    assert.equal(isAmbiguousWorkoutVsPlanRequest("make me a workout"), true);
    assert.equal(isAmbiguousWorkoutVsPlanRequest("build me a workout"), true);
    assert.equal(isAmbiguousWorkoutVsPlanRequest("I need a workout"), true);
    assert.equal(isAmbiguousWorkoutVsPlanRequest("give me a workout"), true);
    assert.equal(isAmbiguousWorkoutVsPlanRequest("create a new workout"), true);
  });

  it("does not flag clear plan or focus-day asks", () => {
    assert.equal(isAmbiguousWorkoutVsPlanRequest("make me a plan"), false);
    assert.equal(isAmbiguousWorkoutVsPlanRequest("workout plan"), false);
    assert.equal(isAmbiguousWorkoutVsPlanRequest("push day"), false);
    assert.equal(isAmbiguousWorkoutVsPlanRequest("leg workout"), false);
    assert.equal(
      isAmbiguousWorkoutVsPlanRequest("one workout for today"),
      false
    );
    assert.equal(isAmbiguousWorkoutVsPlanRequest("HIIT session"), false);
  });
});

describe("looksLikeNamedFocusSession", () => {
  it("matches a single focus", () => {
    assert.equal(looksLikeNamedFocusSession("Push Day"), true);
    assert.equal(looksLikeNamedFocusSession("leg workout"), true);
  });

  it("rejects multi-focus splits", () => {
    assert.equal(looksLikeNamedFocusSession("push/pull/legs"), false);
    assert.equal(looksLikeNamedFocusSession("push and pull and legs"), false);
  });
});
