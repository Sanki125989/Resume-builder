import React, { useEffect, useState } from 'react';
import { Application } from '../types';
import { getApplications } from '../services/api';

const ApplicationTracker: React.FC = () => {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchApplications = async () => {
            try {
                const response = await getApplications();
                setApplications(response.data);
            } catch (error) {
                console.error('Error fetching applications:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchApplications();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h2>Application Tracker</h2>
            <ul>
                {applications.map((application) => (
                    <li key={application.id}>
                        <h3>{application.jobTitle}</h3>
                        <p>Status: {application.status}</p>
                        <p>Applied on: {new Date(application.appliedDate).toLocaleDateString()}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ApplicationTracker;