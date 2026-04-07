export interface Job {
    id: number;
    title: string;
    description: string;
    company: string;
    location: string;
    postedDate: string;
}

export interface User {
    id: number;
    username: string;
    email: string;
    password: string;
}

export interface Application {
    id: number;
    userId: number;
    jobId: number;
    status: string;
    appliedDate: string;
}