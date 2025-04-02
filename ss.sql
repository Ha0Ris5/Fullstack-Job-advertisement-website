-- Create `users` table
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  dob DATE NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  PRIMARY KEY (id)
);

-- Populate `users` table
INSERT INTO users (id, email, password, username, dob, role) VALUES
  (3, 'user123@3.com', '$2b$10$VYB6h8NfbaK7YCnw2VTKw.YnbSgR.3K0XbNdqQLAL.N95sl6gdmvi', 'demo', '2025-02-17', 'user'),
  (5, 'admin@example.com', '$2b$10$xw73tzF0xC2MvVf9IEsbTOAgj2AoC5YgSq9enKIOHiuMPv.dfcxZW', 'admin', '1990-01-01', 'admin');

-- Create `applications` table
CREATE TABLE applications (
  id INT NOT NULL AUTO_INCREMENT,
  job_id INT NOT NULL,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cover_letter TEXT,
  status ENUM('PENDING', 'REVIEWED', 'SHORTLISTED', 'REJECTED') DEFAULT 'PENDING',
  PRIMARY KEY (id)
);

-- Populate `applications` table
INSERT INTO applications (id, job_id, user_id, name, email, cover_letter, status) VALUES
  (3, 2, 3, 'sss', 'sss@ss.com', 'ssss', 'PENDING'),
  (4, 2, 3, 'sss', 'sss@ss.com', 'sssss', 'PENDING'),
  (5, 1, 3, 'sss', 'sss@ss.com', 'sadadadadsa', 'PENDING'),
  (6, 1, 3, 'sss', 'sss@ss.com', 'ssss', 'PENDING'),
  (7, 1, 3, 'sss', 'sss@ss.com', 'ss', 'PENDING'),
  (8, 2, 3, 'ss', 'sss@ss.com', 'ssssssss', 'PENDING'),
  (10, 1, 3, 'ss', 'sss@ss.com', 'sss', 'PENDING'),
  (12, 1, 3, 'sss', 'sss@ss.com', 'sss', 'PENDING'),
  (13, 1, 3, 'sss', 'sss@ss.com', 'sss', 'PENDING'),
  (14, 1, 3, 'ssss', 'sss@ss.com', 'ssss', 'PENDING'),
  (15, 7, 3, 'ssss', 'sss@ss.com', 'ssss', 'PENDING'),
  (16, 7, 3, 'sssss', 'sss@ss.com', 'ssss', 'PENDING');

-- Create `jobs` table
CREATE TABLE jobs (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  type ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP') NOT NULL,
  salary VARCHAR(50),
  PRIMARY KEY (id)
);

-- Populate `jobs` table
INSERT INTO jobs (id, title, company, location, type, salary) VALUES
  (1, 'Senior Frontend Developer', 'TechCorp', 'New York, NY', 'FULL_TIME', '120k - 150k'),
  (2, 'Backend Engineer', 'DataSys', 'Remote', 'FULL_TIME', '100k - 130k'),
  (7, 'ss', 'sss', 'ss', 'INTERNSHIP', '12');

-- Create `saved_jobs` table
CREATE TABLE saved_jobs (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  job_id INT NOT NULL,
  PRIMARY KEY (id)
);

-- Populate `saved_jobs` table
INSERT INTO saved_jobs (id, user_id, job_id) VALUES
  (9, 3, 2);
