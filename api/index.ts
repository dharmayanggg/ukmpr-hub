// Improved error handling and logging for Turso database connection

const { connect } = require('turso');

const dbConfig = {
    databaseUrl: process.env.DATABASE_URL || 'your-default-db-url', // Default DB URL for local development
    // Add other configuration options as needed
};

async function connectToDatabase() {
    try {
        const connection = await connect(dbConfig);
        console.log('Database connected successfully.');
        return connection;
    } catch (error) {
        console.error('Database connection error:', error.message);
        throw new Error('Could not connect to the database.');
    }
}

// Improve env variable detection for Vercel deployment
if (!process.env.DATABASE_URL) {
    console.warn('Warning: DATABASE_URL is not set.');
    // Consider exiting or using a fallback
}

module.exports = connectToDatabase;