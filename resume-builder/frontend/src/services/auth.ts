import axios from 'axios';

const API_URL = 'http://localhost:8080/api'; // Adjust the API URL as needed

export const loginWithNaukri = async (credentials: { email: string; password: string }) => {
    try {
        const response = await axios.post(`${API_URL}/auth/naukri`, credentials);
        return response.data;
    } catch (error) {
        throw new Error('Login failed. Please check your credentials.');
    }
};

export const loginWithLinkedIn = async (credentials: { email: string; password: string }) => {
    try {
        const response = await axios.post(`${API_URL}/auth/linkedin`, credentials);
        return response.data;
    } catch (error) {
        throw new Error('Login failed. Please check your credentials.');
    }
};

export const logout = async () => {
    try {
        await axios.post(`${API_URL}/auth/logout`);
    } catch (error) {
        throw new Error('Logout failed. Please try again.');
    }
};