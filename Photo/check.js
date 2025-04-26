const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, 'Gunjan.jpg'); // Path to a file in a subdirectory

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});