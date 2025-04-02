
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
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM jobs WHERE id = ?', [id]);
      res.json({ status: 'success', message: 'Job deleted successfully' });
    } catch (error) {
      console.error('Delete job error:', error);
      res
        .status(500)
        .json({ status: 'error', message: 'Failed to delete job' });
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
  
  // Delete a user
  app.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
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
      // Example statistics: total jobs, total users, total applications, pending applications
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

  