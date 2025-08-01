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
    const ratesMap = mapRatesToJobTitle(root.jobMeta);
    const calculationsMap: Record<string, {employee: string, regular: number, overtime: number, doubletime: number }> = {}
    root.employeeData.forEach((record) => {
        var jobRecordsMap: Record<string, {normal: number, overtime: number, doubletime: number}> = {};
        var currentTotal = 0;
        record.timePunch.forEach((timePunch) => {
            jobRecordsMap = createRecordForJob(jobRecordsMap ,timePunch.job);
            const totalHrs = totalHrsFromTp(timePunch);
            const classifiedHours = classifyHourType(currentTotal, totalHrs);

            jobRecordsMap[timePunch.job].normal += classifiedHours.normal;
            jobRecordsMap[timePunch.job].overtime += classifiedHours.overtime;
            jobRecordsMap[timePunch.job].doubletime += classifiedHours.doubletime;
            
            currentTotal += totalHrs;

        });
        calculationsMap[record.employee] = {employee: record.employee, ...calculateTotals(jobRecordsMap, ratesMap)};
        
        
    });

    // Looks right to me aside from the typical floating point discrepancies that may occur!
    console.log(JSON.stringify(calculationsMap, null, 2));
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
    if (currentTotal + timePunchHours <= 40) {
        classifiedHours.normal = timePunchHours;
        return classifiedHours;
    }
    if (currentTotal + timePunchHours > 40) {
        if (difference > 8) {
            classifiedHours.overtime = 8;
            classifiedHours.normal = 40 - currentTotal;
            classifiedHours.doubletime = timePunchHours - classifiedHours.normal - classifiedHours.overtime;
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

function classifyHourType(currentTotal: number, timePunchHours: number): {normal: number, overtime: number, doubletime: number} {
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

function calculateTotals(jobRecordsMap: Record<string, {normal: number, overtime: number, doubletime: number}>, 
    ratesMap: Record<string, Partial<JobData>>): {wageTotal: number, benefitTotal: number, doubletime: number, regular: number, overtime: number} {
    const jobsWorked = Object.keys(jobRecordsMap);
    var benefitTotal = 0, wageTotal = 0, overtime = 0, regular = 0, doubletime = 0; // had been referring to "regular" hours as "normal", so i fix it here. 
    
    jobsWorked.forEach((jobTitle) => {
        const jobPayRate = ratesMap[jobTitle].rate;
        const jobBenefitsRate = ratesMap[jobTitle].benefitsRate;
        regular += jobRecordsMap[jobTitle].normal;
        overtime += jobRecordsMap[jobTitle].overtime;
        doubletime += jobRecordsMap[jobTitle].doubletime;
        const allHoursWorkedForJob = jobRecordsMap[jobTitle].normal + jobRecordsMap[jobTitle].overtime + jobRecordsMap[jobTitle].doubletime;

        if (jobBenefitsRate && jobPayRate) {
            benefitTotal += allHoursWorkedForJob * jobBenefitsRate;
            wageTotal += (jobRecordsMap[jobTitle].normal * jobPayRate) + (jobRecordsMap[jobTitle].overtime * (jobPayRate * 1.5)) + (jobRecordsMap[jobTitle].doubletime * (jobPayRate * 2));
        }
    });
    return { benefitTotal, wageTotal, overtime, doubletime, regular };

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




enterCalculationStart();
