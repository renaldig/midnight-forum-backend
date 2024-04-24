const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const bodyParser = require('body-parser');

const app = express();
const port = 3001;

const pool = new Pool({
  user: '<INSERT_USER_HERE>',
  host: '<INSERT_HOST_HERE>',
  database: 'midnightforumdb',
  password: '<INSERT_PASSWORD_HERE>',
  port: '5432',
  ssl: {
    rejectUnauthorized: false  // You might want more strict options in a production scenario
  }
});

app.use(cors());
app.use(bodyParser.json());

// Fetch all threads

app.get('/test', (req, res) => {
    res.send('Test route works!');
});

app.get('/threads', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM threads');
    console.log(result.rows);  // Log the results
    res.json(result.rows);
  } catch (e) {
    console.error(e);  // Log the full error
    res.status(500).json({ error: e.message });
  }
});
// Create a new thread
app.post('/threads', async (req, res) => {
  const { title, content, userId } = req.body;

  try {
    const result = await pool.query('INSERT INTO threads (title, content, user_id) VALUES ($1, $2, $3) RETURNING *', [title, content, userId]);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch all posts for a given thread
app.get('/threads/:id/posts', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM posts WHERE thread_id = $1', [id]);
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Create a new post for a given thread
app.post('/threads/:id/posts', async (req, res) => {
  const { id } = req.params;
  const { content, userId } = req.body;
  try {
    const result = await pool.query('INSERT INTO posts (content, user_id, thread_id) VALUES ($1, $2, $3) RETURNING *', [content, userId, id]);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/threads/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM threads WHERE id = $1', [id]);

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Thread not found' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});


app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
