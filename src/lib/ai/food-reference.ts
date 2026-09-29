/**
 * Nutrient reference values per 100 g (kcal, protein, carbs, fat, fiber).
 *
 * Source: USDA FoodData Central — SR Legacy (April 2018 release), looked up by
 * FDC id (https://fdc.nal.usda.gov/fdc-app.html#/food-details/<fdcId>).
 * "composite" = average of the listed FDC foods (e.g. mixed berries).
 * Foods absent here (protein powders, bars, plant milks, ready meals…) use
 * typical label values in `food-catalog.ts` and are marked `source: "label"`.
 *
 * Real foods vary by variety, season, brand and preparation (typically ±5–15%),
 * so these are the best available reference values — not lab measurements of
 * the client's actual food.
 */

export type FoodReference = {
  source: "usda" | "composite";
  fdcId?: number;
  fdcIds?: number[];
  per100: readonly [number, number, number, number, number];
  /** Raw / dry reference for foods whose main basis is cooked. */
  raw?: { fdcId: number; per100: readonly [number, number, number, number, number] };
};

export const FOOD_REFERENCE: Record<string, FoodReference> = {
  // Chicken, broilers or fryers, breast, meat only, cooked, roasted
  chicken_breast: { source: "usda", fdcId: 171477, per100: [165, 31.0, 0, 3.6, 0], raw: { fdcId: 171077, per100: [120, 22.5, 0, 2.6, 0] } },
  // Chicken, broilers or fryers, thigh, meat only, cooked, roasted
  chicken_thigh: { source: "usda", fdcId: 172388, per100: [179, 24.8, 0, 8.2, 0], raw: { fdcId: 173627, per100: [121, 19.7, 0, 4.1, 0] } },
  // Turkey, whole, breast, meat only, cooked, roasted
  turkey_breast: { source: "usda", fdcId: 171496, per100: [147, 30.1, 0, 2.1, 0], raw: { fdcId: 171098, per100: [114, 23.7, 0.1, 1.5, 0] } },
  // Turkey, ground, 93% lean, 7% fat, pan-broiled crumbles
  turkey_mince: { source: "usda", fdcId: 172851, per100: [213, 27.1, 0, 11.6, 0], raw: { fdcId: 172850, per100: [150, 18.7, 0, 8.3, 0] } },
  // Beef, top sirloin, steak, separable lean only, trimmed to 0" fat, all grades, cooked, broiled
  lean_beef: { source: "usda", fdcId: 168634, per100: [183, 30.6, 0, 5.8, 0], raw: { fdcId: 174055, per100: [131, 22.1, 0, 4.1, 0] } },
  // Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned
  beef_mince: { source: "usda", fdcId: 171794, per100: [230, 28.4, 0, 12.0, 0], raw: { fdcId: 174030, per100: [176, 20.0, 0, 10.0, 0] } },
  // Lamb, leg, whole (shank and sirloin), separable lean only, trimmed to 1/4" fat, choice, cooked, roasted
  lamb: { source: "usda", fdcId: 174314, per100: [191, 28.3, 0, 7.7, 0] },
  // Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted
  pork_loin: { source: "usda", fdcId: 168250, per100: [143, 26.2, 0, 3.5, 0] },
  // Fish, salmon, Atlantic, farmed, cooked, dry heat
  salmon: { source: "usda", fdcId: 175168, per100: [206, 22.1, 0, 12.3, 0], raw: { fdcId: 175167, per100: [208, 20.4, 0, 13.4, 0] } },
  // Fish, trout, rainbow, farmed, cooked, dry heat
  trout: { source: "usda", fdcId: 173718, per100: [168, 23.8, 0, 7.4, 0] },
  // Fish, cod, Atlantic, cooked, dry heat
  white_fish: { source: "usda", fdcId: 171956, per100: [105, 22.8, 0, 0.9, 0], raw: { fdcId: 171955, per100: [82, 17.8, 0, 0.7, 0] } },
  // Fish, tuna, light, canned in water, drained solids
  tuna: { source: "usda", fdcId: 173709, per100: [86, 19.4, 0, 1.0, 0] },
  // Fish, sardine, Atlantic, canned in oil, drained solids with bone
  sardines: { source: "usda", fdcId: 175139, per100: [208, 24.6, 0, 11.4, 0] },
  // Crustaceans, shrimp, cooked
  shrimp: { source: "usda", fdcId: 175180, per100: [99, 24.0, 0.2, 0.3, 0] },
  // Egg, whole, raw, fresh
  eggs: { source: "usda", fdcId: 171287, per100: [143, 12.6, 0.7, 9.5, 0] },
  // Egg, white, raw, fresh
  egg_whites: { source: "usda", fdcId: 172183, per100: [52, 10.9, 0.7, 0.2, 0] },
  // Yogurt, Greek, plain, lowfat
  greek_yogurt: { source: "usda", fdcId: 170903, per100: [73, 9.9, 3.9, 1.9, 0] },
  // Yogurt, plain, whole milk
  yogurt: { source: "usda", fdcId: 171284, per100: [61, 3.5, 4.7, 3.2, 0] },
  // Cheese, cottage, lowfat, 2% milkfat
  cottage_cheese: { source: "usda", fdcId: 172182, per100: [81, 10.4, 4.8, 2.3, 0] },
  // Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D
  milk: { source: "usda", fdcId: 171267, per100: [50, 3.3, 4.8, 2.0, 0] },
  // Cheese, cheddar
  cheese: { source: "usda", fdcId: 173414, per100: [403, 22.9, 3.4, 33.3, 0] },
  // Cheese, feta
  feta: { source: "usda", fdcId: 173420, per100: [265, 14.2, 3.9, 21.5, 0] },
  // Cheese, mozzarella, part skim milk
  mozzarella: { source: "usda", fdcId: 170847, per100: [254, 24.3, 2.8, 15.9, 0] },
  // Tofu, raw, firm, prepared with calcium sulfate
  tofu: { source: "usda", fdcId: 172475, per100: [144, 17.3, 2.8, 8.7, 2.3] },
  // Tempeh
  tempeh: { source: "usda", fdcId: 174272, per100: [192, 20.3, 7.6, 10.8, 0] },
  // Edamame, frozen, prepared
  edamame: { source: "usda", fdcId: 168411, per100: [121, 11.9, 8.9, 5.2, 5.2] },
  // Lentils, mature seeds, cooked, boiled, without salt
  lentils: { source: "usda", fdcId: 172421, per100: [116, 9.0, 20.1, 0.4, 7.9], raw: { fdcId: 172420, per100: [352, 24.6, 63.4, 1.1, 10.7] } },
  // Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt
  chickpeas: { source: "usda", fdcId: 173757, per100: [164, 8.9, 27.4, 2.6, 7.6] },
  // Beans, black, mature seeds, cooked, boiled, without salt
  black_beans: { source: "usda", fdcId: 173735, per100: [132, 8.9, 23.7, 0.5, 8.7] },
  // Beans, kidney, all types, mature seeds, cooked, boiled, without salt
  kidney_beans: { source: "usda", fdcId: 173740, per100: [127, 8.7, 22.8, 0.5, 6.4] },
  // Rice, white, long-grain, regular, enriched, cooked
  white_rice: { source: "usda", fdcId: 168878, per100: [130, 2.7, 28.2, 0.3, 0.4], raw: { fdcId: 168877, per100: [365, 7.1, 80.0, 0.7, 1.3] } },
  // Rice, brown, long-grain, cooked
  brown_rice: { source: "usda", fdcId: 169704, per100: [123, 2.7, 25.6, 1.0, 1.6], raw: { fdcId: 169703, per100: [367, 7.5, 76.2, 3.2, 3.6] } },
  // Cereals, oats, regular and quick, not fortified, dry
  oats: { source: "usda", fdcId: 173904, per100: [379, 13.2, 67.7, 6.5, 10.1] },
  // Potatoes, boiled, cooked without skin, flesh, without salt
  potatoes: { source: "usda", fdcId: 170440, per100: [86, 1.7, 20.0, 0.1, 1.8], raw: { fdcId: 170026, per100: [77, 2.0, 17.5, 0.1, 2.1] } },
  // Sweet potato, cooked, baked in skin, flesh, without salt
  sweet_potato: { source: "usda", fdcId: 168483, per100: [90, 2.0, 20.7, 0.1, 3.3] },
  // Quinoa, cooked
  quinoa: { source: "usda", fdcId: 168917, per100: [120, 4.4, 21.3, 1.9, 2.8] },
  // Pasta, cooked, enriched, without added salt
  pasta: { source: "usda", fdcId: 169737, per100: [158, 5.8, 30.9, 0.9, 1.8], raw: { fdcId: 169736, per100: [371, 13.0, 74.7, 1.5, 3.2] } },
  // Pasta, whole-wheat, cooked
  wholewheat_pasta: { source: "usda", fdcId: 168910, per100: [149, 6.0, 30.1, 1.7, 3.9], raw: { fdcId: 169738, per100: [352, 13.9, 73.4, 2.9, 9.2] } },
  // Bulgur, cooked
  bulgur: { source: "usda", fdcId: 170287, per100: [83, 3.1, 18.6, 0.2, 4.5] },
  // Couscous, cooked
  couscous: { source: "usda", fdcId: 169700, per100: [112, 3.8, 23.2, 0.2, 1.4] },
  // Bread, whole-wheat, commercially prepared
  wholegrain_bread: { source: "usda", fdcId: 172688, per100: [252, 12.4, 42.7, 3.5, 6.0] },
  // Bread, white, commercially prepared (includes soft bread crumbs)
  white_bread: { source: "usda", fdcId: 174924, per100: [266, 8.8, 49.4, 3.3, 2.7] },
  // Bread, gluten-free, white, made with rice flour, corn starch, and/or tapioca
  gf_bread: { source: "usda", fdcId: 174100, per100: [248, 4.3, 45.8, 5.2, 4.3] },
  // Tortillas, ready-to-bake or -fry, flour, refrigerated
  wholewheat_wrap: { source: "usda", fdcId: 175037, per100: [306, 8.2, 49.4, 8.0, 3.5] },
  // Tortillas, ready-to-bake or -fry, corn
  corn_tortilla: { source: "usda", fdcId: 175036, per100: [218, 5.7, 44.6, 2.9, 6.3] },
  // Snacks, rice cakes, brown rice, plain, unsalted
  rice_cakes: { source: "usda", fdcId: 170250, per100: [387, 8.2, 81.5, 2.8, 4.2] },
  // Buckwheat groats, roasted, cooked
  buckwheat: { source: "usda", fdcId: 170686, per100: [92, 3.4, 19.9, 0.6, 2.7] },
  // Corn, sweet, yellow, frozen, kernels cut off cob, boiled, drained, without salt
  corn: { source: "usda", fdcId: 168399, per100: [81, 2.5, 19.3, 0.7, 2.4] },
  // Rice noodles, cooked
  rice_noodles: { source: "usda", fdcId: 168914, per100: [108, 1.8, 24.0, 0.2, 1.0] },
  // Cereals ready-to-eat, FAMILIA
  muesli: { source: "usda", fdcId: 169076, per100: [388, 9.5, 73.8, 6.3, 8.5] },
  // Bananas, raw
  banana: { source: "usda", fdcId: 173944, per100: [89, 1.1, 22.8, 0.3, 2.6] },
  // Apples, raw, with skin
  apple: { source: "usda", fdcId: 171688, per100: [52, 0.3, 13.8, 0.2, 2.4] },
  // Oranges, raw, all commercial varieties
  orange: { source: "usda", fdcId: 169097, per100: [47, 0.9, 11.8, 0.1, 2.4] },
  // Pears, raw
  pear: { source: "usda", fdcId: 169118, per100: [57, 0.4, 15.2, 0.1, 3.1] },
  // Average of strawberries, blueberries, raspberries (raw)
  berries: { source: "composite", fdcIds: [167762, 171711, 167755], per100: [47.0, 0.9, 11.4, 0.4, 3.6] },
  // Kiwifruit, green, raw
  kiwi: { source: "usda", fdcId: 168153, per100: [61, 1.1, 14.7, 0.5, 3.0] },
  // Grapes, red or green (European type, such as Thompson seedless), raw
  grapes: { source: "usda", fdcId: 174683, per100: [69, 0.7, 18.1, 0.2, 0.9] },
  // Mangos, raw
  mango: { source: "usda", fdcId: 169910, per100: [60, 0.8, 15.0, 0.4, 1.6] },
  // Peaches, yellow, raw
  peach: { source: "usda", fdcId: 169928, per100: [39, 0.9, 9.5, 0.2, 1.5] },
  // Pineapple, raw, all varieties
  pineapple: { source: "usda", fdcId: 169124, per100: [50, 0.5, 13.1, 0.1, 1.4] },
  // Watermelon, raw
  watermelon: { source: "usda", fdcId: 167765, per100: [30, 0.6, 7.5, 0.1, 0.4] },
  // Dates, medjool
  dates: { source: "usda", fdcId: 168191, per100: [277, 1.8, 75.0, 0.1, 6.7] },
  // Raisins, dark, seedless
  raisins: { source: "usda", fdcId: 168165, per100: [299, 3.3, 79.3, 0.2, 4.5] },
  // Plums, raw
  plum: { source: "usda", fdcId: 169949, per100: [46, 0.7, 11.4, 0.3, 1.4] },
  // Orange juice, raw
  orange_juice: { source: "usda", fdcId: 169098, per100: [45, 0.7, 10.4, 0.2, 0.2] },
  // Average of broccoli (boiled), red bell pepper, carrots, green beans (boiled)
  mixed_vegetables: { source: "composite", fdcIds: [169967, 170108, 170393, 169141], per100: [34.0, 1.5, 7.7, 0.3, 2.8] },
  // Lettuce, green leaf, raw
  salad: { source: "usda", fdcId: 169249, per100: [15, 1.4, 2.9, 0.1, 1.3] },
  // Broccoli, cooked, boiled, drained, without salt
  broccoli: { source: "usda", fdcId: 169967, per100: [35, 2.4, 7.2, 0.4, 3.3] },
  // Spinach, raw
  spinach: { source: "usda", fdcId: 168462, per100: [23, 2.9, 3.6, 0.4, 2.2] },
  // Peppers, sweet, red, raw
  bell_pepper: { source: "usda", fdcId: 170108, per100: [26, 1.0, 6.0, 0.3, 2.1] },
  // Tomatoes, red, ripe, raw, year round average
  tomato: { source: "usda", fdcId: 170457, per100: [18, 0.9, 3.9, 0.2, 1.2] },
  // Cucumber, with peel, raw
  cucumber: { source: "usda", fdcId: 168409, per100: [15, 0.7, 3.6, 0.1, 0.5] },
  // Carrots, raw
  carrot: { source: "usda", fdcId: 170393, per100: [41, 0.9, 9.6, 0.2, 2.8] },
  // Squash, summer, zucchini, includes skin, raw
  zucchini: { source: "usda", fdcId: 169291, per100: [17, 1.2, 3.1, 0.3, 1.0] },
  // Beans, snap, green, cooked, boiled, drained, without salt
  green_beans: { source: "usda", fdcId: 169141, per100: [35, 1.9, 7.9, 0.3, 3.2] },
  // Peas, green, frozen, cooked, boiled, drained, without salt
  green_peas: { source: "usda", fdcId: 170017, per100: [78, 5.2, 14.3, 0.3, 4.5] },
  // Cauliflower, cooked, boiled, drained, without salt
  cauliflower: { source: "usda", fdcId: 170397, per100: [23, 1.8, 4.1, 0.5, 2.3] },
  // Mushrooms, white, raw
  mushrooms: { source: "usda", fdcId: 169251, per100: [22, 3.1, 3.3, 0.3, 1.0] },
  // Onions, raw
  onion: { source: "usda", fdcId: 170000, per100: [40, 1.1, 9.3, 0.1, 1.7] },
  // Asparagus, cooked, boiled, drained
  asparagus: { source: "usda", fdcId: 168390, per100: [22, 2.4, 4.1, 0.2, 2.0] },
  // Cabbage, raw
  cabbage: { source: "usda", fdcId: 169975, per100: [25, 1.3, 5.8, 0.1, 2.5] },
  // Kale, raw
  kale: { source: "usda", fdcId: 168421, per100: [35, 2.9, 4.4, 1.5, 4.1] },
  // Eggplant, cooked, boiled, drained, without salt
  eggplant: { source: "usda", fdcId: 169229, per100: [35, 0.8, 8.7, 0.2, 2.5] },
  // Beets, cooked, boiled, drained
  beetroot: { source: "usda", fdcId: 169146, per100: [44, 1.7, 10.0, 0.2, 2.0] },
  // Tomato products, canned, sauce
  tomato_sauce: { source: "usda", fdcId: 170054, per100: [24, 1.2, 5.3, 0.3, 1.5] },
  // Oil, olive, salad or cooking
  olive_oil: { source: "usda", fdcId: 171413, per100: [884, 0, 0, 100.0, 0] },
  // Oil, canola
  vegetable_oil: { source: "usda", fdcId: 172336, per100: [884, 0, 0, 100.0, 0] },
  // Butter, without salt
  butter: { source: "usda", fdcId: 173430, per100: [717, 0.8, 0.1, 81.1, 0] },
  // Avocados, raw, all commercial varieties
  avocado: { source: "usda", fdcId: 171705, per100: [160, 2.0, 8.5, 14.7, 6.7] },
  // Olives, ripe, canned (small-extra large)
  olives: { source: "usda", fdcId: 169094, per100: [116, 0.8, 6.0, 10.9, 1.6] },
  // Nuts, almonds
  almonds: { source: "usda", fdcId: 170567, per100: [579, 21.1, 21.6, 49.9, 12.5] },
  // Nuts, walnuts, english
  walnuts: { source: "usda", fdcId: 170187, per100: [654, 15.2, 13.7, 65.2, 6.7] },
  // Nuts, mixed nuts, dry roasted, with peanuts, without salt added
  nuts_mixed: { source: "usda", fdcId: 170585, per100: [607, 19.5, 22.4, 53.5, 6.4] },
  // Nuts, cashew nuts, raw
  cashews: { source: "usda", fdcId: 170162, per100: [553, 18.2, 30.2, 43.9, 3.3] },
  // Peanuts, all types, raw
  peanuts: { source: "usda", fdcId: 172430, per100: [567, 25.8, 16.1, 49.2, 8.5] },
  // Peanut butter, smooth style, without salt
  peanut_butter: { source: "usda", fdcId: 172470, per100: [598, 22.2, 22.3, 51.4, 5.0] },
  // Nuts, almond butter, plain, without salt added
  almond_butter: { source: "usda", fdcId: 168588, per100: [614, 21.0, 18.8, 55.5, 10.3] },
  // Seeds, sunflower seed butter, without salt
  sunflower_seed_butter: { source: "usda", fdcId: 170155, per100: [617, 17.3, 23.3, 55.2, 5.7] },
  // Seeds, sesame butter, tahini, from roasted and toasted kernels (most common type)
  tahini: { source: "usda", fdcId: 170189, per100: [595, 17.0, 21.2, 53.8, 9.3] },
  // Seeds, chia seeds, dried
  chia_seeds: { source: "usda", fdcId: 170554, per100: [486, 16.5, 42.1, 30.7, 34.4] },
  // Seeds, flaxseed
  flaxseed: { source: "usda", fdcId: 169414, per100: [534, 18.3, 28.9, 42.2, 27.3] },
  // Seeds, pumpkin and squash seed kernels, dried
  pumpkin_seeds: { source: "usda", fdcId: 170556, per100: [559, 30.2, 10.7, 49.0, 6.0] },
  // Seeds, sunflower seed kernels, dried
  sunflower_seeds: { source: "usda", fdcId: 170562, per100: [584, 20.8, 20.0, 51.5, 8.6] },
  // Hummus, commercial
  hummus: { source: "usda", fdcId: 174289, per100: [237, 7.8, 15.0, 17.8, 5.5] },
  // Chocolate, dark, 70-85% cacao solids
  dark_chocolate: { source: "usda", fdcId: 170273, per100: [598, 7.8, 45.9, 42.6, 10.9] },
  // Soymilk (all flavors), unsweetened, with added calcium, vitamins A and D
  soy_milk: { source: "usda", fdcId: 175215, per100: [33, 2.9, 1.7, 1.6, 0.5] },
  // Beverages, almond milk, unsweetened, shelf stable
  almond_milk: { source: "usda", fdcId: 174832, per100: [15, 0.4, 1.3, 1.0, 0.2] },
  // SILK Plain soy yogurt
  soy_yogurt: { source: "usda", fdcId: 175227, per100: [66, 2.6, 9.7, 1.8, 0.4] },
  // Garlic, raw
  garlic: { source: "usda", fdcId: 169230, per100: [149, 6.4, 33.1, 0.5, 2.1] },
  // Lemon juice, raw
  lemon: { source: "usda", fdcId: 167747, per100: [22, 0.3, 6.9, 0.2, 0.3] },
  // Vinegar, balsamic
  vinegar: { source: "usda", fdcId: 172241, per100: [88, 0.5, 17.0, 0, 0] },
  // Soy sauce made from soy and wheat (shoyu)
  soy_sauce: { source: "usda", fdcId: 174277, per100: [53, 8.1, 4.9, 0.6, 0.8] },
  // Mustard, prepared, yellow
  mustard: { source: "usda", fdcId: 172234, per100: [60, 3.7, 5.8, 3.3, 4.0] },
  // Sauce, salsa, ready-to-serve
  salsa: { source: "usda", fdcId: 174524, per100: [29, 1.5, 6.6, 0.2, 1.9] },
  // Honey
  honey: { source: "usda", fdcId: 169640, per100: [304, 0.3, 82.4, 0, 0.2] },
  // Syrups, maple
  maple_syrup: { source: "usda", fdcId: 169661, per100: [260, 0.0, 67.0, 0.1, 0] },
  // Catsup
  ketchup: { source: "usda", fdcId: 168556, per100: [101, 1.0, 27.4, 0.1, 0.3] },
  // Salad dressing, mayonnaise, regular
  mayonnaise: { source: "usda", fdcId: 171009, per100: [680, 1.0, 0.6, 74.8, 0] },
  // Beverages, coffee, brewed, prepared with tap water
  coffee: { source: "usda", fdcId: 171890, per100: [1, 0.1, 0, 0.0, 0] },
  // Beverages, tea, black, brewed, prepared with tap water
  tea: { source: "usda", fdcId: 173227, per100: [1, 0, 0.3, 0, 0] },
  // Ham, sliced, regular (approximately 11% fat)
  ham: { source: "usda", fdcId: 173864, per100: [164, 16.6, 3.6, 8.8, 1.3] },
  // Turkey breast, sliced, prepackaged
  turkey_slices: { source: "usda", fdcId: 172941, per100: [106, 14.8, 2.2, 3.8, 0] },
  // Pork, cured, bacon, cooked, baked
  bacon: { source: "usda", fdcId: 167914, per100: [548, 35.7, 1.4, 43.3, 0] },
  // Pork sausage, link/patty, cooked, pan-fried
  sausage: { source: "usda", fdcId: 174578, per100: [325, 18.5, 1.4, 27.2, 0] },
  // Salami, dry or hard, pork
  salami: { source: "usda", fdcId: 172938, per100: [407, 22.6, 1.6, 33.7, 0] },
  // Cereals ready-to-eat, MALT-O-MEAL, Frosted Flakes
  sugary_cereal: { source: "usda", fdcId: 172990, per100: [389, 4.2, 90.2, 0.9, 1.2] },
  // Cereals ready-to-eat, granola, homemade
  granola: { source: "usda", fdcId: 171646, per100: [489, 13.7, 53.9, 24.3, 8.9] },
  // Snacks, potato chips, plain, salted
  chips: { source: "usda", fdcId: 169677, per100: [532, 6.4, 53.8, 34.0, 3.1] },
  // Snacks, popcorn, air-popped
  popcorn: { source: "usda", fdcId: 167959, per100: [387, 12.9, 77.8, 4.5, 14.5] },
  // Cookies, chocolate chip, commercially prepared, regular, higher fat, enriched
  cookies: { source: "usda", fdcId: 172716, per100: [492, 5.1, 65.4, 24.7, 2.0] },
  // Cake, yellow, commercially prepared, with chocolate frosting, in-store bakery
  cake: { source: "usda", fdcId: 174944, per100: [379, 3.2, 55.4, 17.8, 1.5] },
  // Ice creams, vanilla
  ice_cream: { source: "usda", fdcId: 167575, per100: [207, 3.5, 23.6, 11.0, 0.7] },
  // Beverages, carbonated, cola, regular
  soda: { source: "usda", fdcId: 174852, per100: [42, 0, 10.4, 0.2, 0] },
  // Fast foods, hamburger; single, regular patty; plain
  fast_food: { source: "usda", fdcId: 170693, per100: [297, 16.5, 31.5, 12.0, 1.7] },
  // Soup, ramen noodle, any flavor, dry
  instant_noodles: { source: "usda", fdcId: 171177, per100: [440, 10.2, 60.3, 17.6, 2.9] },
  // Margarine, regular, 80% fat, composite, stick, with salt
  margarine: { source: "usda", fdcId: 172346, per100: [717, 0.2, 0.7, 80.7, 0] },
  // Yogurt, fruit, low fat, 10 grams protein per 8 ounce
  flavored_yogurt: { source: "usda", fdcId: 171285, per100: [102, 4.4, 19.1, 1.1, 0] },
};
