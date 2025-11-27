function calculateDeliveryCost(cartItems, deliveryCostPerMealPerDay) {
  let totalDeliveryCost = 0;

  for (const item of cartItems) {
    if (item.plan && item.menu) {
      const planDays = item.plan.durationDays;
      const numberOfSelectedMealTimes = item.selectedMealTimes
        ? item.selectedMealTimes.length
        : 0;
      const quantity = item.quantity;

      if (numberOfSelectedMealTimes > 0) {
        totalDeliveryCost +=
          planDays * numberOfSelectedMealTimes * deliveryCostPerMealPerDay;
      }
    }
  }

  return totalDeliveryCost;
}

function calculatePlatformCost(subtotal) {
  return subtotal * 0.1;
}

function calculateGstCost(subtotal) {
  return subtotal * 0.05;
}

function calculateGrandTotal({
  subtotal,
  deliveryCost,
  platformCost,
  gstCost,
  environment,
}) {
  return subtotal + deliveryCost + platformCost + gstCost;
}

module.exports = {
  calculateDeliveryCost,
  calculatePlatformCost,
  calculateGstCost,
  calculateGrandTotal,
};
