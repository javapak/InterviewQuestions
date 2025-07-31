import { readFileSync } from 'fs';
import { resolve } from 'path';
import CombinedData, { EmployeeData, JobData, TimePunch } from './types';

/*
I am going to try to break any utilities and steps down
into small, readable functions/methods as this often encourages 
better understanding for others and also allows things to be reused relatively easily.
*/

function stripJsonC(): CombinedData {
    /* 
    wanted to avoid using any external parsers, seemed kind of unnecessary.
    this does make the assumption that only one multiline comment is present, 
    but since this isn't the main task at hand, I assume this is fine.
    */
    const rawText = readFileSync(resolve('GeneralLogic/PunchLogicTest.jsonc'), 'utf-8');
    return JSON.parse(rawText.substring(rawText.indexOf('*/') + 2)); // +2 because we are using indexOf on a 2 char string....


}

function totalHrsFromTp(timePunch: TimePunch): number {
    const startDate = new Date(timePunch.start);
    const endDate = new Date(timePunch.end);
    /* 
    getTime() returns a milisecond value of time elapsed from Jan 1, 1970 UTC
    division operations derived from standard unit conversion:
    1000 ms in 1s, 60 seconds in 1 minute, 60 minutes in 1 hour... 
    */
    return ((((endDate.getTime() - startDate.getTime()) / 1000) / 60) / 60); 
    // I guess you could simplify this by: 1000 * 60 * 60 = 3600000 but I find that to be less readable
}

function totalHoursCountTrackOvertime(timePunchCollection: [TimePunch]) {
    var overtimeHours = 0;
    var doubleTimeHours = 0;
    var normalHours = 0;
    var total = 0;
    const nonOverTimeValues: Record<string, number> = {} // At or  below 40 hour maximum.
    const timeAndAHalfValues: Record<string, number> = {} // At or below 48 hour maximum.
    const doubleTimeValues: Record<string, number> = {} // Exceeds 48 hour maximum.

    timePunchCollection.forEach((timePunchEntry) => {
        if (!nonOverTimeValues[timePunchEntry.job]) { 
            // we can go ahead and initialize for all if we find that a specific key for a job doesn't exist to avoid errors.
            nonOverTimeValues[timePunchEntry.job] = 0;
            timeAndAHalfValues[timePunchEntry.job] = 0;
            doubleTimeValues[timePunchEntry.job] = 0
        }
 
        const currentCardHours = totalHrsFromTp(timePunchEntry);
        total += currentCardHours;
        
        if (total <= 40) {
            if ((normalHours + currentCardHours ) <= 40) {
            normalHours += currentCardHours;
            nonOverTimeValues[timePunchEntry.job] += currentCardHours;
            }
            else {
                const difference = (normalHours + currentCardHours) - 40
                overtimeHours += difference;
                normalHours += currentCardHours - difference;
                nonOverTimeValues[timePunchEntry.job] += normalHours;
                timeAndAHalfValues[timePunchEntry.job] += difference;

            }
        }

        
        else if (total > 40 && total <= 48) {
            timeAndAHalfValues[timePunchEntry.job] += currentCardHours;
            overtimeHours += currentCardHours;
        }

        else {
            doubleTimeValues[timePunchEntry.job] += currentCardHours;

        }
    }
    )
}



function createRecordForJob(existingTotals: 
Record<string, {normal: number, overtime: number, doubletime: number}>,
jobAlias: string
): Record<string, {normal: number, overtime: number, doubletime: number }> {
    if (!existingTotals[jobAlias]) {
        return {
            ...existingTotals,
            [jobAlias]: { normal: 0, overtime: 0, doubletime: 0 }
        }
    }
    return existingTotals;
}

function calculateNormalHoursAndOverSpill(currentTotal: number, timePunchHours: number) {
    const classifiedHours = {normal: 0, overtime: 0, doubletime: 0 }
    const difference = (currentTotal + timePunchHours) - 40
    if (currentTotal + timePunchHours > 40) {
        if (difference > 8) {
            classifiedHours.overtime = 8 - difference;
            classifiedHours.doubletime = difference - 8;
            classifiedHours.normal = difference - classifiedHours.doubletime - classifiedHours.overtime
            return classifiedHours;
        }
        classifiedHours.overtime = difference;
        classifiedHours.normal = timePunchHours - difference;
    }
    return classifiedHours;
}

function calculateOvertimeHoursAndOverSpill(currentTotal: number, punchTimeHours: number) {
    // this function is effectively the same as the above but since we know we have gone over 40 total we skip any normal hr calc...
    const classifiedHours = {normal: 0, overtime: 0, doubletime: 0 } // just for consistency i am still populating the key for normal.
    const difference = (currentTotal + punchTimeHours) - 48
    if ((currentTotal + punchTimeHours) > 48) {
        classifiedHours.doubletime = difference;
        classifiedHours.overtime = punchTimeHours - difference;
        return classifiedHours;
    }
    classifiedHours.overtime = punchTimeHours;
    return classifiedHours;
}

function clasifyHourType(currentTotal: number, timePunchHours: number): {normal: number, overtime: number, doubletime: number} {
    var classifiedHours = {normal: 0, overtime: 0, doubletime: 0}
    if (currentTotal <= 40) {
        const classifiedGroup = calculateNormalHoursAndOverSpill(currentTotal, timePunchHours);
        classifiedHours = classifiedGroup;
        return classifiedHours;
    }
    else if (currentTotal > 40 && currentTotal <= 48) {
        const classifiedGroup = calculateOvertimeHoursAndOverSpill(currentTotal, timePunchHours);
        classifiedHours = classifiedGroup;
        return classifiedHours;
    }
    else if (currentTotal > 48) {
        classifiedHours.doubletime = timePunchHours;
    }

    return classifiedHours;

}

function mapRatesToJobTitle(jobMeta: [JobData]): Record<string, Partial<JobData>> {
    /* 
    while you could use .find or iterate through jobMeta array 
    each time you need to look up rates, it makes sense to do this 
    once and create a record that is accessible at constant time O(1) due
    to the frequency of the call where you would repeat a linear lookup, O(n).
    i know this is probably a bit much given the number of elements in the array,
    but with a lot of data it would matter (: 
    */
    const jobsDataMap: Record<string, Partial<JobData>> = {};
    jobMeta.forEach((val: JobData) => {
        jobsDataMap[val.job] = {rate: val.rate, benefitsRate: val.benefitsRate};
    });

    return jobsDataMap
    
}


const root = stripJsonC();
const employeeObject = {};
employeeObject[root.employeeData[0].employee] = totalHoursCountTrackOvertime(root.employeeData[0].timePunch);
console.log();
