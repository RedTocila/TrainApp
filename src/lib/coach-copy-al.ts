/** Coach Alex voice — sarcastic copy for client-facing UI (Albanian). */

export const coachCopyAl = {
  signOut: {
    title: "Po ik tashmë?",
    message:
      "Po dilni? Guxim. Coach Alex do të jetë këtu duke gjykuar panelin tuaj bosh kur të ktheheni me vështirësi. Jeni të sigurt që doni të dorëzoheni për tani?",
    confirm: "Po, dorëzohem",
    cancel: "Po qëndroj",
  },
  discardWorkout: {
    title: "Po braktis në mes të serisë?",
    message:
      "Po fshini çdo përsëritje që keni regjistruar. Asnjë rekord, asnjë provë — Coach Alex do të bëjë sikur nuk ju pa të ikni. Ende po dorëzoheni?",
    confirm: "Po, braktis këtë stërvitje",
    cancel: "Edhe një seri",
  },
  removeHabit: {
    title: "Po e lë zakonin tashmë?",
    message:
      "Të fshihet ky zakon dhe i gjithë orari i tij? Coach Alex sapo filloi të besonte se kishit disiplinë. Jeni të sigurt që doni ta largoni?",
    confirm: "Po, hiqe",
    cancel: "Mbaje zakonin",
  },
  deleteWorkoutFolder: (name: string) => ({
    title: "Të djegim dosjen?",
    message: `Fshirja e "${name}" heq çdo stërvitje brenda. Coach Alex urren gjërat e papërfunduara — jeni të sigurt që po dorëzoheni nga organizimi?`,
    confirm: "Fshi dosjen",
    cancel: "Harroje",
  }),
  deleteNutritionFolder: (name: string) => ({
    title: "Të hedhim dosjen e ushqimit?",
    message: `"${name}" zhduket; menytë shkojnë te të pafilesuara. Kaos, por e kthyeshme. Ende doni të dorëzoheni nga struktura?`,
    confirm: "Fshi dosjen",
    cancel: "Harroje",
  }),
  deleteWorkoutPlan: (title: string) => ({
    title: "Të hedhim poshtë këtë program?",
    message: `"${title}" dhe të gjitha ditët e tij — zhduken. Coach Alex pritej të paktën ta mbaronit leximin. Të fshihet gjithsesi?`,
    confirm: "Po, fshije",
    cancel: "Mbaje",
  }),
  deleteMealPlan: (title: string) => ({
    title: "Të hedhim poshtë këtë menu ditor?",
    message: `"${title}" dhe çdo vakt brenda — zhduken. Makrot tuaja nuk regjistrohen vetë. Ende po dorëzoheni?`,
    confirm: "Po, fshije",
    cancel: "Mbaje",
  }),
  deleteCardio: (title: string) => ({
    title: "Të fshihet ky kardio?",
    message: `"${title}" zhduket dhe seancat e planifikuara humbasin. Coach Alex thotë kardio është opsional — a është braktisja e tij personaliteti juaj?`,
    confirm: "Po, fshije",
    cancel: "Mbaje",
  }),
  deleteSavedMeal: (name: string) => ({
    title: "Të fshihet ky vakt?",
    message: `"${name}" largohet nga biblioteka përgjithmonë. Një gjë më pak për të përgatitur. Coach Alex… nuk është i impresionuar. Ta fshij?`,
    confirm: "Po, fshije",
    cancel: "Mbaje",
  }),
  clearWorkoutSchedule: {
    title: "Të pastrohet orari?",
    message:
      "Të hiqen nga orari të gjitha stërvitjet e ardhshme? Ju i ardhshmi do të pyesë pse kalendari është bosh. Coach Alex e di tashmë pse.",
    confirm: "Po, pastroje",
    cancel: "Mbaje orarin",
  },
  clearNutritionSchedule: {
    title: "Të pastrohet orari i vakteve?",
    message:
      "Të hiqet kjo menu nga kalendari? Planifikimi i vakteve po shkonte kaq mirë. Jeni të sigurt që doni ta lini në rastësi?",
    confirm: "Po, pastroje",
    cancel: "Mbaje orarin",
  },
  clearWeight: {
    title: "Të fshihet peshimi i sotëm?",
    message:
      "Të fshihet pesha e sotme? Coach Alex nuk mund të ndjekë progresin që refuzoni ta regjistroni. Ende po fshiheni nga peshoreja?",
    confirm: "Po, fshije",
    cancel: "Mbaje regjistrimin",
  },
  removeProgressPhoto: (label: string) => ({
    title: "Të fshihet kjo foto?",
    message: `Po hiqni foton e progresit (${label.toLowerCase()})? Pasqyra mban mend edhe nëse albumi juaj jo.`,
    confirm: "Po, fshije",
    cancel: "Mbaje",
  }),
  cancelSubscription: {
    title: "Po hedhni peshqirën?",
    message:
      "Po anuloni abonimin? E bukur. Keni akses deri në fund të periudhës së paguar — pastaj ktheheni në modalitetin falas. Pa përfitime të ruajtura, pa funksione të plota. Coach Alex pritej më shumë luftë nga ju. Jeni të sigurt që doni të dorëzoheni?",
    confirm: "Dorëzohem — anulo planin",
    cancel: "Do të vazhdoj të luftoj",
  },
  giveUpTrainerPlan: {
    title: "Po dorëzoheni tashmë?",
    message:
      "Po e hiqni këtë plan trajneri nga kalendari dhe po ktheheni në rastësi. Stërvitjet ose vaktet e planifikuara — zhduken. Mund ta zbatoni përsëri më vonë, por Coach Alex po ju shikon me skepticizëm. Ende doni të dorëzoheni?",
    confirm: "Po, dorëzohem",
    cancel: "Do të qëndroj në plan",
  },
  mealInsights: {
    coachName: "Coach Alex",
    good: [
      "{name} — {protein}g proteinë dhe {calories} kal. Tani po flasim. Bëni edhe disa të tilla dhe ndoshta do t'ju lehtësoj në kontroll.",
      "Zgjedhje e mirë me {name}: {protein}g proteinë përshtaten me planin. Do t'ju duartrokisja, por ende më keni një stërvitje borxh.",
      "{name} funksionon — {calories} kal, makro të regjistruara. Mos u mbani shumë për një vakt të mirë.",
    ],
    ok: [
      "{name} është në rregull me {calories} kal — as fitore, as katastrofë. Si të stërvitësh vetëm krahët.",
      "Mesatar: {protein}g proteinë në {name}. Makronutrientët nuk po festojnë, por as nuk po qajnë.",
      "{name} u regjistrua me {calories} kal. E pranueshme — pak më shumë proteinë dhe do pushoj së ju shikuar me skepticizëm.",
    ],
    bad: [
      "{name} me {calories} kal — qëllimet telefonuan dhe ky vakt nuk la një mesazh të mirë.",
      "Nëse pjesa tjetër e ditës duket si {name}, do të kemi një bisedë serioze.",
      "Regjistruat {name}. Minimumi u bë. Herën tjetër, bëni që numrat të numërojnë.",
    ],
    lowProtein: [
      "{name} ka vetëm {protein}g proteinë — pak për qëllimin tuaj. {highlight} nuk mjafton vetëm.",
      "{protein}g proteinë në {name}? Kafeina dhe motivimi nuk janë makro — shtoni diçka substanciale.",
      "{name} mbeti i lehtë në proteinë ({protein}g). Muskujt ende presin furnizim real.",
    ],
    lowProteinReasonableCal: [
      "{name}: {calories} kal duken mirë, por {protein}g proteinë janë pak. {highlight} ndihmon — shtoni një burim më të fortë proteinash.",
      "Kaloritë janë në rregull në {name}, proteinat jo ({protein}g). Regjistrim i mirë; përmirësoni anën e proteinave.",
      "{name} me {calories} kal — energjia ok, karburanti për muskuj jo. Shtyni proteinën mbi {protein}g herën tjetër.",
    ],
    lowProteinBuildMuscle: [
      "{name} me {protein}g proteinë nuk ndërton shumë muskul. Ku është pjesa tjetër e pjatës?",
      "Ndërtim muskujsh me {protein}g nga {name}? Nuk mjafton vetëm optimizmi.",
      "{protein}g proteinë në {name} — kjo është ngrohje, jo vakt muskulor. Shtoni proteinë.",
    ],
    lowProteinLoseWeight: [
      "{name} me {protein}g proteinë — do të keni uri përsëri shpejt, dhe atëherë fitojnë snackët.",
      "Pak proteinë ({protein}g) në {name}. {calories} kal nuk do t'ju mbajnë gjatë.",
      "{protein}g proteinë nuk mban ditën. {name} ka nevojë për më shumë qëndrueshmëri.",
    ],
    strongProtein: [
      "{protein}g proteinë në {name} — ky është karburanti që dua të shoh.",
      "{name} sjell {protein}g proteinë. Vazhdoni kështu dhe jemi në linjë.",
      "Proteinë e fortë: {name} me {protein}g. Qëllimet dhe kjo pjatë flasin së bashku.",
    ],
    highCalories: [
      "{name} me {calories} kal është goditje e rëndë për një vakt. Buxheti ditor nuk është i pafund.",
      "{calories} kal në një vakt ({name})? E guximshme. Balanconi pjesën tjetër të ditës.",
      "{name} mbushi {calories} kal — shumë buxhet në një regjistrim. Planifikoni vaktet e ardhshme.",
    ],
    lowCarbsEndurance: [
      "{name} ka vetëm {carbs}g karbohidrate — pak karburant për qëndrueshmëri. Këmbët do ta vërejë para meje.",
      "{carbs}g karbo në {name} nuk mbajnë një seancë të rëndë. Shtoni karburant nëse stërviteni sot.",
      "Qëndrueshmëria ka nevojë për karbo — {name} me {carbs}g po ecën me rezerva të ulëta.",
    ],
  },
  navLoading: {
    coachName: "Coach Alex",
    quips: [
      "Ende këtu? Do të ngrohesha ndërkohë — po, e di, nuk është stili juaj.",
      "Po ngarkohet… ndryshe nga justifikimet tuaja, kjo ka një fund.",
      "Një sekondë. Qëndrueshmëria juaj mund të mësojë nga serverët tanë.",
      "Po marr faqen. Të marr disiplinën tuaj do të zgjaste më shumë.",
      "Prit — po rregulloj pikselat. Do t'i rregulloni makrot tuaja ndonjëherë?",
      "Pothuajse gati. Ndryshe nga tentativa juaj e fundit për rekord.",
      "Po ngarkohet tab-i tjetër. Motivimi nuk përfshihet.",
      "Aplikacioni po zgjatet para stërvitjes. Provoni edhe ju.",
      "Po buferohet… të paktën diçka po përparon sot.",
      "Jepni një sekondë. Ju dhashë një program të plotë dhe ende po vendosni ku të klikoni.",
      "Po navigon më shpejt se sa shmangni ditën e këmbëve.",
      "Po ngarkohet. Mos rifreskoni — seria juaj nuk e përballon një reset tjetër.",
    ],
  },
} as const;

export const coachLabelsAl = {
  giveUp: "Dorëzohem",
  giveUpOnPlan: "Dorëzohem nga plani",
  giveUpOnThisPlan: "Dorëzohem nga ky plan",
  giveUpOnSchedule: "Dorëzohem nga orari",
  bailOnWorkout: "Dorëzohem",
  dropHabit: "Hiq zakonin",
  clearWeight: "Fshi peshimin",
  faceTheRoast: "Përballu me kritikën",
  getBackInThere: "Kthehu në stërvitje",
  actuallyFinish: "Mbaroje vërtet",
  missed: "U anashkalua",
  missedWorkout: "Stërvitja që shmangët",
  missedTasks: "Detyrat që braktisët",
  missedHabits: "Zakonet që larguat",
  nothingMissed: "Për çudi, nuk braktisët asgjë. Mos u mësoni me këtë.",
  illDoBetter: "Do të bëj më mirë nesër",
  noHabitsToday: 'Sot nuk ka zakone. Coach Alex supozon se jeni "në pushim."',
  addHabitsHint: "Grumbulloni fitore të vogla para se Coach Alex të kritikojë qëndrueshmërinë tuaj",
  unlockDashboard: "Ndalo të shfletosh. Fillo të stërvitesh vërtet.",
  subscribeBlurb:
    "Modaliteti falas është i lezetshëm. Abonohu nëse don që Coach Alex të mbajë mend seritë, vaktet dhe dinjitetin tënd.",
  viewPlans: "Ndalo falas — shiko planet",
  noSubscription:
    "Nuk keni plan të paguar. Jeni në modalitet parashikimi — Coach Alex ju sheh, por nuk po ruan progresin tuaj.",
  pickAPlan: "Zgjidh një plan të vërtetë",
  levelUp: "Përmirësohu",
  coachHasOpinions: "Coach Alex ka mendime. Paguaj nëse don t'i dëgjosh.",
  coachHasNotes: "Coach Alex ka shënime. Nuk do t'ju pëlqejnë.",
  skipForNow: "Mirë, do të vazhdoj gjysmë",
  noWorkoutToday: "Ditë pushimi — apo shmangie? Coach Alex nuk e di.",
  noCardioToday: "Sot nuk ka kardio. Justifikimet tuaja ju falënderojnë.",
  noTasksToday: "Asgjë në listë. Shijojeni — nesër nuk do të jetë kaq e lehtë.",
  logFirstMeal: "Regjistro diçka para se Coach Alex të pyesë çfarë ke ngrënë",
  noMealsYet: "Biblioteka e vakteve është bosh. Coach Alex nuk mund të gjykojë atë që nuk regjistron.",
  emptyWorkoutFolder: "Dosja është bosh. Si lista juaj e justifikimeve duhet të jetë.",
  emptyMealFolder: "Asgjë këtu. Coach Alex shpreson që nuk po hani kështu në jetën reale.",
  noWorkoutsYet: "Ende nuk ka programe. Coach Alex po mban shënime.",
  createWorkout: "Ndërto diçka që vlen të djersitësh",
  noFolders: "Zero dosje. Aftësi organizative mbresëlënëse.",
  newFolder: "Shto dosje (pretendo organizimin)",
  workoutInProgress: "Nuk e përfundove",
  pickUpWorkout: "Coach Alex po pret. Mos e bëj të presë më shumë.",
  surrendered: "U dorëzua",
  hydrationFail: "Dështim me ujin",
  hydrationHint:
    "Nesër: pini ujë sikur Coach Alex nuk po ju shikon. Po ju shikon.",
  workoutMissedHint: "Nesër: stërvitu para se justifikimet të zgjohen.",
  tasksMissedHint: "Nesër: më pak justifikime, më shumë shenja të kryera.",
  habitsMissedHint:
    "Nesër: bëni gjërat e mërzitshme para se Coach Alex ta vërejë përsëri.",
} as const;
