import { createClient } from '@libsql/client';
import express from 'express';
import { json } from 'body-parser';

const app = express();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL as string,
    authToken: process.env.TURSO_AUTH_TOKEN as string
});

app.use(json());

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: "online" });
});

app.get('/api/data', async (req, res) => {
    try {
        const response = await client.execute('SELECT 1'); 
        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

export default app;
