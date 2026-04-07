export interface User {
    id: number;
    username: string;
    email: string;
    password: string;
}

export interface Job {
    id: number;
    title: string;
    description: string;
    company: string;
    location: string;
    postedDate: Date;
}

export interface Resume {
    id: number;
    userId: number;
    content: string;
}

export interface Application {
    id: number;
    userId: number;
    jobId: number;
    status: 'applied' | 'interview' | 'rejected' | 'accepted';
    appliedDate: Date;
}