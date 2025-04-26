const mysql = require('mysql2');


const connection = mysql.createConnection({
    host: 'localhost', 
    user: 'root',      
    password: 'NDA152@p',      
    database: 'environmenttracker' 
}); 

connection.query('SELECT * FROM info', (error, results) => {
    if (error) {
        console.error('Error executing query:', error.stack);
        return;
    }
    console.log('Query results:', results[0]);
});


connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database as ID', connection.threadId);
});


module.exports = connection;
