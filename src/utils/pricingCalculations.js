export function calculateDeliveryCost(
  cartItems, // Renamed from 'items' to 'cartItems' for consistency with frontend
  deliveryCostPerMealPerDay
) {
  let totalDeliveryCost = 0;

  for (const item of cartItems) {
    // Replicating frontend logic for calculating mealsPerDay
    if (item.plan && item.menu && item.menu.menuItems && item.menu.menuItems.length > 0) {
      const planDays = item.plan.durationDays;

      // Get the first day from the menu items to count meals per day
      const firstDay = item.menu.menuItems[0].day;
      const mealsPerDay = new Set(
        item.menu.menuItems
          .filter((menuItem) => menuItem.day === firstDay)
          .map((menuItem) => menuItem.category)
      ).size;

      totalDeliveryCost += planDays * mealsPerDay * deliveryCostPerMealPerDay;
    }
  }

  return totalDeliveryCost;
}

export function calculatePlatformCost(subtotal) {
  return subtotal * 0.1;
}

export function calculateGstCost(subtotal) {
  return subtotal * 0.05;
}

export function calculateGrandTotal({
  subtotal,
  deliveryCost,
  platformCost,
  gstCost,
  environment, // Add environment parameter for conditional logic
}) {
  return subtotal + deliveryCost + platformCost + gstCost;
}
