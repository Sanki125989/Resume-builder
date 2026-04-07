import React, { useState, useEffect } from 'react';
import { fetchJobDescription, updateResume } from '../services/api';
import { Job } from '../types';

const ResumeEditor: React.FC<{ selectedJob: Job }> = ({ selectedJob }) => {
    const [resumeContent, setResumeContent] = useState<string>('');

    useEffect(() => {
        if (selectedJob) {
            fetchJobDescription(selectedJob.id)
                .then(description => {
                    setResumeContent(description);
                })
                .catch(error => {
                    console.error('Error fetching job description:', error);
                });
        }
    }, [selectedJob]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setResumeContent(event.target.value);
    };

    const handleSave = () => {
        updateResume(selectedJob.id, resumeContent)
            .then(() => {
                alert('Resume updated successfully!');
            })
            .catch(error => {
                console.error('Error updating resume:', error);
            });
    };

    return (
        <div className="resume-editor">
            <h2>Edit Resume for {selectedJob.title}</h2>
            <textarea
                value={resumeContent}
                onChange={handleChange}
                rows={10}
                cols={50}
            />
            <button onClick={handleSave}>Save Resume</button>
        </div>
    );
};

export default ResumeEditor;