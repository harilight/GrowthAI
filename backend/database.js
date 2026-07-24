const mysql = require('mysql2/promise');

const DB_NAME = 'growthos';
const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '1234'
};

let pool;

async function initDatabase() {
    try {
        // First connect without database to create it if it doesn't exist
        const connection = await mysql.createConnection(DB_CONFIG);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
        await connection.end();

        // Now create a pool using the new database
        pool = mysql.createPool({
            ...DB_CONFIG,
            database: DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log("MySQL connected to database:", DB_NAME);
        await createTables();
    } catch (err) {
        console.error("MySQL Connection Error:", err);
    }
}

async function createTables() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS goals (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255),
            category VARCHAR(100),
            deadline VARCHAR(100),
            status VARCHAR(100),
            createdAt VARCHAR(100),
            updatedAt VARCHAR(100),
            icon VARCHAR(50),
            description TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS tasks (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255),
            goalId VARCHAR(255),
            priority VARCHAR(50),
            dueDate VARCHAR(100),
            recurrence VARCHAR(50),
            duration INT,
            completedDates JSON,
            createdAt VARCHAR(100),
            updatedAt VARCHAR(100)
        )`,
        `CREATE TABLE IF NOT EXISTS journal (
            id VARCHAR(255) PRIMARY KEY,
            date VARCHAR(100),
            content TEXT,
            mood VARCHAR(50),
            tags JSON
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(255) PRIMARY KEY,
            duration INT,
            taskIds JSON,
            mood VARCHAR(50),
            notes TEXT,
            timestamp VARCHAR(100)
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            \`key\` VARCHAR(255) PRIMARY KEY,
            \`value\` JSON
        )`,
        `CREATE TABLE IF NOT EXISTS rewards (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255),
            cost INT,
            icon VARCHAR(50),
            description TEXT,
            createdAt VARCHAR(100)
        )`,
        `CREATE TABLE IF NOT EXISTS redemptions (
            id VARCHAR(255) PRIMARY KEY,
            rewardId VARCHAR(255),
            title VARCHAR(255),
            cost INT,
            icon VARCHAR(50),
            timestamp VARCHAR(100)
        )`
    ];

    for (let query of queries) {
        await pool.query(query);
    }
    
    // Migrations for new features (ignore if already exists)
    try { await pool.query('ALTER TABLE goals ADD COLUMN categories JSON'); } catch(e) {}
    try { await pool.query('UPDATE goals SET categories = JSON_ARRAY(category) WHERE category IS NOT NULL AND categories IS NULL'); } catch(e) {}
    
    try { await pool.query('ALTER TABLE tasks ADD COLUMN goalIds JSON'); } catch(e) {}
    try { await pool.query('UPDATE tasks SET goalIds = JSON_ARRAY(goalId) WHERE goalId IS NOT NULL AND goalId != "" AND goalIds IS NULL'); } catch(e) {}
    
    try { await pool.query('ALTER TABLE tasks ADD COLUMN dueTime VARCHAR(100)'); } catch(e) {}

    console.log("MySQL Tables initialized successfully.");
}

function getPool() {
    if (!pool) throw new Error("Database not initialized yet.");
    return pool;
}

module.exports = {
    initDatabase,
    getPool
};
