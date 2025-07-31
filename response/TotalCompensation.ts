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



function enterCalculationStart() {
    const root = stripJsonC();
    root.employeeData.forEach((record) => {
        const jobRecordsMap: Record<string, {normal: number, overtime: number, doubletime: number}> = {};
        record.timePunch.forEach((timePunch) => {

        });
    });


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
    // This one is actually kind of tricky!!! There is probably a more optimal way to write this admittedly. The less cases of overspill the less confusing though.
    const classifiedHours = {normal: 0, overtime: 0, doubletime: 0 }
    const difference = (currentTotal + timePunchHours) - 40
    if (currentTotal + timePunchHours > 40) {
        if (difference > 8) {
            classifiedHours.overtime = 8;
            classifiedHours.normal = 40 - currentTotal;
            classifiedHours.doubletime = timePunchHours - classifiedHours.normal - classifiedHours.doubletime;
            return classifiedHours;
        }
        classifiedHours.normal = 40 - currentTotal;
        classifiedHours.overtime = timePunchHours - classifiedHours.normal;
    }
    return classifiedHours;
}

function calculateOvertimeHoursAndOverSpill(currentTotal: number, punchTimeHours: number) {
    // this function is effectively the same as the above but since we know we have gone over 40 total we skip any normal hr calc...
    const classifiedHours = {normal: 0, overtime: 0, doubletime: 0 } // just for consistency i am still populating the key for normal.
    const difference = (currentTotal + punchTimeHours) - 48;
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
