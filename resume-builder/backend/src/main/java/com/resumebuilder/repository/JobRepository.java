package com.resumebuilder.repository;

import com.resumebuilder.model.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JobRepository extends JpaRepository<Job, Long> {
    // Custom query methods can be defined here if needed
}