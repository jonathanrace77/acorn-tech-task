import { writable } from "svelte/store";

export const shoppingCategory = writable("mcmuffins");
export const shoppingCart = writable({
  doubleSausageMcmuffin: { count: 0, price: 2.89, isLarge: 0 },
  doubleSausageMcmuffinMeal: { count: 0, price: 4.39, isLarge: 0 },
  baconBrownSauce: { count: 0, price: 2.89, isLarge: 0 },
  baconBrownSauceMeal: { count: 0, price: 4.29, isLarge: 0 },
  pancakeSausageSyrup: { count: 0, price: 2.89, isLarge: 0 },
  pancakeSausageMeal: { count: 0, price: 3.69, isLarge: 0 },
});
