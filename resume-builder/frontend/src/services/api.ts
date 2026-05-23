import axios from 'axios';

const API_BASE_URL = 'http://localhost:8085/api';

export const fetchJobs = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/jobs`);
        return response.data;
    } catch (error) {
        console.error('Error fetching jobs:', error);
        throw error;
    }
};

export const applyForJob = async (jobId: number, resumeData: unknown) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/apply`, {
            jobId,
            resumeData,
        });
        return response.data;
    } catch (error) {
        console.error('Error applying for job:', error);
        throw error;
    }
};

export const updateResume = async (resumeData: unknown) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/resume/update`, resumeData);
        return response.data;
    } catch (error) {
        console.error('Error updating resume:', error);
        throw error;
    }
};

export const generateResume = async (content: string, jobDescription = '', jobTitle = '') => {
    try {
        const response = await axios.post(`${API_BASE_URL}/resume/generate`, {
            content,
            jobDescription,
            jobTitle,
        });
        return response.data;
    } catch (error) {
        console.error('Error generating resume:', error);
        throw error;
    }
};
