require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || '121212asasadqweqe1231';

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'job_portal',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Database connection test
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    console.log('Received Token:', token);


    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      console.log(err);
      if (err) {
        return res.status(403).json({ status: 'error', message: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Authentication error' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res
      .status(403)
      .json({ status: 'error', message: 'Admin privileges required' });
  }
}

function requireUser(req, res, next) {
  if (req.user) {
    next();
  } else {
    res
      .status(403)
      .json({ status: 'error', message: 'User privileges required' });
  }
}

// Register Endpoint
app.post(
  '/auth/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('username').notEmpty().withMessage('Username is required'),
    body('dob').notEmpty().isDate().withMessage('Valid date of birth is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      const { email, password, username, dob } = req.body;

      const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(400).json({ status: 'error', message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.execute(
        'INSERT INTO users (email, password, username, dob) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, username, dob]
      );

      const [user] = await pool.execute(
        'SELECT id, email, username, dob FROM users WHERE id = ?',
        [result.insertId]
      );

      const token = jwt.sign(user[0], JWT_SECRET, { expiresIn: '1h' });

      res.status(201).json({
        status: 'success',
        message: 'Registration successful',
        data: { user: user[0], token }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ status: 'error', message: 'Registration failed' });
    }
  }
);

// Login Endpoint
app.post(
  '/auth/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      const { email, password } = req.body;

      const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }

      
      const user = users[0];

      if (user.role !== 'user') {
        return res
          .status(403)
          .json({ status: 'error', message: 'Not authorized as user' });
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }

      const userData = {
        id: user.id,
        email: user.email,
        username: user.username,
        dob: user.dob
      };

      const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '1h' });

      res.json({
        status: 'success',
        message: 'Login successful',
        data: { user: userData, token }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ status: 'error', message: 'Login failed' });
    }
  }
);


// Get Jobs Endpoint
app.get('/api/jobs', async (req, res) => {
  try {
    const { search, type, location, skills } = req.query;
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (LOWER(title) LIKE ? OR LOWER(company) LIKE ?)';
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (location) {
      query += ' AND LOWER(location) LIKE ?';
      params.push(`%${location.toLowerCase()}%`);
    }
    if (skills) {
      skills.split(',').forEach(skill => {
        query += ' AND LOWER(skills) LIKE ?';
        params.push(`%${skill.trim().toLowerCase()}%`);
      });
    }

    const [jobs] = await pool.execute(query, params);
    res.json({ status: 'success', data: jobs });
  } catch (error) {
    console.error('Jobs fetch error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch jobs' });
  }
});


// Fetch Jobs Posted by the Logged-in User
app.get('/api/user/jobs', authenticateToken, async (req, res) => {
  try {
    const [jobs] = await pool.execute(
      'SELECT * FROM jobs WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ status: 'success', data: jobs });
  } catch (error) {
    console.error('Error fetching user jobs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user jobs' });
  }
});

// Fetch User Profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const [user] = await pool.execute(
      'SELECT id, email, username, dob FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ status: 'success', data: user[0] });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user profile' });
  }
});

// Save/Unsave Job Endpoint
app.post('/api/jobs/:jobId/save', authenticateToken, async (req, res) => {
  try {
    console.log('User:', req.user);
    const { jobId } = req.params;

    const [existing] = await pool.execute(
      'SELECT * FROM saved_jobs WHERE user_id = ? AND job_id = ?',
      [req.user.id, jobId]
    );

    if (existing.length > 0) {
      await pool.execute(
        'DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?',
        [req.user.id, jobId]
      );
      return res.json({
        status: 'success',
        message: 'Job removed from saved jobs'
      });
    } else {
      await pool.execute(
        'INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)',
        [req.user.id, jobId]
      );
      return res.json({
        status: 'success',
        message: 'Job saved successfully'
      });
    }
  } catch (error) {
    console.error('Save/unsave job error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save/unsave job' });
  }
});

// Fetch Saved Jobs
app.get('/api/saved-jobs', authenticateToken, async (req, res) => {
  try {
    const [savedJobs] = await pool.execute(
      'SELECT job_id FROM saved_jobs WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ status: 'success', data: savedJobs.map(job => job.job_id) });
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch saved jobs' });
  }
});
// Get Job by ID Endpoint
app.get('/api/jobs/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;
    
    if (isNaN(parseInt(job_id))) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid job ID format' 
      });
    }

    const [jobs] = await pool.execute(
      'SELECT * FROM jobs WHERE id = ?',
      [job_id]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Job not found' 
      });
    }

    res.json({ 
      status: 'success', 
      data: jobs[0] 
    });
  } catch (error) {
    console.error('Error fetching job by ID:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch job details' 
    });
  }
});

app.post(
  '/api/jobs',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Job title is required'),
    body('company').notEmpty().withMessage('Company name is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('type').notEmpty().withMessage('Job type is required'),
    body('skills').notEmpty().withMessage('Skills are required'),
    body('salary').notEmpty().withMessage('Salary is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('requirements').notEmpty().withMessage('Requirements are required'),
  ],
  async (req, res) => {
    try {
      console.log('User:', req.user);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      const { title, company, location, type, skills, salary, description, requirements } = req.body;

      const [result] = await pool.execute(
        'INSERT INTO jobs (title, company, location, type, description, requirements, salary, skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [title, company, location, type, description, requirements, salary, Array.isArray(skills) ? skills.join(',') : skills]
      );

      res.status(201).json({
        status: 'success',
        message: 'Job posted successfully',
        data: { id: result.insertId, title, company, location, type, skills, salary, description, requirements }
      });
    } catch (error) {
      console.error('Job posting error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to post job' });
    }
  }
);


// Get all jobs for admin
app.get('/admin/jobs', authenticateToken, requireAdmin, async (req, res) => {
  console.log('Admin:', req.user);
  try {
    const [jobs] = await pool.execute('SELECT * FROM jobs');
    console.log(jobs);
    res.json({ status: 'success', data: jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to fetch jobs' });
  }
});

// Delete a job
app.delete('/admin/jobs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    await connection.execute('DELETE FROM applications WHERE job_id = ?', [id]);
  
    await connection.execute('DELETE FROM saved_jobs WHERE job_id = ?', [id]);
    
    await connection.execute('DELETE FROM jobs WHERE id = ?', [id]);
    
    await connection.commit();
    
    res.json({ status: 'success', message: 'Job deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Delete job error:', error);
    res
      .status(500)
      .json({ 
        status: 'error', 
        message: 'Failed to delete job',
        error: error.message 
      });
  } finally {
    connection.release();
  }
});


// GET /api/saved-jobs
app.get('/api/saved-jobs', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT job_id FROM saved_jobs WHERE user_id = ?',
      [req.user.id]
    );

    const jobIds = rows.map((row) => row.job_id);

    res.json({ status: 'success', data: jobIds });
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch saved jobs'
    });
  }
});

// GET /api/user/applications
app.get('/api/user/applications', authenticateToken, async (req, res) => {
  try {
    const [applications] = await pool.execute(
      'SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ status: 'success', data: applications });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch applications'
    });
  }
});


// Get all users for admin
app.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, username, dob, role, created_at FROM users'
    );
    res.json({ status: 'success', data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to fetch users' });
  }
});

// Update user profile endpoint
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email, dob } = req.body;

    if (!username || !email || !dob) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, email, and date of birth are required.',
      });
    }

    await pool.execute(
      'UPDATE users SET username = ?, email = ?, dob = ? WHERE id = ?',
      [username, email, dob, req.user.id]
    );
    const [user] = await pool.execute(
      'SELECT id, username, email, dob FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: user[0],
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Profile update failed',
    });
  }
});


// Delete a user
app.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('DELETE FROM applications WHERE user_id = ?', [id]);
    await pool.execute('DELETE FROM saved_jobs WHERE user_id = ?', [id]);

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ status: 'success', message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to delete user' });
  }
});


// Get dashboard stats for admin
app.get('/admin/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [[{ totalJobs }]] = await pool.execute('SELECT COUNT(*) as totalJobs FROM jobs');
    const [[{ totalUsers }]] = await pool.execute('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalApplications }]] = await pool.execute('SELECT COUNT(*) as totalApplications FROM applications');
    const [[{ pendingApplications }]] = await pool.execute("SELECT COUNT(*) as pendingApplications FROM applications WHERE status = 'PENDING'");
    console.log(totalJobs, totalUsers, totalApplications, pendingApplications);
    res.json({
      status: 'success',
      data: { totalJobs, totalUsers, totalApplications, pendingApplications },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to fetch dashboard stats' });
  }
});

app.post(
  '/auth/admin/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ status: 'error', errors: errors.array() });
      }
      const { email, password } = req.body;
      const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

      if (users.length === 0) {
        return res
          .status(401)
          .json({ status: 'error', message: 'Invalid credentials' });
      }
      const user = users[0];
      if (user.role !== 'admin') {
        return res
          .status(403)
          .json({ status: 'error', message: 'Not authorized as admin' });
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);
        return res
          .status(401)
          .json({ status: 'error', message: 'Invalid credentials' });
      }
      const userData = {
        id: user.id,
        email: user.email,
        username: user.username,
        dob: user.dob,
        role: user.role,
      };
      const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '1h' });
      res.json({
        status: 'success',
        message: 'Admin login successful',
        data: { user: userData, token },
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ status: 'error', message: 'Admin login failed' });
    }
  }
);



// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads', 'cvs');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `cv-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/user/upload-cv', authenticateToken, upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'No file uploaded or invalid file type' 
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO user_cvs (user_id, filename, original_name, file_path, mime_type) VALUES (?, ?, ?, ?, ?)',
      [
        req.user.id,
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.mimetype
      ]
    );

    await pool.execute(
      'UPDATE users SET cv_id = ? WHERE id = ?',
      [result.insertId, req.user.id]
    );

    res.status(201).json({
      status: 'success',
      message: 'CV uploaded successfully',
      data: {
        id: result.insertId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: `/uploads/cvs/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error('CV upload error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload CV' });
  }
});

// Get user's CV
app.get('/user/cv', authenticateToken, async (req, res) => {
  try {
    const [cvs] = await pool.execute(
      'SELECT * FROM user_cvs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (cvs.length === 0) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'No CV found for this user' 
      });
    }

    res.json({
      status: 'success',
      data: {
        id: cvs[0].id,
        filename: cvs[0].filename,
        originalName: cvs[0].original_name,
        path: `/uploads/cvs/${cvs[0].filename}`,
        uploadedAt: cvs[0].created_at
      }
    });
  } catch (error) {
    console.error('Error fetching user CV:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch CV' });
  }
});

// Update job application endpoint to include CV
app.post('/api/jobs/:jobId/apply', authenticateToken, async (req, res) => {
  try {
    console.log('User');
    const { jobId } = req.params;
    const { name, email, coverLetter, cvId } = req.body;

    if (!name || !email || !coverLetter) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, email, and cover letter are required'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO applications (job_id, user_id, name, email, cover_letter, cv_id) VALUES (?, ?, ?, ?, ?, ?)',
      [jobId, req.user.id, name, email, coverLetter, cvId || null]
    );

    res.status(201).json({
      status: 'success',
      message: 'Application submitted successfully',
      data: { id: result.insertId, jobId, name, email }
    });
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to submit application' });
  }
});



app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Something went wrong!' });
});

async function startServer() {
  const isConnected = await testConnection();
  if (isConnected) {
    app.listen(port, () => {
      console.log(`✅ Server is running on port ${port}`);
    });
  } else {
    console.error('❌ Server startup failed due to database connection error');
    process.exit(1);
  }
}

startServer();


