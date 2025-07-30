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
}

function totalHoursPerJobTitle(timePunchCollection: [TimePunch]) {
    const jobHoursMap: Record<string, number> = {}
    timePunchCollection.forEach((timePunchEntry) => {
        // Have to make sure these aren't undefined before using += operator otherwise you'll run into NaN assignment and return.
        if (!jobHoursMap[timePunchEntry.job]) jobHoursMap[timePunchEntry.job] = totalHrsFromTp(timePunchEntry);
        else jobHoursMap[timePunchEntry.job] += totalHrsFromTp(timePunchEntry);
    });
    return jobHoursMap;
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




console.log(totalHoursPerJobTitle(stripJsonC().employeeData[0].timePunch));
