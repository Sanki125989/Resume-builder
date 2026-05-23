import React, { useState, useEffect } from 'react';
import { generateResume } from '../services/api';
import { Job } from '../types';

const ResumeEditor: React.FC<{ selectedJob: Job }> = ({ selectedJob }) => {
    const [resumeContent, setResumeContent] = useState<string>('');

    useEffect(() => {
        if (selectedJob) {
            setResumeContent(selectedJob.description || '');
        }
    }, [selectedJob]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setResumeContent(event.target.value);
    };

    const handleSave = () => {
        generateResume(resumeContent, selectedJob.description, selectedJob.title)
            .then(() => {
                alert('Resume generated successfully!');
            })
            .catch(error => {
                console.error('Error generating resume:', error);
            });
    };

    return (
        <div className="resume-editor">
            <h2>Generate Resume for {selectedJob.title}</h2>
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
