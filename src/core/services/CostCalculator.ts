import type { Member } from '../models/types';

export class CostCalculator {
  /**
   * Calculates the price per shuttlecock from a tube.
   * e.g. tube price 300,000 / 12 shuttlecocks = 25,000/shuttlecock
   */
  static pricePerShuttlecock(tubePrice: number, perTube: number): number {
    if (perTube <= 0) return 0;
    return tubePrice / perTube;
  }

  /**
   * Calculates the shuttlecock fee for a session.
   * e.g. 3 shuttlecocks used × 25,000/shuttlecock = 75,000
   */
  static shuttlecockFee(
    shuttlecocksUsed: number,
    tubePrice: number,
    perTube: number
  ): number {
    const unitPrice = this.pricePerShuttlecock(tubePrice, perTube);
    return Math.round(shuttlecocksUsed * unitPrice);
  }

  /**
   * Calculates the cost split for a session.
   * Total = Court + Shuttlecock fee
   * Remaining = Total - Subsidy (if available in fund)
   * Per Person = Remaining / (Attendees + Guests)
   */
  static calculateSessionCost(
    courtFee: number,
    shuttlecockFee: number,
    attendeeCount: number,
    guestCount: number,
    availableFund: number
  ): { totalCost: number; subsidyUsed: number; remainingCost: number; costPerPerson: number; costPerPersonNoSubsidy: number } {
    const totalCost = courtFee + shuttlecockFee;

    // Use fund to subsidize as much of the total cost as possible
    const subsidyUsed = Math.min(totalCost, availableFund);

    const remainingCost = totalCost - subsidyUsed;
    const totalPeople = attendeeCount + guestCount;

    let costPerPerson = totalPeople > 0 ? remainingCost / totalPeople : 0;
    costPerPerson = Math.round(costPerPerson / 1000) * 1000;

    // Cost without any subsidy (raw split)
    let costPerPersonNoSubsidy = totalPeople > 0 ? totalCost / totalPeople : 0;
    costPerPersonNoSubsidy = Math.round(costPerPersonNoSubsidy / 1000) * 1000;

    return {
      totalCost,
      subsidyUsed,
      remainingCost,
      costPerPerson,
      costPerPersonNoSubsidy,
    };
  }

  /**
   * Calculates the detailed cost breakdown for a session.
   * - Casual Guests (guests): flat fee 35,000 VND
   * - Employees: paid by company support fund
   * - Regular members: share remaining cost and deducted from prepaid balance
   */
  static calculateDetailedSessionCost(
    courtFee: number,
    shuttlecockFee: number,
    attendees: Member[],
    guestCount: number // Free guests from sessions
  ): {
    totalCost: number;
    guestCountTotal: number;
    guestFeeTotal: number;
    remainingCost: number;
    costPerPerson: number;
    subsidyUsed: number;
    costPerPersonNoSubsidy: number;
    employeeCount: number;
    regularCount: number;
  } {
    const totalCost = courtFee + shuttlecockFee;

    // Classify attendees
    let employeeCount = 0;
    let regularCount = 0;
    let guestMemberCount = 0;

    attendees.forEach(m => {
      const type = m.membershipType || 'regular';
      if (type === 'employee') {
        employeeCount++;
      } else if (type === 'guest') {
        guestMemberCount++;
      } else {
        regularCount++;
      }
    });

    const guestCountTotal = guestMemberCount + guestCount;
    const guestFeeTotal = guestCountTotal * 35000;

    const totalPeople = employeeCount + regularCount + guestCountTotal;

    // 1. Cost per regular member = shuttlecock fee divided equally among ALL attendees
    // Regular members DO NOT pay court fee, they only pay their share of shuttlecocks!
    let costPerPerson = 0;
    if (totalPeople > 0) {
      costPerPerson = shuttlecockFee / totalPeople;
      // Round to nearest 1,000 VND
      costPerPerson = Math.round(costPerPerson / 1000) * 1000;
    }

    // 2. Company support fund ONLY covers the cost of employees (court share + shuttlecock share)
    // It does not subsidize or cover any deficit for regular members or guests
    let subsidyUsed = 0;
    if (totalPeople > 0 && employeeCount > 0) {
      const costPerEmployee = totalCost / totalPeople;
      subsidyUsed = employeeCount * costPerEmployee;
      subsidyUsed = Math.round(subsidyUsed / 1000) * 1000;
    }

    // Remaining cost (just for display compatibility if needed, or totalCost minus guest fee)
    const remainingCost = Math.max(0, totalCost - guestFeeTotal);

    // Average raw split without subsidy (for comparison/stats)
    let costPerPersonNoSubsidy = totalPeople > 0 ? totalCost / totalPeople : 0;
    costPerPersonNoSubsidy = Math.round(costPerPersonNoSubsidy / 1000) * 1000;

    return {
      totalCost,
      guestCountTotal,
      guestFeeTotal,
      remainingCost,
      costPerPerson,
      subsidyUsed,
      costPerPersonNoSubsidy,
      employeeCount,
      regularCount,
    };
  }
}
