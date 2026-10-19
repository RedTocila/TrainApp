import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reminderSlotForHour, tiraneClock } from "../reminder-clock";
import { reminderMessageBand, reminderPushMessage } from "../reminder-message";
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

  it("uses 23:00 Tirane in summer and winter", () => {
    const summer = tiraneClock(new Date("2026-10-17T21:00:00.000Z"));
    assert.equal(summer.hour, 23);
    assert.equal(reminderSlotForHour(summer.hour), 4);

    const winter = tiraneClock(new Date("2026-11-17T22:00:00.000Z"));
    assert.equal(winter.hour, 23);
    assert.equal(reminderSlotForHour(winter.hour), 4);
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
  const open = ["workout", "water"] as const;

  it("picks a stable Alex line and varies it by seed", () => {
    const first = reminderPushMessage({
      open: [...open],
      done: [],
      locale: "en",
      slot: 1,
      seed: "user-a",
    });
    const again = reminderPushMessage({
      open: [...open],
      done: [],
      locale: "en",
      slot: 1,
      seed: "user-a",
    });
    assert.ok(first);
    assert.equal(first.title, again?.title);
    assert.match(first.body, /Workout and Water/);
    assert.equal(first.path, "/dashboard");
    assert.equal(reminderMessageBand({ openCount: 2, doneCount: 0, slot: 1 }), "none");

    let differed = false;
    for (let i = 0; i < 24; i++) {
      const next = reminderPushMessage({
        open: [...open],
        done: [],
        locale: "en",
        slot: 1,
        seed: `user-${i}`,
      });
      if (next?.title !== first.title) differed = true;
    }
    assert.equal(differed, true);
  });

  it("encourages when some of the day is already done", () => {
    assert.equal(
      reminderMessageBand({ openCount: 1, doneCount: 2, slot: 2 }),
      "almost"
    );
    const message = reminderPushMessage({
      open: ["habits"],
      done: ["workout", "water"],
      locale: "en",
      slot: 2,
      seed: "almost",
    });
    assert.equal(message?.path, "/dashboard");
    assert.match(message?.body ?? "", /Habits/);
  });

  it("deep-links a single open item", () => {
    const message = reminderPushMessage({
      open: ["meals"],
      done: [],
      locale: "al",
      slot: 1,
      seed: "meals",
    });
    assert.match(message?.body ?? "", /Vaktet/);
    assert.equal(message?.path, "/dashboard/nutrition");
  });

  it("sends the 23:00 line only when nothing is done", () => {
    const shame = reminderPushMessage({
      open: ["workout", "meals", "water"],
      done: [],
      locale: "en",
      slot: 4,
      seed: "night",
    });
    assert.equal(reminderMessageBand({ openCount: 3, doneCount: 0, slot: 4 }), "shame");
    assert.match(shame?.body ?? "", /Workout, Meals and Water/);

    assert.equal(
      reminderPushMessage({
        open: ["workout"],
        done: ["water"],
        locale: "en",
        slot: 4,
        seed: "night",
      }),
      null
    );
  });
});
