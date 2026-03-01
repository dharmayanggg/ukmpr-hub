// Improved error handling for Turso database connection
try {
    await connectToTursoDatabase();
} catch (error) {
    if (process.env.NODE_ENV === 'development') {
        console.debug('Database connection error:', error);
    }
    console.error('Unable to connect to the Turso database. Please check your configuration and try again.');
    throw new Error('Database connection failed.');
}