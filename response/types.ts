export type JobData = {
    job: string,
    rate: number,
    benefitsRate: number 
    // don't have to worry about int or float in this in environment. pretty sure number is double float. 
}

export type TimePunch = {
    job: string,
    start: string,
    end: string
}

export type EmployeeData = {
    employee: string,
    timePunch: [TimePunch]
}

type CombinedData = {
    jobMeta: [JobData],
    employeeData: [EmployeeData]
}

export default CombinedData;