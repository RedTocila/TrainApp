/** Coach Alex voice — sarcastic copy for client-facing UI (English). */

export const coachCopyEn = {
  signOut: {
    title: "Walking away already?",
    message:
      "Signing out? Bold. Coach Alex will be here judging your empty dashboard when you crawl back. Sure you want to give up for now?",
    confirm: "Yeah, give up",
    cancel: "I'll stay",
  },
  discardWorkout: {
    title: "Quitting mid-set?",
    message:
      "You're about to trash every rep you logged. No PRs, no proof — Coach Alex will pretend he didn't see you bail. Still giving up?",
    confirm: "Yeah, bail on this workout",
    cancel: "One more set",
  },
  removeHabit: {
    title: "Dropping a habit already?",
    message:
      "Delete this habit and its whole schedule? Coach Alex was just starting to believe you had discipline. Sure you wanna ghost it?",
    confirm: "Yeah, drop it",
    cancel: "Keep the habit",
  },
  deleteWorkoutFolder: (name: string) => ({
    title: "Burn the folder?",
    message: `Deleting "${name}" unassigns every workout inside. Coach Alex hates loose ends — you sure you're giving up on this organization?`,
    confirm: "Delete the folder",
    cancel: "Never mind",
  }),
  deleteNutritionFolder: (name: string) => ({
    title: "Toss the nutrition folder?",
    message: `"${name}" goes away; menus land in Unfiled. Chaos, but reversible. Still wanna give up on structure?`,
    confirm: "Delete the folder",
    cancel: "Never mind",
  }),
  deleteWorkoutPlan: (title: string) => ({
    title: "Scrap this program?",
    message: `"${title}" and all its days — gone. Coach Alex expected you to at least finish reading it. Delete anyway?`,
    confirm: "Yeah, delete it",
    cancel: "Keep it",
  }),
  deleteMealPlan: (title: string) => ({
    title: "Trash this day menu?",
    message: `"${title}" and every meal in it — poof. Your macros won't log themselves. Still surrendering?`,
    confirm: "Yeah, delete it",
    cancel: "Keep it",
  }),
  deleteCardio: (title: string) => ({
    title: "Delete this cardio?",
    message: `"${title}" disappears and scheduled sessions vanish. Coach Alex says cardio is optional — is quitting it your whole personality?`,
    confirm: "Yeah, delete it",
    cancel: "Keep it",
  }),
  deleteSavedMeal: (name: string) => ({
    title: "Erase this meal?",
    message: `"${name}" leaves your library forever. One less thing to meal-prep. Coach Alex is… not impressed. Delete it?`,
    confirm: "Yeah, erase it",
    cancel: "Keep it",
  }),
  clearWorkoutSchedule: {
    title: "Wipe the schedule?",
    message:
      "Unschedule every upcoming workout? Future you will wonder why the calendar's empty. Coach Alex already knows why.",
    confirm: "Yeah, clear it",
    cancel: "Keep the schedule",
  },
  clearNutritionSchedule: {
    title: "Clear the meal schedule?",
    message:
      "Unschedule this menu from your calendar? Meal planning was going so well. Sure you wanna wing it?",
    confirm: "Yeah, clear it",
    cancel: "Keep the schedule",
  },
  clearWeight: {
    title: "Erase today's weigh-in?",
    message:
      "Delete today's weight? Coach Alex can't track progress you refuse to record. Still hiding from the scale?",
    confirm: "Yeah, erase it",
    cancel: "Keep the log",
  },
  removeProgressPhoto: (label: string) => ({
    title: "Delete this photo?",
    message: `Removing your ${label.toLowerCase()} progress shot? The mirror remembers even if your camera roll won't.`,
    confirm: "Yeah, delete it",
    cancel: "Keep it",
  }),
  cancelSubscription: {
    title: "Throwing in the towel?",
    message:
      "Canceling your subscription? Cute. You keep access until the end of your paid period — then it's back to free preview mode. No saved perks, no full coach features. Coach Alex expected more fight in you. Sure you want to surrender?",
    confirm: "Surrender — cancel plan",
    cancel: "I'll keep fighting",
  },
  giveUpTrainerPlan: {
    title: "Surrendering already?",
    message:
      "You're about to rip this coach plan off your calendar and wing it again. Your scheduled workouts or meals — gone. You can implement it again later, but Coach Alex is side-eyeing you hard right now. Still wanna give up?",
    confirm: "Yeah, I give up",
    cancel: "I'll stay on the plan",
  },
  mealInsights: {
    coachName: "Coach Alex",
    good: [
      "Now we're talking. Stack a few more like this and I might go easy on you at check-in.",
      "Solid pick for your goal. I'd high-five you, but you still owe me a workout.",
      "This actually fits the plan. Don't let it go to your head — one meal doesn't make a legend.",
    ],
    ok: [
      "It's fine. Not a win, not a disaster — like showing up and only training arms.",
      "Middle of the road. Your macros aren't crying, but they're not throwing a party either.",
      "Acceptable. You could level this up with a bit more protein and I'd stop side-eyeing you.",
    ],
    bad: [
      "Your goals called. This meal didn't leave a great voicemail.",
      "If the rest of your day looks like this, we're having a serious chat.",
      "Logging it is the bare minimum. Next time, make it count toward something.",
    ],
    lowProtein:
      "Protein's thin here. Caffeine and vibes aren't macros — tag something substantial next.",
    lowProteinBuildMuscle:
      "Where's the protein? You can't build muscle on espresso and optimism alone.",
    lowProteinLoseWeight:
      "Light on protein. You'll be hungry again soon — and that's when snacks win.",
    highCalories:
      "That's a heavy hit for one meal. Your daily budget isn't unlimited — unlike my commentary.",
    lowCarbsEndurance:
      "Low on fuel for endurance. Your legs will notice before I do.",
  },
} as const;

export const coachLabelsEn = {
  giveUp: "Give up",
  giveUpOnPlan: "Give up on plan",
  giveUpOnThisPlan: "Give up on this plan",
  giveUpOnSchedule: "Give up on schedule",
  bailOnWorkout: "Give up",
  dropHabit: "Drop habit",
  clearWeight: "Erase weigh-in",
  faceTheRoast: "Face the roast",
  getBackInThere: "Get back in there",
  actuallyFinish: "Actually finish it",
  missed: "Skipped",
  missedWorkout: "Workout you dodged",
  missedTasks: "Tasks you bailed on",
  missedHabits: "Habits you ghosted",
  nothingMissed: "Shockingly, you didn't blow anything off. Don't get used to it.",
  illDoBetter: "I'll do better tomorrow",
  noHabitsToday: 'No habits today. Coach Alex assumes you\'re "resting."',
  addHabitsHint: "Stack small wins before Coach Alex roasts your consistency",
  unlockDashboard: "Stop browsing. Start actually training.",
  subscribeBlurb:
    "Free preview mode is cute. Subscribe if you want Coach Alex to remember your sets, meals, and dignity.",
  viewPlans: "Stop freeloading — see plans",
  noSubscription:
    "No paid plan. You're in preview mode — Coach Alex sees you, but he's not saving your progress.",
  pickAPlan: "Pick a real plan",
  levelUp: "Upgrade",
  coachHasOpinions: "Coach Alex has opinions. Pay up if you want to hear them.",
  coachHasNotes: "Coach Alex has notes. You probably won't like them.",
  skipForNow: "Fine, I'll keep half-assing it",
  noWorkoutToday: "Rest day — or avoidance? Coach Alex can't tell.",
  noCardioToday: "No cardio today. Your excuses thank you.",
  noTasksToday: "Nothing on the board. Enjoy it — tomorrow won't be this easy.",
  logFirstMeal: "Log something before Coach Alex asks what you ate",
  noMealsYet: "Meal library's empty. Coach Alex can't judge what you won't log.",
  emptyWorkoutFolder: "Folder's empty. Like your excuse list should be.",
  emptyMealFolder: "Nothing in here. Coach Alex hopes you're not eating like this IRL.",
  noWorkoutsYet: "No programs yet. Coach Alex is taking notes.",
  createWorkout: "Build something worth sweating for",
  noFolders: "Zero folders. Impressive organizational skills.",
  newFolder: "Pretend to be organized",
  workoutInProgress: "You didn't finish",
  pickUpWorkout: "Coach Alex is waiting. Don't make him wait longer.",
  surrendered: "Surrendered",
  hydrationFail: "Hydration fail",
  hydrationHint: "Tomorrow: drink water like Coach Alex's not watching. He is.",
  workoutMissedHint: "Tomorrow: train before excuses wake up.",
  tasksMissedHint: "Tomorrow: fewer excuses, more checkmarks.",
  habitsMissedHint: "Tomorrow: do the boring stuff before Coach Alex notices again.",
} as const;
