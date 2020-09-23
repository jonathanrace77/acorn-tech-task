<script>
  import { shoppingCategory } from "./stores.js";
  import { shoppingCart } from "./stores.js";
  let name = "world!!";

  function handleCategorySelect(event) {
    shoppingCategory.set(event.target.id);
  }

  function handleAddToCartButton(event) {
    console.log($shoppingCart.doubleSausageMcmuffin);
    shoppingCart.update("doubleSausageMcmuffin", (n) => n + 1);
  }
</script>

<style>
  #main-container {
    display: flex;
    background: red;
  }

  #categories-section {
    width: 25vw;
    height: 100vh;
  }

  #shopping-section {
    width: 50vw;
    height: 100vh;
    background: pink;
  }

  #shopping-cart-section {
    width: 25vw;
    height: 100vh;
    background: #dddddd;
  }
</style>

<div id="main-container">
  <div id="categories-section">
    Categories area
    <ul>
      <li id="mcmuffins" on:click={handleCategorySelect}>McMuffins</li>
      <li id="wraps" on:click={handleCategorySelect}>Wraps & Rolls</li>
      <li id="porridge" on:click={handleCategorySelect}>Porridge & Pancakes</li>
    </ul>
  </div>

  <div id="shopping-section">
    {#if $shoppingCategory === 'mcmuffins'}
      <div class="doubleSausageMcmuffin">
        <h2>McMuffins Section</h2>
        <div>
          <h3>Double Sausage and Egg McMuffin®</h3>
          <p>
            For nutritional and allergen information for our food please visit
            http://mcdonalds.co.uk/nutrition.
          </p>
          <p>
            <!-- to 2 decimal places -->
            {Math.trunc($shoppingCart.doubleSausageMcmuffin.price * 100) / 100}
          </p>
          <button
            id="doubleSausageMcmuffin"
            on:click={() => $shoppingCart['doubleSausageMcmuffin']['count']++}>ADD
            TO CART</button>
        </div>

        <div class="doubleSausageMcmuffinMeal">
          <h3>Double Sausage Egg McMuffin® Meal</h3>
          <p>
            For nutritional and allergen information for our food please visit
            http://mcdonalds.co.uk/nutrition.
          </p>
          <p>
            <!-- to 2 decimal places -->
            {Math.trunc($shoppingCart.doubleSausageMcmuffinMeal.price * 100) / 100}
          </p>
          <button
            id="doubleSausageMcmuffinMeal"
            on:click={() => $shoppingCart['doubleSausageMcmuffinMeal']['count']++}>ADD
            TO CART</button>
        </div>
      </div>
    {:else if $shoppingCategory === 'wraps'}
      <div>
        <h2>Wraps Section</h2>
        <div>
          <h3>Bacon Roll with Brown Sauce</h3>
          <p>
            For nutritional and allergen information for our food please visit
            http://mcdonalds.co.uk/nutrition.
          </p>
          <p>
            <!-- to 2 decimal places -->
            {Math.trunc($shoppingCart.baconBrownSauce.price * 100) / 100}
          </p>
          <button
            id="baconBrownSauce"
            on:click={() => $shoppingCart['baconBrownSauce']['count']++}>ADD TO
            CART</button>
        </div>

        <div class="baconBrownSauceMeal">
          <h3>Bacon Roll with Brown Sauce Meal</h3>
          <p>
            For nutritional and allergen information for our food please visit
            http://mcdonalds.co.uk/nutrition.
          </p>
          <p>
            <!-- to 2 decimal places -->
            {Math.trunc($shoppingCart.baconBrownSauceMeal.price * 100) / 100}
          </p>
          <button
            id="baconBrownSauceMeal"
            on:click={() => $shoppingCart['baconBrownSauceMeal']['count']++}>ADD
            TO CART</button>
        </div>
      </div>
    {:else if $shoppingCategory === 'porridge'}
      <div>
        <h2>Porridge Section</h2>
        <div>
          <h3>Pancakes & Sausage with Syrup</h3>
          <p>
            For nutritional and allergen information for our food please visit
            http://mcdonalds.co.uk/nutrition.
          </p>
          <p>
            <!-- to 2 decimal places -->
            {Math.trunc($shoppingCart.pancakeSausageSyrup.price * 100) / 100}
          </p>
          <button
            id="pancakeSausageSyrup"
            on:click={() => $shoppingCart['pancakeSausageSyrup']['count']++}>ADD
            TO CART</button>
        </div>

        <div class="pancakeSausageMeal">
          <h3>Pancakes & Sausage Meal</h3>
          <p>
            For nutritional and allergen information for our food please visit
            http://mcdonalds.co.uk/nutrition.
          </p>
          <p>
            <!-- to 2 decimal places -->
            {Math.trunc($shoppingCart.pancakeSausageMeal.price * 100) / 100}
          </p>
          <button
            id="pancakeSausageMeal"
            on:click={() => $shoppingCart['pancakeSausageMeal']['count']++}>ADD
            TO CART</button>
        </div>
      </div>
    {/if}
  </div>

  <div id="shopping-cart-section">
    Shopping cart {#if $shoppingCart.doubleSausageMcmuffin.count}
      <p>Double Sausage and Egg McMuffin®</p>
      {$shoppingCart.doubleSausageMcmuffin.count}
      <!-- to 2 decimal places -->
      {Math.trunc($shoppingCart.doubleSausageMcmuffin.price * $shoppingCart.doubleSausageMcmuffin.count * 100) / 100 + $shoppingCart.doubleSausageMcmuffin.isLarge * $shoppingCart.doubleSausageMcmuffin.count}
      <button
        id="decrement"
        on:click={() => $shoppingCart['doubleSausageMcmuffin']['count']--}>-</button>
      <button
        id="increment"
        on:click={() => $shoppingCart['doubleSausageMcmuffin']['count']++}>+</button>
      <button
        id="isLarge"
        on:click={() => ($shoppingCart['doubleSausageMcmuffin']['isLarge'] = Math.abs($shoppingCart['doubleSausageMcmuffin']['isLarge'] - 1))}>SuperSize!</button>
    {/if}
    {#if $shoppingCart.doubleSausageMcmuffinMeal.count}
      <p>Double Sausage and Egg McMuffin®</p>
      {$shoppingCart.doubleSausageMcmuffinMeal.count}
      <!-- Price -->
      <!-- to 2 decimal places -->
      {Math.trunc($shoppingCart.doubleSausageMcmuffinMeal.price * $shoppingCart.doubleSausageMcmuffinMeal.count * 100) / 100 + $shoppingCart.doubleSausageMcmuffinMeal.isLarge * $shoppingCart.doubleSausageMcmuffinMeal.count}
      <button
        class="decrement-button"
        id="decrement"
        on:click={() => $shoppingCart['doubleSausageMcmuffinMeal']['count']--}>-</button>
      <button
        id="increment"
        on:click={() => $shoppingCart['doubleSausageMcmuffinMeal']['count']++}>+</button>
      <button
        id="isLarge"
        on:click={() => ($shoppingCart['doubleSausageMcmuffinMeal']['isLarge'] = Math.abs($shoppingCart['doubleSausageMcmuffinMeal']['isLarge'] - 1))}>SuperSize!</button>
    {/if}
    {#if $shoppingCart.baconBrownSauce.count}
      <p>Bacon Roll with Brown Sauce</p>
      {$shoppingCart.baconBrownSauce.count}
      <!-- to 2 decimal places -->
      {Math.trunc($shoppingCart.baconBrownSauce.price * $shoppingCart.baconBrownSauce.count * 100) / 100 + $shoppingCart.baconBrownSauce.isLarge * $shoppingCart.baconBrownSauce.count}
      <button
        id="decrement"
        on:click={() => $shoppingCart['baconBrownSauce']['count']--}>-</button>
      <button
        id="increment"
        on:click={() => $shoppingCart['baconBrownSauce']['count']++}>+</button>
      <button
        id="isLarge"
        on:click={() => ($shoppingCart['baconBrownSauce']['isLarge'] = Math.abs($shoppingCart['baconBrownSauce']['isLarge'] - 1))}>SuperSize!</button>
    {/if}
    {#if $shoppingCart.baconBrownSauceMeal.count}
      <p>Bacon Roll with Brown Sauce Meal</p>
      {$shoppingCart.baconBrownSauceMeal.count}
      <!-- Price -->
      <!-- to 2 decimal places -->
      {Math.trunc($shoppingCart.baconBrownSauceMeal.price * $shoppingCart.baconBrownSauceMeal.count * 100) / 100 + $shoppingCart.baconBrownSauceMeal.isLarge * $shoppingCart.baconBrownSauceMeal.count}
      <button
        id="decrement"
        on:click={() => $shoppingCart['baconBrownSauceMeal']['count']--}>-</button>
      <button
        id="increment"
        on:click={() => $shoppingCart['baconBrownSauceMeal']['count']++}>+</button>
      <button
        id="isLarge"
        on:click={() => ($shoppingCart['baconBrownSauceMeal']['isLarge'] = Math.abs($shoppingCart['baconBrownSauceMeal']['isLarge'] - 1))}>SuperSize!</button>
    {/if}
    {#if $shoppingCart.pancakeSausageSyrup.count}
      <p>Pancakes & Sausage with Syrup</p>
      {$shoppingCart.pancakeSausageSyrup.count}
      <!-- to 2 decimal places -->
      {Math.trunc($shoppingCart.pancakeSausageSyrup.price * $shoppingCart.pancakeSausageSyrup.count * 100) / 100 + $shoppingCart.pancakeSausageSyrup.isLarge * $shoppingCart.pancakeSausageSyrup.count}
      <button
        id="decrement"
        on:click={() => $shoppingCart['pancakeSausageSyrup']['count']--}>-</button>
      <button
        id="increment"
        on:click={() => $shoppingCart['pancakeSausageSyrup']['count']++}>+</button>
      <button
        id="isLarge"
        on:click={() => ($shoppingCart['pancakeSausageSyrup']['isLarge'] = Math.abs($shoppingCart['pancakeSausageSyrup']['isLarge'] - 1))}>SuperSize!</button>
    {/if}
    {#if $shoppingCart.pancakeSausageMeal.count}
      <p>Pancakes & Sausage Meal</p>
      {$shoppingCart.pancakeSausageMeal.count}
      <!-- Price -->
      <!-- to 2 decimal places -->
      {Math.trunc($shoppingCart.pancakeSausageMeal.price * $shoppingCart.pancakeSausageMeal.count * 100) / 100 + $shoppingCart.pancakeSausageMeal.isLarge * $shoppingCart.pancakeSausageMeal.count}
      <button
        id="decrement"
        on:click={() => $shoppingCart['pancakeSausageMeal']['count']--}>-</button>
      <button
        id="increment"
        on:click={() => $shoppingCart['pancakeSausageMeal']['count']++}>+</button>
      <button
        id="isLarge"
        on:click={() => ($shoppingCart['pancakeSausageMeal']['isLarge'] = Math.abs($shoppingCart['pancakeSausageMeal']['isLarge'] - 1))}>SuperSize!</button>
    {/if}
  </div>
</div>
