import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reminderSlotForHour, tiraneClock } from "../reminder-clock";
import { reminderPushMessage } from "../reminder-message";
import {
  cardioStillOpen,
  habitsStillOpen,
  openReminderTypes,
  scheduledWorkoutsStillOpen,
} from "../reminder-pending";
import { DEFAULT_REMINDER_SETTINGS } from "../reminder-settings";

describe("reminder push windows", () => {
  it("uses 11:00 Tirane in summer and winter", () => {
    const summer = tiraneClock(new Date("2026-10-17T09:00:00.000Z"));
    assert.equal(summer.dateKey, "2026-10-17");
    assert.equal(summer.hour, 11);
    assert.equal(reminderSlotForHour(summer.hour), 1);

    const winter = tiraneClock(new Date("2026-11-17T10:00:00.000Z"));
    assert.equal(winter.dateKey, "2026-11-17");
    assert.equal(winter.hour, 11);
    assert.equal(reminderSlotForHour(winter.hour), 1);
    assert.equal(reminderSlotForHour(10), null);
  });
});

describe("open reminder types", () => {
  const settings = {
    ...DEFAULT_REMINDER_SETTINGS,
    enabled: true,
  };

  it("lists only unfinished enabled types", () => {
    const open = openReminderTypes({
      settings,
      mealsLogged: false,
      waterMl: 0,
      waterGoalMl: 2500,
      workoutsOpen: true,
      cardioOpen: false,
      habitsOpen: true,
    });
    assert.deepEqual(open, ["workout", "meals", "water", "habits"]);
  });

  it("skips a finished workout and a disabled type", () => {
    const open = openReminderTypes({
      settings: {
        ...settings,
        meals: { ...settings.meals, enabled: false },
      },
      mealsLogged: false,
      waterMl: 2500,
      waterGoalMl: 2500,
      workoutsOpen: false,
      cardioOpen: false,
      habitsOpen: false,
    });
    assert.deepEqual(open, []);
  });

  it("treats a completed scheduled workout as closed", () => {
    assert.equal(
      scheduledWorkoutsStillOpen({
        dateKey: "2026-10-17",
        scheduled: [{ id: "w1", planId: "p", dayId: "d" }],
        sessions: [
          {
            scheduledWorkoutId: "w1",
            planId: "p",
            dayId: "d",
            status: "completed",
            notes: null,
          },
        ],
        taskIds: new Set(),
      }),
      false
    );
  });

  it("keeps cardio open until that session is done", () => {
    assert.equal(
      cardioStillOpen({
        dateKey: "2026-10-17",
        cardioIds: ["c1"],
        taskIds: new Set(["2026-10-17-cardio-c1"]),
      }),
      false
    );
    assert.equal(
      habitsStillOpen({
        habitIds: ["h1"],
        completedHabitIds: new Set(),
      }),
      true
    );
  });
});

describe("reminder push copy", () => {
  it("uses one line when several things are open", () => {
    const message = reminderPushMessage(["workout", "water"], "en");
    assert.equal(message.title, "Still open today");
    assert.equal(message.body, "Workout and Water are still open.");
    assert.equal(message.path, "/dashboard");
  });

  it("deep-links a single open item", () => {
    const message = reminderPushMessage(["meals"], "al");
    assert.equal(message.title, "Vaktet pa u regjistruar");
    assert.equal(message.path, "/dashboard/nutrition");
  });
});
