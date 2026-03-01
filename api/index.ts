import { createClient } from 'turso';
import express from 'express';
import { json } from 'body-parser';

const app = express();
const port = process.env.PORT || 3000;

// Turso database connection
const client = createClient({
    url: process.env.TURSO_URL,
    token: process.env.TURSO_TOKEN
});

app.use(json());

// Example route for fetching data from Turso
app.get('/data', async (req, res) => {
    try {
        const response = await client.query('SELECT * FROM your_table');
        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

export default app;