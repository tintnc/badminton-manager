import { eachDayOfInterval, endOfMonth, isThursday, isTuesday, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Session } from '../models/types';

export class ScheduleGenerator {
  /**
   * Generates draft sessions for all Tuesdays and Thursdays in a given month.
   */
  static generateForMonth(
    year: number,
    month: number, // 0-indexed (0 = January)
    defaultLocation: string = 'Sân cầu lông C30',
    defaultStartTime: string = '19:00',
    defaultEndTime: string = '21:00'
  ): Session[] {
    const startDate = new Date(year, month, 1);
    const endDate = endOfMonth(startDate);

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    const sessions: Session[] = [];

    allDays.forEach((day) => {
      if (isTuesday(day) || isThursday(day)) {
        sessions.push({
          id: uuidv4(),
          date: format(day, 'yyyy-MM-dd'),
          startTime: defaultStartTime,
          endTime: defaultEndTime,
          location: defaultLocation,
          status: 'planned',
          courtFee: 0,
          shuttlecocksUsed: 0,
          shuttlecockFee: 0,
          fundSubsidyUsed: 0,
          totalCost: 0,
          attendeeIds: [],
          guestCount: 0,
          costPerPerson: 0,
          costPerPersonNoSubsidy: 0,
        });
      }
    });

    return sessions;
  }
}
