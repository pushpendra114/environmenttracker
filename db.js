import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export async function connectToDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: 'mysql-2956fa25-ssb2fauji-44c8.l.aivencloud.com',
      port: 20317,
      user: 'avnadmin',
      password: process.env.DB_PASSWORD, // Use the env variable
      database: 'environmenttracker',
      ssl: {
        rejectUnauthorized: false
      }
    });
    alert('✅ Connected to Aiven MySQL database!');
    // console.log('✅ Connected to Aiven MySQL database!');
    return connection;
  } catch (error) {
    alert('✅ Error connecting to database!');
    console.error('❌ Error connecting to Aiven MySQL:', error.message);
    throw error;
  }
}


export async function executeQuery(connection, query, values) {
  try {
    const [rows, fields] = await connection.execute(query, values);
    return rows;
  } catch (error) {
    console.error('❌ Error executing query:', error.message);
    throw error;
  }
}
