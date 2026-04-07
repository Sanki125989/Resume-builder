import React, { useEffect, useState } from 'react';
import { Job } from '../types';
import { fetchJobs } from '../services/api';

const JobList: React.FC = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const getJobs = async () => {
            try {
                const jobData = await fetchJobs();
                setJobs(jobData);
            } catch (err) {
                setError('Failed to fetch jobs');
            } finally {
                setLoading(false);
            }
        };

        getJobs();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div>
            <h2>Job Listings</h2>
            <ul>
                {jobs.map((job) => (
                    <li key={job.id}>
                        <h3>{job.title}</h3>
                        <p>{job.description}</p>
                        <button onClick={() => {/* Handle job application */}}>
                            Apply
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default JobList;